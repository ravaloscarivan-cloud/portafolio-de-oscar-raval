// PDF con las respuestas de una persona:
//  - Portada: datos, indicadores y resumen de todas las capacitaciones (pre y post Completado / Pendiente).
//  - Una página por capacitación con registros: asistencia (fecha y firma) y tablas con cada respuesta del pre-test y post-test.
import logoUrl from '../assets/logo_sanithelp.png';
import { formatoFecha } from './fechas.js';

const C = {
  azul: [11, 42, 91],
  azulMedio: [26, 76, 143],
  azulClaro: [230, 239, 251],
  fondo: [243, 247, 253],
  borde: [219, 228, 240],
  texto: [29, 43, 63],
  gris: [107, 122, 144],
  verde: [31, 138, 76],
  verdeClaro: [230, 246, 236],
  rojo: [197, 48, 48],
  rojoClaro: [253, 234, 234],
  ambar: [183, 121, 31],
  ambarClaro: [253, 242, 226],
};
const M = 15; // margen
const ANCHO = 210 - M * 2;

const completado = (c) => Boolean(c.pre && c.post);

async function aDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((r) => {
    const lector = new FileReader();
    lector.onload = () => r(lector.result);
    lector.readAsDataURL(blob);
  });
}

/** @param {{persona: {nombre, apellido, correo}, capacitaciones: object[]}} datos */
export async function generarPdfRespuestas(datos) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await aDataUrl(logoUrl).catch(() => null);
  const { persona, capacitaciones } = datos;
  const nombre = `${persona.nombre} ${persona.apellido}`;

  const fuente = (tam, negrita = false, color = C.texto) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(tam);
    doc.setTextColor(...color);
  };
  const etiqueta = (texto, x, y, fondo, color) => {
    fuente(8.5, true, color);
    const w = doc.getTextWidth(texto) + 6;
    doc.setFillColor(...fondo);
    doc.roundedRect(x - w, y - 4.2, w, 6, 3, 3, 'F');
    doc.text(texto, x - w / 2, y, { align: 'center' });
  };
  const estadoPrePost = (c) => (completado(c) ? ['Completado', C.verdeClaro, C.verde] : ['Pendiente', C.ambarClaro, C.ambar]);

  // ================= Portada =================
  if (logo) doc.addImage(logo, 'PNG', M, 14, 50, 14);
  doc.setDrawColor(...C.azulMedio);
  doc.setLineWidth(0.8);
  doc.line(M, 33, M + ANCHO, 33);

  fuente(20, true, C.azul);
  doc.text('Reporte de capacitaciones', M, 46);

  // Datos de la persona
  doc.setFillColor(...C.fondo);
  doc.setDrawColor(...C.borde);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, 52, ANCHO, 20, 3, 3, 'FD');
  fuente(8, true, C.gris);
  doc.text('PARTICIPANTE', M + 5, 58);
  doc.text('CORREO ELECTRÓNICO', M + 100, 58);
  fuente(12, true, C.azul);
  doc.text(doc.splitTextToSize(nombre, 90)[0], M + 5, 66);
  fuente(10.5, false, C.texto);
  doc.text(persona.correo, M + 100, 66);

  // Indicadores
  const indicadores = [
    ['Capacitaciones', capacitaciones.length, C.azul],
    ['Asistencias firmadas', capacitaciones.filter((c) => c.asistencia).length, C.azulMedio],
    ['Pre y post completados', capacitaciones.filter(completado).length, C.verde],
    ['Pendientes', capacitaciones.filter((c) => !completado(c)).length, C.ambar],
  ];
  const anchoInd = (ANCHO - 9) / 4;
  indicadores.forEach(([texto, valor, color], i) => {
    const x = M + i * (anchoInd + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...C.borde);
    doc.roundedRect(x, 78, anchoInd, 22, 3, 3, 'FD');
    doc.setFillColor(...color);
    doc.rect(x, 78, 1.6, 22, 'F');
    fuente(18, true, color);
    doc.text(String(valor), x + 6, 90);
    fuente(8, false, C.gris);
    doc.text(texto, x + 6, 96);
  });

  fuente(12, true, C.azul);
  doc.text('Resumen por capacitación', M, 112);

  autoTable(doc, {
    startY: 116,
    margin: { left: M, right: M, bottom: 18 },
    head: [['N.º', 'Capacitación', 'Fecha', 'Asistencia', 'Pre-test', 'Post-test', 'Pre y post']],
    body: capacitaciones.map((c, i) => [
      i + 1,
      c.titulo,
      formatoFecha(c.fechaEjecucion ?? c.fechaProgramada) || '—',
      c.asistencia ? 'Firmada' : 'Pendiente',
      c.pre ? `${c.pre.puntaje}%` : 'Pendiente',
      c.post ? `${c.post.puntaje}%` : 'Pendiente',
      completado(c) ? 'Completado' : 'Pendiente',
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.4, lineColor: C.borde, lineWidth: 0.2, textColor: C.texto, valign: 'middle' },
    headStyles: { fillColor: C.azulMedio, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: C.fondo },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 62 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section !== 'body' || d.column.index < 3) return;
      const v = String(d.cell.raw);
      if (v === 'Pendiente') d.cell.styles.textColor = C.ambar;
      else d.cell.styles.textColor = C.verde;
      if (d.column.index === 6) d.cell.styles.fillColor = v === 'Completado' ? C.verdeClaro : C.ambarClaro;
    },
  });

  fuente(8, false, C.gris);
  doc.text('"Pre y post" queda Completado cuando la persona presentó el pre-test y el post-test de la capacitación.', M, doc.lastAutoTable.finalY + 6);

  // ================= Detalle por capacitación =================
  const conRegistros = capacitaciones.filter((c) => c.asistencia || c.pre || c.post);

  conRegistros.forEach((c) => {
    doc.addPage();
    // Encabezado de la capacitación
    doc.setFillColor(...C.azul);
    doc.roundedRect(M, 14, ANCHO, 22, 3, 3, 'F');
    fuente(11, true, [255, 255, 255]);
    doc.text(doc.splitTextToSize(c.titulo, ANCHO - 48).slice(0, 2), M + 5, 22, { lineHeightFactor: 1.25 });
    const [txt, fondo, color] = estadoPrePost(c);
    etiqueta(txt, M + ANCHO - 4, 25, fondo, color);

    const fechaCapacitacion = c.asistencia?.fecha ?? c.fechaEjecucion ?? c.fechaProgramada;
    const meta = [
      c.duracion && `Duración: ${c.duracion}`,
      c.facilitador && `Facilitador: ${c.facilitador}`,
      fechaCapacitacion && `Fecha de capacitación: ${formatoFecha(fechaCapacitacion)}`,
    ].filter(Boolean);
    fuente(8.5, false, C.gris);
    if (meta.length) doc.text(meta.join('   ·   '), M, 42);

    fuente(11, true, C.azul);
    doc.text('Registro de asistencia', M, 53);
    doc.setDrawColor(...C.borde);
    doc.setFillColor(...(c.asistencia ? C.fondo : C.ambarClaro));
    doc.roundedRect(M, 57, ANCHO, 55, 3, 3, 'FD');
    if (c.asistencia) {
      const campoX = M + 5;
      const campoAncho = ANCHO - 82;
      const nombreAsistencia = c.asistencia.nombre ?? persona.nombre;
      const apellidoAsistencia = c.asistencia.apellido ?? persona.apellido;
      const correoAsistencia = c.asistencia.correo ?? persona.correo;
      const campos = [
        ['NOMBRE', nombreAsistencia],
        ['APELLIDO', apellidoAsistencia],
        ['CORREO ELECTRÓNICO', correoAsistencia],
      ];
      campos.forEach(([etiquetaCampo, valor], i) => {
        const y = 61 + i * 15;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...C.borde);
        doc.roundedRect(campoX, y, campoAncho, 13, 1.5, 1.5, 'FD');
        fuente(6, true, C.gris);
        doc.text(etiquetaCampo, campoX + 3, y + 4);
        fuente(8.5, false, C.texto);
        doc.text(doc.splitTextToSize(valor, campoAncho - 6)[0], campoX + 3, y + 10);
      });

      const firmaX = M + ANCHO - 67;
      fuente(7.5, true, C.gris);
      doc.text('FIRMA *', firmaX, 66);
      doc.setDrawColor(...C.borde);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(firmaX, 69, 60, 36, 2, 2, 'FD');
      try {
        doc.addImage(c.asistencia.firma, 'PNG', firmaX + 2, 71, 56, 32);
      } catch {
        /* firma ilegible: queda el recuadro */
      }
    } else {
      fuente(10, true, C.ambar);
      doc.text('Pendiente', M + 5, 69);
      fuente(9, false, C.texto);
      doc.text('No hay registro de asistencia para esta capacitación.', M + 5, 78);
    }

    fuente(11, true, C.azul);
    doc.text('Evaluaciones', M, 126);
    const anchoEvaluacion = (ANCHO - 6) / 2;
    [
      ['Pre-test', c.pre],
      ['Post-test', c.post],
    ].forEach(([titulo, test], i) => {
      const x = M + i * (anchoEvaluacion + 6);
      const ok = Boolean(test);
      doc.setDrawColor(...C.borde);
      doc.setFillColor(...(ok ? C.verdeClaro : C.ambarClaro));
      doc.roundedRect(x, 131, anchoEvaluacion, 43, 3, 3, 'FD');
      fuente(8, true, C.gris);
      doc.text(titulo.toUpperCase(), x + 5, 139);
      fuente(12, true, ok ? C.verde : C.ambar);
      doc.text(ok ? 'Completado' : 'Pendiente', x + 5, 148);
      fuente(9, false, C.texto);
      doc.text(ok ? `${test.correctas} de ${test.total} correctas · ${test.puntaje}%` : 'Aún no presentado', x + 5, 157);
      if (ok) {
        fuente(7.5, false, C.gris);
        doc.text(`Fecha: ${formatoFecha(test.fecha ?? fechaCapacitacion)}`, x + 5, 166);
      }
    });
  });

  // ================= Encabezado y pie de cada página =================
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.azulMedio);
    doc.rect(0, 0, 210, 3, 'F');
    doc.setDrawColor(...C.borde);
    doc.setLineWidth(0.3);
    doc.line(M, 285, M + ANCHO, 285);
    fuente(8, false, C.gris);
    doc.text(`SanitHelp · Reporte de capacitaciones · ${nombre}`, M, 290);
    doc.text(`Página ${i} de ${paginas}`, M + ANCHO, 290, { align: 'right' });
  }

  const archivo = `Respuestas_${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}.pdf`;
  return { doc, archivo };
}
