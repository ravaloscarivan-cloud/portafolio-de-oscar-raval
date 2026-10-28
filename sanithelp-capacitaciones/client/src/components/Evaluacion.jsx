import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { borrador } from '../lib/borrador.js';
import { formatoFecha } from '../lib/fechas.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

/** Formulario del pre-test o post-test de una capacitación. */
export default function Evaluacion({ capacitacionId, tipo, preguntas, persona, onPersona, onTerminado }) {
  const clave = `test:${capacitacionId}:${tipo}`;
  const [guardado] = useState(() => borrador.leer(clave));
  const [datos, setDatos] = useState(persona ?? guardado?.datos ?? { nombre: '', apellido: '', correo: '' });
  const [editarDatos, setEditarDatos] = useState(!persona);
  const [respuestas, setRespuestas] = useState(() =>
    guardado?.respuestas?.length === preguntas.length ? guardado.respuestas : preguntas.map(() => null),
  );
  const recuperado = Boolean(guardado?.respuestas?.some((r) => r !== null));

  // Pre-guardado: cada cambio queda en el navegador hasta que se envíe el test
  useEffect(() => {
    if (respuestas.some((r) => r !== null) || (!persona && datos.correo)) borrador.guardar(clave, { respuestas, datos: persona ? undefined : datos });
  }, [respuestas, datos]); // eslint-disable-line react-hooks/exhaustive-deps
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const completas = respuestas.every((r) => r !== null);
  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!completas) return setError('Responda todas las preguntas antes de enviar.');
    setEnviando(true);
    try {
      const r = await api.evaluacion.enviar({ capacitacionId, tipo, ...datos, respuestas });
      borrador.borrar(clave);
      onPersona(datos);
      onTerminado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="card evaluacion" onSubmit={enviar}>
      <span className="slide-etiqueta">{tipo === 'pre' ? 'Antes de empezar' : 'Para terminar'}</span>
      <h2>{tipo === 'pre' ? 'Evaluación previa (pre-test)' : 'Evaluación final (post-test)'}</h2>
      <p className="muted">
        {tipo === 'pre'
          ? 'Responda estas preguntas antes de ver la capacitación. No se preocupe si no conoce las respuestas: sirven para medir lo que aprenderá.'
          : 'Responda de nuevo las preguntas para comprobar lo que aprendió en la capacitación.'}
      </p>

      {recuperado && <div className="alerta alerta-info">Recuperamos las respuestas que había marcado. Puede continuar donde iba.</div>}

      {editarDatos ? (
        <div className="evaluacion-datos">
          <div className="fila">
            <label className="campo"><span>Nombre *</span><input name="nombre" value={datos.nombre} onChange={cambiar} required autoComplete="given-name" /></label>
            <label className="campo"><span>Apellido *</span><input name="apellido" value={datos.apellido} onChange={cambiar} required autoComplete="family-name" /></label>
          </div>
          <label className="campo"><span>Correo electrónico *</span><input type="email" name="correo" value={datos.correo} onChange={cambiar} required autoComplete="email" placeholder="nombre@correo.com" /></label>
        </div>
      ) : (
        <p className="evaluacion-persona">
          Presentando como <strong>{datos.nombre} {datos.apellido}</strong> ({datos.correo}) ·{' '}
          <button type="button" className="btn-link" onClick={() => setEditarDatos(true)}>No soy yo</button>
        </p>
      )}

      <ol className="evaluacion-preguntas">
        {preguntas.map((p, i) => (
          <li key={i}>
            <p className="evaluacion-pregunta">{p.pregunta}</p>
            <div className="evaluacion-opciones">
              {p.opciones.map((o, j) => (
                <label key={j} className={`evaluacion-opcion ${respuestas[i] === j ? 'elegida' : ''}`}>
                  <input type="radio" name={`p${i}`} checked={respuestas[i] === j} onChange={() => setRespuestas(respuestas.map((r, k) => (k === i ? j : r)))} />
                  <span className="evaluacion-letra">{LETRAS[j]}</span>
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {error && <div className="alerta alerta-error">{error}</div>}
      <button className="btn btn-primario btn-bloque" disabled={enviando || !completas}>
        {enviando ? 'Enviando…' : `Enviar ${tipo === 'pre' ? 'pre-test' : 'post-test'}`}
      </button>
    </form>
  );
}

/** Resultado del post-test con las respuestas correctas. */
export function ResultadoFinal({ preguntas, resultado, pre }) {
  return (
    <section className="card evaluacion resultado-final">
      <div className="resultado-insignia">✓</div>
      <h2>¡Completó la capacitación!</h2>
      <div className="resultado-puntajes">
        {pre && <div><span>Pre-test</span><strong>{pre.puntaje}%</strong></div>}
        <div><span>Post-test</span><strong>{resultado.puntaje}%</strong></div>
      </div>
      <p className="muted">
        Respondió bien {resultado.correctas} de {resultado.total} preguntas.
        {resultado.fecha && <> Registrado con la fecha de la capacitación: <strong>{formatoFecha(resultado.fecha)}</strong>.</>}
      </p>
      {resultado.detalle && (
        <ol className="evaluacion-preguntas revision">
          {preguntas.map((p, i) => {
            const d = resultado.detalle[i];
            return (
              <li key={i} className={d.elegida === d.correcta ? 'bien' : 'mal'}>
                <p className="evaluacion-pregunta">{d.elegida === d.correcta ? '✓' : '✗'} {p.pregunta}</p>
                <p className="muted">Respuesta correcta: <strong>{p.opciones[d.correcta]}</strong></p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
