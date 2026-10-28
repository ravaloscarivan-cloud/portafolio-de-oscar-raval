import { exigirAdmin } from '../../lib/auth.js';
import { fechaRegistro } from '../../lib/capacitacion.js';
import { capacitaciones as fijas } from '../../client/src/data/capacitaciones.js';
import { getSql } from '../../lib/db.js';
import { evaluacionesFijas } from '../../lib/evaluaciones.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Respuestas de los usuarios para el administrador.
// GET                      → personas que han participado, con su avance
// GET ?correo=…            → detalle de una persona: todas las capacitaciones visibles con su asistencia (y firma) y las respuestas de cada pre-test y post-test
// DELETE ?correo=…         → borra todos los registros de esa persona
export default async function handler(req, res) {
  if (!exigirAdmin(req, res)) return;
  const correo = String(req.query?.correo ?? '').trim().toLowerCase();
  if (correo && !CORREO.test(correo)) return res.status(400).json({ error: 'Correo inválido' });

  try {
    const sql = await getSql();

    if (req.method === 'GET' && !correo) {
      const filas = await sql`
        WITH registros AS (
          SELECT correo, nombre, apellido, registrado_en, capacitacion_id, 'asistencia' AS tipo FROM asistencias
          UNION ALL
          SELECT correo, nombre, apellido, registrado_en, capacitacion_id, tipo FROM evaluaciones
        )
        SELECT correo,
               (array_agg(nombre ORDER BY registrado_en DESC))[1]   AS nombre,
               (array_agg(apellido ORDER BY registrado_en DESC))[1] AS apellido,
               count(*) FILTER (WHERE tipo = 'asistencia')::int    AS asistencias,
               count(*) FILTER (WHERE tipo = 'pre')::int            AS pre,
               count(*) FILTER (WHERE tipo = 'post')::int           AS post,
               count(DISTINCT capacitacion_id)::int                 AS capacitaciones,
               max(registrado_en)                                   AS ultima
        FROM registros
        GROUP BY correo
        ORDER BY max(registrado_en) DESC`;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(filas);
    }

    if (req.method === 'GET') {
      const asistencias = await sql`SELECT capacitacion_id, capacitacion, nombre, apellido, firma, fecha, registrado_en FROM asistencias WHERE correo = ${correo}`;
      const evaluaciones = await sql`SELECT capacitacion_id, capacitacion, tipo, nombre, apellido, respuestas, correctas, total, puntaje, fecha, registrado_en FROM evaluaciones WHERE correo = ${correo}`;
      if (!asistencias.length && !evaluaciones.length) return res.status(404).json({ error: 'No hay registros de esa persona' });

      const reciente = [...asistencias, ...evaluaciones].sort((a, b) => new Date(b.registrado_en) - new Date(a.registrado_en))[0];
      // Todas las capacitaciones visibles (para mostrar las pendientes) + las que tengan registros aunque estén ocultas
      const ocultas = new Set((await sql`SELECT id FROM capacitaciones_ocultas`).map((f) => f.id));
      const ids = [...new Set([...fijas.filter((c) => !ocultas.has(c.id)).map((c) => c.id), ...[...asistencias, ...evaluaciones].map((r) => r.capacitacion_id)])];
      const orden = (id) => {
        const i = fijas.findIndex((c) => c.id === id);
        return i < 0 ? 999 : i;
      };

      const detalle = ids.sort((a, b) => orden(a) - orden(b)).map((id) => {
        const info = fijas.find((c) => c.id === id);
        const a = asistencias.find((x) => x.capacitacion_id === id);
        const test = (tipo) => {
          const e = evaluaciones.find((x) => x.capacitacion_id === id && x.tipo === tipo);
          if (!e) return null;
          const preguntas = evaluacionesFijas[id]?.[tipo] ?? [];
          return {
            fecha: fechaRegistro(id, e.fecha),
            correctas: e.correctas,
            total: e.total,
            puntaje: e.puntaje,
            preguntas: preguntas.map((p, i) => ({ pregunta: p.pregunta, opciones: p.opciones, correcta: p.correcta, elegida: e.respuestas?.[i] ?? null })),
          };
        };
        return {
          id,
          titulo: info?.titulo ?? a?.capacitacion ?? evaluaciones.find((x) => x.capacitacion_id === id)?.capacitacion ?? id,
          duracion: info?.duracion ?? '',
          facilitador: info?.facilitador ?? '',
          fechaProgramada: info?.fechaProgramada ?? null,
          fechaEjecucion: info?.fechaEjecucion ?? null,
          asistencia: a ? {
            nombre: a.nombre,
            apellido: a.apellido,
            correo: a.correo,
            fecha: fechaRegistro(id, a.fecha),
            firma: a.firma,
          } : null,
          pre: test('pre'),
          post: test('post'),
        };
      });

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ persona: { nombre: reciente.nombre, apellido: reciente.apellido, correo }, capacitaciones: detalle });
    }

    if (req.method === 'DELETE') {
      if (!correo) return res.status(400).json({ error: 'Falta el correo' });
      const a = await sql`DELETE FROM asistencias WHERE correo = ${correo} RETURNING id`;
      const e = await sql`DELETE FROM evaluaciones WHERE correo = ${correo} RETURNING id`;
      return res.status(200).json({ asistencias: a.length, evaluaciones: e.length });
    }

    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron consultar las respuestas. Intente de nuevo.' });
  }
}
