import { check, db } from './db.js';

// Cierre del proceso de ingreso: cuando una persona (por su documento) tiene el formato de hoja de vida,
// el envío de HV y soportes y la inducción terminada, se le envía el manual a su correo una sola vez.
// El correo sale por Resend (RESEND_API_KEY y MAIL_FROM); el manual es el archivo publicado en MANUAL_URL.

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.MANUAL_URL);
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendManual(to, name) {
  const first = String(name || '').split(/\s+/)[0] || '';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: 'MOVID · Tu manual de ingreso',
      html: `<p>Hola ${escapeHtml(first)},</p>
        <p>Terminaste tu proceso de ingreso en MOVID: hoja de vida, soportes e inducción. Te enviamos el manual adjunto para que lo tengas siempre a la mano.</p>
        <p>Si tienes preguntas, comunícate con Gestión Humana.</p>
        <p>MOVID IPS S.A.S.</p>`,
      attachments: [{ path: process.env.MANUAL_URL, filename: process.env.MANUAL_FILENAME || 'Manual_MOVID.pdf' }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}: ${await response.text()}`);
}

// Nunca hace fallar la solicitud que la origina
export async function checkCompletion(document) {
  if (!document) return;
  try {
    const induccion = check(await db().from('induccion').select('nombre, email, manual_enviado_at').eq('documento', document).maybeSingle());
    if (!induccion || induccion.manual_enviado_at) return;
    const registros = check(await db().from('registros').select('kind, data').in('kind', ['hoja-vida', 'soportes'])
      .eq('data->>document', document));
    const hv = registros.find((row) => row.kind === 'hoja-vida');
    if (!hv || !registros.some((row) => row.kind === 'soportes')) return;
    const email = hv.data.email || induccion.email;
    if (!email || !mailConfigured()) {
      console.warn('Proceso completo sin envío del manual:', !email ? 'la persona no tiene correo' : 'el correo no está configurado');
      return;
    }
    await sendManual(email, hv.data.name || induccion.nombre);
    check(await db().from('induccion').update({ manual_enviado_at: new Date().toISOString(), manual_email: email }).eq('documento', document));
  } catch (error) {
    console.error('No se pudo revisar el cierre del proceso o enviar el manual.', error);
  }
}
