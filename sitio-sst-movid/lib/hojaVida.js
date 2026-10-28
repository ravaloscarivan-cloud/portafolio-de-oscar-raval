import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const HOJA_VIDA_LABEL = 'Hoja de vida · GH-FT-04';
export const HOJA_VIDA_MAX_BYTES = 450 * 1024;

const DECLARATION = [
  'Declaro que la información y los documentos que entrego son verídicos, autorizo a MOVID IPS S.A.S para verificarlos y me comprometo a informar a Gestión Humana cualquier cambio. Entiendo que entregar documentos falsos o información que no corresponda a la verdad es falta grave (RIT Art. 83 #28).',
  'De acuerdo con la Ley 1581 de 2012, autorizo a MOVID IPS S.A.S para recolectar, almacenar y usar mis datos personales y los de mis beneficiarios con el único fin de gestionar la relación laboral: nómina, seguridad social, bienestar y atención de emergencias. Los datos de salud son sensibles y entregarlos es opcional.',
];

const clean = (value, max) =>
  typeof value === 'string'
    ? value.normalize('NFC').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max)
    : '';

const asArray = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

function cleanItems(items) {
  return asArray(items, 40)
    .map((item) => ({ l: clean(item?.l, 120), v: clean(item?.v, 1500), full: item?.full === true }))
    .filter((item) => item.l && item.v);
}

function cleanBlock(block) {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'fields') {
    const items = cleanItems(block.items);
    return items.length ? { type: 'fields', items } : null;
  }
  if (block.type === 'table') {
    const cols = asArray(block.cols, 8).map((col) => clean(col, 80));
    if (!cols.length || cols.some((col) => !col)) return null;
    const rows = asArray(block.rows, 12)
      .map((row) => cols.map((_, index) => clean(Array.isArray(row) ? row[index] : '', 200)))
      .filter((row) => row.some(Boolean));
    return rows.length ? { type: 'table', cols, rows } : null;
  }
  if (block.type === 'entries') {
    const entries = asArray(block.entries, 4)
      .map((entry) => ({ heading: clean(entry?.heading, 150), items: cleanItems(entry?.items) }))
      .filter((entry) => entry.heading || entry.items.length);
    return entries.length ? { type: 'entries', entries } : null;
  }
  if (block.type === 'list') {
    const items = asArray(block.items, 20).map((item) => clean(item, 150)).filter(Boolean);
    return items.length ? { type: 'list', items } : null;
  }
  return null;
}

export function validateHojaVida(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'La hoja de vida no tiene un formato válido.' };
  }
  const header = input.header && typeof input.header === 'object' ? input.header : {};
  const nombres = clean(header.nombres, 60);
  const apellidos = clean(header.apellidos, 60);
  const record = {
    kind: 'hoja-vida',
    committee: HOJA_VIDA_LABEL,
    name: `${nombres} ${apellidos}`.trim(),
    nombres,
    apellidos,
    docType: clean(header.docType, 10),
    document: clean(header.document, 20).replace(/[^0-9A-Za-z]/g, ''),
    cargo: clean(header.cargo, 80),
    celular: clean(header.celular, 20).replace(/[^0-9+]/g, ''),
    email: clean(header.email, 120),
    ciudad: clean(header.ciudad, 60),
    consent: input.consent === true,
    sections: asArray(input.sections, 15)
      .map((section) => ({
        title: clean(section?.title, 100),
        blocks: asArray(section?.blocks, 6).map(cleanBlock).filter(Boolean),
      }))
      .filter((section) => section.title),
  };
  const photo = typeof input.photo === 'string' ? input.photo : '';
  const signature = typeof input.signature === 'string' ? input.signature : '';

  if (!nombres || !apellidos || record.name.length < 5) return { error: 'Escribe tus nombres y apellidos.' };
  if (record.document.length < 4 || record.document.length > 15) return { error: 'Revisa tu número de documento.' };
  if (!record.cargo) return { error: 'Escribe tu cargo actual.' };
  if (record.celular.replace(/\D/g, '').length < 7) return { error: 'Revisa tu número de celular.' };
  if (photo && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo) || photo.length > 350 * 1024)) {
    return { error: 'La foto no es válida. Vuelve a subirla.' };
  }
  if (!signature) return { error: 'Firma la hoja de vida antes de enviarla.' };
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(signature) || signature.length > 200 * 1024) {
    return { error: 'La firma no es válida. Vuelve a firmar.' };
  }
  if (!record.consent) return { error: 'Debes aceptar la declaración y la autorización de tratamiento de datos.' };

  return { hojaVida: record, photo, signature };
}

function printable(value) {
  return String(value)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[   ]/g, ' ')
    .replace(/[^ -ÿ•]/g, '?');
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of printable(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      // Corta palabras más anchas que la columna
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1;
        if (line) { lines.push(line); line = ''; }
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      const candidate = line ? `${line} ${rest}` : rest;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else { lines.push(line); line = rest; }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

const COLOR = {
  blue: rgb(0.055, 0.384, 0.671),
  green: rgb(0.012, 0.635, 0.475),
  lime: rgb(0.576, 0.729, 0.122),
  ink: rgb(0.075, 0.141, 0.2),
  muted: rgb(0.365, 0.42, 0.47),
  line: rgb(0.835, 0.878, 0.918),
  soft: rgb(0.89, 0.937, 0.976),
  white: rgb(1, 1, 1),
};

// Escalas que se prueban, de mayor a menor, hasta que la hoja de vida quepa en 2 páginas
const SCALES = [1, 0.93, 0.86, 0.8, 0.74, 0.68];
const MAX_PAGES = 2;

async function embedImage(pdf, dataUrl, kind) {
  if (!dataUrl) return null;
  try {
    // Copia a un Uint8Array propio: Buffer.from puede devolver una vista de un bloque compartido
    const bytes = new Uint8Array(Buffer.from(dataUrl.split(',')[1], 'base64'));
    return kind === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch (error) {
    console.error(`No se pudo incrustar la imagen (${kind}) de la hoja de vida.`, error);
    return null;
  }
}

async function renderHojaVida(record, photo, signature, k) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Hoja de vida - ${record.name}`);
  pdf.setAuthor('MOVID IPS');
  pdf.setSubject('GH-FT-04 Hoja de vida del trabajador');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const photoImage = await embedImage(pdf, photo, 'jpg');
  const signatureImage = await embedImage(pdf, signature, 'png');
  const W = 595.28;
  const H = 841.89;
  const M = 34;
  const CW = W - M * 2;
  const BOTTOM = 46;
  let page;
  let y;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: COLOR.blue });
    y = H - 30;
  };
  const ensure = (height) => {
    if (y - height >= BOTTOM) return false;
    newPage();
    return true;
  };
  const text = (value, x, top, { font = regular, size = 9 * k, color = COLOR.ink } = {}) =>
    page.drawText(printable(value), { x, y: top, size, font, color });

  // Encabezado: banda de color con nombre, cargo, contacto y foto
  page = pdf.addPage([W, H]);
  const bandH = 112;
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: COLOR.blue });
  page.drawRectangle({ x: 0, y: H - bandH - 4, width: W * 0.62, height: 4, color: COLOR.green });
  page.drawRectangle({ x: W * 0.62, y: H - bandH - 4, width: W * 0.38, height: 4, color: COLOR.lime });
  let textWidth = CW;
  if (photoImage) {
    const photoW = 72;
    const photoH = 96;
    const px = W - M - photoW;
    const py = H - 8 - photoH;
    page.drawRectangle({ x: px - 3, y: py - 3, width: photoW + 6, height: photoH + 6, color: COLOR.white });
    page.drawImage(photoImage, { x: px, y: py, width: photoW, height: photoH });
    textWidth = CW - photoW - 22;
  }
  text('MOVID IPS S.A.S.  •  GESTIÓN HUMANA  •  HOJA DE VIDA', M, H - 26, { font: bold, size: 7.5, color: COLOR.white });
  let nameSize = 21;
  while (nameSize > 14 && bold.widthOfTextAtSize(printable(record.name.toUpperCase()), nameSize) > textWidth) nameSize -= 1;
  let hy = H - 50;
  for (const line of wrap(record.name.toUpperCase(), bold, nameSize, textWidth).slice(0, 2)) {
    text(line, M, hy, { font: bold, size: nameSize, color: COLOR.white });
    hy -= nameSize + 2;
  }
  text(record.cargo, M, hy - 3, { font: bold, size: 11, color: COLOR.white });
  hy -= 20;
  const contact = [`${record.docType || 'Doc.'} ${record.document}`, `Cel. ${record.celular}`, record.email, record.ciudad]
    .filter(Boolean).join('   •   ');
  for (const line of wrap(contact, regular, 8.5, textWidth).slice(0, 2)) {
    text(line, M, hy, { size: 8.5, color: COLOR.white });
    hy -= 11;
  }
  y = H - bandH - 24;

  const sectionTitle = (title, keep = 50) => {
    ensure(keep * k);
    y -= 3 * k;
    page.drawRectangle({ x: M, y: y - 2.5 * k, width: 3.5, height: 12 * k, color: COLOR.green });
    text(title.toUpperCase(), M + 9, y, { font: bold, size: 9.8 * k, color: COLOR.blue });
    y -= 6.5 * k;
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.6, color: COLOR.line });
    y -= 11.5 * k;
  };

  const fieldsBlock = (items, columns = 4) => {
    const gap = 12;
    const colW = (CW - gap * (columns - 1)) / columns;
    const valueSize = 8.8 * k;
    const lineH = 10.6 * k;
    let row = [];
    const flush = () => {
      if (!row.length) return;
      const cells = row.map((item) => {
        const width = item.full ? CW : colW;
        return { item, width, labels: wrap(item.l.toUpperCase(), bold, 6.2 * k, width), lines: wrap(item.v, regular, valueSize, width) };
      });
      const labelH = Math.max(...cells.map((cell) => cell.labels.length)) * 7.4 * k;
      const height = labelH + 1.6 * k + Math.max(...cells.map((cell) => cell.lines.length)) * lineH + 4.5 * k;
      ensure(height);
      let x = M;
      for (const cell of cells) {
        cell.labels.forEach((label, index) => text(label, x, y - index * 7.4 * k, { font: bold, size: 6.2 * k, color: COLOR.muted }));
        let ly = y - labelH - 2.6 * k;
        for (const line of cell.lines) {
          text(line, x, ly, { size: valueSize });
          ly -= lineH;
        }
        x += cell.width + gap;
      }
      y -= height;
      row = [];
    };
    for (const item of items) {
      if (item.full) { flush(); row = [item]; flush(); continue; }
      row.push(item);
      if (row.length === columns) flush();
    }
    flush();
  };

  const tableBlock = ({ cols, rows }) => {
    const widths = cols.map(() => CW / cols.length);
    const pad = 3.5 * k;
    const drawRow = (cells, header) => {
      const size = header ? 6.3 * k : 8.2 * k;
      const lineH = header ? 8 * k : 9.8 * k;
      const lines = cells.map((cell, index) => wrap(cell || '—', header ? bold : regular, size, widths[index] - pad * 2));
      const height = Math.max(...lines.map((cellLines) => cellLines.length)) * lineH + pad * 2;
      if (ensure(height + (header ? 16 * k : 0)) && !header) drawRow(cols.map((col) => col.toUpperCase()), true);
      if (header) page.drawRectangle({ x: M, y: y - height, width: CW, height, color: COLOR.soft });
      let x = M;
      lines.forEach((cellLines, index) => {
        let ly = y - pad - size * 0.85;
        for (const line of cellLines) {
          text(line, x + pad, ly, header
            ? { font: bold, size, color: COLOR.blue }
            : { size, color: cells[index] ? COLOR.ink : COLOR.muted });
          ly -= lineH;
        }
        x += widths[index];
      });
      y -= height;
      page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.5, color: COLOR.line });
    };
    drawRow(cols.map((col) => col.toUpperCase()), true);
    rows.forEach((row) => drawRow(row, false));
    y -= 7 * k;
  };

  const listBlock = (items) => {
    const columns = 3;
    const gap = 12;
    const colW = (CW - gap * (columns - 1)) / columns;
    const lineH = 10 * k;
    for (let index = 0; index < items.length; index += columns) {
      const group = items.slice(index, index + columns).map((item) => wrap(`•  ${item}`, regular, 8.2 * k, colW));
      const height = Math.max(...group.map((lines) => lines.length)) * lineH + 2 * k;
      ensure(height);
      group.forEach((lines, column) => lines.forEach((line, lineIndex) =>
        text(line, M + column * (colW + gap), y - lineIndex * lineH, { size: 8.2 * k })));
      y -= height;
    }
    y -= 4 * k;
  };

  for (const section of record.sections) {
    if (!section.blocks.length) continue;
    sectionTitle(section.title);
    for (const block of section.blocks) {
      if (block.type === 'fields') fieldsBlock(block.items);
      else if (block.type === 'table') tableBlock(block);
      else if (block.type === 'list') listBlock(block.items);
      else if (block.type === 'entries') {
        block.entries.forEach((entry, index) => {
          if (index) y -= 5 * k;
          ensure(34 * k);
          if (entry.heading) {
            text(entry.heading, M, y, { font: bold, size: 9.3 * k });
            y -= 12.5 * k;
          }
          fieldsBlock(entry.items);
          y -= 2 * k;
        });
      }
    }
    y -= 2 * k;
  }

  // Declaración, firma y espacio para Gestión Humana: se mantienen juntos
  const declSize = 7.2 * k;
  const declLines = DECLARATION.map((paragraph) => wrap(paragraph, regular, declSize, CW));
  const signH = 64 * k;
  const boxH = 50 * k;
  const blockH = 30 * k + declLines.flat().length * 9 * k + 18 * k + signH + boxH + 14 * k;
  sectionTitle('Declaración y autorización de tratamiento de datos', blockH);
  for (const lines of declLines) {
    for (const line of lines) {
      text(line, M, y, { size: declSize, color: COLOR.muted });
      y -= 9 * k;
    }
    y -= 3 * k;
  }
  text(`Aceptada por el trabajador el ${record.createdAt.replace(/\.$/, '')}.`, M, y, { font: bold, size: 7.6 * k });
  y -= 10 * k;

  // Espacio para Gestión Humana y, de último, la firma del trabajador
  page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, borderColor: COLOR.line, borderWidth: 1 });
  const gs = 7.2 * k;
  text('ESPACIO PARA GESTIÓN HUMANA', M + 8, y - 11 * k, { font: bold, size: gs, color: COLOR.blue });
  text('Recibido por: ____________________________   Fecha: ___/___/______   Soportes revisados: [  ] Sí  [  ] No   Actualizado en: [  ] Carpeta  [  ] Nómina', M + 8, y - 24 * k, { size: gs });
  text('Próxima actualización: ___/___/______    Observaciones: _____________________________________________________________________', M + 8, y - 38 * k, { size: gs });
  y -= boxH + 12 * k;

  const sigW = 210;
  const lineY = y - signH + 22 * k;
  if (signatureImage) {
    const maxH = signH - 26 * k;
    const ratio = Math.min(sigW / signatureImage.width, maxH / signatureImage.height);
    const w = signatureImage.width * ratio;
    const h = signatureImage.height * ratio;
    page.drawImage(signatureImage, { x: M + (sigW - w) / 2, y: lineY + 2, width: w, height: h });
  }
  page.drawLine({ start: { x: M, y: lineY }, end: { x: M + sigW, y: lineY }, thickness: 0.8, color: COLOR.ink });
  text('Firma del trabajador', M, lineY - 9 * k, { font: bold, size: 7.4 * k });
  text(`${record.name} - ${record.docType || 'Doc.'} ${record.document}`, M, lineY - 18 * k, { size: 7.2 * k, color: COLOR.muted });
  const fx = M + sigW + 30;
  text(record.createdAt, fx, lineY + 4, { size: 8 * k });
  page.drawLine({ start: { x: fx, y: lineY }, end: { x: fx + 150, y: lineY }, thickness: 0.8, color: COLOR.ink });
  text('Fecha de envío', fx, lineY - 9 * k, { font: bold, size: 7.4 * k });
  const hW = 52 * k;
  const hH = signH - 12 * k;
  page.drawRectangle({ x: M + CW - hW, y: lineY - 14 * k, width: hW, height: hH, borderColor: COLOR.line, borderWidth: 1 });
  text('Huella', M + CW - hW + 4, lineY - 10 * k, { size: 6.2 * k, color: COLOR.muted });
  y -= signH;

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: M, y: 30 }, end: { x: W - M, y: 30 }, thickness: 0.5, color: COLOR.line });
    current.drawText(printable(`MOVID IPS S.A.S.  •  GH-FT-04 Hoja de vida del trabajador  •  Versión 01  •  Radicado ${record.id}`), {
      x: M, y: 19, size: 6.5, font: regular, color: COLOR.muted,
    });
    const label = `Página ${index + 1} de ${pages.length}`;
    current.drawText(printable(label), {
      x: W - M - regular.widthOfTextAtSize(printable(label), 6.5), y: 19, size: 6.5, font: regular, color: COLOR.muted,
    });
  });
  return pdf;
}

export async function createHojaVidaPdf(record, photo = '', signature = '') {
  let pdf;
  for (const scale of SCALES) {
    pdf = await renderHojaVida(record, photo, signature, scale);
    if (pdf.getPageCount() <= MAX_PAGES) break;
  }
  return Buffer.from(await pdf.save());
}
