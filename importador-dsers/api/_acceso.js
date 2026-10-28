// Acceso por clave con tokens firmados de corta duración.
export const CLAVE = process.env.CLAVE_ACCESO || '2007';
// Código del invitado (lo comparte el admin). Si no está configurado, el acceso de invitado queda apagado.
export const CLAVE_INVITADO = process.env.CLAVE_INVITADO || '';
export const SECRETO = process.env.AUTH_SECRET || `dsers-importador:${CLAVE}`;

// dsers_pase: abre la página una sola vez (se borra al usarse, así cada recarga pide la clave).
// dsers_recursos: deja cargar los archivos de /assets durante un minuto.
export const COOKIE_PASE = 'dsers_pase';
export const COOKIE_RECURSOS = 'dsers_recursos';
export const SESION_MS = 2 * 60 * 1000;
// dsers_api: deja usar las funciones /api (pulido, actividad, monitor) mientras la página está abierta.
// Se renueva cada vez que se abre la página con un pase válido y lleva la misma identidad del pase.
export const COOKIE_API = 'dsers_api';
export const SESION_API_MS = 12 * 60 * 60 * 1000;

const enc = new TextEncoder();
let claveHmac = null;

async function firmar(texto) {
  claveHmac ||= await crypto.subtle.importKey('raw', enc.encode(SECRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', claveHmac, enc.encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Quién entró: el admin (clave) o un invitado con su nombre. sid identifica cada inicio de sesión.
export const ADMIN = { rol: 'admin', nombre: 'Administrador' };

function aBase64Url(texto) {
  let binario = '';
  for (const b of enc.encode(texto)) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto) {
  const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

// Token: <datos en base64url>.<firma HMAC>; los datos llevan vencimiento, rol, nombre y sid.
export async function crearToken(duracionMs = SESION_MS, identidad = ADMIN) {
  const datos = aBase64Url(JSON.stringify({
    exp: Date.now() + duracionMs,
    rol: identidad.rol,
    nombre: identidad.nombre,
    sid: identidad.sid || crypto.randomUUID(),
  }));
  return `${datos}.${await firmar(datos)}`;
}

// Devuelve los datos del token ({ exp, rol, nombre, sid }) si es válido y su rol está en `roles`, o null.
// El pase de espera del invitado (rol 'espera') solo sirve para consultar su solicitud, nunca como sesión.
export async function tokenValido(token, roles = ['admin', 'invitado']) {
  const [datos, firma] = String(token || '').split('.');
  if (!datos || !firma) return null;
  const esperada = await firmar(datos);
  if (esperada.length !== firma.length) return null;
  let dif = 0;
  for (let i = 0; i < firma.length; i++) dif |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  if (dif !== 0) return null;
  try {
    const sesion = JSON.parse(deBase64Url(datos));
    return Number(sesion.exp) > Date.now() && roles.includes(sesion.rol) ? sesion : null;
  } catch {
    return null;
  }
}

export function leerCookie(request, nombre) {
  const cookies = request.headers.get('cookie') || '';
  return cookies.split(/;\s*/).find((c) => c.startsWith(`${nombre}=`))?.slice(nombre.length + 1);
}

// Cada pestaña guarda su propio token y lo envía en esta cabecera: así el admin y un invitado pueden estar
// abiertos en el mismo navegador sin pisarse (la cookie dsers_api es una sola por navegador y queda de respaldo).
export const CABECERA_TOKEN = 'x-prh-token';
// dsers_tab: entrega el token a la pestaña que se acaba de abrir (la página lo lee una vez y lo borra).
export const COOKIE_TAB = 'dsers_tab';

export function tokenDe(request) {
  return request.headers.get(CABECERA_TOKEN) || leerCookie(request, COOKIE_API);
}

// Identidad de quien llama a una función /api (cabecera de la pestaña o cookie dsers_api), o null.
export function sesionDe(request) {
  return tokenValido(tokenDe(request));
}

// Cookies que abren la página tras un acceso correcto (clave o invitado).
export async function cabecerasAcceso(identidad = ADMIN) {
  const token = await crearToken(SESION_MS, { ...identidad, sid: identidad.sid || crypto.randomUUID() });
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', `${COOKIE_PASE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=30`);
  headers.append('Set-Cookie', `${COOKIE_RECURSOS}=${token}; Path=/assets; HttpOnly; Secure; SameSite=Strict; Max-Age=60`);
  return headers;
}

// Límite de intentos fallidos por IP (por instancia del servidor).
const MAX_FALLOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;

export function crearLimitador() {
  const fallos = new Map();
  return {
    // Minutos de bloqueo restantes, o 0 si puede intentar.
    bloqueo(ip) {
      const r = fallos.get(ip);
      return r && r.hasta > Date.now() ? Math.ceil((r.hasta - Date.now()) / 60000) : 0;
    },
    // Registra un fallo y devuelve cuántos intentos quedan.
    fallo(ip) {
      const r = fallos.get(ip);
      const n = (r && r.hasta === 0 ? r.n : 0) + 1;
      fallos.set(ip, { n, hasta: n >= MAX_FALLOS ? Date.now() + BLOQUEO_MS : 0 });
      return Math.max(MAX_FALLOS - n, 0);
    },
    exito(ip) { fallos.delete(ip); },
  };
}

export function ipDe(request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconocida';
}

export function mensajeFallo(quedan, texto) {
  return quedan > 0 ? `${texto} Te quedan ${quedan} intento(s).` : 'Demasiados intentos. Espera 10 min.';
}
