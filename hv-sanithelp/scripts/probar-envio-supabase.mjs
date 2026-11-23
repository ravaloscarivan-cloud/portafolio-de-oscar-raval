// Prueba temporal del flujo de envío usado en producción. Crea un registro sintético,
// verifica su PDF y respuesta en Supabase y elimina ese mismo registro al terminar.
// Uso: node --env-file=.env.local scripts/probar-envio-supabase.mjs
import { randomUUID } from 'node:crypto'
import { handle } from '../server/vercel.js'
import { deletePersonResult } from '../server/api.js'
import { createSupabaseStorage } from '../server/storage.js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')

const id = `codex-test-${randomUUID().replaceAll('-', '').slice(0, 16)}`
const storage = await createSupabaseStorage({
  url,
  serviceKey,
  bucket: process.env.SUPABASE_BUCKET || 'hv-sanithelp',
})
const fakePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')
let didUpload = false

function jsonRequest(path, body) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

try {
  const config = await handle(new Request('http://localhost/api/config'))
  if (!config.ok || (await config.json()).pdfUpload !== 'signed') throw new Error('La API no está configurada para la carga firmada de PDF.')

  const uploadUrlResponse = await handle(jsonRequest('/api/upload', { id }))
  if (!uploadUrlResponse.ok) throw new Error(`La API de subida respondió ${uploadUrlResponse.status}.`)
  const { signedUrl } = await uploadUrlResponse.json()
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/pdf', 'x-upsert': 'true' },
    body: fakePdf,
  })
  if (!uploadResponse.ok) throw new Error(`Supabase Storage respondió ${uploadResponse.status} al subir el PDF.`)
  didUpload = true

  const person = {
    id,
    name: 'PRUEBA TÉCNICA (se elimina)',
    email: `codex-test-${id.slice(-8)}@example.com`,
    createdAt: new Date().toISOString(),
    completo: false,
    pasos: { hv: true, soportes: false, induccion: false, evaluaciones: false },
    contact: { nombre: 'PRUEBA TÉCNICA', apellido: 'ELIMINAR', correo: `codex-test-${id.slice(-8)}@example.com` },
    evaluations: [],
  }
  const saveResponse = await handle(jsonRequest('/api/people', { person }))
  if (saveResponse.status !== 201) {
    const body = await saveResponse.json().catch(() => ({}))
    throw new Error(`La API de envío respondió ${saveResponse.status}: ${body.error || 'sin detalle'}.`)
  }

  const [people, answers, pdfExists] = await Promise.all([
    storage.readJson('personas.json', []),
    storage.readJson('respuestas.json', { respuestas: [] }),
    storage.hasPdf(id),
  ])
  const personSaved = people.some((entry) => entry.id === id)
  const answerSaved = (Array.isArray(answers) ? answers : answers.respuestas || []).some((entry) => entry.resultadoId === id)
  if (!personSaved || !answerSaved || !pdfExists) throw new Error('El envío respondió bien, pero faltó verificar un dato guardado en Supabase.')

  console.log('Resultado: envío HTTP 201; persona guardada; respuesta guardada; PDF subido y verificado.')
} finally {
  const cleanup = await deletePersonResult(storage, id)
  if (cleanup.status !== 200) throw new Error(`No se pudo limpiar la prueba (${cleanup.status}).`)
  const { deleted } = await cleanup.json()
  if (didUpload && !deleted) throw new Error('El registro de prueba no quedó marcado para eliminar; revisar Supabase.')
  console.log('Limpieza: registro y PDF sintéticos eliminados.')
}
