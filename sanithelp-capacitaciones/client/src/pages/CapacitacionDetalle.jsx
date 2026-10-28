import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import DatosCapacitacion from '../components/DatosCapacitacion.jsx';
import Evaluacion, { ResultadoFinal } from '../components/Evaluacion.jsx';
import Presentacion from '../components/Presentacion.jsx';
import { fechaDe, formatoFecha } from '../lib/fechas.js';
import { participante } from '../lib/participante.js';
import { useCapacitaciones } from '../lib/useCapacitaciones.js';

// Flujo de cada capacitación: pre-test → diapositivas → post-test → resultado.
export default function CapacitacionDetalle() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { capacitaciones, cargando } = useCapacitaciones();
  const capacitacion = capacitaciones.find((c) => c.id === id);

  const [persona, setPersona] = useState(participante.obtener);
  const [preguntas, setPreguntas] = useState(null); // { pre: [...], post: [...] }
  const [avance, setAvance] = useState(null); // { pre?: {puntaje}, post?: {puntaje} }
  const [resultadoPost, setResultadoPost] = useState(null);
  const [error, setError] = useState('');
  const [asistenciaEnviada, setAsistenciaEnviada] = useState(location.state?.asistenciaEnviada ?? null);

  useEffect(() => {
    const mensaje = location.state?.asistenciaEnviada;
    if (!mensaje) return;
    setAsistenciaEnviada(mensaje);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setPreguntas(null);
    setResultadoPost(null);
    api.evaluacion.obtener(id).then(setPreguntas).catch((e) => { setPreguntas({ pre: [], post: [] }); setError(e.message); });
  }, [id]);

  useEffect(() => {
    if (!persona) return setAvance({});
    api.evaluacion.progreso(persona.correo).then((r) => setAvance(r.progreso[id] ?? {})).catch(() => setAvance({}));
  }, [id, persona]);

  if (!capacitacion) return cargando ? <p className="muted">Cargando…</p> : <Navigate to="/capacitaciones" replace />;
  if (!preguntas || !avance) return <p className="muted">Cargando…</p>;

  const recordar = (p) => {
    participante.guardar(p);
    if (p.correo !== persona?.correo) setPersona(p);
  };

  const conEvaluacion = preguntas.pre.length > 0 && preguntas.post.length > 0;
  const preHecho = Boolean(avance.pre);
  const postHecho = Boolean(avance.post);

  return (
    <>
      <div className="detalle-cabecera">
        <Link to="/capacitaciones" className="btn btn-texto">← Todas las capacitaciones</Link>
        {conEvaluacion && (
          <div className="pasos-capacitacion">
            <span className={preHecho ? 'hecho' : 'actual'}>1. Pre-test {preHecho && '✓'}</span>
            <span className={postHecho ? 'hecho' : preHecho ? 'actual' : ''}>2. Capacitación {postHecho && '✓'}</span>
            <span className={postHecho ? 'hecho' : preHecho ? 'actual' : ''}>3. Post-test {postHecho && '✓'}</span>
          </div>
        )}
      </div>
      {error && <div className="alerta alerta-error">{error}</div>}
      {asistenciaEnviada && (
        <div className="alerta alerta-exito" role="status" aria-live="polite">
          Asistencia enviada. Tu firma quedó registrada para esta capacitación el {formatoFecha(asistenciaEnviada.fecha)}.
        </div>
      )}

      {conEvaluacion && !avance.asistencia ? (
        <>
          <div className="detalle-intro card">
            <h1>{capacitacion.titulo}</h1>
            <p className="muted">{capacitacion.resumen}</p>
            <DatosCapacitacion c={capacitacion} />
          </div>
          <div className="alerta alerta-aviso recordatorio-asistencia">
            Para iniciar esta capacitación, primero registre su asistencia.
            <Link to={`/asistencia/${id}`} className="btn btn-primario btn-sm">Registrar asistencia</Link>
          </div>
        </>
      ) : conEvaluacion && !preHecho ? (
        <>
          <div className="detalle-intro card">
            <h1>{capacitacion.titulo}</h1>
            <p className="muted">{capacitacion.resumen}</p>
            <DatosCapacitacion c={capacitacion} />
          </div>
          <Evaluacion
            key={`pre-${persona?.correo ?? ''}`}
            capacitacionId={id}
            tipo="pre"
            preguntas={preguntas.pre}
            persona={persona}
            onPersona={recordar}
            onTerminado={(r) => {
              setAvance((a) => ({ ...a, pre: { puntaje: r.puntaje, fecha: r.fecha } }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      ) : (
        <>
          <div className="detalle-datos">
            <h1>{capacitacion.titulo}</h1>
            <DatosCapacitacion c={capacitacion} />
          </div>
          {conEvaluacion && postHecho && !resultadoPost && (
            <div className="alerta alerta-exito">
              ✓ Ya presentó las evaluaciones de esta capacitación ({formatoFecha(avance.post.fecha ?? fechaDe(capacitacion))}). Pre-test: {avance.pre.puntaje}% · Post-test: {avance.post.puntaje}%
            </div>
          )}
          {conEvaluacion && !postHecho && avance.pre && (
            <div className="alerta alerta-info">Pre-test enviado ({avance.pre.puntaje}%) con fecha {formatoFecha(avance.pre.fecha ?? fechaDe(capacitacion))}. Lea la capacitación y al final presente el post-test.</div>
          )}

          <Presentacion capacitacion={capacitacion} />

          {conEvaluacion && !postHecho && !avance.asistencia && (
            <div className="alerta alerta-aviso recordatorio-asistencia">
              Para presentar el post-test, primero registre su asistencia a esta capacitación.
              <Link to={`/asistencia/${id}`} className="btn btn-primario btn-sm">Registrar asistencia</Link>
            </div>
          )}
          {conEvaluacion && !postHecho && avance.asistencia && (
            <Evaluacion
              key={`post-${persona?.correo ?? ''}`}
              capacitacionId={id}
              tipo="post"
              preguntas={preguntas.post}
              persona={persona}
              onPersona={recordar}
              onTerminado={(r) => {
                setResultadoPost(r);
                setAvance((a) => ({ ...a, post: { puntaje: r.puntaje, fecha: r.fecha } }));
                navigate('/capacitaciones', { replace: true, state: { capacitacionCompletada: id } });
              }}
            />
          )}
          {resultadoPost && <ResultadoFinal preguntas={preguntas.post} resultado={resultadoPost} pre={avance.pre} />}
          {conEvaluacion && postHecho && !avance.asistencia && (
            <div className="alerta alerta-aviso recordatorio-asistencia">
              Recuerde registrar su asistencia a esta capacitación en el menú <strong>Asistencia</strong>.
            </div>
          )}
        </>
      )}
    </>
  );
}
