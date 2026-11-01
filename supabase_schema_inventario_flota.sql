-- =========================================================================
-- ObraMaster - Inventario, maquinaria, flota de vehículos, alquileres y alertas
-- =========================================================================
-- Qué crea este archivo (todo en el esquema public):
--   asset_categories      Categorías del inventario (con revisión periódica opcional).
--   assets                Cada material, herramienta, máquina o vehículo: código interno,
--                         código de barras/QR, compra, garantía y dónde está ahora
--                         (almacén, obra, vehículo, operario, taller, devuelto o baja).
--   vehicles              Ficha del vehículo (1 a 1 con su fila de assets).
--   vehicle_inspections   ITV: fecha, resultado y próxima ITV.
--   vehicle_insurances    Pólizas: compañía, cobertura, asistencia y vencimiento.
--   vehicle_fuel_logs     Repostajes (litros, importe, km, ticket, obra).
--   asset_maintenance     Revisiones, reparaciones, calibraciones y certificaciones
--                         (vehículos y máquinas), con taller, coste y factura.
--   maintenance_plans     Mantenimiento preventivo: "cada 15.000 km o 12 meses".
--   vehicle_tires         Neumáticos por posición, km de montaje y profundidad.
--   asset_documents       Tarjeta de transporte, autorizaciones, certificados, ficha
--                         técnica, manuales... con fecha de caducidad opcional.
--   asset_rentals         Alquileres: arrendadora, tarifa, obra, devolución, sustitución.
--   inventory_movements   Historial INMUTABLE de cada alta, traslado, asignación,
--                         sustitución y baja (lo escribe un trigger).
--   fleet_settings        Cuándo avisar (30/15/7 días, 1.000 km...) y por qué canal.
--   fleet_alert_log       Qué avisos se han enviado ya (uno por etapa).
--   Vistas fleet_alertas (centro de alertas) y fleet_costes (costes por vehículo/obra).
--   Función fleet_generar_avisos(): crea los avisos de la campana (la llama el servidor).
--   Bucket privado `flota-docs` para tickets, facturas, pólizas y documentos.
--
-- Se reutiliza lo que ya existe:
--   - Proveedores, arrendadoras y talleres: tabla public.suppliers (Avisos > Proveedores),
--     con las categorías 'alquiler' o 'taller'. Aquí solo se le añade la columna cif.
--   - Obras y operarios: por su id de la app (app_records "obras" y "obreros").
--   - Usuarios y roles: public.profiles ('admin' u 'obrero') y public.is_admin().
--
-- Requisitos: haber ejecutado antes `supabase_migration_seguridad.sql` y
-- `supabase_schema_notificaciones.sql` (tablas suppliers y notifications).
--
-- Cómo ejecutarlo:
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Se puede ejecutar más de una vez sin romper nada.
--
-- Seguridad: RLS en todas las tablas. Administradores: todo. Operarios (desde el
-- navegador): leen lo que tienen asignado y el vehículo que conducen, y apuntan sus
-- repostajes. La app escribe a través del servidor (backend/flotaRoutes.js).
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 0. PROVEEDORES: CIF (arrendadoras y talleres usan la misma tabla)
-- -------------------------------------------------------------------------
alter table public.suppliers add column if not exists cif text;

-- Operario (id de la ficha "obreros" de la app) del usuario con sesión.
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

create or replace function public.fleet_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 1. CATEGORÍAS
-- -------------------------------------------------------------------------
create table if not exists public.asset_categories (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  tipo                   text,                               -- tipo por defecto al dar de alta
  descripcion            text,
  requiere_revision      boolean not null default false,     -- arneses, líneas de vida, topografía...
  meses_revision         int check (meses_revision is null or meses_revision > 0),
  created_at             timestamptz not null default now()
);
create unique index if not exists asset_categories_nombre_key on public.asset_categories (lower(nombre));

insert into public.asset_categories (nombre, tipo, requiere_revision, meses_revision) values
  ('Consumibles', 'consumible', false, null),
  ('Herramienta manual', 'herramienta_manual', false, null),
  ('Herramienta eléctrica', 'herramienta_electrica', false, null),
  ('Maquinaria ligera', 'maquinaria_ligera', false, null),
  ('Maquinaria pesada', 'maquinaria_pesada', true, 12),
  ('EPI y seguridad (arneses, líneas de vida)', 'epi', true, 12),
  ('Medición y topografía', 'medicion', true, 12),
  ('Elevación (polipastos, eslingas)', 'maquinaria_ligera', true, 12),
  ('Andamios y medios auxiliares', 'medio_auxiliar', false, null),
  ('Vehículos', 'vehiculo', false, null)
on conflict do nothing;

-- -------------------------------------------------------------------------
-- 2. ACTIVOS (materiales, herramientas, máquinas y vehículos)
-- -------------------------------------------------------------------------
create sequence if not exists public.assets_codigo_seq;

create table if not exists public.assets (
  id                    uuid primary key default gen_random_uuid(),
  codigo_interno        text not null,                       -- HER-0001 (se genera si viene vacío)
  codigo_barras         text,                                -- código de barras o QR
  nombre                text not null,
  descripcion           text,
  category_id           uuid references public.asset_categories (id) on delete set null,
  tipo                  text not null default 'herramienta_manual' check (tipo in (
                          'consumible', 'herramienta_manual', 'herramienta_electrica', 'maquinaria_ligera',
                          'maquinaria_pesada', 'vehiculo', 'epi', 'medicion', 'medio_auxiliar', 'otro')),
  tipo_adquisicion      text not null default 'propiedad' check (tipo_adquisicion in ('propiedad', 'alquiler', 'renting', 'leasing')),
  numero_serie          text,
  marca                 text,
  modelo                text,
  -- Consumibles: cantidad en stock y mínimo para avisar.
  cantidad              numeric(12, 2) not null default 1 check (cantidad >= 0),
  unidad                text not null default 'ud',
  stock_minimo          numeric(12, 2),
  -- Compra y garantía
  supplier_id           uuid references public.suppliers (id) on delete set null,
  proveedor_nombre      text,                                -- texto libre si no está en proveedores
  numero_factura        text,
  fecha_compra          date,
  precio_compra         numeric(12, 2) check (precio_compra is null or precio_compra >= 0),
  fecha_fin_garantia    date,
  manual_path           text,                                -- PDF del manual en flota-docs
  foto_path             text,
  -- Dónde está ahora
  estado                text not null default 'en_almacen' check (estado in (
                          'en_almacen', 'en_obra', 'en_vehiculo', 'con_operario', 'en_reparacion',
                          'devuelto_proveedor', 'baja')),
  obra_id               text,                                -- id de la obra (app_records "obras")
  operario_id           text,                                -- id del operario (app_records "obreros")
  operario_nombre       text,
  vehicle_id            uuid,                                -- vehículo en el que va (FK más abajo)
  ubicacion_detalle     text,                                -- "Estantería 3", "Caja de herramientas"...
  -- Sustitución y baja
  sustituye_a           uuid references public.assets (id) on delete set null,
  motivo                text,                                -- motivo del último movimiento (lo copia el historial)
  fecha_baja            date,
  notas                 text,
  -- Quién hizo el último cambio (el servidor usa la clave de servicio: auth.uid() es nulo)
  updated_by            uuid references auth.users (id) on delete set null,
  updated_by_name       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint assets_ubicacion_ok check (
    (estado <> 'en_obra' or obra_id is not null) and
    (estado <> 'en_vehiculo' or vehicle_id is not null) and
    (estado <> 'con_operario' or operario_id is not null)
  )
);

create unique index if not exists assets_codigo_key on public.assets (upper(codigo_interno));
create unique index if not exists assets_barras_key on public.assets (codigo_barras) where codigo_barras is not null and codigo_barras <> '';
create index if not exists assets_estado_idx on public.assets (estado);
create index if not exists assets_obra_idx on public.assets (obra_id) where obra_id is not null;
create index if not exists assets_operario_idx on public.assets (operario_id) where operario_id is not null;
create index if not exists assets_vehicle_idx on public.assets (vehicle_id) where vehicle_id is not null;
create index if not exists assets_serie_idx on public.assets (numero_serie) where numero_serie is not null;
create index if not exists assets_garantia_idx on public.assets (fecha_fin_garantia) where fecha_fin_garantia is not null;

-- Código interno automático por tipo: CON-0001, HER-0002, MAQ-0003, VEH-0004...
create or replace function public.assets_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.codigo_interno is null or btrim(new.codigo_interno) = '' then
    new.codigo_interno := case new.tipo
      when 'consumible' then 'CON'
      when 'herramienta_manual' then 'HER'
      when 'herramienta_electrica' then 'HEL'
      when 'maquinaria_ligera' then 'MAQ'
      when 'maquinaria_pesada' then 'MQP'
      when 'vehiculo' then 'VEH'
      when 'epi' then 'EPI'
      when 'medicion' then 'MED'
      when 'medio_auxiliar' then 'AUX'
      else 'ACT' end || '-' || lpad(nextval('public.assets_codigo_seq')::text, 4, '0');
  end if;
  new.codigo_interno := upper(btrim(new.codigo_interno));
  new.codigo_barras := nullif(btrim(coalesce(new.codigo_barras, '')), '');
  -- La ubicación que no corresponde al estado se limpia (una herramienta en el almacén no
  -- sigue "en" la obra anterior). El operario se puede mantener en obra o vehículo.
  if new.estado in ('en_almacen', 'devuelto_proveedor', 'baja', 'en_reparacion') then
    new.obra_id := null;
    new.vehicle_id := null;
    new.operario_id := null;
    new.operario_nombre := null;
  elsif new.estado = 'en_obra' then
    new.vehicle_id := null;
  elsif new.estado = 'en_vehiculo' then
    new.obra_id := null;
  end if;
  if new.operario_id is null then new.operario_nombre := null; end if;
  if new.estado = 'baja' and new.fecha_baja is null then new.fecha_baja := current_date; end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    -- El motivo es del movimiento que se hace ahora: no se arrastra al siguiente.
    if new.motivo is not distinct from old.motivo then new.motivo := null; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assets_before_write on public.assets;
create trigger assets_before_write before insert or update on public.assets
  for each row execute function public.assets_before_write();

-- -------------------------------------------------------------------------
-- 3. VEHÍCULOS
-- -------------------------------------------------------------------------
create table if not exists public.vehicles (
  id                       uuid primary key default gen_random_uuid(),
  asset_id                 uuid not null unique references public.assets (id) on delete cascade,
  matricula                text not null,
  bastidor                 text,                             -- VIN
  marca                    text,
  modelo                   text,
  tipo_vehiculo            text not null default 'furgoneta' check (tipo_vehiculo in (
                             'turismo', 'furgoneta', 'camion', 'moto', 'remolque', 'maquinaria_autopropulsada', 'otro')),
  fecha_matriculacion      date,                             -- para la periodicidad de la ITV
  combustible              text not null default 'diesel' check (combustible in ('diesel', 'gasolina', 'hibrido', 'electrico', 'glp', 'otro')),
  capacidad_deposito       numeric(7, 2),
  km_actual                int not null default 0 check (km_actual >= 0),
  km_actualizado_at        timestamptz,
  distintivo_ambiental     text check (distintivo_ambiental is null or distintivo_ambiental in ('0', 'ECO', 'C', 'B', 'sin')),
  mma_kg                   int,
  conductor_operario_id    text,                             -- conductor habitual (ficha "obreros")
  conductor_nombre         text,
  notas                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists vehicles_matricula_key on public.vehicles (matricula);
create unique index if not exists vehicles_bastidor_key on public.vehicles (upper(bastidor)) where bastidor is not null and bastidor <> '';
create index if not exists vehicles_conductor_idx on public.vehicles (conductor_operario_id) where conductor_operario_id is not null;

-- Matrícula sin espacios ni guiones y en mayúsculas: "1234 abc" = "1234-ABC" = "1234ABC".
create or replace function public.vehicles_before_write()
returns trigger
language plpgsql
as $$
begin
  new.matricula := upper(regexp_replace(coalesce(new.matricula, ''), '[^A-Za-z0-9]', '', 'g'));
  if new.matricula = '' then raise exception 'La matrícula es obligatoria.'; end if;
  new.bastidor := nullif(upper(btrim(coalesce(new.bastidor, ''))), '');
  if new.conductor_operario_id is null then new.conductor_nombre := null; end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.km_actual is distinct from old.km_actual then new.km_actualizado_at := now(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_before_write on public.vehicles;
create trigger vehicles_before_write before insert or update on public.vehicles
  for each row execute function public.vehicles_before_write();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assets_vehicle_fk') then
    alter table public.assets add constraint assets_vehicle_fk
      foreign key (vehicle_id) references public.vehicles (id) on delete set null;
  end if;
end
$$;

-- Sube los km del vehículo cuando un repostaje, revisión o ITV trae más km (nunca los baja).
create or replace function public.fleet_subir_km(p_vehicle uuid, p_km int)
returns void
language sql
as $$
  update public.vehicles set km_actual = p_km
  where id = p_vehicle and p_km is not null and p_km > km_actual
$$;

-- 3.1 ITV
create table if not exists public.vehicle_inspections (
  id                   uuid primary key default gen_random_uuid(),
  vehicle_id           uuid not null references public.vehicles (id) on delete cascade,
  fecha_inspeccion     date,                                 -- vacía = solo se apunta la próxima cita
  resultado            text not null default 'favorable' check (resultado in ('favorable', 'desfavorable', 'negativa', 'pendiente')),
  proxima_itv          date not null,                        -- fecha límite (caducidad)
  estacion             text,
  km                   int check (km is null or km >= 0),
  coste                numeric(10, 2) not null default 0 check (coste >= 0),   -- tasa (con IVA)
  defectos             text,
  informe_path         text,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists vehicle_inspections_vehicle_idx on public.vehicle_inspections (vehicle_id, fecha_inspeccion desc nulls last, created_at desc);
create index if not exists vehicle_inspections_proxima_idx on public.vehicle_inspections (proxima_itv);

-- 3.2 Seguros
create table if not exists public.vehicle_insurances (
  id                   uuid primary key default gen_random_uuid(),
  vehicle_id           uuid not null references public.vehicles (id) on delete cascade,
  aseguradora          text not null,
  numero_poliza        text not null,
  cobertura            text not null default 'terceros' check (cobertura in ('terceros', 'terceros_ampliado', 'todo_riesgo_franquicia', 'todo_riesgo')),
  telefono_asistencia  text,
  fecha_inicio         date not null,
  fecha_vencimiento    date not null,
  prima                numeric(10, 2) check (prima is null or prima >= 0),
  poliza_path          text,
  activa               boolean not null default true,       -- al renovar, la anterior queda inactiva
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint vehicle_insurances_fechas check (fecha_vencimiento >= fecha_inicio)
);
create index if not exists vehicle_insurances_vehicle_idx on public.vehicle_insurances (vehicle_id, fecha_vencimiento desc) where activa;

-- 3.3 Combustible
create table if not exists public.vehicle_fuel_logs (
  id                   uuid primary key default gen_random_uuid(),
  vehicle_id           uuid not null references public.vehicles (id) on delete cascade,
  fecha                timestamptz not null default now(),
  km                   int not null check (km >= 0),
  litros               numeric(8, 2) not null check (litros > 0),
  importe              numeric(10, 2) not null check (importe >= 0),     -- total del ticket (con IVA)
  iva_pct              numeric(5, 2) not null default 21 check (iva_pct between 0 and 100),
  precio_litro         numeric(7, 3) generated always as (round(importe / nullif(litros, 0), 3)) stored,
  deposito_lleno       boolean not null default true,
  estacion             text,
  operario_id          text,
  operario_nombre      text,
  obra_id              text,                                -- imputa el coste a la obra
  ticket_path          text,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists vehicle_fuel_logs_vehicle_idx on public.vehicle_fuel_logs (vehicle_id, km);
create index if not exists vehicle_fuel_logs_obra_idx on public.vehicle_fuel_logs (obra_id) where obra_id is not null;
create index if not exists vehicle_fuel_logs_operario_idx on public.vehicle_fuel_logs (operario_id) where operario_id is not null;

-- 3.4 Planes de mantenimiento preventivo (vehículos por km y/o meses; máquinas y EPI por meses)
create table if not exists public.maintenance_plans (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets (id) on delete cascade,
  nombre               text not null,                       -- "Cambio de aceite y filtros", "Revisión arnés"
  tipo                 text not null default 'revision' check (tipo in ('revision', 'calibracion', 'certificacion')),
  cada_km              int check (cada_km is null or cada_km > 0),
  cada_meses           int check (cada_meses is null or cada_meses > 0),
  ultima_fecha         date,
  ultimo_km            int,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint maintenance_plans_periodo check (cada_km is not null or cada_meses is not null)
);
create index if not exists maintenance_plans_asset_idx on public.maintenance_plans (asset_id) where activo;

drop trigger if exists maintenance_plans_touch on public.maintenance_plans;
create trigger maintenance_plans_touch before update on public.maintenance_plans
  for each row execute function public.fleet_touch();

-- 3.5 Mantenimientos, reparaciones, calibraciones (vehículos y máquinas)
create table if not exists public.asset_maintenance (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets (id) on delete cascade,
  plan_id              uuid references public.maintenance_plans (id) on delete set null,
  tipo                 text not null default 'revision' check (tipo in (
                         'revision', 'aceite_filtros', 'frenos', 'neumaticos', 'reparacion_mecanica',
                         'chapa_pintura', 'electricidad', 'calibracion', 'certificacion', 'otro')),
  fecha                date not null default current_date,
  km                   int check (km is null or km >= 0),
  supplier_id          uuid references public.suppliers (id) on delete set null,   -- taller
  taller_nombre        text,
  mano_obra            numeric(10, 2) not null default 0 check (mano_obra >= 0),  -- sin IVA
  piezas               numeric(10, 2) not null default 0 check (piezas >= 0),     -- sin IVA
  iva_pct              numeric(5, 2) not null default 21 check (iva_pct between 0 and 100),
  base_imponible       numeric(10, 2) generated always as (mano_obra + piezas) stored,
  importe_total        numeric(10, 2) generated always as (round((mano_obra + piezas) * (1 + iva_pct / 100), 2)) stored,
  numero_factura       text,
  factura_path         text,
  descripcion          text not null,
  obra_id              text,                                -- imputa el coste a la obra (si procede)
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists asset_maintenance_asset_idx on public.asset_maintenance (asset_id, fecha desc);
create index if not exists asset_maintenance_obra_idx on public.asset_maintenance (obra_id) where obra_id is not null;

-- 3.6 Neumáticos
create table if not exists public.vehicle_tires (
  id                   uuid primary key default gen_random_uuid(),
  vehicle_id           uuid not null references public.vehicles (id) on delete cascade,
  posicion             text not null check (posicion in (
                         'delantero_izquierdo', 'delantero_derecho', 'trasero_izquierdo', 'trasero_derecho',
                         'trasero_izquierdo_interior', 'trasero_derecho_interior', 'repuesto', 'otra')),
  marca                text not null,
  modelo               text,
  medida               text not null,                       -- 205/65 R16C 107T
  fecha_montaje        date not null default current_date,
  km_montaje           int not null check (km_montaje >= 0),
  profundidad_mm       numeric(4, 2),                       -- mínimo legal 1,6 mm
  profundidad_fecha    date,
  activo               boolean not null default true,
  fecha_desmontaje     date,
  km_desmontaje        int,
  motivo_cambio        text,
  supplier_id          uuid references public.suppliers (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists vehicle_tires_vehicle_idx on public.vehicle_tires (vehicle_id) where activo;

-- 3.7 Documentos con o sin caducidad (vehículos, máquinas, EPI...)
create table if not exists public.asset_documents (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets (id) on delete cascade,
  tipo                 text not null default 'otro' check (tipo in (
                         'ficha_tecnica', 'permiso_circulacion', 'tarjeta_transporte', 'autorizacion',
                         'certificado', 'garantia', 'manual', 'factura', 'foto', 'otro')),
  nombre               text not null,
  numero               text,
  fecha_emision        date,
  fecha_caducidad      date,                                -- vacía = no caduca
  file_path            text,
  file_name            text,
  activo               boolean not null default true,       -- al renovar, el anterior queda inactivo
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists asset_documents_asset_idx on public.asset_documents (asset_id) where activo;
create index if not exists asset_documents_caducidad_idx on public.asset_documents (fecha_caducidad) where activo and fecha_caducidad is not null;

-- Al registrar mantenimiento / repostaje / ITV: subir km y cerrar el ciclo del plan.
create or replace function public.fleet_after_registro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle uuid;
begin
  if tg_table_name = 'vehicle_fuel_logs' or tg_table_name = 'vehicle_inspections' then
    perform public.fleet_subir_km(new.vehicle_id, new.km);
  elsif tg_table_name = 'asset_maintenance' then
    select id into v_vehicle from public.vehicles where asset_id = new.asset_id;
    if v_vehicle is not null then perform public.fleet_subir_km(v_vehicle, new.km); end if;
    if new.plan_id is not null then
      update public.maintenance_plans
         set ultima_fecha = greatest(coalesce(ultima_fecha, new.fecha), new.fecha),
             ultimo_km = case when new.km is null then ultimo_km else greatest(coalesce(ultimo_km, new.km), new.km) end
       where id = new.plan_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vehicle_fuel_logs_after on public.vehicle_fuel_logs;
create trigger vehicle_fuel_logs_after after insert or update of km on public.vehicle_fuel_logs
  for each row execute function public.fleet_after_registro();
drop trigger if exists vehicle_inspections_after on public.vehicle_inspections;
create trigger vehicle_inspections_after after insert or update of km on public.vehicle_inspections
  for each row execute function public.fleet_after_registro();
drop trigger if exists asset_maintenance_after on public.asset_maintenance;
create trigger asset_maintenance_after after insert or update of km, fecha, plan_id on public.asset_maintenance
  for each row execute function public.fleet_after_registro();

-- -------------------------------------------------------------------------
-- 4. ALQUILERES
-- -------------------------------------------------------------------------
create table if not exists public.asset_rentals (
  id                         uuid primary key default gen_random_uuid(),
  asset_id                   uuid not null references public.assets (id) on delete restrict,
  supplier_id                uuid references public.suppliers (id) on delete set null,   -- arrendadora
  arrendador_nombre          text,
  obra_id                    text,                          -- obra a la que se imputa
  numero_contrato            text,                          -- contrato o albarán de entrega
  fecha_inicio               date not null default current_date,
  fecha_prevista_devolucion  date not null,
  fecha_devolucion           date,
  tarifa                     numeric(10, 2) not null default 0 check (tarifa >= 0),      -- sin IVA
  tarifa_periodo             text not null default 'dia' check (tarifa_periodo in ('dia', 'semana', 'mes')),
  transporte                 numeric(10, 2) not null default 0 check (transporte >= 0),  -- portes ida/vuelta, sin IVA
  fianza                     numeric(10, 2) not null default 0 check (fianza >= 0),
  iva_pct                    numeric(5, 2) not null default 21 check (iva_pct between 0 and 100),
  importe_final              numeric(10, 2) check (importe_final is null or importe_final >= 0),  -- base de la factura real
  numero_factura             text,
  estado                     text not null default 'activo' check (estado in ('activo', 'devuelto', 'sustituido')),
  sustituye_a_rental_id      uuid references public.asset_rentals (id) on delete set null,
  motivo_sustitucion         text,
  contrato_path              text,
  notas                      text,
  created_by                 uuid references auth.users (id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint asset_rentals_fechas check (fecha_prevista_devolucion >= fecha_inicio
                                         and (fecha_devolucion is null or fecha_devolucion >= fecha_inicio))
);
-- Factura del arrendador (PDF o foto). Sin importe_final el alquiler cerrado no cuenta como gasto.
alter table public.asset_rentals add column if not exists factura_path text;

create index if not exists asset_rentals_activos_idx on public.asset_rentals (fecha_prevista_devolucion) where estado = 'activo';
create index if not exists asset_rentals_obra_idx on public.asset_rentals (obra_id) where obra_id is not null;
create index if not exists asset_rentals_asset_idx on public.asset_rentals (asset_id);

drop trigger if exists asset_rentals_touch on public.asset_rentals;
create trigger asset_rentals_touch before update on public.asset_rentals
  for each row execute function public.fleet_touch();

-- Coste de un alquiler (sin IVA): periodos x tarifa + transporte, o el importe de la factura.
create or replace function public.rental_base(r public.asset_rentals)
returns numeric
language sql
stable
as $$
  select coalesce(r.importe_final,
    (case r.tarifa_periodo
       when 'semana' then ceil(greatest(coalesce(r.fecha_devolucion, least(current_date, r.fecha_prevista_devolucion)) - r.fecha_inicio + 1, 1) / 7.0)
       when 'mes' then ceil(greatest(coalesce(r.fecha_devolucion, least(current_date, r.fecha_prevista_devolucion)) - r.fecha_inicio + 1, 1) / 30.0)
       else greatest(coalesce(r.fecha_devolucion, least(current_date, r.fecha_prevista_devolucion)) - r.fecha_inicio + 1, 1)
     end) * r.tarifa + r.transporte)
$$;

-- -------------------------------------------------------------------------
-- 5. HISTORIAL INMUTABLE DE MOVIMIENTOS
-- -------------------------------------------------------------------------
create table if not exists public.inventory_movements (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets (id) on delete restrict,
  created_at           timestamptz not null default now(),
  accion               text not null check (accion in (
                         'alta', 'traslado_obra', 'carga_vehiculo', 'asignacion_operario', 'devolucion_almacen',
                         'envio_reparacion', 'devolucion_proveedor', 'sustitucion', 'baja', 'ajuste_stock', 'cambio')),
  de_estado            text,
  a_estado             text not null,
  de_obra_id           text,
  a_obra_id            text,
  de_operario_id       text,
  de_operario_nombre   text,
  a_operario_id        text,
  a_operario_nombre    text,
  de_vehicle_id        uuid,                                -- sin FK: el historial no se toca nunca
  a_vehicle_id         uuid,
  cantidad_antes       numeric(12, 2),
  cantidad_despues     numeric(12, 2),
  reemplaza_a          uuid,
  motivo               text,
  user_id              uuid,
  user_name            text
);
create index if not exists inventory_movements_asset_idx on public.inventory_movements (asset_id, created_at desc);
create index if not exists inventory_movements_obra_idx on public.inventory_movements (a_obra_id, created_at desc) where a_obra_id is not null;

-- Lo escribe el trigger de assets: alta, cambios de estado, obra, vehículo, operario,
-- sustitución y cantidad. El usuario sale de assets.updated_by(_name), que pone el servidor.
create or replace function public.assets_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion text;
begin
  if tg_op = 'INSERT' then
    insert into public.inventory_movements (asset_id, accion, a_estado, a_obra_id, a_operario_id, a_operario_nombre,
      a_vehicle_id, cantidad_despues, reemplaza_a, motivo, user_id, user_name)
    values (new.id, case when new.sustituye_a is not null then 'sustitucion' else 'alta' end, new.estado, new.obra_id,
      new.operario_id, new.operario_nombre, new.vehicle_id, new.cantidad, new.sustituye_a, new.motivo,
      coalesce(new.updated_by, auth.uid()), new.updated_by_name);
    return new;
  end if;

  if old.estado is not distinct from new.estado
     and old.obra_id is not distinct from new.obra_id
     and old.vehicle_id is not distinct from new.vehicle_id
     and old.operario_id is not distinct from new.operario_id
     and old.sustituye_a is not distinct from new.sustituye_a
     and old.cantidad is not distinct from new.cantidad then
    return new;   -- cambio de datos (nombre, notas, precio...): no es un movimiento
  end if;

  v_accion := case
    when new.estado = 'baja' and old.estado <> 'baja' then 'baja'
    when new.sustituye_a is not null and new.sustituye_a is distinct from old.sustituye_a then 'sustitucion'
    when new.estado = 'en_reparacion' and old.estado <> 'en_reparacion' then 'envio_reparacion'
    when new.estado = 'devuelto_proveedor' and old.estado <> 'devuelto_proveedor' then 'devolucion_proveedor'
    when new.estado = 'en_almacen' and old.estado <> 'en_almacen' then 'devolucion_almacen'
    when new.estado = 'en_obra' and (old.estado <> 'en_obra' or old.obra_id is distinct from new.obra_id) then 'traslado_obra'
    when new.estado = 'en_vehiculo' and (old.estado <> 'en_vehiculo' or old.vehicle_id is distinct from new.vehicle_id) then 'carga_vehiculo'
    when new.operario_id is distinct from old.operario_id then 'asignacion_operario'
    when new.cantidad is distinct from old.cantidad then 'ajuste_stock'
    else 'cambio'
  end;

  insert into public.inventory_movements (asset_id, accion, de_estado, a_estado, de_obra_id, a_obra_id,
    de_operario_id, de_operario_nombre, a_operario_id, a_operario_nombre, de_vehicle_id, a_vehicle_id,
    cantidad_antes, cantidad_despues, reemplaza_a, motivo, user_id, user_name)
  values (new.id, v_accion, old.estado, new.estado, old.obra_id, new.obra_id,
    old.operario_id, old.operario_nombre, new.operario_id, new.operario_nombre, old.vehicle_id, new.vehicle_id,
    old.cantidad, new.cantidad, case when new.sustituye_a is distinct from old.sustituye_a then new.sustituye_a end,
    new.motivo, coalesce(new.updated_by, auth.uid()), new.updated_by_name);
  return new;
end;
$$;

drop trigger if exists assets_audit on public.assets;
create trigger assets_audit after insert or update on public.assets
  for each row execute function public.assets_audit();

-- Inmutable: ni el servidor (clave de servicio, que se salta RLS) puede cambiarlo o borrarlo.
create or replace function public.inventory_movements_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'El historial de movimientos no se puede modificar ni borrar.';
end;
$$;

drop trigger if exists inventory_movements_inmutable on public.inventory_movements;
create trigger inventory_movements_inmutable before update or delete on public.inventory_movements
  for each row execute function public.inventory_movements_inmutable();
drop trigger if exists inventory_movements_no_truncate on public.inventory_movements;
create trigger inventory_movements_no_truncate before truncate on public.inventory_movements
  for each statement execute function public.inventory_movements_inmutable();

-- -------------------------------------------------------------------------
-- 6. AJUSTES DE AVISOS
-- -------------------------------------------------------------------------
create table if not exists public.fleet_settings (
  id                    boolean primary key default true check (id),   -- una sola fila
  avisos_dias           int[] not null default '{30,15,7}',  -- avisar a 30, 15 y 7 días
  avisos_km             int not null default 1000,           -- y 1.000 km antes
  urgente_km            int not null default 300,
  alquiler_dias         int not null default 3,              -- fin de alquiler: avisar 3 días antes
  garantia_dias         int not null default 30,
  email_avisos          text,                                -- correo para los avisos (opcional)
  enviar_email          boolean not null default false,
  whatsapp_telefono     text,
  enviar_whatsapp       boolean not null default false,
  updated_at            timestamptz not null default now()
);
insert into public.fleet_settings (id) values (true) on conflict do nothing;

create table if not exists public.fleet_alert_log (
  alert_key   text not null,
  etapa       text not null,                                 -- d30, d15, d7, km, vencido
  created_at  timestamptz not null default now(),
  primary key (alert_key, etapa)
);

-- vigente (verde) / proximo (amarillo) / urgente (amarillo intenso) / vencido (rojo)
create or replace function public.fleet_estado(p_dias int, p_km int, p_dias_aviso int, p_dias_urgente int, p_km_aviso int, p_km_urgente int)
returns text
language sql
immutable
as $$
  select case
    when (p_dias is not null and p_dias < 0) or (p_km is not null and p_km <= 0) then 'vencido'
    when (p_dias is not null and p_dias <= p_dias_urgente) or (p_km is not null and p_km <= p_km_urgente) then 'urgente'
    when (p_dias is not null and p_dias <= p_dias_aviso) or (p_km is not null and p_km <= p_km_aviso) then 'proximo'
    else 'vigente'
  end
$$;

-- -------------------------------------------------------------------------
-- 7. VISTA DE ALERTAS (centro de alertas y panel)
-- -------------------------------------------------------------------------
drop view if exists public.fleet_alertas;
create view public.fleet_alertas with (security_invoker = true) as
with s as (
  select avisos_dias, avisos_km, urgente_km, alquiler_dias, garantia_dias,
         (select max(x) from unnest(avisos_dias) x) as dias_aviso,
         (select min(x) from unnest(avisos_dias) x) as dias_urgente
  from public.fleet_settings where id
),
v as (
  select v.*, a.nombre as asset_nombre, a.codigo_interno, a.estado as asset_estado,
         v.matricula || coalesce(' · ' || nullif(concat_ws(' ', v.marca, v.modelo), ''), '') as etiqueta
  from public.vehicles v join public.assets a on a.id = v.asset_id
  where a.estado <> 'baja'
),
itv as (   -- la ITV vigente de cada vehículo: la de próxima fecha más lejana
  select distinct on (i.vehicle_id) i.*
  from public.vehicle_inspections i
  order by i.vehicle_id, i.proxima_itv desc, i.created_at desc
),
seg as (   -- solo la póliza activa más reciente de cada vehículo
  select distinct on (p.vehicle_id) p.*
  from public.vehicle_insurances p
  where p.activa
  order by p.vehicle_id, p.fecha_vencimiento desc
),
planes as (
  select p.*, a.nombre as asset_nombre, a.codigo_interno, v.id as vehicle_id, v.km_actual, v.etiqueta,
         case when p.cada_meses is not null and p.ultima_fecha is not null
              then (p.ultima_fecha + make_interval(months => p.cada_meses))::date end as proxima_fecha,
         case when p.cada_km is not null and p.ultimo_km is not null and v.id is not null
              then p.ultimo_km + p.cada_km end as proximo_km
  from public.maintenance_plans p
  join public.assets a on a.id = p.asset_id and a.estado <> 'baja'
  left join v on v.asset_id = p.asset_id
  where p.activo
)
-- ITV
select 'itv:' || itv.id as alert_key, 'itv' as tipo, 'ITV' as grupo,
       v.asset_id, v.id as vehicle_id, null::uuid as rental_id, itv.id as ref_id,
       v.etiqueta as elemento,
       case itv.resultado
         when 'negativa' then 'ITV negativa: el vehículo no puede circular'
         when 'desfavorable' then 'ITV desfavorable: corregir defectos antes del ' || to_char(itv.proxima_itv, 'DD/MM/YYYY')
         else 'Próxima ITV' end as detalle,
       itv.proxima_itv as fecha_vencimiento,
       (itv.proxima_itv - current_date) as dias_restantes,
       null::int as km_restantes,
       case when itv.resultado = 'negativa' then 'vencido'
            else public.fleet_estado(itv.proxima_itv - current_date, null, s.dias_aviso, s.dias_urgente, s.avisos_km, s.urgente_km) end as estado,
       null::text as obra_id,
       (itv.resultado = 'negativa' or itv.proxima_itv < current_date) as fuera_servicio
from itv join v on v.id = itv.vehicle_id cross join s

union all
-- Vehículos sin ITV registrada (para que no se olvide)
select 'itv-sin:' || v.id, 'itv', 'ITV', v.asset_id, v.id, null, null, v.etiqueta,
       'Sin ITV registrada: apunta la fecha de la próxima', null, null, null, 'proximo', null, false
from v
where v.tipo_vehiculo not in ('otro') and not exists (select 1 from public.vehicle_inspections i where i.vehicle_id = v.id)

union all
-- Seguro
select 'seguro:' || seg.id, 'seguro', 'Seguros', v.asset_id, v.id, null, seg.id,
       v.etiqueta,
       seg.aseguradora || ' · póliza ' || seg.numero_poliza,
       seg.fecha_vencimiento, (seg.fecha_vencimiento - current_date), null,
       public.fleet_estado(seg.fecha_vencimiento - current_date, null, s.dias_aviso, s.dias_urgente, s.avisos_km, s.urgente_km),
       null, seg.fecha_vencimiento < current_date
from seg join v on v.id = seg.vehicle_id cross join s

union all
select 'seguro-sin:' || v.id, 'seguro', 'Seguros', v.asset_id, v.id, null, null, v.etiqueta,
       'Sin póliza de seguro activa', null, null, null, 'vencido', null, true
from v
where v.tipo_vehiculo not in ('otro', 'remolque') and not exists (select 1 from public.vehicle_insurances p where p.vehicle_id = v.id and p.activa)

union all
-- Mantenimiento preventivo, calibraciones y certificaciones (lo primero que llegue: km o fecha)
select 'plan:' || p.id || ':' || coalesce(p.ultima_fecha::text, '') || ':' || coalesce(p.ultimo_km::text, ''),
       case when p.tipo = 'revision' then 'mantenimiento' else p.tipo end,
       case when p.tipo = 'revision' then 'Mantenimiento' else 'Calibraciones' end,
       p.asset_id, p.vehicle_id, null, p.id,
       coalesce(p.etiqueta, p.codigo_interno || ' · ' || p.asset_nombre),
       p.nombre || concat(' (cada ', concat_ws(' o ', replace(to_char(p.cada_km, 'FM999,999'), ',', '.') || ' km',
                                              p.cada_meses || case when p.cada_meses = 1 then ' mes' else ' meses' end), ')'),
       p.proxima_fecha, (p.proxima_fecha - current_date), (p.proximo_km - p.km_actual),
       public.fleet_estado(p.proxima_fecha - current_date, p.proximo_km - p.km_actual, s.dias_aviso, s.dias_urgente, s.avisos_km, s.urgente_km),
       null, false
from planes p cross join s
where p.proxima_fecha is not null or p.proximo_km is not null

union all
-- Garantías (se avisa antes de que acaben; las acabadas hace más de 30 días ya no salen)
select 'garantia:' || a.id || ':' || a.fecha_fin_garantia, 'garantia', 'Garantías', a.id, v.id, null, a.id,
       a.codigo_interno || ' · ' || a.nombre, 'Fin de la garantía de compra',
       a.fecha_fin_garantia, (a.fecha_fin_garantia - current_date), null,
       case when a.fecha_fin_garantia < current_date then 'vencido'
            when a.fecha_fin_garantia - current_date <= least(s.garantia_dias, s.dias_urgente) then 'urgente'
            when a.fecha_fin_garantia - current_date <= s.garantia_dias then 'proximo'
            else 'vigente' end,
       a.obra_id, false
from public.assets a left join public.vehicles v on v.asset_id = a.id cross join s
where a.fecha_fin_garantia is not null and a.estado not in ('baja', 'devuelto_proveedor')
  and a.tipo_adquisicion = 'propiedad'
  and a.fecha_fin_garantia >= current_date - 30

union all
-- Documentos con caducidad (tarjeta de transporte, autorizaciones, certificados...)
select 'doc:' || d.id, 'documento', 'Documentos', a.id, v.id, null, d.id,
       coalesce(v.matricula || ' · ', a.codigo_interno || ' · ') || a.nombre,
       d.nombre || coalesce(' nº ' || d.numero, ''),
       d.fecha_caducidad, (d.fecha_caducidad - current_date), null,
       public.fleet_estado(d.fecha_caducidad - current_date, null, s.dias_aviso, s.dias_urgente, s.avisos_km, s.urgente_km),
       a.obra_id, (d.tipo in ('tarjeta_transporte', 'autorizacion', 'permiso_circulacion') and d.fecha_caducidad < current_date)
from public.asset_documents d
join public.assets a on a.id = d.asset_id and a.estado <> 'baja'
left join public.vehicles v on v.asset_id = a.id
cross join s
where d.activo and d.fecha_caducidad is not null

union all
-- Neumáticos por debajo de 3 mm (1,6 mm es el mínimo legal)
select 'neumatico:' || t.id || ':' || coalesce(t.profundidad_mm::text, ''), 'neumatico', 'Mantenimiento', v.asset_id, v.id, null, t.id,
       v.etiqueta, 'Neumático ' || replace(t.posicion, '_', ' ') || ': ' || t.profundidad_mm || ' mm',
       null, null, null,
       case when t.profundidad_mm < 1.6 then 'vencido' when t.profundidad_mm < 2.5 then 'urgente' else 'proximo' end,
       null, t.profundidad_mm < 1.6
from public.vehicle_tires t join v on v.id = t.vehicle_id
where t.activo and t.profundidad_mm is not null and t.profundidad_mm < 3

union all
-- Devolución de alquileres
select 'alquiler:' || r.id || ':' || r.fecha_prevista_devolucion, 'alquiler', 'Alquileres', a.id, v.id, r.id, r.id,
       a.nombre || coalesce(' · ' || coalesce(sp.name, r.arrendador_nombre), ''),
       'Fin de alquiler' || coalesce(' (contrato ' || r.numero_contrato || ')', ''),
       r.fecha_prevista_devolucion, (r.fecha_prevista_devolucion - current_date), null,
       case when r.fecha_prevista_devolucion < current_date then 'vencido'
            when r.fecha_prevista_devolucion - current_date <= 1 then 'urgente'
            when r.fecha_prevista_devolucion - current_date <= s.alquiler_dias then 'proximo'
            else 'vigente' end,
       r.obra_id, false
from public.asset_rentals r
join public.assets a on a.id = r.asset_id
left join public.vehicles v on v.asset_id = a.id
left join public.suppliers sp on sp.id = r.supplier_id
cross join s
where r.estado = 'activo'

union all
-- Stock mínimo de consumibles
select 'stock:' || a.id, 'stock', 'Stock', a.id, null, null, a.id,
       a.codigo_interno || ' · ' || a.nombre,
       'Quedan ' || replace(trim_scale(a.cantidad)::text, '.', ',') || ' ' || a.unidad || ' (mínimo ' || replace(trim_scale(a.stock_minimo)::text, '.', ',') || ')',
       null, null, null, case when a.cantidad <= 0 then 'vencido' else 'proximo' end, null, false
from public.assets a
where a.stock_minimo is not null and a.cantidad <= a.stock_minimo and a.estado <> 'baja';

-- -------------------------------------------------------------------------
-- 8. VISTA DE COSTES (centro de coste por vehículo / máquina e imputación a obra)
--    base = sin IVA; total = con IVA.
-- -------------------------------------------------------------------------
drop view if exists public.fleet_costes;
create view public.fleet_costes with (security_invoker = true) as
select 'combustible' as origen, f.id, v.asset_id, f.vehicle_id, f.obra_id, f.fecha::date as fecha,
       'Combustible ' || v.matricula || ' · ' || f.litros || ' l' as concepto,
       coalesce(f.estacion, 'Gasolinera') as proveedor, null::text as numero,
       round(f.importe / (1 + f.iva_pct / 100), 2) as base, f.importe as total, f.iva_pct,
       f.ticket_path as file_path
from public.vehicle_fuel_logs f join public.vehicles v on v.id = f.vehicle_id
union all
select 'mantenimiento', m.id, m.asset_id, v.id, m.obra_id, m.fecha,
       initcap(replace(m.tipo, '_', ' ')) || ' · ' || coalesce(v.matricula, a.codigo_interno) || ' · ' || left(m.descripcion, 120),
       coalesce(sp.name, m.taller_nombre, 'Taller'), m.numero_factura,
       m.base_imponible, m.importe_total, m.iva_pct, m.factura_path
from public.asset_maintenance m
join public.assets a on a.id = m.asset_id
left join public.vehicles v on v.asset_id = m.asset_id
left join public.suppliers sp on sp.id = m.supplier_id
union all
select 'itv', i.id, v.asset_id, v.id, null, coalesce(i.fecha_inspeccion, i.created_at::date),
       'ITV ' || v.matricula, coalesce(i.estacion, 'Estación ITV'), null,
       round(i.coste / 1.21, 2), i.coste, 21, i.informe_path
from public.vehicle_inspections i join public.vehicles v on v.id = i.vehicle_id
where i.coste > 0
union all
select 'seguro', p.id, v.asset_id, v.id, null, p.fecha_inicio,
       'Seguro ' || v.matricula || ' · ' || p.aseguradora, p.aseguradora, p.numero_poliza,
       p.prima, p.prima, 0, p.poliza_path            -- los seguros están exentos de IVA
from public.vehicle_insurances p join public.vehicles v on v.id = p.vehicle_id
where coalesce(p.prima, 0) > 0
union all
select 'alquiler', r.id, r.asset_id, v.id, r.obra_id, r.fecha_inicio,
       'Alquiler ' || a.nombre || ' (' || to_char(r.fecha_inicio, 'DD/MM') || ' – '
         || to_char(coalesce(r.fecha_devolucion, r.fecha_prevista_devolucion), 'DD/MM') || ')'
         || case when r.estado = 'activo' and r.importe_final is null then ' · en curso' else '' end,
       coalesce(sp.name, r.arrendador_nombre, 'Arrendadora'), r.numero_factura,
       round(public.rental_base(r), 2), round(public.rental_base(r) * (1 + r.iva_pct / 100), 2), r.iva_pct, r.contrato_path
from public.asset_rentals r
join public.assets a on a.id = r.asset_id
left join public.vehicles v on v.asset_id = r.asset_id
left join public.suppliers sp on sp.id = r.supplier_id;

-- -------------------------------------------------------------------------
-- 9. AVISOS: crea en la campana un aviso por alerta y etapa (30, 15, 7 días, km,
--    vencido) una sola vez. Devuelve los avisos creados para que el servidor mande
--    el push y, si está activado, el correo. Se puede programar con pg_cron (abajo).
-- -------------------------------------------------------------------------
create or replace function public.fleet_generar_avisos()
returns setof public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  v_etapa text;
  v_dias int[];
  v_km int;
  n public.notifications;
begin
  select avisos_dias, avisos_km into v_dias, v_km from public.fleet_settings where id;
  for a in select * from public.fleet_alertas where estado <> 'vigente' loop
    v_etapa := case
      when a.estado = 'vencido' then 'vencido'
      when a.km_restantes is not null and a.km_restantes <= v_km
           and (a.dias_restantes is null or a.dias_restantes > (select min(x) from unnest(v_dias) x)) then 'km'
      when a.dias_restantes is not null then
        'd' || coalesce((select min(x) from unnest(v_dias) x where a.dias_restantes <= x), a.dias_restantes)
      else a.estado
    end;
    insert into public.fleet_alert_log (alert_key, etapa) values (a.alert_key, v_etapa)
      on conflict do nothing;
    if found then
      insert into public.notifications (category, origin, obra_id, title, body, link, ref_table, ref_id)
      values (
        case when a.estado = 'vencido' then 'urgente' else 'aviso' end,
        'sistema',
        a.obra_id,
        left(a.grupo || ' · ' || a.elemento, 200),
        left(a.detalle || case
          when a.estado = 'vencido' and a.dias_restantes is not null then '. Venció hace ' || abs(a.dias_restantes) || ' días.'
          when a.estado = 'vencido' then '.'
          when a.km_restantes is not null and v_etapa = 'km' then '. Faltan ' || a.km_restantes || ' km.'
          when a.dias_restantes = 0 then '. Vence hoy.'
          when a.dias_restantes = 1 then '. Vence mañana (' || to_char(a.fecha_vencimiento, 'DD/MM/YYYY') || ').'
          when a.dias_restantes is not null then '. Vence en ' || a.dias_restantes || ' días (' || to_char(a.fecha_vencimiento, 'DD/MM/YYYY') || ').'
          else '.' end, 2000),
        '#admin/alertas',
        'fleet_alertas',
        a.ref_id
      )
      returning * into n;
      return next n;
    end if;
  end loop;
  return;
end;
$$;
revoke all on function public.fleet_generar_avisos() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 10. SEGURIDAD (RLS)
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['asset_categories', 'assets', 'vehicles', 'vehicle_inspections', 'vehicle_insurances',
    'vehicle_fuel_logs', 'maintenance_plans', 'asset_maintenance', 'vehicle_tires', 'asset_documents',
    'asset_rentals', 'inventory_movements', 'fleet_settings', 'fleet_alert_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    if t = 'inventory_movements' then
      -- Solo lectura incluso para administradores (lo escribe el trigger).
      execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin', t);
    else
      execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
    end if;
  end loop;
end
$$;

revoke insert, update, delete, truncate on public.inventory_movements from authenticated;
revoke insert, update, delete, truncate on public.fleet_alert_log from authenticated;

-- Operario: categorías (lectura), lo que tiene asignado y el vehículo que conduce.
drop policy if exists asset_categories_leer on public.asset_categories;
create policy asset_categories_leer on public.asset_categories
  for select to authenticated using (public.current_obrero_id() is not null);

drop policy if exists vehicles_conductor on public.vehicles;
create policy vehicles_conductor on public.vehicles
  for select to authenticated
  using (conductor_operario_id is not null and conductor_operario_id = public.current_obrero_id());

drop policy if exists assets_operario on public.assets;
create policy assets_operario on public.assets
  for select to authenticated
  using (
    (operario_id is not null and operario_id = public.current_obrero_id())
    or exists (select 1 from public.vehicles v
               where (v.id = assets.vehicle_id or v.asset_id = assets.id)
                 and v.conductor_operario_id is not null
                 and v.conductor_operario_id = public.current_obrero_id())
  );

-- ITV y seguro (con el teléfono de asistencia) del vehículo que conduce.
drop policy if exists vehicle_inspections_conductor on public.vehicle_inspections;
create policy vehicle_inspections_conductor on public.vehicle_inspections
  for select to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_inspections.vehicle_id
                   and v.conductor_operario_id is not null and v.conductor_operario_id = public.current_obrero_id()));

drop policy if exists vehicle_insurances_conductor on public.vehicle_insurances;
create policy vehicle_insurances_conductor on public.vehicle_insurances
  for select to authenticated
  using (activa and exists (select 1 from public.vehicles v where v.id = vehicle_insurances.vehicle_id
                   and v.conductor_operario_id is not null and v.conductor_operario_id = public.current_obrero_id()));

-- Repostajes: el operario ve y apunta los suyos (no los cambia ni los borra).
drop policy if exists vehicle_fuel_logs_operario_leer on public.vehicle_fuel_logs;
create policy vehicle_fuel_logs_operario_leer on public.vehicle_fuel_logs
  for select to authenticated
  using (operario_id is not null and operario_id = public.current_obrero_id());

drop policy if exists vehicle_fuel_logs_operario_apuntar on public.vehicle_fuel_logs;
create policy vehicle_fuel_logs_operario_apuntar on public.vehicle_fuel_logs
  for insert to authenticated
  with check (operario_id is not null and operario_id = public.current_obrero_id() and created_by = auth.uid());

-- Historial: el operario ve los movimientos en los que ha recibido o entregado algo.
drop policy if exists inventory_movements_operario on public.inventory_movements;
create policy inventory_movements_operario on public.inventory_movements
  for select to authenticated
  using (public.current_obrero_id() is not null
         and public.current_obrero_id() in (a_operario_id, de_operario_id));

-- Funciones internas: no se llaman desde el navegador.
revoke all on function public.fleet_subir_km(uuid, int) from public, anon, authenticated;
revoke all on function public.assets_audit() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 11. ARCHIVOS: bucket privado (PDF e imágenes hasta 15 MB)
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flota-docs', 'flota-docs', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------------------
-- 12. OPCIONAL: revisión diaria en la propia base de datos (pg_cron)
--     El servidor ya revisa las alertas al arrancar y cada 6 horas. Si el servidor
--     duerme (plan gratuito de Render), activa pg_cron en Database > Extensions y
--     vuelve a ejecutar este archivo: programará la revisión a las 7:00 (UTC).
--     Los avisos creados así salen en la campana, pero sin push ni correo.
-- -------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('obramaster-alertas-flota', '0 7 * * *', 'select count(*) from public.fleet_generar_avisos()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: %', sqlerrm;
end
$$;
