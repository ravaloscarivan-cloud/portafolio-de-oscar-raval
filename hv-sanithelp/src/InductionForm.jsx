import { forwardRef, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eraser, Send } from 'lucide-react'
import logoSanitHelp from './assets/logo_sanithelp.png'

// Réplica del formulario "Constancia de Inducción y Reinducción" de forms.app.
// Las respuestas se quedan en la app para poder ponerlas al principio del PDF de Resultados.
export const INDUCTION_TITLE = 'Constancia de Inducción y Reinducción — SanitHelp S.A.S.'
export const INDUCTION_MODULES = [
  { id: 'module1', label: 'Módulo 1: Inducción General' },
  { id: 'module2', label: 'Módulo 2: Seguridad y Salud en el Trabajo' },
  { id: 'module3', label: 'Módulo 3: Código de Ética y Conducta (1)' },
]
export const EMPTY_INDUCTION_ANSWERS = {
  firstName: '',
  lastName: '',
  idNumber: '',
  role: '',
  email: '',
  module1: false,
  module2: false,
  module3: false,
  terms: false,
  comments: '',
}

export function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!value) return
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.src = value
  }, [value])

  function getPoint(event) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function handlePointerDown(event) {
    event.preventDefault()
    const context = canvasRef.current.getContext('2d')
    const { x, y } = getPoint(event)
    drawingRef.current = true
    canvasRef.current.setPointerCapture(event.pointerId)
    context.lineWidth = 3.2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0b1a78'
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + 0.1, y + 0.1)
    context.stroke()
  }

  function handlePointerMove(event) {
    if (!drawingRef.current) return
    const context = canvasRef.current.getContext('2d')
    const { x, y } = getPoint(event)
    context.lineTo(x, y)
    context.stroke()
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        width={1200}
        height={360}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Área para dibujar la firma"
      />
      {!value && <span className="signature-placeholder">Dibuja tu firma aquí</span>}
      {value && (
        <button type="button" className="signature-clear" onClick={() => onChange('')}>
          <Eraser size={15} aria-hidden="true" />
          Borrar firma
        </button>
      )}
    </div>
  )
}

// Versión para el PDF: mismo formato, con las respuestas en lugar de los campos.
export const InductionPrintable = forwardRef(function InductionPrintable({ answers, signature, submittedAt }, ref) {
  const Answer = ({ children, placeholder }) => (
    <div className={`ci-answer ${children ? '' : 'empty'}`}>{children || placeholder}</div>
  )
  const Check = ({ checked, children }) => (
    <div className="ci-answer ci-check">
      <span className={`ci-box ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</span>
      {children}
    </div>
  )

  return (
    <div ref={ref} className="constancia constancia-print">
      <div className="ci-banner"><img src={logoSanitHelp} alt="SanitHelp" /></div>
      <div className="ci-body">
        <h1 className="ci-title">{INDUCTION_TITLE}</h1>
        <div className="ci-question">
          <h2>1. Nombre Completo<em>*</em></h2>
          <div className="ci-two">
            <Answer placeholder="Nombres">{answers.firstName}</Answer>
            <Answer placeholder="Apellidos">{answers.lastName}</Answer>
          </div>
        </div>
        <div className="ci-question">
          <h2>2. Cédula<em>*</em></h2>
          <Answer placeholder="Número de Identificación">{answers.idNumber}</Answer>
        </div>
        <div className="ci-question">
          <h2>3. Cargo<em>*</em></h2>
          <Answer placeholder="Puesto de trabajo en SanitHelp">{answers.role}</Answer>
        </div>
        <div className="ci-question">
          <h2>4. Correo Electrónico<em>*</em></h2>
          <Answer placeholder="Ingrese su correo">{answers.email}</Answer>
        </div>
        <div className="ci-question">
          <h2>5. Confirmación de módulos<em>*</em></h2>
          <p className="ci-hint">Es necesario leer previamente la presentación con los tres módulos</p>
          {INDUCTION_MODULES.map((module) => (
            <Check key={module.id} checked={answers[module.id]}>{module.label}</Check>
          ))}
          <Check checked={answers.terms}>Acepto los términos y condiciones.</Check>
        </div>
        <div className="ci-question">
          <h2>6. Comentarios</h2>
          <p className="ci-hint">¿Tienes alguna duda o comentario sobre la Inducción?</p>
          <Answer placeholder="Sin comentarios">{answers.comments}</Answer>
        </div>
        <div className="ci-question">
          <h2>7. Firma<em>*</em></h2>
          <p className="ci-hint">Firma digital — Dibuja tu firma con el dedo o el mouse</p>
          <div className="ci-signature">{signature && <img src={signature} alt="Firma" />}</div>
        </div>
        {submittedAt && <p className="ci-date">Enviado el {submittedAt}</p>}
      </div>
    </div>
  )
})

async function generateInductionPdf(element) {
  const { default: html2pdf } = await import('html2pdf.js')
  return html2pdf()
    .set({
      margin: [0, 0, 0, 0],
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 1.6, useCORS: true, backgroundColor: '#f0f2f8', windowWidth: 1200 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: [] },
    })
    .from(element)
    .outputPdf('blob')
}

export default function InductionForm({ initialAnswers, savedDraft, onDraftChange, onSubmitted }) {
  const printableRef = useRef(null)
  const [answers, setAnswers] = useState(() => ({ ...EMPTY_INDUCTION_ANSWERS, ...initialAnswers, ...savedDraft?.answers }))
  const [signature, setSignature] = useState(() => savedDraft?.signature || '')
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [submittedAt, setSubmittedAt] = useState('')

  function update(field, value) {
    setError('')
    const next = { ...answers, [field]: value }
    setAnswers(next)
    onDraftChange?.({ answers: next, signature })
  }

  function updateSignature(value) {
    setError('')
    setSignature(value)
    onDraftChange?.({ answers, signature: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!INDUCTION_MODULES.every((module) => answers[module.id])) {
      setError('Confirma los tres módulos de la inducción.')
      return
    }
    if (!answers.terms) {
      setError('Debes aceptar los términos y condiciones.')
      return
    }
    if (!signature) {
      setError('Dibuja tu firma para enviar la constancia.')
      return
    }

    setSending(true)
    setError('')
    const date = new Date()
    setSubmittedAt(date.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }))
    try {
      // Espera a que la fecha de envío se pinte en la versión imprimible.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const blob = await generateInductionPdf(printableRef.current)
      const submitted = { blob, answers, createdAt: date.toISOString() }
      await onSubmitted(submitted)
      setRecord(submitted)
    } catch (submitError) {
      console.error('No se pudo generar la constancia de inducción.', submitError)
      setError('No se pudo generar la constancia. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="constancia" id="constancia-induccion" aria-labelledby="constancia-title">
      <div className="ci-banner"><img src={logoSanitHelp} alt="SanitHelp" /></div>
      <form className="ci-body" onSubmit={handleSubmit}>
        <h1 className="ci-title" id="constancia-title">{INDUCTION_TITLE}</h1>

        <div className="ci-question">
          <h2>1. Nombre Completo<em>*</em></h2>
          <div className="ci-two">
            <input className="ci-input" placeholder="Nombres" aria-label="Nombres" required value={answers.firstName} onChange={(event) => update('firstName', event.target.value)} />
            <input className="ci-input" placeholder="Apellidos" aria-label="Apellidos" required value={answers.lastName} onChange={(event) => update('lastName', event.target.value)} />
          </div>
        </div>

        <div className="ci-question">
          <h2>2. Cédula<em>*</em></h2>
          <input className="ci-input" placeholder="Número de Identificación" aria-label="Cédula" inputMode="numeric" required value={answers.idNumber} onChange={(event) => update('idNumber', event.target.value)} />
        </div>

        <div className="ci-question">
          <h2>3. Cargo<em>*</em></h2>
          <input className="ci-input" placeholder="Puesto de trabajo en SanitHelp" aria-label="Cargo" required value={answers.role} onChange={(event) => update('role', event.target.value)} />
        </div>

        <div className="ci-question">
          <h2>4. Correo Electrónico<em>*</em></h2>
          <input className="ci-input" type="email" placeholder="Ingrese su correo" aria-label="Correo electrónico" required value={answers.email} onChange={(event) => update('email', event.target.value)} />
        </div>

        <div className="ci-question">
          <h2>5. Confirmación de módulos<em>*</em></h2>
          <p className="ci-hint">Es necesario leer previamente la presentación con los tres módulos</p>
          {INDUCTION_MODULES.map((module) => (
            <label className="ci-input ci-check" key={module.id}>
              <input type="checkbox" checked={answers[module.id]} onChange={(event) => update(module.id, event.target.checked)} />
              {module.label}
            </label>
          ))}
          <label className="ci-input ci-check ci-terms">
            <input type="checkbox" checked={answers.terms} onChange={(event) => update('terms', event.target.checked)} />
            Acepto los términos y condiciones.
          </label>
        </div>

        <div className="ci-question">
          <h2>6. Comentarios</h2>
          <p className="ci-hint">¿Tienes alguna duda o comentario sobre la Inducción?</p>
          <textarea className="ci-input ci-textarea" aria-label="Comentarios" value={answers.comments} onChange={(event) => update('comments', event.target.value)} />
        </div>

        <div className="ci-question">
          <h2>7. Firma<em>*</em></h2>
          <p className="ci-hint">Firma digital — Dibuja tu firma con el dedo o el mouse</p>
          <SignaturePad value={signature} onChange={updateSignature} />
        </div>

        {error && <p className="ci-error" role="alert">{error}</p>}
        {record && !error && (
          <p className="ci-success" role="status">
            <CheckCircle2 size={17} aria-hidden="true" />
            Constancia enviada. Ya puedes cerrar esta pestaña y volver a SanitHelp: quedará al principio de tu PDF en Resultados al pulsar Terminar.
          </p>
        )}

        <div className="ci-actions">
          <button type="submit" className="ci-submit" disabled={sending}>
            <Send size={16} aria-hidden="true" />
            {sending ? 'Enviando...' : record ? 'Enviar de nuevo' : 'Enviar'}
          </button>
        </div>
      </form>

      <div className="ci-print-holder" aria-hidden="true">
        <InductionPrintable ref={printableRef} answers={answers} signature={signature} submittedAt={submittedAt} />
      </div>
    </section>
  )
}
