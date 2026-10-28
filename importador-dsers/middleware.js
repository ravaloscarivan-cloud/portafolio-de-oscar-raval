// Routing Middleware de Vercel: la página solo se abre con un pase válido, que se borra al usarse.
// Así cada recarga, pestaña nueva o link compartido vuelve a la pantalla de clave.
import { next } from '@vercel/functions';
import {
  COOKIE_API, COOKIE_PASE, COOKIE_RECURSOS, COOKIE_TAB, SESION_API_MS, crearToken, leerCookie, tokenDe, tokenValido,
} from './api/_acceso.js';

export const config = {
  matcher: ['/((?!login\\.html|api/login|api/invitado).*)'],
};

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith('/assets/')) {
    if (await tokenValido(leerCookie(request, COOKIE_RECURSOS))) return next();
    return new Response('No autorizado', { status: 401 });
  }

  // Funciones /api (pulido, actividad, monitor): requieren la sesión de la página abierta.
  if (pathname.startsWith('/api/')) {
    if (await tokenValido(tokenDe(request))) return next();
    return Response.json({ error: 'Sesión vencida: recarga la página e ingresa de nuevo.' }, { status: 401 });
  }

  const pase = await tokenValido(leerCookie(request, COOKIE_PASE));
  if (pase) {
    // La cookie de /api lleva la misma identidad (admin o invitado) y el mismo sid que el pase.
    const identidad = { rol: pase.rol, nombre: pase.nombre, sid: pase.sid };
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', `${COOKIE_PASE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    const token = await crearToken(SESION_API_MS, identidad);
    headers.append('Set-Cookie', `${COOKIE_API}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESION_API_MS / 1000}`);
    // Token propio de esta pestaña (lo lee la página y lo manda en cada llamada a /api).
    headers.append('Set-Cookie', `${COOKIE_TAB}=${token}; Path=/; Secure; SameSite=Strict; Max-Age=60`);
    return next({ headers });
  }
  return Response.redirect(new URL('/login.html', request.url), 302);
}
