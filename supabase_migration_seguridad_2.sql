-- =========================================================================
-- OBRAMASTER - MIGRACIÓN DE SEGURIDAD 2 (refuerzo de la base de datos)
--
-- Qué hace este script (se puede ejecutar más de una vez):
--   1. Activa RLS en TODAS las tablas de `public` (si alguna se quedó sin ella,
--      cualquiera con la clave pública podía leerla o escribirla).
--   2. Borra las políticas "abiertas" (using (true) / with check (true)) que
--      dejaban entrar a cualquiera, p. ej. las de supabase_schema_ai_reference_budgets.sql
--      o supabase_full_schema.sql si se volvieron a ejecutar.
--   3. Quita al rol anónimo (anon, el que usa la web ANTES de iniciar sesión)
--      todos los permisos sobre tablas, secuencias y funciones de `public`,
--      también para las tablas que se creen en el futuro.
--   4. Avisos: un usuario solo puede marcar como leídos los suyos (no cambiar el texto).
--   5. Fotos de obra: el bucket `obra-fotos` queda privado.
--   6. Al final muestra un informe: tablas sin RLS y políticas abiertas que queden.
--
-- La app no se ve afectada: el servidor usa la clave service_role (no le afecta RLS)
-- y la web siempre trabaja con la sesión del usuario (rol authenticated).
--
-- Cómo ejecutarlo:
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Requisito: haber ejecutado antes supabase_migration_seguridad.sql.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. RLS EN TODAS LAS TABLAS DE public
-- -------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    raise notice 'RLS activada en public.%', t.relname;
  end loop;
end
$$;

-- -------------------------------------------------------------------------
-- 2. FUERA LAS POLÍTICAS ABIERTAS
--    Una tabla que se queda sin políticas queda cerrada para el navegador,
--    pero el servidor (service_role) la sigue usando con normalidad.
-- -------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(btrim(qual), '') in ('true', '(true)')
        or coalesce(btrim(with_check), '') in ('true', '(true)')
        or 'anon' = any (roles)
        or (coalesce(qual, '') ~* 'auth\.role\(\)\s*=\s*''authenticated''')
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    raise notice 'Política abierta eliminada: %.%', r.tablename, r.policyname;
  end loop;
end
$$;

-- Presupuestos modelo de la IA: solo administradores (antes: cualquiera, incluso sin sesión).
do $$
begin
  if to_regclass('public.ai_reference_budgets') is not null then
    drop policy if exists ai_reference_budgets_solo_admin on public.ai_reference_budgets;
    create policy ai_reference_budgets_solo_admin on public.ai_reference_budgets
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end
$$;

-- -------------------------------------------------------------------------
-- 3. EL ROL anon NO TOCA NADA DE public
-- -------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Y lo mismo para lo que se cree a partir de ahora.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- Las funciones de rol solo las usa un usuario con sesión.
revoke all on function public.current_role_name() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -------------------------------------------------------------------------
-- 4. AVISOS: desde el navegador solo se puede marcar como leído
-- -------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.notifications') is not null then
    revoke insert, update, delete on public.notifications from authenticated;
    grant update (read_at, read_by) on public.notifications to authenticated;
  end if;
end
$$;

-- -------------------------------------------------------------------------
-- 5. FOTOS DE OBRA: bucket privado (se ven con enlaces firmados que da el servidor)
-- -------------------------------------------------------------------------
update storage.buckets set public = false where id = 'obra-fotos' and public;

-- -------------------------------------------------------------------------
-- 6. INFORME: si sale VACÍO, todo está bien cerrado
-- -------------------------------------------------------------------------
select 'Tabla sin RLS' as problema, c.relname::text as tabla, null::text as politica
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
union all
select 'Política abierta', tablename::text, policyname::text
from pg_policies
where schemaname = 'public'
  and (coalesce(btrim(qual), '') in ('true', '(true)')
       or coalesce(btrim(with_check), '') in ('true', '(true)')
       or 'anon' = any (roles));
