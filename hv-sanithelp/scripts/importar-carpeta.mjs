// Pasa a Supabase los resultados anteriores descargados a mano del panel de Vercel (Storage → almacén
// Blob → Browser): personas.json, respuestas.json y los PDF <id>.pdf, todos en una misma carpeta.
// No duplica nada y conserva lo que ya está en Supabase.
//
//   node --env-file=.env.local scripts/importar-carpeta.mjs <carpeta>
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createSupabaseStorage } from '../server/storage.js'
import { importLegacyResults } from '../server/migracionBlob.js'

const folder = process.argv[2]
if (!folder) {
  console.error('Uso: node --env-file=.env.local scripts/importar-carpeta.mjs <carpeta>')
  process.exit(1)
}

const names = await readdir(folder)
const pdfs = names.filter((name) => /^[\w-]{1,64}\.pdf$/i.test(name))
// El navegador puede renombrar las descargas repetidas ("personas (1).json").
const findJson = (base) => names.find((name) => name === `${base}.json`) || names.find((name) => name.startsWith(base) && name.endsWith('.json'))
const files = {
  'db/personas.json': findJson('personas'),
  'db/respuestas.json': findJson('respuestas'),
  ...Object.fromEntries(pdfs.map((name) => [`pdfs/${name.replace(/\.pdf$/i, '.pdf')}`, name])),
}
console.log('Archivos encontrados:', files)
if (!files['db/personas.json']) console.warn('Falta personas.json: los PDF se copian, pero no aparecerán en Resultados sin él.')

const storage = await createSupabaseStorage({
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_BUCKET || 'hv-sanithelp',
})

console.log(await importLegacyResults(storage, {
  pdfPaths: pdfs.map((name) => `pdfs/${name}`),
  readFile: async (pathname) => (files[pathname] ? readFile(join(folder, files[pathname])) : null),
}))
