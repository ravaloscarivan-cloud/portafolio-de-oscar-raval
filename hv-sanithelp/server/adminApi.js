// API del administrador: ver, editar, agregar y borrar las respuestas de las personas.
//
//   GET    /api/admin/respuestas       lista de personas con su respuesta (datos, evaluaciones, constancia)
//   POST   /api/admin/respuestas       agrega una respuesta a mano: { id, respuesta, pdfBase64? }
//   PUT    /api/admin/respuestas/:id   edita una respuesta: { respuesta, pdfBase64? }
//   DELETE /api/admin/respuestas/:id   borra la persona, su respuesta y su PDF
//   POST   /api/admin/respuestas/:id/pdf  reemplaza el PDF de respuesta (editado en el visor o con archivos
//                                       agregados). Antes guarda una copia del actual en respaldos/. En producción devuelve
//                                       { signedUrl } para subir el PDF nuevo; en desarrollo va en pdfBase64.
//   POST   /api/admin/codigo           { email }: si es administrador, Supabase le envía un código al correo
//   POST   /api/admin/verificar        { email, codigo }: si el código es correcto devuelve { token }
//   POST   /api/admin/orden            { ids }: nuevo orden de las respuestas; se renumeran 01, 02, 03...
//
// Quién es administrador lo decide solo isAdmin(): el correo debe estar en la lista ADMIN_EMAILS
// (separados por comas); cualquier otro correo no entra. Sin código (admin.code falso) el correo va en el
// encabezado x-admin-email. Con código (ADMIN_CODIGO_CORREO=si en Vercel) el correo sale de la sesión
// que se abre con el código: encabezado Authorization: Bearer <token>, válido 1 hora.
// El PDF se sube antes con /api/upload (producción) o va en pdfBase64 (desarrollo), igual que el de las personas.
import { cleanDocumentos, cleanSteps, deletePersonResult, ID_PATTERN, json, PEOPLE, RESPUESTAS } from './api.js'
import { clean, cleanConstanciaEvaluaciones, cleanEvaluaciones, EMPTY_RESPUESTAS, formatParticipantId, normalizeRespuestas, upsertRespuesta } from './respuestasDb.js'

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

// "a@x.com, b@y.com" → ['a@x.com', 'b@y.com']
export function parseAdminEmails(value) {
  return String(value || '').split(/[,;\s]+/).map(normalizeEmail).filter(Boolean)
}

const NOT_ADMIN = 'Este correo no es administrador. No tienes acceso.'
const SESSION_EXPIRED = 'Tu sesión de administrador venció. Vuelve a entrar con tu correo.'

// admin: { emails, code }. Con code, el correo sale de la sesión abierta con el código.
export async function isAdmin(request, admin, storage) {
  let email = request.headers.get('x-admin-email')
  if (admin.code) {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    email = token ? await storage.emailFromLoginToken(token) : null
  }
  email = normalizeEmail(email)
  return Boolean(email && admin.emails?.includes(email))
}

// Paso 1 del código: solo a los correos de administrador se les envía.
async function sendCode(request, admin, storage) {
  const email = normalizeEmail((await request.json()).email)
  if (!admin.emails.includes(email)) return json({ error: NOT_ADMIN }, 401)
  try {
    await storage.sendLoginCode(email)
  } catch (error) {
    console.error('[admin] envío de código', error)
    return json({ error: error.message }, /demasiados/.test(error.message) ? 429 : 502)
  }
  return json({ enviado: true })
}

// Paso 2: el código abre una sesión de 1 hora.
async function verifyCode(request, admin, storage) {
  const { email: rawEmail, codigo } = await request.json()
  const email = normalizeEmail(rawEmail)
  if (!admin.emails.includes(email)) return json({ error: NOT_ADMIN }, 401)
  const code = String(codigo || '').replace(/\s+/g, '')
  const token = /^\d{6,10}$/.test(code) ? await storage.verifyLoginCode(email, code) : null
  return token ? json({ token }) : json({ error: 'Código incorrecto o vencido. Revisa el correo o pide uno nuevo.' }, 400)
}

// Une cada persona (personas.json) con su documento de respuestas (respuestas.json).
async function listRecords(storage) {
  const [people, contents] = await Promise.all([storage.readJson(PEOPLE, []), storage.readJson(RESPUESTAS, EMPTY_RESPUESTAS)])
  const documents = new Map(normalizeRespuestas(contents).respuestas.map((document) => [document.resultadoId, document]))
  const records = people.map((person) => {
    const document = documents.get(person.id) || {}
    documents.delete(person.id)
    return {
      id: person.id,
      _id: document._id || '',
      nombre: document.nombre ?? person.name,
      apellido: document.apellido || '',
      telefono: document.telefono || '',
      correo: document.correo || person.email,
      empresa: document.empresa || '',
      evaluaciones: document.evaluaciones || [],
      constanciaEvaluaciones: document.constanciaEvaluaciones || { firmada: false },
      procesoCompleto: person.completo !== false,
      pasos: person.pasos || {},
      documentos: person.documentos || null,
      createdAt: person.createdAt,
      actualizadoEn: person.updatedAt || person.createdAt,
    }
  })
  // En orden de participante: 01, 02, 03... Sin número, al final.
  const order = (record) => Number(record._id) || Number.MAX_SAFE_INTEGER
  return records.sort((first, second) => order(first) - order(second))
}

async function saveRecord(request, storage, id, isNew) {
  // documentos: lista nueva de documentos del PDF; null la borra (PDF reemplazado completo); sin enviar, se conserva.
  const { respuesta, pdfBase64, documentos } = await request.json()
  const nombre = clean(respuesta?.nombre)
  const correo = clean(respuesta?.correo)
  if (!nombre || !correo) return json({ error: 'El nombre y el correo son obligatorios.' }, 400)

  if (typeof pdfBase64 === 'string' && pdfBase64) {
    const bytes = Buffer.from(pdfBase64, 'base64')
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return json({ error: 'PDF no válido.' }, 400)
    await storage.savePdf(id, bytes)
  }

  const completo = respuesta.procesoCompleto === true
  const pasos = cleanSteps(respuesta.pasos, completo)
  const apellido = clean(respuesta.apellido)
  const now = new Date().toISOString()
  const conflict = await storage.update(PEOPLE, [], (people) => {
    const existing = people.find((person) => person.id === id)
    if (isNew && existing) return { data: people, result: true }
    const entry = {
      id,
      name: `${nombre} ${apellido}`.trim(),
      email: correo,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      completo,
      pasos,
      pdfUrl: `/api/people/${encodeURIComponent(id)}/pdf`,
      documentos: documentos === null ? undefined : cleanDocumentos(documentos) ?? existing?.documentos,
    }
    return {
      data: [entry, ...people.filter((person) => person.id !== id)]
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
      result: false,
    }
  })
  if (conflict) return json({ error: 'Ya existe una respuesta con ese identificador.' }, 409)

  const document = await storage.update(RESPUESTAS, EMPTY_RESPUESTAS, (contents) => {
    const previous = normalizeRespuestas(contents).respuestas.find((entry) => entry.resultadoId === id)
    return upsertRespuesta(contents, {
      resultadoId: id,
      nombre,
      apellido,
      telefono: clean(respuesta.telefono),
      correo,
      empresa: clean(respuesta.empresa),
      evaluaciones: cleanEvaluaciones(respuesta.evaluaciones),
      constanciaEvaluaciones: cleanConstanciaEvaluaciones(respuesta.constanciaEvaluaciones),
      procesoCompleto: completo,
      pasos,
      actualizadoEn: now,
      completadoEn: completo ? previous?.completadoEn || now : null,
      pdfUrl: `/api/people/${encodeURIComponent(id)}/pdf`,
    })
  })
  return json(document, isNew ? 201 : 200)
}

// Si la persona aún no tiene PDF, no hay copia que guardar.
async function replacePdf(request, storage, id) {
  const { pdfBase64 } = await request.json()
  const backup = async () => {
    if (await storage.hasPdf(id)) await storage.backupPdf(id)
  }
  if (!storage.createPdfUploadUrl) {
    const bytes = Buffer.from(String(pdfBase64 || ''), 'base64')
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return json({ error: 'PDF no válido.' }, 400)
    await backup()
    await storage.savePdf(id, bytes)
    return json({ guardado: true })
  }
  await backup()
  return json({ signedUrl: await storage.createPdfUploadUrl(id) })
}

// El administrador arrastra las respuestas al orden que quiere: los números de participante se
// reasignan 01, 02, 03... en ese orden. Las respuestas que no vengan en ids (por ejemplo, una que llegó
// mientras tanto) quedan después, en su orden anterior. ultimoId no baja, para no repetir números.
async function reorderRecords(request, storage) {
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length > 5000 || !ids.every((id) => typeof id === 'string' && ID_PATTERN.test(id))) {
    return json({ error: 'Orden no válido.' }, 400)
  }
  const numbers = await storage.update(RESPUESTAS, EMPTY_RESPUESTAS, (contents) => {
    const database = normalizeRespuestas(contents)
    const byId = new Map(database.respuestas.map((document) => [document.resultadoId, document]))
    const listed = [...new Set(ids)].filter((id) => byId.has(id)).map((id) => byId.get(id))
    const rest = database.respuestas.filter((document) => !listed.includes(document))
    const respuestas = [...listed, ...rest].map((document, index) => ({ ...document, _id: formatParticipantId(index + 1) }))
    return {
      data: { ultimoId: Math.max(database.ultimoId, respuestas.length), respuestas },
      result: respuestas.map((document) => ({ id: document.resultadoId, _id: document._id })),
    }
  })
  return json(numbers)
}

export async function handleAdminApi(request, { storage, admin }) {
  const { pathname } = new URL(request.url)
  const method = request.method
  if (!admin?.emails?.length) return json({ error: 'Falta configurar los correos de administrador en el servidor.' }, 500)

  if (admin.code && method === 'POST' && pathname === '/api/admin/codigo') return sendCode(request, admin, storage)
  if (admin.code && method === 'POST' && pathname === '/api/admin/verificar') return verifyCode(request, admin, storage)
  if (!(await isAdmin(request, admin, storage))) return json({ error: admin.code ? SESSION_EXPIRED : NOT_ADMIN }, 401)

  if (pathname === '/api/admin/orden') return method === 'POST' ? reorderRecords(request, storage) : json({ error: 'Método no permitido.' }, 405)

  if (pathname === '/api/admin/respuestas') {
    if (method === 'GET') return json(await listRecords(storage))
    if (method === 'POST') {
      const { id } = await request.clone().json()
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) return json({ error: 'Identificador no válido.' }, 400)
      return saveRecord(request, storage, id, true)
    }
    return json({ error: 'Método no permitido.' }, 405)
  }

  const pdfRoute = pathname.match(/^\/api\/admin\/respuestas\/([\w-]{1,64})\/pdf$/)
  if (pdfRoute) return method === 'POST' ? replacePdf(request, storage, pdfRoute[1]) : json({ error: 'Método no permitido.' }, 405)

  const recordRoute = pathname.match(/^\/api\/admin\/respuestas\/([\w-]{1,64})$/)
  if (recordRoute) {
    if (method === 'PUT') return saveRecord(request, storage, recordRoute[1], false)
    if (method === 'DELETE') return deletePersonResult(storage, recordRoute[1])
    return json({ error: 'Método no permitido.' }, 405)
  }

  return json({ error: 'Ruta no encontrada.' }, 404)
}
