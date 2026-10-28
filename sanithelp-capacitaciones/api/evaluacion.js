import { leerCuerpo } from '../lib/auth.js';
import { obtenerCapacitacion } from '../lib/capacitacion.js';
import { getSql } from '../lib/db.js';
import { calificar, obtenerEvaluacion, sinRespuestas } from '../lib/evaluacion.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limpiar = (v, max = 120) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// GET ?id=…   → preguntas del pre-test y del post-test (sin respuestas)
// POST        → { capacitacionId, tipo: 'pre'|'post', nombre, apellido, correo, respuestas: number[] }
export default async function handler(req, res) {
  try {
    const sql = await getSql();

    if (req.method === 'GET') {
      const id = limpiar(req.query?.id, 120);
      const ev = await obtenerEvaluacion(sql, id);
      if (!ev) return res.status(404).json({ error: 'La capacitación no existe' });
      return res.status(200).json({ pre: sinRespuestas(ev.evaluacion.pre), post: sinRespuestas(ev.evaluacion.post) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const body = leerCuerpo(req);
    if (body === null) return res.status(400).json({ error: 'Solicitud inválida' });
    const capacitacionId = limpiar(body.capacitacionId);
    const tipo = body.tipo === 'post' ? 'post' : body.tipo === 'pre' ? 'pre' : null;
    const nombre = limpiar(body.nombre);
    const apellido = limpiar(body.apellido);
    const correo = limpiar(body.correo, 200).toLowerCase();
    const respuestas = (Array.isArray(body.respuestas) ? body.respuestas : []).slice(0, 20).map((r) => (Number.isInteger(r) ? r : null));

    if (!tipo) return res.status(400).json({ error: 'Tipo de evaluación inválido' });
    const faltan = Object.entries({ nombre, apellido, correo }).filter(([, v]) => !v).map(([k]) => k);
    if (faltan.length) return res.status(400).json({ error: `Campos requeridos: ${faltan.join(', ')}` });
    if (!CORREO.test(correo)) return res.status(400).json({ error: 'El correo electrónico no es válido' });

    const ev = await obtenerEvaluacion(sql, capacitacionId);
    if (!ev) return res.status(404).json({ error: 'La capacitación no existe' });
    const preguntas = ev.evaluacion[tipo];
    if (!preguntas.length) return res.status(400).json({ error: 'Esta capacitación aún no tiene evaluación' });
    if (respuestas.filter((r) => r !== null).length < preguntas.length) {
      return res.status(400).json({ error: 'Responda todas las preguntas antes de enviar.' });
    }
    const [asistencia] = await sql`
      SELECT 1
      FROM asistencias
      WHERE capacitacion_id = ${capacitacionId}
        AND correo = ${correo}
        AND firma LIKE 'data:image/png;base64,%'
        AND length(firma) > 22`;
    if (!asistencia) {
      return res.status(400).json({ error: 'Primero debe registrar su asistencia a esta capacitación para presentar la evaluación.' });
    }

    if (tipo === 'post') {
      const [pre] = await sql`SELECT 1 FROM evaluaciones WHERE capacitacion_id = ${capacitacionId} AND correo = ${correo} AND tipo = 'pre'`;
      if (!pre) return res.status(400).json({ error: 'Primero debe presentar la evaluación previa (pre-test).' });
    }

    const cap = await obtenerCapacitacion(sql, capacitacionId);
    const r = calificar(preguntas, respuestas);
    const [fila] = await sql`
      INSERT INTO evaluaciones (capacitacion_id, capacitacion, tipo, nombre, apellido, correo, respuestas, correctas, total, puntaje, fecha)
      VALUES (${capacitacionId}, ${cap.titulo}, ${tipo}, ${nombre}, ${apellido}, ${correo}, ${JSON.stringify(respuestas)}::jsonb, ${r.correctas}, ${r.total}, ${r.puntaje}, ${cap.fecha})
      ON CONFLICT (capacitacion_id, correo, tipo) DO NOTHING
      RETURNING id`;
    if (!fila) return res.status(409).json({ error: `Este correo ya presentó el ${tipo === 'pre' ? 'pre-test' : 'post-test'} de esta capacitación.` });

    // Las respuestas correctas solo se muestran al terminar el post-test
    return res.status(201).json({
      tipo,
      fecha: cap.fecha,
      correctas: r.correctas,
      total: r.total,
      puntaje: r.puntaje,
      ...(tipo === 'post' && { detalle: r.detalle }),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo procesar la evaluación. Intente de nuevo.' });
  }
}
