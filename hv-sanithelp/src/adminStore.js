// Comunicación con la API del administrador (server/adminApi.js): ver, agregar, editar y borrar
// respuestas. credential es { email } o, si se entra con código al correo, { email, token }; el servidor
// revisa que el correo esté en la lista de administradores.
import { adminAuthHeaders, blobToBase64, ensureOk, getApiConfig, getPersonPdfUrl, uploadResultPdf } from './peopleStore'

const adminHeaders = (credential) => ({ 'Content-Type': 'application/json', ...adminAuthHeaders(credential) })

async function postJson(path, body, message) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  await ensureOk(response, message)
  return response.json()
}

// Supabase envía un código al correo, si es de un administrador.
export async function requestAdminCode(email) {
  await postJson('/api/admin/codigo', { email }, 'No se pudo enviar el código.')
}

// Devuelve el token de la sesión de administrador (1 hora).
export async function verifyAdminCode(email, codigo) {
  return (await postJson('/api/admin/verificar', { email, codigo }, 'No se pudo verificar el código.')).token
}

export async function getAdminRecords(credential) {
  const response = await fetch('/api/admin/respuestas', { headers: adminHeaders(credential) })
  await ensureOk(response, 'No se pudieron cargar las respuestas.')
  return response.json()
}

// Agrega (isNew) o edita la respuesta id. pdfFile (opcional) reemplaza el PDF de respuesta.
export async function saveAdminRecord(credential, { id, respuesta, pdfFile, isNew, documentos }) {
  const pdfBase64 = pdfFile ? await uploadResultPdf(id, pdfFile) : undefined
  const response = await fetch(isNew ? '/api/admin/respuestas' : `/api/admin/respuestas/${encodeURIComponent(id)}`, {
    method: isNew ? 'POST' : 'PUT',
    headers: adminHeaders(credential),
    body: JSON.stringify({ id, respuesta, pdfBase64, documentos }),
  })
  await ensureOk(response, 'No se pudo guardar la respuesta.')
  return response.json()
}

export async function deleteAdminRecord(credential, id) {
  const response = await fetch(`/api/admin/respuestas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(credential),
  })
  await ensureOk(response, 'No se pudo eliminar la respuesta.')
}

// Reemplaza el PDF de respuesta id por pdfBlob (editado en el visor). El servidor guarda antes una copia
// del PDF actual; en producción devuelve una URL firmada y el PDF se sube directo a Supabase.
export async function replaceAdminPdf(credential, id, pdfBlob) {
  const signed = (await getApiConfig()).pdfUpload === 'signed'
  const response = await fetch(`/api/admin/respuestas/${encodeURIComponent(id)}/pdf`, {
    method: 'POST',
    headers: adminHeaders(credential),
    body: JSON.stringify({ pdfBase64: signed ? undefined : await blobToBase64(pdfBlob) }),
  })
  await ensureOk(response, 'No se pudo guardar el PDF.')
  const { signedUrl } = await response.json()
  if (!signedUrl) return
  const upload = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: pdfBlob,
  })
  await ensureOk(upload, 'No se pudo subir el PDF editado.')
}

// Bytes del PDF de respuesta actual, o null si la persona aún no tiene PDF.
export async function readAdminPdf(credential, id) {
  let link
  try {
    link = await getPersonPdfUrl({ id, pdfUrl: `/api/people/${encodeURIComponent(id)}/pdf` }, credential, undefined, true)
  } catch (error) {
    if (/no encontrado/i.test(error.message)) return null
    throw error
  }
  const bytes = await (await fetch(link.url)).arrayBuffer()
  if (link.local) URL.revokeObjectURL(link.url)
  return bytes
}

// Nuevo orden de las respuestas (ids de resultado): el servidor las renumera 01, 02, 03...
export async function reorderAdminRecords(credential, ids) {
  const response = await fetch('/api/admin/orden', {
    method: 'POST',
    headers: adminHeaders(credential),
    body: JSON.stringify({ ids }),
  })
  await ensureOk(response, 'No se pudo guardar el nuevo orden.')
  return response.json()
}
