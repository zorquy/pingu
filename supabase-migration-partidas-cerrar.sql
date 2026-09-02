-- ═══════════════════════════════════════════════════════════════════
-- CERRAR UN TORNEO APUNTADO (tanda 251)
--
-- PINGU, con su primer torneo apuntado en /mis-partidas: «no hay un
-- botón para cerrar o finalizar el torneo, para que no sigan saliendo
-- esos campos».
--
-- Un torneo apuntado a mano no tiene forma de decir «ya está»: el
-- «+ Añadir ronda» sigue ahí para siempre y la tarjeta pide más datos
-- de un torneo que se jugó hace un mes.
--
-- ── Por qué una FECHA y no un booleano ──
--
-- `cerrado_el` dice además CUÁNDO se cerró, que es gratis y algún día
-- sirve para ordenar. Un `cerrado boolean` no se puede ampliar sin otra
-- migración. NULL = abierto, que es el estado en el que nace.
--
-- Y se puede volver atrás: el mismo PINGU pidió que un torneo cerrado
-- se pueda REABRIR para arreglar una ronda mal apuntada. Poner la
-- columna a NULL es todo lo que hace falta — no hay nada que
-- reconstruir, porque cerrar no cambia ningún dato, solo esconde los
-- botones de seguir metiendo.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.match_log_torneos
  add column if not exists cerrado_el timestamptz;

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Al ejecutarla, todos los torneos que ya existan salen como abiertos:
-- nace en NULL y nadie ha cerrado nada todavía.
select count(*) filter (where cerrado_el is null) as abiertos,
       count(*) filter (where cerrado_el is not null) as cerrados
from public.match_log_torneos;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
notify pgrst, 'reload schema';
