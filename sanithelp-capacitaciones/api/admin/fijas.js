import { exigirAdmin, leerCuerpo } from '../../lib/auth.js';
import { capacitaciones as fijas } from '../../client/src/data/capacitaciones.js';
import { getSql } from '../../lib/db.js';

const ESTADOS = ['visible', 'oculta', 'eliminada'];

// Estado de cada capacitación para el administrador: visible, oculta o eliminada.
// GET                         → [{ id, titulo, estado }]
// POST { id, estado }         → cambia el estado ("visible" la vuelve a mostrar)
export default async function handler(req, res) {
  if (!exigirAdmin(req, res)) return;
  try {
    const sql = await getSql();
    const listar = async () => {
      const filas = new Map((await sql`SELECT id, estado FROM capacitaciones_ocultas`).map((f) => [f.id, f.estado]));
      return fijas.map((c) => ({ id: c.id, titulo: c.titulo, fechaEjecucion: c.fechaEjecucion ?? null, estado: filas.get(c.id) ?? 'visible' }));
    };

    if (req.method === 'GET') return res.status(200).json(await listar());

    if (req.method === 'POST') {
      const body = leerCuerpo(req);
      const id = String(body?.id ?? '');
      const estado = String(body?.estado ?? '');
      if (!fijas.some((c) => c.id === id)) return res.status(404).json({ error: 'Capacitación no encontrada' });
      if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
      if (estado === 'visible') await sql`DELETE FROM capacitaciones_ocultas WHERE id = ${id}`;
      else await sql`INSERT INTO capacitaciones_ocultas (id, estado) VALUES (${id}, ${estado}) ON CONFLICT (id) DO UPDATE SET estado = ${estado}, ocultada_en = now()`;
      return res.status(200).json(await listar());
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo actualizar la capacitación. Intente de nuevo.' });
  }
}
