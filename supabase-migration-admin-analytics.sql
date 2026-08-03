-- ============================================================
-- Estadísticas reales de uso en /admin.
--
-- El panel ya contaba visitas de página (`page_views`), pero no podía
-- saber qué cursos hace la gente: la única política de lectura de
-- `user_progress` es `auth.uid() = user_id`, sin excepción para el
-- equipo. Por eso el "Cursos completados" del dashboard solo contaba
-- los del admin que había iniciado sesión, no los de todos.
--
-- Esta migración añade una política de LECTURA para admins sobre
-- `user_progress`. No toca las de escritura: cada persona sigue
-- pudiendo escribir solo su propio progreso.
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

begin;

-- `is_admin()` ya existe de migraciones anteriores. Se comprueba antes
-- de nada para fallar con un mensaje claro si algo no cuadra, en vez de
-- crear una política que no se pueda evaluar.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'is_admin') then
    raise exception 'Falta la función is_admin(). Aplica antes las migraciones anteriores.';
  end if;
end $$;

drop policy if exists "user_progress_admin_select" on user_progress;

create policy "user_progress_admin_select" on user_progress
  for select using (is_admin());

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Debe aparecer la política nueva junto a las que ya había.
select policyname as politica, cmd as operacion, qual as using_expr
from pg_policies
where tablename = 'user_progress'
order by policyname;

-- Y esto, ejecutado desde tu cuenta de admin en la app, ya debería
-- devolver el total de todos los usuarios y no solo el tuyo.
select status, count(*) as filas, count(distinct user_id) as usuarios
from user_progress
group by status;
