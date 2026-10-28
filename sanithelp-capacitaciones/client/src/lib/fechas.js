/** 'AAAA-MM-DD' → "11 may 2026" */
export const formatoFecha = (iso) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Fecha que se registra para una capacitación: la de ejecución o, si no hay, la programada. */
export const fechaDe = (c) => c?.fechaEjecucion ?? c?.fechaProgramada ?? null;
