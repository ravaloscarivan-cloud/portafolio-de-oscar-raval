import { getSql } from '../lib/db.js';

// Capacitaciones que el administrador ocultó o eliminó, para no mostrarlas a los usuarios (lectura pública).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const sql = await getSql();
    const ocultas = (await sql`SELECT id FROM capacitaciones_ocultas`).map((f) => f.id);
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    return res.status(200).json({ ocultas });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron cargar las capacitaciones' });
  }
}
