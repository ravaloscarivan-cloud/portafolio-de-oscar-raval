// Panel del admin para los invitados (solo rol admin):
// - GET  /api/monitor → solicitudes de acceso pendientes, invitados (en línea o no, con lo que están haciendo:
//                       importando / puliendo), IP bloqueadas y los últimos 50 avisos sin borrar.
// - POST /api/monitor { accion, sid, texto, ip } → acciones del admin:
//     aceptar · rechazar          una solicitud pendiente
//     detener                     detiene lo que esté haciendo (importación y pulido)
//     pausar · reanudar           pone en pausa / continúa la importación y el pulido
//     restablecerPin { usuario }  borra solo su PIN: la próxima vez crea uno nuevo
//     mensaje { usuario | sid, texto } chat: se guarda siempre (prh_chat) y le aparece si está dentro
// - GET  /api/monitor?chat=@usuario → conversación guardada · ?conversaciones → lista de conversaciones
//     sacar                       cierra su sesión y lo manda al inicio de sesión
//     bloquear                    lo saca y bloquea su IP (no podrá volver a pedir acceso)
//     desbloquear { ip | usuario } quita un bloqueo
//     sacarTodos                  saca a todos los invitados conectados
//     borrarAvisos { ids | todos } oculta notificaciones (en todos los dispositivos del admin)
//     crearInvitacion { usuario, horas } → { id }: le llega a ese @usuario en su pantalla para aceptarla; al
//                                 aceptar comparte contigo la lista de links durante ese tiempo. Si no está
//                                 en la app, la ve al entrar (y entra sin esperar permiso).
//     revocarInvitacion { id }    anula la invitación: termina la colaboración (sigue en la app)
//     borrarUsuario { usuario }   borra la cuenta @usuario (y su PIN), lo saca si está dentro y lo quita de la lista
//     quitarDeLista { usuario }   quita de la lista a quien ya no está conectado; su cuenta y su PIN siguen igual
//                                 (vuelve a aparecer la próxima vez que entre)
// - GET  /api/monitor?sid=<sid> → lo que ese invitado tiene en pantalla, en tiempo real. Mientras el admin
//                                  consulta, la página del invitado envía el detalle (si no, solo el resumen).
// En línea = está dentro de la app (punto verde) hasta que sale: cierra la página o la sesión, o lo sacas.
// Si la pestaña queda en segundo plano el navegador espacia los latidos, por eso solo se da por desconectado
// sin aviso de salida tras 10 minutos sin latido (p. ej. se le apagó el equipo o perdió la conexión).
import { sesionDe } from './_acceso.js';
import { INVITACION_ABIERTA, INVITACION_VIGENTE, guardarChat, historialChat, prepararTablas, registrar, sql } from './_db.js';

const SID = /^[0-9a-f-]{36}$/i;
const EN_LINEA = `(activo and ultimo_latido > now() - interval '10 minutes')`;
const TIPOS_AVISO = `('solicitud', 'entrada', 'salida', 'rechazado', 'cancelada', 'sacado', 'bloqueado', 'invitacion', 'mensaje', 'compra')`;
const cabeceras = { 'Cache-Control': 'no-store' };

async function soloAdmin(request) {
  const sesion = await sesionDe(request);
  if (!sesion || sesion.rol !== 'admin') return Response.json({ error: 'Solo el administrador.' }, { status: 403 });
  if (!sql) return Response.json({ error: 'Falta la base de datos (DATABASE_URL).' }, { status: 503 });
  await prepararTablas();
  return null;
}

export async function GET(request) {
  const rechazo = await soloAdmin(request);
  if (rechazo) return rechazo;

  const params = new URL(request.url).searchParams;
  // Chats guardados: la conversación con un @usuario, o la lista de todas las conversaciones.
  if (params.has('chat')) {
    return Response.json({ mensajes: await historialChat(String(params.get('chat')).toLowerCase()) }, { headers: cabeceras });
  }
  if (params.has('conversaciones')) {
    const conversaciones = await sql.query('select usuario, max(ts) as ultimo from prh_chat group by usuario order by ultimo desc limit 100');
    return Response.json({ conversaciones }, { headers: cabeceras });
  }
  const sid = params.get('sid');
  if (sid) {
    if (!SID.test(sid)) return Response.json({ error: 'Invitado no válido.' }, { status: 400 });
    // Marca que el admin lo está viendo (15 s, se renueva con cada consulta) y devuelve lo último que envió.
    const [s] = await sql.query(
      `update prh_sesiones set observar_hasta = now() + interval '15 seconds' where sid = $1 and rol = 'invitado'
       returning sid, nombre, inicio, entro, ultimo_latido, ${EN_LINEA} as en_linea, acceso, agente, estado`,
      [sid],
    );
    if (!s) return Response.json({ error: 'El invitado no existe.' }, { status: 404 });
    return Response.json({ sesion: s }, { headers: cabeceras });
  }

  // Solo las solicitudes de quien sigue esperando con la página de acceso abierta.
  const solicitudes = await sql.query(`
    select sid, nombre, inicio, agente, ip from prh_sesiones
    where rol = 'invitado' and acceso = 'pendiente' and ultimo_latido > now() - interval '20 seconds'
    order by inicio`);
  const personas = await sql.query(`
    select sid, nombre, inicio, entro, ultimo_latido, ${EN_LINEA} as en_linea, acceso, agente, ip, invitacion,
      estado->>'seccion' as seccion, case when ${EN_LINEA} then estado->'trabajo' end as trabajo
    from prh_sesiones
    where rol = 'invitado' and nombre like '@%' and acceso in ('aprobado', 'expulsado', 'bloqueado')
      and inicio > now() - interval '7 days'
    order by ultimo_latido desc limit 40`);
  const bloqueos = await sql.query('select ip, nombre, creado from prh_bloqueos order by creado desc');
  const invitaciones = await sql.query(`select id, usuario, nota, creado, vence, usos, respuesta from prh_invitaciones where ${INVITACION_ABIERTA} order by creado desc`);

  // Siempre la lista completa (así lo borrado en un dispositivo desaparece en los demás).
  const eventos = await sql.query(`select a.id, a.sid, a.ts, a.tipo, a.texto, s.nombre, case when a.tipo = 'mensaje' then a.detalle->>'texto' end as mensaje
    from prh_actividad a join prh_sesiones s using (sid)
    where s.rol in ('invitado', 'tienda') and not a.oculto and a.tipo in ${TIPOS_AVISO} order by a.id desc limit 50`);
  return Response.json({ solicitudes, personas, bloqueos, invitaciones, eventos }, { headers: cabeceras });
}

const respuesta = (ok, error) => (ok ? Response.json({ ok: true }) : Response.json({ error }, { status: 409 }));

export async function POST(request) {
  const rechazo = await soloAdmin(request);
  if (rechazo) return rechazo;
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido */ }
  const { accion, sid } = cuerpo;

  if (accion === 'desbloquear') {
    // Por IP (lista de bloqueados) o por usuario (menú de tres puntos).
    await sql.query('delete from prh_bloqueos where ip = $1 or nombre = $2', [String(cuerpo.ip || ''), String(cuerpo.usuario || '')]);
    if (cuerpo.usuario) {
      await sql.query(`update prh_sesiones set acceso = 'expulsado' where nombre = $1 and acceso = 'bloqueado'`, [String(cuerpo.usuario)]);
    }
    return respuesta(true);
  }
  if (accion === 'restablecerPin') {
    // Borra solo el PIN: la próxima vez que entre crea uno nuevo con el mismo @usuario.
    const [u] = await sql.query('delete from prh_usuarios where usuario = $1 returning usuario', [String(cuerpo.usuario || '').toLowerCase()]);
    return respuesta(u, 'Ese usuario no tiene PIN registrado.');
  }
  if (accion === 'borrarAvisos') {
    if (cuerpo.todos) await sql.query('update prh_actividad set oculto = true where not oculto');
    else {
      const ids = (Array.isArray(cuerpo.ids) ? cuerpo.ids : []).map(Number).filter(Number.isInteger).slice(0, 500);
      if (ids.length) await sql.query('update prh_actividad set oculto = true where id = any($1::bigint[])', [ids]);
    }
    return respuesta(true);
  }
  if (accion === 'crearInvitacion') {
    const horas = [1, 24, 168].includes(Number(cuerpo.horas)) ? Number(cuerpo.horas) : 24;
    const usuario = String(cuerpo.usuario || '').trim().toLowerCase();
    if (!/^@[a-z0-9._]{2,30}$/.test(usuario)) {
      return Response.json({ error: 'Escribe el usuario: empieza por @ (ej. @laura).' }, { status: 400 });
    }
    // Una sola invitación abierta por usuario: la nueva reemplaza a la anterior.
    await sql.query(`update prh_invitaciones set revocada = true where usuario = $1 and ${INVITACION_VIGENTE}`, [usuario]);
    const id = crypto.randomUUID().replace(/-/g, '');
    await sql.query(
      'insert into prh_invitaciones (id, usuario, nota, vence) values ($1, $2, $2, now() + make_interval(hours => $3))',
      [id, usuario, horas],
    );
    return Response.json({ ok: true, id });
  }
  if (accion === 'revocarInvitacion') {
    const id = String(cuerpo.id || '');
    // Termina la colaboración; la persona sigue en la app con su lista propia.
    await sql.query('update prh_invitaciones set revocada = true where id = $1', [id]);
    return respuesta(true);
  }
  if (accion === 'borrarUsuario') {
    const usuario = String(cuerpo.usuario || '').toLowerCase();
    await sql.query('delete from prh_usuarios where usuario = $1', [usuario]);
    // Si está dentro, lo saca; y sus sesiones dejan de aparecer en la lista.
    const sesiones = await sql.query(
      `update prh_sesiones set acceso = 'borrado', activo = false where rol = 'invitado' and nombre = $1 returning sid`,
      [usuario],
    );
    if (sesiones[0]) await registrar(sesiones[0].sid, 'sacado', `Se borró el usuario ${usuario}`);
    return respuesta(true);
  }
  if (accion === 'quitarDeLista') {
    await sql.query(
      `update prh_sesiones set acceso = 'quitado', activo = false
       where rol = 'invitado' and nombre = $1 and not (acceso = 'aprobado' and ${EN_LINEA})`,
      [String(cuerpo.usuario || '').toLowerCase()],
    );
    return respuesta(true);
  }
  if (accion === 'mensaje') {
    // Se guarda siempre (aunque no esté conectado: lo verá al entrar); si está dentro, le aparece al momento.
    const texto = String(cuerpo.texto || '').trim().slice(0, 300);
    if (!texto) return Response.json({ error: 'Escribe el mensaje.' }, { status: 400 });
    let usuario = String(cuerpo.usuario || '').toLowerCase();
    if (!usuario && SID.test(String(sid || ''))) {
      [{ nombre: usuario } = {}] = await sql.query('select nombre from prh_sesiones where sid = $1', [sid]);
    }
    if (!/^@[a-z0-9._]{2,30}$/.test(usuario || '')) return Response.json({ error: 'Usuario no válido.' }, { status: 400 });
    await guardarChat(usuario, 'admin', texto);
    const entregados = await sql.query(
      `update prh_sesiones set ordenes = ordenes || $2::jsonb where rol = 'invitado' and nombre = $1 and acceso = 'aprobado' returning sid`,
      [usuario, JSON.stringify([{ tipo: 'mensaje', texto }])],
    );
    return Response.json({ ok: true, entregado: entregados.length > 0 });
  }
  if (accion === 'sacarTodos') {
    const sacados = await sql.query(
      `update prh_sesiones set acceso = 'expulsado', activo = false where rol = 'invitado' and acceso = 'aprobado' returning sid, nombre`,
    );
    for (const s of sacados) await registrar(s.sid, 'sacado', `${s.nombre} fue sacado de la app`);
    return Response.json({ ok: true, sacados: sacados.length });
  }

  if (!SID.test(String(sid || ''))) return Response.json({ error: 'Invitado no válido.' }, { status: 400 });

  // Las acciones sobre un invitado alcanzan todas sus sesiones (mismo @usuario en varias pestañas o equipos).
  const MISMO_USUARIO = `rol = 'invitado' and nombre = (select nombre from prh_sesiones where sid = $1)`;

  switch (accion) {
    case 'aceptar': {
      const [s] = await sql.query(`update prh_sesiones set acceso = 'aprobado' where sid = $1 and acceso = 'pendiente' returning nombre`, [sid]);
      return respuesta(s, 'La solicitud ya no está pendiente.');
    }
    case 'rechazar': {
      const [s] = await sql.query(`update prh_sesiones set acceso = 'rechazado' where sid = $1 and acceso = 'pendiente' returning nombre`, [sid]);
      if (s) await registrar(sid, 'rechazado', `Rechazaste la solicitud de ${s.nombre}`);
      return respuesta(s, 'La solicitud ya no está pendiente.');
    }
    case 'detener':
    case 'pausar':
    case 'reanudar': {
      const orden = { tipo: accion };
      const [s] = await sql.query(
        `update prh_sesiones set ordenes = ordenes || $2::jsonb where ${MISMO_USUARIO} and acceso = 'aprobado' returning nombre`,
        [sid, JSON.stringify([orden])],
      );
      return respuesta(s, 'El invitado ya no está en la app.');
    }
    case 'sacar': {
      const [s] = await sql.query(
        `update prh_sesiones set acceso = 'expulsado', activo = false where ${MISMO_USUARIO} and acceso = 'aprobado' returning nombre`,
        [sid],
      );
      if (s) await registrar(sid, 'sacado', `${s.nombre} fue sacado de la app`);
      return respuesta(s, 'El invitado ya no está en la app.');
    }
    case 'bloquear': {
      const filas = await sql.query(
        `update prh_sesiones set acceso = 'bloqueado', activo = false where ${MISMO_USUARIO} returning nombre, ip`,
        [sid],
      );
      const [s] = filas;
      if (!s) return respuesta(false, 'El invitado no existe.');
      for (const ip of new Set(filas.map((x) => x.ip).filter(Boolean))) {
        await sql.query(
          'insert into prh_bloqueos (ip, nombre) values ($1, $2) on conflict (ip) do update set nombre = excluded.nombre, creado = now()',
          [ip, s.nombre],
        );
      }
      await registrar(sid, 'bloqueado', `${s.nombre} fue bloqueado`);
      return respuesta(true);
    }
    default:
      return Response.json({ error: 'Acción no válida.' }, { status: 400 });
  }
}
