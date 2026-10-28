// Última importación empujada a la tienda (la usa el estudio de video, que comparte la base de datos):
// los videos automáticos solo se hacen con los productos recién empujados.
// POST /api/importacion { inicio, empujados } → la registra (una vez por importación).
import { sesionDe } from './_acceso.js';
import { prepararTablas, sql } from './_db.js';

export async function POST(request) {
  const sesion = await sesionDe(request);
  if (!sesion) return Response.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!sql) return Response.json({ ok: true });
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido */ }
  const inicio = new Date(cuerpo.inicio);
  const empujados = Math.max(0, Math.min(500, Number(cuerpo.empujados) || 0));
  if (Number.isNaN(inicio.getTime()) || !empujados) return Response.json({ error: 'Importación no válida.' }, { status: 400 });
  await prepararTablas();
  await sql.query(
    `insert into prh_importaciones (inicio, empujados, por) values ($1, $2, $3)
     on conflict (inicio) do update set empujados = excluded.empujados`,
    [inicio.toISOString(), empujados, sesion.rol === 'admin' ? 'Admin' : sesion.nombre],
  );
  return Response.json({ ok: true });
}
