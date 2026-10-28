// Quién está usando esta página: { rol: 'admin' | 'invitado', nombre, sid, invitado }.
// invitado = entró con un link de invitación del admin (usa la lista compartida).
import { sesionDe } from './_acceso.js';
import { prepararTablas, sql } from './_db.js';

export async function GET(request) {
  const sesion = await sesionDe(request);
  if (!sesion) return Response.json({ error: 'Sin sesión.' }, { status: 401 });
  let invitado = false;
  if (sesion.rol === 'invitado' && sql) {
    await prepararTablas();
    const [s] = await sql.query('select invitacion from prh_sesiones where sid = $1', [sesion.sid]);
    invitado = !!s?.invitacion;
  }
  return Response.json({ rol: sesion.rol, nombre: sesion.nombre, sid: sesion.sid, invitado }, { headers: { 'Cache-Control': 'no-store' } });
}
