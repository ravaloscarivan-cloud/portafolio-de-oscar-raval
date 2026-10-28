import Database from "better-sqlite3";

const db = new Database("valanti.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
    );

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
    );

    CREATE TABLE IF NOT EXISTS disc_respuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participante_id INTEGER NOT NULL,
        grupo INTEGER NOT NULL,
        mas TEXT NOT NULL,
        menos TEXT NOT NULL,
        mas_indice INTEGER NOT NULL,
        menos_indice INTEGER NOT NULL,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participante_id)
            REFERENCES participantes(id)
            ON DELETE CASCADE,
        UNIQUE(participante_id, grupo)
    );
`);

console.log("Base de datos VALANTI preparada correctamente.");

export default db;
