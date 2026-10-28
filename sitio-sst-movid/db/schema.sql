-- Esquema de datos del sitio SST MOVID en Supabase (Postgres).
-- Solo la API del sitio (clave service_role) accede: RLS activo y sin políticas públicas.

-- Postulaciones, hojas de vida (formato GH-FT-04) y envíos de HV y soportes
create table if not exists registros (
  id uuid primary key,
  kind text not null check (kind in ('postulacion', 'hoja-vida', 'soportes')),
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists registros_created_at on registros (created_at desc);

-- Envíos de soportes en curso (antes de subir todos los archivos)
create table if not exists soportes_pendientes (
  id uuid primary key,
  data jsonb not null,
  started_at timestamptz not null default now()
);

-- Avance del preguardado de la hoja de vida (una fila por borrador; id generado en el navegador)
create table if not exists hv_avance (
  id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists hv_avance_updated_at on hv_avance (updated_at desc);

-- Votaciones: configuración única, padrón, marca de "ya votó" y urna anónima
create table if not exists vot_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists vot_padron (
  id text primary key,          -- hash(salt:cédula)
  nombre text not null,
  cargo text not null default '',
  pin text not null
);
create table if not exists vot_votos (
  pid text not null,
  comite text not null,
  primary key (pid, comite)     -- impide votar dos veces en el mismo comité
);
create table if not exists vot_urna (
  id uuid primary key default gen_random_uuid(),
  comite text not null,
  p text not null,              -- ids de principal separados por "." o "blanco"
  s text not null               -- ids de suplente separados por "." o "blanco" o "-"
);

-- Alertas del admin: fecha en que marcó las novedades como vistas (fila única, id = 1)
create table if not exists admin_estado (
  id int primary key default 1 check (id = 1),
  visto_at timestamptz,
  updated_at timestamptz not null default now()
);
-- Notificaciones que el admin eliminó del panel: { clave: fecha del aviso }. Si la misma persona vuelve a tener actividad, reaparece.
alter table admin_estado add column if not exists ocultas jsonb not null default '{}';

-- Visitantes del sitio: una fila por dispositivo (navegador) con su sección y acción más recientes.
-- El nombre se completa cuando la persona lo escribe en su HV o envía una postulación, HV o soportes.
create table if not exists visitas (
  sesion text primary key,
  vista text not null,
  tipo text not null check (tipo in ('entra', 'llena')),
  nombre text not null default '',
  entro_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visitas_updated_at on visitas (updated_at desc);

-- Inducción terminada (una fila por documento) y envío del manual al completar HV, soportes e inducción
create table if not exists induccion (
  documento text primary key,
  nombre text not null,
  email text not null default '',
  data jsonb not null default '{}',
  completed_at timestamptz not null default now(),
  manual_enviado_at timestamptz,
  manual_email text
);

alter table registros enable row level security;
alter table soportes_pendientes enable row level security;
alter table hv_avance enable row level security;
alter table vot_config enable row level security;
alter table vot_padron enable row level security;
alter table vot_votos enable row level security;
alter table vot_urna enable row level security;
alter table admin_estado enable row level security;
alter table visitas enable row level security;
alter table induccion enable row level security;
