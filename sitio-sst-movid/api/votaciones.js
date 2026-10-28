import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { check, db, storageConfigured } from '../lib/db.js';

// Votaciones COPASST y Convivencia en Supabase (ver db/schema.sql):
//   vot_config  configuración única (fila id = 1)
//   vot_padron  trabajadores habilitados (id = hash(salt:cédula), PIN = cédula)
//   vot_votos   marca de "ya votó" con clave (pid, comite): la base de datos impide votar dos veces
//   vot_urna    papeleta sin datos del votante: p y s = ids separados por "." o "blanco"; s = "-" sin suplentes
const COMITES = ['copasst', 'convivencia'];
const ESTADOS = ['inscripcion', 'votacion', 'cerrada'];

function sendJson(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(value);
}

function isAdmin(request) {
  const expected = process.env.RESPONSES_PASSWORD;
  const authorization = request.headers.authorization || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

const rid = () => randomBytes(9).toString('hex');
const clean = (value, max) =>
  typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
const cleanDoc = (value) => String(value || '').replace(/\D/g, '');
const personId = (salt, doc) => 'p' + createHash('sha256').update(`${salt}:${doc}`).digest('hex').slice(0, 24);

async function readConfig() {
  const row = check(await db().from('vot_config').select('data').eq('id', 1).maybeSingle());
  return row ? row.data : null;
}

async function saveConfig(cfg) {
  check(await db().from('vot_config').upsert({ id: 1, data: cfg, updated_at: new Date().toISOString() }));
}

const readPadron = async () => check(await db().from('vot_padron').select('id, nombre, cargo, pin'));

function defaultConfig() {
  const comite = () => ({ principales: 1, suplentes: 1, estado: 'inscripcion', fecha: '', candidatos: [] });
  return { salt: rid(), lugar: '', jurados: '', comites: { copasst: comite(), convivencia: comite() } };
}

// El salt nunca sale del servidor: con él se podrían adivinar los documentos del padrón
function publicConfig(cfg) {
  if (!cfg) return cfg;
  const { salt, ...rest } = cfg;
  return rest;
}

// Sin clave de administrador el padrón solo expone quién votó (sin nombres ni PIN)
async function readState(admin) {
  const [cfg, padron, votos, urna] = await Promise.all([
    readConfig(),
    readPadron(),
    db().from('vot_votos').select('pid, comite').then(check),
    db().from('vot_urna').select('comite, p, s').then(check),
  ]);
  const voted = {};
  for (const { pid, comite } of votos) (voted[pid] ||= {})[comite] = true;
  return {
    cfg: publicConfig(cfg),
    padron: padron.map((person) => (admin
      ? { ...person, votos: voted[person.id] || {} }
      : { id: person.id, votos: voted[person.id] || {} })),
    urna: urna.map(({ comite, p, s }) => ({ c: comite, p: p.split('.'), s: s === '-' ? [] : s.split('.') })),
  };
}

function cleanConfig(input, previous) {
  const base = previous || defaultConfig();
  // Crear la elección envía {}: se usan los valores por defecto (1 principal y 1 suplente)
  const source = input?.comites ? input : base;
  const next = { salt: base.salt, lugar: clean(source.lugar, 80), jurados: clean(source.jurados, 160), comites: {} };
  for (const k of COMITES) {
    const c = source.comites?.[k] || base.comites[k];
    // El tarjetón solo cambia en inscripción: con votos emitidos, quitar un candidato volvería nulos sus votos
    const locked = previous && previous.comites[k].estado !== 'inscripcion';
    const candidatos = locked ? previous.comites[k].candidatos : (Array.isArray(c.candidatos) ? c.candidatos : []).slice(0, 30)
      .map((cand) => ({ id: clean(cand?.id, 40).replace(/[^a-z0-9]/gi, '') || rid(), nombre: clean(cand?.nombre, 80), cargo: clean(cand?.cargo, 60) }))
      .filter((cand) => cand.nombre);
    const estado = ESTADOS.includes(c.estado) ? c.estado : 'inscripcion';
    // No se abre la votación de un comité sin candidatos
    next.comites[k] = {
      principales: Math.max(1, Math.min(4, Number(c.principales) || 1)),
      suplentes: Math.max(0, Math.min(4, Number(c.suplentes) || 0)),
      estado: estado === 'votacion' && !candidatos.length ? 'inscripcion' : estado,
      fecha: clean(c.fecha, 10),
      candidatos,
      conformacion: cleanConformacion(c.conformacion),
    };
  }
  return next;
}

// Datos del acta de conformación (SST-FT-12) que designa el empleador; los trabajadores salen del escrutinio
function cleanConformacion(input) {
  const conf = input && typeof input === 'object' ? input : {};
  const empleador = (Array.isArray(conf.empleador) ? conf.empleador : []).slice(0, 8)
    .map((person) => ({ nombre: clean(person?.nombre, 80), cargo: clean(person?.cargo, 60) }));
  return {
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(conf.fecha || '') ? conf.fecha : '',
    escrutinio: clean(conf.escrutinio, 30),
    empleador,
    presidente: clean(conf.presidente, 80),
    secretario: clean(conf.secretario, 80),
    representante: clean(conf.representante, 80),
  };
}

// Valida la elección de un tarjetón: { p: [ids] | ['blanco'], s: [ids] | ['blanco'] }.
// Se marcan tantos principales y suplentes como elige el comité (o voto en blanco), sin repetir candidato.
function ballot(comite, choice) {
  const ids = new Set(comite.candidatos.map((cand) => cand.id));
  const pick = (list, need, taken) => {
    if (!Array.isArray(list)) return null;
    if (need === 0) return '-';
    if (list.length === 1 && list[0] === 'blanco') return 'blanco';
    const unique = new Set(list);
    if (unique.size !== list.length || list.some((id) => !ids.has(id) || taken.includes(id))) return null;
    return list.length === need ? list.join('.') : null;
  };
  const p = pick(choice?.p, Math.min(comite.principales, ids.size), []);
  if (!p) return null;
  const taken = p === 'blanco' ? [] : p.split('.');
  const s = pick(choice?.s, Math.min(comite.suplentes, ids.size - taken.length), taken);
  return s ? { p, s } : null;
}

async function handleVote(body, response) {
  const cfg = await readConfig();
  if (!cfg) return sendJson(response, 400, { error: 'La elección no está configurada.' });
  // El PIN de cada votante es su número de cédula
  const pin = cleanDoc(body.pin);
  if (pin.length < 5) return sendJson(response, 400, { error: 'Revise el PIN: es su número de cédula, sin puntos.' });
  const person = check(await db().from('vot_padron').select('id, nombre').eq('id', personId(cfg.salt, pin)).maybeSingle());
  if (!person) return sendJson(response, 404, { error: 'PIN no válido. Acérquese al administrador del padrón.' });
  const { id } = person;
  const yaVoto = new Set(check(await db().from('vot_votos').select('comite').eq('pid', id)).map((row) => row.comite));
  const pend = COMITES.filter((k) => cfg.comites[k].estado === 'votacion' && !yaVoto.has(k));

  if (body.action === 'verify') {
    if (!COMITES.some((k) => cfg.comites[k].estado === 'votacion')) {
      return sendJson(response, 409, { error: 'No hay votaciones abiertas en este momento.' });
    }
    if (!pend.length) return sendJson(response, 409, { error: 'Usted ya votó en las elecciones abiertas. Gracias por participar.' });
    return sendJson(response, 200, { nombre: person.nombre, pend });
  }

  const choices = body.choices || {};
  const todo = pend.filter((k) => choices[k]);
  if (!todo.length) return sendJson(response, 409, { error: 'Este voto ya estaba registrado o la votación se cerró.' });
  const papeletas = {};
  for (const k of todo) {
    papeletas[k] = ballot(cfg.comites[k], choices[k]);
    if (!papeletas[k]) return sendJson(response, 400, { error: 'El voto no corresponde al tarjetón: marque principal y suplente.' });
  }
  for (const k of todo) {
    // La clave (pid, comite) rechaza un segundo voto aunque lleguen dos solicitudes a la vez
    const { error } = await db().from('vot_votos').insert({ pid: id, comite: k });
    if (error) {
      if (error.code === '23505') continue;
      throw error;
    }
    check(await db().from('vot_urna').insert({ comite: k, p: papeletas[k].p, s: papeletas[k].s }));
  }
  return sendJson(response, 201, { ok: true });
}

// Acceso abierto (pedido del responsable): solo el padrón exige la clave de administrador
export default async function handler(request, response) {
  if (!storageConfigured()) return sendJson(response, 503, { error: 'El almacenamiento aún no está configurado.' });
  try {
    const admin = isAdmin(request);
    if (request.method === 'GET') {
      if (request.query.admin === '1' && !admin) return sendJson(response, 401, { error: 'Clave incorrecta.' });
      return sendJson(response, 200, await readState(request.query.admin === '1'));
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return sendJson(response, 405, { error: 'Método no permitido.' });
    }
    const body = request.body || {};

    if (body.action === 'config') {
      const cfg = cleanConfig(body.cfg, await readConfig());
      await saveConfig(cfg);
      return sendJson(response, 200, { cfg: publicConfig(cfg) });
    }

    if (body.action === 'padron-add' || body.action === 'padron-remove') {
      if (!admin) return sendJson(response, 401, { error: 'Clave incorrecta.' });
      const cfg = await readConfig();
      if (!cfg) return sendJson(response, 400, { error: 'Primero cree la elección.' });
      if (body.action === 'padron-remove') {
        const id = clean(body.id, 30);
        const voted = check(await db().from('vot_votos').select('comite').eq('pid', id));
        if (voted.length) return sendJson(response, 409, { error: 'No se puede quitar a quien ya votó.' });
        check(await db().from('vot_padron').delete().eq('id', id));
        return sendJson(response, 200, { ok: true });
      }
      const existing = new Set((await readPadron()).map((person) => person.id));
      let dup = 0, bad = 0;
      const rows = [];
      for (const row of (Array.isArray(body.rows) ? body.rows : []).slice(0, 500)) {
        const nombre = clean(row?.nombre, 80);
        const doc = cleanDoc(row?.doc);
        if (!nombre || doc.length < 5) { bad += 1; continue; }
        const id = personId(cfg.salt, doc);
        if (existing.has(id)) { dup += 1; continue; }
        existing.add(id);
        rows.push({ id, nombre, cargo: clean(row?.cargo, 60), pin: doc });
      }
      if (rows.length) check(await db().from('vot_padron').insert(rows));
      return sendJson(response, 200, { ok: rows.length, dup, bad, added: rows.map(({ nombre, pin }) => ({ nombre, pin })) });
    }

    if (body.action === 'verify' || body.action === 'vote') return await handleVote(body, response);
    return sendJson(response, 400, { error: 'Acción no válida.' });
  } catch (error) {
    console.error('Falló una operación de votaciones.', error);
    return sendJson(response, 500, { error: 'No fue posible completar la operación. Intente de nuevo.' });
  }
}
