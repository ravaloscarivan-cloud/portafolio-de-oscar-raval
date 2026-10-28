// Revisa que todas las capacitaciones estén completas antes de compilar y subir:
// ids únicos, tipos de diapositiva e íconos válidos, fotos existentes con crédito y evaluaciones de 5 + 5 preguntas.
// Uso: node scripts/validar-capacitaciones.js   (termina con código 1 si hay errores)

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { distancia, huellas, PARECIDAS } from './huellas.js';
import { noHabil } from './festivos.js';
import { capacitaciones } from '../client/src/data/capacitaciones.js';
import { retiradas } from '../client/src/data/capacitacionesRetiradas.js';
import { evaluacionesFijas } from '../lib/evaluaciones.js';

const raiz = new URL('..', import.meta.url);
const tipos = new Set(['portada', 'contenido', 'tarjetas', 'pasos', 'comparacion', 'imagen', 'colores', 'tabla', 'cierre']);
const iconos = new Set([...readFileSync(new URL('client/src/components/Icono.jsx', raiz), 'utf8').matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
const errores = [];

const ids = new Set();
for (const c of capacitaciones) {
  const donde = c.id ?? c.titulo ?? '(sin id)';
  if (!c.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) errores.push(`${donde}: id inválido`);
  if (ids.has(c.id)) errores.push(`${donde}: id repetido`);
  ids.add(c.id);
  if (!c.titulo) errores.push(`${donde}: falta titulo`);
  for (const f of ['fechaProgramada', 'fechaEjecucion']) {
    if (c[f] && !/^\d{4}-\d{2}-\d{2}$/.test(c[f])) errores.push(`${donde}: ${f} debe ser AAAA-MM-DD`);
    else if (c[f] && noHabil(c[f])) errores.push(`${donde}: ${f} ${c[f]} cae en día no hábil (${noHabil(c[f])})`);
  }
  if (!Array.isArray(c.diapositivas) || c.diapositivas.length < 3) errores.push(`${donde}: muy pocas diapositivas`);

  const imagenes = [c.portada];
  (c.diapositivas ?? []).forEach((d, i) => {
    const en = `${donde} · diapositiva ${i + 1}`;
    if (!tipos.has(d.tipo)) errores.push(`${en}: tipo "${d.tipo}" no existe`);
    if (!d.titulo) errores.push(`${en}: falta titulo`);
    for (const it of d.items ?? []) {
      if (d.tipo === 'tarjetas' && !d.numerado && !iconos.has(it.icono)) errores.push(`${en}: ícono "${it.icono}" no existe`);
    }
    if (['tarjetas', 'pasos', 'colores'].includes(d.tipo) && !d.items?.length) errores.push(`${en}: faltan items`);
    if (d.tipo === 'comparacion' && !d.columnas?.every((col) => Array.isArray(col.ejemplos))) errores.push(`${en}: cada columna necesita ejemplos`);
    if (d.tipo === 'tabla' && !(d.cabeceras?.length && d.filas?.every((f) => f.length === d.cabeceras.length))) errores.push(`${en}: tabla con columnas desiguales`);
    imagenes.push(d.imagen);
  });
  for (const im of imagenes.filter(Boolean)) {
    if (!existsSync(new URL(`client/public${im.src}`, raiz))) errores.push(`${donde}: no existe la foto ${im.src}`);
    else if (!im.credito) errores.push(`${donde}: la foto ${im.src} no tiene crédito en fotos.js`);
  }

  const ev = evaluacionesFijas[c.id];
  if (!ev) errores.push(`${donde}: no tiene evaluación`);
  for (const tipo of ['pre', 'post']) {
    const preguntas = ev?.[tipo] ?? [];
    if (ev && preguntas.length !== 5) errores.push(`${donde}: el ${tipo}-test debe tener 5 preguntas (tiene ${preguntas.length})`);
    preguntas.forEach((p, i) => {
      if (!p.pregunta || !Array.isArray(p.opciones) || p.opciones.length < 2) errores.push(`${donde}: ${tipo} ${i + 1} incompleta`);
      else if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta >= p.opciones.length) errores.push(`${donde}: ${tipo} ${i + 1} con "correcta" inválida`);
    });
  }
}
for (const id of Object.keys(evaluacionesFijas)) if (!ids.has(id) && !retiradas.includes(id)) errores.push(`evaluación "${id}" sin capacitación`);

// Cada foto se usa una sola vez: en una capacitación y en una diapositiva (la portada cuenta como la tarjeta)
const usos = new Map();
for (const c of capacitaciones) {
  (c.diapositivas ?? []).forEach((d, i) => {
    if (d.imagen) usos.set(d.imagen.src, [...(usos.get(d.imagen.src) ?? []), `${c.id} #${i + 1}`]);
  });
  if (c.portada && !c.diapositivas?.some((d) => d.imagen?.src === c.portada.src)) usos.set(c.portada.src, [...(usos.get(c.portada.src) ?? []), `${c.id} (tarjeta)`]);
}
console.log(`Fotos en uso:\n${[...usos].map(([src, u]) => `  ${src.replace('/slides/', '')}: ${u.join(', ')}`).join('\n')}`);
const repetidas = [...usos].filter(([, u]) => u.length > 1).map(([src, u]) => `foto ${src} repetida en ${u.join(', ')}`);
// La misma imagen con otro nombre, tamaño o compresión (huella visual)
const rutas = [...usos.keys()].map((src) => [src, fileURLToPath(new URL(`client/public${src}`, raiz))]);
const h = huellas(rutas.map(([, r]) => r));
for (let i = 0; i < rutas.length; i++) {
  for (let j = i + 1; j < rutas.length; j++) {
    const [a, b] = [h.get(rutas[i][1]), h.get(rutas[j][1])];
    if (a && b && distancia(a, b) <= PARECIDAS) repetidas.push(`${rutas[j][0]} es la misma foto que ${rutas[i][0]} (con otro nombre)`);
  }
}
errores.push(...repetidas);

if (errores.length) {
  console.error(`Errores (${errores.length}):\n- ${errores.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: ${capacitaciones.length} capacitaciones válidas.`);
