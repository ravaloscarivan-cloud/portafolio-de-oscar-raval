import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MOVID_LOGO_PNG } from './movidLogo.js';

export const SOPORTES_LABEL = 'HV y soportes';
// Vercel limita el cuerpo de cada solicitud a 4,5 MB: cada archivo se sube por separado
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 40;

// Soportes de la hoja de vida (deben coincidir con los del formulario).
// rule: 'file' = PDF obligatorio, 'answer' = PDF o "No aplica", 'optional' = opcional
export const SLOTS = [
  { id: 'hv', label: 'Hoja de vida personal', rule: 'file', max: 1 },
  { id: 'perfil', label: 'Perfil e información general de hoja de vida', rule: 'answer', max: 5 },
  { id: 'contrato', label: 'Copia del contrato', rule: 'answer', max: 2 },
  { id: 'estudios', label: 'Soportes de estudio', rule: 'answer', max: 8 },
  { id: 'novedades', label: 'Novedades que se presenten', rule: 'answer', max: 5 },
  { id: 'cedula', label: 'Fotocopia ampliada de la cédula de ciudadanía', rule: 'answer', max: 2 },
  { id: 'tarjeta', label: 'Tarjeta profesional y/o resolución', rule: 'optional', max: 3 },
  { id: 'policia', label: 'Consulta de antecedentes de la Policía Nacional', rule: 'answer', max: 1 },
  { id: 'ingreso', label: 'Certificado de examen médico de ingreso y psicotécnicos', rule: 'answer', max: 3 },
  { id: 'periodico', label: 'Certificado de examen médico periódico', rule: 'answer', max: 5 },
  { id: 'afiliaciones', label: 'Afiliaciones a salud, pensión y ARL', rule: 'answer', max: 3 },
];

// Tipos para servir descargas; los envíos nuevos solo aceptan PDF
const TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const clean = (value, max) =>
  typeof value === 'string'
    ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
    : '';

export function safeFileName(name) {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'archivo';
  return `${base}.${extensionOf(name)}`;
}

export function extensionOf(name) {
  return name.split('.').pop().toLowerCase();
}

export function contentTypeOf(name) {
  return TYPES[extensionOf(name)] || 'application/octet-stream';
}

export function validateSoportes(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'El envío no tiene un formato válido.' };
  }
  const record = {
    kind: 'soportes',
    committee: SOPORTES_LABEL,
    name: clean(input.name, 80),
    document: clean(input.document, 20).replace(/[^0-9A-Za-z]/g, ''),
    cargo: clean(input.cargo, 80),
    celular: clean(input.celular, 20).replace(/[^0-9+]/g, ''),
    consent: input.consent === true,
  };
  if (record.name.length < 5) return { error: 'Escribe tu nombre completo.' };
  if (record.document.length < 4 || record.document.length > 15) return { error: 'Revisa tu número de documento.' };
  if (!record.cargo) return { error: 'Escribe tu cargo.' };

  const files = Array.isArray(input.files) ? input.files : [];
  if (!files.length || files.length > MAX_FILES) return { error: `Adjunta entre 1 y ${MAX_FILES} archivos.` };
  const counts = {};
  const cleaned = [];
  for (const [index, file] of files.entries()) {
    const slot = SLOTS.find((item) => item.id === file?.slot);
    const name = clean(file?.name, 150);
    const size = Number(file?.size);
    if (!slot) return { error: 'Uno de los archivos no tiene una categoría válida.' };
    if (!name || extensionOf(name) !== 'pdf') return { error: `El archivo "${name || 'sin nombre'}" debe estar en PDF.` };
    if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
      return { error: `El archivo "${name}" supera el tamaño máximo de 4 MB.` };
    }
    counts[slot.id] = (counts[slot.id] || 0) + 1;
    if (counts[slot.id] > slot.max) return { error: `Máximo ${slot.max} archivo(s) en "${slot.label}".` };
    cleaned.push({
      index,
      slot: slot.id,
      label: slot.label,
      name,
      size,
      path: `${index + 1}-${slot.id}-${safeFileName(name)}`,
    });
  }
  // "No aplica" solo vale para soportes de tipo 'answer' sin archivos
  const notApplicable = SLOTS
    .filter((slot) => slot.rule === 'answer' && !counts[slot.id])
    .filter((slot) => Array.isArray(input.notApplicable) && input.notApplicable.includes(slot.id))
    .map((slot) => slot.id);
  const missing = SLOTS.filter((slot) =>
    (slot.rule === 'file' && !counts[slot.id])
    || (slot.rule === 'answer' && !counts[slot.id] && !notApplicable.includes(slot.id)));
  if (missing.length) {
    return { error: `Adjunta el PDF o marca "No aplica" en: ${missing.map((slot) => slot.label).join(', ')}.` };
  }
  if (!record.consent) return { error: 'Debes autorizar el tratamiento de datos para enviar.' };

  return { soportes: { ...record, files: cleaned, notApplicable } };
}

const COLOR = {
  blue: rgb(0.055, 0.384, 0.671),
  green: rgb(0.012, 0.635, 0.475),
  lime: rgb(0.576, 0.729, 0.122),
  ink: rgb(0.075, 0.141, 0.2),
  muted: rgb(0.365, 0.42, 0.47),
  line: rgb(0.78, 0.83, 0.88),
  soft: rgb(0.957, 0.973, 0.988),
};

function printable(value) {
  return String(value)
    .replace(/[–—]/g, '-')
    .replace(/\s/g, ' ')
    .replace(/[^ -ÿ•]/g, '?');
}

function fit(text, font, size, width) {
  let value = printable(text);
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > width) value = value.slice(0, -1);
  return `${value}...`;
}

const sizeLabel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// PDF índice: quién entregó y qué archivos adjuntó
export async function createSoportesIndexPdf(record) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`HV y soportes - ${record.name}`);
  pdf.setAuthor('MOVID IPS');
  pdf.setSubject('Hoja de vida y soportes');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(new Uint8Array(Buffer.from(MOVID_LOGO_PNG, 'base64')));
  const W = 595.28;
  const H = 841.89;
  const M = 50;
  const CW = W - M * 2;
  let page;
  let y;
  const text = (value, x, top, { font = regular, size = 10, color = COLOR.ink } = {}) =>
    page.drawText(printable(value), { x, y: top, size, font, color });
  const rightText = (value, top, options) => {
    const { font = regular, size = 10 } = options;
    text(value, W - M - font.widthOfTextAtSize(printable(value), size), top, options);
  };
  const footer = () => {
    page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.5, color: COLOR.line });
    text('MOVID IPS S.A.S.  •  Gestión Humana  •  Índice de hoja de vida y soportes', M, 33, { size: 7, color: COLOR.muted });
  };

  page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLOR.blue });
  const logoW = 150;
  page.drawImage(logo, { x: M, y: H - 32 - logoW * logo.height / logo.width, width: logoW, height: logoW * logo.height / logo.width });
  rightText('HOJA DE VIDA Y SOPORTES', H - 50, { font: bold, size: 15, color: COLOR.blue });
  rightText('Índice de documentos entregados', H - 66, { size: 9, color: COLOR.muted });
  rightText('MOVID IPS S.A.S.  •  Gestión Humana', H - 79, { font: bold, size: 8.5, color: COLOR.muted });
  y = H - 104;
  page.drawRectangle({ x: M, y, width: CW * 0.55, height: 3.5, color: COLOR.blue });
  page.drawRectangle({ x: M + CW * 0.55, y, width: CW * 0.25, height: 3.5, color: COLOR.green });
  page.drawRectangle({ x: M + CW * 0.8, y, width: CW * 0.2, height: 3.5, color: COLOR.lime });
  y -= 40;

  const boxField = (label, value, x, width) => {
    text(label, x, y, { font: bold, size: 9 });
    page.drawRectangle({ x, y: y - 38, width, height: 30, color: COLOR.soft, borderColor: COLOR.line, borderWidth: 0.8 });
    text(fit(value || '—', regular, 10.5, width - 20), x + 10, y - 27, { size: 10.5 });
  };
  const half = (CW - 14) / 2;
  boxField('Nombre completo', record.name, M, half);
  boxField('Número de documento', record.document, M + half + 14, half);
  y -= 62;
  boxField('Cargo', record.cargo, M, half);
  boxField('Celular', record.celular, M + half + 14, half);
  y -= 66;

  page.drawRectangle({ x: M, y: y - 3, width: 4, height: 14, color: COLOR.green });
  text(`SOPORTES  •  ${record.files.length} PDF adjunto(s)`, M + 11, y, { font: bold, size: 10.5, color: COLOR.blue });
  y -= 22;
  const cols = [{ label: 'N.º', w: 30 }, { label: 'SOPORTE', w: 235 }, { label: 'ARCHIVO / ESTADO', w: CW - 30 - 235 - 60 }, { label: 'TAMAÑO', w: 60 }];
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: CW, height: 20, color: COLOR.soft });
    let x = M;
    for (const col of cols) {
      text(col.label, x + 6, y, { font: bold, size: 7.5, color: COLOR.blue });
      x += col.w;
    }
    y -= 20;
  };
  header();
  // Una fila por archivo; los soportes sin archivo muestran "No aplica" u "Opcional"
  const rows = SLOTS.flatMap((slot, slotIndex) => {
    const number = String(slotIndex + 1).padStart(2, '0');
    const files = record.files.filter((file) => file.slot === slot.id);
    if (files.length) {
      return files.map((file, index) => ({
        cells: [index ? '' : number, index ? '' : slot.label, file.name, sizeLabel(file.size)], status: false, first: !index,
      }));
    }
    const status = (record.notApplicable || []).includes(slot.id) ? 'No aplica' : 'No adjuntado (opcional)';
    return [{ cells: [number, slot.label, status, ''], status: true, first: true }];
  });
  rows.forEach((row) => {
    if (y < 90) {
      footer();
      page = pdf.addPage([W, H]);
      page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLOR.blue });
      y = H - 50;
      header();
    }
    if (row.first) page.drawLine({ start: { x: M, y: y + 13 }, end: { x: M + CW, y: y + 13 }, thickness: 0.5, color: COLOR.line });
    let x = M;
    row.cells.forEach((cell, c) => {
      const muted = c === 3 || (c === 2 && row.status);
      text(fit(cell, c === 0 ? bold : regular, 9, cols[c].w - 12), x + 6, y, { size: 9, color: muted ? COLOR.muted : COLOR.ink, font: c === 0 ? bold : regular });
      x += cols[c].w;
    });
    y -= 20;
  });
  page.drawLine({ start: { x: M, y: y + 13 }, end: { x: M + CW, y: y + 13 }, thickness: 0.5, color: COLOR.line });
  y -= 14;
  if (y < 110) {
    footer();
    page = pdf.addPage([W, H]);
    y = H - 50;
  }
  text(`Entregado el ${record.createdAt.replace(/\.$/, '')}. La persona autorizó el tratamiento de sus datos personales (Ley 1581 de 2012).`, M, y, { size: 8.5, color: COLOR.muted });
  y -= 13;
  text('Los archivos originales se descargan por separado desde la sección Usuario.', M, y, { size: 8.5, color: COLOR.muted });
  footer();
  return Buffer.from(await pdf.save());
}
