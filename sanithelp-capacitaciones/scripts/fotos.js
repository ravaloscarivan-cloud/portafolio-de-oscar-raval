// Banco de fotos para las capacitaciones: busca, descarga y registra fotos sin repetir.
// Fuente: Pexels (si existe PEXELS_API_KEY en .env.local) y, si no, Wikimedia Commons (licencias libres).
//
//   node scripts/fotos.js buscar "<búsqueda en inglés>"          candidatas que todavía no se usan
//   node scripts/fotos.js descargar <id> <nombre-archivo>         p. ej. pexels:3825529 lavado-manos-clinica
//   node scripts/fotos.js descartar <nombre-archivo>              borra la foto y su crédito
//   node scripts/fotos.js usadas                                  fotos ya usadas y en qué capacitación
//
// Las fotos quedan en client/public/slides/<nombre>.jpg y su crédito en client/src/data/fotos.js.

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fotoIgual } from './huellas.js';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SLIDES = join(RAIZ, 'client', 'public', 'slides');
const FOTOS_JS = join(RAIZ, 'client', 'src', 'data', 'fotos.js');
const ORIGENES = join(RAIZ, 'scripts', 'fotos-origen.json'); // de dónde salió cada foto (para no repetirla)
const PEXELS = process.env.PEXELS_API_KEY;
const UA = { 'User-Agent': 'SanitHelpCapacitaciones/1.0' };
const LICENCIAS = /^(cc0|public domain|pd\b|cc by(-sa)? \d(\.\d)?)/i;

const origenes = () => (existsSync(ORIGENES) ? JSON.parse(readFileSync(ORIGENES, 'utf8')) : {});
const limpiar = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);

async function pexels(q) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`, { headers: { Authorization: PEXELS } });
  if (!r.ok) throw new Error(`Pexels respondió ${r.status}`);
  const { photos = [] } = await r.json();
  return photos.map((p) => ({
    id: `pexels:${p.id}`,
    descripcion: p.alt || '',
    autor: p.photographer,
    licencia: 'Licencia Pexels',
    url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1280`,
    vista: p.src.medium,
  }));
}

async function commons(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20'
    + `&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|size|mime`
    + '&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription&iiurlwidth=1280';
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`Wikimedia respondió ${r.status}`);
  const paginas = Object.values((await r.json()).query?.pages ?? {});
  return paginas
    .map((p) => ({ p, ii: p.imageinfo?.[0], m: p.imageinfo?.[0]?.extmetadata ?? {} }))
    .filter(({ ii, m }) => ii && ii.mime === 'image/jpeg' && ii.width >= 900 && LICENCIAS.test(m.LicenseShortName?.value ?? '')
      && !/internet archive|identifier:/i.test(`${m.Artist?.value} ${m.ImageDescription?.value}`))
    .map(({ p, ii, m }) => ({
      id: `commons:${p.pageid}`,
      descripcion: limpiar(m.ImageDescription?.value) || p.title.replace(/^File:/, ''),
      autor: limpiar(m.Artist?.value) || 'Wikimedia Commons',
      licencia: m.LicenseShortName.value,
      url: ii.thumburl,
      vista: ii.thumburl,
    }));
}

async function buscar(q) {
  if (!q) throw new Error('Indique qué buscar, en inglés. Ej.: node scripts/fotos.js buscar "nurse washing hands"');
  const usadas = new Set(Object.values(origenes()).map((o) => o.id));
  const candidatas = (PEXELS ? await pexels(q) : await commons(q)).filter((c) => !usadas.has(c.id));
  if (!candidatas.length) return console.log('Sin resultados nuevos. Pruebe otra búsqueda más general o en otras palabras.');
  console.log(`Fuente: ${PEXELS ? 'Pexels' : 'Wikimedia Commons'}. Candidatas no usadas (descargue con: node scripts/fotos.js descargar <id> <nombre>):`);
  for (const c of candidatas.slice(0, 10)) console.log(`- ${c.id} · ${c.descripcion.slice(0, 90)} · ${c.autor} · ${c.licencia}`);
}

async function descargar(id, nombre) {
  if (!id || !nombre) throw new Error('Uso: node scripts/fotos.js descargar <id> <nombre-archivo>');
  nombre = nombre.replace(/\.jpe?g$/i, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nombre)) throw new Error('El nombre debe ir en minúsculas y con guiones, sin tildes. Ej.: lavado-manos-clinica');
  const archivo = `${nombre}.jpg`;
  if (existsSync(join(SLIDES, archivo))) throw new Error(`Ya existe ${archivo}: use otro nombre.`);
  const reg = origenes();
  if (Object.values(reg).some((o) => o.id === id)) throw new Error('Esa foto ya está en el aplicativo: elija otra.');

  const [fuente, clave] = id.split(':');
  let foto;
  if (fuente === 'pexels') {
    if (!PEXELS) throw new Error('Falta PEXELS_API_KEY en .env.local');
    const r = await fetch(`https://api.pexels.com/v1/photos/${clave}`, { headers: { Authorization: PEXELS } });
    if (!r.ok) throw new Error(`Pexels respondió ${r.status}`);
    const p = await r.json();
    foto = { autor: p.photographer, licencia: 'Licencia Pexels', url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1280` };
  } else if (fuente === 'commons') {
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&pageids=${clave}&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|Artist&iiurlwidth=1280`, { headers: UA });
    const ii = Object.values((await r.json()).query?.pages ?? {})[0]?.imageinfo?.[0];
    const licencia = ii?.extmetadata?.LicenseShortName?.value ?? '';
    if (!ii || !LICENCIAS.test(licencia)) throw new Error('Foto no encontrada o sin licencia libre.');
    foto = { autor: limpiar(ii.extmetadata?.Artist?.value) || 'Wikimedia Commons', licencia, url: ii.thumburl };
  } else {
    throw new Error('El id debe empezar por pexels: o commons:');
  }

  const r = await fetch(foto.url, { headers: UA });
  if (!r.ok) throw new Error(`No se pudo descargar la foto (${r.status}).`);
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length > 1_500_000) throw new Error('La foto pesa más de 1,5 MB; elija otra.');
  // La misma foto puede llegar con otro tamaño o compresión: se compara su huella visual con todas las del banco
  writeFileSync(join(SLIDES, archivo), datos);
  const igual = fotoIgual(join(SLIDES, archivo), readdirSync(SLIDES).filter((f) => f !== archivo).map((f) => join(SLIDES, f)));
  if (igual) {
    rmSync(join(SLIDES, archivo));
    throw new Error(`Es la misma foto que ${basename(igual)}: elija otra.`);
  }
  const credito = `Foto: ${foto.autor} · ${foto.licencia === 'Licencia Pexels' ? 'Pexels' : foto.licencia}`.replace(/'/g, '’');
  const fs = readFileSync(FOTOS_JS, 'utf8');
  const i = fs.indexOf('\n};');
  writeFileSync(FOTOS_JS, `${fs.slice(0, i)}\n  '${archivo}': '${credito}',${fs.slice(i)}`);
  reg[archivo] = { id, url: foto.url };
  writeFileSync(ORIGENES, JSON.stringify(reg, null, 2) + '\n');
  console.log(`Guardada client/public/slides/${archivo} (${Math.round(datos.length / 1024)} KB) · ${credito}`);
  console.log(`Ábrala con Read para revisar que sea alusiva. Úsela con foto('${archivo}', '<texto alternativo>'), o bórrela con: node scripts/fotos.js descartar ${nombre}`);
}

function descartar(nombre) {
  const archivo = `${String(nombre).replace(/\.jpe?g$/i, '')}.jpg`;
  rmSync(join(SLIDES, archivo), { force: true });
  writeFileSync(FOTOS_JS, readFileSync(FOTOS_JS, 'utf8').split('\n').filter((l) => !l.includes(`'${archivo}':`)).join('\n'));
  const reg = origenes();
  delete reg[archivo];
  writeFileSync(ORIGENES, JSON.stringify(reg, null, 2) + '\n');
  console.log(`Descartada ${archivo}.`);
}

async function usadas() {
  const { capacitaciones } = await import('../client/src/data/capacitaciones.js');
  const uso = {};
  for (const c of capacitaciones) {
    for (const im of [c.portada, ...c.diapositivas.map((d) => d.imagen)].filter(Boolean)) (uso[im.src.replace('/slides/', '')] ??= new Set()).add(c.id);
  }
  for (const [f, ids] of Object.entries(uso)) console.log(`${f}: ${[...ids].join(', ')}`);
}

const [accion, ...resto] = process.argv.slice(2);
const acciones = { buscar: () => buscar(resto.join(' ')), descargar: () => descargar(...resto), descartar: () => descartar(resto[0]), usadas };
if (!acciones[accion]) {
  console.log('Uso: node scripts/fotos.js buscar "<búsqueda>" | descargar <id> <nombre> | descartar <nombre> | usadas');
  process.exit(1);
}
try {
  await acciones[accion]();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
