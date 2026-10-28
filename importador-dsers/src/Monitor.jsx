// Panel del administrador para los invitados (su pantalla solo se ve cuando eliges «Ver en tiempo real»):
// - useMonitor: consulta /api/monitor cada 2,5 s (solicitudes, invitados, bloqueos, avisos), suena y avisa.
// - Campana y Emergentes: las solicitudes de acceso llegan aquí para aceptarlas o rechazarlas desde cualquier dispositivo.
// - SeccionInvitados: solicitudes, conectados y recientes (menú de tres puntos: ver en tiempo real, parar,
//   mensaje, sacar, bloquear, borrar usuario) y bloqueados.
import { useEffect, useRef, useState } from 'react';
import { BotonChat, VentanaChat } from './Chat.jsx';
import {
  ArrowLeft, Ban, Bell, BellRing, Check, Eye, KeyRound, LogOut, MessageSquare, MoreVertical, Pause, Play, Send, ShieldCheck, Square, Trash2, UserPlus, Users, Volume2, X,
} from 'lucide-react';

const CONSULTA_MS = 2500;

// ---------- Sonido (Web Audio, sin archivos) ----------
// El navegador solo deja sonar después de un clic en la página: se habilita con el primer clic o toque.
// Pasa por un compresor para que suene fuerte sin distorsionar.
let audio = null;
let salida = null;
function contextoAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) {
    audio = new Ctx();
    salida = audio.createDynamicsCompressor();
    salida.threshold.value = -18;
    salida.ratio.value = 6;
    const maestro = audio.createGain();
    maestro.gain.value = 1.6;
    salida.connect(maestro).connect(audio.destination);
  }
  return audio;
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => contextoAudio()?.resume().catch(() => {}), { once: false, passive: true });
}

// Nota con su armónico (más presente que un seno puro, se oye bien en altavoces de celular).
function tono(ctx, frecuencia, inicio, duracion, volumen = 0.6) {
  for (const [mult, tipo, vol] of [[1, 'triangle', volumen], [2, 'sine', volumen * 0.35]]) {
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia * mult;
    gan.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
    gan.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + inicio + 0.015);
    gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracion);
    osc.connect(gan).connect(salida);
    osc.start(ctx.currentTime + inicio);
    osc.stop(ctx.currentTime + inicio + duracion + 0.05);
  }
}

// Solicitud: campanita de 3 notas tres veces · salida: dos notas hacia abajo · otro aviso: dos notas cortas.
function sonar(tipo) {
  const ctx = contextoAudio();
  if (!ctx || ctx.state !== 'running') return false;
  if (tipo === 'solicitud') {
    [0, 0.7, 1.4].forEach((t) => [784, 988, 1319].forEach((f, i) => tono(ctx, f, t + i * 0.13, 0.5)));
    navigator.vibrate?.([200, 100, 200, 100, 200]);
  } else if (tipo === 'compra') {
    // Compra nueva en la tienda: "caja registradora" de 4 notas subiendo, dos veces.
    [0, 0.75].forEach((t) => [1047, 1319, 1568, 2093].forEach((f, i) => tono(ctx, f, t + i * 0.09, 0.4, 0.5)));
    navigator.vibrate?.([120, 60, 120]);
  } else if (tipo === 'salida' || tipo === 'sacado' || tipo === 'bloqueado') {
    [660, 440].forEach((f, i) => tono(ctx, f, i * 0.18, 0.4, 0.45));
  } else {
    [988, 1319].forEach((f, i) => tono(ctx, f, i * 0.12, 0.3, 0.45));
  }
  return true;
}

const hora = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const haceCuanto = (ts) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const NOMBRES_SECCION = { importador: 'Importador', videos: 'Videos' };

// "Chrome · Windows", "Safari · iPhone"…
function dispositivo(agente = '') {
  const so = /iPhone/.test(agente) ? 'iPhone' : /iPad/.test(agente) ? 'iPad' : /Android/.test(agente) ? 'Android'
    : /Windows/.test(agente) ? 'Windows' : /Mac OS/.test(agente) ? 'Mac' : /Linux/.test(agente) ? 'Linux' : '';
  const nav = /Edg\//.test(agente) ? 'Edge' : /OPR\//.test(agente) ? 'Opera' : /Chrome\//.test(agente) ? 'Chrome'
    : /Firefox\//.test(agente) ? 'Firefox' : /Safari\//.test(agente) ? 'Safari' : '';
  return [nav, so].filter(Boolean).join(' · ') || 'Dispositivo desconocido';
}

// Sigue dentro de la app pero su pestaña está en segundo plano (el navegador espacia los latidos).
const segundoPlano = (p) => Date.now() - new Date(p.ultimo_latido).getTime() > 30000;

// Lo que está haciendo un invitado conectado (lo envía su página en cada latido).
function trabajoDe(p) {
  const t = p.trabajo || {};
  const partes = [];
  if (t.importando) partes.push(`Importando ${t.importando.actual}/${t.importando.total}`);
  if (t.puliendo) partes.push('Puliendo en la tienda');
  if (partes.length && t.pausado) partes.push('EN PAUSA');
  return partes.join(' · ');
}

// ---------- Datos ----------
// Un mismo @usuario puede tener varias sesiones abiertas (pestañas o equipos): se muestra una sola tarjeta,
// la de la sesión que trabaja (o la más reciente). Las acciones del admin alcanzan todas sus sesiones.
function unaPorUsuario(lista) {
  const porNombre = new Map();
  for (const p of lista) {
    const actual = porNombre.get(p.nombre);
    const trabaja = (x) => Boolean(x.trabajo?.importando || x.trabajo?.puliendo);
    if (!actual || (trabaja(p) && !trabaja(actual))
      || (trabaja(p) === trabaja(actual) && new Date(p.ultimo_latido) > new Date(actual.ultimo_latido))) {
      porNombre.set(p.nombre, p);
    }
  }
  return [...porNombre.values()];
}

// Último aviso que el admin ya vio (por dispositivo): el contador de la campana sobrevive a recargas.
const CLAVE_LEIDO = 'prh_aviso_leido';
const leerLeido = () => { try { return Number(localStorage.getItem(CLAVE_LEIDO)) || 0; } catch { return 0; } };

export function useMonitor(activo) {
  const [datos, setDatos] = useState({ solicitudes: [], personas: [], bloqueos: [], invitaciones: [] });
  const [avisos, setAvisos] = useState([]); // más reciente primero
  const [leido, setLeido] = useState(leerLeido);
  const [emergentes, setEmergentes] = useState([]);
  const [sonidoBloqueado, setSonidoBloqueado] = useState(false);
  const [ocupado, setOcupado] = useState(''); // "<accion>:<sid>" mientras se envía una acción
  const [chats, setChats] = useState({}); // { [nombre]: { sid, nombre, mensajes: [{ mio, texto, ts }], abierto, sinLeer } }
  const [chatPanel, setChatPanel] = useState(false); // ventana de chats abierta (si no, solo el botón)
  const [chatActivo, setChatActivo] = useState(null); // pestaña elegida
  const chatPanelRef = useRef(false);
  chatPanelRef.current = chatPanel;
  const ultimoId = useRef(-1); // -1 = aún no se ha cargado (lo de antes no suena)
  const consultarRef = useRef(() => {});

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    const consultar = async () => {
      try {
        const r = await fetch('/api/monitor', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (!vivo) return;
        setDatos({ solicitudes: d.solicitudes || [], personas: d.personas || [], bloqueos: d.bloqueos || [], invitaciones: d.invitaciones || [] });
        const lista = d.eventos || [];
        setAvisos(lista);
        const primeraCarga = ultimoId.current < 0;
        const nuevos = primeraCarga ? [] : lista.filter((e) => e.id > ultimoId.current).reverse();
        ultimoId.current = Math.max(ultimoId.current, lista[0]?.id || 0);
        if (!nuevos.length) return;
        // Un sonido por cada notificación nueva (seguidos, hasta 5 para no saturar).
        setSonidoBloqueado(!sonar(nuevos[0].tipo));
        nuevos.slice(1, 5).forEach((e, i) => setTimeout(() => sonar(e.tipo), (i + 1) * 1800));
        // Las solicitudes tienen su propia tarjeta fija; el resto aparece unos segundos.
        for (const e of nuevos.filter((x) => x.tipo === 'mensaje')) {
          setChats((c) => {
            const chat = c[e.nombre] || { nombre: e.nombre, mensajes: [], sinLeer: 0 };
            return { ...c, [e.nombre]: { ...chat, sid: e.sid, abierto: true, sinLeer: (chat.sinLeer || 0) + 1, mensajes: [...chat.mensajes, { mio: false, texto: e.mensaje, ts: e.ts }] } };
          });
          // Si la ventana estaba cerrada, se abre en la conversación del que escribió.
          if (!chatPanelRef.current) { setChatActivo(e.nombre); setChatPanel(true); }
          cargarHistorial(e.nombre); // con lo anterior guardado, no solo el mensaje nuevo
        }
        for (const e of nuevos.filter((x) => x.tipo !== 'solicitud' && x.tipo !== 'mensaje')) {
          setEmergentes((l) => [...l, e].slice(-4));
          setTimeout(() => setEmergentes((l) => l.filter((x) => x.id !== e.id)), 6000);
        }
        if (document.hidden && window.Notification?.permission === 'granted') {
          for (const e of nuevos.slice(-3)) {
            const solicitud = e.tipo === 'solicitud';
            const n = new Notification(solicitud ? 'PRH · Solicitud de acceso' : e.tipo === 'compra' ? 'PRH · Nueva compra en la tienda' : 'PRH · Invitados', {
              body: solicitud ? `${e.texto}. Abre el panel para aceptar o rechazar.` : e.texto,
              tag: `prh-${e.id}`,
              requireInteraction: solicitud,
            });
            n.onclick = () => { window.focus(); n.close(); };
          }
        }
      } catch { /* sin conexión: se reintenta */ }
    };
    consultarRef.current = consultar;
    consultar();
    const id = setInterval(consultar, CONSULTA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [activo]);

  async function accion(nombre, cuerpo = {}) {
    setOcupado(`${nombre}:${cuerpo.sid || cuerpo.ip || ''}`);
    try {
      const r = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: nombre, ...cuerpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) alert(d.error || 'No se pudo completar la acción.');
      return r.ok ? d : false; // en éxito, la respuesta (p. ej. el id de una invitación nueva)
    } catch {
      alert('Sin conexión. Intenta de nuevo.');
      return false;
    } finally {
      setOcupado('');
      consultarRef.current();
    }
  }

  // Borra notificaciones (todas o las elegidas); se quitan al instante de la lista.
  // Chats: una ventana con una pestaña por usuario. abrirChat (desde el menú de tres puntos) abre su pestaña.
  // Al abrir una conversación se carga la guardada en el servidor (prh_chat: no se borra nunca).
  async function cargarHistorial(nombre) {
    try {
      const r = await fetch(`/api/monitor?chat=${encodeURIComponent(nombre)}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) return;
      const mensajes = (d.mensajes || []).map((m) => ({ mio: m.de === 'admin', texto: m.texto, ts: m.ts }));
      setChats((c) => ({ ...c, [nombre]: { ...c[nombre], mensajes } }));
    } catch { /* sin conexión */ }
  }
  function abrirChat(p) {
    setChats((c) => ({ ...c, [p.nombre]: { mensajes: [], sinLeer: 0, ...c[p.nombre], nombre: p.nombre, sid: p.sid, abierto: true } }));
    setChatActivo(p.nombre);
    setChatPanel(true);
    cargarHistorial(p.nombre);
  }
  // Todas las conversaciones guardadas (para retomarlas aunque el usuario no esté o ya no exista).
  const [conversaciones, setConversaciones] = useState([]);
  useEffect(() => {
    if (!chatPanel) return;
    fetch('/api/monitor?conversaciones=1', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => setConversaciones(d.conversaciones || [])).catch(() => {});
  }, [chatPanel]);
  async function enviarChat(nombre, texto) {
    const chat = chats[nombre];
    if (!chat || !(await accion('mensaje', { usuario: nombre, texto }))) return false;
    setChats((c) => ({ ...c, [nombre]: { ...c[nombre], mensajes: [...c[nombre].mensajes, { mio: true, texto, ts: Date.now() }] } }));
    return true;
  }
  // Quita la pestaña (los mensajes se guardan por si se vuelve a abrir).
  function cerrarChat(nombre) {
    setChats((c) => ({ ...c, [nombre]: { ...c[nombre], abierto: false } }));
    if (chatActivo === nombre) setChatActivo(Object.values(chats).find((c) => c.abierto && c.nombre !== nombre)?.nombre || null);
  }
  // La pestaña que se está viendo no tiene mensajes sin leer.
  useEffect(() => {
    if (chatPanel && chatActivo && chats[chatActivo]?.sinLeer) {
      setChats((c) => ({ ...c, [chatActivo]: { ...c[chatActivo], sinLeer: 0 } }));
    }
  }, [chatPanel, chatActivo, chats]);

  function borrarAvisos(ids) {
    setAvisos((a) => (ids ? a.filter((x) => !ids.includes(x.id)) : []));
    return accion('borrarAvisos', ids ? { ids } : { todos: true });
  }

  return {
    ...datos,
    conectados: unaPorUsuario(datos.personas.filter((p) => p.en_linea && p.acceso === 'aprobado')),
    avisos,
    noLeidos: avisos.filter((a) => a.id > leido).length,
    emergentes,
    sonidoBloqueado,
    ocupado,
    accion,
    borrarAvisos,
    chats: Object.values(chats).filter((c) => c.abierto),
    chatPanel,
    chatActivo,
    conversaciones,
    setChatPanel,
    setChatActivo,
    abrirChat,
    enviarChat,
    cerrarChat,
    marcarLeidos: () => {
      const max = Math.max(leido, avisos[0]?.id || 0);
      setLeido(max);
      try { localStorage.setItem(CLAVE_LEIDO, String(max)); } catch { /* sin storage */ }
    },
    probarSonido: () => {
      contextoAudio()?.resume().then(() => setSonidoBloqueado(!sonar('solicitud'))).catch(() => {});
      if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    },
  };
}

// Aceptar / rechazar una solicitud (en la campana, en la tarjeta emergente y en la sección).
function BotonesSolicitud({ monitor, s, conBloquear = false }) {
  const ocupado = monitor.ocupado.endsWith(`:${s.sid}`);
  return (
    <div className="botones-solicitud">
      <button onClick={() => monitor.accion('aceptar', { sid: s.sid })} disabled={ocupado}>
        <Check size={15} /> Aceptar
      </button>
      <button className="sec" onClick={() => monitor.accion('rechazar', { sid: s.sid })} disabled={ocupado}>
        <X size={15} /> Rechazar
      </button>
      {conBloquear && (
        <button
          className="sec peligro"
          onClick={() => confirm(`¿Bloquear a ${s.nombre}? No podrá volver a pedir acceso desde ese dispositivo/red.`) && monitor.accion('bloquear', { sid: s.sid })}
          disabled={ocupado}
        >
          <Ban size={15} /> Bloquear
        </button>
      )}
    </div>
  );
}

// ---------- Campana ----------
// Contador = avisos sin ver (se oculta en 0). Manteniendo presionada una notificación 1 s se entra
// en modo selección; el botón Borrar aparece cuando hay al menos una elegida.
const PRESION_MS = 1000;

export function Campana({ monitor, onAbrir }) {
  const [abierta, setAbierta] = useState(false);
  const [seleccion, setSeleccion] = useState(null); // null = modo normal; Set de ids = eligiendo
  const presion = useRef({ timer: 0, x: 0, y: 0, larga: false });
  const { avisos, noLeidos, sonidoBloqueado, solicitudes } = monitor;
  // Solo lo que no has visto: al abrir el panel queda en 0 y se oculta; cada aviso nuevo suma desde 1.
  const total = noLeidos;

  const alternar = () => {
    setAbierta((a) => !a);
    setSeleccion(null);
    monitor.marcarLeidos();
  };
  // Mientras está abierta, lo que llega también queda como leído.
  useEffect(() => {
    if (abierta && noLeidos) monitor.marcarLeidos();
  }, [abierta, noLeidos]);

  const alternarId = (id) => setSeleccion((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  function empezarPresion(e, id) {
    clearTimeout(presion.current.timer);
    presion.current = {
      x: e.clientX, y: e.clientY, larga: false,
      timer: setTimeout(() => {
        presion.current.larga = true;
        navigator.vibrate?.(30);
        setSeleccion((s) => new Set([...(s || []), id]));
      }, PRESION_MS),
    };
  }
  const cancelarPresion = () => clearTimeout(presion.current.timer);
  function moverPresion(e) {
    if (Math.abs(e.clientX - presion.current.x) > 10 || Math.abs(e.clientY - presion.current.y) > 10) cancelarPresion();
  }
  function clicAviso(id) {
    if (presion.current.larga) { presion.current.larga = false; return; } // fue una pulsación larga
    if (seleccion) alternarId(id);
    else { setAbierta(false); onAbrir(); }
  }

  async function borrarSeleccion() {
    const ids = [...seleccion];
    setSeleccion(null);
    if (ids.length) await monitor.borrarAvisos(ids);
  }

  return (
    <div className="campana">
      <button className={`sec icono${total ? ' con-avisos' : ''}`} onClick={alternar} aria-label={`Notificaciones (${total})`} title="Notificaciones">
        {total ? <BellRing size={18} /> : <Bell size={18} />}
        {total > 0 && <span className="globo">{total > 99 ? '99+' : total}</span>}
      </button>
      {abierta && (
        <div className="campana-panel">
          {seleccion ? (
            <div className="campana-cabeza seleccionando">
              <button className="sec icono" onClick={() => setSeleccion(null)} aria-label="Cancelar selección"><X size={16} /></button>
              <b>{seleccion.size} seleccionada(s)</b>
              <button className="sec mini" onClick={() => setSeleccion(seleccion.size === avisos.length ? new Set() : new Set(avisos.map((a) => a.id)))}>
                {seleccion.size === avisos.length ? 'Ninguna' : 'Todas'}
              </button>
              {seleccion.size > 0 && (
                <button className="sec mini peligro" onClick={borrarSeleccion}>
                  <Trash2 size={14} /> Borrar
                </button>
              )}
            </div>
          ) : (
            <div className="campana-cabeza">
              <b>Notificaciones</b>
              <button className="sec icono" onClick={() => setAbierta(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
          )}
          {(sonidoBloqueado || window.Notification?.permission === 'default') && (
            <button className="sec activar-sonido" onClick={monitor.probarSonido}>
              <Volume2 size={15} /> Activar sonido y avisos del sistema
            </button>
          )}
          {solicitudes.length > 0 && !seleccion && (
            <ul className="solicitudes-campana">
              {solicitudes.map((s) => (
                <li key={s.sid} className="solicitud">
                  <span className="aviso-texto"><UserPlus size={15} /> <b>{s.nombre}</b> pide permiso para entrar</span>
                  <small>{dispositivo(s.agente)} · {haceCuanto(s.inicio)}</small>
                  <BotonesSolicitud monitor={monitor} s={s} />
                </li>
              ))}
            </ul>
          )}
          {avisos.length === 0 && solicitudes.length === 0 ? (
            <p className="muted vacio">No hay notificaciones.</p>
          ) : (
            <ul>
              {avisos.length > 0 && !seleccion && <li className="pista">Mantén presionada una notificación para elegir cuáles borrar.</li>}
              {avisos.map((a) => (
                <li key={a.id}>
                  <button
                    className={`aviso tipo-${a.tipo}${seleccion?.has(a.id) ? ' elegida' : ''}`}
                    onPointerDown={(e) => empezarPresion(e, a.id)}
                    onPointerUp={cancelarPresion}
                    onPointerLeave={cancelarPresion}
                    onPointerCancel={cancelarPresion}
                    onPointerMove={moverPresion}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => clicAviso(a.id)}
                  >
                    {seleccion && <span className="casilla">{seleccion.has(a.id) && <Check size={13} />}</span>}
                    <span className="aviso-cuerpo">
                      <span className="aviso-texto">{a.texto}</span>
                      <small>{hora(a.ts)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Solicitudes (fijas hasta responderlas) y avisos que aparecen unos segundos en la esquina.
export function Emergentes({ monitor, onAbrir }) {
  return (
    <div className="emergentes" aria-live="polite">
      {monitor.solicitudes.map((s) => (
        <div key={s.sid} className="emergente tipo-solicitud">
          <UserPlus size={16} />
          <div className="emergente-cuerpo">
            <span><b>{s.nombre}</b> pide permiso para entrar</span>
            <small>{dispositivo(s.agente)} · {haceCuanto(s.inicio)}</small>
            <BotonesSolicitud monitor={monitor} s={s} />
          </div>
        </div>
      ))}
      {monitor.emergentes.map((e) => (
        <button key={e.id} className={`emergente tipo-${e.tipo}`} onClick={onAbrir}>
          <BellRing size={16} />
          <span>{e.texto}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Sección Usuarios e invitados ----------
// Dos lados: «Usuarios» (entraron con @usuario y PIN y les diste acceso) e «Invitados» (los que invitaste
// desde Invitar y aceptaron la invitación).
export function SeccionInvitados({ monitor }) {
  const [viendo, setViendo] = useState(null); // sid del invitado que se ve en tiempo real
  const { solicitudes, personas, bloqueos, conectados, invitaciones = [] } = monitor;
  if (viendo) return <VistaEnVivo monitor={monitor} sid={viendo} onVolver={() => setViendo(null)} />;

  // Recientes: la última sesión de cada persona que ya no está conectada.
  const nombresConectados = new Set(conectados.map((p) => p.nombre));
  const vistos = new Set();
  const recientes = personas.filter((p) => {
    if (conectados.includes(p) || nombresConectados.has(p.nombre) || vistos.has(p.nombre)) return false;
    vistos.add(p.nombre);
    return true;
  });

  // Invitados: su sesión va ligada a una invitación o tienen una invitación aceptada vigente.
  const aceptadas = invitaciones.filter((i) => i.respuesta === 'aceptada');
  const nombresInvitados = new Set(aceptadas.map((i) => i.usuario));
  const esInvitado = (p) => Boolean(p.invitacion) || nombresInvitados.has(p.nombre);
  // Usuarios: todos. Invitados: además, los que invitaste (siguen en Usuarios). «En compartido» = con
  // invitación aceptada vigente; si los sacas, quedan en Invitados pero ya no se pueden sacar otra vez.
  const lados = {
    usuarios: { conectados, recientes },
    // En Invitados solo los conectados: al desconectarse salen de aquí (siguen en Usuarios).
    invitados: { conectados: conectados.filter(esInvitado), recientes: [] },
  };
  // Sacar a un invitado de la invitación: termina el importador compartido (sigue con su cuenta).
  const sacarDeInvitacion = async (nombre, extra) => {
    if (!confirm(`¿Sacar a ${nombre} de la invitación? Deja de compartir contigo el Importador; su usuario sigue igual.`)) return;
    const ids = new Set(invitaciones.filter((i) => i.usuario === nombre).map((i) => i.id));
    if (extra) ids.add(extra);
    for (const id of ids) await monitor.accion('revocarInvitacion', { id });
  };

  const lista = (grupo, invitado = false) => (
    <>
      {grupo.conectados.length > 0 && (
        <ul className="personas">
          {grupo.conectados.map((p) => <Persona key={p.sid} monitor={monitor} p={p} onVer={setViendo}
            compartido={invitado ? nombresInvitados.has(p.nombre) : null}
            onSacarInvitacion={invitado ? () => sacarDeInvitacion(p.nombre, p.invitacion) : null} />)}
        </ul>
      )}
      {grupo.recientes.length > 0 && (
        <>
          <h3>Recientes</h3>
          <ul className="personas">
            {grupo.recientes.map((p) => <Persona key={p.sid} monitor={monitor} p={p} onVer={setViendo}
            compartido={invitado ? nombresInvitados.has(p.nombre) : null}
            onSacarInvitacion={invitado ? () => sacarDeInvitacion(p.nombre, p.invitacion) : null} />)}
          </ul>
        </>
      )}
    </>
  );

  return (
    <main className="invitados usuarios-invitados">
      {solicitudes.length > 0 && (
        <section className="card destacada">
          <h2><UserPlus size={18} /> Solicitudes de acceso</h2>
          <p className="sub">Estas personas entraron con su usuario y PIN y esperan tu permiso.</p>
          <ul className="personas">
            {solicitudes.map((s) => (
              <li key={s.sid} className="persona">
                <span className="punto amarillo" />
                <span className="persona-datos">
                  <b>{s.nombre}</b>
                  <small>{dispositivo(s.agente)} · pidió acceso {haceCuanto(s.inicio)}</small>
                </span>
                <BotonesSolicitud monitor={monitor} s={s} conBloquear />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dos-lados">
        <section className="card">
          <h2><Users size={18} /> Usuarios</h2>
          <p className="sub">Entraron con su @usuario y PIN y les diste acceso. Usa los tres puntos para verlos en tiempo real, detenerlos, escribirles, sacarlos, bloquearlos o borrar su usuario.</p>
          {conectados.length === 0 && <p className="muted">Ningún usuario conectado ahora mismo.</p>}
          {lista(lados.usuarios)}
        </section>

        <section className="card">
          <h2><UserPlus size={18} /> Invitados</h2>
          <p className="sub">Los que invitaste desde Invitar y están conectados (siguen también en Usuarios). Mientras la invitación esté activa comparten contigo el Importador; con los tres puntos puedes sacarlos de la invitación.</p>
          {lados.invitados.conectados.length === 0 && <p className="muted">Ningún invitado conectado ahora mismo.</p>}
          {lista(lados.invitados, true)}
        </section>
      </div>

      {bloqueos.length > 0 && (
        <section className="card">
          <h2><Ban size={18} /> Bloqueados</h2>
          <p className="sub">No pueden pedir acceso desde esa red. Si quitas el bloqueo, podrán volver a pedir permiso.</p>
          <ul className="personas">
            {bloqueos.map((b) => (
              <li key={b.ip} className="persona">
                <span className="persona-datos">
                  <b>{b.nombre || 'Sin nombre'}</b>
                  <small>IP {b.ip} · bloqueado {haceCuanto(b.creado)}</small>
                </span>
                <button className="sec" onClick={() => monitor.accion('desbloquear', { ip: b.ip })} disabled={monitor.ocupado === `desbloquear:${b.ip}`}>
                  <ShieldCheck size={15} /> Quitar bloqueo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// Acciones sobre un invitado (las comparten la lista y la vista en tiempo real).
function usarAcciones(monitor, p) {
  const enLinea = p.en_linea && p.acceso === 'aprobado';
  return {
    enLinea,
    pausado: Boolean(p.trabajo?.pausado),
    pausar: () => monitor.accion('pausar', { sid: p.sid }),
    reanudar: () => monitor.accion('reanudar', { sid: p.sid }),
    detener: () => confirm(`¿Parar lo que está haciendo ${p.nombre}? Se cancela la importación o el pulido en curso.`)
      && monitor.accion('detener', { sid: p.sid }),
    sacar: () => confirm(`¿Sacar a ${p.nombre} de la sesión? Volverá a la pantalla de acceso y tendrá que pedir permiso otra vez.`)
      && monitor.accion('sacar', { sid: p.sid }),
    bloquear: () => confirm(`¿Bloquear a ${p.nombre}? Se le saca y no podrá volver a pedir acceso desde esa red.`)
      && monitor.accion('bloquear', { sid: p.sid }),
    desbloquear: () => monitor.accion('desbloquear', { usuario: p.nombre }),
    restablecerPin: () => confirm(`¿Restablecer el PIN de ${p.nombre}? La próxima vez que entre creará uno nuevo con el mismo usuario.`)
      && monitor.accion('restablecerPin', { usuario: p.nombre }),
    quitar: () => confirm(`¿Quitar a ${p.nombre} de la sección? Su usuario y su PIN siguen igual; vuelve a aparecer cuando entre.`)
      && monitor.accion('quitarDeLista', { usuario: p.nombre }),
    borrar: () => confirm(`¿Eliminar el usuario ${p.nombre}? Se borra su cuenta y su PIN, sale de la app si está dentro y desaparece de la lista. Podrá registrarse de nuevo.`)
      && monitor.accion('borrarUsuario', { usuario: p.nombre }),
  };
}

// Menú de los tres puntos.
function MenuPersona({ monitor, p, onVer, onMensaje, onSacarInvitacion, compartido }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const a = usarAcciones(monitor, p);
  const trabajo = trabajoDe(p);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const opcion = (fn) => () => { setAbierto(false); fn(); };
  return (
    <div className="menu-persona" ref={ref}>
      <button className="sec icono" onClick={() => setAbierto((v) => !v)} aria-label={`Opciones de ${p.nombre}`} aria-expanded={abierto}>
        <MoreVertical size={18} />
      </button>
      {abierto && (
        <div className="menu-opciones" role="menu">
          {a.enLinea && (
            <>
              {onVer && <button role="menuitem" onClick={opcion(() => onVer(p.sid))}><Eye size={15} /> Ver en tiempo real</button>}
              {a.pausado ? (
                <button role="menuitem" onClick={opcion(a.reanudar)}><Play size={15} /> Reanudar ejecución</button>
              ) : (
                <button role="menuitem" onClick={opcion(a.pausar)} disabled={!trabajo}>
                  <Pause size={15} /> Pausar ejecución{trabajo ? '' : ' (no está haciendo nada)'}
                </button>
              )}
              <button role="menuitem" onClick={opcion(a.detener)} disabled={!trabajo}>
                <Square size={15} /> Parar ejecución{trabajo ? '' : ' (no está haciendo nada)'}
              </button>
              <button role="menuitem" onClick={opcion(onMensaje)}><MessageSquare size={15} /> Enviar mensaje</button>
              <div className="menu-separador" />
              <button role="menuitem" className="peligro" onClick={opcion(a.sacar)}><LogOut size={15} /> Sacar de la sesión</button>
            </>
          )}
          {!a.enLinea && <div className="menu-titulo">{p.nombre} no está conectado</div>}
          {onSacarInvitacion ? (
            <>
              {a.enLinea && <div className="menu-separador" />}
              <button role="menuitem" className="peligro" onClick={opcion(onSacarInvitacion)} disabled={!compartido}>
                <LogOut size={15} /> Sacar de la invitación{compartido ? '' : ' (ya no está en el compartido)'}
              </button>
            </>
          ) : (
            <>
              {!a.enLinea && <button role="menuitem" onClick={opcion(a.quitar)}><X size={15} /> Quitar de la sección</button>}
              <button role="menuitem" onClick={opcion(a.restablecerPin)}><KeyRound size={15} /> Restablecer PIN</button>
              {p.acceso === 'bloqueado' ? (
                <button role="menuitem" onClick={opcion(a.desbloquear)}><ShieldCheck size={15} /> Desbloquear</button>
              ) : (
                <button role="menuitem" className="peligro" onClick={opcion(a.bloquear)}><Ban size={15} /> Bloquear</button>
              )}
              <button role="menuitem" className="peligro" onClick={opcion(a.borrar)}><Trash2 size={15} /> Eliminar usuario</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Persona({ monitor, p, onVer, onSacarInvitacion = null, compartido = null }) {
  const enLinea = p.en_linea && p.acceso === 'aprobado';
  const trabajo = trabajoDe(p);
  return (
    <li className="persona conectado">
      <div className="persona-fila">
        <span className={`punto ${enLinea ? 'verde' : 'rojo'}`} />
        <span className="persona-datos">
          <b>{p.nombre}</b>
          {enLinea ? (
            <>
              <small>
                En {NOMBRES_SECCION[p.seccion] || 'Importador'} · {trabajo || 'sin tareas en curso'}
                {segundoPlano(p) && ' · app en segundo plano'}
              </small>
              <small>{dispositivo(p.agente)} · entró {haceCuanto(p.entro || p.inicio)}</small>
            </>
          ) : (
            <small>
              {p.acceso === 'expulsado' ? 'Lo sacaste' : p.acceso === 'bloqueado' ? 'Bloqueado' : 'Desconectado · salió de la app'}
              {' · '}última vez {haceCuanto(p.ultimo_latido)} · {dispositivo(p.agente)}
            </small>
          )}
          {compartido !== null && <small>{compartido ? 'En el Importador compartido' : 'Fuera del Importador compartido'}</small>}
        </span>
        <MenuPersona monitor={monitor} p={p} onVer={onVer} onMensaje={() => monitor.abrirChat(p)} onSacarInvitacion={onSacarInvitacion} compartido={compartido} />
      </div>
    </li>
  );
}

// Lo que el invitado tiene en pantalla, actualizado cada 1,5 s (su página envía el detalle solo mientras se le ve).
const VISTA_MS = 1500;

function VistaEnVivo({ monitor, sid, onVolver }) {
  const [sesion, setSesion] = useState(null);
  const [error, setError] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    const consultar = async () => {
      try {
        const r = await fetch(`/api/monitor?sid=${sid}`, { cache: 'no-store' });
        const d = await r.json();
        if (!vivo) return;
        if (!r.ok) setError(d.error || 'No se pudo cargar.');
        else { setSesion(d.sesion); setError(''); }
      } catch { /* se reintenta */ }
    };
    consultar();
    const id = setInterval(consultar, VISTA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [sid]);

  const e = sesion?.estado || {};
  const v = e.vivo;
  const imp = v?.importacion;
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [imp?.log?.length]);

  const volver = <button className="sec" onClick={onVolver}><ArrowLeft size={16} /> Usuarios e invitados</button>;
  if (error) return <main className="invitados"><section className="card">{volver}<p className="muted">{error}</p></section></main>;
  if (!sesion) return <main className="invitados"><section className="card">{volver}<p className="muted">Conectando…</p></section></main>;

  const p = { ...sesion, trabajo: e.trabajo, seccion: e.seccion };
  const a = usarAcciones(monitor, p);
  const trabajo = trabajoDe(p);
  const links = v?.links || [];
  const resultados = imp?.resultados || [];

  return (
    <main className="invitados">
      <section className="card">
        <div className="fila espacio">
          {volver}
          <MenuPersona monitor={monitor} p={p} onVer={null} onMensaje={() => monitor.abrirChat(p)} />
        </div>
        <h2 className="vivo-titulo">
          <span className={`punto ${a.enLinea ? 'verde' : 'rojo'}`} />
          {sesion.nombre}
          {a.enLinea && <span className="etiqueta-vivo">EN VIVO</span>}
        </h2>
        <p className="sub">
          {a.enLinea
            ? <>Está en <b>{NOMBRES_SECCION[e.seccion] || 'Importador'}</b> · {trabajo || 'sin tareas en curso'}</>
            : `Desconectado · última vez ${haceCuanto(sesion.ultimo_latido)}`}
          {' · '}{dispositivo(sesion.agente)}
        </p>
        {a.enLinea && (
          <div className="fila">
            {a.pausado
              ? <button className="sec" onClick={a.reanudar}><Play size={15} /> Reanudar</button>
              : <button className="sec" onClick={a.pausar} disabled={!trabajo}><Pause size={15} /> Pausar</button>}
            <button className="sec" onClick={a.detener} disabled={!trabajo}><Square size={15} /> Parar ejecución</button>
            <button className="sec peligro" onClick={a.sacar}><LogOut size={15} /> Sacar de la sesión</button>
          </div>
        )}

        {!a.enLinea ? (
          <p className="muted">No está en la app ahora mismo.</p>
        ) : !v ? (
          <p className="muted">Esperando lo que tiene en pantalla…</p>
        ) : (
          <>
            <div className="en-vivo">
              <div className="dato"><small>Archivo cargado</small><b>{v.archivo || (v.textoPegado ? 'Links pegados' : '—')}</b></div>
              <div className="dato"><small>Links</small><b>{links.length}</b></div>
              <div className="dato"><small>Importación</small><b>{imp?.corriendo ? `En curso ${imp.actual}/${imp.total}` : imp?.total ? 'Terminada' : '—'}</b></div>
              <div className="dato"><small>Empuje</small><b>{imp?.empuje ? (imp.empuje.ok ? `${imp.empuje.empujados} empujado(s)` : 'Falló') : '—'}</b></div>
            </div>
            {v.opciones && (
              <p className="muted opciones-vivo">
                Opciones: empujar {v.opciones.empujar ? 'sí' : 'no'} · pulir {v.opciones.pulir ? 'sí' : 'no'} · videos {v.opciones.videos ? 'sí' : 'no'}
              </p>
            )}
            {links.length > 0 && (
              <>
                <div className="log-titulo pegar">Links de AliExpress</div>
                <ul className="lista">
                  {links.map((l, i) => (
                    <li key={i} className={resultados[i] || 'pendiente'}>
                      <span className="num">{i + 1}</span>
                      <a href={l} target="_blank" rel="noreferrer">{l}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="log-titulo pegar">Registro de importación</div>
            <pre ref={logRef}>{imp?.log?.length ? imp.log.join('\n') : 'Sin importaciones todavía.'}</pre>
            {v.pulido?.items?.length > 0 && (
              <>
                <div className="log-titulo pegar">Pulido en la tienda{v.pulido.mensaje ? ` · ${v.pulido.mensaje}` : ''}</div>
                <ul className="lista">
                  {v.pulido.items.map((it, i) => (
                    <li key={i} className={it.estado}><span className="num">{i + 1}</span>{it.titulo || it.antes}</li>
                  ))}
                </ul>
              </>
            )}
            {v.videos?.log?.length > 0 && (
              <>
                <div className="log-titulo pegar">Videos automáticos</div>
                <pre>{v.videos.log.join('\n')}</pre>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

// Chat del admin, abajo a la derecha (mismo sitio que el botón del usuario): el botón abre una ventana
// con una pestaña por conversación; para empezar una nueva se elige a alguien conectado.
export function ChatsAdmin({ monitor }) {
  const { chats, chatPanel, chatActivo, conectados, conversaciones = [] } = monitor;
  const sinLeer = chats.reduce((n, c) => n + (c.sinLeer || 0), 0);
  if (!chatPanel) {
    return (
      <div className="chat-zona">
        <BotonChat onClick={() => { monitor.setChatActivo((a) => a || chats[chats.length - 1]?.nombre || null); monitor.setChatPanel(true); }} pendientes={sinLeer} />
      </div>
    );
  }

  const activo = chats.find((c) => c.nombre === chatActivo) || chats[chats.length - 1];
  const sinChat = conectados.filter((p) => !chats.some((c) => c.nombre === p.nombre));
  // Conversaciones guardadas de quien no está conectado (aunque lo hayas sacado o eliminado).
  const guardadas = conversaciones.filter((c) => !chats.some((x) => x.nombre === c.usuario) && !sinChat.some((p) => p.nombre === c.usuario));
  const pestanas = (
    <div className="chat-pestanas" role="tablist">
      {chats.map((c) => (
        <span key={c.nombre} className={`chat-pestana ${c === activo ? 'activa' : ''}`}>
          <button role="tab" aria-selected={c === activo} onClick={() => monitor.setChatActivo(c.nombre)}>
            {c.nombre}
            {c.sinLeer > 0 && c !== activo && <span className="globo">{c.sinLeer}</span>}
          </button>
          <button className="quitar" onClick={() => monitor.cerrarChat(c.nombre)} aria-label={`Cerrar chat con ${c.nombre}`}><X size={12} /></button>
        </span>
      ))}
      {(sinChat.length > 0 || guardadas.length > 0) && (
        <select
          className="chat-nuevo"
          value=""
          onChange={(e) => {
            const nombre = e.target.value;
            if (nombre) monitor.abrirChat(sinChat.find((x) => x.nombre === nombre) || { nombre, sid: null });
          }}
          aria-label="Abrir chat"
        >
          <option value="">+ Chat</option>
          {sinChat.length > 0 && (
            <optgroup label="Conectados">
              {sinChat.map((p) => <option key={p.sid} value={p.nombre}>{p.nombre}</option>)}
            </optgroup>
          )}
          {guardadas.length > 0 && (
            <optgroup label="Chats guardados">
              {guardadas.map((c) => <option key={c.usuario} value={c.usuario}>{c.usuario}</option>)}
            </optgroup>
          )}
        </select>
      )}
    </div>
  );

  return (
    <div className="chat-zona">
      {activo ? (
        <VentanaChat
          key={activo.nombre}
          titulo={activo.nombre}
          pestanas={pestanas}
          mensajes={activo.mensajes}
          onEnviar={(texto) => monitor.enviarChat(activo.nombre, texto)}
          onCerrar={() => monitor.setChatPanel(false)}
        />
      ) : (
        <div className="chat-ventana" role="dialog" aria-label="Chats">
          {pestanas}
          <div className="chat-cabeza">
            <MessageSquare size={16} />
            <b>Chats</b>
            <button className="sec icono" onClick={() => monitor.setChatPanel(false)} aria-label="Cerrar chat"><X size={15} /></button>
          </div>
          <p className="chat-vacio">
            {sinChat.length || guardadas.length ? 'Elige a alguien en «+ Chat» para escribirle o ver su chat guardado.' : 'No hay nadie conectado ni chats guardados.'}
          </p>
        </div>
      )}
    </div>
  );
}
