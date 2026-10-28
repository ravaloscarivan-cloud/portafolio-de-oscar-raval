// Conexión de la página del invitado con el admin:
// - { estado }    cada pocos segundos: sigue conectado + lo mínimo (sección e importación en curso).
//   Mientras el admin lo ve en tiempo real, el estado incluye además el detalle de su pantalla.
//   Responde las órdenes pendientes del admin ({ ordenes: [{ tipo: 'detener' | 'mensaje', texto }] }),
//   si el admin lo está viendo ({ observado: true }) o { fuera: 'sacado' | 'bloqueado' | 'borrado' } si lo sacó:
//   la página vuelve al inicio de sesión.
//   También trae la invitación del admin que espera respuesta ({ invitacion: { id, vence } }) y si está
//   colaborando ({ colaborando: true } = comparte la lista de links con el admin).
// - { invitacion: id, acepta } responde la invitación del admin.
// - { mensaje: texto }  el usuario le escribe al admin (le llega como notificación y en su chat; queda guardado).
// - { historialChat }   su conversación guardada con el admin.
// - { salida: true } cerró la página o la sesión.
// Las llamadas del admin se aceptan pero no se registran.
import { sesionDe } from './_acceso.js';
import { INVITACION_VIGENTE, guardarChat, historialChat, prepararTablas, registrar, sql } from './_db.js';

const MAX_ESTADO = 200 * 1024;
const FUERA = { bloqueado: 'bloqueado', borrado: 'borrado' };

export async function POST(request) {
  const sesion = await sesionDe(request);
  if (!sesion) return Response.json({ error: 'Sin sesión.' }, { status: 401 });
  if (sesion.rol !== 'invitado' || !sql) return Response.json({ ok: true });
  await prepararTablas();

  let cuerpo = {};
  try { cuerpo = JSON.parse(await request.text() || '{}'); } catch { /* cuerpo inválido */ }
  const { sid, nombre } = sesion;

  if (cuerpo.salida) {
    const [s] = await sql.query(
      `update prh_sesiones set activo = false, ultimo_latido = now() where sid = $1 and activo and acceso = 'aprobado' returning sid`,
      [sid],
    );
    if (s) await registrar(sid, 'salida', `${nombre} salió de la app`);
    return Response.json({ ok: true });
  }

  if (cuerpo.mensaje) {
    const texto = String(cuerpo.mensaje).trim().slice(0, 300);
    if (!texto) return Response.json({ error: 'Escribe el mensaje.' }, { status: 400 });
    const [s] = await sql.query(`select 1 from prh_sesiones where sid = $1 and acceso = 'aprobado'`, [sid]);
    if (!s) return Response.json({ fuera: 'sacado' });
    await registrar(sid, 'mensaje', `${nombre}: ${texto}`, { texto });
    await guardarChat(nombre, 'usuario', texto);
    return Response.json({ ok: true });
  }

  // Su conversación con el admin (guardada: sigue ahí al volver a entrar).
  if (cuerpo.historialChat) {
    return Response.json({ mensajes: await historialChat(nombre) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (cuerpo.invitacion) {
    const respuesta = cuerpo.acepta ? 'aceptada' : 'rechazada';
    const [inv] = await sql.query(
      `update prh_invitaciones set respuesta = $3, usos = usos + 1
       where id = $1 and usuario = $2 and respuesta is null and ${INVITACION_VIGENTE} returning id`,
      [String(cuerpo.invitacion), nombre, respuesta],
    );
    if (!inv) return Response.json({ error: 'La invitación ya no está disponible.' }, { status: 409 });
    if (cuerpo.acepta) {
      // Todas sus sesiones abiertas pasan a compartir la lista.
      await sql.query(`update prh_sesiones set invitacion = $1 where rol = 'invitado' and nombre = $2 and acceso = 'aprobado'`, [inv.id, nombre]);
    }
    await registrar(sid, 'invitacion', `${nombre} ${cuerpo.acepta ? 'aceptó' : 'rechazó'} tu invitación para colaborar`);
    return Response.json({ ok: true, colaborando: !!cuerpo.acepta });
  }

  const estado = cuerpo.estado && JSON.stringify(cuerpo.estado).length <= MAX_ESTADO ? JSON.stringify(cuerpo.estado) : null;
  // Entrega (y vacía) las órdenes del admin en el mismo paso.
  const [fila] = await sql.query(
    `with previo as (select ordenes from prh_sesiones where sid = $1 for update)
     update prh_sesiones s set ultimo_latido = now(), activo = (s.acceso = 'aprobado'),
       estado = coalesce($2::jsonb, s.estado), ordenes = '[]'::jsonb
     from previo where s.sid = $1
     returning s.acceso, previo.ordenes, coalesce(s.observar_hasta > now(), false) as observado`,
    [sid, estado],
  );
  const cabeceras = { 'Cache-Control': 'no-store' };
  if (fila?.acceso !== 'aprobado') {
    return Response.json({ fuera: FUERA[fila?.acceso] || 'sacado' }, { headers: cabeceras });
  }
  const [extra] = await sql.query(
    `select
       (select json_build_object('id', id, 'vence', vence) from prh_invitaciones
        where usuario = $2 and respuesta is null and ${INVITACION_VIGENTE} order by creado desc limit 1) as invitacion,
       exists (select 1 from prh_sesiones s join prh_invitaciones i on i.id = s.invitacion
               where s.sid = $1 and not i.revocada and i.vence > now()) as colaborando`,
    [sid, nombre],
  );
  return Response.json({
    ok: true, ordenes: fila.ordenes || [], observado: fila.observado,
    invitacion: extra?.invitacion || null, colaborando: !!extra?.colaborando,
  }, { headers: cabeceras });
}
