// Base de datos no relacional de respuestas: un documento JSON con una colección, un documento por
// persona desde que guarda la sección 1 (procesoCompleto indica si ya terminó). Cada participante recibe un _id consecutivo ("01", "02", ...) y su
// resultadoId es el id del resultado, así cada documento queda ligado a su PDF de respuesta.
// Estas funciones son puras: el almacenamiento (archivos locales o Supabase) lo maneja storage.js.
export const EMPTY_RESPUESTAS = { ultimoId: 0, respuestas: [] }

export function formatParticipantId(number) {
  return String(number).padStart(2, '0')
}

// Acepta también el formato antiguo (solo un arreglo). Guarda el último número asignado para no
// repetirlo aunque se borre un participante.
export function normalizeRespuestas(contents) {
  const respuestas = Array.isArray(contents) ? contents : contents?.respuestas || []
  const highestId = Math.max(0, ...respuestas.map((document) => Number(document._id) || 0))
  return { ultimoId: Math.max(Number(contents?.ultimoId) || 0, highestId), respuestas }
}

// Si el resultado ya tenía documento conserva su número; si no, toma el siguiente.
export function upsertRespuesta(contents, data) {
  const database = normalizeRespuestas(contents)
  const existing = database.respuestas.find((document) => document.resultadoId === data.resultadoId)
  const ultimoId = existing ? database.ultimoId : database.ultimoId + 1
  const document = { _id: existing?._id || formatParticipantId(ultimoId), ...data }
  const respuestas = [...database.respuestas.filter((entry) => entry !== existing), document]
    .sort((first, second) => Number(first._id) - Number(second._id))
  return { data: { ultimoId, respuestas }, result: document }
}

export function removeRespuesta(contents, resultadoId) {
  const database = normalizeRespuestas(contents)
  const respuestas = database.respuestas.filter((document) => document.resultadoId !== resultadoId)
  return { data: { ultimoId: database.ultimoId, respuestas }, result: respuestas.length !== database.respuestas.length }
}

export const clean = (value) => (typeof value === 'string' ? value.trim().slice(0, 200) : '')
const status = (value) => (value === 'Completado' ? 'Completado' : 'Pendiente')

// Estado del pre-test y pos-test de cada política de Inducción general (sin puntaje).
export function cleanEvaluaciones(evaluaciones) {
  if (!Array.isArray(evaluaciones)) return []
  return evaluaciones.slice(0, 20).map((evaluacion) => ({
    codigo: clean(evaluacion?.codigo),
    politica: clean(evaluacion?.politica),
    pre: status(evaluacion?.pre),
    pos: status(evaluacion?.pos),
  }))
}

// Constancia de que la persona terminó todos los test; la firma no se guarda aquí.
export function cleanConstanciaEvaluaciones(constancia) {
  if (constancia?.firmada !== true) return { firmada: false }
  const fecha = new Date(constancia.fecha)
  return {
    firmada: true,
    cedula: clean(constancia.cedula),
    cargo: clean(constancia.cargo),
    fecha: Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString(),
  }
}

// Datos de contacto (nombre, apellido, teléfono, correo y empresa) y estado de las evaluaciones.
export function toRespuestaData(person) {
  const contact = person.contact || {}
  return {
    resultadoId: person.id,
    nombre: clean(contact.nombre),
    apellido: clean(contact.apellido),
    telefono: clean(contact.telefono),
    correo: clean(contact.correo) || clean(person.email),
    empresa: clean(contact.empresa),
    evaluaciones: cleanEvaluaciones(person.evaluaciones),
    constanciaEvaluaciones: cleanConstanciaEvaluaciones(person.constanciaEvaluaciones),
    procesoCompleto: person.completo !== false,
    pasos: person.pasos || {},
    actualizadoEn: person.updatedAt || person.createdAt,
    completadoEn: person.completo !== false ? person.updatedAt || person.createdAt : null,
    pdfUrl: `/api/people/${encodeURIComponent(person.id)}/pdf`,
  }
}

// Combina las respuestas que quedaron en Vercel Blob (anteriores) con las ya guardadas en Supabase.
// Las anteriores conservan su número; las nuevas se renumeran a continuación, en el mismo orden, para
// que no se repita ningún _id. Si una persona está en ambas, vale la versión nueva con el número anterior.
export function mergeRespuestas(currentContents, legacyContents) {
  const current = normalizeRespuestas(currentContents)
  const legacy = normalizeRespuestas(legacyContents)
  const currentById = new Map(current.respuestas.map((document) => [document.resultadoId, document]))
  const legacyIds = new Set(legacy.respuestas.map((document) => document.resultadoId))

  let ultimoId = legacy.ultimoId
  const kept = legacy.respuestas.map((document) => ({ ...(currentById.get(document.resultadoId) || document), _id: document._id }))
  const added = current.respuestas
    .filter((document) => !legacyIds.has(document.resultadoId))
    .map((document) => {
      ultimoId += 1
      return { ...document, _id: formatParticipantId(ultimoId) }
    })
  const respuestas = [...kept, ...added].sort((first, second) => Number(first._id) - Number(second._id))
  return { data: { ultimoId, respuestas }, result: { anteriores: kept.length, nuevas: added.length } }
}
