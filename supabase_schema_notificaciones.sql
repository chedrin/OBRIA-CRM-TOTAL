-- =========================================================================
-- ObraMaster - Avisos en tiempo real, necesidades de obra y pedidos de material
-- =========================================================================
-- Qué crea este archivo:
--   suppliers             Proveedores habituales (a quién se piden materiales).
--   notifications         Avisos del panel (centro de notificaciones + tiempo real).
--   push_subscriptions    Dispositivos suscritos a notificaciones push (Web Push).
--   worksite_needs        Necesidades de obra: material, herramienta, maquinaria, bloqueos...
--   material_orders       Pedidos / solicitudes de presupuesto enviados a proveedores.
--   subcontractor_tokens  Enlaces mágicos para subcontratas (sin usuario ni contraseña).
--   site_reports          Partes enviados desde el enlace: "trabajo terminado", incidencias.
--   Bucket de Storage `obra-fotos` (privado) para las fotos que suben las subcontratas.
--
-- Requisitos: haber ejecutado antes `supabase_migration_seguridad.sql`
-- (crea `profiles` y la función `public.is_admin()`).
--
-- Cómo ejecutarlo:
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Se puede ejecutar más de una vez sin romper nada.
--
-- Seguridad:
--   - RLS activado en todas las tablas. Solo los administradores pueden leer o
--     escribir desde el navegador. El rol anónimo (anon) no tiene acceso.
--   - El enlace de la subcontrata NO toca la base de datos desde el navegador:
--     pasa por el servidor (backend/notificaciones.js), que valida el token y
--     escribe con la clave de servicio.
--   - Del token del enlace solo se guarda su huella SHA-256, nunca el token.
--   - Obras y subcontratas siguen viviendo en `app_records` (JSON), por eso aquí
--     se guardan sus ids como texto (`obra_id`, `subcontractor_id`) sin clave foránea.
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. PROVEEDORES
-- -------------------------------------------------------------------------
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  phone        text,
  contact_name text,
  categories   text[] not null default '{}',   -- p. ej. {fontaneria, electricidad, aridos}
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 2. NOTIFICACIONES
-- -------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  category     text not null default 'aviso'
               check (category in ('urgente', 'aviso', 'material', 'incidencia')),
  origin       text not null default 'sistema'
               check (origin in ('obrero', 'subcontrata', 'sistema', 'admin')),
  obra_id      text,
  obra_label   text,
  title        text not null,
  body         text,
  link         text,                -- ruta dentro de la app, p. ej. '#admin/necesidades/<id>'
  ref_table    text,                -- worksite_needs | material_orders | site_reports
  ref_id       uuid,
  recipient_id uuid references auth.users (id) on delete cascade,  -- null = todos los administradores
  read_at      timestamptz,
  read_by      uuid references auth.users (id) on delete set null
);

create index if not exists notifications_unread_idx on public.notifications (created_at desc) where read_at is null;
create index if not exists notifications_obra_idx on public.notifications (obra_id, created_at desc);

-- -------------------------------------------------------------------------
-- 3. SUSCRIPCIONES PUSH (una por navegador / móvil)
-- -------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  failures     integer not null default 0,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -------------------------------------------------------------------------
-- 4. ENLACES MÁGICOS DE SUBCONTRATAS
-- -------------------------------------------------------------------------
create table if not exists public.subcontractor_tokens (
  id                 uuid primary key default gen_random_uuid(),
  token_hash         text not null unique,      -- sha256 del token; el token solo va en la URL
  subcontractor_id   text,
  subcontractor_name text not null,
  phone              text,
  obra_id            text,
  obra_label         text,
  obra_address       text,
  task_ref           text,                      -- id de la fase o tarea dentro de la obra
  task_label         text,
  expires_at         timestamptz not null default (now() + interval '60 days'),
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  use_count          integer not null default 0,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists subcontractor_tokens_obra_idx on public.subcontractor_tokens (obra_id);

-- -------------------------------------------------------------------------
-- 5. NECESIDADES DE OBRA
-- -------------------------------------------------------------------------
create table if not exists public.worksite_needs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  obra_id            text,
  obra_label         text,
  tajo               text,
  category           text not null default 'material'
                     check (category in ('material', 'herramienta', 'maquinaria', 'bloqueo',
                                         'coordinacion', 'seguridad', 'otro')),
  urgency            text not null default 'normal' check (urgency in ('normal', 'urgente')),
  description        text not null,
  items              jsonb not null default '[]'::jsonb,   -- [{ "material": "...", "cantidad": 10, "unidad": "sacos" }]
  needed_by          date,
  status             text not null default 'nueva'
                     check (status in ('nueva', 'en_revision', 'pedido_tramitado', 'entregado',
                                       'resuelto', 'descartada')),
  reported_by_type   text not null default 'admin'
                     check (reported_by_type in ('obrero', 'encargado', 'subcontrata', 'admin')),
  reported_by_name   text,
  reported_by_user   uuid references auth.users (id) on delete set null,
  subcontractor_id   text,
  token_id           uuid references public.subcontractor_tokens (id) on delete set null,
  site_contact_name  text,
  site_contact_phone text,
  photos             jsonb not null default '[]'::jsonb    -- rutas dentro del bucket obra-fotos
);

create index if not exists worksite_needs_status_idx on public.worksite_needs (status, created_at desc);
create index if not exists worksite_needs_obra_idx on public.worksite_needs (obra_id);

-- -------------------------------------------------------------------------
-- 6. PEDIDOS A PROVEEDOR
-- -------------------------------------------------------------------------
create table if not exists public.material_orders (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  need_id             uuid references public.worksite_needs (id) on delete set null,
  supplier_id         uuid references public.suppliers (id) on delete set null,
  obra_id             text,
  kind                text not null default 'pedido' check (kind in ('pedido', 'solicitud_presupuesto')),
  status              text not null default 'borrador'
                      check (status in ('borrador', 'enviado', 'confirmado', 'entregado', 'cancelado', 'error')),
  to_email            text,
  cc_email            text,
  subject             text not null,
  body_html           text not null,
  body_text           text not null,
  items               jsonb not null default '[]'::jsonb,
  delivery_address    text,
  needed_by           date,
  site_contact_name   text,
  site_contact_phone  text,
  sent_at             timestamptz,
  sent_by             uuid references auth.users (id) on delete set null,
  provider_message_id text,
  error               text
);

create index if not exists material_orders_need_idx on public.material_orders (need_id);
create index if not exists material_orders_status_idx on public.material_orders (status, created_at desc);

-- -------------------------------------------------------------------------
-- 7. PARTES DESDE EL ENLACE (trabajo terminado / incidencia)
-- -------------------------------------------------------------------------
create table if not exists public.site_reports (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  token_id           uuid references public.subcontractor_tokens (id) on delete set null,
  subcontractor_id   text,
  subcontractor_name text,
  obra_id            text,
  obra_label         text,
  task_ref           text,
  task_label         text,
  kind               text not null default 'trabajo_terminado'
                     check (kind in ('trabajo_terminado', 'incidencia')),
  notes              text,
  photos             jsonb not null default '[]'::jsonb,
  reviewed_at        timestamptz,
  reviewed_by        uuid references auth.users (id) on delete set null,
  review_result      text check (review_result in ('aprobado', 'rechazado'))
);

create index if not exists site_reports_obra_idx on public.site_reports (obra_id, created_at desc);

-- -------------------------------------------------------------------------
-- 8. updated_at automático
-- -------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch before update on public.suppliers
for each row execute function public.touch_updated_at();

drop trigger if exists worksite_needs_touch on public.worksite_needs;
create trigger worksite_needs_touch before update on public.worksite_needs
for each row execute function public.touch_updated_at();

drop trigger if exists material_orders_touch on public.material_orders;
create trigger material_orders_touch before update on public.material_orders
for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------------------
-- 9. SEGURIDAD (RLS): solo administradores desde el navegador
-- -------------------------------------------------------------------------
alter table public.suppliers            enable row level security;
alter table public.notifications        enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.subcontractor_tokens enable row level security;
alter table public.worksite_needs       enable row level security;
alter table public.material_orders      enable row level security;
alter table public.site_reports         enable row level security;

revoke all on public.suppliers, public.notifications, public.push_subscriptions,
              public.subcontractor_tokens, public.worksite_needs, public.material_orders,
              public.site_reports
  from anon;

do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'worksite_needs', 'material_orders', 'site_reports', 'subcontractor_tokens']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- Avisos: los administradores ven los generales (recipient_id null) y los suyos;
-- cualquier usuario ve los dirigidos a él.
drop policy if exists notifications_leer on public.notifications;
create policy notifications_leer on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or (recipient_id is null and public.is_admin()));

drop policy if exists notifications_marcar_leida on public.notifications;
create policy notifications_marcar_leida on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid() or (recipient_id is null and public.is_admin()))
  with check (recipient_id = auth.uid() or (recipient_id is null and public.is_admin()));

-- Suscripciones push: cada usuario gestiona solo las suyas.
drop policy if exists push_subscriptions_propias on public.push_subscriptions;
create policy push_subscriptions_propias on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- 10. TIEMPO REAL: el panel abierto recibe los avisos al instante
-- -------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- -------------------------------------------------------------------------
-- 11. FOTOS: bucket privado (las sube el servidor; se ven con enlaces firmados)
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obra-fotos', 'obra-fotos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
