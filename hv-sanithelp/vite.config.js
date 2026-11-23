import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { handleApi } from './server/api.js'
import { createFirebaseBackup } from './server/firebaseBackup.js'
import { createFsStorage } from './server/storage.js'
import { parseAdminEmails } from './server/adminApi.js'

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url))
const MAX_BODY_BYTES = 300 * 1024 * 1024

// En desarrollo la misma API de producción (server/api.js) guarda en data/ en lugar de Supabase.
// La clave de Resultados se toma de RESULTS_ACCESS_KEY (.env.local, que no se sube al repositorio).
// Sin ella, en local se usa una clave de desarrollo que no sirve en producción.
// Correos de Administrador: ADMIN_EMAILS (separados por comas); si no se define, los de DEV_ADMIN_EMAILS.
// En local se entra sin código: el código al correo solo funciona con Supabase (producción).
const DEV_ACCESS_KEY = 'clave-local'
const DEV_ADMIN_EMAILS = 'ravaloscarivan@gmail.com, gestionhumana@biosteeldecolombia.com'

function localApiPlugin(accessKey, adminEmails, backupStorage) {
  const storage = createFsStorage(resolve(workspaceRoot, 'data'))

  return {
    name: 'local-results-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()

        const chunks = []
        let size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > MAX_BODY_BYTES) {
            response.statusCode = 413
            response.end('Request too large')
            return
          }
          chunks.push(chunk)
        }

        const headers = new Headers()
        for (const [name, value] of Object.entries(request.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        const hasBody = !['GET', 'HEAD'].includes(request.method)
        const apiResponse = await handleApi(
          new Request(url, { method: request.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }),
          { storage, backupStorage, accessKey, admin: { emails: adminEmails, code: false } },
        )

        response.statusCode = apiResponse.status
        apiResponse.headers.forEach((value, name) => response.setHeader(name, value))
        response.end(Buffer.from(await apiResponse.arrayBuffer()))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '')
  const backupStorage = createFirebaseBackup({
    databaseUrl: env.FIREBASE_DATABASE_URL,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY,
  })
  return {
    plugins: [react(), localApiPlugin(env.RESULTS_ACCESS_KEY || DEV_ACCESS_KEY, parseAdminEmails(env.ADMIN_EMAILS || DEV_ADMIN_EMAILS), backupStorage)],
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
  }
})
