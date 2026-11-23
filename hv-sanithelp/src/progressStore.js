// Avance de cada persona (HV, soportes) guardado en este navegador bajo un id de registro.
// Así una recarga no borra lo hecho y la constancia queda ligada al mismo registro.
const SESSION_KEY = 'sanithelp-session-id'
const DATABASE_NAME = 'sanithelp-progress'
const STORE_NAME = 'drafts'
const PENDING_STORE_NAME = 'pending-results'

export function getSessionId() {
  try {
    const current = localStorage.getItem(SESSION_KEY)
    if (current) return current
    const created = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function startNewSession() {
  const created = crypto.randomUUID()
  try {
    localStorage.setItem(SESSION_KEY, created)
  } catch {
    // Sin almacenamiento el registro solo vive en esta pestaña.
  }
  return created
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'sessionId' })
      }
      if (!database.objectStoreNames.contains(PENDING_STORE_NAME)) {
        database.createObjectStore(PENDING_STORE_NAME, { keyPath: 'sessionId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runTransaction(mode, action) {
  return runStoreTransaction(STORE_NAME, mode, action)
}

async function runStoreTransaction(storeName, mode, action) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    transaction.oncomplete = () => {
      database.close()
      resolve(request?.result)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

export async function readDraft(sessionId) {
  return (await runTransaction('readonly', (store) => store.get(sessionId))) || null
}

export function writeDraft(sessionId, draft) {
  return runTransaction('readwrite', (store) => store.put({ ...draft, sessionId }))
}

export function deleteDraft(sessionId) {
  return runTransaction('readwrite', (store) => store.delete(sessionId))
}

// Copia independiente del borrador: incluye el PDF final y el registro listo para reenviar.
export function writePendingResult(sessionId, result) {
  return runStoreTransaction(PENDING_STORE_NAME, 'readwrite', (store) => store.put({
    ...result,
    sessionId,
    queueId: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  }))
}

export async function readPendingResults() {
  return (await runStoreTransaction(PENDING_STORE_NAME, 'readonly', (store) => store.getAll())) || []
}

// Evita borrar una copia más nueva si se actualizó mientras otra se estaba enviando.
export async function deletePendingResult(sessionId, queueId) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(PENDING_STORE_NAME)
    const request = store.get(sessionId)
    request.onsuccess = () => {
      if (request.result?.queueId === queueId) store.delete(sessionId)
    }
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}
