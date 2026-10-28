import db from "./database-online.js";

export async function guardarCuestionarioOnline(datos, respuestas) {
    const resultado = await db.execute({
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

    const participanteId = Number(resultado.lastInsertRowid);

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

    return participanteId;
}
