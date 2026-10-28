import { useEffect, useState } from 'react';
import { api, SesionVencida } from '../../api.js';
import { formatoFecha } from '../../lib/fechas.js';

export default function AdminCapacitaciones({ onSesionVencida }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');

  const manejar = (err) => {
    if (err instanceof SesionVencida) return onSesionVencida();
    setError(err.message);
  };

  useEffect(() => { api.admin.capacitaciones().then(setLista).catch(manejar); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = async (c, estado) => {
    if (estado === c.estado) return;
    if (estado === 'eliminada' && !confirm(`¿Eliminar "${c.titulo}"?\n\nDejará de verse para los usuarios y no recibirá más tests ni firmas. Sus respuestas ya registradas se conservan y puede restaurarla después.`)) return;
    setError('');
    try {
      setLista(await api.admin.cambiarEstado(c.id, estado));
    } catch (err) {
      manejar(err);
    }
  };

  if (!lista) return error ? <div className="alerta alerta-error">{error}</div> : <p className="muted">Cargando…</p>;
  const visibles = lista.filter((c) => c.estado === 'visible').length;

  return (
    <section className="card">
      <h2 className="card-titulo">Capacitaciones <span className="badge">{visibles} visibles de {lista.length}</span></h2>
      <p className="muted subir-ayuda">Elija en Estado si cada capacitación está visible u oculta para los usuarios.</p>
      {error && <div className="alerta alerta-error">{error}</div>}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Capacitación</th><th>Ejecución</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {lista.map((c) => {
              const eliminada = c.estado === 'eliminada';
              return (
                <tr key={c.id} className={c.estado !== 'visible' ? 'fila-eliminada' : ''}>
                  <td><strong>{c.titulo}</strong></td>
                  <td className="muted">{formatoFecha(c.fechaEjecucion) || '—'}</td>
                  <td>
                    {eliminada ? (
                      <span className="estado eliminada">Eliminada</span>
                    ) : (
                      <select
                        className={`selector-estado ${c.estado}`}
                        value={c.estado}
                        onChange={(e) => cambiar(c, e.target.value)}
                        aria-label={`Estado de ${c.titulo}`}
                      >
                        <option value="visible">Visible</option>
                        <option value="oculta">Oculta</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <div className="acciones">
                      {eliminada ? (
                        <button className="btn btn-primario btn-sm" onClick={() => cambiar(c, 'visible')}>Restaurar</button>
                      ) : (
                        <button className="btn btn-texto peligro" onClick={() => cambiar(c, 'eliminada')}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
