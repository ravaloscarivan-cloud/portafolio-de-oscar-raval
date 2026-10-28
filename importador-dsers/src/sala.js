// Trabajo en equipo en tiempo real (api/sala.js) entre el admin y los usuarios que aceptaron su invitación:
// comparten el cuadro «Pega aquí los links». Consulta cada 1 s; lo que escribe uno aparece en la pantalla del otro.
import { useEffect, useRef, useState } from 'react';

const CONSULTA_MS = 1000;
const GUARDAR_MS = 350; // espera tras la última tecla antes de enviar el texto
const NUEVO_MS = 10000; // cuánto tiempo se resalta un link que acaba de agregar otra persona

async function llamar(url, opciones = {}) {
  const r = await fetch(url, { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...opciones });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
  return d;
}

// Color fijo por persona (el mismo en todas las pantallas) para no confundir quién puso cada link.
const COLORES = ['#58a6ff', '#e3b341', '#f778ba', '#a371f7', '#3fb950', '#ff9b5c', '#39c5cf'];
export function colorDe(nombre = '') {
  if (nombre === 'Admin') return '#d0d0d0';
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

// activo: si esta sesión trabaja en equipo. yo: nombre propio ('Admin' o el @usuario).
// onTexto(texto): llega un texto nuevo del equipo (la app lo pone en el cuadro si no se está escribiendo).
// onAjenos(links): links que acaba de agregar otra persona (para avisar).
export function useSala(activo, yo, { onTexto, onAjenos } = {}) {
  const [sala, setSala] = useState(null); // { version, texto, links: [{ url, por, ts }], equipo: [nombres] }
  const version = useRef(-1);
  const conocidos = useRef(null); // urls ya vistas (para detectar lo que agregan otros)
  const avisos = useRef({});
  avisos.current = { onTexto, onAjenos };
  const temporizador = useRef(0);
  const ultimaEdicion = useRef(0);

  function aplicar(d, propio = false) {
    if (!d.activa) { version.current = -1; conocidos.current = null; setSala(null); return; }
    if (d.version < version.current) return; // respuesta vieja que llegó tarde
    if (typeof d.texto === 'string') {
      if (conocidos.current) {
        const ajenos = d.links.filter((l) => !conocidos.current.has(l.url) && l.por !== yo);
        if (ajenos.length) avisos.current.onAjenos?.(ajenos);
      }
      conocidos.current = new Set(d.links.map((l) => l.url));
      version.current = d.version;
      // No se pisa lo que la persona está escribiendo en este momento.
      if (!propio && Date.now() - ultimaEdicion.current > 1500) avisos.current.onTexto?.(d.texto);
    }
    setSala((s) => ({
      version: d.version,
      texto: d.texto ?? s?.texto ?? '',
      links: d.links || s?.links || [],
      equipo: d.equipo || s?.equipo || [],
    }));
  }

  useEffect(() => {
    if (!activo) { setSala(null); version.current = -1; conocidos.current = null; return undefined; }
    let vivo = true;
    const consultar = async () => {
      try {
        const d = await llamar(`/api/sala?v=${version.current}`);
        if (vivo) aplicar(d);
      } catch { /* sin conexión: se reintenta */ }
    };
    consultar();
    const id = setInterval(consultar, CONSULTA_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [activo]);

  async function guardar(texto) {
    try {
      const d = await llamar('/api/sala', { method: 'POST', body: JSON.stringify({ texto, base: version.current }) });
      // Si al guardar se juntaron líneas de otra persona, se muestran (solo si no se siguió escribiendo).
      aplicar(d, d.texto === texto);
      if (d.texto !== texto && Date.now() - ultimaEdicion.current > GUARDAR_MS) avisos.current.onTexto?.(d.texto);
    } catch (err) {
      alert(err.message);
    }
  }

  if (!sala) return null;
  const ahora = Date.now();
  const info = new Map(sala.links.map((l) => [l.url, l]));
  return {
    equipo: sala.equipo,
    infoDe: (url) => info.get(url),
    // Recién agregado por otra persona: se resalta unos segundos.
    esNuevo: (l) => Boolean(l && l.por !== yo && l.ts && ahora - new Date(l.ts).getTime() < NUEVO_MS),
    // Se escribió en el cuadro: se envía al equipo poco después de la última tecla.
    escribir: (texto) => {
      ultimaEdicion.current = Date.now();
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => guardar(texto), GUARDAR_MS);
    },
    // Cambio hecho por un botón (cargar .txt, quitar, vaciar): se envía enseguida.
    guardar: (texto) => { clearTimeout(temporizador.current); return guardar(texto); },
  };
}
