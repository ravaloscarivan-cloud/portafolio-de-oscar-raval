// Días hábiles en Colombia: ni sábado, ni domingo, ni festivo (Ley 51 de 1983, "Ley Emiliani").
// Fechas en formato 'AAAA-MM-DD'. Lo usan el validador y el vigilante para que ninguna capacitación caiga en día no hábil.

const iso = (d) => d.toISOString().slice(0, 10);
const fecha = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
const sumar = (d, dias) => new Date(d.getTime() + dias * 86_400_000);
/** Si no cae en lunes, se traslada al lunes siguiente. */
const alLunes = (d) => sumar(d, (8 - d.getUTCDay()) % 7);

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(a) {
  const b = a % 19, c = Math.floor(a / 100), e = a % 100;
  const h = (19 * b + c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 15) % 30;
  const l = (32 + 2 * (c % 4) + 2 * Math.floor(e / 4) - h - (e % 4)) % 7;
  const m = Math.floor((b + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return fecha(a, mes, ((h + l - 7 * m + 114) % 31) + 1);
}

const cache = new Map();

/** Festivos de un año: Map 'AAAA-MM-DD' → nombre. */
export function festivos(a) {
  if (cache.has(a)) return cache.get(a);
  const p = pascua(a);
  const lista = [
    [fecha(a, 1, 1), 'Año Nuevo'],
    [alLunes(fecha(a, 1, 6)), 'Reyes Magos'],
    [alLunes(fecha(a, 3, 19)), 'San José'],
    [sumar(p, -3), 'Jueves Santo'],
    [sumar(p, -2), 'Viernes Santo'],
    [fecha(a, 5, 1), 'Día del Trabajo'],
    [alLunes(sumar(p, 39)), 'Ascensión del Señor'],
    [alLunes(sumar(p, 60)), 'Corpus Christi'],
    [alLunes(sumar(p, 68)), 'Sagrado Corazón'],
    [alLunes(fecha(a, 6, 29)), 'San Pedro y San Pablo'],
    [fecha(a, 7, 20), 'Día de la Independencia'],
    [fecha(a, 8, 7), 'Batalla de Boyacá'],
    [alLunes(fecha(a, 8, 15)), 'Asunción de la Virgen'],
    [alLunes(fecha(a, 10, 12)), 'Día de la Raza'],
    [alLunes(fecha(a, 11, 1)), 'Todos los Santos'],
    [alLunes(fecha(a, 11, 11)), 'Independencia de Cartagena'],
    [fecha(a, 12, 8), 'Inmaculada Concepción'],
    [fecha(a, 12, 25), 'Navidad'],
  ];
  const m = new Map(lista.map(([d, n]) => [iso(d), n]));
  cache.set(a, m);
  return m;
}

/** Motivo por el que una fecha no es hábil ('sábado', 'domingo' o el festivo), o null si es hábil. */
export function noHabil(f) {
  const d = new Date(`${f}T12:00:00Z`);
  if (d.getUTCDay() === 6) return 'sábado';
  if (d.getUTCDay() === 0) return 'domingo';
  return festivos(d.getUTCFullYear()).get(f) ?? null;
}

/** El mismo día si es hábil; si no, el día hábil anterior (dir = -1) o siguiente (dir = 1). */
export function habil(f, dir = -1) {
  let d = new Date(`${f}T12:00:00Z`);
  while (noHabil(iso(d))) d = sumar(d, dir);
  return iso(d);
}
