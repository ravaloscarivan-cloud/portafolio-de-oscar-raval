import { timingSafeEqual } from "node:crypto";
import { createClient } from "@libsql/client";
import { generarPDFResultados } from "../reportes/generarPDFResultados.js";
import { generarPDFDisc } from "../reportes/generarPDFDisc.js";
import {
    guardarArchivoRespuesta,
    inicializarArchivoRespuestas,
    obtenerArchivoRespuesta
} from "../reportes/archivosRespuestas.js";
import { generarPDF16pf } from "../reportes/generarPDF16pf.js";
import { inicializarTabla16pf } from "../reportes/tabla16pf.js";

const db = process.env.TURSO_DATABASE_URL
    ? createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    })
    : null;

const tablasPorPrueba = {
    VALANTI: "respuestas",
    DISC: "disc_respuestas",
    "16PF": "pf16_respuestas"
};

function claveValida(claveRecibida, claveConfigurada) {
    if (typeof claveRecibida !== "string" || !claveRecibida || !claveConfigurada) {
        return false;
    }

    const recibida = Buffer.from(claveRecibida);
    const configurada = Buffer.from(claveConfigurada);

    return recibida.length === configurada.length && timingSafeEqual(recibida, configurada);
}

async function inicializarRespuestas(db) {
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
    await inicializarArchivoRespuestas(db);
    await inicializarTabla16pf(db);
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Método no permitido." });
    }

    if (!process.env.RESPUESTAS_CLAVE) {
        return res.status(503).json({ ok: false, error: "El acceso a respuestas no está configurado." });
    }

    const claveRecibida = req.headers["x-respuestas-clave"];
    if (!claveValida(claveRecibida, process.env.RESPUESTAS_CLAVE)) {
        return res.status(401).json({ ok: false, error: "La clave es incorrecta." });
    }

    if (!db) {
        return res.status(503).json({ ok: false, error: "La base de datos no está configurada." });
    }

    try {
        await inicializarRespuestas(db);

        const { participante_id: participanteId, prueba, accion } = req.body || {};

        if (participanteId === undefined) {
            const result = await db.execute(`
                SELECT participante_id, nombre, fecha_creacion, prueba
                FROM (
                    SELECT a.participante_id, COALESCE(p.nombre, 'Participante #' || a.participante_id) AS nombre, a.fecha_creacion, a.prueba
                    FROM archivos_respuestas a
                    LEFT JOIN participantes p ON p.id = a.participante_id
                    UNION ALL
                    SELECT p.id AS participante_id, p.nombre, p.fecha_creacion, 'VALANTI' AS prueba
                    FROM participantes p
                    WHERE EXISTS (
                        SELECT 1 FROM respuestas r WHERE r.participante_id = p.id
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM archivos_respuestas a
                        WHERE a.participante_id = p.id AND a.prueba = 'VALANTI'
                    )
                    UNION ALL
                    SELECT p.id AS participante_id, p.nombre, p.fecha_creacion, 'DISC' AS prueba
                    FROM participantes p
                    WHERE EXISTS (
                        SELECT 1 FROM disc_respuestas d WHERE d.participante_id = p.id
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM archivos_respuestas a
                        WHERE a.participante_id = p.id AND a.prueba = 'DISC'
                    )
                    UNION ALL
                    SELECT p.id AS participante_id, p.nombre, p.fecha_creacion, '16PF' AS prueba
                    FROM participantes p
                    WHERE EXISTS (
                        SELECT 1 FROM pf16_respuestas f WHERE f.participante_id = p.id
                    )
                )
                ORDER BY fecha_creacion DESC, participante_id DESC
            `);

            return res.status(200).json({
                ok: true,
                respuestas: result.rows.map((row) => ({
                    participante_id: Number(row.participante_id),
                    nombre: row.nombre,
                    fecha_creacion: row.fecha_creacion,
                    prueba: row.prueba
                }))
            });
        }

        const id = Number(participanteId);
        const tipoPrueba = String(prueba || "").toUpperCase();
        if (!Number.isSafeInteger(id) || id < 1 || !["VALANTI", "DISC", "16PF"].includes(tipoPrueba)) {
            return res.status(400).json({ ok: false, error: "Participante o prueba no válidos." });
        }

        if (accion === "borrar") {
            // Borra solo la prueba indicada; el participante se elimina si ya no le quedan otras pruebas
            const tablaPrueba = tablasPorPrueba[tipoPrueba];
            await db.batch([
                { sql: `DELETE FROM ${tablaPrueba} WHERE participante_id = ?`, args: [id] },
                { sql: "DELETE FROM archivos_respuestas WHERE participante_id = ? AND prueba = ?", args: [id, tipoPrueba] },
                {
                    sql: `
                        DELETE FROM participantes
                        WHERE id = ?
                        AND NOT EXISTS (SELECT 1 FROM respuestas WHERE participante_id = ?)
                        AND NOT EXISTS (SELECT 1 FROM disc_respuestas WHERE participante_id = ?)
                        AND NOT EXISTS (SELECT 1 FROM pf16_respuestas WHERE participante_id = ?)
                        AND NOT EXISTS (SELECT 1 FROM archivos_respuestas WHERE participante_id = ?)
                    `,
                    args: [id, id, id, id, id]
                }
            ], "write");
            return res.status(200).json({ ok: true, mensaje: "Prueba borrada correctamente." });
        }

        if (tipoPrueba === "16PF") {
            const existe16pf = await db.execute({
                sql: "SELECT 1 AS existe FROM pf16_respuestas WHERE participante_id = ? LIMIT 1",
                args: [id]
            });
            if (!existe16pf.rows.length) {
                return res.status(404).json({ ok: false, error: "No se encontró esa prueba." });
            }

            const pdf16pf = await generarPDF16pf(db, id);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="respuesta-16pf-${id}.pdf"`);
            res.setHeader("Cache-Control", "private, no-store");
            return res.status(200).send(pdf16pf);
        }

        if (tipoPrueba === "VALANTI") {
            // Se genera al momento para que los registros antiguos usen la calificación corregida de 30 preguntas
            const existeValanti = await db.execute({
                sql: "SELECT 1 AS existe FROM respuestas WHERE participante_id = ? LIMIT 1",
                args: [id]
            });
            if (!existeValanti.rows.length) {
                return res.status(404).json({ ok: false, error: "No se encontró esa prueba." });
            }

            const pdfValanti = await generarPDFResultados(db, id);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="respuesta-valanti-${id}.pdf"`);
            res.setHeader("Cache-Control", "private, no-store");
            return res.status(200).send(pdfValanti);
        }

        let pdfBuffer = await obtenerArchivoRespuesta(db, id, tipoPrueba);
        if (pdfBuffer) {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="respuesta-${tipoPrueba.toLowerCase()}-${id}.pdf"`);
            res.setHeader("Cache-Control", "private, no-store");
            return res.status(200).send(pdfBuffer);
        }

        const tablaRespuestas = tipoPrueba === "DISC" ? "disc_respuestas" : "respuestas";
        const existe = await db.execute({
            sql: `SELECT 1 AS existe FROM ${tablaRespuestas} WHERE participante_id = ? LIMIT 1`,
            args: [id]
        });
        if (!existe.rows.length) {
            return res.status(404).json({ ok: false, error: "No se encontró esa prueba." });
        }

        pdfBuffer = tipoPrueba === "DISC"
            ? await generarPDFDisc(db, id)
            : await generarPDFResultados(db, id);
        await guardarArchivoRespuesta(db, id, tipoPrueba, pdfBuffer);
        pdfBuffer = await obtenerArchivoRespuesta(db, id, tipoPrueba);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="respuesta-${tipoPrueba.toLowerCase()}-${id}.pdf"`);
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(200).send(pdfBuffer);
    } catch (error) {
        console.error("Error consultando respuestas archivadas:", error);
        return res.status(500).json({ ok: false, error: "No se pudieron consultar las respuestas." });
    }
}