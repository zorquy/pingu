-- ============================================================
-- Hilo de actividad reciente en Comunidad.
--
-- Para poder enseñar "X ha completado el curso Y" hace falta que
-- `user_progress` se pueda leer públicamente. Hasta ahora la única
-- política de lectura era `auth.uid() = user_id` (más la de admins),
-- así que nadie veía el progreso de nadie.
--
-- LEE ESTO ANTES DE EJECUTARLO: esto hace público qué guías lee y
-- qué cursos hace cada persona. No solo en el hilo de actividad —
-- la tabla queda legible por la API para quien sepa consultarla. En
-- un sitio de aprendizaje es lo normal (Duolingo enseña lo mismo),
-- pero es un cambio de privacidad y conviene decidirlo a conciencia.
--
-- Por eso viene con interruptor: `hide_activity`. Quien lo active
-- deja de aparecer en el hilo Y sus filas de progreso vuelven a ser
-- privadas, porque la propia política lo comprueba.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- Interruptor por persona. Por defecto se aparece (false), que es lo
-- que hace que el hilo tenga algo que enseñar desde el primer día.
alter table user_profiles
  add column if not exists hide_activity boolean not null default false;

-- Lectura pública del progreso, PERO solo de quien no se haya
-- escondido. Las políticas se combinan con OR, así que esto no quita
-- nada: cada uno sigue leyendo lo suyo y los admins lo siguen viendo
-- todo, aunque se hayan escondido.
drop policy if exists "user_progress_public_activity" on user_progress;

create policy "user_progress_public_activity" on user_progress
  for select using (
    exists (
      select 1 from user_profiles p
      where p.id = user_progress.user_id
        and p.hide_activity = false
    )
  );

-- El hilo ordena por estas fechas, así que conviene tenerlas indexadas.
create index if not exists user_progress_completed_at_idx
  on user_progress (completed_at desc)
  where completed_at is not null;

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Deben aparecer las tres políticas de lectura: la propia, la de
-- admins y la nueva del hilo.
select policyname as politica, cmd as operacion, qual as using_expr
from pg_policies
where tablename = 'user_progress'
order by policyname;

-- Cuánta gente se ha escondido (al principio, nadie).
select
  count(*) filter (where hide_activity) as escondidos,
  count(*) filter (where not hide_activity) as visibles
from user_profiles;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
