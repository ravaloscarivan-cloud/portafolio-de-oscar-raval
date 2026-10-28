// Acceso como invitado con cuenta propia (@usuario + PIN) y permiso del admin:
// 1. POST { accion: 'existe', usuario }  → { existe }: la página sabe si debe pedir el PIN o crearlo.
// 2. POST { usuario, pin, crear }        → la primera vez registra la cuenta con ese PIN; luego exige el mismo PIN.
//    Con el PIN correcto crea una solicitud pendiente y al admin le llega «@usuario pide permiso para entrar».
//    Responde { pendiente, espera } (pase de espera firmado).
// 3. POST { espera }                     → la página de acceso consulta cada 2 s: sigue pendiente, rechazado, o
//    aprobado (entonces se entregan las cookies que abren la app, una sola vez).
// 4. POST { espera, cancelar }           → el invitado retira la solicitud.
// Con { inv } (link de invitación del admin) entra directo, sin esperar permiso, y usa la lista compartida.
// POST { accion: 'invitacion', inv }     → { valida, usuario }: la invitación es solo para ese @usuario.
import { cabecerasAcceso, crearLimitador, crearToken, ipDe, mensajeFallo, tokenValido } from './_acceso.js';
import { INVITACION_ABIERTA, INVITACION_VIGENTE, prepararTablas, registrar, sql } from './_db.js';

const limitador = crearLimitador();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const ESPERA_MS = 15 * 60 * 1000;
const PATRON_USUARIO = /^@[a-z0-9._]{2,30}$/;
const PATRON_PIN = /^\d{4,6}$/;

const MOTIVOS = {
  rechazado: 'El administrador rechazó tu solicitud.',
  cancelado: 'Cancelaste la solicitud.',
  expulsado: 'El administrador cerró tu sesión.',
  bloqueado: 'El administrador bloqueó tu acceso.',
  borrado: 'El administrador borró tu usuario. Puedes registrarte de nuevo.',
};

const enc = new TextEncoder();
const aHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin, sal) {
  const clave = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: 100000 }, clave, 256);
  return aHex(bits);
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

const normalizar = (usuario) => String(usuario || '').trim().toLowerCase();

export async function POST(request) {
  if (!sql) return Response.json({ error: 'El acceso de invitado no está habilitado.' }, { status: 503 });
  await prepararTablas();
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido */ }
  if (cuerpo.espera) return consultarEspera(cuerpo);

  // Invitación del admin (link ?inv=…): quien entra con ella no necesita esperar permiso.
  const inv = /^[0-9a-f]{32}$/.test(String(cuerpo.inv || '')) ? cuerpo.inv : null;
  const [invitacion] = inv
    ? await sql.query(`select id, usuario from prh_invitaciones where id = $1 and ${INVITACION_VIGENTE}`, [inv])
    : [];
  if (cuerpo.accion === 'invitacion') {
    return Response.json({ valida: !!invitacion, usuario: invitacion?.usuario || '' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (inv && !invitacion) return Response.json({ error: 'La invitación venció o fue anulada. Pide una nueva al administrador.' }, { status: 410 });

  const usuario = normalizar(cuerpo.usuario);
  if (!PATRON_USUARIO.test(usuario)) {
    return Response.json({ error: 'El usuario debe empezar por @ y tener de 2 a 30 letras, números, punto o guion bajo.' }, { status: 400 });
  }
  if (invitacion?.usuario && usuario !== invitacion.usuario) {
    return Response.json({ error: `Esta invitación es solo para ${invitacion.usuario}.` }, { status: 403 });
  }
  const [cuenta] = await sql.query('select pin_hash, sal from prh_usuarios where usuario = $1', [usuario]);
  if (cuerpo.accion === 'existe') return Response.json({ existe: !!cuenta }, { headers: { 'Cache-Control': 'no-store' } });

  const ip = ipDe(request);
  const minutos = limitador.bloqueo(ip);
  if (minutos) return Response.json({ error: `Demasiados intentos. Espera ${minutos} min.` }, { status: 429 });

  const [bloqueo] = await sql.query('select 1 from prh_bloqueos where ip = $1 or nombre = $2', [ip, usuario]);
  if (bloqueo) return Response.json({ error: MOTIVOS.bloqueado }, { status: 403 });

  const pin = String(cuerpo.pin || '').trim();
  if (!PATRON_PIN.test(pin)) return Response.json({ error: 'El PIN debe tener de 4 a 6 números.' }, { status: 400 });

  if (cuenta && cuerpo.crear) {
    return Response.json({ error: `El usuario ${usuario} ya existe. Elige otro o entra con tu PIN.`, existe: true }, { status: 409 });
  }
  if (cuenta) {
    if (!iguales(await hashPin(pin, cuenta.sal), cuenta.pin_hash)) {
      await dormir(800);
      const quedan = limitador.fallo(ip);
      return Response.json({ error: mensajeFallo(quedan, 'PIN incorrecto.') }, { status: quedan ? 401 : 429 });
    }
  } else {
    if (!cuerpo.crear) return Response.json({ error: 'Ese usuario no existe. Créalo en «Crear usuario».', nuevo: true }, { status: 404 });
    const sal = crypto.randomUUID();
    const [creada] = await sql.query(
      'insert into prh_usuarios (usuario, pin_hash, sal) values ($1, $2, $3) on conflict (usuario) do nothing returning usuario',
      [usuario, await hashPin(pin, sal), sal],
    );
    if (!creada) return Response.json({ error: `El usuario ${usuario} ya existe. Elige otro.` }, { status: 409 });
  }
  limitador.exito(ip);
  await sql.query('update prh_usuarios set ultimo = now() where usuario = $1', [usuario]);

  const sid = crypto.randomUUID();
  const agente = (request.headers.get('user-agent') || '').slice(0, 300);
  // Invitación del admin para este @usuario (enviada desde Invitar): entra sin esperar permiso.
  // Si ya la aceptó, comparte la lista de inmediato; si no, la verá en pantalla para aceptarla.
  const [propia] = invitacion ? [] : await sql.query(
    `select id, respuesta from prh_invitaciones where usuario = $1 and ${INVITACION_ABIERTA} order by creado desc limit 1`,
    [usuario],
  );
  if (invitacion || propia) {
    const compartida = invitacion ? invitacion.id : propia.respuesta === 'aceptada' ? propia.id : null;
    await sql.query(
      `insert into prh_sesiones (sid, rol, nombre, agente, ip, acceso, activo, entro, invitacion)
       values ($1, 'invitado', $2, $3, $4, 'aprobado', true, now(), $5)`,
      [sid, usuario, agente, ip, compartida],
    );
    if (invitacion) await sql.query('update prh_invitaciones set usos = usos + 1 where id = $1', [invitacion.id]);
    await registrar(sid, 'entrada', `${usuario} entró (tiene tu invitación)`);
    return Response.json({ ok: true }, { headers: await cabecerasAcceso({ rol: 'invitado', nombre: usuario, sid }) });
  }
  await sql.query(
    `insert into prh_sesiones (sid, rol, nombre, agente, ip, acceso, activo) values ($1, 'invitado', $2, $3, $4, 'pendiente', false)`,
    [sid, usuario, agente, ip],
  );
  await registrar(sid, 'solicitud', `${usuario} pide permiso para entrar${cuenta ? '' : ' (cuenta nueva)'}`);
  const espera = await crearToken(ESPERA_MS, { rol: 'espera', nombre: usuario, sid });
  return Response.json({ pendiente: true, espera, nuevo: !cuenta }, { headers: { 'Cache-Control': 'no-store' } });
}

async function consultarEspera({ espera, cancelar }) {
  const pase = await tokenValido(espera, ['espera']);
  if (!pase) {
    return Response.json({ error: 'La solicitud venció. Vuelve a pedir acceso.' }, { status: 401 });
  }
  const { sid, nombre } = pase;

  if (cancelar) {
    const [s] = await sql.query(`update prh_sesiones set acceso = 'cancelado' where sid = $1 and acceso = 'pendiente' returning sid`, [sid]);
    if (s) await registrar(sid, 'cancelada', `${nombre} canceló su solicitud`);
    return Response.json({ ok: true });
  }

  const [s] = await sql.query('select acceso from prh_sesiones where sid = $1', [sid]);
  if (!s) return Response.json({ error: 'La solicitud no existe. Vuelve a pedir acceso.' }, { status: 404 });

  if (s.acceso === 'pendiente') {
    // El admin solo ve las solicitudes de quien sigue esperando con la página abierta.
    await sql.query('update prh_sesiones set ultimo_latido = now() where sid = $1', [sid]);
    return Response.json({ pendiente: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (s.acceso === 'aprobado') {
    // El permiso abre la app una sola vez.
    const [primera] = await sql.query(
      `update prh_sesiones set entro = now(), activo = true, ultimo_latido = now() where sid = $1 and entro is null returning sid`,
      [sid],
    );
    if (!primera) return Response.json({ error: 'Este permiso ya se usó. Vuelve a pedir acceso.' }, { status: 410 });
    await registrar(sid, 'entrada', `${nombre} entró a la app`);
    return Response.json({ ok: true }, { headers: await cabecerasAcceso({ rol: 'invitado', nombre, sid }) });
  }

  return Response.json({ error: MOTIVOS[s.acceso] || 'No tienes acceso.' }, { status: 403 });
}
