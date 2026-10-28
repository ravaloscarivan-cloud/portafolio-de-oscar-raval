import PDFDocument from "pdfkit";
import { gruposDisc } from "./discPreguntas.js";

const perfiles = ["D", "I", "S", "C"];

function calcularPerfil(respuestas) {
    const puntajes = Object.fromEntries(perfiles.map((perfil) => [perfil, 0]));

    for (const respuesta of respuestas) {
        const mas = Number(respuesta.mas_indice);
        const menos = Number(respuesta.menos_indice);
        if (Number.isInteger(mas)) puntajes[perfiles[mas % 4]] += 1;
        if (Number.isInteger(menos)) puntajes[perfiles[menos % 4]] -= 1;
    }

    return puntajes;
}

function celda(doc, x, y, ancho, alto, texto, opciones = {}) {
    doc.rect(x, y, ancho, alto)
        .fillAndStroke(opciones.fondo || "#ffffff", opciones.borde || "#9aaab4");
    doc.font(opciones.negrita ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opciones.tamano || 6.5)
        .fillColor(opciones.color || "#173042")
        .text(String(texto ?? ""), x + 2, y + 2, {
            width: ancho - 4,
            height: alto - 4,
            align: opciones.alineacion || "left",
            valign: "center",
            lineBreak: false
        });
}

function dibujarGrupo(doc, grupo, respuesta, x, y, ancho) {
    const cabecera = 14;
    const altoFila = 10;
    const opciones = gruposDisc[grupo - 1] || [];

    celda(doc, x, y, ancho, cabecera, `Grupo ${grupo}`, {
        fondo: "#d9eaf2",
        negrita: true,
        tamano: 6.5,
        alineacion: "center"
    });

    opciones.forEach((palabra, indice) => {
        const esMas = respuesta?.mas === palabra;
        const esMenos = respuesta?.menos === palabra;
        const marca = esMas ? "MAS" : esMenos ? "MENOS" : "";

        celda(doc, x, y + cabecera + indice * altoFila, ancho - 38, altoFila, palabra, { tamano: 5.5 });
        celda(doc, x + ancho - 38, y + cabecera + indice * altoFila, 38, altoFila, marca, {
            tamano: 4.7,
            negrita: Boolean(marca),
            color: esMas ? "#16734c" : esMenos ? "#a53d3d" : "#7b8991",
            alineacion: "center"
        });
    });
}

export async function generarPDFDisc(db, participanteId = null) {
    const filtroParticipante = participanteId == null ? "" : "AND id = ?";
    const filtroRespuestas = participanteId == null ? "" : "AND participante_id = ?";
    const args = participanteId == null ? [] : [Number(participanteId)];
    const participantesResult = await db.execute({
        sql: `
        SELECT id, nombre, sexo, ciudad, ocupacion, empresa, estudios, fecha_creacion
        FROM participantes
        WHERE id IN (SELECT DISTINCT participante_id FROM disc_respuestas)
        ${filtroParticipante}
        ORDER BY id ASC
    `,
        args
    });
    const respuestasResult = await db.execute({
        sql: `
        SELECT participante_id, grupo, mas, menos, mas_indice, menos_indice
        FROM disc_respuestas
        WHERE 1 = 1 ${filtroRespuestas}
        ORDER BY participante_id ASC, grupo ASC
    `,
        args
    });

    const respuestasPorParticipante = {};
    for (const respuesta of respuestasResult.rows) {
        if (!respuestasPorParticipante[respuesta.participante_id]) {
            respuestasPorParticipante[respuesta.participante_id] = {};
        }
        respuestasPorParticipante[respuesta.participante_id][Number(respuesta.grupo)] = respuesta;
    }

    return new Promise((resolve, reject) => {
        const partes = [];
        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margins: { top: 24, bottom: 24, left: 24, right: 24 },
            bufferPages: true
        });
        doc.on("data", (parte) => partes.push(parte));
        doc.on("end", () => resolve(Buffer.concat(partes)));
        doc.on("error", reject);

        if (!participantesResult.rows.length) {
            doc.font("Helvetica-Bold").fontSize(20).text("PRUEBA DISC", { align: "center" });
            doc.moveDown(1);
            doc.font("Helvetica").fontSize(12).text("No hay resultados DISC registrados.", { align: "center" });
            doc.end();
            return;
        }

        participantesResult.rows.forEach((participante, indice) => {
            if (indice > 0) doc.addPage();

            const respuestas = respuestasPorParticipante[participante.id] || {};
            const puntajes = calcularPerfil(Object.values(respuestas));
            const anchoUtil = 746;

            doc.font("Helvetica-Bold").fontSize(8).fillColor("#173042").text("Cuestionario DISC", 24, 22);
            doc.font("Helvetica-Bold").fontSize(14).text("Hoja de resultados", 24, 22, { width: anchoUtil, align: "center" });
            doc.font("Helvetica").fontSize(5.5).text("Perfil de comportamiento DISC", 650, 18, { width: 120, align: "right" });

            doc.roundedRect(24, 48, 190, 82, 4).fillAndStroke("#f4f8fa", "#9fb9c5");
            doc.font("Helvetica-Bold").fontSize(8).fillColor("#173042").text("DATOS DEL PARTICIPANTE", 36, 58);
            doc.font("Helvetica").fontSize(8).fillColor("#173042");
            doc.text(`Nombre: ${participante.nombre || "-"}`, 36, 76, { width: 170 });
            doc.text(`Cargo: ${participante.ocupacion || "-"}`, 36, 91, { width: 170 });
            doc.text(`Empresa: ${participante.empresa || "-"}`, 36, 106, { width: 170 });
            doc.text(`Ciudad: ${participante.ciudad || "-"}`, 36, 121, { width: 170 });

            doc.font("Helvetica-Bold").fontSize(8).text("Perfil DISC", 230, 48);
            perfiles.forEach((perfil, indicePerfil) => {
                celda(doc, 230 + indicePerfil * 74, 62, 74, 18, perfil, { fondo: "#d9eaf2", negrita: true, alineacion: "center" });
                celda(doc, 230 + indicePerfil * 74, 80, 74, 22, puntajes[perfil], { negrita: true, tamano: 10, alineacion: "center" });
            });
            doc.font("Helvetica").fontSize(6.5).text("Puntaje relativo por selección MAS y MENOS", 230, 108, { width: 296, align: "center" });

            doc.font("Helvetica-Bold").fontSize(8).text("Registro de respuestas", 24, 135);
            const anchoGrupo = 181;
            const separacion = 7;
            const inicioY = 150;

            for (let fila = 0; fila < 7; fila++) {
                for (let columna = 0; columna < 4; columna++) {
                    const grupo = fila * 4 + columna + 1;
                    dibujarGrupo(doc, grupo, respuestas[grupo], 24 + columna * (anchoGrupo + separacion), inicioY + fila * 61, anchoGrupo);
                }
            }

            doc.font("Helvetica").fontSize(5.5).fillColor("#526b79").text(`Registro #${participante.id} | Fecha: ${participante.fecha_creacion || ""}`, 24, 550, { width: anchoUtil, align: "right" });

            doc.addPage();
            const patron = patronDisc(puntajes);
            doc.font("Helvetica-Bold").fontSize(14).fillColor("#173042").text(`Patrón ${patron.nombre}`, 24, 24, { width: 746, align: "center" });
            doc.font("Helvetica").fontSize(7).fillColor("#526b79").text(`Resultado DISC de ${participante.nombre || "-"}`, 24, 44, { width: 746, align: "center" });

            dibujarTablaIntensidad(doc, puntajes, 410, 65);

            const filasPatron = [
                ["Emociones", patron.emociones],
                ["Meta", patron.meta],
                ["Juzga a los demás por", patron.juzga],
                ["Influye en los demás mediante", patron.influye],
                ["Su valor para la organización", patron.valor],
                ["Abusa de", patron.abusa],
                ["Bajo presión", patron.presion],
                ["Teme", patron.teme],
                ["Sería más eficaz si", patron.eficaz]
            ];

            doc.font("Helvetica-Bold").fontSize(9).text("Patrón del perfil", 48, 44);
            filasPatron.forEach((filaPatron, indiceFila) => {
                const filaY = 65 + indiceFila * 30;
                celda(doc, 48, filaY, 145, 25, `${filaPatron[0]}:`, { negrita: true, color: "#173b91", tamano: 6.5 });
                celda(doc, 193, filaY, 190, 25, filaPatron[1], { tamano: 6.2 });
            });

            doc.font("Helvetica").fontSize(7).text(
                `El patrón ${patron.nombre} se obtiene de las selecciones MAS y MENOS realizadas en los 28 grupos. Los segmentos D, I, S y C muestran las tendencias relativas del comportamiento.`,
                48,
                390,
                { width: 335, align: "justify", lineGap: 2 }
            );
        });

        doc.end();
    });
}

function segmentoDe(puntaje) {
    if (puntaje >= 12) return 7;
    if (puntaje >= 6) return 6;
    if (puntaje >= 1) return 5;
    if (puntaje >= -2) return 4;
    if (puntaje >= -7) return 3;
    if (puntaje >= -12) return 2;
    return 1;
}

function patronDisc(puntajes) {
    const dominante = perfiles.reduce((actual, perfil) =>
        puntajes[perfil] > puntajes[actual] ? perfil : actual
    , perfiles[0]);

    const patrones = {
        D: {
            nombre: "El Director",
            emociones: "Directo, competitivo y orientado a los resultados.",
            meta: "Lograr objetivos y asumir retos.",
            juzga: "La capacidad de decisión y la eficiencia.",
            influye: "La firmeza, la iniciativa y la acción.",
            valor: "Impulso para avanzar y resolver problemas.",
            abusa: "La prisa y la exigencia excesiva.",
            presion: "Puede mostrarse impaciente o dominante.",
            teme: "Perder el control o no alcanzar el resultado.",
            eficaz: "Escucha más y considera los ritmos de los demás."
        },
        I: {
            nombre: "El Influyente",
            emociones: "Comunicativo, entusiasta y sociable.",
            meta: "El reconocimiento y las relaciones positivas.",
            juzga: "La aceptación y el entusiasmo de las personas.",
            influye: "La comunicación y la motivación.",
            valor: "Conecta personas y facilita la colaboración.",
            abusa: "La espontaneidad y la falta de seguimiento.",
            presion: "Puede perder concentración o ser impulsivo.",
            teme: "El rechazo y el aislamiento.",
            eficaz: "Organiza mejor sus compromisos y fechas límite."
        },
        S: {
            nombre: "El Consejero",
            emociones: "Afectuoso, comprensivo y estable.",
            meta: "La amistad, la armonía y la felicidad.",
            juzga: "La aceptación positiva y el lado bueno de las personas.",
            influye: "Las relaciones personales y la escucha.",
            valor: "Estabilidad, cooperación y confianza.",
            abusa: "La tolerancia y el acercamiento indirecto.",
            presion: "Puede volverse demasiado flexible.",
            teme: "Presionar a los demás o causar daño.",
            eficaz: "Presta más atención a las fechas límite e iniciativa."
        },
        C: {
            nombre: "El Analista",
            emociones: "Preciso, reservado y cuidadoso.",
            meta: "La calidad, la exactitud y el orden.",
            juzga: "La lógica, las normas y la evidencia.",
            influye: "El análisis y los procedimientos claros.",
            valor: "Rigor, precisión y confiabilidad.",
            abusa: "El perfeccionismo y el exceso de control.",
            presion: "Puede demorarse por analizar demasiado.",
            teme: "Cometer errores o perder información.",
            eficaz: "Decide con más agilidad y acepta cambios graduales."
        }
    };

    return { dominante, ...patrones[dominante] };
}

function dibujarTablaIntensidad(doc, puntajes, x, y) {
    const etiquetas = ["INTENSIDAD", "D", "I", "S", "C", "SEGMENTO"];
    const anchos = [58, 58, 58, 58, 58, 65];
    let columnaX = x;
    etiquetas.forEach((etiqueta, indice) => {
        celda(doc, columnaX, y, anchos[indice], 20, etiqueta, { fondo: "#c7c7c7", negrita: true, tamano: 7, alineacion: "center" });
        columnaX += anchos[indice];
    });

    const intensidades = [28, 12, 7, 4, 0, -4, -7, -12, -28];
    intensidades.forEach((intensidad, fila) => {
        const filaY = y + 20 + fila * 18;
        celda(doc, x, filaY, anchos[0], 18, intensidad > 0 ? `+${intensidad}` : intensidad, { alineacion: "center", tamano: 7 });
        perfiles.forEach((perfil, indice) => {
            const seleccionado = Math.abs(puntajes[perfil] - intensidad) <= 2;
            celda(doc, x + anchos[0] + indice * anchos[1], filaY, anchos[1], 18, puntajes[perfil], { fondo: seleccionado ? "#c9f4f1" : "#ffffff", alineacion: "center", tamano: 7 });
        });
        celda(doc, x + 290, filaY, anchos[5], 18, segmentoDe(intensidad), { alineacion: "center", tamano: 7 });
    });

    doc.font("Helvetica-Bold").fontSize(8).text("Número de segmento / Patrón de Perfil Clásico", x, y + 190, { width: 355, align: "center" });
    perfiles.forEach((perfil, indice) => {
        celda(doc, x + 58 + indice * 58, y + 205, 58, 18, segmentoDe(puntajes[perfil]), { negrita: true, alineacion: "center", tamano: 8 });
    });
}