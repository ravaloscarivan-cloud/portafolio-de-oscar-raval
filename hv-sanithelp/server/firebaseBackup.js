import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
const TOKEN_LIFETIME_SECONDS = 3600
const TOKEN_REFRESH_MARGIN_MS = 60_000
// Cada cadena de RTDB tiene un máximo de 10 MB. Fragmentamos el PDF en valores más pequeños.
const PDF_CHUNK_BYTES = 4 * 1024 * 1024

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

export function createFirebaseBackup({ databaseUrl, clientEmail, privateKey }) {
  const configured = [databaseUrl, clientEmail, privateKey].filter(Boolean).length
  if (configured === 0) return null
  if (configured !== 3) {
    throw new Error('El respaldo Firebase requiere FIREBASE_DATABASE_URL, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.')
  }

  const databaseRoot = databaseUrl.replace(/\/+$/, '')
  const signingKey = privateKey.startsWith('base64:')
    ? Buffer.from(privateKey.slice('base64:'.length), 'base64').toString('utf8')
    : privateKey.replace(/\\n/g, '\n')
  let cachedToken
  let tokenExpiresAt = 0

  async function accessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) return cachedToken

    const issuedAt = Math.floor(Date.now() / 1000)
    const header = encode({ alg: 'RS256', typ: 'JWT' })
    const claims = encode({
      iss: clientEmail,
      scope: TOKEN_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    })
    const unsigned = `${header}.${claims}`
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    signer.end()
    const assertion = `${unsigned}.${signer.sign(signingKey, 'base64url')}`

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
    const token = await response.json().catch(() => ({}))
    if (!response.ok || !token.access_token) {
      throw new Error(`No se pudo autenticar el respaldo Firebase (${response.status}).`)
    }
    cachedToken = token.access_token
    tokenExpiresAt = Date.now() + Number(token.expires_in || TOKEN_LIFETIME_SECONDS) * 1000
    return cachedToken
  }

  return {
    kind: 'firebase-realtime-database',

    async savePdfChunk({ id, uploadId, index, chunkBase64 }) {
      const response = await fetch(`${databaseRoot}/respuestasPdf/${encodeURIComponent(id)}/${encodeURIComponent(uploadId)}/${index}.json?print=silent`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunkBase64),
      })
      if (!response.ok) {
        throw new Error(`No se pudo guardar un fragmento de PDF en Firebase (${response.status}).`)
      }
    },

    async saveResponse({ id, person, answer, pdfBytes, pdfReference, backedUpAt }) {
      let pdf
      if (pdfReference) {
        pdf = { encoding: 'base64-chunks', ...pdfReference }
      } else {
        const bytes = Buffer.from(pdfBytes)
        if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
          throw new Error('El respaldo Firebase recibió un PDF no válido.')
        }
        const pdfBase64 = bytes.toString('base64')
        const chunkLength = Math.floor(PDF_CHUNK_BYTES / 3) * 4
        const chunks = []
        for (let offset = 0; offset < pdfBase64.length; offset += chunkLength) {
          chunks.push(pdfBase64.slice(offset, offset + chunkLength))
        }
        pdf = { encoding: 'base64', bytes: bytes.length, chunks }
      }

      const response = await fetch(`${databaseRoot}/respuestas/${encodeURIComponent(id)}.json?print=silent`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          backedUpAt,
          person,
          answer,
          pdf,
        }),
      })
      if (!response.ok) {
        throw new Error(`No se pudo guardar la copia en Firebase Realtime Database (${response.status}).`)
      }
    },
  }
}
