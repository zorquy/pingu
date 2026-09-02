-- ============================================================
-- Guías leídas: que leer cuente, no solo hacer el curso.
--
-- Hasta ahora completar un curso daba XP y quedaba marcado, pero
-- leer una guía entera solo incrementaba `guides.view_count`. La
-- gamificación premiaba lo complementario e ignoraba lo principal:
-- alguien que se hubiera leído toda la web seguía a 0 XP.
--
-- Se añade `read_at` a `user_progress` en vez de crear una tabla
-- nueva, porque esa tabla ya es "mi relación con esta guía", ya
-- está indexada por (user_id, guide_id) y ya tiene las políticas
-- RLS correctas. Una tabla aparte obligaría a duplicarlas.
--
-- OJO: `status` pasa a poder ser NULL. Una guía que solo se ha
-- leído (y que quizá ni tiene curso) crea una fila con `read_at`
-- puesto y `status` a null. Todo lo que cuenta cursos debe filtrar
-- `status is not null` — el código de la web ya lo hace.
--
-- Requiere el índice único de supabase-migration-user-progress-unique.sql,
-- porque marcar como leída usa el mismo upsert con onConflict.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

alter table user_progress
  add column if not exists read_at timestamptz;

-- Para "¿qué he leído?" y para los recuentos por categoría.
create index if not exists user_progress_read_at_idx
  on user_progress (user_id, read_at)
  where read_at is not null;

-- `status` tenía sentido obligatorio cuando la tabla solo servía
-- para cursos. Ahora una fila puede existir solo por lectura.
alter table user_progress
  alter column status drop not null;

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- La columna nueva debe aparecer, y status debe admitir nulos.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'user_progress'
  and column_name in ('status', 'read_at')
order by column_name;

-- Reparto actual. Al principio no habrá ninguna leída: se van
-- marcando a medida que la gente lea.
select
  count(*) filter (where read_at is not null) as guias_leidas,
  count(*) filter (where status = 'completed') as cursos_completados,
  count(*) filter (where status is null) as filas_solo_de_lectura
from user_progress;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
