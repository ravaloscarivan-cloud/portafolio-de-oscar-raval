import { capacitaciones as fijas } from '../client/src/data/capacitaciones.js';

const hoyBogota = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const aFecha = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);

/** Fecha que se muestra para un registro: la que tiene hoy la capacitación (por si se cambió después) o la guardada. */
export const fechaRegistro = (id, guardada) => {
  const c = fijas.find((x) => x.id === id);
  return c?.fechaEjecucion ?? c?.fechaProgramada ?? aFecha(guardada);
};

/** ¿El administrador ocultó o eliminó esta capacitación? */
export async function estaOculta(sql, id) {
  const [f] = await sql`SELECT 1 FROM capacitaciones_ocultas WHERE id = ${id}`;
  return Boolean(f);
}

/**
 * Datos básicos de una capacitación visible para registrar asistencias y evaluaciones.
 * "fecha" es la fecha de la capacitación: la de ejecución, si no la programada, y si no la de hoy.
 */
export async function obtenerCapacitacion(sql, id) {
  const c = fijas.find((x) => x.id === id);
  if (!c || (await estaOculta(sql, id))) return null;
  return { id, titulo: c.titulo, fecha: c.fechaEjecucion ?? c.fechaProgramada ?? hoyBogota() };
}
