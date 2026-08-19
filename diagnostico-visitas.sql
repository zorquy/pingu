-- ¿Por qué no salen las visitas en el panel?
-- ============================================================
--
-- SOLO LEE, no cambia nada. Pégalo entero en el SQL Editor de Supabase y
-- mira los resultados de arriba abajo: cada bloque descarta un culpable.
--
-- La cadena tiene tres eslabones y este diagnóstico los mira en orden:
--   1. ¿Las visitas LLEGAN a la tabla? (el insert de cada carga de página)
--   2. ¿Los permisos y políticas están bien puestos?
--   3. ¿Tu cuenta puede LEERLAS? (la política de lectura depende de is_admin())
--
-- El SQL Editor consulta como superusuario y se salta la RLS, así que aquí
-- ves la verdad de la tabla aunque el panel no la vea.

-- ── 1. ¿Llegan visitas? ──
-- Si "ultima_visita" es de hace días/semanas, el INSERT está roto desde esa
-- fecha (sigue al bloque 2). Si hay visitas de hoy, el insert está bien y el
-- problema es de LECTURA (salta al bloque 3).
select
  count(*) as visitas_totales,
  count(*) filter (where created_at > now() - interval '7 days') as ultima_semana,
  count(*) filter (where created_at > now() - interval '24 hours') as ultimo_dia,
  max(created_at) as ultima_visita
from public.page_views;

-- Las últimas diez, para ver qué pinta tienen.
select path, user_id is not null as con_sesion, created_at
from public.page_views
order by created_at desc
limit 10;

-- ── 2. Permisos y políticas ──
-- La RLS por sí sola no basta: el ROL necesita además permiso de tabla.
-- Aquí deben salir INSERT para "anon" y "authenticated". Si no salen,
-- ese es el fallo: el insert de la web devuelve "permission denied" y
-- (hasta hoy) el código lo descartaba sin decirlo.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'page_views'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Las políticas. Deben salir dos: el insert abierto (with_check = true) y
-- el select solo para admin (qual = is_admin()).
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'page_views';

-- ¿La RLS está activada? (debe decir true)
select relrowsecurity as rls_activada
from pg_class
where oid = 'public.page_views'::regclass;

-- ── 3. ¿Puede leer tu cuenta? ──
-- La política de lectura es `using (is_admin())`. Si esa función dice que
-- NO, el panel no ve un error: ve CERO filas, en silencio. Que el resto del
-- panel te funcione no lo descarta — la web decide que eres admin leyendo
-- la columna user_profiles.is_admin, que es otra cosa.
--
-- Primero, qué hace la función por dentro:
select pg_get_functiondef(oid) as definicion_de_is_admin
from pg_proc
where proname = 'is_admin' and pronamespace = 'public'::regnamespace;

-- Y después, si TU fila cumple lo que la función mira (lo normal es que la
-- función compruebe user_profiles.is_admin para auth.uid()):
select id, username, is_admin
from public.user_profiles
where is_admin = true;

-- OJO: ejecutar `select is_admin()` aquí en el SQL Editor devuelve false o
-- null SIEMPRE, porque el editor no lleva tu sesión (auth.uid() es null).
-- Eso no significa que esté rota: hay que leer su definición (arriba) y
-- comprobar que tu usuario cumple la condición.

-- ── El arreglo, según lo que haya salido ──
--
-- A) Si el bloque 2 NO enseña INSERT para anon/authenticated, ejecuta:
--
--    grant insert on public.page_views to anon, authenticated;
--
-- B) Si falta alguna política, vuelve a ejecutar entera
--    supabase-migration-page-views.sql (es idempotente).
--
-- C) Si el bloque 1 tiene visitas recientes pero el panel no las enseña,
--    el problema es is_admin(): mira su definición y comprueba que tu
--    usuario cumple la condición que pide (bloque 3).
