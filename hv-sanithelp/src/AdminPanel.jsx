import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, FileText, GripVertical, LogIn, MailCheck, Paperclip, Pencil, Save, Search, Trash2, UserCog, X } from 'lucide-react'
import { AccessDeniedError, getApiConfig } from './peopleStore'
import { deleteAdminRecord, getAdminRecords, readAdminPdf, reorderAdminRecords, replaceAdminPdf, requestAdminCode, saveAdminRecord, verifyAdminCode } from './adminStore'

// Sección Administrador: ver, editar y borrar las respuestas de las personas.
// Entra quien escribe un correo de administrador (lo valida el servidor) y, si está activo el código al
// correo, el código que le llega. El acceso solo vive mientras la sección está abierta: al salir se
// vuelve a pedir.

const STATUS_OPTIONS = ['Pendiente', 'Completado']

function fullName(record) {
  return `${record.nombre || ''} ${record.apellido || ''}`.trim() || 'Sin nombre'
}

// Copia editable de una respuesta, con una fila por política aunque la respuesta no la tenga.
function toDraft(record, politicas) {
  const evaluaciones = record?.evaluaciones || []
  const constancia = record?.constanciaEvaluaciones || {}
  return {
    nombre: record?.nombre || '',
    apellido: record?.apellido || '',
    telefono: record?.telefono || '',
    correo: record?.correo || '',
    empresa: record?.empresa || '',
    procesoCompleto: record ? record.procesoCompleto : false,
    pasos: { ...(record?.pasos || {}) },
    evaluaciones: politicas.map(({ codigo, politica }) => {
      const saved = evaluaciones.find((evaluacion) => evaluacion.codigo === codigo) || {}
      return { codigo, politica, pre: saved.pre || 'Pendiente', pos: saved.pos || 'Pendiente' }
    }),
    constanciaEvaluaciones: {
      firmada: constancia.firmada === true,
      cedula: constancia.cedula || '',
      cargo: constancia.cargo || '',
      fecha: constancia.fecha ? constancia.fecha.slice(0, 10) : '',
    },
  }
}

// Estado en la lista: completo, o incompleto con las secciones que lleva y las que le faltan.
function RecordProgress({ record, steps }) {
  // Las 4 secciones hechas cuentan como completo aunque la persona no haya pulsado "Terminar".
  if (record.procesoCompleto || steps.every((step) => record.pasos?.[step.id])) return <span className="result-status complete">Completo · todas las secciones</span>
  const done = steps.filter((step) => record.pasos?.[step.id])
  const missing = steps.filter((step) => !record.pasos?.[step.id])
  return (
    <>
      <span className="result-status in-progress">Incompleto · {done.length} / {steps.length} secciones</span>
      <span className="admin-progress">
        <span><strong>Lleva:</strong> {done.length ? done.map((step) => step.label).join(', ') : 'ninguna'}</span>
        <span><strong>Falta:</strong> {missing.map((step) => step.label).join(', ')}</span>
      </span>
    </>
  )
}

// El PDF de respuesta no puede pasar de 50 MB (límite del almacenamiento).
const MAX_PDF_BYTES = 50 * 1024 * 1024
const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

function AdminEditor({ editing, politicas, steps, fileSlots, saving, onCancel, onSave, onViewPdf }) {
  const [draft, setDraft] = useState(() => toDraft(editing.record, politicas))
  const [pdfFile, setPdfFile] = useState(null)
  const [files, setFiles] = useState({})
  // Documentos del PDF actual que se quitarán al guardar.
  const [removed, setRemoved] = useState({})
  const documentos = editing.record?.documentos || []
  const [fileError, setFileError] = useState('')
  const attachedSize = Object.values(files).reduce((total, file) => total + file.size, 0)

  function attachFile(slotId, file) {
    setFileError('')
    if (!file) return
    if (!isPdf(file)) {
      setFileError(`"${file.name}" no es un PDF. Solo se pueden adjuntar archivos PDF.`)
      return
    }
    setFiles((current) => ({ ...current, [slotId]: file }))
  }
  const isNew = !editing.record
  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }))
  const setConstancia = (field, value) => setDraft((current) => ({
    ...current,
    constanciaEvaluaciones: { ...current.constanciaEvaluaciones, [field]: value },
  }))
  const setEvaluacion = (index, field, value) => setDraft((current) => ({
    ...current,
    evaluaciones: current.evaluaciones.map((evaluacion, position) => (position === index ? { ...evaluacion, [field]: value } : evaluacion)),
  }))

  function handleSubmit(event) {
    event.preventDefault()
    if (attachedSize > MAX_PDF_BYTES) {
      setFileError(`Los archivos suman ${formatSize(attachedSize)}; el PDF de respuesta no puede pasar de 50 MB.`)
      return
    }
    const { fecha } = draft.constanciaEvaluaciones
    onSave({
      ...draft,
      constanciaEvaluaciones: {
        ...draft.constanciaEvaluaciones,
        // Fecha a mediodía para que no cambie de día por la zona horaria.
        fecha: fecha ? new Date(`${fecha}T12:00:00`).toISOString() : new Date().toISOString(),
      },
    }, { pdfFile, files, removed })
  }

  // En document.body: la animación de entrada de la sección encerraría la ventana dentro de ella.
  return createPortal(
    <div className="pdf-viewer-backdrop">
      <form className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title" onSubmit={handleSubmit}>
        <header className="admin-editor-header">
          <div>
            <span>{isNew ? 'Nueva respuesta' : `Participante ${editing.record._id || 'sin número'}`}</span>
            <h2 id="admin-editor-title">{isNew ? 'Agregar respuesta' : fullName(editing.record)}</h2>
          </div>
          <button type="button" className="admin-icon-button" onClick={onCancel} aria-label="Cerrar sin guardar" title="Cerrar sin guardar">
            <X size={18} />
          </button>
        </header>

        <div className="admin-editor-body">
          <fieldset className="admin-fieldset">
            <legend>Datos de contacto</legend>
            <div className="admin-grid">
              <label>Nombre *<input value={draft.nombre} onChange={(event) => setField('nombre', event.target.value)} required maxLength={200} /></label>
              <label>Apellido<input value={draft.apellido} onChange={(event) => setField('apellido', event.target.value)} maxLength={200} /></label>
              <label>Teléfono<input type="tel" value={draft.telefono} onChange={(event) => setField('telefono', event.target.value)} maxLength={200} /></label>
              <label>Correo *<input type="email" value={draft.correo} onChange={(event) => setField('correo', event.target.value)} required maxLength={200} /></label>
              <label className="admin-grid-wide">Empresa<input value={draft.empresa} onChange={(event) => setField('empresa', event.target.value)} maxLength={200} /></label>
            </div>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Estado del proceso</legend>
            <label className="admin-check">
              <input type="checkbox" checked={draft.procesoCompleto} onChange={(event) => setField('procesoCompleto', event.target.checked)} />
              Proceso completo (todas las secciones)
            </label>
            <div className="admin-steps">
              {steps.map((step) => (
                <label key={step.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={draft.procesoCompleto || draft.pasos[step.id] === true}
                    disabled={draft.procesoCompleto}
                    onChange={(event) => setField('pasos', { ...draft.pasos, [step.id]: event.target.checked })}
                  />
                  {step.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Evaluaciones de Inducción general</legend>
            <div className="admin-table-wrap">
              <table className="admin-eval-table">
                <thead>
                  <tr><th>Política</th><th>Pre-test</th><th>Pos-test</th></tr>
                </thead>
                <tbody>
                  {draft.evaluaciones.map((evaluacion, index) => (
                    <tr key={evaluacion.codigo}>
                      <td><strong>{evaluacion.codigo}</strong> {evaluacion.politica}</td>
                      {['pre', 'pos'].map((field) => (
                        <td key={field}>
                          <select
                            value={evaluacion[field]}
                            onChange={(event) => setEvaluacion(index, field, event.target.value)}
                            aria-label={`${field === 'pre' ? 'Pre-test' : 'Pos-test'} ${evaluacion.codigo}`}
                          >
                            {STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Constancia de evaluaciones</legend>
            <label className="admin-check">
              <input type="checkbox" checked={draft.constanciaEvaluaciones.firmada} onChange={(event) => setConstancia('firmada', event.target.checked)} />
              Constancia firmada
            </label>
            {draft.constanciaEvaluaciones.firmada && (
              <div className="admin-grid">
                <label>Cédula<input value={draft.constanciaEvaluaciones.cedula} onChange={(event) => setConstancia('cedula', event.target.value)} maxLength={200} /></label>
                <label>Cargo<input value={draft.constanciaEvaluaciones.cargo} onChange={(event) => setConstancia('cargo', event.target.value)} maxLength={200} /></label>
                <label>Fecha<input type="date" value={draft.constanciaEvaluaciones.fecha} onChange={(event) => setConstancia('fecha', event.target.value)} /></label>
              </div>
            )}
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend>Archivos de la respuesta</legend>
            <p className="admin-files-note">
              {isNew
                ? 'Con estos archivos se arma el PDF de respuesta, en este orden: constancia de inducción, constancia de evaluaciones (si está firmada), Formato HV y soportes. Solo PDF.'
                : 'Estos son los documentos que tiene el PDF de respuesta. Puedes verlos, cambiarlos por otro archivo, quitarlos o adjuntar los que faltan. Al guardar, el PDF se arma de nuevo en este orden y antes se guarda una copia del actual. Solo PDF.'}
            </p>
            {!isNew && (
              <button type="button" className="admin-secondary-button" onClick={() => onViewPdf(editing.record)}>
                <Eye size={16} aria-hidden="true" /> Ver PDF completo
              </button>
            )}
            <ul className="admin-files">
              {fileSlots.map((slot) => {
                const file = files[slot.id]
                const current = documentos.find((document) => document.id === slot.id)
                const isRemoved = removed[slot.id]
                // Las hojas que arma la app y los soportes "sin separar" solo aparecen si están en el PDF.
                if ((slot.generated || slot.legacy) && !current && !(slot.id === 'evaluaciones' && isNew)) return null
                const pages = current && (current.desde === current.hasta ? `pág. ${current.desde}` : `págs. ${current.desde}–${current.hasta}`)
                const state = isRemoved ? 'removed' : file || current ? 'attached' : ''
                return (
                  <li key={slot.id} className={state}>
                    <span className="admin-file-label">
                      {file || current ? <FileText size={16} aria-hidden="true" /> : <Paperclip size={16} aria-hidden="true" />}
                      <span>
                        <strong>{slot.label}</strong>
                        {file && <small>Nuevo: {file.name} · {formatSize(file.size)}{current ? ` (reemplaza ${pages})` : ''}</small>}
                        {!file && current && !isRemoved && <small>En el PDF · {pages}{current.nombre ? ` · ${current.nombre}` : ''}</small>}
                        {!file && isRemoved && <small>Se quitará del PDF al guardar</small>}
                        {!file && !current && slot.id === 'evaluaciones' && <small>Se genera al guardar si la constancia está firmada</small>}
                      </span>
                    </span>
                    <span className="admin-file-actions">
                      {current && !file && !isRemoved && (
                        <button type="button" className="admin-secondary-button" onClick={() => onViewPdf(editing.record, current.desde)} aria-label={`Ver ${slot.label}`}>
                          Ver
                        </button>
                      )}
                      {!slot.generated && !slot.legacy && !isRemoved && !(slot.locked && current) && (
                        <label className="admin-secondary-button">
                          {file || current ? 'Cambiar' : 'Adjuntar'}
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            aria-label={`Adjuntar ${slot.label}`}
                            onChange={(event) => {
                              attachFile(slot.id, event.target.files?.[0])
                              event.target.value = ''
                            }}
                          />
                        </label>
                      )}
                      {file && (
                        <button
                          type="button"
                          className="admin-icon-button"
                          onClick={() => setFiles(({ [slot.id]: _removed, ...rest }) => rest)}
                          aria-label={`Descartar el archivo nuevo de ${slot.label}`}
                          title="Descartar archivo nuevo"
                        >
                          <X size={16} />
                        </button>
                      )}
                      {current && !file && !slot.locked && (
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => setRemoved((now) => ({ ...now, [slot.id]: !now[slot.id] }))}
                          aria-label={`${isRemoved ? 'Deshacer quitar' : 'Quitar'} ${slot.label}`}
                        >
                          {isRemoved ? 'Deshacer' : 'Quitar'}
                        </button>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            {attachedSize > 0 && <p className="admin-files-note">{Object.keys(files).length} archivo(s) adjunto(s) · {formatSize(attachedSize)}</p>}
            {!isNew && (
              <label className="admin-file">
                Reemplazar todo el PDF por otro (opcional)
                <input type="file" accept=".pdf,application/pdf" onChange={(event) => setPdfFile(event.target.files?.[0] || null)} />
              </label>
            )}
            {fileError && <span className="results-password-error" role="alert">{fileError}</span>}
          </fieldset>
        </div>

        <footer className="admin-editor-actions">
          <button type="button" className="admin-secondary-button" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="submit" className="primary-action" disabled={saving}>
            <Save size={17} aria-hidden="true" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}

export default function AdminPanel({ politicas, steps, fileSlots, buildPdf, onViewPdf }) {
  const [credential, setCredential] = useState(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [codeEmail, setCodeEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeNotice, setCodeNotice] = useState('')
  const [checking, setChecking] = useState(false)
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  // Reordenar: se mantiene presionada una respuesta 1 segundo y se arrastra. drag = { id, order: [ids] }.
  const [pressing, setPressing] = useState(null)
  const [drag, setDrag] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const listRef = useRef(null)
  const pressRef = useRef(null)
  const dragRef = useRef(null)
  dragRef.current = drag

  // Al salir de la sección (o cerrar) no deben quedar escuchas del arrastre.
  useEffect(() => () => pressRef.current?.cleanup(), [])

  function startPress(event, record, canReorder) {
    if (!canReorder || event.button !== 0 || event.target.closest('button, a, input')) return
    pressRef.current?.cleanup()
    const start = { x: event.clientY === undefined ? 0 : event.clientX, y: event.clientY }
    let dragging = false
    const timer = window.setTimeout(() => {
      dragging = true
      setPressing(null)
      setDrag({ id: record.id, order: records.map((entry) => entry.id) })
      navigator.vibrate?.(30)
    }, 1000)
    const onMove = (moveEvent) => {
      if (!dragging) {
        if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 8) cleanup()
        return
      }
      moveEvent.preventDefault()
      // Posición nueva: cuántas de las otras filas quedan por encima del puntero.
      const rows = [...listRef.current.querySelectorAll('[data-record-id]')].filter((row) => row.dataset.recordId !== record.id)
      const index = rows.filter((row) => {
        const rect = row.getBoundingClientRect()
        return rect.top + rect.height / 2 < moveEvent.clientY
      }).length
      setDrag((current) => {
        if (!current) return current
        const others = current.order.filter((id) => id !== record.id)
        const order = [...others.slice(0, index), record.id, ...others.slice(index)]
        return order.join() === current.order.join() ? current : { ...current, order }
      })
      if (moveEvent.clientY < 70) window.scrollBy(0, -12)
      else if (moveEvent.clientY > window.innerHeight - 70) window.scrollBy(0, 12)
    }
    const onUp = () => {
      const wasDragging = dragging
      cleanup()
      if (wasDragging) saveOrder()
    }
    const onKey = (keyEvent) => {
      if (keyEvent.key === 'Escape') {
        cleanup()
        setDrag(null)
      }
    }
    function cleanup() {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('admin-reordering')
      setPressing(null)
      pressRef.current = null
    }
    pressRef.current = { cleanup }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    document.body.classList.add('admin-reordering')
    setPressing(record.id)
  }

  // Al soltar: se muestra el orden nuevo de una vez y se guarda; el servidor renumera 01, 02, 03...
  async function saveOrder() {
    const current = dragRef.current
    setDrag(null)
    if (!current || current.order.join() === records.map((record) => record.id).join()) return
    const before = records
    const byId = new Map(records.map((record) => [record.id, record]))
    setRecords(current.order.map((id, index) => ({ ...byId.get(id), _id: String(index + 1).padStart(2, '0') })))
    setSavingOrder(true)
    try {
      await reorderAdminRecords(credential, current.order)
      setRecords(await getAdminRecords(credential))
      const moved = byId.get(current.id)
      const position = String(current.order.indexOf(current.id) + 1).padStart(2, '0')
      setMessage({ type: 'success', text: `Orden guardado: ${fullName(moved)} ahora es el participante ${position}.` })
    } catch (error) {
      setRecords(before)
      handleError(error)
    } finally {
      setSavingOrder(false)
    }
  }

  // Si el correo deja de ser de administrador (se quitó de la lista), se vuelve a pedir.
  function handleError(error) {
    if (error instanceof AccessDeniedError) {
      setCredential(null)
      setCodeEmail('')
      setRecords([])
      setEditing(null)
      setEmailError(error.message)
      return
    }
    setMessage({ type: 'error', text: error.message })
  }

  async function enter(nextCredential) {
    setRecords(await getAdminRecords(nextCredential))
    setCredential(nextCredential)
    setEmail('')
    setCode('')
    setCodeEmail('')
  }

  // Paso 1: el correo. Si el servidor pide código, se envía al correo y se pasa al paso 2.
  async function handleAccess(event) {
    event.preventDefault()
    setChecking(true)
    setEmailError('')
    const candidate = email.trim().toLowerCase()
    try {
      if ((await getApiConfig()).adminCodigo) {
        await requestAdminCode(candidate)
        setCodeEmail(candidate)
        setCode('')
        setCodeNotice(`Te enviamos un código a ${candidate}. Revisa también la carpeta de spam.`)
      } else {
        await enter({ email: candidate })
      }
    } catch (error) {
      setEmailError(error.message || 'No se pudieron cargar las respuestas.')
    } finally {
      setChecking(false)
    }
  }

  // Paso 2: el código que llegó al correo.
  async function handleCode(event) {
    event.preventDefault()
    setChecking(true)
    setEmailError('')
    try {
      const token = await verifyAdminCode(codeEmail, code)
      await enter({ email: codeEmail, token })
    } catch (error) {
      setEmailError(error.message || 'No se pudo verificar el código.')
    } finally {
      setChecking(false)
    }
  }

  async function handleResend() {
    setChecking(true)
    setEmailError('')
    try {
      await requestAdminCode(codeEmail)
      setCodeNotice(`Te enviamos un código nuevo a ${codeEmail}.`)
    } catch (error) {
      setEmailError(error.message)
    } finally {
      setChecking(false)
    }
  }

  // Respuesta nueva: el PDF se arma con los archivos adjuntos (y la constancia de evaluaciones).
  // Respuesta existente: el PDF se arma de nuevo con sus documentos (los cambiados, quitados o agregados)
  // y el servidor guarda antes una copia del PDF anterior. Se guarda también la lista de documentos.
  async function handleSave(respuesta, { pdfFile, files, removed }) {
    const isNew = !editing.record
    const id = editing.record?.id || crypto.randomUUID()
    const changed = Object.keys(files).length > 0 || Object.values(removed).some(Boolean)
    setSaving(true)
    try {
      if (isNew) {
        const built = await buildPdf({ respuesta, files })
        await saveAdminRecord(credential, { id, respuesta, pdfFile: built?.blob, documentos: built?.documentos, isNew })
      } else {
        let documentos
        if (pdfFile || changed) {
          // Un PDF nuevo completo no trae lista de documentos: queda como un solo bloque.
          const basePdf = pdfFile ? await pdfFile.arrayBuffer() : await readAdminPdf(credential, id)
          const baseDocuments = pdfFile ? null : editing.record.documentos
          const built = await buildPdf({ respuesta, files, removed, basePdf: basePdf || undefined, baseDocuments })
          if (built) await replaceAdminPdf(credential, id, built.blob)
          documentos = built ? built.documentos : null
        }
        await saveAdminRecord(credential, { id, respuesta, isNew, documentos })
      }
      setRecords(await getAdminRecords(credential))
      setEditing(null)
      setMessage({ type: 'success', text: isNew ? 'Respuesta agregada.' : 'Cambios guardados.' })
    } catch (error) {
      handleError(error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`¿Eliminar la respuesta de ${fullName(record)}, su PDF y sus evaluaciones? No se puede deshacer.`)) return
    try {
      await deleteAdminRecord(credential, record.id)
      setRecords((current) => current.filter((entry) => entry.id !== record.id))
      setMessage({ type: 'success', text: `Respuesta de ${fullName(record)} eliminada.` })
    } catch (error) {
      handleError(error)
    }
  }

  const viewPdf = (record, page) => onViewPdf({ id: record.id, name: fullName(record), pdfUrl: `/api/people/${encodeURIComponent(record.id)}/pdf` }, credential, page)

  if (!credential && codeEmail) {
    return (
      <section className="results-access" aria-labelledby="admin-access-title">
        <div className="results-access-icon" aria-hidden="true">
          <MailCheck size={25} />
        </div>
        <span className="results-access-kicker">Verificación</span>
        <h1 id="admin-access-title">Revisa tu correo</h1>
        <p role="status">{codeNotice}</p>
        <form onSubmit={handleCode}>
          <label htmlFor="admin-code">Código de verificación</label>
          <input
            id="admin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,12}"
            maxLength={12}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            autoFocus
          />
          {emailError && <span className="results-password-error" role="alert">{emailError}</span>}
          <button type="submit" className="primary-action" disabled={checking}>
            <LogIn size={19} aria-hidden="true" />
            {checking ? 'Verificando...' : 'Verificar y entrar'}
          </button>
          <div className="admin-code-links">
            <button type="button" className="admin-link-button" onClick={handleResend} disabled={checking}>Reenviar código</button>
            <button type="button" className="admin-link-button" onClick={() => { setCodeEmail(''); setEmailError('') }} disabled={checking}>Usar otro correo</button>
          </div>
        </form>
      </section>
    )
  }

  if (!credential) {
    return (
      <section className="results-access" aria-labelledby="admin-access-title">
        <div className="results-access-icon" aria-hidden="true">
          <UserCog size={25} />
        </div>
        <span className="results-access-kicker">Solo administrador</span>
        <h1 id="admin-access-title">Administrador</h1>
        <p>Escribe tu correo de administrador para ver, editar o borrar respuestas.</p>
        <form onSubmit={handleAccess}>
          <label htmlFor="admin-email">Correo de administrador</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {emailError && <span className="results-password-error" role="alert">{emailError}</span>}
          <button type="submit" className="primary-action" disabled={checking}>
            <LogIn size={19} aria-hidden="true" />
            {checking ? 'Verificando...' : 'Entrar como administrador'}
          </button>
        </form>
      </section>
    )
  }

  const search = query.trim().toLowerCase()
  const visible = search
    ? records.filter((record) => [record._id, fullName(record), record.correo, record.telefono, record.empresa, record.constanciaEvaluaciones?.cedula]
      .some((value) => String(value || '').toLowerCase().includes(search)))
    : records

  return (
    <section className="results-page" aria-labelledby="admin-title">
      <header className="results-heading">
        <span>ADMINISTRADOR</span>
        <h1 id="admin-title">Respuestas de las personas</h1>
        <p>Ver, editar o borrar respuestas. Los cambios se guardan en la base de respuestas.</p>
      </header>

      {message && (
        <div className={`workflow-message ${message.type}`} role="status">
          <span>{message.text}</span>
          <button type="button" className="workflow-message-close" onClick={() => setMessage(null)} aria-label="Cerrar mensaje">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="results-list">
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, número, correo, cédula..."
              aria-label="Buscar respuestas"
            />
          </label>
        </div>
        <div className="results-list-heading">
          <h2>Respuestas</h2>
          <span>{visible.length}</span>
        </div>
        {visible.length > 1 && (
          <p className="admin-reorder-hint" role="status">
            {savingOrder
              ? 'Guardando el nuevo orden...'
              : drag
                ? 'Arrastra hacia arriba o abajo y suelta donde quieras. Esc cancela.'
                : search
                  ? 'Para cambiar el orden, borra la búsqueda.'
                  : 'Para cambiar el número de una respuesta, mantenla presionada 1 segundo y arrástrala a su nuevo lugar.'}
          </p>
        )}
        <div ref={listRef}>
        {visible.length ? (drag ? drag.order.map((id) => records.find((record) => record.id === id)) : visible).map((record, index) => (
          <article
            className={`result-row admin-row ${pressing === record.id ? 'pressing' : ''} ${drag?.id === record.id ? 'dragging' : ''} ${drag ? 'reordering' : ''}`}
            key={record.id}
            data-record-id={record.id}
            onPointerDown={(event) => startPress(event, record, !search && !savingOrder && records.length > 1)}
          >
            <div className="result-person">
              {drag && <GripVertical size={18} className="admin-grip" aria-hidden="true" />}
              <span className="result-avatar" aria-hidden="true">{drag ? String(index + 1).padStart(2, '0') : record._id || '—'}</span>
              <div className="result-meta">
                <strong>{fullName(record)}</strong>
                <RecordProgress record={record} steps={steps} />
              </div>
            </div>
            <div className="result-actions">
              <button type="button" className="view-result-button" onClick={() => viewPdf(record)} aria-label={`Ver PDF de ${fullName(record)}`} title="Ver PDF">
                <Eye size={18} aria-hidden="true" />
              </button>
              <button type="button" className="view-result-button" onClick={() => { setMessage(null); setEditing({ record }) }} aria-label={`Editar respuesta de ${fullName(record)}`} title="Editar">
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button type="button" className="view-result-button delete-result-button" onClick={() => handleDelete(record)} aria-label={`Eliminar respuesta de ${fullName(record)}`} title="Eliminar">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </article>
        )) : (
          <div className="results-empty">
            <UserCog size={28} aria-hidden="true" />
            <p>{search ? 'Ninguna respuesta coincide con la búsqueda.' : 'Aún no hay respuestas.'}</p>
          </div>
        )}
        </div>
      </div>

      {editing && (
        <AdminEditor
          editing={editing}
          politicas={politicas}
          steps={steps}
          fileSlots={fileSlots}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
          onViewPdf={viewPdf}
        />
      )}
    </section>
  )
}
