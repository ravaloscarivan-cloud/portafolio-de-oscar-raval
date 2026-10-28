import { neon } from '@neondatabase/serverless';

let sql;
let listo;

/** Conexión a Neon (PostgreSQL). Crea las tablas la primera vez que se usa en cada instancia. */
export async function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('Falta la variable de entorno DATABASE_URL');
  sql ??= neon(process.env.DATABASE_URL);
  listo ??= (async () => {
    // Asistencia a cada capacitación: un registro por correo, con la fecha de la capacitación
    await sql`
      CREATE TABLE IF NOT EXISTS asistencias (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        capacitacion_id TEXT NOT NULL,
        capacitacion    TEXT NOT NULL,
        nombre          TEXT NOT NULL,
        apellido        TEXT NOT NULL,
        correo          TEXT NOT NULL,
        firma           TEXT NOT NULL,
        registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS asistencias_registrado_idx ON asistencias (registrado_en DESC)`;
    await sql`ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS fecha DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date)`;
    await sql`ALTER TABLE asistencias DROP CONSTRAINT IF EXISTS asistencias_capacitacion_id_correo_key`;
    await sql`DROP INDEX IF EXISTS asistencias_correo_fecha_idx`;
    // Se excluyen las asistencias "general" registradas antes de que la asistencia fuera por capacitación
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS asistencias_capacitacion_correo_idx ON asistencias (capacitacion_id, correo) WHERE capacitacion_id <> 'general'`;

    // Respuestas del pre-test y post-test de cada capacitación (una de cada tipo por correo)
    await sql`
      CREATE TABLE IF NOT EXISTS evaluaciones (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        capacitacion_id TEXT NOT NULL,
        capacitacion    TEXT NOT NULL,
        tipo            TEXT NOT NULL CHECK (tipo IN ('pre', 'post')),
        nombre          TEXT NOT NULL,
        apellido        TEXT NOT NULL,
        correo          TEXT NOT NULL,
        respuestas      JSONB NOT NULL,
        correctas       INTEGER NOT NULL,
        total           INTEGER NOT NULL,
        puntaje         INTEGER NOT NULL,
        registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (capacitacion_id, correo, tipo)
      )`;
    await sql`CREATE INDEX IF NOT EXISTS evaluaciones_correo_idx ON evaluaciones (correo)`;
    await sql`ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS fecha DATE`;

    // Capacitaciones que el administrador ocultó o eliminó (no se muestran a los usuarios)
    await sql`CREATE TABLE IF NOT EXISTS capacitaciones_ocultas (id TEXT PRIMARY KEY, ocultada_en TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE capacitaciones_ocultas ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'oculta'`;
  })().catch((err) => {
    listo = undefined; // reintentar en la siguiente petición
    throw err;
  });
  await listo;
  return sql;
}
