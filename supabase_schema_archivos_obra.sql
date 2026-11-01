-- =========================================================================
-- ObraMaster - Archivos de obra en Supabase Storage (fotos, planos, LiDAR...)
--
-- Ejecutar en Supabase > SQL Editor. Se puede volver a ejecutar sin perder nada.
-- Necesita antes supabase_migration_seguridad.sql (profiles, is_admin) y
-- supabase_schema_inventario_flota.sql (current_obrero_id; se crea aquí si falta).
--
-- Idea: el binario va SIEMPRE a Storage; en PostgreSQL solo quedan los metadatos
-- (ruta, tamaño, tipo, quién lo subió). Doc: docs/archivos-obra.md
--
--   1. Buckets privados `obra-archivos` (100 MB por archivo) y `obra-lidar` (5 GB).
--   2. Tabla `obra_archivos` (metadatos) con índices por obra y categoría.
--   3. Permisos: administradores todo; operarios solo en las obras donde están
--      asignados (operariosIds de la obra) y solo fotos, planos, LiDAR y
--      documentación técnica. Presupuestos y facturas, solo la oficina.
--   4. Políticas RLS en storage.objects: solo se puede subir a una ruta que antes
--      se ha reservado en `obra_archivos`, y solo se descarga lo que se puede ver.
--   5. Borrado en cascada: al borrar el registro (o la obra) la ruta pasa a la
--      cola `storage_borrados`, que el servidor vacía con la API de Storage
--      (Supabase no deja borrar objetos de Storage con SQL).
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. BUCKETS (privados: se abren con URLs firmadas de pocos minutos)
--    Ojo: el límite global del proyecto (Storage > Settings) manda sobre estos.
--    En el plan gratuito es de 50 MB por archivo; en Pro se puede subir.
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obra-archivos', 'obra-archivos', false, 104857600, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv', 'application/xml', 'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip', 'application/octet-stream',
  'image/vnd.dwg', 'image/vnd.dxf', 'model/vnd.dwf', 'application/x-step'
])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obra-lidar', 'obra-lidar', false, 5368709120, array[
  'application/octet-stream', 'text/plain', 'text/csv', 'application/json', 'application/zip',
  'model/gltf-binary', 'model/gltf+json', 'model/obj', 'model/mtl', 'model/stl', 'model/vnd.usdz+zip',
  'image/vnd.dxf', 'image/jpeg', 'image/png'
])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------------------
-- 2. METADATOS
--    estado 'pendiente': ruta reservada, el archivo se está subiendo.
--    estado 'subido'   : el archivo está en Storage (tamaño y tipo leídos de Storage).
-- -------------------------------------------------------------------------
create table if not exists public.obra_archivos (
  id             uuid primary key default gen_random_uuid(),
  obra_id        text not null check (obra_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  categoria      text not null check (categoria in ('fotos', 'planos', 'lidar', 'documentacion', 'presupuestos', 'facturas', 'otros')),
  bucket_id      text not null check (bucket_id in ('obra-archivos', 'obra-lidar')),
  storage_path   text not null,
  miniatura_path text,
  nombre         text not null check (length(nombre) between 1 and 255),
  descripcion    text check (length(descripcion) <= 1000),
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes >= 0),
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'subido')),
  subido_por     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  subido_at      timestamptz,
  constraint obra_archivos_ruta_ok check (starts_with(storage_path, 'obras/' || obra_id || '/' || categoria || '/')),
  constraint obra_archivos_miniatura_ok check (miniatura_path is null or starts_with(miniatura_path, 'obras/' || obra_id || '/miniaturas/')),
  constraint obra_archivos_bucket_ok check ((categoria = 'lidar') = (bucket_id = 'obra-lidar')),
  constraint obra_archivos_ruta_unica unique (bucket_id, storage_path)
);

-- Listado de la ficha de obra (por obra y categoría, más recientes primero).
create index if not exists obra_archivos_obra_idx
  on public.obra_archivos (obra_id, categoria, created_at desc) where estado = 'subido';
-- Comprobación de miniaturas en las políticas de Storage.
create index if not exists obra_archivos_miniatura_idx
  on public.obra_archivos (bucket_id, miniatura_path) where miniatura_path is not null;
-- Limpieza de subidas que se quedaron a medias.
create index if not exists obra_archivos_pendientes_idx
  on public.obra_archivos (created_at) where estado = 'pendiente';
create index if not exists obra_archivos_subido_por_idx on public.obra_archivos (subido_por);

-- -------------------------------------------------------------------------
-- 3. PERMISOS POR OBRA
-- -------------------------------------------------------------------------
create or replace function public.current_obrero_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.obrero_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;
revoke all on function public.current_obrero_id() from public, anon;
grant execute on function public.current_obrero_id() to authenticated;

-- ¿Puede el usuario con sesión trabajar con los archivos de esta categoría en esta obra?
create or replace function public.puede_archivos_obra(p_obra_id text, p_categoria text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      public.current_role_name() = 'obrero'
      and p_categoria in ('fotos', 'planos', 'lidar', 'documentacion')
      and exists (
        select 1 from public.app_records r
        where r.collection = 'obras'
          and r.id = p_obra_id
          and coalesce(r.data -> 'operariosIds', '[]'::jsonb) ? public.current_obrero_id()
      )
    )
$$;
revoke all on function public.puede_archivos_obra(text, text) from public, anon;
grant execute on function public.puede_archivos_obra(text, text) to authenticated;

alter table public.obra_archivos enable row level security;
revoke all on public.obra_archivos from anon;
grant select, insert, update, delete on public.obra_archivos to authenticated;

drop policy if exists obra_archivos_ver on public.obra_archivos;
create policy obra_archivos_ver on public.obra_archivos
  for select to authenticated
  using (public.puede_archivos_obra(obra_id, categoria));

-- Solo se reserva una ruta nueva (pendiente) a nombre propio.
drop policy if exists obra_archivos_crear on public.obra_archivos;
create policy obra_archivos_crear on public.obra_archivos
  for insert to authenticated
  with check (
    subido_por = (select auth.uid())
    and estado = 'pendiente'
    and public.puede_archivos_obra(obra_id, categoria)
  );

drop policy if exists obra_archivos_modificar on public.obra_archivos;
create policy obra_archivos_modificar on public.obra_archivos
  for update to authenticated
  using (public.is_admin() or (subido_por = (select auth.uid()) and public.puede_archivos_obra(obra_id, categoria)))
  with check (public.puede_archivos_obra(obra_id, categoria));

-- La oficina borra cualquiera; un operario, solo los suyos.
drop policy if exists obra_archivos_borrar on public.obra_archivos;
create policy obra_archivos_borrar on public.obra_archivos
  for delete to authenticated
  using (public.is_admin() or (subido_por = (select auth.uid()) and public.puede_archivos_obra(obra_id, categoria)));

-- Guardián: rutas y dueño no cambian; al pasar a 'subido' se comprueba que el
-- archivo está en Storage y se toman de allí el tamaño y el tipo reales.
create or replace function public.obra_archivos_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  obj record;
begin
  if new.obra_id is distinct from old.obra_id
     or new.categoria is distinct from old.categoria
     or new.bucket_id is distinct from old.bucket_id
     or new.storage_path is distinct from old.storage_path
     or new.subido_por is distinct from old.subido_por
     or new.created_at is distinct from old.created_at then
    raise exception 'No se puede mover un archivo de obra: súbelo de nuevo.';
  end if;
  -- La miniatura solo se puede quitar (si falló su subida).
  if new.miniatura_path is distinct from old.miniatura_path and new.miniatura_path is not null then
    raise exception 'La miniatura no se puede cambiar.';
  end if;
  if old.estado = 'subido' and new.estado = 'pendiente' then
    raise exception 'Un archivo subido no vuelve a pendiente.';
  end if;
  if old.estado = 'pendiente' and new.estado = 'subido' then
    select o.metadata into obj
    from storage.objects o
    where o.bucket_id = new.bucket_id and o.name = new.storage_path;
    if not found then
      raise exception 'El archivo aún no está en Storage.';
    end if;
    new.size_bytes := coalesce((obj.metadata ->> 'size')::bigint, new.size_bytes);
    new.mime_type := coalesce(nullif(obj.metadata ->> 'mimetype', ''), new.mime_type);
    new.subido_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists obra_archivos_guard on public.obra_archivos;
create trigger obra_archivos_guard
  before update on public.obra_archivos
  for each row execute function public.obra_archivos_guard();

-- -------------------------------------------------------------------------
-- 4. POLÍTICAS DE STORAGE (storage.objects)
--    Ver/descargar (y crear URL firmada): si se puede ver su fila en obra_archivos
--    (las políticas de esa tabla se aplican dentro de la consulta).
--    Subir: solo a una ruta reservada por uno mismo y aún pendiente.
--    No hay UPDATE: los archivos no se sobrescriben (ruta nueva por versión).
-- -------------------------------------------------------------------------
drop policy if exists obra_archivos_storage_ver on storage.objects;
create policy obra_archivos_storage_ver on storage.objects
  for select to authenticated
  using (
    bucket_id in ('obra-archivos', 'obra-lidar')
    and (
      public.is_admin()
      or owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.obra_archivos a
        where a.bucket_id = objects.bucket_id
          and (a.storage_path = objects.name or a.miniatura_path = objects.name)
      )
    )
  );

drop policy if exists obra_archivos_storage_subir on storage.objects;
create policy obra_archivos_storage_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('obra-archivos', 'obra-lidar')
    and (storage.foldername(name))[1] = 'obras'
    and exists (
      select 1 from public.obra_archivos a
      where a.bucket_id = objects.bucket_id
        and a.subido_por = (select auth.uid())
        and ((a.storage_path = objects.name and a.estado = 'pendiente') or a.miniatura_path = objects.name)
    )
  );

drop policy if exists obra_archivos_storage_borrar on storage.objects;
create policy obra_archivos_storage_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('obra-archivos', 'obra-lidar')
    and (public.is_admin() or owner_id = (select auth.uid())::text)
  );

-- -------------------------------------------------------------------------
-- 5. BORRADO EN CASCADA
--    Registro borrado -> su archivo y miniatura a la cola -> el servidor los
--    borra de Storage (backend/storageLimpieza.js, cada hora y al arrancar).
--    Obra borrada (app_records 'obras') -> se borran sus registros de archivos.
-- -------------------------------------------------------------------------
create table if not exists public.storage_borrados (
  id           bigint generated always as identity primary key,
  bucket_id    text not null,
  path         text not null,
  motivo       text,
  intentos     int not null default 0,
  ultimo_error text,
  created_at   timestamptz not null default now()
);
alter table public.storage_borrados enable row level security;  -- sin políticas: solo el servidor
revoke all on public.storage_borrados from anon, authenticated;

create or replace function public.obra_archivos_al_borrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.storage_borrados (bucket_id, path, motivo)
  values (old.bucket_id, old.storage_path, 'archivo ' || old.id);
  if old.miniatura_path is not null then
    insert into public.storage_borrados (bucket_id, path, motivo)
    values (old.bucket_id, old.miniatura_path, 'miniatura ' || old.id);
  end if;
  return old;
end;
$$;

drop trigger if exists obra_archivos_al_borrar on public.obra_archivos;
create trigger obra_archivos_al_borrar
  after delete on public.obra_archivos
  for each row execute function public.obra_archivos_al_borrar();

create or replace function public.app_records_borrar_archivos_obra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.collection = 'obras' then
    delete from public.obra_archivos where obra_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists app_records_borrar_archivos_obra on public.app_records;
create trigger app_records_borrar_archivos_obra
  after delete on public.app_records
  for each row execute function public.app_records_borrar_archivos_obra();

revoke all on function public.obra_archivos_guard() from public, anon, authenticated;
revoke all on function public.obra_archivos_al_borrar() from public, anon, authenticated;
revoke all on function public.app_records_borrar_archivos_obra() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 6. COMPROBACIÓN (solo lectura): ¿queda algún archivo guardado dentro de la base
--    de datos como texto base64? Lo normal es que solo salga empresa_config
--    (logo, firma y sello, reducidos a ~800 px a propósito para los PDF).
-- -------------------------------------------------------------------------
select collection,
       id,
       pg_size_pretty(pg_column_size(data)::bigint) as tamano,
       (select count(*) from regexp_matches(data::text, ';base64,', 'g')) as archivos_base64
from public.app_records
where data::text like '%;base64,%'
order by pg_column_size(data) desc
limit 50;
