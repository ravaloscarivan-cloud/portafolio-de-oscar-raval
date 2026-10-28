import { fechaRegistro } from '../lib/capacitacion.js';
import { getSql } from '../lib/db.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET ?correo=… → qué evaluaciones ha presentado esa persona, para marcar su avance en cada capacitación.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const correo = String(req.query?.correo ?? '').trim().toLowerCase().slice(0, 200);
  if (!CORREO.test(correo)) return res.status(400).json({ error: 'Correo inválido' });
  try {
    const sql = await getSql();
    const filas = await sql`SELECT capacitacion_id, tipo, puntaje, fecha, nombre, apellido FROM evaluaciones WHERE correo = ${correo}`;
    const firmas = await sql`
      SELECT capacitacion_id, fecha
      FROM asistencias
      WHERE correo = ${correo}
        AND firma LIKE 'data:image/png;base64,%'
        AND length(firma) > 22`;
    const progreso = {};
    for (const f of filas) (progreso[f.capacitacion_id] ??= {})[f.tipo] = { puntaje: f.puntaje, fecha: fechaRegistro(f.capacitacion_id, f.fecha) };
    for (const a of firmas) (progreso[a.capacitacion_id] ??= {}).asistencia = { fecha: fechaRegistro(a.capacitacion_id, a.fecha) };
    const persona = filas[0] ? { nombre: filas[0].nombre, apellido: filas[0].apellido } : null;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ persona, progreso });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo consultar el avance' });
  }
}
