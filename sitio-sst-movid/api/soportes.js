import { randomUUID } from 'node:crypto';
import { check, db, listFiles, putFile, storageConfigured } from '../lib/db.js';
import { broadcast, nameVisitor, visitorId } from '../lib/live.js';
import { checkCompletion } from '../lib/completion.js';
import {
  MAX_FILE_BYTES,
  contentTypeOf,
  createSoportesIndexPdf,
  validateSoportes,
} from '../lib/soportes.js';

// Flujo: start (manifiesto) → upload (un archivo por solicitud) → finish (índice y registro)
const prefix = 'soportes';

function sendJson(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(value);
}

const safeId = (value) =>
  typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function readPending(id) {
  const row = check(await db().from('soportes_pendientes').select('data').eq('id', id).maybeSingle());
  return row ? row.data : null;
}

async function readRawBody(request, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) throw Object.assign(new Error('too-large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleStart(request, response) {
  if (typeof request.body?.website === 'string' && request.body.website.trim()) {
    return sendJson(response, 400, { error: 'La solicitud no es válida.' });
  }
  const validation = validateSoportes(request.body);
  if (validation.error) return sendJson(response, 400, { error: validation.error });
  const id = randomUUID();
  check(await db().from('soportes_pendientes').insert({ id, data: { id, ...validation.soportes } }));
  return sendJson(response, 201, { id, files: validation.soportes.files.map(({ index, path }) => ({ index, path })) });
}

async function handleUpload(request, response) {
  const id = request.query.id;
  const index = Number(request.query.index);
  if (!safeId(id) || !Number.isInteger(index)) return sendJson(response, 400, { error: 'La solicitud no es válida.' });
  const pending = await readPending(id);
  const file = pending?.files.find((item) => item.index === index);
  if (!file) return sendJson(response, 404, { error: 'El envío no existe o ya fue finalizado.' });
  const body = await readRawBody(request, MAX_FILE_BYTES);
  if (body.length !== file.size) return sendJson(response, 400, { error: `El archivo "${file.name}" llegó incompleto. Intenta de nuevo.` });
  await putFile(`${prefix}/${id}/${file.path}`, body, contentTypeOf(file.name));
  return sendJson(response, 200, { ok: true, index });
}

async function handleFinish(request, response) {
  const id = request.query.id;
  if (!safeId(id)) return sendJson(response, 400, { error: 'La solicitud no es válida.' });
  const pending = await readPending(id);
  if (!pending) return sendJson(response, 404, { error: 'El envío no existe o ya fue finalizado.' });
  const stored = new Set(await listFiles(`${prefix}/${id}`));
  const missing = pending.files.filter((file) => !stored.has(`${prefix}/${id}/${file.path}`));
  if (missing.length) return sendJson(response, 400, { error: `Faltan archivos por subir: ${missing.map((file) => file.name).join(', ')}.` });

  const now = new Date();
  const record = {
    version: 1,
    ...pending,
    id,
    createdAt: now.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }),
    consentAcceptedAt: now.toISOString(),
  };
  const pdf = await createSoportesIndexPdf(record);
  await putFile(`submissions/${id}.pdf`, pdf, 'application/pdf');
  check(await db().from('registros').insert({ id, kind: 'soportes', created_at: record.consentAcceptedAt, data: record }));
  await nameVisitor(db, visitorId(request), record.name);
  await broadcast({ t: 'envia', k: 'soportes', n: record.name, s: visitorId(request) });
  await checkCompletion(record.document);
  check(await db().from('soportes_pendientes').delete().eq('id', id));
  return sendJson(response, 201, { id, name: record.name, createdAt: record.createdAt });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Método no permitido.' });
  }
  if (!storageConfigured()) {
    return sendJson(response, 503, { error: 'El almacenamiento aún no está configurado.' });
  }
  try {
    const action = request.query.action;
    if (action === 'start') return await handleStart(request, response);
    if (action === 'upload') return await handleUpload(request, response);
    if (action === 'finish') return await handleFinish(request, response);
    return sendJson(response, 400, { error: 'Acción no válida.' });
  } catch (error) {
    if (error.status === 413) return sendJson(response, 413, { error: 'El archivo supera el tamaño máximo de 4 MB.' });
    console.error('Falló el envío de HV y soportes.', error);
    return sendJson(response, 500, { error: 'No fue posible enviar los documentos. Intenta de nuevo.' });
  }
}
