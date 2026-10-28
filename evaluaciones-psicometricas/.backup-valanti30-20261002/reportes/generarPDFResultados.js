import PDFDocument from "pdfkit";

const valores = ["Verdad", "Rectitud", "Paz", "Amor", "No violencia"];

const primeraParte = [
    ["Amor", "Rectitud"],
    ["No violencia", "Rectitud"],
    ["Paz", "Amor"],
    ["Paz", "No violencia"],
    ["Verdad", "Rectitud"],
    ["Verdad", "Rectitud"],
    ["Rectitud", "Verdad"],
    ["Amor", "Verdad"],
];

const segundaParte = [
    ["Rectitud", "Paz"],
    ["Rectitud", "No violencia"],
    ["Verdad", "No violencia"],
    ["No violencia", "Rectitud"],
    ["Rectitud", "No violencia"],
    ["No violencia", "No violencia"],
    ["Verdad", "Amor"],
    ["Rectitud", "No violencia"],
    ["No violencia", "Paz"],
    ["Rectitud", "No violencia"],
    ["Verdad", "Rectitud"],
    ["Rectitud", "Paz"],
    ["No violencia", "Rectitud"],
    ["No violencia", "No violencia"],
    ["Paz", "Rectitud"],
    ["Paz", "Verdad"],
    ["Rectitud", "Paz"],
    ["No violencia", "Rectitud"],
    ["Rectitud", "Paz"],
    ["Amor", "Amor"]
];

const totalPreguntasValanti = primeraParte.length + segundaParte.length;

const descripciones = {
    Verdad: "La verdad se relaciona con la claridad del pensamiento, la honestidad, la concentración, la curiosidad y la capacidad de analizar con criterio.",
    Rectitud: "La rectitud representa la integridad, la ética, la responsabilidad, la perseverancia, el respeto y el cumplimiento de los compromisos.",
    Paz: "La paz se manifiesta en la calma, la estabilidad emocional, la reflexión, la paciencia, la serenidad y la capacidad de mantener el equilibrio.",
    Amor: "El amor expresa empatía, afecto, cooperación, gratitud, solidaridad y una disposición genuina para cuidar a las demás personas.",
    "No violencia": "La no violencia implica tolerancia, respeto, perdón, compasión, convivencia y rechazo de la agresión, el odio y la discriminación."
};

function calcularResultados(participante, respuestas) {
    const primera = Object.fromEntries(valores.map((valor) => [valor, 0]));
    const segunda = Object.fromEntries(valores.map((valor) => [valor, 0]));

    for (let pregunta = 1; pregunta <= totalPreguntasValanti; pregunta++) {
        const respuesta = respuestas[pregunta] || {};
        const esPrimeraParte = pregunta <= primeraParte.length;
        const mapa = esPrimeraParte
            ? primeraParte[pregunta - 1]
            : segundaParte[pregunta - primeraParte.length - 1];
        const destino = esPrimeraParte ? primera : segunda;
        destino[mapa[0]] += Number(respuesta.puntos_a || 0);
        destino[mapa[1]] += Number(respuesta.puntos_b || 0);
    }

    const total = Object.fromEntries(
        valores.map((valor) => [valor, primera[valor] + segunda[valor]])
    );
    const preferido = valores.reduce((actual, valor) =>
        total[valor] > total[actual] ? valor : actual
    , valores[0]);

    return { primera, segunda, total, preferido, participante };
}

function celda(doc, x, y, ancho, alto, texto, opciones = {}) {
    const fondo = opciones.fondo || null;
    const borde = opciones.borde || "#777777";

    if (fondo) {
        doc.rect(x, y, ancho, alto).fillAndStroke(fondo, borde);
    } else {
        doc.rect(x, y, ancho, alto).stroke(borde);
    }

    doc.font(opciones.negrita ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opciones.tamano || 7)
        .fillColor(opciones.color || "#111111")
        .text(String(texto ?? ""), x + 2, y + 2, {
            width: ancho - 4,
            height: alto - 4,
            align: opciones.alineacion || "center",
            valign: "center",
            lineBreak: false
        });
}

function dibujarRadar(doc, resultados, centroX, centroY, radio) {
    const puntos = valores.map((valor, indice) => {
        const angulo = -Math.PI / 2 + indice * (Math.PI * 2 / valores.length);
        const maximo = Math.max(...valores.map((item) => resultados.total[item]), 1);
        const escala = resultados.total[valor] / maximo;
        return {
            x: centroX + Math.cos(angulo) * radio * escala,
            y: centroY + Math.sin(angulo) * radio * escala
        };
    });

    for (let nivel = 1; nivel <= 4; nivel++) {
        const puntosNivel = valores.map((_, indice) => {
            const angulo = -Math.PI / 2 + indice * (Math.PI * 2 / valores.length);
            return {
                x: centroX + Math.cos(angulo) * radio * nivel / 4,
                y: centroY + Math.sin(angulo) * radio * nivel / 4
            };
        });

        doc.moveTo(puntosNivel[0].x, puntosNivel[0].y);
        puntosNivel.slice(1).forEach((punto) => doc.lineTo(punto.x, punto.y));
        doc.lineTo(puntosNivel[0].x, puntosNivel[0].y).strokeColor("#b8b8b8").stroke();
    }

    valores.forEach((valor, indice) => {
        const angulo = -Math.PI / 2 + indice * (Math.PI * 2 / valores.length);
        const x = centroX + Math.cos(angulo) * radio;
        const y = centroY + Math.sin(angulo) * radio;
        doc.moveTo(centroX, centroY).lineTo(x, y).strokeColor("#b8b8b8").stroke();
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#111111").text(valor, x - 32, y - 5, { width: 64, align: "center" });
    });

    doc.moveTo(puntos[0].x, puntos[0].y);
    puntos.slice(1).forEach((punto) => doc.lineTo(punto.x, punto.y));
    doc.lineTo(puntos[0].x, puntos[0].y)
        .lineWidth(1.5)
        .strokeColor("#1d3f69")
        .stroke();

    puntos.forEach((punto) => doc.circle(punto.x, punto.y, 2.5).fillColor("#1d3f69").fill());
}

export async function generarPDFResultados(db, participanteId = null) {
    const filtroParticipante = participanteId == null ? "" : "WHERE id = ?";
    const filtroRespuestas = participanteId == null ? "" : "WHERE participante_id = ?";
    const args = participanteId == null ? [] : [Number(participanteId)];
    const participantesResult = await db.execute({
        sql: `
        SELECT id, nombre, edad, sexo, ciudad, ocupacion, empresa, estudios, fecha_creacion
        FROM participantes
        ${filtroParticipante}
        ORDER BY id ASC
    `,
        args
    });
    const respuestasResult = await db.execute({
        sql: `
        SELECT participante_id, pregunta, puntos_a, puntos_b, tipo
        FROM respuestas
        ${filtroRespuestas}
        ORDER BY participante_id ASC, pregunta ASC
    `,
        args
    });

    const respuestasPorParticipante = {};
    for (const respuesta of respuestasResult.rows) {
        if (!respuestasPorParticipante[respuesta.participante_id]) {
            respuestasPorParticipante[respuesta.participante_id] = {};
        }
        respuestasPorParticipante[respuesta.participante_id][Number(respuesta.pregunta)] = respuesta;
    }

    return new Promise((resolve, reject) => {
        const partes = [];
        const doc = new PDFDocument({ size: "A4", margins: 24, bufferPages: true });
        doc.on("data", (parte) => partes.push(parte));
        doc.on("end", () => resolve(Buffer.concat(partes)));
        doc.on("error", reject);

        if (participantesResult.rows.length === 0) {
            doc.font("Helvetica-Bold").fontSize(20).text("VALANTI", { align: "center" });
            doc.moveDown(1);
            doc.font("Helvetica").fontSize(12).text("No hay participantes registrados.", { align: "center" });
            doc.end();
            return;
        }

        participantesResult.rows.forEach((participante, indice) => {
            if (indice > 0) {
                doc.addPage();
            }

            const resultado = calcularResultados(
                participante,
                respuestasPorParticipante[participante.id] || {}
            );
            const ancho = 547;

            doc.font("Helvetica-Bold").fontSize(7).fillColor("#111111").text("Cuestionario VALANTI", 55, 28);
            doc.font("Helvetica-Bold").fontSize(11).text("Hoja de resultados", 24, 28, { width: ancho, align: "center" });
            doc.font("Helvetica").fontSize(5.5).text("(C) Octavio Escobar, 1997, 1999\nEsta copia es para uso exclusivo de\nListos S.A.", 430, 20, { width: 140, align: "right" });

            const datosX = 110;
            const datosY = 58;
            doc.rect(datosX, datosY, 112, 70).stroke("#555555");
            doc.font("Helvetica-Bold").fontSize(5.5).text("DATOS DEL PARTICIPANTE", datosX + 4, datosY + 5);
            doc.font("Helvetica").fontSize(5.5);
            doc.text(`Nombre: ${participante.nombre || "-"}`, datosX + 4, datosY + 17, { width: 104 });
            doc.text(`Edad: ${participante.edad ?? "-"}     Sexo: ${participante.sexo || "-"}`, datosX + 4, datosY + 30, { width: 104 });
            doc.text(`Cargo: ${participante.ocupacion || "-"}`, datosX + 4, datosY + 43, { width: 104 });
            doc.text(`Estudios: ${participante.estudios || "-"}`, datosX + 4, datosY + 56, { width: 104 });

            const tablaX = 230;
            const tablaY = 58;
            const columnaValor = 48;
            const fila = 11;
            const promedioNorma = [15.65, 21.05, 17.35, 16.68, 21.22];
            const desviacionNorma = [4.70, 4.44, 6.61, 5.41, 7.19];
            celda(doc, tablaX, tablaY, 70, fila, "", { fondo: "#eeeeee" });
            valores.forEach((valor, valorIndice) => celda(doc, tablaX + 70 + valorIndice * columnaValor, tablaY, columnaValor, fila, valor, { fondo: "#eeeeee", negrita: true, tamano: 5.5 }));
            const filasResultados = [
                {
                    nombre: "Promedio Norma (nacional) 1997",
                    valores: promedioNorma,
                    opciones: { tamano: 4.8 }
                },
                {
                    nombre: "Desviación Estándar Norma (nacional) 1997",
                    valores: desviacionNorma,
                    opciones: { tamano: 4.8 }
                },
                {
                    nombre: "Puntaje directo",
                    valores: valores.map((valor) => resultado.total[valor]),
                    opciones: { negrita: true, tamano: 6 }
                },
                {
                    nombre: participante.nombre,
                    valores: valores.map((valor, indice) => Math.round(50 + ((resultado.total[valor] - promedioNorma[indice]) / desviacionNorma[indice]) * 10)),
                    opciones: { color: "#e00000", negrita: true, tamano: 6 }
                },
                {
                    nombre: "Interpretación del puntaje estándar",
                    valores: valores.map((valor, indice) => {
                        const puntuacion = Math.round(50 + ((resultado.total[valor] - promedioNorma[indice]) / desviacionNorma[indice]) * 10);
                        return puntuacion >= 60 ? "*****" : puntuacion >= 50 ? "****" : "***";
                    }),
                    opciones: { color: "#e00000", tamano: 5 }
                },
                {
                    nombre: "Distancia con la Organización",
                    valores: valores.map((valor, indice) => Math.round(resultado.total[valor] - promedioNorma[indice])),
                    opciones: { tamano: 6 }
                }
            ];
            filasResultados.forEach((filaResultado, filaIndice) => {
                const y = tablaY + fila * (filaIndice + 1);
                celda(doc, tablaX, y, 70, fila, filaResultado.nombre, { negrita: filaIndice === 2, tamano: filaResultado.opciones.tamano || 5 });
                filaResultado.valores.forEach((valorCelda, valorIndice) => {
                    celda(doc, tablaX + 70 + valorIndice * columnaValor, y, columnaValor, fila, valorCelda, filaResultado.opciones);
                });
            });

            doc.font("Helvetica-Bold").fontSize(7).text(`Valor preferido: ${resultado.preferido}`, 55, 132);

            const respuestasX = 110;
            const respuestasY = 145;
            const altoFila = 11;
            celda(doc, respuestasX, respuestasY, 18, 16, "No.", { fondo: "#dddddd", negrita: true, tamano: 5 });
            celda(doc, respuestasX + 18, respuestasY, 18, 16, "A", { fondo: "#dddddd", negrita: true, tamano: 5 });
            celda(doc, respuestasX + 36, respuestasY, 18, 16, "B", { fondo: "#dddddd", negrita: true, tamano: 5 });
            celda(doc, respuestasX + 54, respuestasY, 58, 16, participante.fecha_creacion || "", { fondo: "#dddddd", negrita: true, tamano: 4.5 });

            for (let pregunta = 1; pregunta <= totalPreguntasValanti; pregunta++) {
                const respuesta = respuestasPorParticipante[participante.id]?.[pregunta] || {};
                const y = respuestasY + 16 + (pregunta - 1) * altoFila;
                const fondo = pregunta <= primeraParte.length ? "#ffffff" : "#f7f7f7";
                const tipo = pregunta <= primeraParte.length ? "Importancia personal" : "Frases inaceptables";
                celda(doc, respuestasX, y, 18, altoFila, pregunta, { fondo, tamano: 5 });
                celda(doc, respuestasX + 18, y, 18, altoFila, respuesta.puntos_a ?? "", { fondo, tamano: 5 });
                celda(doc, respuestasX + 36, y, 18, altoFila, respuesta.puntos_b ?? "", { fondo, tamano: 5 });
                celda(doc, respuestasX + 54, y, 58, altoFila, tipo, { fondo, tamano: 5 });
            }

            doc.rect(tablaX, 160, 310, 285).stroke("#555555");
            doc.font("Helvetica-Bold").fontSize(8).text("Perfil valorativo, cuestionario VALANTI", tablaX, 170, { width: 310, align: "center" });
            dibujarRadar(doc, resultado, tablaX + 155, 295, 88);
            doc.font("Helvetica-Bold").fontSize(8).text("Interpretación de resultados", 55, 498, { width: 435, align: "center" });

            const interpretacion = valores
                .map((valor) => `El valor ${valor.toUpperCase()} (${resultado.total[valor]}) ${descripciones[valor]}`)
                .join(" ");

            doc.font("Helvetica")
                .fontSize(5.8)
                .fillColor("#111111")
                .text(interpretacion, 55, 535, {
                    width: 435,
                    align: "justify",
                    lineGap: 2
                });

            doc.font("Helvetica").fontSize(6).fillColor("#555555").text(
                `Registro #${participante.id} | Fecha: ${participante.fecha_creacion || ""}`,
                24,
                790,
                { width: ancho, align: "right" }
            );
        });

        doc.end();
    });
}

export { calcularResultados };
