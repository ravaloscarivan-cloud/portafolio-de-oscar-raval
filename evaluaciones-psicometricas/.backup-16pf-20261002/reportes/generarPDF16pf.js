import PDFDocument from "pdfkit";
import { preguntas16pf } from "../src/preguntas16pf.js";

const letras = ["A", "B", "C"];
const margen = 36;

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
            size: "A4",
            margins: { top: margen, bottom: margen, left: margen, right: margen }
        });
        const partes = [];
        doc.on("data", (parte) => partes.push(parte));
        doc.on("end", () => resolve(Buffer.concat(partes)));
        doc.on("error", reject);

        const anchoUtil = doc.page.width - margen * 2;
        const limiteInferior = doc.page.height - margen - 20;
        const columnas = [
            { titulo: "No.", ancho: 32, alineacion: "center" },
            { titulo: "Cuestión", ancho: anchoUtil - 32 - 46 - 150, alineacion: "left" },
            { titulo: "Resp.", ancho: 46, alineacion: "center" },
            { titulo: "Opción elegida", ancho: 150, alineacion: "left" }
        ];

        const encabezadoTabla = (y) => {
            let x = margen;
            for (const columna of columnas) {
                doc.rect(x, y, columna.ancho, 18).fillAndStroke("#d9eaf2", "#9aaab4");
                doc.font("Helvetica-Bold").fontSize(8).fillColor("#173042")
                    .text(columna.titulo, x + 4, y + 5, { width: columna.ancho - 8, align: columna.alineacion });
                x += columna.ancho;
            }
            return y + 18;
        };

        // Encabezado
        doc.font("Helvetica-Bold").fontSize(20).fillColor("#173042")
            .text("16PF - FORMA A", margen, margen, { width: anchoUtil, align: "center" });
        doc.font("Helvetica").fontSize(9).fillColor("#526b79")
            .text("HOJA DE RESPUESTAS DEL CUESTIONARIO DE FACTORES DE PERSONALIDAD", { width: anchoUtil, align: "center" });

        // Datos del participante
        const datosY = 86;
        doc.roundedRect(margen, datosY, anchoUtil, 66, 5).fillAndStroke("#f4f8fa", "#9fb9c5");
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#173042")
            .text("DATOS DEL PARTICIPANTE", margen + 10, datosY + 8);

        const campos = [
            ["Nombre", participante.nombre],
            ["Edad", participante.edad],
            ["Sexo", participante.sexo],
            ["Ciudad", participante.ciudad],
            ["Cargo", participante.ocupacion],
            ["Empresa", participante.empresa],
            ["Estudios", participante.estudios]
        ];
        const anchoCampo = (anchoUtil - 20) / 4;
        doc.font("Helvetica").fontSize(8).fillColor("#173042");
        campos.forEach(([etiqueta, valor], indice) => {
            const fila = Math.floor(indice / 4);
            const columna = indice % 4;
            doc.text(
                `${etiqueta}: ${valor ?? "-"}`,
                margen + 10 + columna * anchoCampo,
                datosY + 26 + fila * 18,
                { width: anchoCampo - 8, lineBreak: false, ellipsis: true, height: 12 }
            );
        });

        // Resumen de respuestas
        const conteo = { A: 0, B: 0, C: 0 };
        Object.values(mapaRespuestas).forEach((letra) => {
            if (conteo[letra] !== undefined) conteo[letra]++;
        });
        doc.font("Helvetica").fontSize(8).fillColor("#526b79")
            .text(
                `Respondidas: ${Object.keys(mapaRespuestas).length}/${preguntas16pf.length}   ·   A: ${conteo.A}   ·   B: ${conteo.B}   ·   C: ${conteo.C}`,
                margen,
                datosY + 76,
                { width: anchoUtil, align: "right" }
            );

        let y = encabezadoTabla(datosY + 92);

        preguntas16pf.forEach(([enunciado, opciones], indice) => {
            const numero = indice + 1;
            const letra = mapaRespuestas[numero] || "";
            const opcionElegida = letra ? opciones[letras.indexOf(letra)] : "";

            doc.font("Helvetica").fontSize(7.5);
            const altoTexto = Math.max(
                doc.heightOfString(enunciado, { width: columnas[1].ancho - 8 }),
                doc.heightOfString(opcionElegida || " ", { width: columnas[3].ancho - 8 })
            );
            const alto = Math.max(16, altoTexto + 7);

            if (y + alto > limiteInferior) {
                doc.addPage();
                y = encabezadoTabla(margen);
            }

            const fondo = numero % 2 === 0 ? "#f7fafc" : "#ffffff";
            const valores = [String(numero), enunciado, letra, opcionElegida];
            let x = margen;
            columnas.forEach((columna, indiceColumna) => {
                doc.rect(x, y, columna.ancho, alto).fillAndStroke(fondo, "#c9d6dd");
                const negrita = indiceColumna === 2;
                doc.font(negrita ? "Helvetica-Bold" : "Helvetica")
                    .fontSize(negrita ? 9 : 7.5)
                    .fillColor(negrita ? "#147db5" : "#173042")
                    .text(valores[indiceColumna], x + 4, y + (negrita ? 3.5 : 4), {
                        width: columna.ancho - 8,
                        align: columna.alineacion
                    });
                x += columna.ancho;
            });
            y += alto;
        });

        doc.font("Helvetica").fontSize(7).fillColor("#526b79")
            .text(
                `Registro #${participante.id ?? participanteId}  |  Fecha: ${participante.fecha_creacion || ""}`,
                margen,
                Math.min(y + 8, limiteInferior + 4),
                { width: anchoUtil, align: "right" }
            );

        doc.end();
    });
}
