-- ============================================================
-- Los cursos completados no se guardaban.
--
-- La app escribe el progreso con un UPSERT que le dice a PostgREST
-- "si ya existe la fila de (user_id, guide_id), actualízala":
--
--   .upsert({...}, { onConflict: 'user_id,guide_id' })
--
-- Eso se traduce en un INSERT ... ON CONFLICT (user_id, guide_id),
-- y Postgres SOLO lo acepta si existe un índice único o una
-- restricción única sobre EXACTAMENTE esas dos columnas. Si no
-- existe, la orden falla siempre con:
--
--   42P10: there is no unique or exclusion constraint matching
--          the ON CONFLICT specification
--
-- Como el código no miraba el error que devolvía Supabase, el curso
-- se veía terminado en pantalla (confeti y XP incluidos) y no se
-- guardaba nada. Eso ya está arreglado en el cliente: ahora avisa.
-- Este fichero arregla la otra mitad, la de la base de datos.
--
-- PRIMERO DIAGNOSTICA, LUEGO REPARA. Ejecuta el bloque 1, mira el
-- resultado, y solo entonces decide si hace falta el bloque 2.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- BLOQUE 1 — DIAGNÓSTICO (solo lee, no cambia nada)
-- ────────────────────────────────────────────────────────────

-- 1a. ¿Existe ya un índice único sobre (user_id, guide_id)?
--     Si esta consulta devuelve 0 filas, esa es la causa del fallo.
select
  i.relname as nombre_del_indice,
  idx.indisunique as es_unico,
  pg_get_indexdef(idx.indexrelid) as definicion
from pg_index idx
join pg_class i on i.oid = idx.indexrelid
join pg_class t on t.oid = idx.indrelid
where t.relname = 'user_progress'
  and idx.indisunique;

-- 1b. ¿Hay filas duplicadas? Si las hay, el bloque 2 fallará al crear
--     el índice y habrá que limpiarlas antes (ver bloque 3).
select user_id, guide_id, count(*) as veces
from user_progress
group by user_id, guide_id
having count(*) > 1
order by veces desc;

-- 1c. ¿Se está guardando algo de progreso, y con qué estado?
select status, count(*) as filas
from user_progress
group by status;

-- 1d. Políticas RLS de la tabla, por si la causa fuese otra.
--     Para que la app pueda escribir hace falta que el usuario pueda
--     hacer INSERT y UPDATE de sus propias filas.
select polname as politica, cmd as operacion,
       pg_get_expr(polqual, polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
from pg_policy
where polrelid = 'user_progress'::regclass;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 2 — REPARACIÓN
-- Ejecútalo solo si el 1a no devolvió ningún índice sobre
-- (user_id, guide_id) y el 1b no devolvió duplicados.
-- ────────────────────────────────────────────────────────────

-- Es idempotente: si el índice ya existe, no hace nada.
create unique index if not exists user_progress_user_guide_key
  on user_progress (user_id, guide_id);


-- ────────────────────────────────────────────────────────────
-- BLOQUE 3 — SOLO SI EL 1b DEVOLVIÓ DUPLICADOS
-- Deja una fila por (user_id, guide_id): la más avanzada
-- (completed gana a started) y, a igualdad, la más reciente.
--
-- ESTO BORRA FILAS. Ejecuta antes el SELECT de comprobación para
-- ver exactamente qué se va a borrar.
-- ────────────────────────────────────────────────────────────

-- 3a. Qué se borraría (solo lee):
with ranked as (
  select id, user_id, guide_id, status, completed_at, started_at,
         row_number() over (
           partition by user_id, guide_id
           order by (status = 'completed') desc,
                    completed_at desc nulls last,
                    started_at desc nulls last
         ) as rn
  from user_progress
)
select * from ranked where rn > 1;

-- 3b. El borrado en sí. Descoméntalo solo tras revisar el 3a.
-- with ranked as (
--   select id,
--          row_number() over (
--            partition by user_id, guide_id
--            order by (status = 'completed') desc,
--                     completed_at desc nulls last,
--                     started_at desc nulls last
--          ) as rn
--   from user_progress
-- )
-- delete from user_progress
-- where id in (select id from ranked where rn > 1);
--
-- Y después, crea el índice del bloque 2.


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN FINAL
-- Debe devolver una fila con el índice ya creado.
-- ────────────────────────────────────────────────────────────
select i.relname as nombre_del_indice, pg_get_indexdef(idx.indexrelid) as definicion
from pg_index idx
join pg_class i on i.oid = idx.indexrelid
join pg_class t on t.oid = idx.indrelid
where t.relname = 'user_progress' and idx.indisunique;
