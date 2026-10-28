export async function inicializarArchivoRespuestas(db) {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS archivos_respuestas (
            participante_id INTEGER NOT NULL,
            prueba TEXT NOT NULL CHECK (prueba IN ('VALANTI', 'DISC')),
            pdf_base64 TEXT NOT NULL,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (participante_id, prueba)
        )
    `);
}

export async function guardarArchivoRespuesta(db, participanteId, prueba, pdfBuffer) {
    await inicializarArchivoRespuestas(db);
    await db.execute({
        sql: `
            INSERT OR IGNORE INTO archivos_respuestas (participante_id, prueba, pdf_base64)
            VALUES (?, ?, ?)
        `,
        args: [Number(participanteId), prueba, pdfBuffer.toString("base64")]
    });
}

export async function obtenerArchivoRespuesta(db, participanteId, prueba) {
    await inicializarArchivoRespuestas(db);
    const result = await db.execute({
        sql: `
            SELECT pdf_base64
            FROM archivos_respuestas
            WHERE participante_id = ? AND prueba = ?
        `,
        args: [Number(participanteId), prueba]
    });

    return result.rows[0]
        ? Buffer.from(result.rows[0].pdf_base64, "base64")
        : null;
}