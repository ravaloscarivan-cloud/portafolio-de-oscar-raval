import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Icono from '../components/Icono.jsx';
import { fechaDe, formatoFecha } from '../lib/fechas.js';
import { participante } from '../lib/participante.js';
import { useCapacitaciones } from '../lib/useCapacitaciones.js';

export default function Capacitaciones() {
  const location = useLocation();
  const navigate = useNavigate();
  const { capacitaciones } = useCapacitaciones();
  const [persona, setPersona] = useState(participante.obtener);
  const [progreso, setProgreso] = useState({});
  const [capacitacionCompletada, setCapacitacionCompletada] = useState(null);

  useEffect(() => {
    const id = location.state?.capacitacionCompletada;
    if (!id) return;
    setCapacitacionCompletada(id);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!persona) return;
    api.evaluacion.progreso(persona.correo).then((r) => setProgreso(r.progreso)).catch(() => {});
  }, [persona]);

  useEffect(() => {
    if (!capacitacionCompletada || !progreso[capacitacionCompletada]?.post) return;
    document.getElementById(`capacitacion-${capacitacionCompletada}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [capacitacionCompletada, progreso]);

  const completa = (p) => Boolean(p?.pre && p?.post && p?.asistencia);
  const completadas = capacitaciones.filter((c) => completa(progreso[c.id])).length;
  const estadoCapacitacion = (p) => {
    if (completa(p)) return 'Completado';
    if (!p?.asistencia) return 'Pendiente · Firmar asistencia';
    if (!p.pre) return 'En curso · Pre-test pendiente';
    if (!p.post) return 'En curso · Capacitación y post-test';
    return 'En curso · Revisar progreso';
  };

  return (
    <>
      <div className="page-header">
        <h1>Capacitaciones</h1>
        <p className="muted">
          Cada capacitación tiene un pre-test, las diapositivas y un post-test; la asistencia se firma en el menú Asistencia.
        </p>
      </div>

      {persona && (
        <div className="avance-persona">
          <span>
            Hola, <strong>{persona.nombre}</strong>. Ha completado <strong>{completadas} de {capacitaciones.length}</strong> capacitaciones.
          </span>
          <button type="button" className="btn-link" onClick={() => { participante.olvidar(); setPersona(null); setProgreso({}); }}>
            No soy {persona.nombre}
          </button>
        </div>
      )}

      {capacitacionCompletada && (
        <div className="alerta alerta-exito" role="status" aria-live="polite">
          Capacitación completada. Tu avance está actualizado; aquí puedes continuar con otra.
        </div>
      )}

      <div className="grid-capacitaciones">
        {capacitaciones.map((c) => {
          const p = progreso[c.id] ?? {};
          return (
            <Link
              key={c.id}
              id={`capacitacion-${c.id}`}
              to={`/capacitaciones/${c.id}`}
              className={`cap-tarjeta ${completa(p) ? 'completada' : ''} ${capacitacionCompletada === c.id && completa(p) ? 'recien-completada' : ''}`}
            >
              {c.portada?.src && <img className="cap-tarjeta-imagen" src={c.portada.src} alt={c.portada.alt ?? ''} loading="lazy" />}
              <div className="cap-tarjeta-contenido">
                <h2>{c.titulo}</h2>
                {fechaDe(c) && <p className="cap-tarjeta-fecha"><Icono nombre="calendario" /> {formatoFecha(fechaDe(c))}</p>}
                {persona && (
                  <div className="cap-estado">
                    <span className={completa(p) ? 'cap-completada' : 'cap-progreso'}>{estadoCapacitacion(p)}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
