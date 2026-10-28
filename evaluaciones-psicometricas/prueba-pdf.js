import fs from "fs";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";

const participante = {
    id: 999,
    nombre: "Ivan",
    edad: 25,
    sexo: "Masculino",
    ciudad: "Barranquilla",
    ocupacion: "Prueba",
    empresa: "VALANTI TEST",
    estudios: "Tecnologia",
    fecha_creacion: new Date().toLocaleString("es-CO")
};

// 30 respuestas de prueba.
// Todas suman 3, igual que las respuestas reales.
const respuestas = [];

for (let pregunta = 1; pregunta <= 30; pregunta++) {
    respuestas.push({
        pregunta,
        puntos_a: 2,
        puntos_b: 1,
        tipo:
            pregunta <= 9
                ? "importancia_personal"
                : "frases_inaceptables"
    });
}

function generarPDF() {
    return new Promise((resolve, reject) => {
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

        doc.on("data", parte => partes.push(parte));

        doc.on("end", () => {
            resolve(Buffer.concat(partes));
        });

        doc.on("error", reject);

        /*
         * ENCABEZADO
         */

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
            .text("FORMATO DE RESPUESTAS DEL CUESTIONARIO", {
                align: "center"
            });

        doc.moveDown(1);

        /*
         * DATOS DEL PARTICIPANTE
         */

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
            `Nombre: ${participante.nombre}`,
            58,
            yDatos + 25
        );

        doc.text(
            `Edad: ${participante.edad}`,
            58,
            yDatos + 43
        );

        doc.text(
            `Sexo: ${participante.sexo}`,
            58,
            yDatos + 61
        );

        doc.text(
            `Ciudad: ${participante.ciudad}`,
            300,
            yDatos + 25
        );

        doc.text(
            `Ocupación: ${participante.ocupacion}`,
            300,
            yDatos + 43
        );

        doc.text(
            `Empresa: ${participante.empresa}`,
            300,
            yDatos + 61
        );

        doc.text(
            `Estudios: ${participante.estudios}`,
            300,
            yDatos + 79
        );

        doc.text(
            `Fecha: ${participante.fecha_creacion}`,
            58,
            yDatos + 97
        );

        doc.y = inicioDatos + 165;

        /*
         * TABLA DE RESPUESTAS
         */

        doc.font("Helvetica-Bold")
            .fontSize(13)
            .fillColor("#173042")
            .text("RESPUESTAS");

        doc.moveDown(0.5);

        const columnas = [
            { titulo: "Pregunta", x: 50, ancho: 65 },
            { titulo: "Valor A", x: 120, ancho: 65 },
            { titulo: "Valor B", x: 190, ancho: 65 },
            { titulo: "Sección", x: 265, ancho: 270 }
        ];

        function dibujarEncabezado() {
            const y = doc.y;

            doc.rect(45, y - 3, 505, 25)
                .fillAndStroke("#eaf6fc", "#cfe7f4");

            doc.font("Helvetica-Bold")
                .fontSize(8)
                .fillColor("#173042");

            columnas.forEach(columna => {
                doc.text(
                    columna.titulo,
                    columna.x,
                    y + 5,
                    {
                        width: columna.ancho,
                        align: columna.titulo === "Sección"
                            ? "left"
                            : "center"
                    }
                );
            });

            doc.y = y + 28;
        }

        dibujarEncabezado();

        respuestas.forEach((respuesta, indice) => {
            if (doc.y > 735) {
                doc.addPage();
                doc.y = 45;

                doc.font("Helvetica-Bold")
                    .fontSize(13)
                    .fillColor("#173042")
                    .text("VALANTI - RESPUESTAS");

                doc.moveDown(0.5);

                dibujarEncabezado();
            }

            const y = doc.y;

            const seccion =
                respuesta.tipo === "importancia_personal"
                    ? "Importancia personal"
                    : "Frases inaceptables";

            doc.font("Helvetica")
                .fontSize(8)
                .fillColor("#173042");

            doc.text(
                String(respuesta.pregunta),
                50,
                y,
                {
                    width: 65,
                    align: "center"
                }
            );

            doc.text(
                String(respuesta.puntos_a),
                120,
                y,
                {
                    width: 65,
                    align: "center"
                }
            );

            doc.text(
                String(respuesta.puntos_b),
                190,
                y,
                {
                    width: 65,
                    align: "center"
                }
            );

            doc.text(
                seccion,
                265,
                y,
                {
                    width: 270,
                    align: "left"
                }
            );

            doc.moveDown(0.65);

            /*
             * Línea de separación
             */

            doc.moveTo(45, doc.y - 3)
                .lineTo(550, doc.y - 3)
                .strokeColor("#d9e5eb")
                .stroke();
        });

        doc.end();
    });
}

async function main() {
    try {
        console.log("Generando PDF de prueba para Ivan...");

        const pdf = await generarPDF();

        const archivo = "./VALANTI_PRUEBA_IVAN.pdf";

        fs.writeFileSync(archivo, pdf);

        console.log("PDF generado:");
        console.log(archivo);

        /*
         * CORREO
         */

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });

        console.log("Enviando correo...");

        const info = await transporter.sendMail({
            from: `"VALANTI" <${process.env.GMAIL_USER}>`,
            to: "psicomovid@gmail.com",
            subject: "VALANTI - Prueba PDF - Ivan",
            text:
                "Prueba del nuevo formato PDF de VALANTI. " +
                "Participante de prueba: Ivan.",
            attachments: [
                {
                    filename: "VALANTI_PRUEBA_IVAN.pdf",
                    path: archivo,
                    contentType: "application/pdf"
                }
            ]
        });

        console.log("CORREO ENVIADO CORRECTAMENTE.");
        console.log("Message ID:", info.messageId);
        console.log("Prueba terminada.");
    } catch (error) {
        console.error("ERROR EN LA PRUEBA:");
        console.error(error);
        process.exit(1);
    }
}

main();