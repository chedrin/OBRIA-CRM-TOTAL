-- =========================================================================
-- ObraMaster - Asignación operativa y seguimiento del avance por fase y partida
-- =========================================================================
-- Qué crea o cambia este archivo:
--   work_assignments     Quién ejecuta cada fase o partida (obrero propio o subcontrata).
--   work_item_progress   Estado actual de cada partida: avance reportado y avance certificado.
--   execution_logs       Histórico: quién cambió el avance o el estado, cuándo, notas y fotos.
--   worksite_needs, site_reports, notifications: nuevas columnas fase_id / partida_id
--   para que los avisos de subcontratas y obreros queden ligados a su partida.
--   subcontractor_tokens: fase_id / partida_id / assignment_id (enlace por asignación).
--
-- Requisitos: haber ejecutado antes `supabase_migration_seguridad.sql` y
-- `supabase_schema_notificaciones.sql`.
--
-- Cómo ejecutarlo:
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Se puede ejecutar más de una vez sin romper nada.
--
-- Modelo:
--   Las fases y partidas siguen dentro de la obra (`app_records`, colección "obras":
--   obra.fases[] y fase.tareas[], generadas desde el presupuesto firmado). Aquí se
--   guardan sus ids como texto, sin clave foránea, igual que en las tablas de avisos.
--   `partida_id = ''` significa "la fase entera" (asignación de fase o fase sin partidas).
--
-- Seguridad:
--   RLS activado; solo administradores desde el navegador. Obreros y subcontratas
--   reportan a través del servidor (backend/avanceRoutes.js), que comprueba que la
--   partida les está asignada y escribe con la clave de servicio.
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. ASIGNACIONES (polimórfica: obrero interno o subcontrata)
-- -------------------------------------------------------------------------
create table if not exists public.work_assignments (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  obra_id            text not null,
  fase_id            text not null,
  partida_id         text not null default '',          -- '' = fase completa (se hereda en sus partidas)
  assignee_type      text not null check (assignee_type in ('obrero_interno', 'subcontrata')),
  obrero_id          text,                              -- ficha de obrero (profiles.obrero_id)
  subcontractor_id   text,                              -- ficha de subcontrata (app_records "subcontractors")
  assignee_name      text not null,
  start_date         date,
  end_date           date,
  planned_rate       numeric(12, 3),                    -- rendimiento previsto (unidades de la partida por día)
  notes              text,                              -- notas del encargado
  is_lead            boolean not null default true,     -- responsable visible de la fase/partida
  is_active          boolean not null default true,
  created_by         uuid references auth.users (id) on delete set null,
  constraint work_assignments_target check (
    (assignee_type = 'obrero_interno' and obrero_id is not null)
    or (assignee_type = 'subcontrata' and (subcontractor_id is not null or assignee_name <> ''))
  ),
  constraint work_assignments_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists work_assignments_obra_idx on public.work_assignments (obra_id, fase_id, partida_id) where is_active;
create index if not exists work_assignments_obrero_idx on public.work_assignments (obrero_id) where is_active;
create index if not exists work_assignments_sub_idx on public.work_assignments (subcontractor_id) where is_active;
-- El mismo ejecutor no se asigna dos veces a la misma fase o partida.
create unique index if not exists work_assignments_unico on public.work_assignments
  (obra_id, fase_id, partida_id, assignee_type, coalesce(obrero_id, subcontractor_id, lower(assignee_name)))
  where is_active;

-- -------------------------------------------------------------------------
-- 2. ESTADO ACTUAL DE CADA PARTIDA (reportado frente a certificado)
-- -------------------------------------------------------------------------
create table if not exists public.work_item_progress (
  obra_id                 text not null,
  fase_id                 text not null,
  partida_id              text not null default '',
  status                  text not null default 'no_iniciada'
                          check (status in ('no_iniciada', 'en_curso', 'bloqueada', 'completada')),
  reported_pct            integer not null default 0 check (reported_pct between 0 and 100),
  executed_qty            numeric(14, 3),                -- medición ejecutada (opcional)
  reported_at             timestamptz,
  reported_by_type        text check (reported_by_type in ('obrero', 'subcontrata', 'encargado', 'admin')),
  reported_by_name        text,
  ready_for_certification boolean not null default false,
  certified_pct           integer not null default 0 check (certified_pct between 0 and 100),
  certified_at            timestamptz,
  certified_by            uuid references auth.users (id) on delete set null,
  certified_by_name       text,
  alert                   text check (alert in ('bloqueo', 'material', 'incidencia')),
  alert_need_id           uuid references public.worksite_needs (id) on delete set null,
  alert_text              text,
  updated_at              timestamptz not null default now(),
  primary key (obra_id, fase_id, partida_id)
);

create index if not exists work_item_progress_alert_idx on public.work_item_progress (obra_id) where alert is not null;

-- -------------------------------------------------------------------------
-- 3. HISTÓRICO DE EJECUCIÓN (cada cambio de avance, estado o validación)
-- -------------------------------------------------------------------------
create table if not exists public.execution_logs (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  obra_id          text not null,
  fase_id          text not null,
  partida_id       text not null default '',
  kind             text not null default 'avance'
                   check (kind in ('avance', 'listo_certificacion', 'certificacion', 'bloqueo', 'desbloqueo', 'asignacion')),
  status           text,
  pct_before       integer,
  pct_after        integer,
  executed_qty     numeric(14, 3),
  notes            text,
  photos           jsonb not null default '[]'::jsonb,    -- rutas dentro del bucket obra-fotos
  author_type      text not null check (author_type in ('obrero', 'subcontrata', 'encargado', 'admin', 'sistema')),
  author_name      text,
  author_user      uuid references auth.users (id) on delete set null,
  token_id         uuid references public.subcontractor_tokens (id) on delete set null,
  assignment_id    uuid references public.work_assignments (id) on delete set null,
  need_id          uuid references public.worksite_needs (id) on delete set null
);

create index if not exists execution_logs_partida_idx on public.execution_logs (obra_id, fase_id, partida_id, created_at desc);
create index if not exists execution_logs_obra_idx on public.execution_logs (obra_id, created_at desc);

-- -------------------------------------------------------------------------
-- 4. AVISOS LIGADOS A FASE Y PARTIDA
-- -------------------------------------------------------------------------
alter table public.worksite_needs add column if not exists fase_id text;
alter table public.worksite_needs add column if not exists fase_label text;
alter table public.worksite_needs add column if not exists partida_id text;
alter table public.worksite_needs add column if not exists partida_label text;
create index if not exists worksite_needs_partida_idx on public.worksite_needs (obra_id, fase_id, partida_id);

alter table public.site_reports add column if not exists fase_id text;
alter table public.site_reports add column if not exists partida_id text;

-- Enlace mágico creado al asignar una fase o partida a una subcontrata.
alter table public.subcontractor_tokens add column if not exists fase_id text;
alter table public.subcontractor_tokens add column if not exists partida_id text;
alter table public.subcontractor_tokens add column if not exists assignment_id uuid references public.work_assignments (id) on delete set null;
create index if not exists subcontractor_tokens_assignment_idx on public.subcontractor_tokens (assignment_id);

alter table public.notifications add column if not exists fase_id text;
alter table public.notifications add column if not exists partida_id text;

-- -------------------------------------------------------------------------
-- 5. updated_at automático
-- -------------------------------------------------------------------------
drop trigger if exists work_assignments_touch on public.work_assignments;
create trigger work_assignments_touch before update on public.work_assignments
for each row execute function public.touch_updated_at();

drop trigger if exists work_item_progress_touch on public.work_item_progress;
create trigger work_item_progress_touch before update on public.work_item_progress
for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------------------
-- 6. SEGURIDAD (RLS): solo administradores desde el navegador
-- -------------------------------------------------------------------------
alter table public.work_assignments   enable row level security;
alter table public.work_item_progress enable row level security;
alter table public.execution_logs     enable row level security;

revoke all on public.work_assignments, public.work_item_progress, public.execution_logs from anon;

do $$
declare
  t text;
begin
  foreach t in array array['work_assignments', 'work_item_progress', 'execution_logs']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- 7. TIEMPO REAL: el panel del jefe de obra se actualiza al instante
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['work_item_progress', 'execution_logs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
