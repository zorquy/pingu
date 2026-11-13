-- Tanda 1307 — doble factor para el equipo y sesiones abiertas (S6 y S12).
--
-- Hasta ahora, la contraseña de una cuenta de admin bastaba para banear,
-- borrar o leer lo que solo ve el equipo. Supabase trae códigos de app (TOTP)
-- de serie: quien los activa en Ajustes › Seguridad tiene que escribir el
-- código al entrar, y con esta migración la BASE lo exige: `is_admin()` solo
-- dice que sí a una sesión que ha pasado el código (`aal2`) si esa persona
-- tiene el doble factor puesto. Sin doble factor, como antes (para no dejar a
-- nadie fuera el día que se ejecuta); el panel avisa de que hay que ponerlo.
--
-- `is_admin()` no salió de ninguna migración del repo (se creó a mano) y la
-- usan unas 130 políticas y funciones. Para no reescribirla a ciegas, su
-- definición de HOY se copia tal cual a `is_admin_base()`, y `is_admin()`
-- pasa a ser «lo de antes Y la sesión cumple». Mismo nombre y misma firma:
-- las políticas no se tocan.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

-- 1. La copia de lo de antes (solo la primera vez: después ya existe).
do $$
declare
  v_def text;
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'is_admin_base' and p.pronargs = 0) then
    v_def := pg_get_functiondef('public.is_admin()'::regprocedure);
    v_def := regexp_replace(v_def, 'FUNCTION public\.is_admin\(\)', 'FUNCTION public.is_admin_base()');
    execute v_def;
  end if;
end $$;

-- 2. ¿Esta sesión cumple? Sí si quien la abre no tiene doble factor puesto,
-- o si lo tiene y ha escrito el código en esta sesión.
create or replace function public.sesion_cumple_mfa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status::text = 'verified')
$$;

-- 3. is_admin = lo de antes y la sesión cumple.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(public.is_admin_base(), false) and public.sesion_cumple_mfa()
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.sesion_cumple_mfa() to authenticated;
    grant execute on function public.is_admin() to anon, authenticated;
  end if;
end $$;

-- 4. Tus sesiones abiertas: dónde, desde cuándo y la última vez. Sin la IP:
-- no hace falta para reconocer tu móvil y es un dato más que no se enseña.
create or replace function public.mis_sesiones()
returns table (id uuid, creada timestamptz, ultima timestamptz, navegador text, esta boolean, con_codigo boolean)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at),
         s.user_agent,
         s.id::text = coalesce(auth.jwt() ->> 'session_id', ''),
         coalesce(s.aal::text, 'aal1') = 'aal2'
  from auth.sessions s
  where s.user_id = auth.uid() and auth.uid() is not null
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc
$$;

-- 5. Cerrar UNA sesión tuya (nunca la que estás usando: para eso, «Salir»).
-- Borrarla tumba sus tokens de refresco; el de acceso caduca solo (una hora).
create or replace function public.cerrar_sesion(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or p_id is null or p_id::text = coalesce(auth.jwt() ->> 'session_id', '') then
    return false;
  end if;
  delete from auth.sessions where id = p_id and user_id = auth.uid();
  return found;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.mis_sesiones() from public, anon;
    grant execute on function public.mis_sesiones() to authenticated;
    revoke all on function public.cerrar_sesion(uuid) from public, anon;
    grant execute on function public.cerrar_sesion(uuid) to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
