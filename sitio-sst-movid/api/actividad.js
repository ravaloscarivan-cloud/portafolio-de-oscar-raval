import { check, db, storageConfigured } from '../lib/db.js';
import { broadcast } from '../lib/live.js';

// Actividad de quienes usan el sitio (entrar a una sección o llenar sus campos). Nunca lleva lo que la persona escribe.
// Se guarda una fila por visitante (tabla visitas) con su sección y acción más recientes, y se avisa a la campana.
const maxBodyBytes = 512;
const VIEWS = ['application', 'hr', 'docs', 'induccion', 'vot'];

function sendJson(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(value);
}

export function validateActividad(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (!['entra', 'llena'].includes(input.t) || !VIEWS.includes(input.v)) return null;
  const session = typeof input.s === 'string' && /^[0-9a-f]{8}$/.test(input.s) ? input.s : '';
  if (!session) return null;
  const name = typeof input.n === 'string'
    ? input.n.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80)
    : '';
  return { t: input.t, v: input.v, s: session, ...(name ? { n: name } : {}) };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Método no permitido.' });
  }
  if (Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') > maxBodyBytes) {
    return sendJson(response, 413, { error: 'La solicitud supera el tamaño permitido.' });
  }
  const actividad = validateActividad(request.body);
  if (!actividad) return sendJson(response, 400, { error: 'La solicitud no es válida.' });
  let name = actividad.n || '';
  if (storageConfigured()) {
    try {
      const now = new Date().toISOString();
      const row = check(await db().from('visitas')
        .upsert({ sesion: actividad.s, vista: actividad.v, tipo: actividad.t, updated_at: now, ...(name ? { nombre: name } : {}) })
        .select('nombre').single());
      name ||= row?.nombre || '';
      // Limpieza ocasional: las visitas de más de 60 días ya no se muestran
      if (Math.random() < 0.02) await db().from('visitas').delete().lt('updated_at', new Date(Date.now() - 60 * 864e5).toISOString());
    } catch (error) {
      console.error('No se pudo registrar la visita.', error);
    }
  }
  await broadcast({ ...actividad, ...(name ? { n: name } : {}) });
  return response.status(204).end();
}
