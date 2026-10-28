import { leerCuerpo } from '../lib/auth.js';
import { obtenerCapacitacion } from '../lib/capacitacion.js';
import { getSql } from '../lib/db.js';

const MAX_FIRMA = 1_500_000; // ~1.1 MB de imagen
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limpiar = (v, max = 120) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// Asistencia a una capacitación: nombre, apellido, correo y firma, con la fecha de la capacitación.
// Los usuarios solo pueden registrar su propia asistencia (no hay lectura ni edición pública).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = leerCuerpo(req);
  if (body === null) return res.status(400).json({ error: 'Solicitud inválida' });
  const capacitacionId = limpiar(body.capacitacionId);
  const nombre = limpiar(body.nombre);
  const apellido = limpiar(body.apellido);
  const correo = limpiar(body.correo, 200).toLowerCase();
  const firma = String(body.firma ?? '');

  const faltan = Object.entries({ capacitacionId, nombre, apellido, correo, firma }).filter(([, v]) => !v).map(([k]) => k);
  if (faltan.length) return res.status(400).json({ error: `Campos requeridos: ${faltan.join(', ')}` });
  if (!CORREO.test(correo)) return res.status(400).json({ error: 'El correo electrónico no es válido' });
  if (!firma.startsWith('data:image/png;base64,') || firma.length > MAX_FIRMA) {
    return res.status(400).json({ error: 'Formato de firma inválido' });
  }

  try {
    const sql = await getSql();
    const cap = await obtenerCapacitacion(sql, capacitacionId);
    if (!cap) return res.status(404).json({ error: 'La capacitación no existe' });

    const [fila] = await sql`
      INSERT INTO asistencias (capacitacion_id, capacitacion, nombre, apellido, correo, firma, fecha)
      VALUES (${cap.id}, ${cap.titulo}, ${nombre}, ${apellido}, ${correo}, ${firma}, ${cap.fecha})
      ON CONFLICT (capacitacion_id, correo) WHERE capacitacion_id <> 'general' DO NOTHING
      RETURNING id, nombre`;

    if (!fila) return res.status(409).json({ error: 'Este correo ya registró su asistencia a esta capacitación.' });
    return res.status(201).json({ id: fila.id, nombre: fila.nombre, capacitacion: cap.titulo, fecha: cap.fecha });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo registrar la asistencia. Intente de nuevo.' });
  }
}
