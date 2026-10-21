-- =========================================================================
-- OBRAMASTER - MEMORIA DE LA IA
--
-- Crea las tablas donde la IA guarda lo que debe recordar siempre:
--   * ai_instructions: tus órdenes permanentes (Ajustes > Memoria de la IA).
--   * ai_corrections:  lo que la IA propuso frente a lo que dejaste al final.
--
-- Requiere haber ejecutado antes supabase_migration_seguridad.sql (usa is_admin()).
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Solo el servidor (clave service_role) lee y escribe estas tablas. El navegador
-- no tiene acceso directo: por eso no hay políticas para anon ni authenticated.
-- =========================================================================

create extension if not exists "pgcrypto";

create table if not exists public.ai_instructions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  content    text not null,
  scope      text not null default 'all' check (scope in ('all', 'texto', 'presupuesto')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_corrections (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'texto' check (kind in ('texto', 'presupuesto')),
  context    text,
  original   text,
  ai_output  text,
  final_text text,
  accepted   boolean,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists ai_instructions_scope_idx on public.ai_instructions (scope, is_active);
create index if not exists ai_corrections_kind_idx on public.ai_corrections (kind, created_at desc);

alter table public.ai_instructions enable row level security;
alter table public.ai_corrections enable row level security;

revoke all on public.ai_instructions from anon, authenticated;
revoke all on public.ai_corrections from anon, authenticated;
