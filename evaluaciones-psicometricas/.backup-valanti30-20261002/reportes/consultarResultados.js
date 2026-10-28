import db from "../database-online.js";

export async function obtenerResultados() {
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

    return {
        participantes: participantesResult.rows,
        respuestas: respuestasResult.rows
    };
}
