const fecha = (iso) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/** Horas, facilitador y fechas (programada y de ejecución) de una capacitación. */
export default function DatosCapacitacion({ c, compacto }) {
  const datos = [
    c.duracion && { icono: '⏱', texto: c.duracion },
    c.facilitador && { icono: '👤', texto: c.facilitador },
    c.fechaProgramada && { icono: '📅', texto: `Programada: ${fecha(c.fechaProgramada)}` },
    c.fechaEjecucion && { icono: '✔', texto: `Ejecución: ${fecha(c.fechaEjecucion)}` },
  ].filter(Boolean);
  if (!datos.length) return null;
  return (
    <ul className={`datos-cap ${compacto ? 'compacto' : ''}`}>
      {datos.map((d) => (
        <li key={d.texto}><span aria-hidden="true">{d.icono}</span> {d.texto}</li>
      ))}
    </ul>
  );
}
