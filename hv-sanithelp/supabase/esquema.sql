-- Esquema de HV SanitHelp en Supabase. Ejecútalo una vez en SQL Editor (Supabase → SQL Editor → New query).

-- personas.json y respuestas.json: una fila por base. version permite escrituras condicionales.
create table if not exists public.documentos (
  nombre text primary key,
  datos jsonb not null,
  version integer not null default 1,
  actualizado_en timestamptz not null default now()
);

-- Sin políticas: solo el servidor (service_role) puede leer o escribir. La clave anónima no ve nada.
alter table public.documentos enable row level security;

-- Bucket privado para los PDF de respuesta (pdfs/<id>.pdf), hasta 50 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hv-sanithelp', 'hv-sanithelp', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
