// Pulido de productos en Shopify después de empujarlos desde DSers.
// - GET  /api/tienda?desde=ISO     → productos creados desde esa fecha que aún no se pulieron.
// - POST /api/tienda { id }        → reescribe título, descripción, tipo, URL, SEO y opciones de un producto.
// Cada producto pulido queda con la etiqueta "pulido-ia" para no repetirlo.
import { graphql, revisar } from './_shopify.js';
import { redactar } from './_redactor.js';
import { sinPermiso } from './_db.js';

const ETIQUETA = 'pulido-ia';
const MARCA = process.env.TIENDA_MARCA || 'PHRstore';

// Nombres de opciones de AliExpress → español. Fijo para no depender de la IA (que puede confundirlos).
const OPCIONES = {
  color: 'Color', colour: 'Color', size: 'Talla', 'shoe size': 'Talla', 'ships from': 'Enviado desde',
  style: 'Estilo', material: 'Material', 'plug type': 'Tipo de enchufe', length: 'Longitud', model: 'Modelo',
  quantity: 'Cantidad', capacity: 'Capacidad', type: 'Tipo', pattern: 'Diseño', specification: 'Especificación',
  package: 'Paquete', voltage: 'Voltaje', power: 'Potencia', width: 'Ancho', height: 'Alto', weight: 'Peso',
  'metal color': 'Color del metal', 'lens color': 'Color del lente', 'cable length': 'Largo del cable',
  'emitting color': 'Color de luz', 'axis body': 'Switch', 'switch type': 'Switch', version: 'Versión',
  bundle: 'Paquete', 'color name': 'Color', 'ring size': 'Talla del anillo', 'band width': 'Ancho de banda',
};

const error = (mensaje, status = 500) => Response.json({ error: mensaje }, { status });

export async function GET(request) {
  const rechazo = await sinPermiso(request);
  if (rechazo) return rechazo;
  try {
    const desde = new Date(new URL(request.url).searchParams.get('desde') || Date.now() - 86400000);
    if (Number.isNaN(desde.getTime())) return error('Fecha "desde" inválida.', 400);
    const productos = [];
    let cursor = null;
    do {
      const d = await graphql(`query ($q: String!, $cursor: String) {
        products(first: 100, after: $cursor, query: $q, sortKey: CREATED_AT) {
          nodes { id title tags createdAt featuredMedia { preview { image { url(transform: { maxWidth: 120 }) } } } }
          pageInfo { hasNextPage endCursor }
        }
      }`, { q: `created_at:>='${desde.toISOString()}'`, cursor });
      productos.push(...d.products.nodes);
      cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
    } while (cursor && productos.length < 500);
    return Response.json({
      productos: productos
        .filter((p) => !p.tags.includes(ETIQUETA))
        .map((p) => ({ id: p.id, titulo: p.title, creado: p.createdAt, imagen: p.featuredMedia?.preview?.image?.url || '' })),
    });
  } catch (err) {
    return error(err.message);
  }
}

export async function POST(request) {
  const rechazo = await sinPermiso(request);
  if (rechazo) return rechazo;
  let cuerpo = {};
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido */ }
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(String(cuerpo.id || ''))) return error('Producto inválido.', 400);

  try {
    const { product: p } = await graphql(`query ($id: ID!) {
      product(id: $id) {
        id title handle descriptionHtml productType vendor tags
        options { id name optionValues { name } }
        media(first: 3) { nodes { ... on MediaImage { image { url(transform: { maxWidth: 1000 }) } } } }
        variants(first: 1) { nodes { price } }
      }
    }`, { id: cuerpo.id });
    if (!p) return error('El producto ya no existe en la tienda.', 404);

    const t = await redactar({
      ...p,
      imagenes: p.media.nodes.map((m) => m.image?.url).filter(Boolean),
      precio: p.variants.nodes[0]?.price,
    });

    const cambios = {
      id: p.id,
      title: t.titulo,
      descriptionHtml: t.descripcionHtml,
      productType: t.tipo,
      vendor: MARCA,
      handle: t.handle || undefined,
      seo: t.seo,
      tags: [...new Set([...p.tags, ...t.etiquetas, ETIQUETA])],
    };
    const actualizar = (producto) => graphql(`mutation ($producto: ProductUpdateInput!) {
      productUpdate(product: $producto) { product { id handle } userErrors { field message } }
    }`, { producto });
    let r = (await actualizar(cambios)).productUpdate;
    if (r.userErrors.some((e) => String(e.field).includes('handle'))) {
      // URL ocupada por otro producto: se conserva la que puso DSers.
      delete cambios.handle;
      r = (await actualizar(cambios)).productUpdate;
    }
    revisar(r, 'No se pudo actualizar el producto');

    // Nombres de opciones en español (Size → Talla...). Los valores no se tocan para no romper el mapeo de DSers.
    const opcionesCambiadas = [];
    for (const o of p.options) {
      // Primero el diccionario fijo; la IA solo se usa para nombres que no están en él.
      const clave = o.name.trim().toLowerCase();
      const nuevo = OPCIONES[clave]
        ?? (/[áéíóúñ]/i.test(o.name) ? null : t.opciones.find((x) => x.original.trim().toLowerCase() === clave)?.traducido?.trim());
      if (!nuevo || nuevo === o.name) continue;
      const ro = await graphql(`mutation ($productId: ID!, $option: OptionUpdateInput!) {
        productOptionUpdate(productId: $productId, option: $option) { userErrors { field message } }
      }`, { productId: p.id, option: { id: o.id, name: nuevo } });
      if (!ro.productOptionUpdate.userErrors.length) opcionesCambiadas.push(`${o.name} → ${nuevo}`);
    }

    return Response.json({
      ok: true,
      id: p.id,
      antes: p.title,
      titulo: t.titulo,
      tipo: t.tipo,
      handle: r.product?.handle || p.handle,
      opciones: opcionesCambiadas,
    });
  } catch (err) {
    return error(err.message);
  }
}
