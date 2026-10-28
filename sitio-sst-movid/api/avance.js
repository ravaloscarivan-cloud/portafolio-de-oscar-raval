import { check, db, storageConfigured } from '../lib/db.js';
import { broadcast, nameVisitor, visitorId } from '../lib/live.js';

// Avance del preguardado de la hoja de vida: el navegador informa cuántas secciones lleva
// cada vez que cambia ese número. La consulta se hace desde /api/submissions (con clave).
const maxBodyBytes = 2 * 1024;

const clean = (value, max) =>
  typeof value === 'string'
    ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
    : '';

function sendJson(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(value);
}

export function validateAvance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const id = typeof input.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) ? input.id : '';
  const total = Number(input.total);
  const done = Number(input.done);
  if (!id || !Number.isInteger(total) || total < 1 || total > 30 || !Number.isInteger(done) || done < 0 || done > total) return null;
  return {
    id,
    name: clean(input.name, 120),
    document: clean(input.document, 20).replace(/[^0-9A-Za-z]/g, ''),
    done,
    total,
    next: done === total ? '' : clean(input.next, 100),
    sent: input.sent === true,
  };
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
  const avance = validateAvance(request.body);
  if (!avance) return sendJson(response, 400, { error: 'La solicitud no es válida.' });
  if (!storageConfigured()) return sendJson(response, 503, { error: 'El almacenamiento aún no está configurado.' });

  try {
    const now = new Date().toISOString();
    check(await db().from('hv_avance').upsert({ id: avance.id, data: { ...avance, updatedAt: now }, updated_at: now }));
    await nameVisitor(db, visitorId(request), avance.name);
    await broadcast({ t: 'avance', n: avance.name, done: avance.done, total: avance.total, s: visitorId(request) });
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('Falló el guardado del avance de la hoja de vida.', error);
    return sendJson(response, 500, { error: 'No fue posible guardar el avance.' });
  }
}
