import { createHash } from 'node:crypto';

// Avisos en vivo para la campana del admin con Supabase Realtime (Broadcast): no se guardan en la base de datos.
// El canal se deriva de la clave de Usuario, así que solo quien la conoce sabe a qué canal escuchar.
export function liveTopic() {
  return 'movid-admin-' + createHash('sha256').update('movid-live:' + (process.env.RESPONSES_PASSWORD || '')).digest('hex').slice(0, 32);
}

// Clave pública del proyecto (anon o publishable): solo se entrega al admin con su clave
export function liveConfig() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key || !process.env.SUPABASE_URL || !process.env.RESPONSES_PASSWORD) return null;
  return { url: process.env.SUPABASE_URL, key, topic: liveTopic() };
}

// Código de la pestaña del visitante (cabecera X-Visitante), para ponerle nombre a sus visitas
export function visitorId(request) {
  const value = request.headers['x-visitante'];
  return typeof value === 'string' && /^[0-9a-f]{8}$/.test(value) ? value : '';
}

// Cuando la persona se identifica (envío o HV), su nombre reemplaza "Visitante" en su registro de visita
export async function nameVisitor(db, session, name) {
  if (!session || !name) return;
  const { error } = await db().from('visitas').update({ nombre: name }).eq('sesion', session);
  if (error) console.error('No se pudo poner el nombre al visitante.', error);
}

// Nunca hace fallar la solicitud que lo origina: si el aviso no sale, solo se registra
export async function broadcast(payload) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.SUPABASE_URL || !process.env.RESPONSES_PASSWORD) return;
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: liveTopic(), event: 'actividad', payload: { ...payload, at: new Date().toISOString() } }] }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) console.error('Supabase Realtime rechazó un aviso en vivo.', response.status);
  } catch (error) {
    console.error('No se pudo enviar un aviso en vivo.', error);
  }
}
