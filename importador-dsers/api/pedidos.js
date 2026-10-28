// Pedidos de la tienda (Shopify) que faltan por despachar, para la sección Pedidos (admin y quien colabora con él).
// GET /api/pedidos → { pendientes, pedidos: [{ id, numero, fecha, total, moneda, pago, productos: [{ titulo, cantidad, imagen }] }] }
// Cada compra nueva queda registrada una vez como aviso «compra» (le llega al admin en la campana con sonido).
import { sesionDe } from './_acceso.js';
import { graphql } from './_shopify.js';
import { accesoSala, prepararTablas, registrar, sql } from './_db.js';

const cabeceras = { 'Cache-Control': 'no-store' };
// Sesión fija a la que se asocian los avisos de compras (no es una persona: no sale en Invitados).
const SID_TIENDA = '00000000-0000-4000-8000-00000000c0de';

let ultimaConsulta = { cuando: 0, datos: null }; // la tienda se consulta como mucho cada 20 s por instancia

async function consultarShopify() {
  if (Date.now() - ultimaConsulta.cuando < 20000 && ultimaConsulta.datos) return ultimaConsulta.datos;
  const d = await graphql(`query {
    orders(first: 40, sortKey: CREATED_AT, reverse: true, query: "status:open AND fulfillment_status:unfulfilled") {
      nodes {
        id name createdAt displayFinancialStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 6) { nodes { title quantity image { url(transform: { maxWidth: 96 }) } } }
      }
    }
  }`);
  const pedidos = d.orders.nodes.map((o) => ({
    id: o.id,
    numero: o.name,
    fecha: o.createdAt,
    total: Number(o.totalPriceSet?.shopMoney?.amount || 0),
    moneda: o.totalPriceSet?.shopMoney?.currencyCode || '',
    pago: o.displayFinancialStatus,
    productos: o.lineItems.nodes.map((l) => ({ titulo: l.title, cantidad: l.quantity, imagen: l.image?.url || '' })),
  }));
  ultimaConsulta = { cuando: Date.now(), datos: pedidos };
  return pedidos;
}

// Registra como aviso las compras que no se habían visto (la primera vez solo las marca, sin avisar).
async function avisarNuevas(pedidos) {
  await sql.query(`create table if not exists prh_pedidos_vistos (id text primary key, visto timestamptz not null default now())`);
  const [{ hay }] = await sql.query('select exists (select 1 from prh_pedidos_vistos) as hay');
  const nuevos = await sql.query(
    `insert into prh_pedidos_vistos (id) select unnest($1::text[]) on conflict (id) do nothing returning id`,
    [pedidos.map((p) => p.id)],
  );
  if (!hay || !nuevos.length) return;
  await sql.query(
    `insert into prh_sesiones (sid, rol, nombre, acceso, activo) values ($1, 'tienda', 'Tienda', 'tienda', false) on conflict (sid) do nothing`,
    [SID_TIENDA],
  );
  const ids = new Set(nuevos.map((n) => n.id));
  for (const p of pedidos.filter((x) => ids.has(x.id)).reverse()) {
    const productos = p.productos.map((x) => x.titulo).join(', ').slice(0, 120);
    await registrar(SID_TIENDA, 'compra', `Nueva compra ${p.numero} · ${p.moneda} ${p.total.toFixed(2)} · ${productos}`);
  }
}

export async function GET(request) {
  const sesion = await sesionDe(request);
  if (!sesion) return Response.json({ error: 'Sin sesión.' }, { status: 401 });
  if (sesion.rol !== 'admin' && !(await accesoSala(sesion))) return Response.json({ error: 'Solo el administrador.' }, { status: 403 });
  try {
    const pedidos = await consultarShopify();
    if (sql) {
      await prepararTablas();
      await avisarNuevas(pedidos).catch(() => {});
    }
    return Response.json({ pendientes: pedidos.length, pedidos }, { headers: cabeceras });
  } catch (err) {
    const permiso = /access denied|read_orders|scope/i.test(err.message);
    return Response.json({
      error: permiso ? 'La app de Shopify no tiene permiso para leer pedidos (read_orders). Actívalo en la app del Dev Dashboard y reinstálala.' : err.message,
    }, { status: 502, headers: cabeceras });
  }
}
