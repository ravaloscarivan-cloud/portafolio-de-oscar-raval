// Punto de entrada de las funciones de Vercel (carpeta api/): API con Supabase (tabla y bucket privado).
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET (opcional,
// por defecto hv-sanithelp), RESULTS_ACCESS_KEY, ADMIN_EMAILS (correos de la sección Administrador, separados por comas), ADMIN_CODIGO_CORREO=si
// (Administrador pide un código enviado al correo) y, para la migración desde Vercel Blob,
// BLOB_READ_WRITE_TOKEN y CRON_SECRET.
import { handleApi } from './api.js'
import { createFirebaseBackup } from './firebaseBackup.js'
import { createSupabaseStorage } from './storage.js'
import { parseAdminEmails } from './adminApi.js'

let storagePromise
const backupStorage = createFirebaseBackup({
  databaseUrl: process.env.FIREBASE_DATABASE_URL,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
})

// Todas las rutas /api/admin/... llegan a una sola función (api/admin/entrada.js, ver vercel.json) con la
// ruta original en __ruta: se reconstruye para que server/api.js la atienda como siempre.
async function restoreAdminPath(request) {
  const url = new URL(request.url)
  const ruta = url.searchParams.get('__ruta')
  if (ruta === null) return request
  url.searchParams.delete('__ruta')
  url.pathname = `/api/admin/${ruta.replace(/^\/+/, '')}`
  const hasBody = !['GET', 'HEAD'].includes(request.method)
  return new Request(url, { method: request.method, headers: request.headers, body: hasBody ? await request.arrayBuffer() : undefined })
}

export async function handle(incoming) {
  const request = await restoreAdminPath(incoming)
  storagePromise ||= createSupabaseStorage({
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_BUCKET || 'hv-sanithelp',
  })
  return handleApi(request, { storage: await storagePromise, backupStorage, accessKey: process.env.RESULTS_ACCESS_KEY, admin: { emails: parseAdminEmails(process.env.ADMIN_EMAILS), code: process.env.ADMIN_CODIGO_CORREO === 'si' }, cronSecret: process.env.CRON_SECRET })
}
