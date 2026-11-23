// Aplica al PDF de respuesta los cuadros de texto que el administrador puso en el visor.
// Cada cuadro: { page (desde 1), x, y, w (fracciones 0-1 de la página tal como se ve, desde arriba a la
// izquierda), fontSize (puntos del PDF), text, bold, cover (fondo blanco que tapa lo que hay debajo) }.
// Los cuadros que reemplazan una línea del PDF (clic sobre el texto) traen tight (sin relleno, para que
// el texto nuevo quede justo donde estaba el original) y h (alto mínimo del fondo que tapa la línea).
// Las medidas de texto coinciden con el visor: Helvetica, interlineado 1,2 y relleno de 0,1 / 0,2 em.
export const EDIT_LINE_HEIGHT = 1.2
export const EDIT_PAD_Y = 0.1
export const EDIT_PAD_X = 0.2
// Línea base dentro de cada renglón de 1,2 em (métricas de Helvetica/Arial: ascenso 0,905 + medio interlineado).
const BASELINE = 0.95

// Lo que la página muestra (recorte y giro) llevado a coordenadas del PDF: origen abajo a la izquierda.
function pageGeometry(page) {
  const box = page.getCropBox()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  const turned = rotation === 90 || rotation === 270
  const width = turned ? box.height : box.width
  const height = turned ? box.width : box.height
  const toPdf = (dx, dy) => {
    if (rotation === 90) return { x: box.x + dy, y: box.y + dx }
    if (rotation === 180) return { x: box.x + box.width - dx, y: box.y + dy }
    if (rotation === 270) return { x: box.x + box.width - dy, y: box.y + box.height - dx }
    return { x: box.x + dx, y: box.y + box.height - dy }
  }
  return { width, height, rotation, toPdf }
}

// La fuente estándar solo tiene caracteres latinos (WinAnsi): lo que no exista se cambia por "?".
function printable(font, text) {
  return [...text].map((character) => {
    try {
      font.encodeText(character)
      return character
    } catch {
      return '?'
    }
  }).join('')
}

// Parte el texto en renglones que caben en maxWidth, respetando los saltos de línea escritos.
export function wrapLines(text, measure, maxWidth) {
  const lines = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (!line || measure(candidate) <= maxWidth) {
        line = candidate
        continue
      }
      lines.push(line)
      line = word
    }
    lines.push(line)
  }
  return lines
}

export async function applyPdfEdits(pdfBytes, edits) {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.load(pdfBytes)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  for (const edit of edits) {
    const font = edit.bold ? boldFont : regular
    const text = printable(font, edit.text.replace(/\r/g, ''))
    if (!text.trim() && !edit.cover) continue
    const padX = edit.tight ? 0 : EDIT_PAD_X
    const padY = edit.tight ? 0 : EDIT_PAD_Y
    const page = pdf.getPage(edit.page - 1)
    const { width, height, rotation, toPdf } = pageGeometry(page)
    const size = edit.fontSize
    const left = edit.x * width
    const top = edit.y * height
    const boxWidth = edit.w * width
    // Un texto editado en su sitio (tight) no se parte en renglones: el fondo se alarga con el texto.
    const measure = (value) => font.widthOfTextAtSize(value, size)
    const lines = edit.tight ? text.split('\n') : wrapLines(text, measure, boxWidth - 2 * padX * size)
    const coverWidth = edit.tight ? Math.max(boxWidth, ...lines.map((line) => measure(line) + 0.1 * size)) : boxWidth
    const boxHeight = Math.max((lines.length * EDIT_LINE_HEIGHT + 2 * padY) * size, (edit.h || 0) * height)
    const rotate = degrees(rotation)

    if (edit.cover) {
      page.drawRectangle({ ...toPdf(left, top + boxHeight), width: coverWidth, height: boxHeight, color: rgb(1, 1, 1), rotate })
    }
    lines.forEach((line, index) => {
      if (!line) return
      const baseline = top + (padY + index * EDIT_LINE_HEIGHT + BASELINE) * size
      page.drawText(line, { ...toPdf(left + padX * size, baseline), size, font, color: rgb(0, 0, 0), rotate })
    })
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' })
}
