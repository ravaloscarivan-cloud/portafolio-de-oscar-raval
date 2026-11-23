// Descarga una copia privada de los documentos y todos los archivos de Storage de Supabase.
// Uso: node --env-file=.env.local scripts/respaldar-supabase.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env
const bucketName = process.env.SUPABASE_BUCKET || 'hv-sanithelp'
if (!url || !serviceKey) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const snapshotDir = resolve('respaldo-supabase', stamp)
const dataDir = resolve(snapshotDir, 'data')
const documentsDir = resolve(snapshotDir, 'documentos')
const storageDir = resolve(snapshotDir, 'storage')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

await Promise.all([mkdir(dataDir, { recursive: true }), mkdir(documentsDir, { recursive: true }), mkdir(storageDir, { recursive: true })])

const { data: rows, error: rowsError } = await supabase
  .from('documentos')
  .select('nombre, datos, version, actualizado_en')
if (rowsError) throw new Error(`No se pudieron leer los documentos: ${rowsError.message}`)

await writeFile(resolve(documentsDir, 'documentos.json'), `${JSON.stringify(rows, null, 2)}\n`)
for (const row of rows) {
  if (!['personas.json', 'respuestas.json'].includes(row.nombre)) continue
  await writeFile(resolve(dataDir, row.nombre), `${JSON.stringify(row.datos, null, 2)}\n`)
}

const bucket = supabase.storage.from(bucketName)
const objectPaths = []
async function listObjects(prefix = '') {
  for (let offset = 0; ; offset += 100) {
    const { data: entries, error } = await bucket.list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`No se pudo listar Storage en ${prefix || '/'}: ${error.message}`)
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) await listObjects(path)
      else objectPaths.push(path)
    }
    if (entries.length < 100) break
  }
}

await listObjects()
let storageBytes = 0
for (const path of objectPaths) {
  const { data, error } = await bucket.download(path)
  if (error) throw new Error(`No se pudo descargar ${path}: ${error.message}`)
  const target = resolve(storageDir, ...path.split('/'))
  if (!target.startsWith(`${storageDir}${sep}`)) throw new Error(`Ruta de Storage no válida: ${path}`)
  const bytes = Buffer.from(await data.arrayBuffer())
  await mkdir(resolve(target, '..'), { recursive: true })
  await writeFile(target, bytes)
  storageBytes += bytes.byteLength
}

const manifest = {
  fecha: new Date().toISOString(),
  proyecto: new URL(url).hostname.split('.')[0],
  bucket: bucketName,
  documentos: rows.map(({ nombre, version, actualizado_en }) => ({ nombre, version, actualizado_en })),
  archivosStorage: objectPaths.length,
  bytesStorage: storageBytes,
}
await writeFile(resolve(snapshotDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Copia creada en: ${snapshotDir}`)
console.log(`Documentos: ${rows.length}; archivos de Storage: ${objectPaths.length}; MB descargados: ${(storageBytes / 1024 / 1024).toFixed(2)}`)
