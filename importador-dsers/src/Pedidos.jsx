// Sección Pedidos (admin y quien colabora con él por invitación).
// - usePedidos: consulta cada 30 s los pedidos de la tienda que faltan por despachar (Shopify). El contador del
//   menú sale de aquí, y cada compra nueva le llega al admin como notificación (la registra api/pedidos.js).
// - Realizar pedidos: la extensión entra a DSers y compra al proveedor en AliExpress todos los pedidos
//   pendientes (salta los que tienen avisos: sin stock, sin proveedor, dirección incompleta…). El pago al
//   proveedor lo hace la persona en AliExpress; después DSers manda el número de seguimiento a la tienda.
import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Download, ExternalLink, PackageCheck, ShoppingCart, TriangleAlert } from 'lucide-react';

const URL_PEDIDOS = 'https://www.dsers.com/application/orders/159831080';
const CONSULTA_MS = 30000;

export function usePedidos(activo) {
  const [datos, setDatos] = useState({ pendientes: 0, pedidos: [], error: '', cargado: false });
  const consultarRef = useRef(() => {});
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    const consultar = async () => {
      try {
        const r = await fetch('/api/pedidos', { cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (!vivo) return null;
        if (r.ok) setDatos({ pendientes: d.pendientes, pedidos: d.pedidos, error: '', cargado: true });
        else setDatos((x) => ({ ...x, error: d.error || 'No se pudieron leer los pedidos.', cargado: true }));
        return r.ok ? d : null;
      } catch { return null; /* sin conexión: se reintenta */ }
    };
    consultarRef.current = consultar;
    consultar();
    const id = setInterval(consultar, CONSULTA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [activo]);
  // recargar() devuelve { pendientes, pedidos } recién leídos de la tienda (o null si no se pudo).
  return { ...datos, recargar: () => consultarRef.current() };
}

const fecha = (ts) => new Date(ts).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dinero = (n, moneda) => `${moneda === 'USD' ? 'US$' : moneda === 'COP' ? '$' : `${moneda} `}${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
const PAGO = { PAID: 'Pagado', PENDING: 'Pago pendiente', AUTHORIZED: 'Autorizado', PARTIALLY_PAID: 'Pago parcial', REFUNDED: 'Reembolsado', PARTIALLY_REFUNDED: 'Reembolso parcial', VOIDED: 'Anulado' };

const VERSION_MINIMA = [2, 1, 0];
const versionVieja = (v) => {
  const partes = String(v || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((partes[i] || 0) !== VERSION_MINIMA[i]) return (partes[i] || 0) < VERSION_MINIMA[i];
  return false;
};
const MENSAJE_VIEJA = 'La extensión de Chrome está desactualizada: descarga la nueva (botón de arriba), reemplaza la carpeta, pulsa ↻ en chrome://extensions y recarga esta página.';

export function SeccionPedidos({ pedidos, enviar, extension, versionExt, descargarExtension, importando }) {
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, titulo, detalle: [] }

  async function realizar() {
    if (trabajando) return;
    setTrabajando(true);
    setResultado(null);
    try {
      // 1. Revisar si alguien compró: se leen los pedidos de la tienda en este momento.
      const actual = await pedidos.recargar();
      if (actual && !actual.pendientes) {
        setResultado({ ok: true, vacio: true, titulo: 'No hay pedidos', detalle: ['Nadie ha comprado todavía o ya están todos despachados.'] });
        return;
      }
      if (!bloqueo && !confirm(`Hay ${actual ? actual.pendientes : 'nuevos'} pedido(s). ¿Realizarlos en DSers? Se compran al proveedor en AliExpress y quedan listos para pagar.`)) return;
      if (bloqueo) {
        setResultado({ ok: false, titulo: `Hay ${actual?.pendientes ?? ''} pedido(s) por despachar`, detalle: [bloqueo] });
        return;
      }
      // 2. Realizarlos en DSers.
      const r = await enviar({ tipo: 'pedidos', modo: 'ordenar', config: { url: URL_PEDIDOS, saltarErrores: true, maxPedidos: 200 } });
      if (r?.error && /message port closed|could not establish|receiving end/i.test(r.error)) r.error = MENSAJE_VIEJA;
      if (r?.ok) {
        const n = r.ordenados ?? r.elegidos?.length ?? 0;
        setResultado({
          ok: true,
          titulo: n ? `${n} pedido(s) realizados en DSers` : 'No había pedidos para realizar en DSers',
          detalle: [
            n ? 'Ahora págalos al proveedor en AliExpress (DSers → «Awaiting payment»).' : '',
            ...(r.saltados || []).filter((x) => x.motivo !== 'límite por ronda').map((x) => `${x.numero}: no se realizó (${x.motivo})`),
          ].filter(Boolean),
        });
        pedidos.recargar();
      } else {
        setResultado({ ok: false, titulo: 'No se pudieron realizar los pedidos', detalle: [r?.error || 'Actualiza la extensión de Chrome (versión 2.1.0) y recarga esta página.'] });
      }
    } finally {
      setTrabajando(false);
    }
  }

  const bloqueo = !extension ? 'Para realizar pedidos se necesita la extensión de Chrome en este PC (ver Importador).'
    : importando ? 'Espera a que termine la importación.' : '';

  return (
    <main className="invitados">
      <section className="card pedidos-cabeza">
        <div className="pedidos-resumen">
          <div className="pedidos-total">
            <ShoppingCart size={22} />
            <div>
              <b>{pedidos.cargado ? pedidos.pendientes : '…'}</b>
              <span>{pedidos.pendientes === 1 ? 'pedido por despachar' : 'pedidos por despachar'}</span>
            </div>
          </div>
          <button className="boton-realizar" onClick={realizar} disabled={trabajando}>
            <PackageCheck size={18} /> {trabajando ? 'Revisando y realizando…' : 'Realizar pedidos'}
          </button>
        </div>
        {extension && versionExt !== null && versionVieja(versionExt) && (
          <div className="resultado fallo">
            <TriangleAlert size={20} />
            <div>
              <b>Actualiza la extensión de Chrome para realizar pedidos</b>
              <small>Tienes la versión {versionExt || 'antigua'}; se necesita la 2.1.0 o más nueva. Descárgala, descomprímela encima de la carpeta anterior, pulsa ↻ en chrome://extensions y recarga esta página.</small>
              <button className="sec" onClick={descargarExtension}><Download size={15} /> Descargar extensión</button>
            </div>
          </div>
        )}
        {bloqueo && <p className="muted">{bloqueo}</p>}
        {trabajando && <p className="muted">El bot está trabajando en una pestaña de DSers; no la cierres.</p>}
        {resultado && (
          <div className={`resultado ${resultado.ok ? 'exito' : 'fallo'}${resultado.vacio ? ' vacio' : ''}`}>
            {resultado.ok ? <CircleCheck size={20} /> : <TriangleAlert size={20} />}
            <div>
              <b>{resultado.titulo}</b>
              {resultado.detalle.map((d, i) => <small key={i}>{d}</small>)}
            </div>
          </div>
        )}
        <a className="enlace-dsers" href={URL_PEDIDOS} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Ver pedidos en DSers</a>
      </section>

      <section className="card">
        <h2>Pedidos de la tienda</h2>
        {pedidos.error ? (
          <p className="estado-error">{pedidos.error}</p>
        ) : !pedidos.cargado ? (
          <p className="muted">Cargando pedidos…</p>
        ) : pedidos.pedidos.length === 0 ? (
          <p className="muted">No hay pedidos por despachar. Cuando alguien compre en la tienda aparecerá aquí y te llegará la notificación.</p>
        ) : (
          <ul className="lista-pedidos">
            {pedidos.pedidos.map((p) => (
              <li key={p.id}>
                <div className="pedido-cabeza">
                  <b>{p.numero}</b>
                  <span className="muted">{fecha(p.fecha)}</span>
                  <span className={`pago ${p.pago === 'PAID' ? 'pagado' : ''}`}>{PAGO[p.pago] || p.pago}</span>
                  <b className="pedido-total">{dinero(p.total, p.moneda)}</b>
                </div>
                <div className="pedido-productos">
                  {p.productos.map((x, i) => (
                    <div key={i} className="pedido-producto">
                      {x.imagen ? <img src={x.imagen} alt="" /> : <span className="sin-imagen" />}
                      <span>{x.titulo}</span>
                      <small>× {x.cantidad}</small>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
