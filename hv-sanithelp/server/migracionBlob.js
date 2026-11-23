// Copia a Supabase los resultados que quedaron en Vercel Blob (personas.json, respuestas.json y los PDF).
// Vercel bloqueó la lectura del almacén Blob al superar el límite del plan gratis: mientras siga así,
// solo informa "bloqueado" y no toca nada. La corre cada día la tarea programada (api/migrar-blob.js)
// hasta que funciona una vez; se puede volver a correr sin duplicar nada.
import { mergeRespuestas, EMPTY_RESPUESTAS } from './respuestasDb.js'

const STATUS = 'migracion-blob.json'

export async function migrateFromBlob(storage, { token = process.env.BLOB_READ_WRITE_TOKEN, force = false } = {}) {
  if (!token) return { estado: 'sin-token' }
  const previous = await storage.readJson(STATUS, null)
  if (previous?.completada && !force) return { estado: 'completada', ...previous }

  const { BlobError, get, list } = await import('@vercel/blob')

  async function readBlob(pathname) {
    const result = await get(pathname, { access: 'private', useCache: false, token })
    if (!result?.stream) return null
    return Buffer.from(await new Response(result.stream).arrayBuffer())
  }

  // Lectura de prueba: si el almacén sigue bloqueado, Vercel responde 403.
  let legacyPeopleBytes
  try {
    legacyPeopleBytes = await readBlob('db/personas.json')
  } catch (error) {
    if (error instanceof BlobError && /403|blocked|suspended/i.test(error.message)) {
      const intento = { completada: false, ultimoIntento: new Date().toISOString(), detalle: error.message }
      await storage.update(STATUS, null, () => ({ data: intento }))
      return { estado: 'bloqueado', ...intento }
    }
    throw error
  }

  const { blobs } = await list({ prefix: 'pdfs/', limit: 1000, token })
  const resultado = await importLegacyResults(storage, {
    pdfPaths: blobs.map((blob) => blob.pathname),
    readFile: (pathname) => (pathname === 'db/personas.json' ? legacyPeopleBytes : readBlob(pathname)),
  })
  await storage.update(STATUS, null, () => ({ data: resultado }))
  return { estado: 'completada', ...resultado }
}

// Pasa a Supabase los resultados anteriores desde cualquier origen (Vercel Blob o una carpeta con los
// archivos descargados). readFile(ruta) devuelve los bytes o null: db/personas.json, db/respuestas.json
// y cada una de pdfPaths (pdfs/<id>.pdf). No duplica: lo que ya está en Supabase se conserva.
export async function importLegacyResults(storage, { pdfPaths, readFile }) {
  let pdfsCopiados = 0
  for (const pathname of pdfPaths) {
    const match = pathname.match(/^pdfs\/([\w-]{1,64})\.pdf$/)
    // Si ya está en Supabase es más reciente (la persona siguió su proceso después): no se pisa.
    if (!match || await storage.hasPdf(match[1])) continue
    const bytes = await readFile(pathname)
    if (bytes) {
      await storage.savePdf(match[1], bytes)
      pdfsCopiados += 1
    }
  }

  const legacyPeople = JSON.parse((await readFile('db/personas.json'))?.toString('utf8') || '[]')
  const personas = await storage.update('personas.json', [], (people) => {
    const ids = new Set(people.map((person) => person.id))
    const data = [...people, ...legacyPeople.filter((person) => !ids.has(person.id))]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    return { data, result: data.length }
  })

  const legacyRespuestas = JSON.parse((await readFile('db/respuestas.json'))?.toString('utf8') || 'null') || EMPTY_RESPUESTAS
  const respuestas = await storage.update('respuestas.json', EMPTY_RESPUESTAS, (current) => mergeRespuestas(current, legacyRespuestas))

  return {
    completada: true,
    completadaEn: new Date().toISOString(),
    personasAnteriores: legacyPeople.length,
    personasTotal: personas,
    pdfsCopiados,
    respuestas,
  }
}
