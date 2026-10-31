-- =========================================================================
-- ObraMaster - Documentación de subcontratas (CAE / PRL) y control por obra
-- =========================================================================
-- Qué crea:
--   subcontractor_documents        Documentos de la ficha de cada subcontrata: seguro RC,
--                                  certificados de Hacienda y Seguridad Social, REA,
--                                  formación y aptitud médica de sus trabajadores,
--                                  adhesión al plan de seguridad de una obra... con su
--                                  fecha de caducidad y el archivo (PDF o foto).
--   subcontract_doc_requirements   Por obra: qué documentos se exigen y qué subcontratas
--                                  se controlan además de las asignadas.
--   Bucket `subcontrata-docs` (privado), el mismo que usan los presupuestos y facturas
--   de subcontrata. Los archivos de la ficha van en la carpeta fichas/<subcontrata>/.
--
-- Requisitos: haber ejecutado antes `supabase_migration_seguridad.sql` (función is_admin).
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Se puede ejecutar más de una vez.
--
-- Seguridad: RLS activado, solo administradores desde el navegador. La app sube y lee
-- los archivos a través del servidor (backend/subcontratasDocsRoutes.js).
-- =========================================================================

create table if not exists public.subcontractor_documents (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  subcontractor_id   text not null,                     -- id de la ficha (app_records, colección subcontractors)
  doc_type           text not null,                     -- ver DOC_TYPES en src/utils/documentacionSubcontratas.js
  obra_id            text not null default '',          -- '' = vale para todas las obras
  titulo             text,
  trabajador         text,                              -- para formación, aptitud médica, EPIs...
  fecha_emision      date,
  fecha_caducidad    date,                              -- null = no caduca
  file_path          text,                              -- ruta dentro del bucket subcontrata-docs
  file_name          text,
  file_mime          text,
  notes              text,
  is_active          boolean not null default true,
  created_by         uuid references auth.users (id) on delete set null
);

create index if not exists subcontractor_documents_sub_idx
  on public.subcontractor_documents (subcontractor_id, doc_type) where is_active;
create index if not exists subcontractor_documents_caducidad_idx
  on public.subcontractor_documents (fecha_caducidad) where is_active;

alter table public.subcontractor_documents enable row level security;

drop policy if exists "subcontractor_documents_admin" on public.subcontractor_documents;
create policy "subcontractor_documents_admin" on public.subcontractor_documents
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.subcontract_doc_requirements (
  obra_id            text primary key,
  doc_types          text[] not null default '{}',      -- documentos exigidos en la obra
  subcontractor_ids  text[] not null default '{}',      -- subcontratas añadidas a mano
  excluded_ids       text[] not null default '{}',      -- subcontratas que no se controlan aquí
  updated_at         timestamptz not null default now()
);

alter table public.subcontract_doc_requirements enable row level security;

drop policy if exists "subcontract_doc_requirements_admin" on public.subcontract_doc_requirements;
create policy "subcontract_doc_requirements_admin" on public.subcontract_doc_requirements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Bucket privado: PDF e imágenes hasta 15 MB (si ya existe, se deja igual de privado).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('subcontrata-docs', 'subcontrata-docs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
