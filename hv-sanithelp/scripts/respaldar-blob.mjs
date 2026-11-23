// Descarga a una carpeta local TODO lo que hay en Vercel Blob (db/personas.json, db/respuestas.json y
// pdfs/*.pdf), como copia de seguridad antes de pasarlo a Supabase. Solo lee: no borra ni cambia nada.
// Mientras Vercel tenga bloqueado el almacén, lista los archivos pero cada descarga falla con 403.
//
//   node --env-file=.env.local scripts/respaldar-blob.mjs [carpeta]   (por defecto: respaldo-blob)
//
// Después: node --env-file=.env.local scripts/importar-carpeta.mjs <carpeta>/todo
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { get, list } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
const folder = process.argv[2] || 'respaldo-blob'

const blobs = []
let cursor
do {
  const page = await list({ limit: 1000, cursor, token })
  blobs.push(...page.blobs)
  cursor = page.hasMore ? page.cursor : undefined
} while (cursor)
console.log(`Archivos en Vercel Blob: ${blobs.length}`)

let fallos = 0
for (const blob of blobs) {
  try {
    const result = await get(blob.pathname, { access: 'private', useCache: false, token })
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
    // Copia con la estructura original y otra plana en <carpeta>/todo, lista para importar-carpeta.mjs.
    for (const dest of [join(folder, blob.pathname), join(folder, 'todo', basename(blob.pathname))]) {
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, bytes)
    }
    console.log('OK   ', blob.pathname, bytes.length)
  } catch (error) {
    fallos += 1
    console.log('FALLO', blob.pathname, error.message)
  }
}
console.log(fallos ? `${fallos} archivo(s) sin descargar.` : `Respaldo completo en ${folder}/`)
process.exitCode = fallos ? 1 : 0
