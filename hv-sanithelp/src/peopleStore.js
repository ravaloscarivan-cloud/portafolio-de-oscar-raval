// Comunicación con la API de resultados (server/api.js).
// Ver, descargar o borrar resultados exige la clave de Resultados, que se valida en el servidor.
export class AccessDeniedError extends Error {
  constructor(message = 'Clave incorrecta. Intenta de nuevo.') {
    super(message)
  }
}

let configPromise
export function getApiConfig() {
  configPromise ||= fetch('/api/config')
    .then((response) => (response.ok ? response.json() : { pdfUpload: 'inline' }))
    .catch(() => ({ pdfUpload: 'inline' }))
  return configPromise
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

// El servidor responde { error } con el motivo; si no, se usa el mensaje general.
export async function ensureOk(response, message) {
  if (response.ok) return response
  const detail = await response.json().then((body) => body?.error, () => '')
  if (response.status === 401) throw new AccessDeniedError(detail === 'Clave incorrecta.' ? undefined : detail || undefined)
  throw new Error(response.status < 500 && detail ? detail : message)
}

// Sube el PDF de respuesta de la persona id. En producción va directo a Supabase (bucket privado) con
// una URL firmada, porque las funciones de Vercel no aceptan cuerpos de más de 4,5 MB, y devuelve
// undefined. En desarrollo devuelve el PDF en base64 para enviarlo junto con la solicitud.
export async function uploadResultPdf(id, pdfBlob) {
  const { pdfUpload } = await getApiConfig()
  if (pdfUpload !== 'signed') return blobToBase64(pdfBlob)
  const urlResponse = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  await ensureOk(urlResponse, 'No se pudo preparar la subida del PDF.')
  const { signedUrl } = await urlResponse.json()
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: pdfBlob,
  })
  await ensureOk(uploadResponse, 'No se pudo subir el PDF.')
  return undefined
}

// Registra el resultado de la persona a medida que avanza y al terminar.
export async function savePerson({ pdfBlob, ...person }) {
  try {
    const pdfBase64 = await uploadResultPdf(person.id, pdfBlob)
    const response = await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, pdfBase64 }),
    })
    await ensureOk(response, 'No se pudo guardar el resultado.')
    return await response.json()
  } catch (primaryError) {
    const config = await getApiConfig()
    if (!config.backupEnabled) throw primaryError

    const uploadId = crypto.randomUUID()
    const chunkSize = 2 * 1024 * 1024
    const totalChunks = Math.ceil(pdfBlob.size / chunkSize)
    for (let index = 0; index < totalChunks; index += 1) {
      const chunkBase64 = await blobToBase64(pdfBlob.slice(index * chunkSize, Math.min((index + 1) * chunkSize, pdfBlob.size)))
      const response = await fetch('/api/people?firebaseBackup=pdf-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: person.id, uploadId, index, chunkBase64 }),
      })
      await ensureOk(response, 'No se pudo guardar el respaldo del PDF en Firebase.')
    }
    const response = await fetch('/api/people?firebaseBackup=response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, uploadId, totalBytes: pdfBlob.size, totalChunks }),
    })
    await ensureOk(response, 'No se pudo guardar la respuesta en Firebase.')

    const backupError = new Error('La respuesta quedó respaldada en Firebase; Supabase se reintentará cuando vuelva a estar disponible.')
    backupError.firebaseBackedUp = true
    throw backupError
  }
}

export async function getPeopleDatabase(accessKey) {
  const response = await fetch('/api/people', { headers: { 'x-access-key': accessKey } })
  await ensureOk(response, 'No se pudieron cargar los resultados guardados.')
  return response.json()
}

// Acceso del administrador: { email } sin código o { email, token } si entró con código al correo.
export function adminAuthHeaders(credential) {
  return credential.token ? { Authorization: `Bearer ${credential.token}` } : { 'x-admin-email': credential.email }
}

// Encabezado de acceso al PDF: la clave de Resultados o, con admin, el acceso del administrador.
const pdfHeaders = (accessKey, admin) => (admin ? adminAuthHeaders(accessKey) : { 'x-access-key': accessKey })

async function getPersonPdf(person, accessKey, admin) {
  const response = await fetch(person.pdfUrl, { headers: pdfHeaders(accessKey, admin) })
  await ensureOk(response, 'No se pudo cargar el PDF guardado.')
  return response.blob()
}

// Dirección para ver o descargar el PDF. En producción es un enlace temporal de Supabase con el tamaño
// del archivo: el visor lo pide directo y por partes, sin pasar el archivo por el servidor. En
// desarrollo es un blob: local (local: true, hay que liberarlo con URL.revokeObjectURL).
export async function getPersonPdfUrl(person, accessKey, downloadName, admin = false) {
  const query = downloadName ? `?download=${encodeURIComponent(downloadName)}` : ''
  const response = await fetch(`/api/people/${encodeURIComponent(person.id)}/pdf-url${query}`, {
    headers: pdfHeaders(accessKey, admin),
  })
  await ensureOk(response, 'No se pudo cargar el PDF guardado.')
  const { url, size } = await response.json()
  if (url) return { url, size, local: false }
  return { url: URL.createObjectURL(await getPersonPdf(person, accessKey, admin)), local: true }
}

export async function deletePerson(personId, accessKey) {
  const response = await fetch(`/api/people/${encodeURIComponent(personId)}`, {
    method: 'DELETE',
    headers: { 'x-access-key': accessKey },
  })
  await ensureOk(response, 'No se pudo eliminar el resultado guardado.')
}
