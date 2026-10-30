-- =========================================================================
-- OBRAMASTER - FACTURACIÓN LEGAL VERI*FACTU
--   Fase 1: numeración, inmutabilidad y huella encadenada.
--   Fase 2: anulación, rectificativas por sustitución y por diferencias,
--           subsanación de registros rechazados, entorno de pruebas separado,
--           cola de envío a la AEAT y certificados cifrados.
--
-- Tablas:
--   companies              empresa o autónomo que factura (NIF emisor, interruptor, envío AEAT)
--   tax_settings           fiscalidad por defecto de cada empresa
--   construction_projects  datos fiscales de cada obra (tipo de obra, IVA, ISP)
--   invoice_series         series por empresa, entorno y ejercicio con su último número
--   invoices               facturas (borrador -> emitida, emitida = solo lectura)
--   verifactu_records      registros de facturación (alta / anulación) con huella encadenada
--   verifactu_envios       cada envío a la AEAT y su respuesta
--   company_certificates   certificado electrónico de la empresa, cifrado por el servidor
--   audit_events           registro de eventos encadenado (no se puede modificar)
--
-- Reglas que aplica la propia base de datos (aunque falle la app):
--   - Solo se emite con emitir_factura(): numeración correlativa sin huecos por
--     serie, entorno y ejercicio (bloqueo de fila) y registro VeriFactu en la misma transacción.
--   - Una factura emitida no se borra ni cambia; solo su estado de cobro. Se anula
--     con anular_factura() (registro de anulación) o se corrige con una rectificativa.
--   - Los registros VeriFactu y de auditoría no se borran ni se modifican
--     (salvo el estado del envío a la AEAT).
--   - Las facturas de pruebas (entorno "pruebas") llevan el prefijo PRUEBA- y una
--     cadena de huellas propia: nunca se mezclan con las reales.
--
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Requiere antes supabase_migration_seguridad.sql (tabla profiles, is_admin()).
-- Se puede ejecutar más de una vez sin romper nada (también si ya se ejecutó la fase 1).
--
-- El navegador solo puede LEER (administradores). Todo lo que escribe lo hace
-- el servidor con la clave service_role. Los certificados no los lee nadie salvo el servidor.
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. EMPRESAS
-- -------------------------------------------------------------------------
create table if not exists public.companies (
  id                   uuid primary key default gen_random_uuid(),
  nif                  text not null check (nif ~ '^[A-Z0-9]{9}$'),
  razon_social         text not null check (length(trim(razon_social)) > 0),
  domicilio            text not null default '',
  regimen              text not null default 'autonomo' check (regimen in ('autonomo', 'sociedad')),
  facturacion_activada boolean not null default false,
  verifactu_entorno    text not null default 'pruebas' check (verifactu_entorno in ('pruebas', 'produccion')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Fase 2: dirección desglosada (Facturae), régimen de IRPF y estado del envío a la AEAT.
alter table public.companies add column if not exists codigo_postal     text not null default '';
alter table public.companies add column if not exists municipio         text not null default '';
alter table public.companies add column if not exists provincia         text not null default '';
alter table public.companies add column if not exists regimen_irpf      text not null default 'directa';
alter table public.companies add column if not exists envio_aeat_activo boolean not null default false;
alter table public.companies add column if not exists proximo_envio_at  timestamptz;
alter table public.companies add column if not exists ultimo_envio_at   timestamptz;
alter table public.companies add column if not exists ultimo_envio_estado text;
alter table public.companies add column if not exists ultimo_envio_error  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_regimen_irpf_check') then
    alter table public.companies add constraint companies_regimen_irpf_check
      check (regimen_irpf in ('directa', 'objetiva'));
  end if;
end
$$;

create unique index if not exists companies_nif_key on public.companies (nif);

-- El NIF es parte de la cadena de huellas: no cambia después de la primera factura.
-- De producción no se vuelve a pruebas.
create or replace function public.companies_guard()
returns trigger
language plpgsql
as $$
begin
  if new.nif <> old.nif and exists (select 1 from public.invoices where company_id = old.id and status = 'ISSUED') then
    raise exception 'El NIF no se puede cambiar: ya hay facturas emitidas con %.', old.nif;
  end if;
  if old.verifactu_entorno = 'produccion' and new.verifactu_entorno <> 'produccion' then
    raise exception 'La empresa ya factura en producción: no se puede volver al entorno de pruebas.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists companies_guard on public.companies;
create trigger companies_guard
before update on public.companies
for each row execute function public.companies_guard();

alter table public.profiles add column if not exists company_id uuid references public.companies (id);
create index if not exists profiles_company_idx on public.profiles (company_id);

-- -------------------------------------------------------------------------
-- 2. FISCALIDAD POR DEFECTO
-- -------------------------------------------------------------------------
create table if not exists public.tax_settings (
  company_id         uuid primary key references public.companies (id) on delete cascade,
  serie_ordinaria    text not null default 'F' check (serie_ordinaria ~ '^[A-Z0-9]{1,10}$'),
  serie_rectificativa text not null default 'R' check (serie_rectificativa ~ '^[A-Z0-9]{1,10}$'),
  iva_por_defecto_pct numeric(5,2) not null default 21 check (iva_por_defecto_pct in (0, 4, 5, 10, 21)),
  irpf_por_defecto_pct numeric(5,2) not null default 0 check (irpf_por_defecto_pct between 0 and 47),
  texto_isp          text not null default 'Operación con inversión del sujeto pasivo conforme al art. 84.Uno.2º.f) de la Ley 37/1992 del IVA.',
  dias_vencimiento   integer not null default 30 check (dias_vencimiento between 0 and 365),
  updated_at         timestamptz not null default now(),
  check (serie_ordinaria <> serie_rectificativa)
);

-- -------------------------------------------------------------------------
-- 3. OBRAS (datos fiscales; el resto de la obra sigue en app_records)
-- -------------------------------------------------------------------------
create table if not exists public.construction_projects (
  id                       text primary key,               -- mismo id que la obra de la app
  company_id               uuid not null references public.companies (id),
  codigo                   text not null default '',
  nombre                   text not null,
  direccion                text not null default '',
  tipo_obra                text not null default 'obra_nueva'
                             check (tipo_obra in ('obra_nueva', 'rehabilitacion', 'reforma_vivienda', 'otra')),
  promotor_es_constructor  boolean not null default false, -- true = inversión del sujeto pasivo
  iva_pct                  numeric(5,2) check (iva_pct in (0, 4, 5, 10, 21)),
  responsable              text not null default '',
  fecha_inicio             date,
  fecha_fin_prevista       date,
  presupuesto_adjudicacion numeric(14,2),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Fase 2: respuestas del asistente de IVA de obra (backend/verifactu/fiscalidadObra.js).
alter table public.construction_projects add column if not exists datos_fiscales jsonb not null default '{}'::jsonb;
alter table public.construction_projects add column if not exists isp boolean not null default false;
alter table public.construction_projects add column if not exists iva_motivo text not null default '';

create index if not exists construction_projects_company_idx on public.construction_projects (company_id);

-- -------------------------------------------------------------------------
-- 4. SERIES
-- -------------------------------------------------------------------------
create table if not exists public.invoice_series (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  codigo        text not null check (codigo ~ '^[A-Z0-9]{1,10}$'),
  tipo          text not null check (tipo in ('ordinaria', 'rectificativa')),
  ejercicio     integer not null check (ejercicio between 2000 and 2100),
  ultimo_numero integer not null default 0 check (ultimo_numero >= 0),
  created_at    timestamptz not null default now()
);

-- Fase 2: las series de pruebas y las de producción son distintas.
alter table public.invoice_series add column if not exists entorno text not null default 'pruebas';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoice_series_entorno_check') then
    alter table public.invoice_series add constraint invoice_series_entorno_check check (entorno in ('pruebas', 'produccion'));
  end if;
  if exists (select 1 from pg_constraint where conname = 'invoice_series_company_id_codigo_ejercicio_key') then
    alter table public.invoice_series drop constraint invoice_series_company_id_codigo_ejercicio_key;
  end if;
end
$$;
create unique index if not exists invoice_series_clave_key on public.invoice_series (company_id, entorno, codigo, ejercicio);

-- El contador solo sube, de uno en uno, y la serie no cambia de dueño ni de código.
create or replace function public.invoice_series_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.ultimo_numero > 0 then
      raise exception 'La serie %-% ya tiene facturas y no se puede borrar.', old.codigo, old.ejercicio;
    end if;
    return old;
  end if;
  if new.company_id <> old.company_id or new.codigo <> old.codigo or new.entorno <> old.entorno
     or new.ejercicio <> old.ejercicio or new.tipo <> old.tipo then
    raise exception 'No se puede cambiar la empresa, el código, el entorno, el tipo ni el ejercicio de una serie.';
  end if;
  if new.ultimo_numero <> old.ultimo_numero and new.ultimo_numero <> old.ultimo_numero + 1 then
    raise exception 'La numeración de la serie % solo puede avanzar de uno en uno.', old.codigo;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_series_guard on public.invoice_series;
create trigger invoice_series_guard
before update or delete on public.invoice_series
for each row execute function public.invoice_series_guard();

-- -------------------------------------------------------------------------
-- 5. FACTURAS
-- -------------------------------------------------------------------------
create table if not exists public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id),
  status               text not null default 'DRAFT' check (status in ('DRAFT', 'ISSUED')),
  tipo_factura         text not null default 'F1' check (tipo_factura in ('F1', 'R1', 'R2', 'R3', 'R4')),
  series_id            uuid references public.invoice_series (id),
  numero               integer,
  num_serie            text,
  fecha_expedicion     date,
  descripcion          text not null default '',
  cliente_nombre       text not null check (length(trim(cliente_nombre)) > 0),
  cliente_nif          text not null default '',
  cliente_direccion    text not null default '',
  obra_id              text,
  presupuesto_id       text,
  lineas               jsonb not null default '[]'::jsonb,
  base_imponible       numeric(14,2) not null default 0,
  iva_pct              numeric(5,2) not null default 21 check (iva_pct in (0, 4, 5, 10, 21)),
  cuota_iva            numeric(14,2) not null default 0,
  isp                  boolean not null default false,
  irpf_pct             numeric(5,2) not null default 0 check (irpf_pct between 0 and 47),
  cuota_irpf           numeric(14,2) not null default 0,
  importe_total        numeric(14,2) not null default 0, -- base + IVA (el que va a la AEAT)
  liquido              numeric(14,2) not null default 0, -- lo que paga el cliente (menos IRPF)
  rectifica_invoice_id uuid references public.invoices (id),
  rectificacion_causa  text,
  fecha_vencimiento    date,
  estado_cobro         text not null default 'pendiente' check (estado_cobro in ('pendiente', 'cobrada')),
  fecha_cobro          date,
  metodo_pago          text not null default '',
  huella               text,
  qr_url               text,
  issued_at            timestamptz,
  issued_by            uuid,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (status = 'DRAFT' or (numero is not null and num_serie is not null and fecha_expedicion is not null and huella is not null)),
  check ((tipo_factura = 'F1') = (rectifica_invoice_id is null)),
  check (tipo_factura <> 'F1' or base_imponible >= 0)
);

-- Fase 2
alter table public.invoices add column if not exists entorno               text not null default 'pruebas';
alter table public.invoices add column if not exists tipo_rectificativa    text;          -- I = diferencias, S = sustitución
alter table public.invoices add column if not exists base_rectificada      numeric(14,2); -- solo sustitución: base de la original
alter table public.invoices add column if not exists cuota_rectificada     numeric(14,2); -- solo sustitución: cuota de la original
alter table public.invoices add column if not exists fecha_operacion       date;          -- si la obra se hizo en otra fecha
alter table public.invoices add column if not exists cliente_tipo          text not null default 'empresa';
alter table public.invoices add column if not exists cliente_codigo_postal text not null default '';
alter table public.invoices add column if not exists cliente_municipio     text not null default '';
alter table public.invoices add column if not exists cliente_provincia     text not null default '';
alter table public.invoices add column if not exists iva_motivo            text not null default '';
alter table public.invoices add column if not exists anulada               boolean not null default false;
alter table public.invoices add column if not exists anulada_at            timestamptz;
alter table public.invoices add column if not exists anulada_by            uuid;
alter table public.invoices add column if not exists anulacion_motivo      text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_entorno_check') then
    alter table public.invoices add constraint invoices_entorno_check check (entorno in ('pruebas', 'produccion'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_cliente_tipo_check') then
    alter table public.invoices add constraint invoices_cliente_tipo_check check (cliente_tipo in ('particular', 'empresa'));
  end if;
  -- NOT VALID: no se exige a rectificativas de la fase 1 que ya existan.
  if not exists (select 1 from pg_constraint where conname = 'invoices_tipo_rectificativa_check') then
    alter table public.invoices add constraint invoices_tipo_rectificativa_check check (
      (tipo_factura = 'F1' and tipo_rectificativa is null)
      or (tipo_factura <> 'F1' and tipo_rectificativa in ('I', 'S'))
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_sustitucion_check') then
    alter table public.invoices add constraint invoices_sustitucion_check check (
      coalesce(tipo_rectificativa, '') <> 'S' or status = 'DRAFT'
      or (base_rectificada is not null and cuota_rectificada is not null and base_imponible >= 0)
    ) not valid;
  end if;
end
$$;

create unique index if not exists invoices_num_serie_key on public.invoices (company_id, num_serie);
create index if not exists invoices_company_idx on public.invoices (company_id, created_at desc);
create index if not exists invoices_rectifica_idx on public.invoices (rectifica_invoice_id) where rectifica_invoice_id is not null;

-- Importes calculados siempre aquí, para que la app no pueda descuadrarlos.
-- Bloqueo: emitida = solo lectura salvo el cobro (y la marca de anulada, solo desde
-- anular_factura()). Emitir solo con emitir_factura().
create or replace function public.invoices_guard()
returns trigger
language plpgsql
as $$
declare
  editable text[] := array['estado_cobro', 'fecha_cobro', 'metodo_pago', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status = 'ISSUED' then
      raise exception 'La factura % está emitida y no se puede borrar. Emite una rectificativa o anúlala.', old.num_serie;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'ISSUED' then
    if coalesce(current_setting('obramaster.anulando', true), '') = 'on' and not old.anulada then
      editable := editable || array['anulada', 'anulada_at', 'anulada_by', 'anulacion_motivo'];
    end if;
    if (to_jsonb(new) - editable) is distinct from (to_jsonb(old) - editable) then
      raise exception 'La factura % está emitida: solo se puede cambiar el cobro. Para corregirla emite una rectificativa.', old.num_serie;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.status = 'ISSUED' and coalesce(current_setting('obramaster.emitiendo', true), '') <> 'on' then
    raise exception 'Las facturas solo se emiten con emitir_factura().';
  end if;
  if new.anulada then
    raise exception 'Una factura solo se anula con anular_factura().';
  end if;

  new.cliente_nif := upper(regexp_replace(coalesce(new.cliente_nif, ''), '[^A-Za-z0-9]', '', 'g'));
  new.cuota_iva := case when new.isp then 0 else round(new.base_imponible * new.iva_pct / 100, 2) end;
  new.cuota_irpf := round(new.base_imponible * new.irpf_pct / 100, 2);
  new.importe_total := new.base_imponible + new.cuota_iva;
  new.liquido := new.importe_total - new.cuota_irpf;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard
before insert or update or delete on public.invoices
for each row execute function public.invoices_guard();

-- -------------------------------------------------------------------------
-- 6. REGISTROS VERIFACTU (huella encadenada por empresa y entorno)
-- -------------------------------------------------------------------------
create table if not exists public.verifactu_records (
  id               bigint generated always as identity primary key,
  company_id       uuid not null references public.companies (id),
  invoice_id       uuid not null references public.invoices (id),
  tipo_registro    text not null check (tipo_registro in ('alta', 'anulacion')),
  nif_emisor       text not null,
  num_serie        text not null,
  fecha_expedicion text not null,                -- DD-MM-AAAA, tal como entra en la huella
  tipo_factura     text,
  cuota_total      text,
  importe_total    text,
  anterior_id      bigint references public.verifactu_records (id),
  huella_anterior  text,
  fecha_hora_huso  text not null,
  cadena           text not null,                -- texto exacto del que sale la huella
  huella           text not null check (huella ~ '^[0-9A-F]{64}$'),
  estado_envio     text not null default 'pendiente'
                     check (estado_envio in ('pendiente', 'aceptado', 'aceptado_con_errores', 'rechazado')),
  csv_aeat         text,
  respuesta_aeat   jsonb,
  enviado_at       timestamptz,
  created_at       timestamptz not null default now()
);

-- Fase 2
alter table public.verifactu_records add column if not exists entorno             text not null default 'pruebas';
alter table public.verifactu_records add column if not exists subsanacion         text;  -- 'S' en una subsanación
alter table public.verifactu_records add column if not exists rechazo_previo      text;  -- 'S' o 'X' (ver Validaciones AEAT 3.1.3.2)
alter table public.verifactu_records add column if not exists sin_registro_previo text;  -- 'S' en anulación sin alta en la AEAT
alter table public.verifactu_records add column if not exists codigo_error        text;
alter table public.verifactu_records add column if not exists descripcion_error   text;
alter table public.verifactu_records add column if not exists intentos            integer not null default 0;
alter table public.verifactu_records add column if not exists ultimo_intento_at   timestamptz;

-- Cadena lineal por empresa y entorno: cada registro tiene un único sucesor y un solo primer registro.
drop index if exists public.verifactu_records_cadena_key;
create unique index if not exists verifactu_records_cadena_entorno_key
  on public.verifactu_records (company_id, entorno, coalesce(anterior_id, 0));
create index if not exists verifactu_records_invoice_idx on public.verifactu_records (invoice_id);
create index if not exists verifactu_records_pendientes_idx
  on public.verifactu_records (company_id, id) where estado_envio = 'pendiente';

create or replace function public.verifactu_records_guard()
returns trigger
language plpgsql
as $$
declare
  editable_envio constant text[] := array[
    'estado_envio', 'csv_aeat', 'respuesta_aeat', 'enviado_at',
    'codigo_error', 'descripcion_error', 'intentos', 'ultimo_intento_at'
  ];
begin
  if tg_op = 'DELETE' then
    raise exception 'Los registros VeriFactu no se pueden borrar.';
  end if;
  if (to_jsonb(new) - editable_envio) is distinct from (to_jsonb(old) - editable_envio) then
    raise exception 'Los registros VeriFactu no se pueden modificar (solo el estado del envío a la AEAT).';
  end if;
  return new;
end;
$$;

drop trigger if exists verifactu_records_guard on public.verifactu_records;
create trigger verifactu_records_guard
before update or delete on public.verifactu_records
for each row execute function public.verifactu_records_guard();

-- -------------------------------------------------------------------------
-- 6 bis. ENVÍOS A LA AEAT (solo se añaden)
-- -------------------------------------------------------------------------
create table if not exists public.verifactu_envios (
  id             bigint generated always as identity primary key,
  company_id     uuid not null references public.companies (id),
  entorno        text not null check (entorno in ('pruebas', 'produccion')),
  registros      integer not null default 0,
  estado_envio   text,                           -- Correcto | ParcialmenteCorrecto | Incorrecto | error
  csv_aeat       text,
  tiempo_espera  integer,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists verifactu_envios_company_idx on public.verifactu_envios (company_id, id desc);

create or replace function public.verifactu_envios_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'El histórico de envíos a la AEAT no se puede modificar ni borrar.';
end;
$$;

drop trigger if exists verifactu_envios_guard on public.verifactu_envios;
create trigger verifactu_envios_guard
before update or delete on public.verifactu_envios
for each row execute function public.verifactu_envios_guard();

-- -------------------------------------------------------------------------
-- 6 ter. CERTIFICADOS (cifrados con AES-256-GCM por el servidor; la clave no está en la base de datos)
-- -------------------------------------------------------------------------
create table if not exists public.company_certificates (
  company_id     uuid primary key references public.companies (id) on delete cascade,
  pfx_cifrado    text not null,
  clave_cifrada  text not null,
  titular        text not null default '',
  nif_titular    text not null default '',
  numero_serie   text not null default '',
  valido_desde   timestamptz,
  valido_hasta   timestamptz,
  subido_por     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 7. AUDITORÍA ENCADENADA
-- -------------------------------------------------------------------------
create table if not exists public.audit_events (
  id              bigint generated always as identity primary key,
  company_id      uuid references public.companies (id),
  user_id         uuid,
  evento          text not null,
  detalle         jsonb not null default '{}'::jsonb,
  huella_anterior text,
  huella          text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists audit_events_company_idx on public.audit_events (company_id, id desc);

create or replace function public.audit_events_chain()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'El registro de auditoría no se puede modificar ni borrar.';
  end if;
  perform pg_advisory_xact_lock(hashtext('audit_events:' || coalesce(new.company_id::text, '-')));
  select huella into new.huella_anterior
    from public.audit_events
   where company_id is not distinct from new.company_id
   order by id desc
   limit 1;
  new.created_at := now();
  new.huella := upper(encode(digest(convert_to(
    coalesce(new.huella_anterior, '') || '|' || new.evento || '|' || new.detalle::text || '|' ||
    coalesce(new.user_id::text, '') || '|' || to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'UTF8'), 'sha256'), 'hex'));
  return new;
end;
$$;

drop trigger if exists audit_events_chain on public.audit_events;
create trigger audit_events_chain
before insert or update or delete on public.audit_events
for each row execute function public.audit_events_chain();

-- -------------------------------------------------------------------------
-- 8. EMISIÓN, ANULACIÓN Y SUBSANACIÓN: número + registro VeriFactu + auditoría, todo o nada
-- -------------------------------------------------------------------------

-- Importe con dos decimales y punto, como en el XML de la AEAT ("12.35", "-3.00").
create or replace function public.verifactu_importe(valor numeric)
returns text
language sql
immutable
as $$
  select to_char(round(valor, 2), 'FM999999999999990.00');
$$;

-- Fecha, hora y huso de Madrid en ISO 8601 ("2027-06-01T10:15:00+02:00").
create or replace function public.verifactu_fecha_hora_huso(instante timestamptz default now())
returns text
language sql
stable
as $$
  select to_char(instante at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS')
      || case when (instante at time zone 'Europe/Madrid') >= (instante at time zone 'UTC') then '+' else '-' end
      || to_char(abs(extract(epoch from (instante at time zone 'Europe/Madrid') - (instante at time zone 'UTC'))) * interval '1 second', 'HH24:MI');
$$;

create or replace function public.verifactu_huella(cadena text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select upper(encode(digest(convert_to(cadena, 'UTF8'), 'sha256'), 'hex'));
$$;

-- Cadena de un registro de alta (orden de la especificación de la AEAT).
create or replace function public.verifactu_cadena_alta(
  p_nif text, p_num_serie text, p_fecha text, p_tipo text,
  p_cuota text, p_importe text, p_huella_anterior text, p_momento text)
returns text
language sql
immutable
as $$
  select 'IDEmisorFactura=' || p_nif
      || '&NumSerieFactura=' || p_num_serie
      || '&FechaExpedicionFactura=' || p_fecha
      || '&TipoFactura=' || p_tipo
      || '&CuotaTotal=' || p_cuota
      || '&ImporteTotal=' || p_importe
      || '&Huella=' || coalesce(p_huella_anterior, '')
      || '&FechaHoraHusoGenRegistro=' || p_momento;
$$;

create or replace function public.emitir_factura(p_invoice_id uuid, p_user_id uuid default null)
returns public.invoices
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv     public.invoices;
  comp    public.companies;
  ajustes public.tax_settings;
  orig    public.invoices;
  serie   public.invoice_series;
  prev    public.verifactu_records;
  hoy     date := (now() at time zone 'Europe/Madrid')::date;
  v_codigo text;
  v_entorno text;
  momento text := public.verifactu_fecha_hora_huso(now());
  fecha_txt text;
  v_cadena text;
  v_huella text;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Factura no encontrada.';
  end if;

  -- Bloquear la empresa serializa la numeración y la cadena de huellas.
  select * into comp from public.companies where id = inv.company_id for update;
  select * into inv from public.invoices where id = p_invoice_id for update;
  v_entorno := comp.verifactu_entorno;

  if inv.status <> 'DRAFT' then
    raise exception 'La factura % ya está emitida.', inv.num_serie;
  end if;
  if not comp.facturacion_activada then
    raise exception 'La facturación está desactivada para %.', comp.razon_social;
  end if;
  if trim(comp.domicilio) = '' then
    raise exception 'Falta el domicilio fiscal del emisor (Ajustes > Facturación).';
  end if;
  if inv.cliente_nif = '' then
    raise exception 'Falta el NIF del cliente: es obligatorio en una factura completa.';
  end if;
  if trim(inv.cliente_direccion) = '' then
    raise exception 'Falta el domicilio del cliente: es obligatorio en una factura completa (art. 6 RD 1619/2012).';
  end if;
  if inv.fecha_operacion is not null and inv.fecha_operacion > hoy + 365 then
    raise exception 'La fecha de la operación no puede ser posterior al año que viene.';
  end if;
  if inv.tipo_factura <> 'F1' then
    select * into orig from public.invoices where id = inv.rectifica_invoice_id;
    if not found or orig.company_id <> inv.company_id or orig.status <> 'ISSUED' then
      raise exception 'Una rectificativa debe referirse a una factura emitida de la misma empresa.';
    end if;
    if orig.anulada then
      raise exception 'La factura % está anulada: no se puede rectificar.', orig.num_serie;
    end if;
    if orig.entorno <> v_entorno then
      raise exception 'No se puede rectificar una factura de otro entorno (pruebas/producción).';
    end if;
    if coalesce(trim(inv.rectificacion_causa), '') = '' then
      raise exception 'Indica la causa de la rectificación.';
    end if;
    if coalesce(inv.tipo_rectificativa, '') not in ('I', 'S') then
      raise exception 'Indica si la rectificativa es por diferencias (I) o por sustitución (S).';
    end if;
    if inv.tipo_rectificativa = 'S' then
      if inv.base_imponible < 0 then
        raise exception 'En una rectificativa por sustitución la base es el importe correcto completo (no negativo).';
      end if;
      -- La base y la cuota rectificadas son siempre las de la factura original.
      perform set_config('obramaster.emitiendo', 'off', true);
      update public.invoices
         set base_rectificada = orig.base_imponible, cuota_rectificada = orig.cuota_iva
       where id = inv.id
      returning * into inv;
    end if;
  end if;

  select * into ajustes from public.tax_settings where company_id = comp.id;
  v_codigo := case when inv.tipo_factura = 'F1'
                 then coalesce(ajustes.serie_ordinaria, 'F')
                 else coalesce(ajustes.serie_rectificativa, 'R') end;

  insert into public.invoice_series (company_id, entorno, codigo, tipo, ejercicio)
  values (comp.id, v_entorno, v_codigo, case when inv.tipo_factura = 'F1' then 'ordinaria' else 'rectificativa' end,
          extract(year from hoy)::int)
  on conflict (company_id, entorno, codigo, ejercicio) do nothing;

  update public.invoice_series
     set ultimo_numero = ultimo_numero + 1
   where company_id = comp.id and entorno = v_entorno and codigo = v_codigo and ejercicio = extract(year from hoy)::int
  returning * into serie;

  select * into prev
    from public.verifactu_records
   where company_id = comp.id and entorno = v_entorno
   order by id desc
   limit 1;

  inv.num_serie := format('%s%s-%s-%s', case when v_entorno = 'pruebas' then 'PRUEBA-' else '' end,
                          serie.codigo, serie.ejercicio, lpad(serie.ultimo_numero::text, 5, '0'));
  fecha_txt := to_char(hoy, 'DD-MM-YYYY');

  v_cadena := public.verifactu_cadena_alta(comp.nif, inv.num_serie, fecha_txt, inv.tipo_factura,
                public.verifactu_importe(inv.cuota_iva), public.verifactu_importe(inv.importe_total),
                prev.huella, momento);
  v_huella := public.verifactu_huella(v_cadena);

  perform set_config('obramaster.emitiendo', 'on', true);
  update public.invoices
     set status = 'ISSUED',
         entorno = v_entorno,
         series_id = serie.id,
         numero = serie.ultimo_numero,
         num_serie = inv.num_serie,
         fecha_expedicion = hoy,
         fecha_vencimiento = coalesce(fecha_vencimiento, hoy + coalesce(ajustes.dias_vencimiento, 30)),
         huella = v_huella,
         -- num_serie y NIF solo llevan [A-Z0-9-]: no necesitan codificarse en la URL.
         qr_url = case when v_entorno = 'produccion'
                       then 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'
                       else 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR' end
                  || '?nif=' || comp.nif || '&numserie=' || inv.num_serie
                  || '&fecha=' || fecha_txt || '&importe=' || public.verifactu_importe(inv.importe_total),
         issued_at = now(),
         issued_by = p_user_id
   where id = inv.id
  returning * into inv;
  perform set_config('obramaster.emitiendo', 'off', true);

  insert into public.verifactu_records (
    company_id, invoice_id, entorno, tipo_registro, nif_emisor, num_serie, fecha_expedicion, tipo_factura,
    cuota_total, importe_total, anterior_id, huella_anterior, fecha_hora_huso, cadena, huella
  ) values (
    comp.id, inv.id, v_entorno, 'alta', comp.nif, inv.num_serie, fecha_txt, inv.tipo_factura,
    public.verifactu_importe(inv.cuota_iva), public.verifactu_importe(inv.importe_total),
    prev.id, prev.huella, momento, v_cadena, v_huella
  );

  insert into public.audit_events (company_id, user_id, evento, detalle)
  values (comp.id, p_user_id, 'FACTURA_EMITIDA',
          jsonb_build_object('invoice_id', inv.id, 'num_serie', inv.num_serie, 'entorno', v_entorno,
                             'importe_total', inv.importe_total, 'huella', v_huella));

  return inv;
end;
$$;

-- Anulación (art. 10 RD 1007/2023): solo para una factura que no debió expedirse.
-- La factura y su número se conservan con la marca "anulada"; los errores se corrigen con rectificativas.
create or replace function public.anular_factura(p_invoice_id uuid, p_user_id uuid default null, p_motivo text default '')
returns public.invoices
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv     public.invoices;
  comp    public.companies;
  prev    public.verifactu_records;
  momento text := public.verifactu_fecha_hora_huso(now());
  fecha_txt text;
  v_cadena text;
  v_huella text;
  v_sin_registro text;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Factura no encontrada.';
  end if;
  select * into comp from public.companies where id = inv.company_id for update;
  select * into inv from public.invoices where id = p_invoice_id for update;

  if inv.status <> 'ISSUED' then
    raise exception 'Solo se anulan facturas emitidas.';
  end if;
  if inv.anulada then
    raise exception 'La factura % ya está anulada.', inv.num_serie;
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indica el motivo de la anulación.';
  end if;
  if exists (select 1 from public.invoices r
              where r.rectifica_invoice_id = inv.id and r.status = 'ISSUED' and not r.anulada) then
    raise exception 'La factura % tiene rectificativas emitidas: anúlalas antes.', inv.num_serie;
  end if;

  -- Si la AEAT no tiene el alta (rechazada), la anulación lleva SinRegistroPrevio = S.
  v_sin_registro := case when exists (
      select 1 from public.verifactu_records
       where invoice_id = inv.id and tipo_registro = 'alta'
         and estado_envio in ('pendiente', 'aceptado', 'aceptado_con_errores'))
    then null else 'S' end;

  select * into prev
    from public.verifactu_records
   where company_id = comp.id and entorno = inv.entorno
   order by id desc
   limit 1;

  fecha_txt := to_char(inv.fecha_expedicion, 'DD-MM-YYYY');
  v_cadena := 'IDEmisorFacturaAnulada=' || comp.nif
           || '&NumSerieFacturaAnulada=' || inv.num_serie
           || '&FechaExpedicionFacturaAnulada=' || fecha_txt
           || '&Huella=' || coalesce(prev.huella, '')
           || '&FechaHoraHusoGenRegistro=' || momento;
  v_huella := public.verifactu_huella(v_cadena);

  insert into public.verifactu_records (
    company_id, invoice_id, entorno, tipo_registro, nif_emisor, num_serie, fecha_expedicion,
    anterior_id, huella_anterior, fecha_hora_huso, cadena, huella, sin_registro_previo
  ) values (
    comp.id, inv.id, inv.entorno, 'anulacion', comp.nif, inv.num_serie, fecha_txt,
    prev.id, prev.huella, momento, v_cadena, v_huella, v_sin_registro
  );

  perform set_config('obramaster.anulando', 'on', true);
  update public.invoices
     set anulada = true, anulada_at = now(), anulada_by = p_user_id, anulacion_motivo = left(trim(p_motivo), 500)
   where id = inv.id
  returning * into inv;
  perform set_config('obramaster.anulando', 'off', true);

  insert into public.audit_events (company_id, user_id, evento, detalle)
  values (comp.id, p_user_id, 'FACTURA_ANULADA',
          jsonb_build_object('invoice_id', inv.id, 'num_serie', inv.num_serie, 'motivo', inv.anulacion_motivo, 'huella', v_huella));

  return inv;
end;
$$;

-- Subsanación: nuevo registro de alta de la misma factura cuando la AEAT rechazó el
-- anterior (RechazoPrevio = X si nunca llegó a existir allí, S si existía) o lo aceptó con errores.
create or replace function public.subsanar_registro(p_invoice_id uuid, p_user_id uuid default null)
returns public.verifactu_records
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv     public.invoices;
  comp    public.companies;
  ultimo  public.verifactu_records;
  prev    public.verifactu_records;
  nuevo   public.verifactu_records;
  momento text := public.verifactu_fecha_hora_huso(now());
  v_rechazo text;
  v_cadena text;
  v_huella text;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Factura no encontrada.';
  end if;
  select * into comp from public.companies where id = inv.company_id for update;

  if inv.status <> 'ISSUED' or inv.anulada then
    raise exception 'Solo se subsanan registros de facturas emitidas y no anuladas.';
  end if;

  select * into ultimo from public.verifactu_records
   where invoice_id = inv.id and tipo_registro = 'alta'
   order by id desc limit 1;
  if not found then
    raise exception 'La factura no tiene registro de alta.';
  end if;

  if ultimo.estado_envio = 'rechazado' then
    v_rechazo := case when exists (
        select 1 from public.verifactu_records
         where invoice_id = inv.id and tipo_registro = 'alta' and estado_envio in ('aceptado', 'aceptado_con_errores'))
      then 'S' else 'X' end;
  elsif ultimo.estado_envio = 'aceptado_con_errores' then
    v_rechazo := null;
  else
    raise exception 'Solo se subsanan registros rechazados o aceptados con errores (estado actual: %).', ultimo.estado_envio;
  end if;

  select * into prev
    from public.verifactu_records
   where company_id = comp.id and entorno = inv.entorno
   order by id desc
   limit 1;

  v_cadena := public.verifactu_cadena_alta(ultimo.nif_emisor, ultimo.num_serie, ultimo.fecha_expedicion,
                ultimo.tipo_factura, ultimo.cuota_total, ultimo.importe_total, prev.huella, momento);
  v_huella := public.verifactu_huella(v_cadena);

  insert into public.verifactu_records (
    company_id, invoice_id, entorno, tipo_registro, nif_emisor, num_serie, fecha_expedicion, tipo_factura,
    cuota_total, importe_total, anterior_id, huella_anterior, fecha_hora_huso, cadena, huella,
    subsanacion, rechazo_previo
  ) values (
    comp.id, inv.id, inv.entorno, 'alta', ultimo.nif_emisor, ultimo.num_serie, ultimo.fecha_expedicion, ultimo.tipo_factura,
    ultimo.cuota_total, ultimo.importe_total, prev.id, prev.huella, momento, v_cadena, v_huella,
    'S', v_rechazo
  )
  returning * into nuevo;

  insert into public.audit_events (company_id, user_id, evento, detalle)
  values (comp.id, p_user_id, 'REGISTRO_SUBSANADO',
          jsonb_build_object('invoice_id', inv.id, 'num_serie', inv.num_serie, 'rechazo_previo', v_rechazo, 'huella', v_huella));

  return nuevo;
end;
$$;

revoke all on function public.emitir_factura(uuid, uuid) from public, anon, authenticated;
revoke all on function public.anular_factura(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.subsanar_registro(uuid, uuid) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 9. PERMISOS: el navegador (administradores) solo lee; escribe el servidor.
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'tax_settings', 'construction_projects', 'invoice_series',
    'invoices', 'verifactu_records', 'verifactu_envios', 'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_leer', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin() and %s)',
      t || '_admin_leer', t,
      case when t = 'companies' then 'id = (select company_id from public.profiles where id = auth.uid())'
           else 'company_id = (select company_id from public.profiles where id = auth.uid())' end
    );
  end loop;
end
$$;

-- Los certificados no se pueden leer desde el navegador (ni siquiera cifrados).
alter table public.company_certificates enable row level security;
revoke all on public.company_certificates from anon, authenticated;

-- Que la API de Supabase vea al momento las tablas y columnas nuevas.
notify pgrst, 'reload schema';
