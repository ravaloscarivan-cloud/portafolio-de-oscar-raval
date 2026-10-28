import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./database.js";
import { enviarPDFPorCorreo, enviarDISCPorCorreo } from "./enviarPDF.js";
import { generarPDFDisc } from "./reportes/generarPDFDisc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/cuestionarios", async (req, res) => {
    const { datos, respuestas, prueba, respuestasDisc } = req.body;

    try {
        if (!datos || !datos.nombre) {
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

            const guardarDisc = db.transaction(() => {
                const participante = db.prepare(`
                    INSERT INTO participantes (nombre, edad, sexo, ciudad, ocupacion, empresa, estudios)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(String(datos.nombre).trim(), datos.edad ? Number(datos.edad) : null, datos.sexo || null, datos.ciudad || null, datos.ocupacion || null, datos.empresa || null, datos.estudios || null);
                const participanteId = Number(participante.lastInsertRowid);
                const insertar = db.prepare(`
                    INSERT INTO disc_respuestas (participante_id, grupo, mas, menos, mas_indice, menos_indice)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                for (let grupo = 0; grupo < 28; grupo++) {
                    insertar.run(participanteId, grupo + 1, grupos[grupo].mas, grupos[grupo].menos, Number(grupos[grupo].mas_indice ?? 0), Number(grupos[grupo].menos_indice ?? 0));
                }
                return participanteId;
            });

            const participanteId = guardarDisc();
            const adaptadorDb = {
                execute: async (consulta) => {
                    const sql = typeof consulta === "string" ? consulta : consulta.sql;
                    const args = typeof consulta === "string" ? [] : consulta.args || [];
                    return { rows: db.prepare(sql).all(...args) };
                }
            };
            const pdf = await generarPDFDisc(adaptadorDb);
            const archivoDisc = path.join(__dirname, "reportes", "disc_resultados.pdf");
            fs.writeFileSync(archivoDisc, pdf);
            await enviarDISCPorCorreo(archivoDisc, participanteId, datos.nombre);

            return res.status(201).json({
                ok: true,
                participante_id: participanteId,
                prueba: "DISC",
                mensaje: "Prueba DISC guardada correctamente."
            });
        }

        if (!respuestas || typeof respuestas !== "object") {
            return res.status(400).json({
                ok: false,
                error: "No se recibieron las respuestas."
            });
        }

        const respuestasCompletas = [];

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
                    error: `La pregunta ${pregunta} no estÃ¡ completa o no suma 3.`
                });
            }

            respuestasCompletas.push({
                pregunta,
                puntos_a: Number(respuesta.a),
                puntos_b: Number(respuesta.b),
                tipo: pregunta <= 9
                    ? "importancia_personal"
                    : "frases_inaceptables"
            });
        }

        const { guardarCuestionarioOnline } = await import("./guardarCuestionarioOnline.js");
        const { obtenerResultados } = await import("./reportes/consultarResultados.js");
        const participanteId = await guardarCuestionarioOnline(datos, respuestas);

        const resultados = await obtenerResultados();

        fs.writeFileSync(
            path.join(__dirname, "reportes", "resultados.json"),
            JSON.stringify(resultados, null, 2),
            "utf8"
        );

        console.log("Iniciando generación del PDF para el registro #" + participanteId);
        const moduloPDF = await import("./generarPDF.js?actualizar=" + Date.now());
        const archivoPDF = moduloPDF.default;

        console.log("PDF generado:", archivoPDF);
        console.log("Iniciando envío del PDF por correo...");

        await enviarPDFPorCorreo(
            archivoPDF,
            participanteId,
            datos.nombre
        );

        console.log("Proceso de correo terminado correctamente.");

        res.status(201).json({
            ok: true,
            participante_id: participanteId,
            mensaje: "Cuestionario guardado correctamente."
        });

    } catch (error) {
        console.error("Error guardando cuestionario:", error);

        res.status(500).json({
            ok: false,
            error: "No se pudo guardar el cuestionario."
        });
    }
});

app.get("/api/estado", (req, res) => {
    try {
        const participantes = db
            .prepare("SELECT COUNT(*) AS total FROM participantes")
            .get();

        const respuestas = db
            .prepare("SELECT COUNT(*) AS total FROM respuestas")
            .get();

        res.json({
            ok: true,
            participantes: participantes.total,
            respuestas: respuestas.total
        });
    } catch (error) {
        console.error("Error consultando la base de datos:", error);

        res.status(500).json({
            ok: false,
            error: "No se pudo consultar la base de datos."
        });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`VALANTI funcionando en http://localhost:${PORT}`);
});








