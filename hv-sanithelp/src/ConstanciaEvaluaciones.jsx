import { useState } from 'react'
import { CheckCircle2, FileSignature, Lock, Send } from 'lucide-react'
import { SignaturePad } from './InductionForm'

// Constancia de que el colaborador presentó el pre-test y el pos-test de todas las políticas.
// Queda bloqueada hasta completar todos los test.
export default function ConstanciaEvaluaciones({ documentos, completados, initial = {}, sent, draft, onDraftChange, onSubmit }) {
  const locked = completados.length < documentos.length
  // Lo enviado manda; si no, lo que la persona iba llenando antes de recargar; si no, los datos de la HV.
  const [fields, setFields] = useState(() => (sent
    ? { nombre: sent.nombre, cedula: sent.cedula, cargo: sent.cargo, declara: true, firma: sent.firma }
    : draft || {
      nombre: [initial.firstName, initial.lastName].filter(Boolean).join(' '),
      cedula: initial.idNumber || '',
      cargo: initial.role || '',
      declara: false,
      firma: '',
    }))
  const [error, setError] = useState('')
  const { nombre, cedula, cargo, declara, firma } = fields

  function update(field, value) {
    const next = { ...fields, [field]: value }
    setFields(next)
    if (!sent) onDraftChange?.(next)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (locked) return
    if (!declara) {
      setError('Acepta la declaración para enviar la constancia.')
      return
    }
    if (!firma) {
      setError('Dibuja tu firma para enviar la constancia.')
      return
    }
    setError('')
    onSubmit({ nombre: nombre.trim(), cedula: cedula.trim(), cargo: cargo.trim(), firma, at: new Date().toISOString() })
  }

  return (
    <form className={`evaluacion constancia-evaluaciones ${locked ? 'locked' : ''}`} onSubmit={handleSubmit} aria-labelledby="constancia-evaluaciones-title">
      <header className="evaluacion-header">
        <span className="evaluacion-icon" aria-hidden="true">{locked ? <Lock size={22} /> : <FileSignature size={22} />}</span>
        <div>
          <span className="evaluacion-kicker">Inducción general</span>
          <h2 id="constancia-evaluaciones-title">Constancia de evaluaciones</h2>
          <p>
            {locked
              ? `Este formulario se habilita cuando completes el pre-test y el pos-test de todas las políticas (${completados.length} de ${documentos.length} completadas).`
              : 'Confirma que presentaste el pre-test y el pos-test de todas las políticas de inducción general.'}
          </p>
        </div>
      </header>

      {sent && (
        <p className="evaluation-feedback ok" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          Constancia enviada el {new Date(sent.at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}.
        </p>
      )}

      <fieldset className="constancia-evaluaciones-campos" disabled={locked}>
        <div className="constancia-evaluaciones-grid">
          <label>
            <span>Nombres y apellidos</span>
            <input value={nombre} onChange={(event) => update('nombre', event.target.value)} required />
          </label>
          <label>
            <span>Cédula</span>
            <input value={cedula} onChange={(event) => update('cedula', event.target.value)} inputMode="numeric" required />
          </label>
          <label>
            <span>Cargo</span>
            <input value={cargo} onChange={(event) => update('cargo', event.target.value)} required />
          </label>
        </div>

        <div className="constancia-evaluaciones-politicas">
          <span>Políticas evaluadas</span>
          <ul>
            {documentos.map((documento) => {
              const done = completados.includes(documento.id)
              return (
                <li key={documento.id} className={done ? 'done' : ''}>
                  {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                  <strong>{documento.code}</strong> {documento.title}
                  <em>{done ? 'Pre-test y pos-test completados' : 'Pendiente'}</em>
                </li>
              )
            })}
          </ul>
        </div>

        <label className="constancia-evaluaciones-declara">
          <input type="checkbox" checked={declara} onChange={(event) => { setError(''); update('declara', event.target.checked) }} />
          <span>
            Declaro que leí las políticas de inducción general de SANITHELP IPS SAS y que presenté el pre-test y el
            pos-test de cada una de ellas.
          </span>
        </label>

        <div className="constancia-evaluaciones-firma">
          <span>Firma</span>
          {locked
            ? <div className="signature-pad signature-locked"><span className="signature-placeholder">Firma bloqueada</span></div>
            : <SignaturePad value={firma} onChange={(value) => { setError(''); update('firma', value) }} />}
        </div>
      </fieldset>

      {error && <p className="evaluacion-error" role="alert">{error}</p>}
      <div className="evaluacion-actions">
        <button type="submit" className="primary-action" disabled={locked}>
          {locked ? <Lock size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {sent ? 'Enviar de nuevo' : 'Enviar constancia'}
        </button>
      </div>
    </form>
  )
}
