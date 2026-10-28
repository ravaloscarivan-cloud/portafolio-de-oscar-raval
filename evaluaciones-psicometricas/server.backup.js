import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import db from "./database.js";
import "./generarPDF.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));


app.post("/api/cuestionarios", async (req, res) => {
    const { datos, respuestas } = req.body;

    try {
        if (!datos || !datos.nombre) {
            return res.status(400).json({
                ok: false,
                error: "El nombre del participante es obligatorio."
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
                    error: `La pregunta ${pregunta} no está completa o no suma 3.`
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

        const guardar = db.transaction(() => {
            const participante = db.prepare(`
                INSERT INTO participantes (
                    nombre,
                    edad,
                    sexo,
                    ciudad,
                    ocupacion,
                    empresa,
                    estudios
                )
                VALUES (
                    @nombre,
                    @edad,
                    @sexo,
                    @ciudad,
                    @ocupacion,
                    @empresa,
                    @estudios
                )
            `).run({
                nombre: String(datos.nombre).trim(),
                edad: datos.edad ? Number(datos.edad) : null,
                sexo: datos.sexo || null,
                ciudad: datos.ciudad || null,
                ocupacion: datos.ocupacion || null,
                empresa: datos.empresa || null,
                estudios: datos.estudios || null
            });

            const participanteId = participante.lastInsertRowid;

            const insertarRespuesta = db.prepare(`
                INSERT INTO respuestas (
                    participante_id,
                    pregunta,
                    puntos_a,
                    puntos_b,
                    tipo
                )
                VALUES (
                    @participante_id,
                    @pregunta,
                    @puntos_a,
                    @puntos_b,
                    @tipo
                )
            `);

            for (const respuesta of respuestasCompletas) {
                insertarRespuesta.run({
                    participante_id: participanteId,
                    pregunta: respuesta.pregunta,
                    puntos_a: respuesta.puntos_a,
                    puntos_b: respuesta.puntos_b,
                    tipo: respuesta.tipo
                });
            }

            return participanteId;
        });

        const participanteId = guardar();
        await import("./generarPDF.js?actualizar=" + Date.now());

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




