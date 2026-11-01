-- =========================================================================
-- ObraMaster - Histórico diario de cada obra
-- =========================================================================
-- Qué crea este archivo:
--   obra_eventos   Sucesos de la obra que no guardaba ninguna otra tabla:
--                  - apuntados a mano: llamadas del cliente, material utilizado,
--                    maquinaria, incidencias, partes diarios, notas;
--                  - registrados solos por la app: cambios de plazos, responsables
--                    de etapa, partidas y secciones del presupuesto, materiales.
--
-- El histórico que se ve en la obra junta esta tabla con lo que ya guardan
-- execution_logs (asignaciones, avance, certificación), worksite_needs (avisos y
-- necesidades), material_orders (pedidos a proveedor) y site_reports (partes de
-- subcontratas). No hace falta copiar nada: lo anterior aparece también.
--
-- Requisitos: haber ejecutado antes `supabase_migration_seguridad.sql`
-- (función public.is_admin()).
--
-- Cómo ejecutarlo:
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Se puede ejecutar más de una vez sin romper nada.
--
-- Seguridad: RLS activado; solo administradores desde el navegador. La app
-- escribe a través del servidor (backend/historialRoutes.js) con la clave de servicio.
-- =========================================================================

create extension if not exists "pgcrypto";

create table if not exists public.obra_eventos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  obra_id      text not null,                          -- id de la obra (app_records "obras")
  ocurrido_at  timestamptz not null default now(),     -- cuándo pasó (puede ser otro día del apunte)
  tipo         text not null check (tipo in (
                 'asignacion', 'avance', 'pedido', 'material', 'maquinaria', 'llamada',
                 'presupuesto', 'plazo', 'incidencia', 'parte', 'documento', 'nota')),
  origen       text not null default 'manual' check (origen in ('manual', 'auto')),
  titulo       text not null,
  detalle      text,
  datos        jsonb not null default '{}'::jsonb,     -- materiales [{concepto,cantidad,unidad}], horas, contacto, antes/después...
  fase_id      text,
  partida_id   text,
  autor_name   text,
  autor_user   uuid references auth.users (id) on delete set null,
  deleted_at   timestamptz                             -- borrado lógico (solo apuntes manuales)
);

create index if not exists obra_eventos_obra_idx on public.obra_eventos (obra_id, ocurrido_at desc) where deleted_at is null;
create index if not exists obra_eventos_tipo_idx on public.obra_eventos (obra_id, tipo) where deleted_at is null;

create or replace function public.obra_eventos_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists obra_eventos_touch on public.obra_eventos;
create trigger obra_eventos_touch before update on public.obra_eventos
  for each row execute function public.obra_eventos_touch();

alter table public.obra_eventos enable row level security;

drop policy if exists obra_eventos_admin on public.obra_eventos;
create policy obra_eventos_admin on public.obra_eventos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.obra_eventos from anon;
