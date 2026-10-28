// Vigila la carpeta CAPACITACIONES/: cuando llega un PowerPoint, PDF o Word nuevo, Claude Code lo convierte
// en diapositivas y evaluaciones, se valida, se compila y se publica en Vercel.
//
//   npm run vigilar             vigila la carpeta y procesa cada archivo nuevo (dejar la ventana abierta)
//   npm run publicar            procesa los archivos pendientes, publica y termina
//   npm run publicar -- --simular   solo muestra qué haría, sin convertir ni publicar
//
// Lee .env.local: con PEXELS_API_KEY las fotos salen de Pexels; sin ella, de Wikimedia Commons (scripts/fotos.js).
//
// Los archivos ya procesados quedan en scripts/procesadas.json (bórrelos de ahí para reprocesarlos).

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, watch, writeFileSync, appendFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devolverFotos, retirar } from './retirar.js';
import { habil } from './festivos.js';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CARPETA = join(RAIZ, 'CAPACITACIONES');
const REGISTRO = join(RAIZ, 'scripts', 'procesadas.json');
const TRABAJO = join(RAIZ, 'scripts', '.trabajo');
const EXTENSIONES = new Set(['.pptx', '.pdf', '.docx']);
// Archivos que Claude modifica: se respaldan y se restauran si la conversión falla
const EDITABLES = ['client/src/data/capacitacionesImportadas.js', 'lib/evaluacionesImportadas.js', 'client/src/data/fotos.js'];
const HERRAMIENTAS = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'Bash(python -I -X utf8 scripts/extraer-documento.py *)',
  'Bash(node scripts/validar-capacitaciones.js)',
  'Bash(node scripts/fotos.js *)',
];

const args = new Set(process.argv.slice(2));
const unaVez = args.has('--una-vez');
const simular = args.has('--simular');

mkdirSync(TRABAJO, { recursive: true });

function log(msg) {
  const linea = `[${new Date().toLocaleString('es-CO')}] ${msg}`;
  console.log(linea);
  appendFileSync(join(TRABAJO, 'vigilante.log'), linea + '\n');
}

const leerRegistro = () => (existsSync(REGISTRO) ? JSON.parse(readFileSync(REGISTRO, 'utf8')) : { archivos: {}, pendientePublicar: false });
const guardarRegistro = (r) => writeFileSync(REGISTRO, JSON.stringify(r, null, 2) + '\n');

/** Ejecuta un comando mostrando su salida; resuelve con el código de salida. */
function ejecutar(comando, { entrada, timeoutMin = 10 } = {}) {
  return new Promise((ok) => {
    const p = spawn(comando, { cwd: RAIZ, shell: true, stdio: [entrada ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    const t = setTimeout(() => { log(`Tiempo agotado: ${comando.slice(0, 60)}…`); p.kill(); }, timeoutMin * 60_000);
    if (entrada) { p.stdin.write(entrada); p.stdin.end(); }
    p.on('close', (codigo) => { clearTimeout(t); ok(codigo ?? 1); });
    p.on('error', (e) => { clearTimeout(t); log(`No se pudo ejecutar "${comando.split(' ')[0]}": ${e.message}`); ok(1); });
  });
}

/** Lista de capacitaciones actual (en un proceso aparte para no usar módulos en caché). */
function capacitacionesActuales() {
  return new Promise((ok, mal) => {
    let salida = '';
    const p = spawn(process.execPath, ['--input-type=module', '-e',
      "const m = await import('./client/src/data/capacitaciones.js'); console.log(JSON.stringify(m.capacitaciones.map((c) => ({ id: c.id, fecha: c.fechaEjecucion ?? c.fechaProgramada ?? null }))));"],
      { cwd: RAIZ });
    p.stdout.on('data', (d) => { salida += d; });
    p.on('close', (c) => (c === 0 ? ok(JSON.parse(salida)) : mal(new Error('No se pudo leer la lista de capacitaciones'))));
  });
}

const DIAS_ENTRE_CAPACITACIONES = 2;

/**
 * Fecha para la nueva capacitación: 2 días después de la última del cronograma, siempre en día hábil
 * (ni fin de semana ni festivo) y sin pasar de hoy (hora de Bogotá).
 */
function siguienteFecha(lista) {
  const hoy = habil(new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10), -1);
  const fechas = lista.map((c) => c.fecha).filter(Boolean).sort();
  if (!fechas.length) return hoy;
  const siguiente = new Date(`${fechas.at(-1)}T12:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + DIAS_ENTRE_CAPACITACIONES);
  const fecha = habil(siguiente.toISOString().slice(0, 10), 1);
  return fecha < hoy ? fecha : hoy;
}

/** Archivos nuevos y completos (no abiertos en Office ni copiándose todavía). */
async function pendientes() {
  const registro = leerRegistro();
  const nombres = readdirSync(CARPETA).filter((n) => EXTENSIONES.has(extname(n).toLowerCase()) && !n.startsWith('~$') && !registro.archivos[n]);
  const listos = [];
  for (const n of nombres) {
    if (existsSync(join(CARPETA, `~$${n}`)) || existsSync(join(CARPETA, `~$${n.slice(2)}`))) { log(`Esperando a que cierre "${n}" en Office…`); continue; }
    const antes = statSync(join(CARPETA, n));
    await new Promise((r) => setTimeout(r, 3000));
    const despues = statSync(join(CARPETA, n));
    if (antes.size === despues.size && antes.mtimeMs === despues.mtimeMs && despues.size > 0) listos.push(n);
    else log(`"${n}" todavía se está copiando; se revisa de nuevo en un momento.`);
  }
  return listos;
}

async function convertir(nombre) {
  const lista = await capacitacionesActuales();
  const fecha = siguienteFecha(lista);
  const extraccion = join(TRABAJO, `extraccion-${Date.now()}`);
  const resultado = join(TRABAJO, 'resultado.json');
  rmSync(resultado, { force: true });
  log(`Convirtiendo "${nombre}" (fecha ${fecha})…`);
  if (simular) return { estado: 'simulada' };

  const respaldo = join(TRABAJO, 'respaldo');
  mkdirSync(respaldo, { recursive: true });
  EDITABLES.forEach((f, i) => copyFileSync(join(RAIZ, f), join(respaldo, String(i))));
  const restaurar = () => EDITABLES.forEach((f, i) => copyFileSync(join(respaldo, String(i)), join(RAIZ, f)));

  const rel = (p) => p.slice(RAIZ.length + 1).replaceAll('\\', '/');
  const prompt = readFileSync(join(RAIZ, 'scripts', 'agregar-capacitacion.md'), 'utf8')
    .replaceAll('{{ARCHIVO}}', `CAPACITACIONES/${nombre}`)
    .replaceAll('{{EXTRACCION}}', rel(extraccion))
    .replaceAll('{{FECHA}}', fecha)
    .replaceAll('{{RESULTADO}}', rel(resultado));
  const permitidas = HERRAMIENTAS.map((h) => `"${h}"`).join(' ');
  const codigo = await ejecutar(`claude -p --permission-mode acceptEdits --allowedTools ${permitidas}`, { entrada: prompt, timeoutMin: 40 });
  rmSync(extraccion, { recursive: true, force: true });

  const r = existsSync(resultado) ? JSON.parse(readFileSync(resultado, 'utf8')) : null;
  if (codigo !== 0 || !r) { restaurar(); throw new Error(`Claude no terminó la conversión (código ${codigo}).`); }
  if (r.estado === 'creada' && (await ejecutar('node scripts/validar-capacitaciones.js')) !== 0) {
    restaurar();
    throw new Error('La capacitación generada no pasó la validación; se deshicieron los cambios.');
  }
  return r;
}

async function publicar() {
  log('Validando y compilando…');
  if ((await ejecutar('node scripts/validar-capacitaciones.js')) !== 0) return log('No se publica: hay errores de validación.'), false;
  if ((await ejecutar('npm run build')) !== 0) return log('No se publica: falló la compilación.'), false;
  log('Subiendo a Vercel (producción)…');
  if ((await ejecutar('vercel deploy --prod --yes', { timeoutMin: 15 })) !== 0) return log('Falló la subida a Vercel; se reintentará.'), false;
  log('✔ Publicado. Las capacitaciones nuevas ya se ven en el aplicativo.');
  return true;
}

const ESPERA_RETIRO_MS = 60_000; // un archivo debe faltar al menos este tiempo antes de retirar su capacitación
const MAX_RETIROS = 3; // si faltan más a la vez (¿carpeta movida por error?) no se retira nada sin confirmar

/** Retira del aplicativo las capacitaciones cuyo archivo se borró de CAPACITACIONES/. */
async function retirarBorradas(registro) {
  const enCarpeta = readdirSync(CARPETA).filter((n) => EXTENSIONES.has(extname(n).toLowerCase()) && !n.startsWith('~$'));
  const presentes = new Set(enCarpeta);
  const faltan = Object.keys(registro.archivos).filter((n) => !presentes.has(n));
  registro.faltantes ??= {};
  for (const n of Object.keys(registro.faltantes)) if (!faltan.includes(n)) delete registro.faltantes[n]; // volvió a aparecer
  if (!faltan.length) return;

  // Renombrado: un archivo nuevo con el mismo tamaño que uno que falta conserva su capacitación
  const nuevos = enCarpeta.filter((n) => !registro.archivos[n]);
  for (const n of [...faltan]) {
    const e = registro.archivos[n];
    const renombrado = e.tamano && nuevos.find((x) => statSync(join(CARPETA, x)).size === e.tamano);
    if (!renombrado) continue;
    registro.archivos[renombrado] = e;
    delete registro.archivos[n];
    delete registro.faltantes[n];
    nuevos.splice(nuevos.indexOf(renombrado), 1);
    faltan.splice(faltan.indexOf(n), 1);
    log(`"${n}" se renombró a "${renombrado}"; se conserva su capacitación.`);
  }

  // Si la capacitación sigue teniendo otro archivo en la carpeta (p. ej. su versión PDF), no se retira
  const idsConArchivo = new Set(Object.entries(registro.archivos).filter(([n]) => presentes.has(n)).map(([, e]) => e.id).filter(Boolean));
  const ahora = Date.now();
  const porRetirar = [];
  for (const n of faltan) {
    const e = registro.archivos[n];
    if (e.estado !== 'creada' || !e.id || idsConArchivo.has(e.id)) {
      delete registro.archivos[n];
      delete registro.faltantes[n];
      continue;
    }
    registro.faltantes[n] ??= ahora;
    if (ahora - registro.faltantes[n] >= ESPERA_RETIRO_MS) porRetirar.push(n);
    else log(`Se borró "${n}": se retirará "${e.id}" del aplicativo en un momento si no vuelve a aparecer.`);
  }
  if (!simular) guardarRegistro(registro);
  if (!porRetirar.length) return;
  if (porRetirar.length > MAX_RETIROS && !args.has('--confirmar-retiro')) {
    log(`⚠ Faltan ${porRetirar.length} archivos a la vez (${porRetirar.join(', ')}). Por seguridad no se retira nada. Si es intencional, ejecute: npm run publicar -- --confirmar-retiro`);
    return;
  }

  for (const n of porRetirar) {
    const { id } = registro.archivos[n];
    if (simular) { log(`Se retiraría "${id}" (se borró "${n}").`); continue; }
    const respaldo = join(TRABAJO, 'respaldo');
    mkdirSync(respaldo, { recursive: true });
    const archivos = [...EDITABLES, 'client/src/data/capacitacionesRetiradas.js'];
    archivos.forEach((f, i) => copyFileSync(join(RAIZ, f), join(respaldo, String(i))));
    let fotos = [];
    try {
      ({ fotos } = retirar(id));
      if ((await ejecutar('node scripts/validar-capacitaciones.js')) !== 0) throw new Error('la validación falló');
      delete registro.archivos[n];
      delete registro.faltantes[n];
      registro.pendientePublicar = true;
      log(`✔ Se borró "${n}": "${id}" se retiró del aplicativo${fotos.length ? ` (fotos a la papelera: ${fotos.join(', ')})` : ''}.`);
    } catch (e) {
      archivos.forEach((f, i) => copyFileSync(join(respaldo, String(i)), join(RAIZ, f)));
      devolverFotos(fotos);
      log(`✖ No se pudo retirar "${id}": ${e.message}. Se deshicieron los cambios.`);
    }
    guardarRegistro(registro);
  }
}

let ocupado = false;
let otraVez = false;

async function procesar() {
  if (ocupado) { otraVez = true; return; }
  ocupado = true;
  try {
    const registro = leerRegistro();
    await retirarBorradas(registro);
    for (const nombre of await pendientes()) {
      try {
        const r = await convertir(nombre);
        if (simular) continue;
        registro.archivos[nombre] = { ...r, tamano: statSync(join(CARPETA, nombre)).size, procesado: new Date().toISOString() };
        if (r.estado === 'creada') { registro.pendientePublicar = true; log(`✔ "${r.titulo}" creada (${r.diapositivas} diapositivas, id ${r.id}).`); }
        else log(`Se omitió "${nombre}": ${r.motivo}`);
        guardarRegistro(registro);
      } catch (e) {
        log(`✖ ${nombre}: ${e.message}`);
      }
    }
    if (registro.pendientePublicar && !simular && (await publicar())) {
      registro.pendientePublicar = false;
      guardarRegistro(registro);
    }
  } finally {
    ocupado = false;
    if (otraVez) { otraVez = false; setTimeout(procesar, 2000); }
  }
}

await procesar();
if (unaVez || simular) process.exit(0);

log(`Vigilando ${CARPETA}. Copie ahí las capacitaciones (PowerPoint, PDF o Word). Ctrl+C para detener.`);
let espera;
watch(CARPETA, () => { clearTimeout(espera); espera = setTimeout(procesar, 5000); });
setInterval(procesar, 60_000); // respaldo por si el sistema no avisa algún cambio
