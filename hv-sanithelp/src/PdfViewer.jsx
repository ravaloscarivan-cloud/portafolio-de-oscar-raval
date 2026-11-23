import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeft, PenLine, Save, X } from 'lucide-react'
import { EDIT_LINE_HEIGHT } from './pdfEdits'
import { ocrTextLines, pdfTextLines } from './pdfTextLines'
// Build legacy de PDF.js: la moderna usa funciones de JavaScript que Safari de iPhone/iPad aún no
// tiene (Math.sumPrecise, Map.getOrInsert...) y ahí no cargaría ningún PDF.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// Visor propio con PDF.js: el visor nativo del navegador abre los enlaces del PDF
// dentro del mismo iframe, aquí cada enlace externo abre una pestaña nueva.
//
// Con size (PDF de resultados en Supabase) el PDF se pide por partes: solo se descarga lo que necesitan
// las páginas en pantalla, así la primera se ve enseguida aunque el archivo pese 16 MB. El principio y el
// final del archivo (donde está su índice) se piden a la vez desde el arranque.
// Supabase responde a Range pero no expone Content-Range al navegador, por eso el tamaño llega aparte.
const RANGE_CHUNK_SIZE = 256 * 1024

async function fetchRange(url, begin, end) {
  const response = await fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` } })
  if (!response.ok) throw new Error(`No se pudo leer el PDF (${response.status}).`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Si el servidor ignoró el rango y mandó todo el archivo, se toma solo la parte pedida.
  return response.status === 206 ? bytes : bytes.slice(begin, end)
}

async function createLoadingTask(url, size, onRangeError) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  if (!size || size <= RANGE_CHUNK_SIZE * 4) return pdfjs.getDocument({ url })

  // PDF.js pide partes alineadas a RANGE_CHUNK_SIZE: la primera y la última quedan adelantadas.
  const lastChunkBegin = Math.floor((size - 1) / RANGE_CHUNK_SIZE) * RANGE_CHUNK_SIZE
  const prefetched = new Map([
    [`0-${RANGE_CHUNK_SIZE}`, fetchRange(url, 0, RANGE_CHUNK_SIZE)],
    [`${lastChunkBegin}-${size}`, fetchRange(url, lastChunkBegin, size)],
  ])
  const transport = new pdfjs.PDFDataRangeTransport(size, null)
  // PDF.js llama a abort() al cerrar el visor: las partes que lleguen después se descartan.
  let aborted = false
  transport.abort = () => {
    aborted = true
  }
  transport.requestDataRange = (begin, end) => {
    const key = `${begin}-${end}`
    const request = prefetched.get(key) || fetchRange(url, begin, end)
    prefetched.delete(key)
    request
      .catch(() => fetchRange(url, begin, end))
      .then((chunk) => {
        if (aborted) return
        try {
          transport.onDataRange(begin, chunk)
        } catch {
          // PDF.js ya canceló esa parte (por ejemplo, una página que dejó de verse): se descarta.
        }
      }, (error) => !aborted && onRangeError(error))
  }
  return pdfjs.getDocument({ range: transport, rangeChunkSize: RANGE_CHUNK_SIZE, disableAutoFetch: true })
}

// Texto editable en el mismo lugar del PDF: sin barra ni marco. Escribe encima del original (fondo
// blanco que lo tapa) con su mismo tamaño. Esc deshace, Ctrl+B pone o quita negrita. Al salir sin
// cambios se descarta (la línea vuelve a quedar como estaba).
function PdfEditBox({ edit, scale, pageHeightPx, onChange, onRemove }) {
  const fontPx = edit.fontSize * scale
  const unchanged = edit.targetId ? edit.text === edit.original : !edit.text.trim()

  return (
    <textarea
      className={`pdf-inline-edit ${edit.bold ? 'bold' : ''}`}
      value={edit.text}
      rows={1}
      autoFocus
      spellCheck={false}
      aria-label={edit.targetId ? `Editar: ${edit.original}` : 'Texto nuevo'}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange({ text: event.target.value })}
      onBlur={() => unchanged && onRemove()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onRemove()
        } else if (event.key.toLowerCase() === 'b' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          onChange({ bold: !edit.bold })
        }
      }}
      style={{
        left: `${edit.x * 100}%`,
        top: `${edit.y * 100}%`,
        minWidth: `${edit.w * 100}%`,
        maxWidth: `${(1 - edit.x) * 100}%`,
        minHeight: `${edit.h * pageHeightPx}px`,
        fontSize: `${fontPx}px`,
        lineHeight: EDIT_LINE_HEIGHT,
      }}
    />
  )
}

function PdfPage({ pdf, pageNumber, ratio, resolveLink, onRendered, editing = false, edits = [], onAddEdit, onChangeEdit, onRemoveEdit }) {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [links, setLinks] = useState([])
  const [pageRatio, setPageRatio] = useState(ratio)
  const [rendered, setRendered] = useState(false)
  const [pageWidth, setPageWidth] = useState(0)
  const [cssWidth, setCssWidth] = useState(0)
  // Líneas de texto que se pueden editar con un clic (se detectan al entrar al modo edición).
  const [targets, setTargets] = useState(null)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    if (!editing || !rendered || targets) return undefined
    let cancelled = false
    setDetecting(true)
    pdf.getPage(pageNumber)
      .then(async (page) => {
        let lines = await pdfTextLines(page)
        if (!lines.length && !cancelled) lines = await ocrTextLines(page)
        if (!cancelled) setTargets(lines.map((line, index) => ({ ...line, id: `${pageNumber}-${index}` })))
      })
      .catch((detectError) => {
        console.error('No se pudo detectar el texto de la página.', detectError)
        if (!cancelled) setTargets([])
      })
      .finally(() => !cancelled && setDetecting(false))
    return () => {
      cancelled = true
    }
  }, [editing, rendered, targets, pdf, pageNumber])

  // Ancho en pantalla, para mostrar los cuadros de texto con la letra a escala.
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setCssWidth(entry.contentRect.width))
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: '600px 0px' },
    )
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    let cancelled = false
    let renderTask = null

    pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return
      const [x0, y0, x1, y1] = page.view
      const pageWidth = x1 - x0
      const pageHeight = y1 - y0
      // Medidas tal como se ve la página (con su giro).
      const shown = page.getViewport({ scale: 1 })
      setPageRatio(shown.height / shown.width)
      setPageWidth(shown.width)

      const annotations = await page.getAnnotations()
      if (cancelled) return
      setLinks(annotations
        .filter((annotation) => annotation.subtype === 'Link' && annotation.url)
        .map((annotation) => {
          const [ax0, ay0, ax1, ay1] = annotation.rect
          return {
            id: annotation.id,
            url: annotation.url,
            style: {
              left: `${((Math.min(ax0, ax1) - x0) / pageWidth) * 100}%`,
              top: `${((y1 - Math.max(ay0, ay1)) / pageHeight) * 100}%`,
              width: `${(Math.abs(ax1 - ax0) / pageWidth) * 100}%`,
              height: `${(Math.abs(ay1 - ay0) / pageHeight) * 100}%`,
            },
          }
        }))

      const canvas = canvasRef.current
      const scale = (wrapperRef.current.clientWidth / shown.width) * Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
      await renderTask.promise.then(() => {
        if (cancelled) return
        setRendered(true)
        onRendered?.(pageNumber)
      }, () => {})
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [visible, pdf, pageNumber, onRendered])

  return (
    <div
      ref={wrapperRef}
      className={`pdf-page ${editing ? 'editing' : ''}`}
      data-page={pageNumber}
      style={{ aspectRatio: `1 / ${pageRatio}` }}
      aria-label={`Página ${pageNumber}`}
      onClick={(event) => {
        if (!editing || !pageWidth) return
        const rect = wrapperRef.current.getBoundingClientRect()
        const sizes = (targets || []).map((target) => target.fontSize).sort((first, second) => first - second)
        const fontSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : pageWidth * 0.016
        const y = (event.clientY - rect.top) / rect.height - (0.6 * fontSize) / (pageWidth * pageRatio)
        onAddEdit(pageNumber, (event.clientX - rect.left) / rect.width, Math.max(0, y), pageWidth, null, fontSize, pageRatio)
      }}
    >
      <canvas ref={canvasRef} />
      {!rendered && <span className="pdf-page-status">Cargando página {pageNumber}...</span>}
      {editing && detecting && <span className="pdf-page-detecting">Detectando el texto de la página...</span>}
      {editing && targets?.filter((target) => !edits.some((edit) => edit.targetId === target.id)).map((target) => (
        <button
          key={target.id}
          type="button"
          className="pdf-edit-target"
          style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: `${target.w * 100}%`, height: `${target.h * 100}%` }}
          title={`Editar: ${target.text}`}
          aria-label={`Editar el texto: ${target.text}`}
          onClick={(event) => {
            event.stopPropagation()
            onAddEdit(pageNumber, target.x, target.y, pageWidth, target)
          }}
        />
      ))}
      {edits.map((edit) => (
        <PdfEditBox
          key={edit.id}
          edit={edit}
          scale={pageWidth ? cssWidth / pageWidth : 1}
          pageHeightPx={cssWidth * pageRatio}
          onChange={(patch) => onChangeEdit(edit.id, patch)}
          onRemove={() => onRemoveEdit(edit.id)}
        />
      ))}
      {!editing && links.map((link) => (
        <a
          key={link.id}
          className="pdf-page-link"
          href={resolveLink(link.url)}
          target="_blank"
          rel="noreferrer"
          style={link.style}
          title={resolveLink(link.url)}
          aria-label={`Abrir enlace en una pestaña nueva: ${resolveLink(link.url)}`}
        />
      ))}
    </div>
  )
}

// Miniatura del menú lateral. Se dibuja solo cuando se ve en el menú y ya está lista la primera página,
// para no quitarle descarga a lo que se está leyendo.
function PdfThumbnail({ pdf, pageNumber, ratio, active, enabled, rootRef, onSelect }) {
  const buttonRef = useRef(null)
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [pageRatio, setPageRatio] = useState(ratio)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { root: rootRef.current, rootMargin: '200px 0px' },
    )
    observer.observe(buttonRef.current)
    return () => observer.disconnect()
  }, [rootRef])

  useEffect(() => {
    if (active) buttonRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  useEffect(() => {
    if (!visible || !enabled) return undefined
    let cancelled = false
    let renderTask = null
    pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return
      const [x0, y0, x1, y1] = page.view
      setPageRatio((y1 - y0) / (x1 - x0))
      const canvas = canvasRef.current
      const scale = (canvas.parentElement.clientWidth / (x1 - x0)) * Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
      await renderTask.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [visible, enabled, pdf, pageNumber])

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`pdf-thumb ${active ? 'active' : ''}`}
      onClick={() => onSelect(pageNumber)}
      aria-label={`Ir a la página ${pageNumber}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="pdf-thumb-page" style={{ aspectRatio: `1 / ${pageRatio}` }}>
        <canvas ref={canvasRef} />
      </span>
      <span>{pageNumber}</span>
    </button>
  )
}

// thumbnails: menú lateral con las miniaturas de todas las páginas (visor de Resultados).
// Edición (solo desde Admin): con onSaveEdits aparece "Editar PDF" y onSaveEdits(edits) guarda.
export default function PdfViewer({
  url, size, title, className = '', resolveLink = (link) => link, thumbnails = false, initialPage = 1,
  onSaveEdits,
}) {
  const [pdf, setPdf] = useState(null)
  const [ratio, setRatio] = useState(9 / 16)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [firstPageReady, setFirstPageReady] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(() => window.matchMedia('(min-width: 720px)').matches)
  const readerRef = useRef(null)
  const thumbnailsRef = useRef(null)
  const [editState, setEditState] = useState('off')
  const [edits, setEdits] = useState([])
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  // Con target (clic sobre una línea del PDF) el cuadro la reemplaza en su mismo lugar y tamaño; sin target
  // (clic en un espacio vacío) es un cuadro nuevo para agregar texto.
  const addEdit = useCallback((page, x, y, pageWidth, target, fontSize, pageRatio) => {
    if (target) {
      const left = Math.max(0, target.x - 0.002)
      setEdits((current) => [...current, {
        id: crypto.randomUUID(), page, targetId: target.id, original: target.text, text: target.text,
        x: left, y: target.y, w: Math.min(target.w + 0.006, 1 - left), h: target.h, fontSize: target.fontSize, cover: true, tight: true,
      }])
      return
    }
    setEdits((current) => [...current, {
      id: crypto.randomUUID(), page, text: '', x: Math.min(x, 0.98), y: Math.min(y, 0.98), w: 0.01,
      h: (1.2 * fontSize) / (pageWidth * pageRatio), fontSize, cover: true, tight: true,
    }])
  }, [])
  // Solo cuenta lo que cambió: una línea abierta sin cambios o un texto nuevo vacío no se guarda.
  const changedEdits = edits.filter((edit) => (edit.targetId ? edit.text !== edit.original : edit.text.trim()))
  const changeEdit = useCallback((id, patch) => setEdits((current) => current.map((edit) => (edit.id === id ? { ...edit, ...patch } : edit))), [])
  const removeEdit = useCallback((id) => setEdits((current) => current.filter((edit) => edit.id !== id)), [])

  function startEditing() {
    setEditError('')
    setEditState('on')
  }

  function stopEditing() {
    if (changedEdits.length && !window.confirm('¿Descartar los cambios sin guardar?')) return
    setEdits([])
    setEditError('')
    setEditState('off')
  }

  async function handleSaveEdits() {
    const useful = changedEdits
    if (!useful.length) {
      setEditError('No hay cambios. Haz clic sobre un texto del PDF para editarlo.')
      return
    }
    setEditBusy(true)
    setEditError('')
    try {
      await onSaveEdits(useful)
      setEdits([])
      setEditState('off')
    } catch (saveError) {
      setEditError(saveError.message || 'No se pudieron guardar los cambios.')
    } finally {
      setEditBusy(false)
    }
  }

  const handlePageRendered = useCallback((pageNumber) => {
    if (pageNumber === 1 || pageNumber === initialPage) setFirstPageReady(true)
  }, [initialPage])

  // Abierto en una página (por ejemplo, "Ver" un documento desde Administrador).
  useEffect(() => {
    if (!pdf || initialPage <= 1) return
    const frame = requestAnimationFrame(() => goToPage(Math.min(initialPage, pdf.numPages)))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, initialPage])

  // Página actual: la última cuyo borde superior ya pasó el primer tercio del visor.
  function handleScroll() {
    const reader = readerRef.current
    const limit = reader.scrollTop + reader.clientHeight / 3
    let page = 1
    for (const element of reader.querySelectorAll('.pdf-page')) {
      if (element.offsetTop > limit) break
      page = Number(element.dataset.page)
    }
    setCurrentPage(page)
  }

  function goToPage(pageNumber) {
    const element = readerRef.current?.querySelector(`[data-page="${pageNumber}"]`)
    if (!element) return
    readerRef.current.scrollTo({ top: element.offsetTop - 14 })
    setCurrentPage(pageNumber)
  }

  useEffect(() => {
    let cancelled = false
    let loadingTask = null
    const failRange = (rangeError) => {
      if (cancelled) return
      console.error('No se pudo cargar una parte del PDF.', rangeError)
      setError('No se pudo cargar el PDF.')
      loadingTask?.destroy()
    }
    createLoadingTask(url, size, failRange)
      .then((task) => {
        loadingTask = task
        if (cancelled) task.destroy()
        return task.promise
      })
      .then(async (doc) => {
        const shown = (await doc.getPage(1)).getViewport({ scale: 1 })
        if (cancelled) return
        setRatio(shown.height / shown.width)
        setPdf(doc)
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error('No se pudo cargar el PDF.', loadError)
        setError('No se pudo cargar el PDF.')
      })

    return () => {
      cancelled = true
      loadingTask?.destroy()
    }
  }, [url, size])

  const pages = pdf && Array.from({ length: pdf.numPages }, (_, index) => (
    <PdfPage
      key={index + 1}
      pdf={pdf}
      pageNumber={index + 1}
      ratio={ratio}
      resolveLink={resolveLink}
      onRendered={handlePageRendered}
      editing={editState === 'on'}
      edits={edits.filter((edit) => edit.page === index + 1)}
      onAddEdit={addEdit}
      onChangeEdit={changeEdit}
      onRemoveEdit={removeEdit}
    />
  ))
  const status = (
    <>
      {error && <p className="pdf-reader-status">{error}</p>}
      {!pdf && !error && <p className="pdf-reader-status">Cargando PDF...</p>}
    </>
  )

  if (!thumbnails) {
    return (
      <div className={`pdf-reader ${className}`} role="document" aria-label={title}>
        {status}
        {pages}
      </div>
    )
  }

  return (
    <div className={`pdf-reader-layout ${className}`}>
      <div className="pdf-reader-toolbar">
        <button
          type="button"
          onClick={() => setShowThumbnails((shown) => !shown)}
          aria-pressed={showThumbnails}
          aria-label={showThumbnails ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
          title={showThumbnails ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
        >
          <PanelLeft size={18} aria-hidden="true" />
        </button>
        {pdf && <span>Página {currentPage} de {pdf.numPages}</span>}
        {pdf && onSaveEdits && editState === 'off' && (
          <button type="button" className="pdf-edit-start" onClick={startEditing}>
            <PenLine size={16} aria-hidden="true" /> Editar PDF
          </button>
        )}
      </div>
      {editState === 'on' && (
        <div className="pdf-edit-bar">
          <span className="pdf-edit-hint">
            Haz clic sobre cualquier texto o casilla del PDF y escribe ahí mismo. Esc deshace, Ctrl+B negrita.
          </span>
          <button type="button" className="pdf-edit-action" onClick={handleSaveEdits} disabled={editBusy || !changedEdits.length}>
            <Save size={15} aria-hidden="true" /> {editBusy ? 'Guardando...' : `Guardar cambios${changedEdits.length ? ` (${changedEdits.length})` : ''}`}
          </button>
          <button type="button" className="pdf-edit-action" onClick={stopEditing} disabled={editBusy}>
            <X size={15} aria-hidden="true" /> Cancelar
          </button>
          {editError && <span className="pdf-edit-error" role="alert">{editError}</span>}
        </div>
      )}
      <div className="pdf-reader-body">
        {pdf && showThumbnails && (
          <nav ref={thumbnailsRef} className="pdf-thumbs" aria-label="Páginas del PDF">
            {Array.from({ length: pdf.numPages }, (_, index) => (
              <PdfThumbnail
                key={index + 1}
                pdf={pdf}
                pageNumber={index + 1}
                ratio={ratio}
                active={currentPage === index + 1}
                enabled={firstPageReady}
                rootRef={thumbnailsRef}
                onSelect={goToPage}
              />
            ))}
          </nav>
        )}
        <div ref={readerRef} className="pdf-reader" role="document" aria-label={title} onScroll={handleScroll}>
          {status}
          {pages}
        </div>
      </div>
    </div>
  )
}
