import { preguntas16pf } from "../src/preguntas16pf.js";

export const totalPreguntas16pf = preguntas16pf.length;

export async function inicializarTabla16pf(db) {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pf16_respuestas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participante_id INTEGER NOT NULL,
            pregunta INTEGER NOT NULL,
            respuesta TEXT NOT NULL CHECK (respuesta IN ('A', 'B', 'C')),
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participante_id) REFERENCES participantes(id) ON DELETE CASCADE,
            UNIQUE(participante_id, pregunta)
        )
    `);
}
