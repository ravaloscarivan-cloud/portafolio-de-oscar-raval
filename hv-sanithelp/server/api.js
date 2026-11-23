// API de resultados con Request/Response estándar: la usan las funciones de Vercel (api/) y el
// servidor de desarrollo de Vite (vite.config.js), cada uno con su almacenamiento.
//
//   GET    /api/config             cómo subir el PDF: 'signed' (producción) o 'inline' (desarrollo), y
//                                   si Administrador pide código al correo (adminCodigo)
//   POST   /api/upload             URL firmada para que el navegador suba el PDF directo a Supabase
//   POST   /api/people             crea o actualiza el resultado de una persona a medida que avanza
//                                   en el proceso, y al terminar (no requiere clave)
//   GET    /api/people             lista de resultados                       (requiere clave)
//   GET    /api/people/:id/pdf     PDF de respuesta                          (requiere clave)
//   GET    /api/people/:id/pdf-url enlace temporal de Supabase al PDF; ?download=<nombre> para
//                                   descargarlo con ese nombre                (requiere clave)
//   DELETE /api/people/:id         borra el resultado, su PDF y su respuesta (requiere clave)
//   /api/admin/respuestas[/:id]     ver, agregar, editar y borrar respuestas (administrador, ver
//                                   server/adminApi.js). El administrador también puede ver los PDF.
//   GET    /api/migrar-blob        copia a Supabase lo que quedó en Vercel Blob (tarea diaria de Vercel
//                                   con CRON_SECRET, o a mano con la clave de Resultados)
//
// La clave de Resultados va en el encabezado x-access-key y se compara en el servidor.
import { createHash, timingSafeEqual } from 'node:crypto'
import { EMPTY_RESPUESTAS, removeRespuesta, toRespuestaData, upsertRespuesta } from './respuestasDb.js'

export const PEOPLE = 'personas.json'
export const RESPUESTAS = 'respuestas.json'
export const ID_PATTERN = /^[\w-]{1,64}$/

export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

export function sameKey(given, expected) {
  // Se comparan los hash para no filtrar la longitud ni el contenido por tiempos de respuesta.
  const digest = (value) => createHash('sha256').update(String(value)).digest()
  return timingSafeEqual(digest(given), digest(expected))
}

function requireKey(request, accessKey) {
  if (!accessKey) return json({ error: 'Falta configurar RESULTS_ACCESS_KEY en el servidor.' }, 500)
  const given = request.headers.get('x-access-key') || ''
  return given && sameKey(given, accessKey) ? null : json({ error: 'Clave incorrecta.' }, 401)
}

const STEPS = ['hv', 'soportes', 'induccion', 'evaluaciones']

// Secciones que la persona ya completó. Sin pasos (versiones anteriores) el proceso se da por completo.
export function cleanSteps(pasos, completo) {
  return Object.fromEntries(STEPS.map((step) => [step, completo || pasos?.[step] === true]))
}

// Lista de documentos del PDF de respuesta: [{ id, nombre, desde, hasta }] (páginas desde 1).
export function cleanDocumentos(documentos) {
  if (!Array.isArray(documentos)) return undefined
  return documentos.slice(0, 40)
    .filter((document) => typeof document?.id === 'string' && /^[\w-]{1,40}$/.test(document.id)
      && Number.isInteger(document.desde) && Number.isInteger(document.hasta) && document.desde >= 1 && document.hasta >= document.desde)
    .map((document) => ({
      id: document.id,
      nombre: typeof document.nombre === 'string' ? document.nombre.trim().slice(0, 200) : '',
      desde: document.desde,
      hasta: document.hasta,
    }))
}

function isValidPerson(person) {
  return typeof person?.id === 'string' && ID_PATTERN.test(person.id)
    && typeof person.name === 'string' && person.name.trim()
    && typeof person.email === 'string' && person.email.trim()
    && typeof person.createdAt === 'string' && !Number.isNaN(Date.parse(person.createdAt))
}

async function savePersonResult(request, storage, backupStorage) {
  const { person, pdfBase64 } = await request.json()
  if (!isValidPerson(person)) return json({ error: 'Faltan datos de la persona.' }, 400)

  let pdfBytes
  if (typeof pdfBase64 === 'string' && pdfBase64) {
    pdfBytes = Buffer.from(pdfBase64, 'base64')
    if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') return json({ error: 'PDF no válido.' }, 400)
    await storage.savePdf(person.id, pdfBytes)
  } else if (!(await storage.hasPdf(person.id))) {
    // En producción el navegador sube el PDF antes de llamar aquí.
    return json({ error: 'No se encontró el PDF de respuesta.' }, 400)
  }

  // Completo: pulsó "Terminar" o ya tiene las 4 secciones hechas (aunque no haya pulsado "Terminar").
  const completo = person.completo !== false || STEPS.every((step) => person.pasos?.[step] === true)
  const updatedAt = new Date().toISOString()
  const storedPerson = await storage.update(PEOPLE, [], (people) => {
    const existing = people.find((entry) => entry.id === person.id)
    const entry = {
      id: person.id,
      name: person.name.trim().slice(0, 200),
      email: person.email.trim().slice(0, 200),
      // La fecha de creación es la del primer guardado (sección 1); cada avance solo cambia updatedAt.
      createdAt: existing?.createdAt || person.createdAt,
      updatedAt,
      completo,
      pasos: cleanSteps(person.pasos, completo),
      pdfUrl: `/api/people/${encodeURIComponent(person.id)}/pdf`,
      documentos: cleanDocumentos(person.documentos) ?? existing?.documentos,
    }
    return {
      data: [entry, ...people.filter((other) => other.id !== person.id)]
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
      result: entry,
    }
  })
  // Nombre, apellido, teléfono, correo, empresa y evaluaciones solo se guardan en respuestas.json.
  const answer = toRespuestaData({ ...person, completo, pasos: storedPerson.pasos, updatedAt })
  await storage.update(RESPUESTAS, EMPTY_RESPUESTAS, (respuestas) => upsertRespuesta(respuestas, answer))

  if (backupStorage) {
    if (!pdfBytes) {
      const pdf = await storage.readPdf(person.id)
      if (!pdf) throw new Error(`No se encontró el PDF ${person.id} para respaldarlo en Firebase.`)
      pdfBytes = Buffer.from(await new Response(pdf.body).arrayBuffer())
    }
    await backupStorage.saveResponse({
      id: person.id,
      person: storedPerson,
      answer,
      pdfBytes,
      backedUpAt: updatedAt,
    })
  }

  return json({ ...storedPerson, backupSaved: Boolean(backupStorage) }, 201)
}

async function saveFirebaseFallback(request, backupStorage, mode) {
  if (!backupStorage) return json({ error: 'El respaldo Firebase no está configurado.' }, 503)
  const body = await request.json()
  if (mode === 'pdf-chunk') {
    const { id, uploadId, index, chunkBase64 } = body
    if (typeof id !== 'string' || !ID_PATTERN.test(id)
      || typeof uploadId !== 'string' || !ID_PATTERN.test(uploadId)
      || !Number.isInteger(index) || index < 0 || index >= 5000
      || typeof chunkBase64 !== 'string' || !chunkBase64) {
      return json({ error: 'Fragmento de respaldo no válido.' }, 400)
    }
    const chunk = Buffer.from(chunkBase64, 'base64')
    if (!chunk.length || chunk.length > 2 * 1024 * 1024) return json({ error: 'El fragmento supera el tamaño permitido.' }, 413)
    await backupStorage.savePdfChunk({ id, uploadId, index, chunkBase64 })
    return json({ saved: true })
  }

  const { person, uploadId, totalBytes, totalChunks } = body
  if (!isValidPerson(person) || typeof uploadId !== 'string' || !ID_PATTERN.test(uploadId)
    || !Number.isInteger(totalBytes) || totalBytes < 1
    || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 5000) {
    return json({ error: 'Datos del respaldo no válidos.' }, 400)
  }
  const updatedAt = new Date().toISOString()
  const completo = person.completo !== false || STEPS.every((step) => person.pasos?.[step] === true)
  const answer = toRespuestaData({ ...person, completo, pasos: cleanSteps(person.pasos, completo), updatedAt })
  const storedPerson = {
    id: person.id,
    name: person.name.trim().slice(0, 200),
    email: person.email.trim().slice(0, 200),
    createdAt: person.createdAt,
    updatedAt,
    completo,
    pasos: cleanSteps(person.pasos, completo),
    pdfUrl: `/api/people/${encodeURIComponent(person.id)}/pdf`,
    documentos: cleanDocumentos(person.documentos),
  }
  await backupStorage.saveResponse({
    id: person.id,
    person: storedPerson,
    answer,
    pdfReference: {
      path: `respuestasPdf/${person.id}/${uploadId}`,
      bytes: totalBytes,
      chunks: totalChunks,
    },
    backedUpAt: updatedAt,
  })
  return json({ ...storedPerson, backupSaved: true, primarySaved: false }, 201)
}

export async function deletePersonResult(storage, id) {
  let deleted = false
  await storage.update(PEOPLE, [], (people) => {
    const remaining = people.filter((person) => person.id !== id)
    deleted = remaining.length !== people.length
    return { data: remaining }
  })
  await storage.update(RESPUESTAS, EMPTY_RESPUESTAS, (respuestas) => removeRespuesta(respuestas, id))
  await storage.deletePdf(id)
  return json({ deleted })
}

// Devuelve una URL firmada para que el navegador suba el PDF directo a pdfs/<id>.pdf en Supabase.
async function handleUploadUrl(request, storage) {
  const { id } = await request.json()
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return json({ error: 'Identificador no válido.' }, 400)
  return json({ signedUrl: await storage.createPdfUploadUrl(id) })
}

// La tarea programada de Vercel envía "Authorization: Bearer <CRON_SECRET>".
function canMigrate(request, accessKey, cronSecret) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (cronSecret && bearer && sameKey(bearer, cronSecret)) return true
  return !requireKey(request, accessKey)
}

// Ver el PDF de una persona: con la clave de Resultados o siendo administrador.
async function requirePdfAccess(request, accessKey, admin, storage) {
  if (admin?.emails?.length && (request.headers.get('x-admin-email') || request.headers.get('authorization'))) {
    const { isAdmin } = await import('./adminApi.js')
    if (await isAdmin(request, admin, storage)) return null
  }
  return requireKey(request, accessKey)
}

// admin: { emails: correos de administrador, code: si entran con código al correo }.
export async function handleApi(request, { storage, backupStorage, accessKey, admin, cronSecret }) {
  const { pathname } = new URL(request.url)
  const method = request.method
  try {
    if (pathname === '/api/config' && method === 'GET') {
      return json({ pdfUpload: storage.createPdfUploadUrl ? 'signed' : 'inline', adminCodigo: Boolean(admin?.code), backupEnabled: Boolean(backupStorage) })
    }

    if (pathname === '/api/upload' && method === 'POST') {
      if (!storage.createPdfUploadUrl) return json({ error: 'No disponible en este entorno.' }, 404)
      return await handleUploadUrl(request, storage)
    }

    if (pathname === '/api/people') {
      if (method === 'POST') {
        const fallbackMode = new URL(request.url).searchParams.get('firebaseBackup')
        if (fallbackMode === 'pdf-chunk' || fallbackMode === 'response') {
          return await saveFirebaseFallback(request, backupStorage, fallbackMode)
        }
        return await savePersonResult(request, storage, backupStorage)
      }
      if (method === 'GET') {
        return requireKey(request, accessKey) || json(await storage.readJson(PEOPLE, []))
      }
      return json({ error: 'Método no permitido.' }, 405)
    }

    const pdfRoute = pathname.match(/^\/api\/people\/([\w-]{1,64})\/pdf$/)
    if (pdfRoute && method === 'GET') {
      const denied = await requirePdfAccess(request, accessKey, admin, storage)
      if (denied) return denied
      const pdf = await storage.readPdf(pdfRoute[1])
      if (!pdf) return json({ error: 'PDF no encontrado.' }, 404)
      return new Response(pdf.body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(pdf.size),
          'Cache-Control': 'no-store',
        },
      })
    }

    // Enlace temporal para que el navegador abra el PDF directo de Supabase, con su tamaño para que el
    // visor lo pida por partes. Sin enlaces firmados (desarrollo), responde url: null y se usa /pdf.
    const pdfUrlRoute = pathname.match(/^\/api\/people\/([\w-]{1,64})\/pdf-url$/)
    if (pdfUrlRoute && method === 'GET') {
      const denied = await requirePdfAccess(request, accessKey, admin, storage)
      if (denied) return denied
      if (!storage.createPdfDownloadUrl) return json({ url: null })
      const filename = new URL(request.url).searchParams.get('download')?.slice(0, 150) || undefined
      const [url, size] = await Promise.all([
        storage.createPdfDownloadUrl(pdfUrlRoute[1], filename),
        filename ? null : storage.pdfSize(pdfUrlRoute[1]),
      ])
      return url ? json({ url, size }) : json({ error: 'PDF no encontrado.' }, 404)
    }

    const personRoute = pathname.match(/^\/api\/people\/([\w-]{1,64})$/)
    if (personRoute && method === 'DELETE') {
      return requireKey(request, accessKey) || await deletePersonResult(storage, personRoute[1])
    }

    if (pathname.startsWith('/api/admin/')) {
      const { handleAdminApi } = await import('./adminApi.js')
      return await handleAdminApi(request, { storage, admin })
    }

    if (pathname === '/api/migrar-blob' && method === 'GET') {
      if (storage.kind !== 'supabase') return json({ error: 'No disponible en este entorno.' }, 404)
      if (!canMigrate(request, accessKey, cronSecret)) return json({ error: 'Clave incorrecta.' }, 401)
      const { migrateFromBlob } = await import('./migracionBlob.js')
      return json(await migrateFromBlob(storage))
    }

    return json({ error: 'Ruta no encontrada.' }, 404)
  } catch (error) {
    console.error(`[api] ${method} ${pathname}`, error)
    return json({ error: error instanceof SyntaxError ? 'Solicitud no válida.' : 'Error del servidor.' }, error instanceof SyntaxError ? 400 : 500)
  }
}
