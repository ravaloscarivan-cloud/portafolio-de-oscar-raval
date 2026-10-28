import { createHmac, timingSafeEqual } from 'node:crypto';

const DURACION_MS = 12 * 60 * 60 * 1000; // la sesión de administrador dura 12 horas

const secreto = () => {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error('Falta la variable de entorno ADMIN_SECRET');
  return s;
};

const firmar = (texto) => createHmac('sha256', secreto()).update(texto).digest('base64url');

const iguales = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function verificarContrasena(contrasena) {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) throw new Error('Falta la variable de entorno ADMIN_PASSWORD');
  return iguales(contrasena ?? '', esperada);
}

export function crearToken() {
  const expira = String(Date.now() + DURACION_MS);
  return `${expira}.${firmar(expira)}`;
}

function tokenValido(token) {
  const [expira, firma] = String(token ?? '').split('.');
  if (!expira || !firma || Number(expira) < Date.now()) return false;
  return iguales(firma, firmar(expira));
}

/** Responde 401 y devuelve false si la petición no trae un token de administrador válido. */
export function exigirAdmin(req, res) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (tokenValido(token)) return true;
  res.status(401).json({ error: 'Sesión de administrador no válida o vencida' });
  return false;
}

/** Lee el cuerpo JSON tanto en Vercel como en Express. */
export function leerCuerpo(req) {
  const body = req.body ?? {};
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body || '{}');
  } catch {
    return null;
  }
}
