-- =========================================================================
-- OBRAMASTER - MIGRACIÓN DE SEGURIDAD (SUPABASE)
--
-- Qué hace este script:
--   1. Crea la tabla `profiles` (perfil + rol de cada usuario de Supabase Auth).
--   2. Crea la tabla `app_records`, donde la app guarda sus datos (obras,
--      presupuestos, facturas, empleados...) en formato JSON.
--   3. ELIMINA las políticas abiertas "Permitir todo acceso ..." y las
--      sustituye por políticas reales: solo administradores, o lo mínimo
--      imprescindible para los obreros.
--   4. Quita el acceso del rol anónimo (anon) a todas las tablas.
--
-- Cómo ejecutarlo:
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Se puede ejecutar más de una vez sin romper nada.
--
-- IMPORTANTE: tras ejecutarlo, nadie podrá entrar a los datos hasta que
-- exista al menos un administrador. Sigue el PASO FINAL del final del archivo.
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. PERFILES (uno por usuario de Supabase Auth)
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null,
  auth_email  text not null,            -- email interno con el que se autentica en Supabase Auth
  email       text,                     -- email de contacto (opcional)
  role        text not null check (role in ('admin', 'obrero')),
  full_name   text not null,
  trade       text,
  phone       text,
  dni         text,
  obrero_id   text,                     -- enlace con la ficha de obrero de la app
  employee_id text,                     -- enlace con la ficha de empleado de la app
  is_active   boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists profiles_username_key on public.profiles (lower(username));
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists profiles_dni_idx on public.profiles (upper(dni));

-- -------------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES DE ROL
--    SECURITY DEFINER para poder leer `profiles` dentro de las políticas sin
--    entrar en bucle. Un usuario desactivado (is_active = false) deja de tener
--    rol al instante, aunque su sesión siga abierta.
-- -------------------------------------------------------------------------
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

revoke all on function public.current_role_name() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -------------------------------------------------------------------------
-- 3. DATOS DE LA APP (almacén JSON)
--    collection = tipo de dato ('obras', 'presupuestos', 'facturas', ...)
--    id         = identificador del registro dentro de la colección
--    data       = el registro completo tal y como lo usa la app
-- -------------------------------------------------------------------------
create table if not exists public.app_records (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists app_records_collection_idx on public.app_records (collection);

create or replace function public.app_records_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists app_records_touch on public.app_records;
create trigger app_records_touch
before insert or update on public.app_records
for each row execute function public.app_records_touch();

-- -------------------------------------------------------------------------
-- 4. BORRAR TODAS LAS POLÍTICAS ANTERIORES (incluidas "Permitir todo acceso")
-- -------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'users', 'employees', 'company_settings', 'ai_integration_settings',
        'clients', 'projects', 'project_phases', 'project_tasks', 'quotes',
        'subcontractors', 'ai_reference_budgets', 'profiles', 'app_records',
        'fichajes_obreros', 'site_visit_captures', 'quote_chapters', 'quote_items'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- -------------------------------------------------------------------------
-- 5. RLS ACTIVADA + SOLO ADMINISTRADORES EN LAS TABLAS ANTIGUAS
--    (la app todavía no las usa; quedan cerradas por seguridad)
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'employees', 'company_settings', 'ai_integration_settings',
    'clients', 'projects', 'project_phases', 'project_tasks', 'quotes',
    'subcontractors', 'ai_reference_budgets',
    'fichajes_obreros', 'site_visit_captures', 'quote_chapters', 'quote_items'
  ]
  loop
    -- Solo si la tabla existe en tu proyecto
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
        t || '_solo_admin', t
      );
    end if;
  end loop;
end
$$;

-- -------------------------------------------------------------------------
-- 6. PERFILES: cada usuario ve el suyo; el admin ve y gestiona todos.
--    Las altas/bajas/cambios de usuarios las hace el servidor con la clave
--    de servicio (que ignora RLS), nunca el navegador.
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;

create policy profiles_select_propio_o_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_admin_escritura on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------------------------------------------------------------------------
-- 7. DATOS DE LA APP (app_records)
--    Admin: todo.
--    Obrero: leer obras, obreros y avisos técnicos; modificar obras y avisos
--    (partes de avance, fotos, lectura de avisos); crear mensajes y registros
--    de auditoría. NO puede ver facturas, presupuestos, empleados, nóminas,
--    configuración de empresa ni usuarios.
-- -------------------------------------------------------------------------
alter table public.app_records enable row level security;
revoke all on public.app_records from anon;

create policy app_records_admin on public.app_records
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy app_records_obrero_leer on public.app_records
  for select to authenticated
  using (
    public.current_role_name() = 'obrero'
    and collection in ('obras', 'obreros', 'avisos_tecnicos')
  );

create policy app_records_obrero_crear on public.app_records
  for insert to authenticated
  with check (
    public.current_role_name() = 'obrero'
    and collection in ('obras', 'avisos_tecnicos', 'mensajes_inbox', 'audit_logs')
  );

create policy app_records_obrero_modificar on public.app_records
  for update to authenticated
  using (
    public.current_role_name() = 'obrero'
    and collection in ('obras', 'avisos_tecnicos')
  )
  with check (
    public.current_role_name() = 'obrero'
    and collection in ('obras', 'avisos_tecnicos')
  );

-- -------------------------------------------------------------------------
-- 8. TIEMPO REAL: avisar a los demás dispositivos cuando cambia un registro
-- -------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_records'
     )
  then
    alter publication supabase_realtime add table public.app_records;
  end if;
end
$$;

-- =========================================================================
-- PASO FINAL (obligatorio): crear tu primer administrador
--
--   1. Supabase > Authentication > Users > "Add user" > "Create new user".
--      Pon tu email y una contraseña larga y marca "Auto Confirm User".
--   2. Sustituye TU_EMAIL por ese mismo email y ejecuta este bloque:
--
--   insert into public.profiles (id, username, auth_email, email, role, full_name, trade)
--   select id, 'admin', email, email, 'admin', 'Administrador', 'Dirección Técnica'
--   from auth.users
--   where email = 'TU_EMAIL'
--   on conflict (id) do update set role = 'admin', is_active = true;
--
--   3. Supabase > Authentication > Sign In / Providers (o Settings) >
--      desactiva "Allow new users to sign up" para que nadie pueda crearse
--      cuentas por su cuenta.
-- =========================================================================
