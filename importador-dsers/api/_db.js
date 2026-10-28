// Base de datos compartida con el estudio de video (Postgres en Neon, DATABASE_URL).
// Aquí se guardan las sesiones del panel y la actividad del invitado (tablas prh_sesiones y prh_actividad).
// Acceso del invitado (prh_sesiones.acceso):
//   pendiente → pidió entrar y espera al admin · aprobado → está dentro (o puede entrar)
//   rechazado · cancelado · expulsado (el admin lo sacó) · bloqueado (además su IP queda en prh_bloqueos)
//   borrado (el admin borró su usuario)
import { neon } from '@neondatabase/serverless';
import { sesionDe } from './_acceso.js';

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Columnas y tabla del sistema de permisos (se crean solas la primera vez).
const MIGRACIONES = [
  "alter table prh_sesiones add column if not exists acceso text not null default 'aprobado'",
  "alter table prh_sesiones add column if not exists ordenes jsonb not null default '[]'::jsonb",
  'alter table prh_sesiones add column if not exists ip text',
  'alter table prh_sesiones add column if not exists entro timestamptz',
  // Hasta cuándo el admin está viendo en tiempo real a ese invitado (mientras tanto envía el detalle).
  'alter table prh_sesiones add column if not exists observar_hasta timestamptz',
  'create table if not exists prh_bloqueos (ip text primary key, nombre text, creado timestamptz not null default now())',
  // Notificaciones borradas por el admin. Al crear la columna, los avisos que ya existían (pruebas) quedan ocultos.
  'alter table prh_actividad add column if not exists oculto boolean not null default true',
  'alter table prh_actividad alter column oculto set default false',
  // Invitaciones del admin (link para colaborar sin pedir permiso) y la lista de links compartida en tiempo real.
  `create table if not exists prh_invitaciones (id text primary key, nota text, creado timestamptz not null default now(),
     vence timestamptz not null, revocada boolean not null default false, usos int not null default 0)`,
  'alter table prh_sesiones add column if not exists invitacion text',
  // @usuario para quien es la invitación (solo esa cuenta puede usarla).
  'alter table prh_invitaciones add column if not exists usuario text',
  // Respuesta del usuario a la invitación: null (sin responder) · 'aceptada' · 'rechazada'.
  'alter table prh_invitaciones add column if not exists respuesta text',
  `create table if not exists prh_sala (id int primary key, links jsonb not null default '[]'::jsonb,
     version bigint not null default 0, actualizado timestamptz not null default now())`,
  `insert into prh_sala (id) values (1) on conflict (id) do nothing`,
  // Texto del cuadro «Pega aquí los links», compartido tal cual entre el equipo.
  "alter table prh_sala add column if not exists texto text not null default ''",
  // Importaciones empujadas a la tienda: el estudio de video hace los videos solo con esos productos.
  `create table if not exists prh_importaciones (inicio timestamptz primary key, empujados int not null,
     por text, creado timestamptz not null default now())`,
  // Cuentas de invitado: @usuario + PIN (guardado con PBKDF2, nunca en claro).
  `create table if not exists prh_usuarios (usuario text primary key, pin_hash text not null, sal text not null,
     creado timestamptz not null default now(), ultimo timestamptz)`,
  // Chats admin ↔ usuario, por @usuario. Nunca se borran (ni al sacar, bloquear o eliminar el usuario).
  `create table if not exists prh_chat (id bigserial primary key, usuario text not null, de text not null,
     texto text not null, ts timestamptz not null default now())`,
  'create index if not exists prh_chat_usuario on prh_chat (usuario, id)',
];
let preparadas = null;
export function prepararTablas() {
  preparadas ||= (async () => {
    for (const q of MIGRACIONES) await sql.query(q);
  })().catch((err) => { preparadas = null; throw err; });
  return preparadas;
}

// Guarda un mensaje del chat (de: 'admin' | 'usuario').
export function guardarChat(usuario, de, texto) {
  return sql.query('insert into prh_chat (usuario, de, texto) values ($1, $2, $3)', [usuario, de, texto]);
}

// Conversación con un @usuario (los últimos 300 mensajes, del más viejo al más nuevo).
export function historialChat(usuario) {
  return sql.query(
    `select de, texto, ts from (select id, de, texto, ts from prh_chat where usuario = $1 order by id desc limit 300) c order by id`,
    [usuario],
  );
}

// Registra una acción de una sesión (aparece en las notificaciones del admin).
export function registrar(sid, tipo, texto, detalle = null) {
  return sql.query(
    'insert into prh_actividad (sid, tipo, texto, detalle) values ($1, $2, $3, $4::jsonb)',
    [sid, tipo, String(texto).slice(0, 500), detalle ? JSON.stringify(detalle) : null],
  );
}

// Invitaciones vigentes (no revocadas ni vencidas).
export const INVITACION_VIGENTE = 'not revocada and vence > now()';
// Vigentes y no rechazadas: mantienen activa la lista compartida del admin.
export const INVITACION_ABIERTA = `${INVITACION_VIGENTE} and respuesta is distinct from 'rechazada'`;

// ¿Puede usar la lista compartida? El admin cuando tiene alguna invitación abierta; el usuario mientras tenga una
// invitación aceptada y vigente.
// Devuelve { activa } o null si no tiene acceso.
export async function accesoSala(sesion) {
  if (!sesion || !sql) return null;
  await prepararTablas();
  if (sesion.rol === 'admin') {
    const [i] = await sql.query(`select 1 from prh_invitaciones where ${INVITACION_ABIERTA} limit 1`);
    return { activa: !!i };
  }
  const [s] = await sql.query(
    `select 1 from prh_sesiones s join prh_invitaciones i on i.id = s.invitacion
     where s.sid = $1 and s.acceso = 'aprobado' and not i.revocada and i.vence > now()`,
    [sesion.sid],
  );
  return s ? { activa: true } : null;
}

// Para las funciones /api que usa el invitado: si el admin lo sacó o bloqueó, devuelve la respuesta de rechazo.
export async function sinPermiso(request) {
  const sesion = await sesionDe(request);
  if (!sesion) return Response.json({ error: 'Sin sesión.' }, { status: 401 });
  if (sesion.rol !== 'invitado' || !sql) return null;
  await prepararTablas();
  const [s] = await sql.query('select acceso from prh_sesiones where sid = $1', [sesion.sid]);
  if (s?.acceso === 'aprobado') return null;
  return Response.json({ error: 'El administrador cerró tu sesión.' }, { status: 403 });
}
