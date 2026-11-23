// Almacenamiento de resultados con la misma interfaz en desarrollo y en producción:
// - createFsStorage: archivos en data/ (npm run dev).
// - createSupabaseStorage: Supabase (producción): tabla documentos y bucket privado. Nada queda con
//   URL pública.
// Interfaz: readJson, update (lectura-modificación-escritura sin pisar cambios), savePdf, hasPdf,
// readPdf, deletePdf, backupPdf (copia en respaldos/ antes de que el administrador reemplace un PDF)
// y createPdfUploadUrl en Supabase.
import { access, copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export function createFsStorage(dataDir) {
  // Las escrituras se encadenan para que dos guardados seguidos no se pisen.
  let queue = Promise.resolve()
  const jsonPath = (name) => resolve(dataDir, name)
  const pdfPath = (id) => resolve(dataDir, 'pdfs', `${id}.pdf`)

  async function readJson(name, fallback) {
    try {
      return JSON.parse(await readFile(jsonPath(name), 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return fallback
      throw error
    }
  }

  return {
    kind: 'fs',
    readJson,

    update(name, fallback, change) {
      const task = queue.then(async () => {
        const { data, result } = change(await readJson(name, fallback))
        const path = jsonPath(name)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
        await rename(`${path}.tmp`, path)
        return result
      })
      queue = task.catch(() => {})
      return task
    },

    async savePdf(id, bytes) {
      await mkdir(resolve(dataDir, 'pdfs'), { recursive: true })
      await writeFile(pdfPath(id), bytes)
    },

    async hasPdf(id) {
      return access(pdfPath(id)).then(() => true, () => false)
    },

    async readPdf(id) {
      try {
        const bytes = await readFile(pdfPath(id))
        return { body: bytes, size: bytes.length }
      } catch (error) {
        if (error.code === 'ENOENT') return null
        throw error
      }
    },

    async deletePdf(id) {
      await unlink(pdfPath(id)).catch((error) => {
        if (error.code !== 'ENOENT') throw error
      })
    },

    async backupPdf(id) {
      const target = resolve(dataDir, 'respaldos', `${id}-${backupStamp()}.pdf`)
      await mkdir(dirname(target), { recursive: true })
      await copyFile(pdfPath(id), target)
    },
  }
}

// 2026-10-09T14-05-33 (sin dos puntos, para que sirva como nombre de archivo).
const backupStamp = () => new Date().toISOString().slice(0, 19).replace(/:/g, '-')

// Tabla de Postgres (Supabase) que guarda cada base JSON (personas.json, respuestas.json) como una fila.
// version permite escrituras condicionales: se actualiza solo si nadie guardó desde la lectura.
const DOCUMENTS_TABLE = 'documentos'
const UNIQUE_VIOLATION = '23505'

export async function createSupabaseStorage({ url, serviceKey, bucket }) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const files = supabase.storage.from(bucket)
  const authClient = () => createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const pdfPath = (id) => `pdfs/${id}.pdf`

  async function readJsonWithVersion(name, fallback) {
    const { data, error } = await supabase.from(DOCUMENTS_TABLE).select('datos, version').eq('nombre', name).maybeSingle()
    if (error) throw new Error(`No se pudo leer ${name}: ${error.message}`)
    return data ? { data: data.datos, version: data.version } : { data: fallback, version: null }
  }

  // Intenta escribir; devuelve false si otra persona guardó al mismo tiempo (hay que reintentar).
  async function writeJson(name, data, version) {
    if (version === null) {
      const { error } = await supabase.from(DOCUMENTS_TABLE).insert({ nombre: name, datos: data, version: 1 })
      if (error?.code === UNIQUE_VIOLATION) return false
      if (error) throw new Error(`No se pudo guardar ${name}: ${error.message}`)
      return true
    }
    const { data: rows, error } = await supabase.from(DOCUMENTS_TABLE)
      .update({ datos: data, version: version + 1, actualizado_en: new Date().toISOString() })
      .eq('nombre', name)
      .eq('version', version)
      .select('nombre')
    if (error) throw new Error(`No se pudo guardar ${name}: ${error.message}`)
    return rows.length > 0
  }

  async function signedPdfUrl(id, filename) {
    const { data, error } = await files.createSignedUrl(pdfPath(id), 600, filename ? { download: filename } : undefined)
    if (error) {
      if (error.status === 400 || error.statusCode === '404' || /not.?found/i.test(error.message)) return null
      throw new Error(`No se pudo preparar el PDF: ${error.message}`)
    }
    return data.signedUrl
  }

  // Tamaño en bytes del PDF, o null si no existe. El visor lo necesita para pedir el PDF por partes.
  async function pdfSize(id) {
    // exists() responde 400 cuando el archivo no está, así que se busca por nombre en la carpeta.
    const { data, error } = await files.list('pdfs', { search: `${id}.pdf`, limit: 100 })
    if (error) throw new Error(`No se pudo consultar el PDF: ${error.message}`)
    const file = data.find((entry) => entry.name === `${id}.pdf`)
    return file ? Number(file.metadata?.size) || 0 : null
  }

  return {
    kind: 'supabase',

    async readJson(name, fallback) {
      return (await readJsonWithVersion(name, fallback)).data
    },

    // Escritura condicional (version): si otra persona guardó al mismo tiempo, se vuelve a leer y se
    // reintenta, así nunca se repite un número de participante ni se pierde un registro.
    async update(name, fallback, change) {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const { data, version } = await readJsonWithVersion(name, fallback)
        const { data: next, result } = change(data)
        if (await writeJson(name, next, version)) return result
        await new Promise((wait) => setTimeout(wait, 150 * (attempt + 1) * Math.random() + 50))
      }
      throw new Error(`No se pudo actualizar ${name}: demasiados guardados simultáneos.`)
    },

    async savePdf(id, bytes) {
      const { error } = await files.upload(pdfPath(id), bytes, { contentType: 'application/pdf', upsert: true })
      if (error) throw new Error(`No se pudo guardar el PDF: ${error.message}`)
    },

    async hasPdf(id) {
      return (await pdfSize(id)) !== null
    },

    pdfSize,

    // Se lee con un enlace firmado: download() puede entregar la versión anterior (en caché hasta una hora)
    // después de que el administrador reemplaza el PDF. Además así el PDF pasa sin cargarse completo en memoria.
    async readPdf(id) {
      const url = await signedPdfUrl(id)
      if (!url) return null
      const response = await fetch(url)
      if (response.status === 404 || response.status === 400) return null
      if (!response.ok) throw new Error(`No se pudo leer el PDF (${response.status}).`)
      return { body: response.body, size: Number(response.headers.get('content-length')) || (await pdfSize(id)) }
    },

    async deletePdf(id) {
      const { error } = await files.remove([pdfPath(id)])
      if (error) throw new Error(`No se pudo borrar el PDF: ${error.message}`)
    },

    // Copia del PDF actual en respaldos/<id>-<fecha>.pdf antes de que el administrador lo reemplace.
    async backupPdf(id) {
      const { error } = await files.copy(pdfPath(id), `respaldos/${id}-${backupStamp()}.pdf`)
      if (error) throw new Error(`No se pudo guardar la copia del PDF: ${error.message}`)
    },

    // Código de verificación del administrador (Supabase Auth). Cada llamada usa un cliente propio:
    // la sesión que abre verifyOtp no debe reemplazar a la clave de servicio de este cliente.
    async sendLoginCode(email) {
      const { error } = await authClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (!error) return
      if (error.status === 429) throw new Error('Se enviaron demasiados códigos. Espera unos minutos e intenta de nuevo.')
      throw new Error(`No se pudo enviar el código: ${error.message}`)
    },

    // Devuelve el token de sesión si el código es correcto, o null si es incorrecto o venció.
    async verifyLoginCode(email, code) {
      const { data, error } = await authClient().auth.verifyOtp({ email, token: code, type: 'email' })
      return error || !data.session ? null : data.session.access_token
    },

    async emailFromLoginToken(token) {
      const { data, error } = await authClient().auth.getUser(token)
      return error ? null : data.user?.email || null
    },

    // URL firmada (válida 10 minutos) para que el navegador vea o descargue el PDF directo de Supabase,
    // sin pasar el archivo completo por la función de Vercel. Con filename se descarga con ese nombre.
    createPdfDownloadUrl: signedPdfUrl,

    // URL firmada (válida 2 horas) para que el navegador suba el PDF directo a Supabase: las funciones
    // de Vercel no aceptan cuerpos de más de 4,5 MB.
    async createPdfUploadUrl(id) {
      const { data, error } = await files.createSignedUploadUrl(pdfPath(id), { upsert: true })
      if (error) throw new Error(`No se pudo preparar la subida del PDF: ${error.message}`)
      return data.signedUrl
    },
  }
}
