// Cliente mínimo de la Admin API (GraphQL) de Shopify.
// Credenciales (variables de entorno en Vercel):
// - SHOPIFY_TIENDA: prhstore76.myshopify.com
// - SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET: app del Dev Dashboard instalada en la tienda
//   (el token se pide con "client credentials" y dura 24 h), o
// - SHOPIFY_TOKEN: token fijo shpat_... de una app personalizada antigua.
const TIENDA = (process.env.SHOPIFY_TIENDA || 'prhstore76.myshopify.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const VERSION_API = process.env.SHOPIFY_API_VERSION || '2026-07';

let tokenCache = null; // { valor, expira }

async function token() {
  if (process.env.SHOPIFY_TOKEN) return process.env.SHOPIFY_TOKEN;
  if (tokenCache && tokenCache.expira > Date.now()) return tokenCache.valor;
  const { SHOPIFY_CLIENT_ID: id, SHOPIFY_CLIENT_SECRET: secreto } = process.env;
  if (!id || !secreto) throw new Error('Faltan las credenciales de Shopify (SHOPIFY_CLIENT_ID y SHOPIFY_CLIENT_SECRET).');
  const r = await fetch(`https://${TIENDA}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secreto }),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || !datos.access_token) {
    throw new Error(`Shopify rechazó las credenciales (${r.status}${datos.error ? `: ${datos.error}` : ''}).`);
  }
  // Renovar 10 minutos antes de que venza.
  tokenCache = { valor: datos.access_token, expira: Date.now() + ((datos.expires_in || 86400) - 600) * 1000 };
  return tokenCache.valor;
}

export async function graphql(query, variables = {}, reintento = true) {
  try {
    return await consultar(query, variables);
  } catch (err) {
    // Si se le dieron permisos nuevos a la app, el token guardado aún no los tiene: se pide uno nuevo una vez.
    if (reintento && tokenCache && /access denied|scope/i.test(err.message)) {
      tokenCache = null;
      return graphql(query, variables, false);
    }
    throw err;
  }
}

async function consultar(query, variables) {
  const r = await fetch(`https://${TIENDA}/admin/api/${VERSION_API}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await token() },
    body: JSON.stringify({ query, variables }),
  });
  if (r.status === 401) tokenCache = null;
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || datos.errors) {
    const detalle = Array.isArray(datos.errors) ? datos.errors.map((e) => e.message).join('; ') : datos.errors || r.statusText;
    throw new Error(`Error de Shopify (${r.status}): ${detalle}`);
  }
  return datos.data;
}

// Lanza el primer userError de una mutación, si lo hay.
export function revisar(resultado, nombre) {
  const errores = resultado?.userErrors || [];
  if (errores.length) throw new Error(`${nombre}: ${errores.map((e) => e.message).join('; ')}`);
  return resultado;
}
