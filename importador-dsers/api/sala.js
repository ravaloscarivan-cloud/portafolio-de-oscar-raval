// Trabajo en equipo en tiempo real entre el admin y los usuarios que aceptaron su invitación: comparten el cuadro
// «Pega aquí los links» tal cual (lo que escribe uno aparece en la pantalla del otro).
// - GET  /api/sala?v=<version>  → { activa, version, equipo, texto, links: [{ url, por, ts }] } (sin texto ni links
//                                  si la versión no cambió). equipo = quiénes están trabajando juntos ahora.
// - POST /api/sala { texto, base } → guarda el texto. Si otro lo cambió desde <base>, se juntan las líneas de los
//                                  dos para no perder links. links = los del texto, con quién puso cada uno.
// Para el admin solo está activa mientras tenga alguna invitación abierta.
import { sesionDe } from './_acceso.js';
import { accesoSala, sql } from './_db.js';

const MAX_TEXTO = 100 * 1024;
const cabeceras = { 'Cache-Control': 'no-store' };
// Igual que en la app (src/App.jsx): links de AliExpress en cualquier parte del texto.
const PATRON_LINK = /(?:https?:\/\/)?[a-z0-9.-]*aliexpress\.[a-z.]{2,}\/[^\s"'<>,;]*/gi;

function extraerLinks(texto) {
  const vistos = new Set();
  for (const m of texto.match(PATRON_LINK) || []) {
    const link = /^https?:\/\//i.test(m) ? m : `https://${m}`;
    vistos.add(link.replace(/[).\]]+$/, ''));
  }
  return [...vistos];
}

// Usuarios conectados que comparten la lista (invitación aceptada y vigente). El admin siempre está en el equipo.
async function equipo() {
  const filas = await sql.query(
    `select distinct s.nombre from prh_sesiones s join prh_invitaciones i on i.id = s.invitacion
     where s.acceso = 'aprobado' and s.activo and s.ultimo_latido > now() - interval '10 minutes'
       and not i.revocada and i.vence > now()
     order by s.nombre`,
  );
  return ['Admin', ...filas.map((f) => f.nombre)];
}

const respuesta = async (activa, fila) => Response.json({
  activa, version: Number(fila.version), equipo: await equipo(), texto: fila.texto, links: fila.links,
}, { headers: cabeceras });

export async function GET(request) {
  const sesion = await sesionDe(request);
  const acceso = await accesoSala(sesion);
  if (!acceso) return Response.json({ activa: false }, { headers: cabeceras });
  const v = Number(new URL(request.url).searchParams.get('v'));
  const [sala] = await sql.query('select version, texto, links from prh_sala where id = 1');
  if (Number(sala.version) === v) {
    return Response.json({ activa: acceso.activa, version: v, equipo: await equipo() }, { headers: cabeceras });
  }
  return respuesta(acceso.activa, sala);
}

export async function POST(request) {
  const sesion = await sesionDe(request);
  const acceso = await accesoSala(sesion);
  if (!acceso?.activa) return Response.json({ error: 'El trabajo en equipo no está activo.' }, { status: 403 });
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido */ }
  if (typeof cuerpo.texto !== 'string') return Response.json({ error: 'Falta el texto.' }, { status: 400 });
  const por = sesion.rol === 'admin' ? 'Admin' : sesion.nombre;

  const [actual] = await sql.query('select version, texto, links from prh_sala where id = 1');
  let texto = cuerpo.texto.slice(0, MAX_TEXTO);
  // Alguien más escribió mientras tanto: se conservan las líneas con links suyos que este texto no tiene.
  if (Number(cuerpo.base) !== Number(actual.version)) {
    const mios = new Set(extraerLinks(texto));
    const suyas = actual.texto.split('\n').filter((l) => extraerLinks(l).some((u) => !mios.has(u)));
    if (suyas.length) texto = [texto.replace(/\s+$/, ''), ...suyas].filter(Boolean).join('\n').slice(0, MAX_TEXTO);
  }
  // Cada link conserva quién lo puso; los nuevos quedan a nombre de quien escribe.
  const previos = new Map((actual.links || []).map((l) => [l.url, l]));
  const ahora = new Date().toISOString();
  const links = extraerLinks(texto).slice(0, 500).map((url) => previos.get(url) || { url, por, ts: ahora });

  const [fila] = await sql.query(
    `update prh_sala set texto = $1, links = $2::jsonb, version = version + 1, actualizado = now() where id = 1
     returning version, texto, links`,
    [texto, JSON.stringify(links)],
  );
  return respuesta(true, fila);
}
