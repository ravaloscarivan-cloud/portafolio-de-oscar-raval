import PDFDocument from "pdfkit";
import { preguntas16pf } from "../src/preguntas16pf.js";

// Hoja de respuestas con el diseño de "16_pf/formato de respuesta 16_pf.pdf":
// página horizontal, datos del participante en casillas y cuadrícula de
// columnas con las opciones A B C; la opción elegida se marca rellena.
const letras = ["A", "B", "C"];
const margen = 30;
const filasPorColumna = 16;
const colorTinta = "#000000";
const colorMarca = "#173042";

const formatearFecha = (valor) => {
    if (!valor) return "";
    const fecha = new Date(String(valor).replace(" ", "T"));
    if (Number.isNaN(fecha.getTime())) return String(valor);
    const dd = String(fecha.getDate()).padStart(2, "0");
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${fecha.getFullYear()}`;
};

const sexoMarcado = (sexo) => {
    const texto = String(sexo || "").trim().toUpperCase();
    if (texto.startsWith("M")) return "M";
    if (texto.startsWith("F")) return "F";
    return "";
};

export async function generarPDF16pf(db, participanteId) {
    const participanteResult = await db.execute({
        sql: `
            SELECT id, nombre, edad, sexo, ciudad, ocupacion, empresa, estudios, fecha_creacion
            FROM participantes
            WHERE id = ?
        `,
        args: [Number(participanteId)]
    });
    const respuestasResult = await db.execute({
        sql: `
            SELECT pregunta, respuesta
            FROM pf16_respuestas
            WHERE participante_id = ?
            ORDER BY pregunta ASC
        `,
        args: [Number(participanteId)]
    });

    const participante = participanteResult.rows[0] || {};
    const mapaRespuestas = {};
    for (const fila of respuestasResult.rows) {
        mapaRespuestas[Number(fila.pregunta)] = String(fila.respuesta);
    }

    return await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "LETTER",
            layout: "landscape",
            margins: { top: margen, bottom: margen, left: margen, right: margen }
        });
        const partes = [];
        doc.on("data", (parte) => partes.push(parte));
        doc.on("end", () => resolve(Buffer.concat(partes)));
        doc.on("error", reject);

        const anchoPagina = doc.page.width;
        const anchoUtil = anchoPagina - margen * 2;
        doc.lineWidth(0.8).strokeColor(colorTinta);

        // Título
        doc.font("Helvetica-Bold").fontSize(15).fillColor(colorTinta)
            .text("16 PF", margen, 58, { width: anchoUtil, align: "center" })
            .text("HOJA DE RESPUESTAS", { width: anchoUtil, align: "center" });

        // Recuadro superior derecho (en el formato: ejemplos de entrenamiento)
        const conteo = { A: 0, B: 0, C: 0 };
        Object.values(mapaRespuestas).forEach((letra) => {
            if (conteo[letra] !== undefined) conteo[letra]++;
        });
        const cajaX = anchoPagina - margen - 112;
        const cajaY = margen;
        doc.rect(cajaX, cajaY, 112, 78).stroke();
        doc.font("Helvetica-Bold").fontSize(7.5)
            .text("Resumen de respuestas", cajaX, cajaY + 7, { width: 112, align: "center" });
        doc.font("Helvetica").fontSize(7.5);
        [
            `Respondidas: ${Object.keys(mapaRespuestas).length}/${preguntas16pf.length}`,
            `A: ${conteo.A}`,
            `B: ${conteo.B}`,
            `C: ${conteo.C}`
        ].forEach((linea, i) => {
            doc.text(linea, cajaX, cajaY + 22 + i * 12, { width: 112, align: "center" });
        });

        // Datos del participante
        const etiquetasY = 126;
        const cajasY = 144;
        const altoCaja = 24;
        const campos = [
            { etiqueta: "N° Registro:", valor: participante.id ?? participanteId, x: margen + 4, ancho: 108 },
            { etiqueta: "Nombre Completo:", valor: participante.nombre, x: margen + 132, ancho: 324 },
            { etiqueta: "Edad:", valor: participante.edad, x: margen + 476, ancho: 86 },
            { etiqueta: "Fecha:", valor: formatearFecha(participante.fecha_creacion), x: margen + 578, ancho: 92 }
        ];
        campos.forEach(({ etiqueta, valor, x, ancho }) => {
            doc.font("Helvetica").fontSize(8.5).fillColor(colorTinta).text(etiqueta, x, etiquetasY);
            doc.rect(x, cajasY, ancho, altoCaja).stroke();
            doc.font("Helvetica").fontSize(9.5)
                .text(String(valor ?? ""), x + 5, cajasY + 8, {
                    width: ancho - 10, height: 12, lineBreak: false, ellipsis: true
                });
        });

        // Sexo M / F
        const sexoX = margen + 690;
        const sexo = sexoMarcado(participante.sexo);
        doc.font("Helvetica").fontSize(8.5).text("Sexo:", sexoX, etiquetasY);
        [["M", sexoX], ["F", sexoX + 26]].forEach(([letra, x]) => {
            doc.font("Helvetica").fontSize(8.5).text(letra, x, cajasY + 4);
            doc.rect(x + 9, cajasY + 2, 11, 11).stroke();
            if (sexo === letra) {
                doc.font("Helvetica-Bold").fontSize(9).text("X", x + 9, cajasY + 3.5, { width: 11, align: "center" });
            }
        });

        // Cuadrícula de respuestas
        const totalColumnas = Math.ceil(preguntas16pf.length / filasPorColumna);
        const anchoColumna = anchoUtil / totalColumnas;
        const anchoNumero = 17;
        const anchoCelda = Math.min(13, (anchoColumna - anchoNumero - 4) / 3);
        const altoCelda = 15;
        const inicioCuadricula = 196;

        preguntas16pf.forEach((_, indice) => {
            const numero = indice + 1;
            const columna = Math.floor(indice / filasPorColumna);
            const fila = indice % filasPorColumna;
            const x = margen + columna * anchoColumna;
            const y = inicioCuadricula + fila * altoCelda;
            const elegida = mapaRespuestas[numero];

            doc.font("Helvetica").fontSize(6.5).fillColor(colorTinta)
                .text(`${numero}.`, x, y + 4.5, { width: anchoNumero - 2, align: "right" });

            letras.forEach((letra, i) => {
                const celdaX = x + anchoNumero + i * anchoCelda;
                if (elegida === letra) {
                    doc.rect(celdaX, y, anchoCelda, altoCelda).fillAndStroke(colorMarca, colorTinta);
                    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
                } else {
                    doc.rect(celdaX, y, anchoCelda, altoCelda).stroke();
                    doc.font("Helvetica").fontSize(7).fillColor(colorTinta);
                }
                doc.text(letra, celdaX, y + 4.5, { width: anchoCelda, align: "center" });
            });
            doc.fillColor(colorTinta);
        });

        // Pie
        const pieY = inicioCuadricula + filasPorColumna * altoCelda + 22;
        doc.font("Helvetica").fontSize(7).fillColor("#526b79")
            .text(
                "La casilla rellena indica la opción elegida por el participante en cada cuestión.",
                margen, pieY, { width: anchoUtil, align: "left" }
            );

        doc.end();
    });
}
