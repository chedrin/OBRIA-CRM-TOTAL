-- =========================================================================
-- OBRAMASTER - FACTURACIÓN LEGAL (fase 1: numeración, inmutabilidad, VeriFactu)
--
-- Tablas:
--   companies              empresa o autónomo que factura (NIF emisor, interruptor)
--   tax_settings           fiscalidad por defecto de cada empresa
--   construction_projects  datos fiscales de cada obra (tipo de obra, IVA, ISP)
--   invoice_series         series por empresa y ejercicio con su último número
--   invoices               facturas (borrador -> emitida, emitida = solo lectura)
--   verifactu_records      registros de facturación con huella SHA-256 encadenada
--   audit_events           registro de eventos encadenado (no se puede modificar)
--
-- Reglas que aplica la propia base de datos (aunque falle la app):
--   - Solo se emite con emitir_factura(): numeración correlativa sin huecos por
--     serie y ejercicio (bloqueo de fila) y registro VeriFactu en la misma transacción.
--   - Una factura emitida no se borra ni cambia; solo su estado de cobro.
--   - Los registros VeriFactu y de auditoría no se borran ni se modifican
--     (salvo el estado del envío a la AEAT).
--
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Requiere antes supabase_migration_seguridad.sql (tabla profiles, is_admin()).
-- Se puede ejecutar más de una vez sin romper nada.
--
-- El navegador solo puede LEER (administradores). Todo lo que escribe lo hace
-- el servidor con la clave service_role.
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

create unique index if not exists companies_nif_key on public.companies (nif);

-- El NIF es parte de la cadena de huellas: no cambia después de la primera factura.
create or replace function public.companies_guard()
returns trigger
language plpgsql
as $$
begin
  if new.nif <> old.nif and exists (select 1 from public.invoices where company_id = old.id and status = 'ISSUED') then
    raise exception 'El NIF no se puede cambiar: ya hay facturas emitidas con %.', old.nif;
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
  created_at    timestamptz not null default now(),
  unique (company_id, codigo, ejercicio)
);

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
  if new.company_id <> old.company_id or new.codigo <> old.codigo
     or new.ejercicio <> old.ejercicio or new.tipo <> old.tipo then
    raise exception 'No se puede cambiar la empresa, el código, el tipo ni el ejercicio de una serie.';
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

create unique index if not exists invoices_num_serie_key on public.invoices (company_id, num_serie);
create index if not exists invoices_company_idx on public.invoices (company_id, created_at desc);

-- Importes calculados siempre aquí, para que la app no pueda descuadrarlos.
-- Bloqueo: emitida = solo lectura salvo el cobro. Emitir solo con emitir_factura().
create or replace function public.invoices_guard()
returns trigger
language plpgsql
as $$
declare
  editable_cobro constant text[] := array['estado_cobro', 'fecha_cobro', 'metodo_pago', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status = 'ISSUED' then
      raise exception 'La factura % está emitida y no se puede borrar. Emite una rectificativa.', old.num_serie;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'ISSUED' then
    if (to_jsonb(new) - editable_cobro) is distinct from (to_jsonb(old) - editable_cobro) then
      raise exception 'La factura % está emitida: solo se puede cambiar el cobro. Para corregirla emite una rectificativa.', old.num_serie;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.status = 'ISSUED' and coalesce(current_setting('obramaster.emitiendo', true), '') <> 'on' then
    raise exception 'Las facturas solo se emiten con emitir_factura().';
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
-- 6. REGISTROS VERIFACTU (huella encadenada por empresa)
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

-- Cadena lineal: cada registro tiene un único sucesor y solo hay un primer registro.
create unique index if not exists verifactu_records_cadena_key
  on public.verifactu_records (company_id, coalesce(anterior_id, 0));
create index if not exists verifactu_records_invoice_idx on public.verifactu_records (invoice_id);

create or replace function public.verifactu_records_guard()
returns trigger
language plpgsql
as $$
declare
  editable_envio constant text[] := array['estado_envio', 'csv_aeat', 'respuesta_aeat', 'enviado_at'];
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
-- 8. EMISIÓN: número + registro VeriFactu + auditoría, todo o nada
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

create or replace function public.emitir_factura(p_invoice_id uuid, p_user_id uuid default null)
returns public.invoices
language plpgsql
security definer
set search_path = public
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

  if inv.status <> 'DRAFT' then
    raise exception 'La factura % ya está emitida.', inv.num_serie;
  end if;
  if not comp.facturacion_activada then
    raise exception 'La facturación está desactivada para %.', comp.razon_social;
  end if;
  if inv.tipo_factura = 'F1' and inv.cliente_nif = '' then
    raise exception 'Falta el NIF del cliente: es obligatorio en una factura completa.';
  end if;
  if inv.tipo_factura <> 'F1' then
    select * into orig from public.invoices where id = inv.rectifica_invoice_id;
    if not found or orig.company_id <> inv.company_id or orig.status <> 'ISSUED' then
      raise exception 'Una rectificativa debe referirse a una factura emitida de la misma empresa.';
    end if;
    if coalesce(trim(inv.rectificacion_causa), '') = '' then
      raise exception 'Indica la causa de la rectificación.';
    end if;
  end if;

  select * into ajustes from public.tax_settings where company_id = comp.id;
  v_codigo := case when inv.tipo_factura = 'F1'
                 then coalesce(ajustes.serie_ordinaria, 'F')
                 else coalesce(ajustes.serie_rectificativa, 'R') end;

  insert into public.invoice_series (company_id, codigo, tipo, ejercicio)
  values (comp.id, v_codigo, case when inv.tipo_factura = 'F1' then 'ordinaria' else 'rectificativa' end,
          extract(year from hoy)::int)
  on conflict (company_id, codigo, ejercicio) do nothing;

  update public.invoice_series
     set ultimo_numero = ultimo_numero + 1
   where company_id = comp.id and codigo = v_codigo and ejercicio = extract(year from hoy)::int
  returning * into serie;

  select * into prev
    from public.verifactu_records
   where company_id = comp.id
   order by id desc
   limit 1;

  inv.num_serie := format('%s-%s-%s', serie.codigo, serie.ejercicio, lpad(serie.ultimo_numero::text, 5, '0'));
  fecha_txt := to_char(hoy, 'DD-MM-YYYY');

  -- Huella según la especificación de la AEAT para el registro de alta.
  v_cadena := 'IDEmisorFactura=' || comp.nif
           || '&NumSerieFactura=' || inv.num_serie
           || '&FechaExpedicionFactura=' || fecha_txt
           || '&TipoFactura=' || inv.tipo_factura
           || '&CuotaTotal=' || public.verifactu_importe(inv.cuota_iva)
           || '&ImporteTotal=' || public.verifactu_importe(inv.importe_total)
           || '&Huella=' || coalesce(prev.huella, '')
           || '&FechaHoraHusoGenRegistro=' || momento;
  v_huella := upper(encode(digest(convert_to(v_cadena, 'UTF8'), 'sha256'), 'hex'));

  perform set_config('obramaster.emitiendo', 'on', true);
  update public.invoices
     set status = 'ISSUED',
         series_id = serie.id,
         numero = serie.ultimo_numero,
         num_serie = inv.num_serie,
         fecha_expedicion = hoy,
         fecha_vencimiento = coalesce(fecha_vencimiento, hoy + coalesce(ajustes.dias_vencimiento, 30)),
         huella = v_huella,
         -- num_serie y NIF solo llevan [A-Z0-9-]: no necesitan codificarse en la URL.
         qr_url = case when comp.verifactu_entorno = 'produccion'
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
    company_id, invoice_id, tipo_registro, nif_emisor, num_serie, fecha_expedicion, tipo_factura,
    cuota_total, importe_total, anterior_id, huella_anterior, fecha_hora_huso, cadena, huella
  ) values (
    comp.id, inv.id, 'alta', comp.nif, inv.num_serie, fecha_txt, inv.tipo_factura,
    public.verifactu_importe(inv.cuota_iva), public.verifactu_importe(inv.importe_total),
    prev.id, prev.huella, momento, v_cadena, v_huella
  );

  insert into public.audit_events (company_id, user_id, evento, detalle)
  values (comp.id, p_user_id, 'FACTURA_EMITIDA',
          jsonb_build_object('invoice_id', inv.id, 'num_serie', inv.num_serie,
                             'importe_total', inv.importe_total, 'huella', v_huella));

  return inv;
end;
$$;

revoke all on function public.emitir_factura(uuid, uuid) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 9. PERMISOS: el navegador (administradores) solo lee; escribe el servidor.
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'tax_settings', 'construction_projects', 'invoice_series',
    'invoices', 'verifactu_records', 'audit_events'
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
