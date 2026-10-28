import { check, db, storageConfigured } from '../lib/db.js';
import { broadcast, nameVisitor, visitorId } from '../lib/live.js';
import { checkCompletion } from '../lib/completion.js';

// Inducción terminada: la persona vio los videos y respondió la lista de chequeo de evaluación.
// Se guarda una fila por documento (tabla induccion) y, si ya entregó HV y soportes, se le envía el manual.
const maxBodyBytes = 4 * 1024;

const clean = (value, max) =>
  typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

function sendJson(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(value);
}

export function validateInduccion(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'La solicitud no es válida.' };
  const document = clean(input.document, 20).replace(/[^0-9A-Za-z]/g, '');
  const name = clean(input.name, 120);
  const email = clean(input.email, 120);
  const list = (value) => (Array.isArray(value) ? value : []).slice(0, 40).map((item) => clean(item, 60)).filter(Boolean);
  if (document.length < 4 || document.length > 15) return { error: 'Revisa tu número de documento.' };
  if (name.length < 5) return { error: 'Escribe tu nombre completo.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Revisa tu correo electrónico.' };
  return { induccion: { document, name, email, videos: list(input.videos), checklist: list(input.checklist) } };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Método no permitido.' });
  }
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return sendJson(response, 415, { error: 'El contenido debe ser JSON.' });
  }
  if (Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') > maxBodyBytes) {
    return sendJson(response, 413, { error: 'La solicitud supera el tamaño permitido.' });
  }
  const { induccion, error } = validateInduccion(request.body);
  if (error) return sendJson(response, 400, { error });
  if (!storageConfigured()) return sendJson(response, 503, { error: 'El almacenamiento aún no está configurado.' });

  try {
    const now = new Date().toISOString();
    check(await db().from('induccion').upsert({
      documento: induccion.document, nombre: induccion.name, email: induccion.email,
      data: { videos: induccion.videos, checklist: induccion.checklist }, completed_at: now,
    }));
    await nameVisitor(db, visitorId(request), induccion.name);
    await broadcast({ t: 'envia', k: 'induccion', n: induccion.name, s: visitorId(request) });
    await checkCompletion(induccion.document);
    return sendJson(response, 201, { ok: true, completedAt: now });
  } catch (failure) {
    console.error('Falló el registro de la inducción.', failure);
    return sendJson(response, 500, { error: 'No fue posible registrar la inducción. Intenta de nuevo.' });
  }
}
