import { createClient } from '@supabase/supabase-js';

// Acceso a Supabase con la clave service_role: solo se usa en las funciones del servidor.
// Tablas en db/schema.sql; los archivos (PDF y soportes) van al bucket privado "privado".
const BUCKET = 'privado';
let client;

export function storageConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function db() {
  client ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Devuelve data o lanza el error de Supabase
export function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function putFile(path, body, contentType) {
  check(await db().storage.from(BUCKET).upload(path, body, { contentType, upsert: true }));
}

export async function getFile(path) {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function listFiles(folder) {
  const data = check(await db().storage.from(BUCKET).list(folder, { limit: 1000 }));
  return data.map((item) => `${folder}/${item.name}`);
}

export async function removeFiles(paths) {
  if (paths.length) check(await db().storage.from(BUCKET).remove(paths));
}
