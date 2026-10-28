import { createClient } from "@libsql/client";
import PDFDocument from "pdfkit";
import { generarPDFResultados } from "../reportes/generarPDFResultados.js";
import { generarPDFDisc } from "../reportes/generarPDFDisc.js";
import { guardarArchivoRespuesta } from "../reportes/archivosRespuestas.js";
import { inicializarTabla16pf, totalPreguntas16pf } from "../reportes/tabla16pf.js";

const db = process.env.TURSO_DATABASE_URL
    ? createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    })
    : null;

const totalPreguntasValanti = 30;
const totalPreguntasImportanciaPersonal = 9;

async function generarPDF() {
    const participantesResult = await db.execute(`
        SELECT
            id,
            nombre,
            edad,
            sexo,
            ciudad,
            ocupacion,
            empresa,
            estudios,
            fecha_creacion
        FROM participantes
        ORDER BY id ASC
    `);

    const respuestasResult = await db.execute(`
        SELECT
            participante_id,
            pregunta,
            puntos_a,
            puntos_b,
            tipo,
            fecha_creacion
        FROM respuestas
        ORDER BY participante_id ASC, pregunta ASC
    `);

    const participantes = participantesResult.rows;
    const respuestas = respuestasResult.rows;

    const respuestasPorParticipante = {};

    for (const respuesta of respuestas) {
        if (!respuestasPorParticipante[respuesta.participante_id]) {
            respuestasPorParticipante[respuesta.participante_id] = [];
        }

        respuestasPorParticipante[respuesta.participante_id].push(respuesta);
    }

    return await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margins: {
                top: 30,
                bottom: 30,
                left: 30,
                right: 30
            },
            bufferPages: true
        });

        const partes = [];

        doc.on("data", (parte) => partes.push(parte));

        doc.on("end", () => {
            resolve(Buffer.concat(partes));
        });

        doc.on("error", reject);

        const margenIzq = 30;
        const anchoPagina = 782;
        const anchoUtil = anchoPagina - 60;

        function dibujarCelda(x, y, ancho, alto, texto, opciones = {}) {
            const fondo = opciones.fondo || null;
            const colorBorde = opciones.borde || "#7f8c8d";
            const colorTexto = opciones.color || "#173042";
            const negrita = opciones.negrita || false;
            const alineacion = opciones.alineacion || "center";
            const tamano = opciones.tamano || 8;

            if (fondo) {
                doc.rect(x, y, ancho, alto)
                    .fillAndStroke(fondo, colorBorde);
            } else {
                doc.rect(x, y, ancho, alto)
                    .stroke(colorBorde);
            }

            doc.font(negrita ? "Helvetica-Bold" : "Helvetica")
                .fontSize(tamano)
                .fillColor(colorTexto)
                .text(
                    String(texto ?? ""),
                    x + 4,
                    y + 4,
                    {
                        width: ancho - 8,
                        height: alto - 8,
                        align: alineacion,
                        valign: "center",
                        lineBreak: false
                    }
                );
        }

        function dibujarEncabezadoTabla(y) {
            const columnas = [
                { titulo: "No.", ancho: 38 },
                { titulo: "Pregunta / Ítem", ancho: 430 },
                { titulo: "A", ancho: 70 },
                { titulo: "B", ancho: 70 },
                { titulo: "Tipo", ancho: 114 }
            ];

            let x = margenIzq;

            for (const columna of columnas) {
                dibujarCelda(
                    x,
                    y,
                    columna.ancho,
                    25,
                    columna.titulo,
                    {
                        fondo: "#d9eaf2",
                        negrita: true,
                        tamano: 8
                    }
                );

                x += columna.ancho;
            }
        }

        if (participantes.length === 0) {
            doc.font("Helvetica-Bold")
                .fontSize(20)
                .fillColor("#173042")
                .text("VALANTI", {
                    align: "center"
                });

            doc.moveDown(1);

            doc.font("Helvetica")
                .fontSize(12)
                .fillColor("#173042")
                .text("No hay participantes registrados.", {
                    align: "center"
                });

            doc.end();
            return;
        }

        participantes.forEach((participante, indice) => {
            if (indice > 0) {
                doc.addPage({
                    size: "A4",
                    layout: "landscape",
                    margins: {
                        top: 30,
                        bottom: 30,
                        left: 30,
                        right: 30
                    }
                });
            }

            const respuestasParticipante =
                respuestasPorParticipante[participante.id] || [];

            const mapaRespuestas = {};

            for (const respuesta of respuestasParticipante) {
                mapaRespuestas[Number(respuesta.pregunta)] = respuesta;
            }

            /*
             * ENCABEZADO
             */

            doc.font("Helvetica-Bold")
                .fontSize(21)
                .fillColor("#173042")
                .text("VALANTI", margenIzq, 25, {
                    width: anchoUtil,
                    align: "center"
                });

            doc.font("Helvetica")
                .fontSize(9)
                .fillColor("#526b79")
                .text(
                    "FORMATO DE RESPUESTAS DEL CUESTIONARIO",
                    margenIzq,
                    51,
                    {
                        width: anchoUtil,
                        align: "center"
                    }
                );

            /*
             * DATOS DEL PARTICIPANTE
             */

            const datosY = 72;
            const datosAlto = 76;

            doc.roundedRect(
                margenIzq,
                datosY,
                anchoUtil,
                datosAlto,
                5
            )
            .fillAndStroke("#f4f8fa", "#9fb9c5");

            doc.font("Helvetica-Bold")
                .fontSize(9)
                .fillColor("#173042")
                .text(
                    "DATOS DEL PARTICIPANTE",
                    margenIzq + 10,
                    datosY + 8
                );

            doc.font("Helvetica")
                .fontSize(8)
                .fillColor("#173042");

            doc.text(
                "Nombre: " + (participante.nombre || "-"),
                margenIzq + 10,
                datosY + 27,
                { width: 235 }
            );

            doc.text(
                "Edad: " + (participante.edad ?? "-"),
                margenIzq + 260,
                datosY + 27,
                { width: 100 }
            );

            doc.text(
                "Sexo: " + (participante.sexo || "-"),
                margenIzq + 380,
                datosY + 27,
                { width: 100 }
            );

            doc.text(
                "Ciudad: " + (participante.ciudad || "-"),
                margenIzq + 500,
                datosY + 27,
                { width: 120 }
            );

            doc.text(
                "Ocupación: " + (participante.ocupacion || "-"),
                margenIzq + 10,
                datosY + 48,
                { width: 235 }
            );

            doc.text(
                "Empresa: " + (participante.empresa || "-"),
                margenIzq + 260,
                datosY + 48,
                { width: 220 }
            );

            doc.text(
                "Estudios: " + (participante.estudios || "-"),
                margenIzq + 500,
                datosY + 48,
                { width: 120 }
            );

            /*
             * TABLA DE RESPUESTAS
             */

            let y = 162;

            doc.font("Helvetica-Bold")
                .fontSize(12)
                .fillColor("#173042")
                .text(
                    "RESPUESTAS",
                    margenIzq,
                    y
                );

            y += 20;

            dibujarEncabezadoTabla(y);

            y += 25;

            for (let pregunta = 1; pregunta <= totalPreguntasValanti; pregunta++) {
                if (y > 525) {
                    doc.addPage({
                        size: "A4",
                        layout: "landscape",
                        margins: {
                            top: 30,
                            bottom: 30,
                            left: 30,
                            right: 30
                        }
                    });

                    y = 35;

                    doc.font("Helvetica-Bold")
                        .fontSize(12)
                        .fillColor("#173042")
                        .text(
                            "VALANTI - RESPUESTAS",
                            margenIzq,
                            y
                        );

                    y += 20;

                    dibujarEncabezadoTabla(y);

                    y += 25;
                }

                const respuesta = mapaRespuestas[pregunta] || {};

                const esPrimeraParte = pregunta <= totalPreguntasImportanciaPersonal;

                const textoTipo = esPrimeraParte
                    ? "Importancia personal"
                    : "Frases inaceptables";

                const altoFila = 19;

                let textoPregunta = "";

                if (esPrimeraParte) {
                    textoPregunta = "Importancia personal - Pregunta " + pregunta;
                } else {
                    textoPregunta = "Frases inaceptables - Pregunta " + pregunta;
                }

                const fondo = esPrimeraParte
                    ? "#ffffff"
                    : "#f7f7f7";

                let x = margenIzq;

                dibujarCelda(
                    x,
                    y,
                    38,
                    altoFila,
                    pregunta,
                    {
                        fondo,
                        tamano: 8
                    }
                );

                x += 38;

                dibujarCelda(
                    x,
                    y,
                    430,
                    altoFila,
                    textoPregunta,
                    {
                        fondo,
                        alineacion: "left",
                        tamano: 7.5
                    }
                );

                x += 430;

                dibujarCelda(
                    x,
                    y,
                    70,
                    altoFila,
                    respuesta.puntos_a ?? "",
                    {
                        fondo,
                        negrita: true,
                        tamano: 8
                    }
                );

                x += 70;

                dibujarCelda(
                    x,
                    y,
                    70,
                    altoFila,
                    respuesta.puntos_b ?? "",
                    {
                        fondo,
                        negrita: true,
                        tamano: 8
                    }
                );

                x += 70;

                dibujarCelda(
                    x,
                    y,
                    114,
                    altoFila,
                    textoTipo,
                    {
                        fondo,
                        tamano: 6.5
                    }
                );

                y += altoFila;
            }

            /*
             * PIE
             */

            doc.font("Helvetica")
                .fontSize(7)
                .fillColor("#526b79")
                .text(
                    "Registro #" +
                        participante.id +
                        "  |  Fecha: " +
                        (participante.fecha_creacion || ""),
                    margenIzq,
                    555,
                    {
                        width: anchoUtil,
                        align: "right"
                    }
                );
        });

        doc.end();
    });
}


export default async function handler(req, res) {
    if (req.method === "GET") {
        if (!db) {
            return res.status(503).json({
                ok: false,
                error: "La base de datos no está configurada."
            });
        }

        return res.status(200).json({
            ok: true,
            mensaje: "API VALANTI funcionando correctamente."
        });
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            ok: false,
            error: "Método no permitido."
        });
    }

    if (!db) {
        return res.status(503).json({
            ok: false,
            error: "La base de datos no está configurada."
        });
    }

    try {
        const { datos, respuestas, prueba, respuestasDisc, respuestas16pf } = req.body || {};

        if (prueba !== "16PF" && (!datos || !datos.nombre)) {
            return res.status(400).json({
                ok: false,
                error: "El nombre del participante es obligatorio."
            });
        }

        if (prueba === "DISC") {
            const grupos = respuestasDisc && typeof respuestasDisc === "object"
                ? respuestasDisc
                : {};

            for (let grupo = 0; grupo < 28; grupo++) {
                const respuesta = grupos[grupo];
                if (!respuesta?.mas || !respuesta?.menos || respuesta.mas === respuesta.menos) {
                    return res.status(400).json({
                        ok: false,
                        error: `El grupo DISC ${grupo + 1} debe tener una opción MAS y una diferente MENOS.`
                    });
                }
            }

            await db.execute(`
                CREATE TABLE IF NOT EXISTS disc_respuestas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    participante_id INTEGER NOT NULL,
                    grupo INTEGER NOT NULL,
                    mas TEXT NOT NULL,
                    menos TEXT NOT NULL,
                    mas_indice INTEGER NOT NULL,
                    menos_indice INTEGER NOT NULL,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (participante_id) REFERENCES participantes(id) ON DELETE CASCADE,
                    UNIQUE(participante_id, grupo)
                )
            `);

            const participanteResult = await db.execute({
                sql: `INSERT INTO participantes (nombre, edad, sexo, ciudad, ocupacion, empresa, estudios) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [String(datos.nombre).trim(), datos.edad ? Number(datos.edad) : null, datos.sexo || null, datos.ciudad || null, datos.ocupacion || null, datos.empresa || null, datos.estudios || null]
            });
            const participanteId = Number(participanteResult.lastInsertRowid);
            await db.batch(Array.from({ length: 28 }, (_, grupo) => ({
                sql: `INSERT INTO disc_respuestas (participante_id, grupo, mas, menos, mas_indice, menos_indice) VALUES (?, ?, ?, ?, ?, ?)`,
                args: [participanteId, grupo + 1, grupos[grupo].mas, grupos[grupo].menos, Number(grupos[grupo].mas_indice ?? 0), Number(grupos[grupo].menos_indice ?? 0)]
            })));

            const pdfBuffer = await generarPDFDisc(db, participanteId);
            await guardarArchivoRespuesta(db, participanteId, "DISC", pdfBuffer);
            return res.status(201).json({ ok: true, participante_id: participanteId, prueba: "DISC", mensaje: "Prueba DISC guardada correctamente." });
        }

        if (prueba === "16PF") {
            const respuestasPf = respuestas16pf && typeof respuestas16pf === "object"
                ? respuestas16pf
                : {};

            for (let pregunta = 1; pregunta <= totalPreguntas16pf; pregunta++) {
                if (!["A", "B", "C"].includes(respuestasPf[pregunta])) {
                    return res.status(400).json({
                        ok: false,
                        error: `La cuestión 16PF ${pregunta} no tiene una respuesta válida (A, B o C).`
                    });
                }
            }

            if (!datos?.nombre || !String(datos.nombre).trim()) {
                return res.status(400).json({ ok: false, error: "Falta el nombre del participante." });
            }

            await inicializarTabla16pf(db);

            const participanteResult = await db.execute({
                sql: `INSERT INTO participantes (nombre, edad, sexo, ciudad, ocupacion, empresa, estudios) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [String(datos.nombre).trim(), datos.edad ? Number(datos.edad) : null, datos.sexo || null, datos.ciudad || null, datos.ocupacion || null, datos.empresa || null, datos.estudios || null]
            });
            const participanteId = Number(participanteResult.lastInsertRowid);
            await db.batch(Array.from({ length: totalPreguntas16pf }, (_, indice) => ({
                sql: `INSERT INTO pf16_respuestas (participante_id, pregunta, respuesta) VALUES (?, ?, ?)`,
                args: [participanteId, indice + 1, respuestasPf[indice + 1]]
            })));

            return res.status(201).json({ ok: true, participante_id: participanteId, prueba: "16PF", mensaje: "Prueba 16PF guardada correctamente." });
        }

        if (!respuestas || typeof respuestas !== "object") {
            return res.status(400).json({
                ok: false,
                error: "No se recibieron las respuestas."
            });
        }

        for (let pregunta = 1; pregunta <= totalPreguntasValanti; pregunta++) {
            const respuesta = respuestas[pregunta];

            if (
                !respuesta ||
                respuesta.a === null ||
                respuesta.a === undefined ||
                respuesta.b === null ||
                respuesta.b === undefined ||
                Number(respuesta.a) + Number(respuesta.b) !== 3
            ) {
                return res.status(400).json({
                    ok: false,
                    error: `La pregunta ${pregunta} no está completa o no suma 3.`
                });
            }
        }

        const participanteResult = await db.execute({
            sql: `
                INSERT INTO participantes (
                    nombre,
                    edad,
                    sexo,
                    ciudad,
                    ocupacion,
                    empresa,
                    estudios
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                String(datos.nombre).trim(),
                datos.edad ? Number(datos.edad) : null,
                datos.sexo || null,
                datos.ciudad || null,
                datos.ocupacion || null,
                datos.empresa || null,
                datos.estudios || null
            ]
        });

        const participanteId =
            Number(participanteResult.lastInsertRowid);

        const filas = [];

        for (let pregunta = 1; pregunta <= totalPreguntasValanti; pregunta++) {
            const respuesta = respuestas[pregunta];

            filas.push({
                sql: `
                    INSERT INTO respuestas (
                        participante_id,
                        pregunta,
                        puntos_a,
                        puntos_b,
                        tipo
                    )
                    VALUES (?, ?, ?, ?, ?)
                `,
                args: [
                    participanteId,
                    pregunta,
                    Number(respuesta.a),
                    Number(respuesta.b),
                    pregunta <= totalPreguntasImportanciaPersonal
                        ? "importancia_personal"
                        : "frases_inaceptables"
                ]
            });
        }

        await db.batch(filas);

        console.log(
            `Registro #${participanteId} guardado correctamente en Turso.`
        );

        const pdfBuffer = await generarPDFResultados(db, participanteId);
        await guardarArchivoRespuesta(db, participanteId, "VALANTI", pdfBuffer);

        console.log(
            `PDF archivado para el registro #${participanteId}.`
        );

        return res.status(201).json({
            ok: true,
            participante_id: participanteId,
            mensaje: "Cuestionario guardado correctamente."
        });

    } catch (error) {
        console.error(
            "Error guardando cuestionario:",
            error
        );

        return res.status(500).json({
            ok: false,
            error: "No se pudo guardar el cuestionario."
        });
    }
}

