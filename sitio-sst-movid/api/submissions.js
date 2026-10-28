import { randomUUID, timingSafeEqual } from 'node:crypto';
import { check, db, getFile, listFiles, putFile, removeFiles, storageConfigured } from '../lib/db.js';
import { createSubmissionPdf, submissionPdfFilename, validateSubmission } from '../lib/submission.js';
import { createHojaVidaPdf, HOJA_VIDA_MAX_BYTES, validateHojaVida } from '../lib/hojaVida.js';
import { contentTypeOf } from '../lib/soportes.js';
import { broadcast, liveConfig, nameVisitor, visitorId } from '../lib/live.js';
import { checkCompletion } from '../lib/completion.js';

const prefix = 'submissions/';
const maxBodyBytes = 10 * 1024;

function sendJson(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(value);
}

function isAdmin(request) {
  const expected = process.env.RESPONSES_PASSWORD;
  const authorization = request.headers.authorization || '';
  const provided = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

// Los registros viven en la tabla "registros" (data = JSON completo); los PDF, en el bucket privado
async function readRecord(id) {
  const row = check(await db().from('registros').select('data').eq('id', id).maybeSingle());
  return row ? row.data : null;
}

function safeId(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function handlePost(request, response) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return sendJson(response, 415, { error: 'El contenido debe ser JSON.' });
  }

  const isHojaVida = request.body?.type === 'hoja-vida';
  const limit = isHojaVida ? HOJA_VIDA_MAX_BYTES : maxBodyBytes;
  const contentLength = Number(request.headers['content-length'] || 0);
  const bodyLength = Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8');
  if (contentLength > limit || bodyLength > limit) {
    return sendJson(response, 413, { error: 'La solicitud supera el tamaño permitido.' });
  }
  if (typeof request.body?.website === 'string' && request.body.website.trim()) {
    return sendJson(response, 400, { error: 'La solicitud no es válida.' });
  }

  const validation = isHojaVida ? validateHojaVida(request.body) : validateSubmission(request.body);
  if (validation.error) {
    return sendJson(response, 400, { error: validation.error });
  }
  if (!storageConfigured()) {
    console.error('No hay un almacenamiento Supabase configurado.');
    return sendJson(response, 503, { error: 'El almacenamiento aún no está configurado.' });
  }

  const id = randomUUID();
  const now = new Date();
  const createdAt = now.toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  });
  const record = {
    version: 1,
    id,
    ...(isHojaVida ? validation.hojaVida : validation.submission),
    createdAt,
    consentAcceptedAt: now.toISOString(),
  };
  const pdfPath = `${prefix}${id}.pdf`;
  let pdfSaved = false;

  try {
    const pdf = isHojaVida
      ? await createHojaVidaPdf(record, validation.photo, validation.signature)
      : await createSubmissionPdf(record);
    await putFile(pdfPath, pdf, 'application/pdf');
    pdfSaved = true;
    check(await db().from('registros').insert({ id, kind: record.kind || 'postulacion', created_at: record.consentAcceptedAt, data: record }));
    await nameVisitor(db, visitorId(request), record.name);
    await broadcast({ t: 'envia', k: record.kind || 'postulacion', n: record.name, s: visitorId(request) });
    if (isHojaVida) await checkCompletion(record.document);

    if (isHojaVida) {
      return sendJson(response, 201, { id, name: record.name, createdAt });
    }

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${submissionPdfFilename(record)}"`);
    response.setHeader('X-Submission-Id', id);
    response.setHeader('X-Submission-Filename', submissionPdfFilename(record));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.status(201).send(pdf);
  } catch (error) {
    if (pdfSaved) {
      await removeFiles([pdfPath]).catch((cleanupError) => console.error('No se pudo limpiar un PDF incompleto.', cleanupError));
    }
    console.error('Falló el guardado de un registro.', error);
    return sendJson(response, 500, {
      error: isHojaVida
        ? 'No fue posible enviar la hoja de vida. Intenta de nuevo.'
        : 'No fue posible guardar la postulación. Intenta de nuevo.',
    });
  }
}

async function handleAdminGet(request, response) {
  if (!process.env.RESPONSES_PASSWORD) {
    return sendJson(response, 503, { error: 'El acceso administrativo aún no está configurado.' });
  }
  if (!isAdmin(request)) {
    return sendJson(response, 401, { error: 'No autorizado.' });
  }

  // La pestaña donde el admin inicia sesión no es un visitante: se borra su visita anónima al abrir el sitio.
  // El código es del navegador (lo comparten sus pestañas): si ya tiene nombre, es una visita real y se conserva.
  const adminTab = visitorId(request);
  if (adminTab) await db().from('visitas').delete().eq('sesion', adminTab).eq('nombre', '');

  // Datos para que la campana escuche los avisos en vivo
  if (request.query.live === '1') {
    const config = liveConfig();
    return config ? sendJson(response, 200, config) : sendJson(response, 503, { error: 'Los avisos en vivo aún no están configurados.' });
  }

  const id = typeof request.query.id === 'string' ? request.query.id : '';
  if (id) {
    if (!safeId(id)) return sendJson(response, 400, { error: 'El identificador no es válido.' });
    if (request.query.file !== undefined) return sendSoporteFile(response, id, Number(request.query.file));
    try {
      const record = await readRecord(id);
      const pdf = record && await getFile(`${prefix}${id}.pdf`);
      if (!pdf) return sendJson(response, 404, { error: 'No se encontró el PDF solicitado.' });
      const filename = submissionPdfFilename(record);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader(
        'Content-Disposition',
        `${request.query.view === '1' ? 'inline' : 'attachment'}; filename="${filename}"`,
      );
      response.setHeader('X-Submission-Filename', filename);
      response.setHeader('X-Content-Type-Options', 'nosniff');
      return response.status(200).send(pdf);
    } catch (error) {
      console.error('Falló la lectura de un PDF privado.', error);
      return sendJson(response, 500, { error: 'No fue posible leer el PDF solicitado.' });
    }
  }

  // Paginación por desplazamiento: el cursor es el número de registros ya entregados
  const limitValue = Number(request.query.limit || 50);
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
  const offset = Math.max(0, Number.parseInt(request.query.cursor, 10) || 0);

  try {
    const rows = check(await db().from('registros').select('data').order('created_at', { ascending: false }).range(offset, offset + limit));
    const hasMore = rows.length > limit;
    const submissions = rows.slice(0, limit).map((row) => row.data);
    // Avance de los preguardados de hoja de vida (solo con la primera página)
    const avances = offset ? [] : check(await db().from('hv_avance').select('data').order('updated_at', { ascending: false }).limit(300))
      .map((row) => row.data);
    return sendJson(response, 200, {
      avances,
      ...(offset ? {} : { ...await readAdminEstado(), visitas: await readVisitas(), inducciones: await readInducciones() }),
      submissions: submissions.map(({ id: submissionId, kind, committee, name, document, position, createdAt, consentAcceptedAt, files }) => ({
        id: submissionId,
        kind: kind || 'postulacion',
        committee,
        name,
        // El documento agrupa el formato de HV y los soportes de una misma persona
        ...(kind === 'hoja-vida' || kind === 'soportes' ? { document } : {}),
        // El cargo permite inscribir a los postulados como candidatos en Votaciones
        ...(!kind ? { position } : {}),
        createdAt,
        consentAcceptedAt,
        ...(kind === 'soportes'
          ? { files: files.map(({ index, label, name: fileName, size }) => ({ index, label, name: fileName, size })) }
          : {}),
      })),
      cursor: hasMore ? String(offset + limit) : '',
      hasMore,
    });
  } catch (error) {
    console.error('Falló la consulta administrativa de postulaciones.', error);
    return sendJson(response, 500, { error: 'No fue posible consultar las postulaciones.' });
  }
}

async function sendSoporteFile(response, id, index) {
  try {
    const record = await readRecord(id);
    const file = record?.kind === 'soportes' ? record.files.find((item) => item.index === index) : null;
    if (!file) return sendJson(response, 404, { error: 'No se encontró el archivo solicitado.' });
    const content = await getFile(`soportes/${id}/${file.path}`);
    if (!content) return sendJson(response, 404, { error: 'No se encontró el archivo solicitado.' });
    const filename = `${submissionPdfFilename(record).replace(/\.pdf$/, '')}-${file.path}`;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', contentTypeOf(file.name));
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('X-Submission-Filename', filename);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.status(200).send(content);
  } catch (error) {
    console.error('Falló la lectura de un soporte privado.', error);
    return sendJson(response, 500, { error: 'No fue posible leer el archivo solicitado.' });
  }
}

// Alertas del admin: la fecha de la última revisión vive en la base de datos, no en el navegador
async function readAdminEstado() {
  const { data, error } = await db().from('admin_estado').select('visto_at, ocultas').eq('id', 1).maybeSingle();
  if (error) console.error('No se pudo leer el estado de las alertas del admin.', error);
  return { adminSeenAt: data?.visto_at || null, ocultas: data?.ocultas || {} };
}

// Notificaciones eliminadas del panel: clave → fecha del aviso eliminado (se olvidan a los 30 días)
async function hideAlerts(request, response) {
  const items = Array.isArray(request.body?.items) ? request.body.items.slice(0, 300) : [];
  const valid = items.filter((item) => typeof item?.key === 'string' && /^[avir]:[\w-]{1,64}$/.test(item.key) && Number.isFinite(Date.parse(item.at)));
  if (!valid.length) return sendJson(response, 400, { error: 'No hay notificaciones válidas para eliminar.' });
  try {
    const { ocultas } = await readAdminEstado();
    const limit = Date.now() - 31 * 864e5;
    const next = Object.fromEntries(Object.entries(ocultas).filter(([, at]) => Date.parse(at) > limit));
    for (const { key, at } of valid) next[key] = new Date(at).toISOString();
    check(await db().from('admin_estado').upsert({ id: 1, ocultas: next, updated_at: new Date().toISOString() }));
    return sendJson(response, 200, { ocultas: next });
  } catch (error) {
    console.error('Falló la eliminación de notificaciones.', error);
    return sendJson(response, 500, { error: 'No fue posible eliminar las notificaciones.' });
  }
}

// Visitantes de los últimos 30 días, con su sección y acción más recientes
async function readVisitas() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error } = await db().from('visitas').select('sesion, vista, tipo, nombre, updated_at')
    .gt('updated_at', since).order('updated_at', { ascending: false }).limit(300);
  if (error) console.error('No se pudieron leer las visitas.', error);
  return (data || []).map((row) => ({ s: row.sesion, v: row.vista, t: row.tipo, n: row.nombre, at: row.updated_at }));
}

// Inducciones terminadas y si ya se envió el manual (se cruzan con las HV por documento)
async function readInducciones() {
  const { data, error } = await db().from('induccion').select('documento, nombre, completed_at, manual_enviado_at')
    .order('completed_at', { ascending: false }).limit(300);
  if (error) console.error('No se pudieron leer las inducciones.', error);
  return (data || []).map((row) => ({ document: row.documento, name: row.nombre, completedAt: row.completed_at, manualAt: row.manual_enviado_at }));
}

async function handleAdminPut(request, response) {
  if (!process.env.RESPONSES_PASSWORD) {
    return sendJson(response, 503, { error: 'El acceso administrativo aún no está configurado.' });
  }
  if (!isAdmin(request)) {
    return sendJson(response, 401, { error: 'No autorizado.' });
  }
  if (request.query.action === 'ocultar') return hideAlerts(request, response);
  if (request.query.action !== 'visto') return sendJson(response, 400, { error: 'Acción no válida.' });

  try {
    const now = new Date().toISOString();
    check(await db().from('admin_estado').upsert({ id: 1, visto_at: now, updated_at: now }));
    return sendJson(response, 200, { adminSeenAt: now });
  } catch (error) {
    console.error('Falló el guardado del estado de las alertas del admin.', error);
    return sendJson(response, 500, { error: 'No fue posible marcar las novedades como vistas.' });
  }
}

async function handleAdminDelete(request, response) {
  if (!process.env.RESPONSES_PASSWORD) {
    return sendJson(response, 503, { error: 'El acceso administrativo aún no está configurado.' });
  }
  if (!isAdmin(request)) {
    return sendJson(response, 401, { error: 'No autorizado.' });
  }

  const id = typeof request.query.id === 'string' ? request.query.id : '';
  if (!safeId(id)) return sendJson(response, 400, { error: 'El identificador no es válido.' });

  try {
    const deleted = check(await db().from('registros').delete().eq('id', id).select('kind, data'));
    if (!deleted.length) return sendJson(response, 404, { error: 'No se encontró la respuesta solicitada.' });
    // Al borrar el formato de HV también se borra el avance de su preguardado
    const { kind, data } = deleted[0];
    if (kind === 'hoja-vida' && data?.document) check(await db().from('hv_avance').delete().eq('data->>document', data.document));
    // Los envíos de HV y soportes también guardan sus archivos originales
    const attachments = await listFiles(`soportes/${id}`);
    await removeFiles([`${prefix}${id}.pdf`, ...attachments]);
    return sendJson(response, 200, { deleted: true, id });
  } catch (error) {
    console.error('Falló la eliminación de un registro.', error);
    return sendJson(response, 500, { error: 'No fue posible eliminar la respuesta.' });
  }
}

export default async function handler(request, response) {
  if (request.method === 'POST') return handlePost(request, response);
  if (request.method === 'GET') return handleAdminGet(request, response);
  if (request.method === 'PUT') return handleAdminPut(request, response);
  if (request.method === 'DELETE') return handleAdminDelete(request, response);

  response.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return sendJson(response, 405, { error: 'Método no permitido.' });
}
