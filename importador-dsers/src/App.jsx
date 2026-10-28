import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarDays, Check, Clapperboard, ClipboardPaste, Clock, Download, ExternalLink, FileText, Link2, ListOrdered, LogOut,
  Menu, MessageSquare, Pause, Play, Puzzle, Smartphone, Sparkles, Square, Store, Terminal, TriangleAlert, Upload, UserPlus, Users, X, ShoppingCart,
} from 'lucide-react';
import { crearZip } from './zip.js';
import { avisarSalida, estadoCambio, iniciarConexion, responderInvitacion } from './actividad.js';
import { Campana, ChatsAdmin, Emergentes, SeccionInvitados, useMonitor } from './Monitor.jsx';
import { BotonChat, VentanaChat } from './Chat.jsx';
import { SeccionInvitar } from './Invitar.jsx';
import { SeccionPedidos, usePedidos } from './Pedidos.jsx';
import { CuentaDsers } from './CuentaDsers.jsx';
import { colorDe, useSala } from './sala.js';
import manifestExt from '../extension/manifest.json?raw';
import backgroundExt from '../extension/background.js?raw';
import puenteExt from '../extension/puente.js?raw';
import dsersLoginExt from '../extension/dsers-login.js?raw';

const DSERS_URL = 'https://www.dsers.com/application/import_list';
// Estudio de video (proyecto aparte en Vercel), mostrado como sección del importador.
const ESTUDIO_URL = 'https://prh-ai-video.vercel.app/';
const ESTUDIO_ORIGEN = new URL(ESTUDIO_URL).origin;
const TITULOS = { importador: 'Importador', videos: 'Videos', invitados: 'Usuarios e invitados', invitar: 'Invitar', pedidos: 'Pedidos' };
// Links de AliExpress en cualquier parte del texto (con o sin https://).
const PATRON_LINK = /(?:https?:\/\/)?[a-z0-9.-]*aliexpress\.[a-z.]{2,}\/[^\s"'<>,;]*/gi;

function extraerLinks(texto) {
  const vistos = new Set();
  for (const m of texto.match(PATRON_LINK) || []) {
    const link = /^https?:\/\//i.test(m) ? m : `https://${m}`;
    vistos.add(link.replace(/[).\]]+$/, ''));
  }
  return [...vistos];
}

// Lee el .txt en UTF-8 o UTF-16 (el Bloc de notas puede guardar en "Unicode").
async function leerTexto(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  // UTF-16 sin BOM: muchos bytes nulos.
  const nulos = bytes.slice(0, 200).filter((b) => b === 0).length;
  if (nulos > 20) return new TextDecoder(bytes[0] === 0 ? 'utf-16be' : 'utf-16le').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

// La versión publicada está protegida con clave; en local no.
const CON_CLAVE = !['localhost', '127.0.0.1'].includes(location.hostname);
// Celulares y tabletas: no admiten la extensión de Chrome (solo Videos y el pulido).
const ES_MOVIL = window.matchMedia?.('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

function cerrarSesion() {
  location.replace('/login.html');
}

// Envía un mensaje a la extensión (vía extension/puente.js) y espera su respuesta.
let contador = 0;
function enviar(mensaje) {
  const id = ++contador;
  return new Promise((resolve) => {
    const onMsg = (e) => {
      if (e.source !== window || e.data?.origen !== 'dsers-ext' || e.data.id !== id) return;
      window.removeEventListener('message', onMsg);
      resolve(e.data.tipo === 'listo' ? { ok: true } : e.data.resp);
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ origen: 'dsers-app', id, mensaje }, '*');
  });
}

// La extensión va dentro de la app para poder instalarla en cualquier PC sin copiar la carpeta.
function descargarExtension() {
  const zip = crearZip([
    { nombre: 'dsers-importador/manifest.json', texto: manifestExt },
    { nombre: 'dsers-importador/background.js', texto: backgroundExt },
    { nombre: 'dsers-importador/puente.js', texto: puenteExt },
    { nombre: 'dsers-importador/dsers-login.js', texto: dsersLoginExt },
  ]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zip);
  a.download = 'dsers-importador.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Pulido en Shopify (api/tienda.js): solo existe en la versión publicada en Vercel.
async function llamarTienda(opciones = {}, consulta = '') {
  const r = await fetch(`/api/tienda${consulta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json' },
  });
  const datos = await r.json().catch(() => ({ error: `Respuesta inválida del servidor (${r.status}).` }));
  if (!r.ok || datos.error) throw new Error(datos.error || `Error ${r.status}`);
  return datos;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

const ICONO_ESTADO = {
  pendiente: <Clock size={15} />,
  activo: <ArrowRight size={15} />,
  hecho: <Check size={15} />,
  error: <X size={15} />,
};

export default function App() {
  const [extension, setExtension] = useState(false);
  const [versionExt, setVersionExt] = useState(''); // versión de la extensión instalada ('' = vieja, sin este dato)
  const [links, setLinks] = useState([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [textoPegado, setTextoPegado] = useState('');
  const [importados, setImportados] = useState([]); // links de la importación en curso (para ubicar cada resultado)
  const [estado, setEstado] = useState(null);
  const estadoRef = useRef(null);
  estadoRef.current = estado;
  const [seccion, setSeccion] = useState(() => {
    try { return localStorage.getItem('dsers_seccion') === 'videos' ? 'videos' : 'importador'; } catch { return 'importador'; }
  });
  const [estudioCargado, setEstudioCargado] = useState(seccion === 'videos');
  const [menuAbierto, setMenuAbierto] = useState(false); // solo en celular
  const [empujar, setEmpujar] = useState(() => {
    try { return localStorage.getItem('dsers_empujar') !== '0'; } catch { return true; }
  });
  const [pulir, setPulir] = useState(() => {
    try { return localStorage.getItem('dsers_pulir') !== '0'; } catch { return true; }
  });
  const [pulido, setPulido] = useState({ corriendo: false, items: [], mensaje: '' });
  const [fechaPulir, setFechaPulir] = useState(hoy);
  const inputArchivo = useRef(null);
  const logRef = useRef(null);
  const pulidoDe = useRef(null); // inicio de la importación que ya se pulió
  const [videosAuto, setVideosAuto] = useState(() => {
    try { return localStorage.getItem('dsers_videos') !== '0'; } catch { return true; }
  });
  const [videos, setVideos] = useState(null); // progreso de los videos automáticos (lo envía el estudio)
  const iframeRef = useRef(null);
  const estudioListo = useRef(false);
  const esperaEstudio = useRef([]);
  const videosEnCurso = useRef(false); // grabando videos: la sección Videos no se puede dejar
  videosEnCurso.current = Boolean(videos && !videos.terminado);
  const ultimoAutoEstado = useRef(0); // último progreso recibido del estudio (confirma que empezó)

  // Quién usa la página: admin (clave/cara) o invitado. En local se trabaja como admin.
  const [sesion, setSesion] = useState(CON_CLAVE ? null : { rol: 'admin', nombre: 'Administrador' });
  const esAdmin = sesion?.rol === 'admin';
  const esInvitado = sesion?.rol === 'invitado';
  const monitor = useMonitor(esAdmin && CON_CLAVE);
  const [avisoAdmin, setAvisoAdmin] = useState(null); // aviso del admin (pausa, detener…) que ve el invitado
  // Chat del usuario con el admin (abajo a la derecha).
  const [chatAbierto, setChatAbierto] = useState(false);
  const [chatMensajes, setChatMensajes] = useState([]); // [{ mio, texto, ts }]
  const [chatSinLeer, setChatSinLeer] = useState(0);
  // Lista de links compartida en tiempo real (admin con invitaciones vigentes + quienes entraron por invitación).
  // Invitación del admin que espera respuesta del usuario, y si ya colabora (comparte la lista con el admin).
  const [invitacionAdmin, setInvitacionAdmin] = useState(null);
  const [colaborando, setColaborando] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  // Trabajo en equipo: el cuadro «Pega aquí los links» es el mismo en las dos pantallas (lo que escribe uno lo ve
  // el otro). Cada link muestra quién lo puso (con su color) y se avisa cuando el otro agrega links.
  const yo = esAdmin ? 'Admin' : sesion?.nombre;
  const [notaSala, setNotaSala] = useState('');
  // Pedidos de la tienda por despachar (contador del menú y aviso de compras nuevas).
  const pedidos = usePedidos(CON_CLAVE && (esAdmin || colaborando));
  const sala = useSala(CON_CLAVE && (esAdmin || colaborando), yo, {
    onTexto: (texto) => {
      setTextoPegado(texto);
      setNombreArchivo('');
      setLinks(extraerLinks(texto));
    },
    onAjenos: (ajenos) => {
      const porPersona = {};
      for (const l of ajenos) porPersona[l.por] = (porPersona[l.por] || 0) + 1;
      setNotaSala(Object.entries(porPersona).map(([quien, n]) => `${quien} agregó ${n} link(s)`).join(' · '));
    },
  });
  // Con quién se está trabajando: el admin ve a los usuarios; el usuario ve al admin.
  const companeros = sala ? sala.equipo.filter((n) => n !== yo && (esAdmin || n === 'Admin')) : [];

  // Cambios del cuadro compartido hechos con botones (cargar .txt, vaciar).
  function cambiarTextoEquipo(texto) {
    setTextoPegado(texto);
    setLinks(extraerLinks(texto));
    sala.guardar(texto);
  }
  const detenido = useRef(false);
  // Pausa (la importación la pausa la extensión; el pulido espera entre productos). pausaAdmin: la puso el admin.
  const pulidoPausado = useRef(false);
  const [pausaPulido, setPausaPulido] = useState(false);
  const [pausaAdmin, setPausaAdmin] = useState(false); // el admin (o el invitado) detuvo el trabajo: no seguir con pulido ni videos

  useEffect(() => {
    if (!CON_CLAVE) return;
    fetch('/api/sesion', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSesion(s || { rol: 'admin', nombre: 'Administrador' }))
      .catch(() => setSesion({ rol: 'admin', nombre: 'Administrador' }));
  }, []);

  // Invitado: normalmente el admin solo ve en qué sección está y si está trabajando (para poder detenerlo).
  // Solo mientras el admin elige «Ver en tiempo real» se envía también el detalle de la pantalla.
  const resumen = useRef({});
  resumen.current = {
    seccion,
    trabajo: {
      importando: estado?.corriendo ? { actual: estado.actual, total: estado.total } : null,
      puliendo: pulido.corriendo,
      pausado: Boolean(estado?.pausado || pausaPulido),
    },
  };
  const pantalla = useRef({});
  pantalla.current = {
    archivo: nombreArchivo,
    textoPegado: Boolean(textoPegado.trim()),
    links: links.slice(0, 300),
    opciones: { empujar, pulir, videos: videosAuto },
    importacion: estado ? {
      corriendo: estado.corriendo, total: estado.total, actual: estado.actual,
      resultados: estado.resultados, log: (estado.log || []).slice(-80), empuje: estado.empuje,
    } : null,
    pulido: { mensaje: pulido.mensaje, items: pulido.items.map((p) => ({ antes: p.antes, titulo: p.titulo, estado: p.estado })) },
    videos: videos ? { terminado: videos.terminado, log: (videos.log || []).slice(-40) } : null,
  };
  useEffect(() => {
    if (esInvitado) {
      iniciarConexion((detallado) => (detallado ? { ...resumen.current, vivo: pantalla.current } : resumen.current), ordenAdmin);
    }
  }, [esInvitado]);
  useEffect(() => {
    if (esInvitado) estadoCambio();
  }, [esInvitado, seccion, estado?.corriendo, estado?.pausado, pulido.corriendo, pausaPulido]);

  // Órdenes del admin: detener lo que esté haciendo, mostrar un mensaje o sacarlo de la app.
  function ordenAdmin(orden) {
    if (orden.tipo === 'pausar') {
      pausarTodo(true);
      setAvisoAdmin({ titulo: 'El administrador pausó el proceso', texto: 'La importación y el pulido quedan en pausa hasta que el administrador los reanude.' });
    } else if (orden.tipo === 'reanudar') {
      reanudarTodo();
      setAvisoAdmin({ titulo: 'El administrador reanudó el proceso', texto: 'La importación y el pulido continúan.' });
    } else if (orden.tipo === 'detener') {
      detenerTodo();
      setAvisoAdmin({ titulo: 'El administrador detuvo el proceso', texto: 'Se detuvo la importación y el pulido en curso.' });
    } else if (orden.tipo === 'mensaje') {
      setChatMensajes((m) => [...m, { mio: false, texto: orden.texto, ts: Date.now() }]);
      setChatAbierto(true);
      setChatSinLeer(0);
    } else if (orden.tipo === 'estado') {
      setInvitacionAdmin(orden.invitacion);
      setColaborando(orden.colaborando);
    } else if (orden.tipo === 'fuera') {
      detenerTodo();
      location.replace(`/login.html?motivo=${encodeURIComponent(orden.motivo || 'sacado')}`);
    }
  }

  // Su conversación guardada con el admin (no se borra: sigue ahí cada vez que entra).
  useEffect(() => {
    if (!esInvitado) return;
    fetch('/api/actividad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historialChat: true }) })
      .then((r) => r.json())
      .then((d) => { if (d.mensajes) setChatMensajes(d.mensajes.map((m) => ({ mio: m.de === 'usuario', texto: m.texto, ts: m.ts }))); })
      .catch(() => {});
  }, [esInvitado]);

  // El usuario le escribe al admin.
  async function escribirAlAdmin(texto) {
    try {
      const r = await fetch('/api/actividad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
      setChatMensajes((m) => [...m, { mio: true, texto, ts: Date.now() }]);
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  }

  async function responder(acepta) {
    if (!invitacionAdmin) return;
    setRespondiendo(true);
    try {
      const r = await responderInvitacion(invitacionAdmin.id, acepta);
      setInvitacionAdmin(null);
      setColaborando(!!r.colaborando);
    } catch (err) {
      alert(err.message);
      setInvitacionAdmin(null);
    } finally {
      setRespondiendo(false);
    }
  }

  function detenerTodo() {
    detenido.current = true;
    reanudarTodo();
    enviar({ tipo: 'detener' });
  }

  async function pausarTodo(porAdmin = false) {
    pulidoPausado.current = true;
    setPausaPulido(true);
    if (porAdmin) setPausaAdmin(true);
    const r = await enviar({ tipo: 'pausar' });
    if (r?.error && !/No hay una importación/.test(r.error) && estadoRef.current?.corriendo) {
      setAvisoAdmin({ titulo: 'No se pudo pausar la importación', texto: 'Actualiza la extensión de Chrome (descárgala de nuevo y recárgala) para poder pausar.' });
    }
  }

  // Si ya no hay nada en curso, no queda nada en pausa.
  useEffect(() => {
    if (!estado?.corriendo && !pulido.corriendo && pulidoPausado.current) {
      pulidoPausado.current = false;
      setPausaPulido(false);
      setPausaAdmin(false);
    }
  }, [estado?.corriendo, pulido.corriendo]);

  function reanudarTodo() {
    pulidoPausado.current = false;
    setPausaPulido(false);
    setPausaAdmin(false);
    enviar({ tipo: 'reanudar' });
  }

  // Detectar la extensión y escuchar el progreso que envía.
  useEffect(() => {
    let vivo = true;
    const onMsg = (e) => {
      if (e.source !== window || e.data?.origen !== 'dsers-ext') return;
      if (e.data.tipo === 'estado') setEstado(e.data.estado);
    };
    window.addEventListener('message', onMsg);
    const intentar = async () => {
      const r = await Promise.race([enviar({ tipo: 'ping' }), new Promise((ok) => setTimeout(ok, 800))]);
      if (!vivo) return;
      if (r?.ok) {
        setExtension(true);
        enviar({ tipo: 'version' }).then((v) => setVersionExt(v?.version || ''));
        const e = await enviar({ tipo: 'estado' });
        if (e && !e.error) {
          if (!e.corriendo) pulidoDe.current = e.inicio; // importación anterior: no pulir de nuevo
          setEstado(e);
        }
      } else {
        setTimeout(intentar, 1500);
      }
    };
    intentar();
    return () => { vivo = false; window.removeEventListener('message', onMsg); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [estado?.log?.length]);


  async function cargarArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const texto = await leerTexto(file);
    const nuevos = extraerLinks(texto);
    e.target.value = '';
    if (sala) {
      // Se agregan al final del cuadro compartido los que no estaban.
      const ya = new Set(extraerLinks(textoPegado));
      const faltan = nuevos.filter((l) => !ya.has(l));
      if (faltan.length) cambiarTextoEquipo([textoPegado.replace(/\s+$/, ''), ...faltan].filter(Boolean).join('\n'));
      setNotaSala(`«${file.name}»: ${faltan.length} link(s) agregados${nuevos.length > faltan.length ? ` (${nuevos.length - faltan.length} ya estaban)` : ''}`);
      return;
    }
    setNombreArchivo(file.name);
    setTextoPegado('');
    setLinks(nuevos);
  }

  function pegarLinks(e) {
    const nuevos = extraerLinks(e.target.value);
    setTextoPegado(e.target.value);
    if (sala) {
      // Cuadro compartido: lo que se escribe llega a la pantalla del otro.
      setLinks(nuevos);
      sala.escribir(e.target.value);
      return;
    }
    setNombreArchivo('');
    setLinks(nuevos);
  }

  async function importar() {
    detenido.current = false;
    setImportados(links);
    const r = await enviar({ tipo: 'importar', links, empujar });
    if (r?.error) alert(r.error);
  }

  async function salir() {
    await avisarSalida();
    cerrarSesion();
  }

  function cambiarEmpujar(e) {
    setEmpujar(e.target.checked);
    try { localStorage.setItem('dsers_empujar', e.target.checked ? '1' : '0'); } catch { /* sin storage */ }
  }

  function cambiarSeccion(nueva) {
    if (nueva !== 'videos' && videosEnCurso.current) {
      setAvisoAdmin({ titulo: 'Se están generando los videos', texto: 'Deja abierta la sección Videos hasta que terminen; si la cambias, la grabación se detiene.' });
      return;
    }
    setSeccion(nueva);
    setMenuAbierto(false);
    if (nueva === 'videos') setEstudioCargado(true);
    try { if (nueva === 'importador' || nueva === 'videos') localStorage.setItem('dsers_seccion', nueva); } catch { /* sin storage */ }
  }

  // El admin abre la sección Invitados (desde la campana o un aviso).
  const verInvitados = () => cambiarSeccion('invitados');

  function cambiarVideosAuto(e) {
    setVideosAuto(e.target.checked);
    try { localStorage.setItem('dsers_videos', e.target.checked ? '1' : '0'); } catch { /* sin storage */ }
  }

  function cambiarPulir(e) {
    setPulir(e.target.checked);
    try { localStorage.setItem('dsers_pulir', e.target.checked ? '1' : '0'); } catch { /* sin storage */ }
  }

  // Busca en Shopify los productos creados desde `desde` sin pulir y los reescribe uno por uno.
  // `esperados`: cuántos acaban de empujarse (Shopify tarda unos segundos en listarlos).
  // DSers crea los productos en Shopify poco a poco: se espera hasta que estén los empujados
  // (unos 20 s por producto, entre 1 y 5 min). Un fallo puntual de la consulta no corta la espera.
  async function esperarListado(desde, esperados = 0) {
    const limite = Date.now() + Math.min(300000, Math.max(60000, esperados * 20000));
    let productos = [];
    while (!detenido.current) {
      try {
        productos = (await llamarTienda({}, `?desde=${encodeURIComponent(desde)}`)).productos;
        if (productos.length >= esperados) break;
      } catch { /* se reintenta */ }
      if (Date.now() > limite) break;
      await dormir(5000);
    }
    return productos;
  }

  async function pulirDesde(desde, esperados = 0) {
    setPulido({ corriendo: true, items: [], mensaje: 'Buscando productos nuevos en la tienda...' });
    try {
      const productos = await esperarListado(desde, esperados);
      if (!productos.length) {
        setPulido({ corriendo: false, items: [], mensaje: 'No hay productos pendientes de pulir en ese rango.' });
        return;
      }
      const items = productos.map((p) => ({ id: p.id, imagen: p.imagen, antes: p.titulo, estado: 'pendiente' }));
      const actualizar = (i, cambio) => {
        items[i] = { ...items[i], ...cambio };
        setPulido((s) => ({ ...s, items: [...items] }));
      };
      setPulido({ corriendo: true, items: [...items], mensaje: '' });
      for (let i = 0; i < items.length && !detenido.current; i++) {
        while (pulidoPausado.current && !detenido.current) await dormir(300);
        if (detenido.current) break;
        actualizar(i, { estado: 'activo' });
        try {
          const r = await llamarTienda({ method: 'POST', body: JSON.stringify({ id: items[i].id }) });
          actualizar(i, { estado: 'hecho', titulo: r.titulo, tipo: r.tipo, opciones: r.opciones });
        } catch (err) {
          actualizar(i, { estado: 'error', error: err.message });
        }
      }
      // Rezagados: los que Shopify listó mientras se pulía el resto.
      if (!detenido.current) {
        try {
          const ya = new Set(items.map((x) => x.id));
          const tarde = (await llamarTienda({}, `?desde=${encodeURIComponent(desde)}`)).productos.filter((p) => !ya.has(p.id));
          for (const p of tarde) {
            if (detenido.current) break;
            while (pulidoPausado.current && !detenido.current) await dormir(300);
            items.push({ id: p.id, imagen: p.imagen, antes: p.titulo, estado: 'activo' });
            const i = items.length - 1;
            setPulido((st) => ({ ...st, items: [...items] }));
            try {
              const r = await llamarTienda({ method: 'POST', body: JSON.stringify({ id: p.id }) });
              actualizar(i, { estado: 'hecho', titulo: r.titulo, tipo: r.tipo, opciones: r.opciones });
            } catch (err) {
              actualizar(i, { estado: 'error', error: err.message });
            }
          }
        } catch { /* sin rezagados */ }
      }
      const hechos = items.filter((x) => x.estado === 'hecho').length;
      const parado = detenido.current && hechos < items.length ? ' Se detuvo antes de terminar.' : '';
      setPulido({ corriendo: false, items: [...items], mensaje: `${hechos} de ${items.length} producto(s) pulido(s) en la tienda.${parado}` });
    } catch (err) {
      setPulido((s) => ({ ...s, corriendo: false, mensaje: `No se pudo pulir: ${err.message}` }));
    }
  }

  // Progreso que envía el estudio de video incrustado.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== ESTUDIO_ORIGEN || e.data?.origen !== 'prh-estudio') return;
      if (e.data.tipo === 'listo') {
        estudioListo.current = true;
        esperaEstudio.current.forEach((resolver) => resolver());
        esperaEstudio.current = [];
      } else if (e.data.tipo === 'auto-estado') {
        ultimoAutoEstado.current = Date.now();
        setVideos(e.data.estado);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Abre la sección Videos (el estudio graba en tiempo real y necesita estar visible) y le pide
  // 3 videos con productos al azar de esta importación.
  async function generarVideos(desde, esperados) {
    setVideos({ corriendo: true, terminado: false, resultados: [], log: ['Abriendo el estudio de video…'] });
    cambiarSeccion('videos');
    if (!estudioListo.current) {
      await Promise.race([
        new Promise((resolver) => esperaEstudio.current.push(resolver)),
        dormir(60000),
      ]);
    }
    const marco = iframeRef.current?.contentWindow;
    if (!estudioListo.current || !marco) {
      setVideos({ corriendo: false, terminado: true, resultados: [], log: ['No se pudo abrir el estudio de video. Recarga la página e inténtalo desde Videos.'] });
      return;
    }
    for (let intento = 0; intento < 2; intento++) {
      const enviado = Date.now();
      marco.postMessage({ origen: 'prh-panel', tipo: 'auto', desde, esperados, cantidad: 3 }, ESTUDIO_ORIGEN);
      while (Date.now() - enviado < 20000 && ultimoAutoEstado.current < enviado) await dormir(500);
      if (ultimoAutoEstado.current >= enviado) return;
    }
    setVideos({ corriendo: false, terminado: true, resultados: [], log: ['El estudio de video no respondió. Recarga la página e inténtalo desde Videos.'] });
  }

  // Cada empuje exitoso queda registrado: el estudio de video solo hace videos con esos productos.
  const registradas = useRef(new Set());
  useEffect(() => {
    const e = estado;
    if (!CON_CLAVE || !e?.inicio || e.corriendo || !e.empuje?.ok || registradas.current.has(e.inicio)) return;
    registradas.current.add(e.inicio);
    fetch('/api/importacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inicio: e.inicio, empujados: e.empuje.empujados }),
    }).catch(() => registradas.current.delete(e.inicio));
  }, [estado?.inicio, estado?.corriendo, estado?.empuje?.ok]);

  // Cadena automática al terminar un empuje exitoso: pulir lo que se acaba de subir y luego hacer los videos.
  useEffect(() => {
    const e = estado;
    if (!e?.inicio || e.corriendo || !e.empuje?.ok || pulidoDe.current === e.inicio) return;
    if (!(pulir && CON_CLAVE) && !(videosAuto && CON_CLAVE)) return;
    pulidoDe.current = e.inicio;
    const desde = new Date(new Date(e.inicio).getTime() - 2 * 60000).toISOString();
    (async () => {
      if (pulir && !detenido.current) await pulirDesde(desde, e.empuje.empujados);
      else if (videosAuto) await esperarListado(desde, e.empuje.empujados);
      while (pulidoPausado.current && !detenido.current) await dormir(300);
      if (videosAuto && !detenido.current) await generarVideos(desde, e.empuje.empujados);
    })();
  }, [estado?.inicio, estado?.corriendo, estado?.empuje?.ok, pulir, videosAuto]);

  const corriendo = !!estado?.corriendo;
  const pausado = Boolean((corriendo && estado?.pausado) || (pulido.corriendo && pausaPulido));
  const motivoBloqueo = !extension
    ? 'No se detecta la extensión: recárgala en chrome://extensions y luego recarga esta página.'
    : corriendo ? 'Hay una importación en curso.'
      : sala ? (links.length === 0 ? 'El cuadro del equipo está vacío: pega links o carga un .txt.' : '')
        : !nombreArchivo && !textoPegado.trim() ? 'Carga un archivo .txt o pega los links.'
          : links.length === 0 ? 'No hay links de AliExpress.' : '';
  // Si la lista cargada es la que se está importando, mostrar su estado por link.
  const resultadoDe = (url, i) => {
    if (!estado?.resultados) return 'pendiente';
    const pos = importados.length === estado.total ? importados.indexOf(url) : estado.total === links.length ? i : -1;
    return (pos >= 0 && estado.resultados[pos]) || 'pendiente';
  };
  const hechos = (estado?.resultados || []).filter((r) => r === 'hecho' || r === 'error').length;
  const pct = estado?.total ? Math.round((hechos / estado.total) * 100) : 0;

  return (
    <div className={`app${menuAbierto ? ' menu-abierto' : ''}`}>
      {/* Celular: barra superior con el botón del menú. */}
      <header className="barra-movil">
        <button className="sec icono" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
          <Menu size={20} />
        </button>
        <span>{TITULOS[seccion]}</span>
      </header>

      <aside className="lateral" aria-label="Menú">
        <div className="marca">
          <ListOrdered size={22} />
          <span>PRH · Panel</span>
          {esAdmin && CON_CLAVE && <Campana monitor={monitor} onAbrir={verInvitados} />}
          <button className="sec icono cerrar-menu" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        <nav className="secciones">
          <button className={seccion === 'importador' ? 'activa' : ''} onClick={() => cambiarSeccion('importador')}>
            <Store size={17} /> Importador
          </button>
          <button className={seccion === 'videos' ? 'activa' : ''} onClick={() => cambiarSeccion('videos')}>
            <Clapperboard size={17} /> Videos
          </button>
          {esAdmin && CON_CLAVE && (
            <button className={seccion === 'invitados' ? 'activa' : ''} onClick={verInvitados}>
              <Users size={17} /> Usuarios e invitados
              {monitor.solicitudes.length > 0 && <span className="pendientes" title="Solicitudes de acceso">{monitor.solicitudes.length}</span>}
              {monitor.conectados.length > 0 && <span className="en-linea" title="Conectados">{monitor.conectados.length}</span>}
            </button>
          )}
          {esAdmin && CON_CLAVE && (
            <button className={seccion === 'invitar' ? 'activa' : ''} onClick={() => cambiarSeccion('invitar')}>
              <UserPlus size={17} /> Invitar
              {monitor.invitaciones.length > 0 && <span className="en-linea" title="Invitaciones vigentes">{monitor.invitaciones.length}</span>}
            </button>
          )}
        </nav>
        {esInvitado && <p className="quien">Invitado: <b>{sesion.nombre}</b></p>}
        {/* Pedidos va abajo, justo encima de la línea de los enlaces. */}
        {(esAdmin || colaborando) && (
          <nav className="secciones abajo">
            <button className={seccion === 'pedidos' ? 'activa' : ''} onClick={() => cambiarSeccion('pedidos')}>
              <ShoppingCart size={17} /> Pedidos
              {pedidos.pendientes > 0 && <span className="pendientes" title="Pedidos por despachar">{pedidos.pendientes}</span>}
            </button>
          </nav>
        )}
        <div className="lateral-pie">
          <a className="enlace" href={DSERS_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Abrir DSers
          </a>
          {esAdmin && !ES_MOVIL && <CuentaDsers enviar={enviar} extension={extension} versionExt={versionExt} />}
          <a className="enlace" href={ESTUDIO_URL} target="_blank" rel="noreferrer" title="Para conectar y publicar en redes">
            <ExternalLink size={15} /> Abrir estudio
          </a>
          {CON_CLAVE && (
            <button className="enlace" onClick={salir}>
              <LogOut size={15} /> Cerrar sesión
            </button>
          )}
        </div>
      </aside>
      <div className="fondo-menu" onClick={() => setMenuAbierto(false)} />

      <div className="contenido">
      {esAdmin && CON_CLAVE && <Emergentes monitor={monitor} onAbrir={verInvitados} />}
      {invitacionAdmin && esInvitado && (
        <div className="fondo-invitacion">
          <div className="invitacion-usuario" role="dialog" aria-modal="true" aria-labelledby="titulo-invitacion">
            <UserPlus size={26} />
            <h2 id="titulo-invitacion">El administrador te invita a colaborar</h2>
            <p>
              Si aceptas, compartirán en tiempo real la lista de links de productos del Importador: lo que pegue
              cualquiera de los dos aparece en ambas pantallas. Dura hasta el{' '}
              <b>{new Date(invitacionAdmin.vence).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</b>.
            </p>
            <div className="fila">
              <button onClick={() => responder(true)} disabled={respondiendo}><Check size={16} /> Aceptar</button>
              <button className="sec" onClick={() => responder(false)} disabled={respondiendo}><X size={16} /> Rechazar</button>
            </div>
          </div>
        </div>
      )}
      {esAdmin && CON_CLAVE && <ChatsAdmin monitor={monitor} />}
      {esInvitado && (
        <div className="chat-zona">
          {chatAbierto ? (
            <VentanaChat
              titulo="Administrador"
              mensajes={chatMensajes}
              onEnviar={escribirAlAdmin}
              onCerrar={() => setChatAbierto(false)}
              enfocar
            />
          ) : (
            <BotonChat onClick={() => { setChatAbierto(true); setChatSinLeer(0); }} pendientes={chatSinLeer} />
          )}
        </div>
      )}
      {avisoAdmin && (
        <div className="aviso-admin" role="alert">
          <MessageSquare size={18} />
          <div>
            <b>{avisoAdmin.titulo}</b>
            <span>{avisoAdmin.texto}</span>
          </div>
          <button className="sec icono" onClick={() => setAvisoAdmin(null)} aria-label="Cerrar"><X size={16} /></button>
        </div>
      )}
      {seccion === 'invitados' && esAdmin && (
        <SeccionInvitados monitor={monitor} />
      )}
      {seccion === 'pedidos' && (esAdmin || colaborando) && (
        <SeccionPedidos pedidos={pedidos} enviar={enviar} extension={extension} versionExt={versionExt} descargarExtension={descargarExtension} importando={!!estado?.corriendo} />
      )}
      {seccion === 'invitar' && esAdmin && (
        <SeccionInvitar monitor={monitor} sala={sala} onIrImportador={() => cambiarSeccion('importador')} />
      )}
      {/* El estudio de video (PRH AI Video) se carga la primera vez que se abre y queda vivo al cambiar de sección. */}
      {estudioCargado && (
        <section className="estudio" hidden={seccion !== 'videos'}>
          {videos && !videos.terminado && (
            <p className="estudio-nota activo">
              Generando los videos automáticos: deja esta pestaña abierta y visible hasta que terminen.
              {videos.log?.length ? ` · ${videos.log[videos.log.length - 1].replace(/^\[[^\]]*\]\s*/, '')}` : ''}
            </p>
          )}
          <iframe
            ref={iframeRef}
            src={ESTUDIO_URL}
            title="PRH AI Video"
            allow="autoplay; fullscreen; clipboard-write; screen-wake-lock"
          />
        </section>
      )}

      <main hidden={seccion !== 'importador'}>
        {!extension && ES_MOVIL && (
          <section className="card card-aviso">
            <h2><Smartphone size={18} /> Estás en el celular</h2>
            <p className="sub">
              Importar a DSers y empujar a la tienda necesita Chrome en un PC (usa una extensión).
              Desde aquí puedes usar <b>Videos</b> (crear, ver y generar los automáticos) y <b>Pulir pendientes</b> en la sección 3.
            </p>
          </section>
        )}
        {!extension && !ES_MOVIL && (
          <section className="card card-aviso">
            <h2><Puzzle size={18} /> Falta la extensión de Chrome</h2>
            <p className="sub">
              Es la que importa en una pestaña de tu Chrome sin usar tu mouse ni teclado.
              Se instala una vez en cada PC (Chrome o Edge de escritorio; no funciona en celular).
            </p>
            <div className="fila espacio">
              <button onClick={descargarExtension}>
                <Download size={16} /> Descargar extensión (.zip)
              </button>
            </div>
            <ol className="pasos">
              <li>Descomprime el .zip (clic derecho → <b>Extraer todo</b>). Queda una carpeta <code>dsers-importador</code>; guárdala donde no la borres.</li>
              <li>Abre <code>chrome://extensions</code> y activa <b>Modo de desarrollador</b> (arriba a la derecha).</li>
              <li>Pulsa <b>Cargar descomprimida</b> y elige la carpeta <code>dsers-importador</code> que extrajiste (la que contiene <code>manifest.json</code>).</li>
              <li>Recarga esta página.</li>
            </ol>
          </section>
        )}

        <section className="card">
          <h2>
            <FileText size={18} /> 1. Carga tu archivo .txt o pega los links
            {sala && <span className="etiqueta-compartida"><Users size={13} /> Trabajo en equipo</span>}
          </h2>
          {sala ? (
            <div className="equipo">
              {companeros.length ? (
                <>
                  <span className="en-vivo-punto" /> Estás con{' '}
                  {companeros.map((n, i) => (
                    <span key={n}>
                      {i > 0 && (i === companeros.length - 1 ? ' y ' : ', ')}
                      <b className="companero" style={{ '--color': colorDe(n) }}>{n === 'Admin' ? 'el Admin' : n}</b>
                    </span>
                  ))}
                </>
              ) : (
                <span className="muted">{esAdmin ? 'Esperando a que acepten tu invitación…' : 'Esperando al admin…'}</span>
              )}
            </div>
          ) : (
            <p className="sub">Un link de AliExpress por línea.</p>
          )}
          <div className="fila">
            <input ref={inputArchivo} type="file" accept=".txt,text/plain" hidden onChange={cargarArchivo} />
            <button className="sec" onClick={() => inputArchivo.current.click()} disabled={corriendo}>
              <Upload size={16} /> Elegir archivo
            </button>
            {sala && links.length > 0 && (
              <button className="sec" onClick={() => confirm('¿Vaciar el cuadro para los dos?') && cambiarTextoEquipo('')} disabled={corriendo}>
                <X size={16} /> Vaciar lista
              </button>
            )}
            <span className="muted">
              {sala ? (notaSala || `${links.length} link(s) en el cuadro del equipo`)
                : nombreArchivo ? `${nombreArchivo} · ${links.length} link(s) de AliExpress`
                : textoPegado.trim() ? `Texto pegado · ${links.length} link(s) de AliExpress` : 'Ningún archivo cargado.'}
            </span>
          </div>
          <label className="log-titulo pegar" htmlFor="links-pegados"><ClipboardPaste size={15} /> {sala ? 'Pega aquí los links (compartido en tiempo real)' : 'O pega aquí los links'}</label>
          <textarea
            id="links-pegados"
            value={textoPegado}
            onChange={pegarLinks}
            disabled={corriendo}
            rows={4}
            placeholder="https://es.aliexpress.com/item/1005001234567890.html"
          />
          {links.length > 0 && (
            <ul className={`lista${sala ? ' lista-equipo' : ''}`}>
              {links.map((l, i) => {
                const r = resultadoDe(l, i);
                const info = sala?.infoDe(l);
                return (
                  <li key={sala ? l : i} className={`${r}${info && sala.esNuevo(info) ? ' nuevo' : ''}`} style={info ? { '--color': colorDe(info.por) } : undefined}>
                    <span className="num">{i + 1}</span>
                    {ICONO_ESTADO[r]}
                    <a href={l} target="_blank" rel="noreferrer"><Link2 size={14} /> {l}</a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2><Play size={18} /> 2. Importar</h2>
          <p className="sub">
            Se abre DSers en una pestaña nueva de este Chrome y se importa un link a la vez,
            esperando 5 segundos entre cada uno. Puedes seguir usando el PC mientras tanto.
          </p>
          <label className="opcion">
            <input type="checkbox" checked={empujar} onChange={cambiarEmpujar} disabled={corriendo} />
            <Store size={16} />
            <span>
              <b>Empujar a la tienda al terminar</b>
              <small>Selecciona los productos nuevos, pulsa PUSH TO STORE y luego EMPUJAR A LA TIENDA.</small>
            </span>
          </label>
          <label className="opcion">
            <input type="checkbox" checked={pulir && empujar && CON_CLAVE} onChange={cambiarPulir} disabled={corriendo || !empujar || !CON_CLAVE} />
            <Sparkles size={16} />
            <span>
              <b>Pulir en la tienda con IA</b>
              <small>
                {CON_CLAVE
                  ? 'Al empujar, deja cada producto con nombre breve, descripción en español al estilo de la tienda, categoría, URL y SEO.'
                  : 'Disponible solo en la versión publicada (necesita las claves de Shopify y Gemini).'}
              </small>
            </span>
          </label>
          <label className="opcion">
            <input type="checkbox" checked={videosAuto && empujar && CON_CLAVE} onChange={cambiarVideosAuto} disabled={corriendo || !empujar || !CON_CLAVE} />
            <Clapperboard size={16} />
            <span>
              <b>Crear y publicar 3 videos con los productos importados</b>
              <small>
                {CON_CLAVE
                  ? 'Al terminar, elige 3 productos al azar de esta importación, les pone sus fotos y datos, genera los videos y los publica (pasan a Subidos).'
                  : 'Disponible solo en la versión publicada.'}
              </small>
            </span>
          </label>
          <div className="fila">
            <button onClick={importar} disabled={!!motivoBloqueo}>
              <Play size={16} /> Importar a DSers
            </button>
            {pausado ? (
              <button className="sec" onClick={reanudarTodo} disabled={pausaAdmin} title={pausaAdmin ? 'Solo el administrador puede reanudar' : ''}>
                <Play size={16} /> Reanudar
              </button>
            ) : (
              <button className="sec" onClick={() => pausarTodo()} disabled={!corriendo && !pulido.corriendo}>
                <Pause size={16} /> Pausar
              </button>
            )}
            <button className="sec" onClick={detenerTodo} disabled={!corriendo && !pulido.corriendo}>
              <Square size={16} /> Detener
            </button>
            {pausado && <span className="etiqueta-pausa">{pausaAdmin ? 'En pausa por el administrador' : 'En pausa'}</span>}
            {estado?.total > 0 && <span className="muted">{hechos}/{estado.total}</span>}
            {motivoBloqueo && !corriendo && <span className="muted">{motivoBloqueo}</span>}
          </div>
          <div className="barra"><div style={{ width: `${pct}%` }} /></div>
          {estado?.empuje && (
            <div className={`resultado ${estado.empuje.ok ? 'exito' : 'fallo'}`}>
              {estado.empuje.ok ? <Check size={20} /> : <TriangleAlert size={20} />}
              <div>
                <b>
                  {estado.empuje.ok
                    ? `${estado.empuje.empujados} producto(s) empujado(s) a la tienda exitosamente`
                    : 'No se pudo empujar a la tienda'}
                </b>
                <small>
                  {estado.empuje.ok
                    ? `${estado.empuje.empujados} de ${estado.empuje.total}${estado.empuje.errores ? ` · ${estado.empuje.errores} con error` : ''} · el panel de DSers se cerró.`
                    : estado.empuje.error}
                </small>
              </div>
            </div>
          )}
          <div className="log-titulo"><Terminal size={15} /> Registro</div>
          <pre ref={logRef}>{estado?.log?.length ? estado.log.join('\n') : 'Esperando...'}</pre>
          {videos && (
            <>
              <div className="log-titulo pegar"><Clapperboard size={15} /> Videos automáticos</div>
              <pre>{videos.log?.join('\n') || 'Esperando...'}</pre>
              {!videos.terminado && (
                <button className="sec ver-videos" onClick={() => cambiarSeccion('videos')}>
                  <Clapperboard size={16} /> Ver cómo se generan
                </button>
              )}
            </>
          )}
        </section>

        <section className="card">
          <h2><Sparkles size={18} /> 3. Pulir en la tienda</h2>
          <p className="sub">
            Reescribe con IA los productos de Shopify que aún no se han pulido: nombre breve, descripción en español
            con características y especificaciones, categoría, URL y SEO. Se hace solo después de empujar; aquí puedes
            lanzarlo a mano para productos creados desde una fecha.
          </p>
          <div className="fila">
            <CalendarDays size={16} className="muted" />
            <input type="date" value={fechaPulir} max={hoy()} onChange={(e) => setFechaPulir(e.target.value)} disabled={pulido.corriendo} />
            <button onClick={() => { detenido.current = false; pulirDesde(new Date(`${fechaPulir}T00:00:00`).toISOString()); }} disabled={pulido.corriendo || !CON_CLAVE || !fechaPulir}>
              <Sparkles size={16} /> Pulir pendientes
            </button>
            {pulido.mensaje && <span className="muted">{pulido.mensaje}</span>}
          </div>
          {pulido.items.length > 0 && (
            <ul className="lista pulido">
              {pulido.items.map((p, i) => (
                <li key={p.id} className={p.estado}>
                  <span className="num">{i + 1}</span>
                  {ICONO_ESTADO[p.estado]}
                  {p.imagen && <img src={p.imagen} alt="" />}
                  <span className="textos">
                    <b>{p.titulo || p.antes}</b>
                    <small>
                      {p.estado === 'hecho' ? `Antes: ${p.antes}${p.tipo ? ` · ${p.tipo}` : ''}${p.opciones?.length ? ` · ${p.opciones.join(', ')}` : ''}`
                        : p.estado === 'error' ? p.error
                          : p.estado === 'activo' ? 'Redactando...' : 'En espera'}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      </div>
    </div>
  );
}
