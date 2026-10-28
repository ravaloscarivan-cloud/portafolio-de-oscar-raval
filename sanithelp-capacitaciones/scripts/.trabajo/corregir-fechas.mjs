// Pasa al día hábil anterior las capacitaciones cuya fecha cae en sábado, domingo o festivo.
import { readFileSync, writeFileSync } from 'node:fs';
import { capacitaciones } from '../../client/src/data/capacitaciones.js';
import { habil, noHabil } from '../festivos.js';

const ARCHIVOS = ['capacitaciones.js', 'capacitacionesNuevas.js', 'capacitacionesAmbientales.js', 'capacitacionesImportadas.js']
  .map((f) => new URL(`../../client/src/data/${f}`, import.meta.url));
const dia = (f) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

const cambios = capacitaciones
  .filter((c) => noHabil(c.fechaEjecucion) || noHabil(c.fechaProgramada))
  .map((c) => ({ id: c.id, titulo: c.titulo, antes: c.fechaEjecucion, motivo: noHabil(c.fechaEjecucion), nueva: habil(c.fechaEjecucion, -1) }));

for (const url of ARCHIVOS) {
  let s = readFileSync(url, 'utf8');
  for (const c of cambios) {
    const m = new RegExp(`\\n( *)id: '${c.id}',\\r?\\n`).exec(s);
    if (!m) continue;
    const ini = m.index + m[0].length;
    const fin = s.indexOf('diapositivas:', ini);
    const cab = s.slice(ini, fin)
      .replace(/fechaProgramada: '[^']*'/, `fechaProgramada: '${c.nueva}'`)
      .replace(/fechaEjecucion: '[^']*'/, `fechaEjecucion: '${c.nueva}'`);
    s = s.slice(0, ini) + cab + s.slice(fin);
    c.hecho = true;
  }
  writeFileSync(url, s);
}
for (const c of cambios) console.log(`${c.hecho ? '✔' : '✖'} ${c.titulo}: ${dia(c.antes)} (${c.motivo}) → ${dia(c.nueva)}`);
if (!cambios.length) console.log('Ninguna capacitación cae en día no hábil.');
