// La constancia de inducción se llena en otra pestaña; se comparte con la pestaña
// principal a través del localStorage del mismo origen, bajo el id de registro de cada persona.
const CONSTANCIA_KEY = 'sanithelp-induction-constancia'

const INDUCTION_DRAFT_KEY = 'sanithelp-induction-draft'

function constanciaKey(sessionId) {
  return `${CONSTANCIA_KEY}:${sessionId}`
}

function inductionDraftKey(sessionId) {
  return `${INDUCTION_DRAFT_KEY}:${sessionId}`
}

// Lo que la persona va llenando en la constancia (respuestas y firma), para que una recarga no lo borre.
export function readInductionDraft(sessionId) {
  try {
    return JSON.parse(localStorage.getItem(inductionDraftKey(sessionId)) || 'null')
  } catch {
    return null
  }
}

export function writeInductionDraft(sessionId, draft) {
  try {
    localStorage.setItem(inductionDraftKey(sessionId), JSON.stringify(draft))
  } catch {
    // Sin almacenamiento el borrador solo vive en esta pestaña.
  }
}

export function clearInductionDraft(sessionId) {
  try {
    localStorage.removeItem(inductionDraftKey(sessionId))
  } catch {
    // Sin acceso al almacenamiento no hay nada que limpiar.
  }
}

export function getConstanciaPageUrl(sessionId) {
  return `/?constancia=1&registro=${encodeURIComponent(sessionId)}`
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function base64ToBlob(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: 'application/pdf' })
}

export async function saveConstancia(sessionId, { blob, answers, createdAt }) {
  const record = {
    name: [answers.firstName, answers.lastName].filter(Boolean).join(' '),
    idNumber: answers.idNumber,
    email: answers.email,
    createdAt,
    pdfBase64: await blobToBase64(blob),
  }
  try {
    localStorage.setItem(constanciaKey(sessionId), JSON.stringify(record))
  } catch {
    throw new Error('No se pudo guardar la constancia en este navegador.')
  }
}

export function readConstancia(sessionId) {
  try {
    const record = JSON.parse(localStorage.getItem(constanciaKey(sessionId)) || 'null')
    if (!record?.pdfBase64) return null
    const { pdfBase64, ...data } = record
    return { ...data, blob: base64ToBlob(pdfBase64) }
  } catch {
    return null
  }
}

export function clearConstancia(sessionId) {
  try {
    localStorage.removeItem(constanciaKey(sessionId))
    localStorage.removeItem(inductionDraftKey(sessionId))
    // Constancia de versiones anteriores, sin registro.
    localStorage.removeItem(CONSTANCIA_KEY)
  } catch {
    // Sin acceso al almacenamiento no hay nada que limpiar.
  }
}

export function subscribeConstancia(sessionId, callback) {
  const handleStorage = (event) => {
    if (event.key === null || event.key === constanciaKey(sessionId)) callback(readConstancia(sessionId))
  }
  // Safari en iPhone/iPad suspende la pestaña mientras la persona firma en la otra y puede no avisar
  // del cambio: al volver a ella se lee de nuevo.
  const handleVisible = () => {
    if (document.visibilityState === 'visible') callback(readConstancia(sessionId))
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener('pageshow', handleVisible)
  document.addEventListener('visibilitychange', handleVisible)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('pageshow', handleVisible)
    document.removeEventListener('visibilitychange', handleVisible)
  }
}
