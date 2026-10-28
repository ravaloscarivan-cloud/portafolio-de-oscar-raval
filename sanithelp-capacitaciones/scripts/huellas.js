// Huellas visuales de las fotos (ver huella-foto.py), con caché para no recalcularlas cada vez.
// Dos fotos con distancia <= PARECIDAS son la misma imagen aunque tengan otro tamaño, recorte leve o compresión.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CACHE = join(RAIZ, 'scripts', '.trabajo', 'huellas.json');
export const PARECIDAS = 10;

/** Distancia de Hamming entre dos huellas (0 = idénticas, 64 = opuestas). */
export function distancia(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  for (; x; x >>= 1n) n += Number(x & 1n);
  return n;
}

/** Map ruta → huella de las fotos indicadas (las que no se puedan leer se omiten). */
export function huellas(rutas) {
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const clave = (r) => { const s = statSync(r); return `${basename(r)}|${s.size}|${Math.round(s.mtimeMs)}`; };
  const faltan = rutas.filter((r) => existsSync(r) && !cache[clave(r)]);
  if (faltan.length) {
    const p = spawnSync('python', ['-I', join(RAIZ, 'scripts', 'huella-foto.py'), ...faltan], { encoding: 'utf8' });
    if (p.status !== 0 && !p.stdout) throw new Error(`No se pudieron calcular las huellas de las fotos (¿Python con Pillow?): ${p.stderr || p.error?.message}`);
    for (const linea of p.stdout.trim().split(/\r?\n/).filter(Boolean)) {
      const [h, ...ruta] = linea.split(' ');
      cache[clave(ruta.join(' '))] = h;
    }
    mkdirSync(join(RAIZ, 'scripts', '.trabajo'), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache));
  }
  return new Map(rutas.filter((r) => existsSync(r) && cache[clave(r)]).map((r) => [r, cache[clave(r)]]));
}

/** Primera foto de "otras" que es visualmente la misma que "ruta", o null. */
export function fotoIgual(ruta, otras) {
  const m = huellas([ruta, ...otras]);
  const h = m.get(ruta);
  if (!h) return null;
  return otras.find((o) => o !== ruta && m.has(o) && distancia(h, m.get(o)) <= PARECIDAS) ?? null;
}
