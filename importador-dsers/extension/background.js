// Motor de importación. Trabaja dentro de tu Chrome: abre DSers en una pestaña nueva de la
// misma ventana y pega cada link por DOM (no usa mouse ni teclado, puedes seguir usando el PC).

const DSERS_URL = 'https://www.dsers.com/application/import_list';
const ESPERA_ENTRE_LINKS_MS = 5000;

let estado = nuevoEstado();
let cancelar = false;
let pausado = false;
let tabApp = null;

function nuevoEstado() {
  return { corriendo: false, pausado: false, total: 0, actual: 0, resultados: [], log: [], empuje: null };
}

function log(msg) {
  estado.log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (estado.log.length > 500) estado.log.shift();
  emitir();
}

function emitir() {
  if (tabApp != null) chrome.tabs.sendMessage(tabApp, { tipo: 'estado', estado }).catch(() => {});
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// En pausa: espera (sin perder el lugar) hasta que se reanude o se detenga.
async function esperarSiPausado() {
  if (!pausado || cancelar) return;
  log('⏸ Importación en pausa.');
  while (pausado && !cancelar) await dormir(250);
  if (!cancelar) log('▶ Importación reanudada.');
}

async function esperarCarga(tabId, timeoutMs = 60000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await dormir(500);
  }
  throw new Error('DSers tardó demasiado en cargar.');
}

async function abrirPestanaDsers(windowId) {
  const tab = await chrome.tabs.create({ windowId, url: DSERS_URL, active: false });
  await esperarCarga(tab.id);
  return tab.id;
}

// Se ejecuta DENTRO de la página de DSers. Debe ser autocontenida.
async function importarEnPagina(link) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const selectores = [
    'input[placeholder*="DSers"]',
    'input[placeholder*="enlace" i]',
    'input[placeholder*="link" i]',
    'input[placeholder*="URL" i]',
    'input[placeholder*="aliexpress" i]',
  ];
  const buscarInput = () => {
    for (const s of selectores) {
      for (const el of document.querySelectorAll(s)) if (visible(el)) return el;
    }
    return null;
  };
  const esOk = (b) => /^\s*ok\s*$/i.test(b.textContent) && visible(b);

  let input = null;
  for (let i = 0; i < 40 && !input; i++) {
    input = buscarInput();
    if (!input) await dormir(500);
  }
  if (!input) {
    return {
      ok: false,
      error: /login|sign|register/i.test(location.href)
        ? 'DSers pide iniciar sesión en este Chrome.'
        : 'No encontré el campo para pegar el enlace en DSers.',
    };
  }

  // Escribir el valor como lo haría React (sin teclado).
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  input.focus();
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(input, link);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await dormir(400);

  // Botón OK más cercano al campo.
  let ok = null;
  for (let nodo = input.parentElement, i = 0; nodo && i < 8 && !ok; nodo = nodo.parentElement, i++) {
    ok = [...nodo.querySelectorAll('button')].find(esOk) || null;
  }
  ok = ok || [...document.querySelectorAll('button')].find(esOk);
  if (!ok) return { ok: false, error: 'No encontré el botón OK.' };
  if (ok.disabled) await dormir(800);
  ok.click();

  // Esperar a que DSers termine de procesar este link.
  const inicio = Date.now();
  await dormir(800);
  while (Date.now() - inicio < 30000) {
    const cargando = ok.isConnected && (ok.classList.contains('ant-btn-loading') || ok.querySelector('.anticon-loading'));
    const valor = input.isConnected ? input.value : '';
    if (!cargando && (valor !== link || Date.now() - inicio > 4000)) break;
    await dormir(500);
  }
  const aviso = document.querySelector('.ant-message-notice:last-child, .ant-notification-notice:last-child');
  return { ok: true, mensaje: aviso ? aviso.textContent.trim().slice(0, 200) : '' };
}

// Se ejecuta DENTRO de la lista de importación: marca los productos nuevos,
// pulsa PUSH TO STORE, espera el panel y pulsa EMPUJAR A LA TIENDA.
async function empujarEnPagina(ids, cantidad) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const texto = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const pasos = [];

  const clase = (el) => String((el.getAttribute && el.getAttribute('class')) || '');
  const enPanel = (el) => !!el.closest('.ant-modal, .ant-drawer, [role="dialog"]');
  const SEL_CAJA = 'input[type="checkbox"], [role="checkbox"], .ant-checkbox, [class*="checkbox" i]';

  // Casilla de una tarjeta: el input real si existe; si no, el elemento tipo checkbox más interno.
  const cajaDe = (nodo) => {
    const input = nodo.querySelector('input[type="checkbox"]');
    if (input) return input;
    const todas = [...nodo.querySelectorAll(SEL_CAJA)];
    return todas.length ? todas[todas.length - 1] : null;
  };
  const marcada = (caja) => {
    if (caja.tagName === 'INPUT') return caja.checked;
    if (caja.getAttribute('aria-checked') === 'true') return true;
    const envoltorio = caja.closest('[class*="checkbox" i]') || caja;
    return /checked/i.test(`${clase(caja)} ${clase(envoltorio)}`) || !!envoltorio.querySelector('[class*="checked" i]');
  };
  const pulsar = (el) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  };

  // Tarjetas de producto: se parte de cada texto "Cost $" y se sube hasta el contenedor
  // que tiene una casilla y una imagen, sin abarcar otra tarjeta.
  const PATRON_COSTO = /\bcost\b|\bcosto\b/i; // "Cost" y "$14.3" pueden ir en nodos separados
  const leerTarjetas = () => {
    const tarjetas = [];
    const vistos = new Set();
    const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (PATRON_COSTO.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
      let nodo = n.parentElement;
      if (!nodo || enPanel(nodo)) continue;
      for (let i = 0; nodo && i < 15; i++, nodo = nodo.parentElement) {
        if (nodo.querySelector(SEL_CAJA) && nodo.querySelector('img')) break;
      }
      if (!nodo || nodo === document.body || vistos.has(nodo)) continue;
      if ((texto(nodo).match(/cost\s*\$|costo/gi) || []).length > 1) continue; // abarca varias tarjetas
      const caja = cajaDe(nodo);
      if (!caja) continue;
      vistos.add(nodo);
      tarjetas.push({ caja, nodo });
    }
    return tarjetas;
  };
  const empujado = (t) => /pushed to|empujado a/i.test(texto(t.nodo));

  // Elemento pulsable cuyo texto coincide (botón real si lo hay).
  const buscarBoton = (raiz, patron, { fueraDePanel = false } = {}) => {
    const candidatos = [...raiz.querySelectorAll('button, [role="button"], a, div, span')]
      .filter((el) => texto(el).length < 40 && patron.test(texto(el)) && visible(el) && !(fueraDePanel && enPanel(el)));
    const el = candidatos.find((c) => !candidatos.some((o) => o !== c && c.contains(o))) || null;
    return el ? (el.closest('button, [role="button"], a') || el) : null;
  };

  // 1) Esperar a que aparezcan los nuevos: por ID de AliExpress, o los primeros N sin empujar.
  let tarjetas = [];
  let elegidas = [];
  let porId = false;
  const inicioBusqueda = Date.now();
  while (Date.now() - inicioBusqueda < 30000) {
    tarjetas = leerTarjetas();
    const conId = tarjetas.filter((t) => ids.some((id) => t.nodo.innerHTML.includes(id)));
    if (ids.length && conId.length >= cantidad) { elegidas = conId; porId = true; break; }
    const nuevas = tarjetas.filter((t) => !empujado(t)).slice(0, cantidad);
    if (nuevas.length >= cantidad && Date.now() - inicioBusqueda > 1200) { elegidas = nuevas; break; }
    await dormir(300);
  }
  if (!tarjetas.length) {
    const cajas = document.querySelectorAll(SEL_CAJA).length;
    return { ok: false, sinTarjetas: true, error: `No encontré los productos en la lista de importación (casillas en la página: ${cajas}).`, pasos };
  }
  if (!elegidas.length) elegidas = tarjetas.filter((t) => !empujado(t)).slice(0, cantidad);
  pasos.push(porId
    ? `Productos encontrados por ID: ${elegidas.length}`
    : `Productos nuevos tomados de arriba (sin empujar): ${elegidas.length} de ${tarjetas.length} en pantalla`);
  if (!elegidas.length) return { ok: false, error: 'No hay productos nuevos sin empujar.', pasos };

  // 2) Marcar solo esos (desmarcar el resto).
  for (const t of tarjetas) {
    const debe = elegidas.includes(t);
    if (marcada(t.caja) !== debe) { pulsar(t.caja); await dormir(60); }
  }
  await dormir(250);
  // Reintento por si la casilla real es el contenedor.
  for (const t of elegidas) {
    if (!marcada(t.caja)) {
      const alterno = t.caja.closest('label, [class*="checkbox" i]') || t.caja.parentElement;
      if (alterno) { pulsar(alterno); await dormir(60); }
    }
  }
  await dormir(500);
  const marcadas = elegidas.filter((t) => marcada(t.caja)).length;
  pasos.push(`Seleccionados: ${marcadas} de ${elegidas.length}`);
  if (!marcadas) return { ok: false, error: 'No se pudieron marcar las casillas de los productos.', pasos };
  const empujadosAntes = tarjetas.filter(empujado).length;
  const tarjetasAntes = tarjetas.length;

  // 3) PUSH TO STORE (barra superior, fuera del panel).
  let botonPush = null;
  for (let i = 0; i < 10 && !botonPush; i++) {
    botonPush = buscarBoton(document, /^push to store$|^empujar a la tienda$/i, { fueraDePanel: true });
    if (!botonPush) await dormir(500);
  }
  if (!botonPush) return { ok: false, error: 'No encontré el botón PUSH TO STORE.', pasos };
  pulsar(botonPush);
  pasos.push('PUSH TO STORE pulsado');

  // 4) Esperar el panel "Empujar productos" con sus filas cargadas.
  let panel = null;
  for (let i = 0; i < 60 && !panel; i++) {
    panel = [...document.querySelectorAll('.ant-modal, .ant-drawer, [role="dialog"]')]
      .find((p) => visible(p) && /empujar productos|push products|empujar detalles|push details/i.test(texto(p)));
    if (!panel) await dormir(500);
  }
  if (!panel) return { ok: false, error: 'No se abrió el panel de empujar productos.', pasos };
  for (let i = 0; i < 60; i++) {
    const filas = panel.querySelectorAll('tbody tr img').length;
    const cargando = panel.querySelector('.ant-spin-spinning, .ant-btn-loading');
    if (filas >= Math.min(marcadas, 1) && !cargando) break;
    await dormir(500);
  }
  await dormir(3000);
  pasos.push('Panel cargado');

  // 5) EMPUJAR A LA TIENDA (dentro del panel).
  let botonEmpujar = null;
  for (let i = 0; i < 30 && !botonEmpujar; i++) {
    botonEmpujar = buscarBoton(panel, /^empujar a la tienda$|^push to store$|^push$/i);
    if (botonEmpujar && (botonEmpujar.disabled || /disabled/i.test(clase(botonEmpujar)))) botonEmpujar = null;
    if (!botonEmpujar) await dormir(500);
  }
  if (!botonEmpujar) return { ok: false, error: 'No encontré el botón EMPUJAR A LA TIENDA en el panel.', pasos };
  pulsar(botonEmpujar);
  pasos.push('EMPUJAR A LA TIENDA pulsado');

  // 6) Esperar el resultado: ✔ verde en la columna Status de cada fila y/o el botón PUSH LOGS.
  const SEL_OK = '.anticon-check-circle, [class*="success" i], [class*="Success"]';
  const SEL_ERROR = '.anticon-close-circle, .anticon-exclamation-circle, [class*="error" i], [class*="fail" i]';
  const filasPanel = () => [...panel.querySelectorAll('tbody tr')].filter((f) => f.querySelector('img') && visible(f));
  const contar = () => {
    const filas = filasPanel();
    const ok = filas.filter((f) => f.querySelector(SEL_OK) || /importar reseñas|import reviews|success|éxito/i.test(texto(f))).length;
    const error = filas.filter((f) => !f.querySelector(SEL_OK) && (f.querySelector(SEL_ERROR) || /fail|error|fall/i.test(texto(f)))).length;
    return { filas: filas.length, ok, error };
  };
  const hayPushLogs = () => [...panel.querySelectorAll('button')].some((b) => /push logs|registros/i.test(texto(b)) && visible(b));

  const inicio = Date.now();
  let resultado = { filas: 0, ok: 0, error: 0 };
  let terminado = false;
  await dormir(2000);
  while (Date.now() - inicio < 180000) {
    if (!panel.isConnected || !visible(panel)) { terminado = true; break; }
    resultado = contar();
    const todasConEstado = resultado.filas > 0 && resultado.ok + resultado.error >= resultado.filas;
    if (hayPushLogs() || todasConEstado) { terminado = true; break; }
    await dormir(1000);
  }
  await dormir(1000);
  if (panel.isConnected) resultado = contar();
  if (!terminado) return { ok: false, error: 'El empuje no terminó en 3 minutos. Revisa la pestaña de DSers.', pasos };

  // Si DSers no marca cada fila pero mostró PUSH LOGS sin errores, cuenta todas como empujadas.
  if (!resultado.ok && !resultado.error && resultado.filas) resultado.ok = resultado.filas;
  const total = resultado.filas || marcadas;
  pasos.push(`Panel: ${resultado.ok} de ${total} empujado(s)${resultado.error ? `, ${resultado.error} con error` : ''}`);


  // 7) Cerrar el panel con la X (con alternativas si la X no responde).
  const abierto = () => {
    if (!panel.isConnected || !visible(panel)) return false;
    const cajon = panel.closest('.ant-drawer') || (panel.matches('.ant-drawer') ? panel : null);
    return !cajon || /ant-drawer-open/.test(clase(cajon));
  };
  const esperarCierre = async () => {
    for (let i = 0; i < 12 && abierto(); i++) await dormir(250);
    return !abierto();
  };
  // X por selector conocido o, si no, el icono pequeño de la esquina superior derecha del panel.
  const buscarX = () => {
    const porSelector = ['.ant-modal-close', '.ant-drawer-close', '[aria-label="Close" i]', '[aria-label="Cerrar" i]', 'button[class*="close" i]', '[class*="close" i]']
      .map((sel) => [...panel.querySelectorAll(sel)].find(visible)).find(Boolean);
    if (porSelector) return porSelector;
    const caja = (panel.querySelector('.ant-modal-content, .ant-drawer-content') || panel).getBoundingClientRect();
    const iconos = [...panel.querySelectorAll('button, [role="button"], svg, i, span')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.width < 48 && r.height < 48 && r.top - caja.top < 90 && caja.right - r.right < 90 && !texto(el).replace(/[×x✕]/gi, '');
    });
    const el = iconos[0];
    return el ? (el.closest('button, [role="button"]') || (el.tagName.toLowerCase() === 'svg' ? el.parentElement : el)) : null;
  };
  if (abierto()) {
    let cerrado = false;
    const x = buscarX();
    if (x) { pulsar(x); cerrado = await esperarCierre(); }
    if (!cerrado) {
      const esc = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
      for (const destino of [document.activeElement, panel, document]) destino && destino.dispatchEvent(new KeyboardEvent('keydown', esc));
      cerrado = await esperarCierre();
    }
    if (!cerrado) {
      const mascara = document.querySelector('.ant-drawer-mask, .ant-modal-wrap');
      if (mascara) { pulsar(mascara); cerrado = await esperarCierre(); }
    }
    pasos.push(cerrado ? 'Panel cerrado (X)' : (x ? 'No se pudo cerrar el panel' : 'No encontré la X para cerrar el panel'));
  }

  // 8) Confirmar en la propia lista: las tarjetas empujadas muestran "Pushed to ..." (o salen de la lista).
  //    El panel no siempre marca cada fila, así que esta es la confirmación más fiable.
  let enLista = 0;
  for (let i = 0; i < 30; i++) {
    const ahora = leerTarjetas();
    const porIds = ids.length
      ? ahora.filter((t) => ids.some((id) => t.nodo.innerHTML.includes(id)) && empujado(t)).length
      : 0;
    const nuevasMarcas = ahora.filter(empujado).length - empujadosAntes;
    const salieron = Math.max(0, tarjetasAntes - ahora.length);
    enLista = Math.min(total, Math.max(porIds, nuevasMarcas + salieron));
    if (enLista >= total) break;
    await dormir(1000);
  }
  if (enLista) pasos.push(`Confirmados en la lista de importación: ${enLista} de ${total}`);

  const empujados = Math.max(resultado.ok, enLista);
  const errores = Math.min(resultado.error, total - empujados);
  return { ok: empujados > 0, pasos, empujados, errores, total,
    error: empujados ? '' : 'DSers no confirmó ningún producto empujado. Revisa PUSH LOGS en DSers.' };
}

async function importar(links, windowId, empujar) {
  estado = { ...nuevoEstado(), corriendo: true, inicio: new Date().toISOString(), total: links.length, resultados: links.map(() => 'pendiente') };
  cancelar = false;
  pausado = false;
  // Mantiene vivo el service worker durante la importación.
  const latido = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    log('Abriendo DSers en una pestaña nueva...');
    let tabId = await abrirPestanaDsers(windowId);

    for (let i = 0; i < links.length; i++) {
      await esperarSiPausado();
      if (cancelar) { log('⏹ Importación detenida.'); break; }
      estado.actual = i + 1;
      estado.resultados[i] = 'activo';
      log(`(${i + 1}/${links.length}) Importando: ${links[i]}`);

      try {
        await chrome.tabs.get(tabId);
      } catch {
        log('  La pestaña de DSers se cerró, abriendo otra...');
        tabId = await abrirPestanaDsers(windowId);
      }

      let r;
      try {
        const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: importarEnPagina, args: [links[i]] });
        r = res.result || { ok: false, error: 'Sin respuesta de la página.' };
      } catch (err) {
        r = { ok: false, error: err.message };
      }

      estado.resultados[i] = r.ok ? 'hecho' : 'error';
      log(r.ok ? `  ✔ Importado${r.mensaje ? ` (${r.mensaje})` : ''}` : `  ✖ ${r.error}`);

      if (i < links.length - 1 && !cancelar) {
        log(`  Esperando ${ESPERA_ENTRE_LINKS_MS / 1000} segundos...`);
        for (let t = 0; t < ESPERA_ENTRE_LINKS_MS && !cancelar; t += 250) await dormir(250);
      }
    }
    const exitosos = links.filter((_, i) => estado.resultados[i] === 'hecho');
    await esperarSiPausado();
    if (empujar && exitosos.length && !cancelar) {
      log(`Empujando ${exitosos.length} producto(s) a la tienda...`);
      {
        // Sin recargar: los productos nuevos aparecen arriba en la lista apenas se importan.
        const ids = exitosos.map((l) => (l.match(/\/item\/(\d+)/) || [])[1]).filter(Boolean);
        const ejecutar = async () => {
          try {
            const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: empujarEnPagina, args: [ids, exitosos.length] });
            return res.result || { ok: false, error: 'Sin respuesta de la página.' };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        };
        let r = await ejecutar();
        if (r.sinTarjetas && !cancelar) {
          // En segundo plano Chrome puede no pintar la lista: traer la pestaña al frente y reintentar.
          log('  La lista no se mostró en segundo plano; activando la pestaña de DSers para continuar...');
          await chrome.tabs.update(tabId, { active: true });
          await dormir(2000);
          r = await ejecutar();
        }
        (r.pasos || []).forEach((p) => log(`  · ${p}`));
        estado.empuje = { ok: r.ok, empujados: r.empujados || 0, errores: r.errores || 0, total: r.total || exitosos.length, error: r.error || '' };
        log(r.ok ? `  ✔ ${r.empujados} producto(s) empujado(s) a la tienda exitosamente` : `  ✖ ${r.error}`);
      }
    }
    if (!cancelar) log('✅ Terminado.');
  } catch (err) {
    log(`❌ Error: ${err.message}`);
  } finally {
    clearInterval(latido);
    pausado = false;
    estado.corriendo = false;
    estado.pausado = false;
    emitir();
    // Vuelve a la pestaña de la app: ahí siguen el pulido y los videos (que necesitan la pestaña visible).
    if (tabApp != null) chrome.tabs.update(tabApp, { active: true }).catch(() => {});
  }
}


// ---------- Bot de pedidos (despacho) ----------
// En DSers los pedidos de la tienda pasan por: «Awaiting order» (sin comprar al proveedor) → Order (se compran en
// AliExpress) → «Awaiting payment» (se pagan al proveedor; eso lo hace la persona) → «Awaiting shipment» (el
// proveedor despacha) → DSers sincroniza el número de seguimiento con la tienda.
// Modos: 'revisar' (cantidades por pestaña), 'capturar' (además lee cada pedido de una pestaña) y 'ordenar'
// (compra al proveedor los pedidos elegidos según la configuración). Nunca paga.
const DSERS_PEDIDOS_URL = 'https://www.dsers.com/application/orders/';
let pedidosCorriendo = false;

// Se ejecuta DENTRO de DSers. Debe ser autocontenida.
// cfg: { pestana, saltarErrores, maxPedidos, maxCosto, envio, prueba }
async function pedidosEnPagina(modo, cfg) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const texto = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const pasos = [];
  const pulsar = (el) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  };
  const buscar = (re, sel = 'a, button, [role="tab"], [role="menuitem"], .ant-tabs-tab, .ant-menu-item, li, span, div') => {
    const candidatos = [...document.querySelectorAll(sel)]
      .filter((el) => visible(el))
      .filter((el) => { const t = texto(el); return t.length > 0 && t.length < 60 && re.test(t); });
    return candidatos.find((el) => ![...el.children].some((h) => candidatos.includes(h))) || null;
  };
  const esperar = async (fn, ms = 15000) => {
    const inicio = Date.now();
    while (Date.now() - inicio < ms) { const r = fn(); if (r) return r; await dormir(400); }
    return null;
  };

  if (/login|sign|register/i.test(location.href)) return { ok: false, error: 'DSers pide iniciar sesión en este Chrome.', pasos };

  const PESTANAS = {
    porPedir: /awaiting order|pending order|por pedir|esperando pedido|pendiente de pedido|pedido pendiente/i,
    porPagar: /awaiting payment|pending payment|por pagar|esperando pago|pago pendiente/i,
    enviando: /awaiting shipment|esperando env[ií]o|por enviar|env[ií]o pendiente/i,
    enviados: /^(?:fulfilled|shipped|completed|enviados?|completados?|cumplidos?)\b/i,
  };
  const pestanaDe = (re) => buscar(re, '[role="tab"], .ant-tabs-tab, .ant-radio-button-wrapper, a, button, li, span, div');
  const leerConteos = () => {
    const conteos = {};
    for (const [clave, re] of Object.entries(PESTANAS)) {
      const el = pestanaDe(re);
      if (!el) continue;
      const contenedor = el.closest('[role="tab"], .ant-tabs-tab, .ant-radio-button-wrapper, a, button, li') || el;
      const m = texto(contenedor).match(/(\d+)\s*\)?\s*$/) || texto(contenedor.parentElement || contenedor).match(/(\d+)/);
      conteos[clave] = m ? Number(m[1]) : null;
    }
    return conteos;
  };
  // Lo que se ve en la página (para ajustar el bot si DSers cambia): pestañas y botones.
  const diagnostico = () => ({
    url: location.href,
    pestanas: [...document.querySelectorAll('[role="tab"], .ant-tabs-tab, .ant-radio-button-wrapper')].filter(visible).map(texto).filter(Boolean).slice(0, 30),
    botones: [...new Set([...document.querySelectorAll('button')].filter(visible).map(texto).filter((t) => t && t.length < 40))].slice(0, 60),
  });

  // Pedidos de la pestaña abierta: se parte de cada número de pedido de la tienda (#1001) y se sube hasta el
  // contenedor que tiene una casilla, sin abarcar otro pedido.
  const PATRON_PEDIDO = /#\s?\d{3,}/;
  const PATRON_ERROR = /error|fail|failed|no se pudo|out of stock|sin stock|agotado|not available|no disponible|mapping|unavailable|cannot|can't|incomplete|incompleto|address|direcci[oó]n/i;
  const PATRON_ENVIO = /(aliexpress [a-z ]*shipping|standard shipping|cainiao[a-z ]*|epacket|e-packet|[a-z]+ express|seller'?s shipping method|envío [a-záéíóú ]+|free shipping)/i;
  const leerPedidos = () => {
    const pedidos = [];
    const vistos = new Set();
    const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (PATRON_PEDIDO.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
      let nodo = n.parentElement;
      if (!nodo || nodo.closest('.ant-modal, .ant-drawer, [role="dialog"]') || !visible(nodo)) continue;
      const numero = n.nodeValue.match(PATRON_PEDIDO)[0].replace(/\s/g, '');
      let caja = null;
      for (let i = 0; nodo && i < 14; i++, nodo = nodo.parentElement) {
        caja = nodo.querySelector('input[type="checkbox"]');
        if (caja) break;
      }
      if (!nodo || nodo === document.body || vistos.has(nodo)) continue;
      // Si al subir se abarcó otro pedido, el contenedor no sirve.
      const numeros = new Set((texto(nodo).match(/#\s?\d{3,}/g) || []).map((x) => x.replace(/\s/g, '')));
      if (numeros.size > 1) continue;
      vistos.add(nodo);
      const t = texto(nodo);
      const montos = (t.match(/(?:US\s?)?\$\s?\d[\d.,]*/g) || []).map((m) => Number(m.replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'))).filter((x) => !Number.isNaN(x));
      const productos = [...new Set([...nodo.querySelectorAll('img')].map((img) => (img.getAttribute('alt') || img.getAttribute('title') || '').trim()).filter((x) => x.length > 3))].slice(0, 5);
      const error = (t.match(new RegExp(`[^.]{0,60}(?:${PATRON_ERROR.source})[^.]{0,60}`, 'i')) || [])[0] || '';
      pedidos.push({
        numero,
        productos,
        montos,
        costoMax: montos.length ? Math.max(...montos) : null,
        envio: (t.match(PATRON_ENVIO) || [])[0] || '',
        error: error.trim().slice(0, 140),
        fecha: (t.match(/\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?|\d{1,2}\/\d{1,2}\/\d{2,4}/) || [])[0] || '',
        resumen: t.slice(0, 260),
        caja,
      });
    }
    return pedidos;
  };
  const sinCaja = (lista) => lista.map(({ caja, ...resto }) => resto);

  // 1. Llegar a la lista de pedidos.
  let tabPorPedir = await esperar(() => pestanaDe(PESTANAS.porPedir), 8000);
  if (!tabPorPedir) {
    const menu = await esperar(() => buscar(/^(open orders?|pedidos abiertos|orders?|pedidos|[oó]rdenes)$/i), 15000);
    if (!menu) return { ok: false, error: 'No encontré los pedidos en DSers. Revisa la URL de pedidos en la configuración.', pasos, diagnostico: diagnostico() };
    pulsar(menu);
    pasos.push(`Abrí «${texto(menu)}»`);
    await dormir(2500);
    tabPorPedir = await esperar(() => pestanaDe(PESTANAS.porPedir), 5000);
    if (!tabPorPedir) {
      const sub = await esperar(() => buscar(/^(open orders?|pedidos abiertos)$/i), 5000);
      if (sub) { pulsar(sub); pasos.push(`Abrí «${texto(sub)}»`); await dormir(2500); }
      tabPorPedir = await esperar(() => pestanaDe(PESTANAS.porPedir), 12000);
    }
  }
  if (!tabPorPedir) return { ok: false, error: 'No encontré la pestaña «Awaiting order» en DSers.', pasos, diagnostico: diagnostico() };

  await dormir(1500);
  const antes = leerConteos();
  pasos.push(`Por pedir: ${antes.porPedir ?? '?'} · por pagar: ${antes.porPagar ?? '?'} · esperando envío: ${antes.enviando ?? '?'}`);
  if (modo === 'revisar') return { ok: true, conteos: antes, pasos, diagnostico: diagnostico() };

  // 2. Abrir la pestaña elegida y leer sus pedidos.
  const clave = modo === 'ordenar' ? 'porPedir' : (PESTANAS[cfg.pestana] ? cfg.pestana : 'porPedir');
  const pestana = clave === 'porPedir' ? tabPorPedir : pestanaDe(PESTANAS[clave]);
  if (!pestana) return { ok: false, error: 'No encontré esa pestaña en DSers.', pasos, conteos: antes, diagnostico: diagnostico() };
  pulsar(pestana);
  pasos.push(`Abrí «${texto(pestana)}»`);
  await dormir(3500);
  await esperar(() => !document.querySelector('.ant-spin-spinning'), 15000);
  const pedidos = leerPedidos();
  pasos.push(`Leí ${pedidos.length} pedido(s) en la página.`);
  if (modo === 'capturar') return { ok: true, conteos: antes, pestana: clave, pedidos: sinCaja(pedidos), pasos, diagnostico: diagnostico() };

  // 3. Despacho: elegir qué pedidos se compran al proveedor según la configuración.
  const elegidos = [];
  const saltados = [];
  for (const p of pedidos) {
    if (elegidos.length >= (cfg.maxPedidos || 50)) { saltados.push({ numero: p.numero, motivo: 'límite por ronda' }); continue; }
    if (cfg.saltarErrores && p.error) { saltados.push({ numero: p.numero, motivo: `tiene un aviso: ${p.error}` }); continue; }
    if (cfg.maxCosto && p.costoMax != null && p.costoMax > cfg.maxCosto) { saltados.push({ numero: p.numero, motivo: `cuesta más de US$${cfg.maxCosto}` }); continue; }
    if (!p.caja) { saltados.push({ numero: p.numero, motivo: 'sin casilla para seleccionar' }); continue; }
    elegidos.push(p);
  }
  pasos.push(`Para despachar: ${elegidos.map((p) => p.numero).join(', ') || 'ninguno'}${saltados.length ? ` · saltados: ${saltados.length}` : ''}`);
  if (!elegidos.length) return { ok: true, conteos: antes, ordenados: 0, elegidos: [], saltados, pedidos: sinCaja(pedidos), pasos };
  if (cfg.prueba) {
    pasos.push('Modo prueba: no se compró nada.');
    return { ok: true, prueba: true, conteos: antes, ordenados: 0, elegidos: elegidos.map((p) => p.numero), saltados, pedidos: sinCaja(pedidos), pasos };
  }

  for (const p of elegidos) {
    if (!p.caja.checked) pulsar(p.caja.closest('label, .ant-checkbox-wrapper, .ant-checkbox') || p.caja);
    await dormir(250);
  }
  await dormir(600);

  // 4. Comprar al proveedor (Order / Bulk order) y confirmar, eligiendo el envío preferido si se configuró.
  const boton = await esperar(() => buscar(/^(bulk order|order|place orders?|order products|realizar pedidos?|hacer pedidos?|pedido masivo|pedido en lote|pedir|ordenar)$/i, 'button'), 8000);
  if (!boton) return { ok: false, error: 'No encontré el botón para comprar al proveedor (Order / Bulk order).', pasos, conteos: antes, diagnostico: diagnostico() };
  pulsar(boton);
  pasos.push(`Pulsé «${texto(boton)}»`);
  await dormir(2500);
  const modal = await esperar(() => [...document.querySelectorAll('.ant-modal, .ant-drawer, [role="dialog"]')].filter(visible).pop(), 15000);
  if (modal && cfg.envio) {
    const deseado = cfg.envio.toLowerCase();
    let cambiados = 0;
    for (const sel of [...modal.querySelectorAll('.ant-select')].filter(visible)) {
      if (texto(sel).toLowerCase().includes(deseado)) continue;
      pulsar(sel.querySelector('.ant-select-selector') || sel);
      await dormir(700);
      const opcion = [...document.querySelectorAll('.ant-select-item-option, [role="option"]')].filter(visible)
        .find((o) => texto(o).toLowerCase().includes(deseado));
      if (opcion) { pulsar(opcion); cambiados++; } else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await dormir(500);
    }
    pasos.push(cambiados ? `Puse «${cfg.envio}» en ${cambiados} pedido(s).` : `No encontré «${cfg.envio}» entre los envíos disponibles (se dejó el que tenía).`);
  }
  const confirmar = modal && [...modal.querySelectorAll('button')].filter(visible)
    .find((b) => /place order|confirm|order|realizar pedido|confirmar|pedir|aceptar|ok/i.test(texto(b)) && !/cancel/i.test(texto(b)));
  if (confirmar) { pulsar(confirmar); pasos.push(`Confirmé con «${texto(confirmar)}»`); } else pasos.push('No apareció ventana de confirmación.');

  // 5. Resultado.
  await dormir(8000);
  await esperar(() => !document.querySelector('.ant-modal .ant-btn-loading, .ant-spin-spinning'), 60000);
  const aviso = document.querySelector('.ant-message-notice:last-child, .ant-notification-notice:last-child');
  if (aviso) pasos.push(`DSers: ${texto(aviso).slice(0, 200)}`);
  await dormir(2000);
  const despues = leerConteos();
  const ordenados = antes.porPedir != null && despues.porPedir != null ? Math.max(0, antes.porPedir - despues.porPedir) : null;
  pasos.push(`Ahora: por pedir ${despues.porPedir ?? '?'} · por pagar ${despues.porPagar ?? '?'}`);
  return { ok: true, conteos: despues, ordenados, elegidos: elegidos.map((p) => p.numero), saltados, pasos };
}

async function pedidos(modo, cfg, windowId) {
  pedidosCorriendo = true;
  const latido = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    const tab = await chrome.tabs.create({ windowId, url: cfg.url || DSERS_PEDIDOS_URL, active: false });
    await esperarCarga(tab.id);
    await dormir(2500);
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pedidosEnPagina, args: [modo, cfg] });
    const r = res.result || { ok: false, error: 'Sin respuesta de DSers.' };
    // Revisar y capturar no dejan pestañas abiertas; tras despachar queda abierta para revisar o pagar.
    if (modo !== 'ordenar' && r.ok) chrome.tabs.remove(tab.id).catch(() => {});
    return r;
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearInterval(latido);
    pedidosCorriendo = false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.tipo === 'version') {
    sendResponse({ version: chrome.runtime.getManifest().version });
  } else if (msg.tipo === 'cuentaDsers') {
    // Cuenta para el inicio de sesión automático (extension/dsers-login.js); solo en este Chrome.
    chrome.storage.local.get('dsersCuenta').then(({ dsersCuenta }) => sendResponse({ correo: dsersCuenta?.correo || '' }));
    return true;
  } else if (msg.tipo === 'guardarCuentaDsers') {
    const correo = String(msg.correo || '').trim();
    const clave = String(msg.clave || '');
    const listo = correo && clave ? chrome.storage.local.set({ dsersCuenta: { correo, clave } }) : chrome.storage.local.remove('dsersCuenta');
    listo.then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg.tipo === 'estado') {
    // Durante una importación el progreso sigue yendo a la pestaña que la lanzó.
    if (sender.tab && !estado.corriendo) tabApp = sender.tab.id;
    sendResponse(estado);
  } else if (msg.tipo === 'importar') {
    if (estado.corriendo) return sendResponse({ error: 'Ya hay una importación en curso.' });
    const links = (msg.links || []).map((l) => String(l).trim())
      .map((l) => (/^https?:\/\//i.test(l) ? l : `https://${l}`))
      .filter((l) => /^https?:\/\/\S*aliexpress\.\S+/i.test(l));
    if (!links.length) return sendResponse({ error: 'No hay links válidos de AliExpress.' });
    tabApp = sender.tab.id;
    importar(links, sender.tab.windowId, !!msg.empujar);
    sendResponse({ ok: true, total: links.length });
  } else if (msg.tipo === 'detener') {
    cancelar = true;
    sendResponse({ ok: true });
  } else if (msg.tipo === 'pausar' || msg.tipo === 'reanudar') {
    if (!estado.corriendo) return sendResponse({ error: 'No hay una importación en curso.' });
    pausado = msg.tipo === 'pausar';
    estado.pausado = pausado;
    emitir();
    sendResponse({ ok: true, pausado });
  } else if (msg.tipo === 'pedidos') {
    if (pedidosCorriendo) return sendResponse({ error: 'El bot de pedidos ya está trabajando.' });
    if (estado.corriendo) return sendResponse({ error: 'Espera a que termine la importación.' });
    const c = msg.config || {};
    const url = c.url || msg.url || '';
    const cfg = {
      url: /^https:\/\/[a-z0-9.-]*dsers\.com\//i.test(url) ? url : '',
      pestana: String(c.pestana || 'porPedir'),
      saltarErrores: c.saltarErrores !== false,
      maxPedidos: Math.max(1, Math.min(200, Number(c.maxPedidos) || 50)),
      maxCosto: Number(c.maxCosto) > 0 ? Number(c.maxCosto) : 0,
      envio: String(c.envio || '').trim().slice(0, 60),
      prueba: !!c.prueba,
    };
    const modo = ['revisar', 'capturar', 'ordenar'].includes(msg.modo) ? msg.modo : 'revisar';
    pedidos(modo, cfg, sender.tab.windowId).then(sendResponse);
    return true; // la respuesta llega cuando termina
  }
});
