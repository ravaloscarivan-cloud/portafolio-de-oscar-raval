// Quita una capacitación del aplicativo (la usa el vigilante cuando se borra su archivo de CAPACITACIONES/).
// - Importada (capacitacionesImportadas.js): borra sus diapositivas, sus evaluaciones y las fotos que solo ella usaba.
// - De las primeras (capacitaciones.js, capacitacionesNuevas.js, capacitacionesAmbientales.js): la agrega a
//   capacitacionesRetiradas.js para que deje de mostrarse.
// Las asistencias y evaluaciones ya registradas en la base de datos se conservan.
//
// Uso manual: node scripts/retirar.js <id>

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATOS = join(RAIZ, 'client', 'src', 'data');
const IMPORTADAS = join(DATOS, 'capacitacionesImportadas.js');
const RETIRADAS = join(DATOS, 'capacitacionesRetiradas.js');
const EVALUACIONES = join(RAIZ, 'lib', 'evaluacionesImportadas.js');
const FOTOS_JS = join(DATOS, 'fotos.js');
const ORIGENES = join(RAIZ, 'scripts', 'fotos-origen.json');
const SLIDES = join(RAIZ, 'client', 'public', 'slides');
const PAPELERA = join(RAIZ, 'scripts', '.trabajo', 'papelera');
const ARCHIVOS_DATOS = ['capacitaciones.js', 'capacitacionesNuevas.js', 'capacitacionesAmbientales.js', 'capacitacionesImportadas.js'].map((f) => join(DATOS, f));

const leer = (p) => readFileSync(p, 'utf8');
const lineas = (p) => leer(p).split('\n');
const sinCr = (l = '') => l.replace(/\r$/, ''); // los archivos pueden tener saltos de línea de Windows

/** Quita de "ls" el bloque que empieza en "inicio" y termina en la primera línea que cumpla "esFin" (incluida). */
function quitarBloque(ls, inicio, esFin) {
  let fin = inicio + 1;
  while (fin < ls.length && !esFin(ls[fin])) fin++;
  if (fin >= ls.length) throw new Error('No se encontró el final del bloque');
  return [...ls.slice(0, inicio), ...ls.slice(fin + 1)];
}

/** Fotos referenciadas con foto('archivo', ...) en un texto. */
const fotosEn = (texto) => [...texto.matchAll(/foto\('([^']+)'/g)].map((m) => m[1]);

export function retirar(id) {
  const ls = lineas(IMPORTADAS);
  const i = ls.findIndex((l, n) => sinCr(l) === `    id: '${id}',` && sinCr(ls[n - 1]) === '  {');

  if (i === -1) {
    // Capacitación de las primeras: se marca como retirada
    if (!ARCHIVOS_DATOS.slice(0, 3).some((p) => leer(p).includes(`id: '${id}',`))) throw new Error(`No existe la capacitación "${id}".`);
    const texto = leer(RETIRADAS);
    if (texto.includes(`'${id}'`)) return { tipo: 'base', fotos: [] };
    writeFileSync(RETIRADAS, texto.replace('export const retiradas = [', `export const retiradas = [\n  '${id}',`));
    return { tipo: 'base', fotos: [] };
  }

  // Importada: diapositivas
  let fin = i;
  while (fin < ls.length && sinCr(ls[fin]) !== '  },') fin++;
  const bloque = ls.slice(i - 1, fin + 1).join('\n');
  writeFileSync(IMPORTADAS, [...ls.slice(0, i - 1), ...ls.slice(fin + 1)].join('\n'));

  // Evaluaciones
  const ev = lineas(EVALUACIONES);
  const j = ev.findIndex((l) => sinCr(l) === `  "${id}": {`);
  if (j !== -1) writeFileSync(EVALUACIONES, quitarBloque(ev, j, (l) => /^  \},?$/.test(sinCr(l))).join('\n'));

  // Fotos que ya no usa ninguna otra capacitación
  const enUso = new Set(ARCHIVOS_DATOS.flatMap((p) => fotosEn(leer(p))));
  const libres = [...new Set(fotosEn(bloque))].filter((f) => !enUso.has(f));
  if (libres.length) {
    // Se mueven a la papelera (no se borran) para poder deshacer el retiro con devolverFotos()
    mkdirSync(PAPELERA, { recursive: true });
    for (const f of libres) if (existsSync(join(SLIDES, f))) renameSync(join(SLIDES, f), join(PAPELERA, f));
    writeFileSync(FOTOS_JS, lineas(FOTOS_JS).filter((l) => !libres.some((f) => l.includes(`'${f}':`))).join('\n'));
    if (existsSync(ORIGENES)) {
      const o = JSON.parse(leer(ORIGENES));
      for (const f of libres) delete o[f];
      writeFileSync(ORIGENES, JSON.stringify(o, null, 2) + '\n');
    }
  }
  return { tipo: 'importada', fotos: libres };
}

/** Devuelve a client/public/slides/ las fotos que retirar() movió a la papelera (para deshacer). */
export function devolverFotos(fotos) {
  for (const f of fotos) if (existsSync(join(PAPELERA, f))) renameSync(join(PAPELERA, f), join(SLIDES, f));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const id = process.argv[2];
  if (!id) {
    console.log('Uso: node scripts/retirar.js <id>');
    process.exit(1);
  }
  const r = retirar(id);
  console.log(r.tipo === 'importada' ? `Retirada "${id}" (fotos borradas: ${r.fotos.join(', ') || 'ninguna'}).` : `"${id}" marcada como retirada.`);
}
