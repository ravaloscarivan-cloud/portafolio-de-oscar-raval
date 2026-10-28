import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { capacitaciones as todas } from '../data/capacitaciones.js';

let cache = null;

/** Capacitaciones visibles: todas menos las que el administrador ocultó o eliminó. */
export function useCapacitaciones() {
  const [ocultas, setOcultas] = useState(cache);
  const [cargando, setCargando] = useState(!cache);

  useEffect(() => {
    let activo = true;
    api.capacitaciones
      .ocultas()
      .then((r) => {
        cache = r.ocultas ?? [];
        if (activo) setOcultas(cache);
      })
      .catch(() => activo && setOcultas((o) => o ?? []))
      .finally(() => activo && setCargando(false));
    return () => { activo = false; };
  }, []);

  return { capacitaciones: ocultas ? todas.filter((c) => !ocultas.includes(c.id)) : [], cargando };
}
