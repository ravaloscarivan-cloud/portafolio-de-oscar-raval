import { createClient } from "@libsql/client";

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

await db.batch([
    {
        sql: `
            CREATE TABLE IF NOT EXISTS participantes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                edad INTEGER,
                sexo TEXT,
                ciudad TEXT,
                ocupacion TEXT,
                empresa TEXT,
                estudios TEXT,
                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `
    },
    {
        sql: `
            CREATE TABLE IF NOT EXISTS respuestas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                participante_id INTEGER NOT NULL,
                pregunta INTEGER NOT NULL,
                puntos_a INTEGER NOT NULL,
                puntos_b INTEGER NOT NULL,
                tipo TEXT NOT NULL,
                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (participante_id)
                    REFERENCES participantes(id)
                    ON DELETE CASCADE,
                UNIQUE(participante_id, pregunta)
            )
        `
    }
]);

console.log("Tablas VALANTI creadas correctamente en Turso.");
