import { CLAVE, cabecerasAcceso, crearLimitador, ipDe, mensajeFallo } from './_acceso.js';

const limitador = crearLimitador();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST(request) {
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido */ }

  const ip = ipDe(request);
  const minutos = limitador.bloqueo(ip);
  if (minutos) return Response.json({ error: `Demasiados intentos. Espera ${minutos} min.` }, { status: 429 });

  if (String(cuerpo.clave || '') !== CLAVE) {
    await dormir(800);
    const quedan = limitador.fallo(ip);
    return Response.json({ error: mensajeFallo(quedan, 'Clave incorrecta.') }, { status: quedan ? 401 : 429 });
  }

  limitador.exito(ip);
  return Response.json({ ok: true }, { headers: await cabecerasAcceso() });
}
