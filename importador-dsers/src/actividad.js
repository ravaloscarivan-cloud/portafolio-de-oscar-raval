// Conexión del invitado con el admin (api/actividad.js):
// - latido cada 4 s con lo mínimo (sección e importación en curso) → punto verde para el admin.
// - mientras el admin lo ve en tiempo real, latido cada 1,5 s con el detalle de su pantalla.
// - la respuesta trae las órdenes del admin ({ tipo: 'detener' | 'mensaje' }) o { tipo: 'fuera' } si lo sacó,
//   y en cada latido { tipo: 'estado', invitacion, colaborando } (invitación del admin y lista compartida).
// - al cerrar la página se avisa la salida → punto rojo.
const LATIDO_MS = 4000;
const LATIDO_OBSERVADO_MS = 1500;

let activo = false;
let observado = false;
let obtenerEstado = () => ({});
let alRecibir = () => {};
let temporizador = 0;

async function latido() {
  if (!activo) return;
  clearTimeout(temporizador);
  try {
    const r = await fetch('/api/actividad', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: obtenerEstado(observado) }),
    });
    if (r.status === 401) return alRecibir({ tipo: 'fuera', motivo: 'vencida' });
    const d = await r.json();
    if (d.fuera) return alRecibir({ tipo: 'fuera', motivo: d.fuera });
    // Si el admin acaba de empezar a verlo, el detalle se envía enseguida.
    const empezo = d.observado && !observado;
    observado = !!d.observado;
    for (const orden of d.ordenes || []) alRecibir(orden);
    // Invitación del admin pendiente de respuesta y si comparte la lista de links con él.
    alRecibir({ tipo: 'estado', invitacion: d.invitacion || null, colaborando: !!d.colaborando });
    if (empezo) return latido();
  } catch { /* sin conexión: se reintenta */ }
  if (activo) temporizador = setTimeout(latido, observado ? LATIDO_OBSERVADO_MS : LATIDO_MS);
}

// getEstado(detallado): lo mínimo, o también el detalle de la pantalla si el admin lo está viendo.
export function iniciarConexion(getEstado, onOrden) {
  if (activo) return;
  activo = true;
  obtenerEstado = getEstado;
  alRecibir = (orden) => {
    if (orden.tipo === 'fuera') activo = false;
    onOrden(orden);
  };
  latido();
  // fetch con keepalive (no sendBeacon) para que lleve el token de esta pestaña.
  const salir = () => activo && fetch('/api/actividad', {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salida: true }),
  }).catch(() => {});
  window.addEventListener('pagehide', salir);
  // Al volver a la pestaña, avisa enseguida (en segundo plano el navegador espacia los latidos).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) estadoCambio(); });
}

// Un cambio importante se envía pronto, sin esperar al siguiente latido.
export function estadoCambio() {
  if (!activo) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(latido, 800);
}

// Acepta o rechaza la invitación del admin para colaborar.
export async function responderInvitacion(id, acepta) {
  const r = await fetch('/api/actividad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitacion: id, acepta }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo responder.');
  estadoCambio();
  return d;
}

export function avisarSalida() {
  if (!activo) return Promise.resolve();
  activo = false;
  clearTimeout(temporizador);
  return fetch('/api/actividad', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salida: true }),
    keepalive: true,
  }).catch(() => {});
}
