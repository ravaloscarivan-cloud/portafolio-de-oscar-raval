import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { MOVID_LOGO_PNG } from './movidLogo.js';

export const COMMITTEES = new Set([
  'COPASST',
  'Comité de Convivencia Laboral',
]);

export function submissionPdfFilename(record) {
  const name = record.name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'postulante';
  const prefix = { 'hoja-vida': 'Hoja-de-vida-', soportes: 'HV-y-soportes-' }[record.kind] || '';
  return `${prefix}${name}-${record.id}.pdf`;
}

const cleanText = (value) =>
  typeof value === 'string'
    ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim()
    : '';

export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'La postulación no tiene un formato válido.' };
  }

  const submission = {
    committee: cleanText(input.committee),
    name: cleanText(input.name),
    document: typeof input.document === 'string'
      ? input.document.replace(/\D/g, '')
      : '',
    position: cleanText(input.position),
    area: cleanText(input.area),
    motivation: cleanText(input.motivation),
    consent: input.consent === true,
  };

  if (!COMMITTEES.has(submission.committee)) {
    return { error: 'Selecciona un comité válido.' };
  }
  if (submission.name.length < 5 || submission.name.length > 80) {
    return { error: 'Escribe tu nombre completo (máximo 80 caracteres).' };
  }
  if (submission.document.length < 5 || submission.document.length > 12) {
    return { error: 'Revisa tu número de documento.' };
  }
  if (!submission.position || submission.position.length > 60) {
    return { error: 'Escribe un cargo válido (máximo 60 caracteres).' };
  }
  if (!submission.motivation) {
    return { error: 'Cuéntanos por qué quieres representar a tus compañeros.' };
  }
  if (submission.area.length > 60 || submission.motivation.length > 240) {
    return { error: 'Uno de los campos supera la longitud permitida.' };
  }
  if (!submission.consent) {
    return { error: 'Debes aceptar la declaración y el tratamiento de datos.' };
  }

  return { submission };
}

function printableText(value) {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s/g, ' ')
    .replace(/[^\u0020-\u00ff\u2022]/g, '?');
}

function wrapText(text, font, size, maxWidth) {
  const words = printableText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const fragments = [];
    let fragment = '';
    for (const character of word) {
      const candidate = fragment + character;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && fragment) {
        fragments.push(fragment);
        fragment = character;
      } else {
        fragment = candidate;
      }
    }
    if (fragment) fragments.push(fragment);

    for (const part of fragments) {
      const candidate = line ? `${line} ${part}` : part;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = part;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
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

// Mismo texto de la declaración que acepta la persona en el formulario
const DECLARATION = 'Declaro que soy trabajador de MOVID IPS, que acepto la postulación y que, si me postulo al Comité de Convivencia, no he formulado una queja de acoso laboral ni he sido víctima de acoso laboral en el año anterior (Resolución 3461 de 2025). Autorizo el tratamiento de mis datos para el proceso electoral, incluido su almacenamiento privado en Supabase, proveedor de nube (Ley 1581 de 2012).';

export async function createSubmissionPdf(record) {
  const document = await PDFDocument.create();
  document.setTitle(record.name);
  document.setAuthor('MOVID IPS');
  document.setSubject('Postulación a elecciones SST');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(new Uint8Array(Buffer.from(MOVID_LOGO_PNG, 'base64')));
  const W = 595.28;
  const H = 841.89;
  const M = 50;
  const CW = W - M * 2;
  const GAP = 14;
  const page = document.addPage([W, H]);

  const text = (value, x, top, { font = regular, size = 10, color = COLOR.ink } = {}) =>
    page.drawText(printableText(value), { x, y: top, size, font, color });
  const rightText = (value, top, options) => {
    const { font = regular, size = 10 } = options;
    text(value, W - M - font.widthOfTextAtSize(printableText(value), size), top, options);
  };

  // Campo como en el formulario: etiqueta arriba y valor dentro de un recuadro
  const field = (label, value, x, top, width, minHeight = 30) => {
    text(label, x, top, { font: bold, size: 9 });
    const lines = wrapText(value || '', regular, 10.5, width - 20);
    const boxH = Math.max(minHeight, lines.length * 14 + 16);
    const boxTop = top - 8;
    page.drawRectangle({
      x, y: boxTop - boxH, width, height: boxH, color: COLOR.soft, borderColor: COLOR.line, borderWidth: 0.8,
    });
    lines.forEach((line, index) => text(line, x + 10, boxTop - 19 - index * 14, { size: 10.5 }));
    return boxTop - boxH;
  };

  // Encabezado con el logo de MOVID
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: COLOR.blue });
  const logoW = 150;
  const logoH = logoW * logo.height / logo.width;
  page.drawImage(logo, { x: M, y: H - 32 - logoH, width: logoW, height: logoH });
  rightText('POSTULACIÓN', H - 50, { font: bold, size: 15, color: COLOR.blue });
  rightText('Elecciones COPASST y Comité de Convivencia Laboral', H - 66, { size: 9, color: COLOR.muted });
  rightText('MOVID IPS S.A.S.  •  SG-SST', H - 79, { font: bold, size: 8.5, color: COLOR.muted });
  let y = H - 104;
  page.drawRectangle({ x: M, y, width: CW * 0.55, height: 3.5, color: COLOR.blue });
  page.drawRectangle({ x: M + CW * 0.55, y, width: CW * 0.25, height: 3.5, color: COLOR.green });
  page.drawRectangle({ x: M + CW * 0.8, y, width: CW * 0.2, height: 3.5, color: COLOR.lime });
  y -= 40;

  // Comité y nombre completo
  const half = (CW - GAP) / 2;
  y = Math.min(
    field('Comité', record.committee, M, y, half),
    field('Nombre completo', record.name, M + half + GAP, y, half),
  ) - 24;

  // Documento, cargo y área
  const third = (CW - GAP * 2) / 3;
  y = Math.min(
    field('Número de documento', record.document, M, y, third),
    field('Cargo', record.position, M + third + GAP, y, third),
    field('Área', record.area, M + (third + GAP) * 2, y, third),
  ) - 24;

  // Motivación
  y = field('¿Por qué quieres representar a tus compañeros?', record.motivation, M, y, CW, 70) - 26;

  // Declaración aceptada (casilla marcada)
  const box = 12;
  page.drawRectangle({ x: M, y: y - box + 9, width: box, height: box, color: COLOR.green });
  page.drawLine({ start: { x: M + 2.6, y: y + 2.5 }, end: { x: M + 5.2, y: y - 0.5 }, thickness: 1.6, color: rgb(1, 1, 1) });
  page.drawLine({ start: { x: M + 5.2, y: y - 0.5 }, end: { x: M + 9.6, y: y + 5.8 }, thickness: 1.6, color: rgb(1, 1, 1) });
  wrapText(DECLARATION, regular, 9.5, CW - 22).forEach((line, index) =>
    text(line, M + 22, y - index * 13.5, { size: 9.5 }));

  // Pie de página
  page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.5, color: COLOR.line });
  text('MOVID IPS S.A.S.  •  Sistema de Gestión de Seguridad y Salud en el Trabajo', M, 33, { size: 7, color: COLOR.muted });

  return Buffer.from(await document.save());
}
