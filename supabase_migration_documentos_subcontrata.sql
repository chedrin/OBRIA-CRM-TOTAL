-- =========================================================================
-- ObraMaster - Presupuesto y factura de la subcontrata por fase o partida
-- =========================================================================
-- Qué crea:
--   subcontract_documents   Presupuestos y facturas de las subcontratas ligados a
--                           una fase (partida_id = '') o a una partida de la obra,
--                           con su importe y el archivo (PDF o foto).
--   Bucket `subcontrata-docs` (privado) para los archivos.
--
-- Con estos importes la app calcula el beneficio o la pérdida de cada fase y
-- partida: lo que cobramos al cliente (importe del presupuesto firmado) menos
-- lo que nos cuesta la subcontrata (factura si la hay; si no, su presupuesto).
--
-- Requisitos: haber ejecutado antes `supabase_schema_avance_obra.sql`.
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Se puede ejecutar más de una vez.
--
-- Seguridad: RLS activado, solo administradores desde el navegador. La app
-- sube y lee los archivos a través del servidor (backend/avanceRoutes.js).
-- =========================================================================

create table if not exists public.subcontract_documents (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  obra_id            text not null,
  fase_id            text not null,
  partida_id         text not null default '',          -- '' = fase completa
  assignment_id      uuid references public.work_assignments (id) on delete set null,
  subcontractor_id   text,
  subcontractor_name text not null default '',
  kind               text not null check (kind in ('presupuesto', 'factura')),
  numero             text,
  fecha              date,
  base_amount        numeric(14, 2) not null default 0 check (base_amount >= 0),  -- base imponible (sin IVA)
  iva_pct            numeric(5, 2) not null default 21 check (iva_pct between 0 and 100),
  total_amount       numeric(14, 2),                    -- con IVA
  file_path          text,                              -- ruta dentro del bucket subcontrata-docs
  file_name          text,
  file_mime          text,
  notes              text,
  is_active          boolean not null default true,
  created_by         uuid references auth.users (id) on delete set null
);

create index if not exists subcontract_documents_obra_idx
  on public.subcontract_documents (obra_id, fase_id, partida_id) where is_active;

alter table public.subcontract_documents enable row level security;

drop policy if exists "subcontract_documents_admin" on public.subcontract_documents;
create policy "subcontract_documents_admin" on public.subcontract_documents
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- El historial admite el nuevo tipo de cambio "documento".
alter table public.execution_logs drop constraint if exists execution_logs_kind_check;
alter table public.execution_logs add constraint execution_logs_kind_check
  check (kind in ('avance', 'listo_certificacion', 'certificacion', 'bloqueo', 'desbloqueo', 'asignacion', 'documento'));

-- Bucket privado: PDF e imágenes hasta 15 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('subcontrata-docs', 'subcontrata-docs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
