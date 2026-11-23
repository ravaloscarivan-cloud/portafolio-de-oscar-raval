// Copia a mano los resultados guardados en Vercel Blob a Supabase (lo mismo que hace cada día la tarea
// programada api/migrar-blob.js). Solo funciona cuando Vercel desbloquee el almacén Blob. No borra nada.
//
//   node --env-file=.env.local scripts/migrar-blob-a-supabase.mjs [--force]
//
// Necesita en .env.local: BLOB_READ_WRITE_TOKEN, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// --force vuelve a correrla aunque ya figure como completada (no duplica personas ni PDF).
import { createSupabaseStorage } from '../server/storage.js'
import { migrateFromBlob } from '../server/migracionBlob.js'

const storage = await createSupabaseStorage({
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_BUCKET || 'hv-sanithelp',
})

console.log(await migrateFromBlob(storage, { force: process.argv.includes('--force') }))
