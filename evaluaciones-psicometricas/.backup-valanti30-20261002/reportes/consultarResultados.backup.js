import db from "../database.js";

export function obtenerResultados() {
    const participantes = db.prepare(`
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
    `).all();

    const respuestas = db.prepare(`
        SELECT
            participante_id,
            pregunta,
            puntos_a,
            puntos_b,
            tipo,
            fecha_creacion
        FROM respuestas
        ORDER BY participante_id ASC, pregunta ASC
    `).all();

    return {
        participantes,
        respuestas
    };
}
