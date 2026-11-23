// Líneas de texto de una página del PDF para editarlas con un clic en el visor. Cada línea:
// { x, y, w, h (fracciones de la página tal como se ve, desde arriba a la izquierda), fontSize (puntos), text }.
// y es el borde de arriba del renglón (línea base - 0,95 em), igual que en los cuadros del editor.

// Páginas con texto real (constancias, PDF digitales): se lee del PDF y se juntan los pedazos de cada renglón.
export async function pdfTextLines(page) {
  const viewport = page.getViewport({ scale: 1 })
  const { items } = await page.getTextContent()
  const pieces = items
    .filter((item) => item.str?.trim())
    .map((item) => {
      const [, , c, d, e, f] = item.transform
      const size = Math.hypot(c, d) || item.height
      const [x, base] = viewport.convertToViewportPoint(e, f)
      return { x, base, w: item.width, size, text: item.str }
    })
    .sort((first, second) => first.base - second.base || first.x - second.x)

  const lines = []
  for (const piece of pieces) {
    const line = lines.at(-1)
    const gap = line ? piece.x - (line.x + line.w) : Infinity
    if (line && Math.abs(piece.base - line.base) < line.size * 0.3 && gap > -line.size && gap < line.size * 0.8) {
      line.text += gap > line.size * 0.15 && !line.text.endsWith(' ') && !piece.text.startsWith(' ') ? ` ${piece.text}` : piece.text
      line.w = piece.x + piece.w - line.x
      line.size = Math.max(line.size, piece.size)
    } else {
      lines.push({ ...piece })
    }
  }
  return lines.map((line) => ({
    x: line.x / viewport.width,
    y: (line.base - 0.95 * line.size) / viewport.height,
    w: line.w / viewport.width,
    h: (1.2 * line.size) / viewport.height,
    fontSize: line.size,
    text: line.text.trim(),
  }))
}

// Páginas que son imagen (Formato HV, soportes escaneados): reconocimiento de texto (OCR) en español.
// La HV tiene letra muy pequeña: la página se amplía a unos 3.300 px de ancho y se pasa a blanco y negro
// antes de leerla (en una HV real se leyeron exactas 27 de 28 palabras de prueba, contra 9 de 20 a color
// sin ampliar). Se lee como un bloque de texto (modo 6). El lector se carga una sola vez.
let ocrWorker

// El OCR junta en un renglón lo que está a la misma altura ("Cédula        123456789"). Un espacio grande
// entre palabras separa campos distintos (etiqueta y valor): cada parte se edita por su lado.
// Los bordes de las casillas se leen como "|", "¡", "-" o ",": esas "palabras" se descartan.
const BORDER_JUNK = /^[|¡!\-–—,.;:'"`_~]+$/

function splitColumns(line) {
  const words = (line.words || []).filter((word) => word.text.trim() && !BORDER_JUNK.test(word.text.trim()))
  if (!words.length) return []
  if (words.length < 2) return [{ text: words[0].text, bbox: { ...words[0].bbox, y0: line.bbox.y0, y1: line.bbox.y1 } }]
  const height = line.bbox.y1 - line.bbox.y0
  const groups = [[words[0]]]
  for (const word of words.slice(1)) {
    const previous = groups.at(-1).at(-1)
    if (word.bbox.x0 - previous.bbox.x1 > height * 1.2) groups.push([word])
    else groups.at(-1).push(word)
  }
  return groups.map((group) => ({
    text: group.map((word) => word.text).join(' '),
    bbox: { x0: group[0].bbox.x0, x1: group.at(-1).bbox.x1, y0: line.bbox.y0, y1: line.bbox.y1 },
  }))
}

export async function ocrTextLines(page) {
  const viewport = page.getViewport({ scale: 1 })
  // Primero a unas 2x (cerca del tamaño de la imagen original de la HV) y luego ampliada con suavizado de
  // alta calidad: así la letra pequeña se lee mejor que dibujando la página directamente en grande.
  const base = page.getViewport({ scale: Math.min(3, 1200 / viewport.width) })
  const source = document.createElement('canvas')
  source.width = Math.floor(base.width)
  source.height = Math.floor(base.height)
  await page.render({ canvasContext: source.getContext('2d'), viewport: base }).promise
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(source.width * 2.75)
  canvas.height = Math.floor(source.height * 2.75)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const { data } = pixels
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
    data[index] = data[index + 1] = data[index + 2] = gray < 170 ? 0 : 255
  }
  context.putImageData(pixels, 0, 0)

  ocrWorker ||= import('tesseract.js').then(async ({ createWorker, PSM }) => {
    const worker = await createWorker('spa')
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
    return worker
  })
  const worker = await ocrWorker
  const { data } = await worker.recognize(canvas, {}, { blocks: true })
  const lines = (data.blocks || []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
  return lines
    .filter((line) => line.text.trim() && line.confidence > 40)
    .flatMap(splitColumns)
    .map(({ bbox, text }) => {
      const height = (bbox.y1 - bbox.y0) / canvas.height
      const fontSize = height * viewport.height * 0.8
      return {
        x: bbox.x0 / canvas.width,
        y: bbox.y0 / canvas.height,
        w: (bbox.x1 - bbox.x0) / canvas.width,
        h: height,
        fontSize,
        text: text.trim(),
      }
    })
}
