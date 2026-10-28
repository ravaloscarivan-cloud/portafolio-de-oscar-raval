import { createClient } from "@libsql/client";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { generarPDFResultados } from "../reportes/generarPDFResultados.js";
import { generarPDFDisc } from "../reportes/generarPDFDisc.js";

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

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
            margins: {
                top: 45,
                bottom: 45,
                left: 45,
                right: 45
            },
            bufferPages: true
        });

        const partes = [];

        doc.on("data", (parte) => partes.push(parte));

        doc.on("end", () => {
            resolve(Buffer.concat(partes));
        });

        doc.on("error", reject);

        doc.font("Helvetica-Bold")
            .fontSize(20)
            .fillColor("#173042")
            .text("VALANTI", {
                align: "center"
            });

        doc.moveDown(0.3);

        doc.font("Helvetica")
            .fontSize(11)
            .fillColor("#526b79")
            .text("Registro de participantes y respuestas", {
                align: "center"
            });

        doc.moveDown(1);

        if (participantes.length === 0) {
            doc.fontSize(12)
                .fillColor("#173042")
                .text("No hay participantes registrados.");
        } else {
            participantes.forEach((participante, indice) => {
                if (indice > 0) {
                    doc.addPage();
                }

                doc.font("Helvetica-Bold")
                    .fontSize(16)
                    .fillColor("#173042")
                    .text(`Participante #${participante.id}`);

                doc.moveDown(0.5);

                doc.font("Helvetica")
                    .fontSize(10)
                    .fillColor("#526b79")
                    .text(
                        `Fecha de registro: ${participante.fecha_creacion || ""}`
                    );

                doc.moveDown(0.8);

                const inicioDatos = doc.y;

                doc.roundedRect(
                    45,
                    inicioDatos,
                    505,
                    145,
                    8
                )
                .fillAndStroke("#eaf6fc", "#cfe7f4");

                const yDatos = inicioDatos + 12;

                doc.font("Helvetica-Bold")
                    .fontSize(10)
                    .fillColor("#173042")
                    .text(
                        "DATOS DEL PARTICIPANTE",
                        58,
                        yDatos
                    );

                doc.font("Helvetica")
                    .fontSize(10)
                    .fillColor("#173042");

                doc.text(
                    `Nombre: ${participante.nombre || "-"}`,
                    58,
                    yDatos + 25
                );

                doc.text(
                    `Edad: ${participante.edad ?? "-"}`,
                    58,
                    yDatos + 43
                );

                doc.text(
                    `Sexo: ${participante.sexo || "-"}`,
                    58,
                    yDatos + 61
                );

                doc.text(
                    `Ciudad: ${participante.ciudad || "-"}`,
                    300,
                    yDatos + 25
                );

                doc.text(
                    `Ocupación: ${participante.ocupacion || "-"}`,
                    300,
                    yDatos + 43
                );

                doc.text(
                    `Empresa: ${participante.empresa || "-"}`,
                    300,
                    yDatos + 61
                );

                doc.text(
                    `Estudios: ${participante.estudios || "-"}`,
                    300,
                    yDatos + 79
                );

                doc.y = inicioDatos + 165;

                doc.font("Helvetica-Bold")
                    .fontSize(13)
                    .fillColor("#173042")
                    .text("RESPUESTAS");

                doc.moveDown(0.5);

                const respuestasParticipante =
                    respuestasPorParticipante[participante.id] || [];

                if (respuestasParticipante.length === 0) {
                    doc.font("Helvetica")
                        .fontSize(10)
                        .text("No hay respuestas registradas.");
                } else {
                    doc.font("Helvetica-Bold")
                        .fontSize(9)
                        .fillColor("#173042");

                    doc.text(
                        "Pregunta",
                        50,
                        doc.y,
                        {
                            width: 55,
                            align: "center"
                        }
                    );

                    doc.text(
                        "Valor A",
                        115,
                        doc.y - 9,
                        {
                            width: 70,
                            align: "center"
                        }
                    );

                    doc.text(
                        "Valor B",
                        190,
                        doc.y - 9,
                        {
                            width: 70,
                            align: "center"
                        }
                    );

                    doc.text(
                        "Sección",
                        270,
                        doc.y - 9,
                        {
                            width: 180,
                            align: "left"
                        }
                    );

                    doc.moveDown(0.7);

                    respuestasParticipante.forEach((respuesta) => {
                        if (doc.y > 735) {
                            doc.addPage();
                            doc.y = 45;
                        }

                        const y = doc.y;

                        doc.font("Helvetica")
                            .fontSize(9)
                            .fillColor("#173042");

                        doc.text(
                            String(respuesta.pregunta),
                            50,
                            y,
                            {
                                width: 55,
                                align: "center"
                            }
                        );

                        doc.text(
                            String(respuesta.puntos_a),
                            115,
                            y,
                            {
                                width: 70,
                                align: "center"
                            }
                        );

                        doc.text(
                            String(respuesta.puntos_b),
                            190,
                            y,
                            {
                                width: 70,
                                align: "center"
                            }
                        );

                        doc.text(
                            respuesta.tipo === "importancia_personal"
                                ? "Importancia personal"
                                : "Frases inaceptables",
                            270,
                            y,
                            {
                                width: 180
                            }
                        );

                        doc.moveDown(0.55);
                    });
                }
            });
        }

        doc.end();
    });
}

export default async function handler(req, res) {
    if (req.method === "GET") {
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

    try {
        const { datos, respuestas, prueba, respuestasDisc } = req.body || {};

        if (!datos || !datos.nombre) {
            return res.status(400).json({
                ok: false,
                error: "El nombre del participante es obligatorio."
            });
        }

        if (prueba === "DISC") {
            const grupos = respuestasDisc && typeof respuestasDisc === "object" ? respuestasDisc : {};
            for (let grupo = 0; grupo < 28; grupo++) {
                const respuesta = grupos[grupo];
                if (!respuesta?.mas || !respuesta?.menos || respuesta.mas === respuesta.menos) {
                    return res.status(400).json({ ok: false, error: `El grupo DISC ${grupo + 1} debe tener una opción MAS y una diferente MENOS.` });
                }
            }

            await db.execute(`CREATE TABLE IF NOT EXISTS disc_respuestas (id INTEGER PRIMARY KEY AUTOINCREMENT, participante_id INTEGER NOT NULL, grupo INTEGER NOT NULL, mas TEXT NOT NULL, menos TEXT NOT NULL, mas_indice INTEGER NOT NULL, menos_indice INTEGER NOT NULL, fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (participante_id) REFERENCES participantes(id) ON DELETE CASCADE, UNIQUE(participante_id, grupo))`);
            const participanteResult = await db.execute({ sql: `INSERT INTO participantes (nombre, edad, sexo, ciudad, ocupacion, empresa, estudios) VALUES (?, ?, ?, ?, ?, ?, ?)`, args: [String(datos.nombre).trim(), datos.edad ? Number(datos.edad) : null, datos.sexo || null, datos.ciudad || null, datos.ocupacion || null, datos.empresa || null, datos.estudios || null] });
            const participanteId = Number(participanteResult.lastInsertRowid);
            await db.batch(Array.from({ length: 28 }, (_, grupo) => ({ sql: `INSERT INTO disc_respuestas (participante_id, grupo, mas, menos, mas_indice, menos_indice) VALUES (?, ?, ?, ?, ?, ?)`, args: [participanteId, grupo + 1, grupos[grupo].mas, grupos[grupo].menos, Number(grupos[grupo].mas_indice ?? 0), Number(grupos[grupo].menos_indice ?? 0)] })));
            const pdfBuffer = await generarPDFDisc(db);
            const info = await transporter.sendMail({ from: `"VALANTI" <${process.env.GMAIL_USER}>`, to: "psicomovid@gmail.com", subject: `Nuevo formulario DISC - Registro #${participanteId}`, text: `Se ha recibido una nueva prueba DISC de ${datos.nombre}.`, attachments: [{ filename: "disc_resultados.pdf", content: pdfBuffer, contentType: "application/pdf" }] });
            console.log("PDF DISC enviado correctamente:", info.messageId);
            return res.status(201).json({ ok: true, participante_id: participanteId, prueba: "DISC", correo_enviado: true, mensaje: "Prueba DISC guardada correctamente." });
        }

        if (!respuestas || typeof respuestas !== "object") {
            return res.status(400).json({
                ok: false,
                error: "No se recibieron las respuestas."
            });
        }

        for (let pregunta = 1; pregunta <= 30; pregunta++) {
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

        for (let pregunta = 1; pregunta <= 30; pregunta++) {
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
                    pregunta <= 9
                        ? "importancia_personal"
                        : "frases_inaceptables"
                ]
            });
        }

        await db.batch(filas);

        console.log(
            `Registro #${participanteId} guardado correctamente en Turso.`
        );

        const pdfBuffer = await generarPDFResultados(db);

        console.log(
            `PDF generado para el registro #${participanteId}.`
        );

        let correoEnviado = false;

        try {
            const info = await transporter.sendMail({
                from: `"VALANTI" <${process.env.GMAIL_USER}>`,
                to: "psicomovid@gmail.com",
                subject: `Nuevo formulario VALANTI - Registro #${participanteId}`,
                text: [
                    "Se ha recibido un nuevo cuestionario VALANTI.",
                    "",
                    `Registro: #${participanteId}`,
                    `Participante: ${datos.nombre}`,
                    "",
                    "Se adjunta el PDF actualizado con los participantes y sus respuestas."
                ].join("\n"),
                attachments: [
                    {
                        filename: "valanti_registros.pdf",
                        content: pdfBuffer,
                        contentType: "application/pdf"
                    }
                ]
            });

            correoEnviado = true;

            console.log(
                "PDF enviado correctamente por correo."
            );

            console.log(
                "ID del correo:",
                info.messageId
            );
        } catch (errorCorreo) {
            console.error(
                "El registro fue guardado, pero falló el envío del correo:",
                errorCorreo
            );
        }

        return res.status(201).json({
            ok: true,
            participante_id: participanteId,
            correo_enviado: correoEnviado,
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
