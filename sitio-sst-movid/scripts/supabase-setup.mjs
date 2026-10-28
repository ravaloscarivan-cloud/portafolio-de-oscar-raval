// Monta Supabase para el sitio: tablas (db/schema.sql), bucket privado y, opcionalmente, datos iniciales.
// Uso: node --env-file=.env.local scripts/supabase-setup.mjs [--postulaciones archivo.json] [--votaciones archivo.json]
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { check, db, putFile } from '../lib/db.js';
import { createSubmissionPdf } from '../lib/submission.js';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL']) {
  if (!process.env[key]) throw new Error(`Falta ${key} en .env.local`);
}

// 1. Tablas
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('Tablas listas');

// 2. Bucket privado para PDF y soportes
const { data: buckets } = await db().storage.listBuckets();
if (!buckets?.some((bucket) => bucket.name === 'privado')) {
  check(await db().storage.createBucket('privado', { public: false, fileSizeLimit: '5MB' }));
}
console.log('Bucket "privado" listo');

// 3. Postulaciones recuperadas (se regenera su PDF con el diseño actual)
const postulaciones = arg('--postulaciones');
if (postulaciones) {
  for (const record of JSON.parse(fs.readFileSync(postulaciones, 'utf8'))) {
    await putFile(`submissions/${record.id}.pdf`, await createSubmissionPdf(record), 'application/pdf');
    check(await db().from('registros').upsert({ id: record.id, kind: 'postulacion', created_at: record.consentAcceptedAt, data: record }));
    console.log('Postulación recuperada:', record.name);
  }
}

// 4. Configuración de Votaciones (candidatos, fecha, lugar y jurados); el padrón empieza vacío
const votaciones = arg('--votaciones');
if (votaciones) {
  const { cfg } = JSON.parse(fs.readFileSync(votaciones, 'utf8'));
  check(await db().from('vot_config').upsert({ id: 1, data: { ...cfg, salt: randomBytes(9).toString('hex') } }));
  console.log('Configuración de Votaciones recuperada');
}
