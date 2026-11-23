import { useMemo, useState } from 'react'
import { ClipboardCheck, Send } from 'lucide-react'
import { EVALUACIONES } from './evaluaciones'

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

// Test de una política, sin puntaje: se completa al responder todas las preguntas.
export default function Evaluacion({ documento, modo, initialAnswers, onAnswersChange, onCancel, onComplete }) {
  const preguntas = EVALUACIONES[documento.id]
  // Las respuestas van por índice de pregunta: siguen valiendo aunque el orden se baraje al recargar.
  const [answers, setAnswers] = useState(() => initialAnswers || {})
  const [error, setError] = useState('')
  const order = useMemo(() => shuffle(preguntas.map((pregunta, index) => ({
    index,
    pregunta: pregunta.pregunta,
    opciones: shuffle(pregunta.opciones.map((texto, optionIndex) => ({ texto, optionIndex }))),
  }))), [preguntas])
  const isPre = modo === 'pre'
  const answered = Object.keys(answers).length

  function handleSubmit(event) {
    event.preventDefault()
    if (answered < preguntas.length) {
      setError(`Responde todas las preguntas (${answered} de ${preguntas.length}).`)
      return
    }
    onComplete({ at: new Date().toISOString() })
  }

  return (
    <form className="evaluacion" onSubmit={handleSubmit} aria-labelledby="evaluacion-title">
      <header className="evaluacion-header">
        <span className="evaluacion-icon" aria-hidden="true"><ClipboardCheck size={22} /></span>
        <div>
          <span className="evaluacion-kicker">{isPre ? 'Pre-test' : 'Pos-test'}</span>
          <h2 id="evaluacion-title">{documento.code} · {documento.title}</h2>
          <p>
            {isPre
              ? 'Responde estas preguntas antes de ver la presentación.'
              : 'Ya viste la presentación: responde de nuevo las preguntas.'}
          </p>
        </div>
      </header>

      <ol className="evaluacion-preguntas">
        {order.map((pregunta, position) => (
          <li key={pregunta.index} className={answers[pregunta.index] !== undefined ? 'answered' : ''}>
            <fieldset>
              <legend><span>{position + 1}.</span> {pregunta.pregunta}</legend>
              {pregunta.opciones.map((opcion) => (
                <label key={opcion.optionIndex} className={answers[pregunta.index] === opcion.optionIndex ? 'selected' : ''}>
                  <input
                    type="radio"
                    name={`pregunta-${pregunta.index}`}
                    checked={answers[pregunta.index] === opcion.optionIndex}
                    onChange={() => {
                      setError('')
                      const next = { ...answers, [pregunta.index]: opcion.optionIndex }
                      setAnswers(next)
                      onAnswersChange?.(next)
                    }}
                  />
                  <span>{opcion.texto}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>

      {error && <p className="evaluacion-error" role="alert">{error}</p>}
      <div className="evaluacion-actions">
        <span>{answered} de {preguntas.length} respondidas</span>
        {onCancel && (
          <button type="button" className="evaluacion-cancel" onClick={onCancel}>Volver a la presentación</button>
        )}
        <button type="submit" className="primary-action">
          <Send size={16} aria-hidden="true" />
          {isPre ? 'Enviar pre-test' : 'Enviar pos-test'}
        </button>
      </div>
    </form>
  )
}
