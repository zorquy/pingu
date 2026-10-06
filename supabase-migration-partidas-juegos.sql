-- ═══════════════════════════════════════════════════════════════════
-- LOS JUEGOS DE UNA PARTIDA: AL MEJOR DE TRES (tanda 632)
--
-- PINGU: «me falta que se pueda marcar en Mis partidas el Bo3 […] tipo
-- poner game 1 W, L, T y así consecutivamente».
--
-- Tres columnas en `match_log`, las tres opcionales (una fila de antes
-- no las trae y sigue siendo una partida al mejor de uno sin detalle):
--   formato  'bo1' | 'bo3'
--   juegos   una letra por juego: W ganado, L perdido, T empate ('WLW')
--   salida   quién empezó cada juego: 1 tú, 2 el rival, - no se sabe
--
-- El resultado de la partida (`resultado`) lo sigue guardando la web,
-- calculado de los juegos (js/partidas-juegos.js): las estadísticas y la
-- matriz de siempre no cambian.
--
-- Cada sentencia se basta sola (el SQL Editor puede ejecutarlas por
-- separado, tanda 631) y todas se pueden ejecutar dos veces.
-- ═══════════════════════════════════════════════════════════════════

alter table public.match_log add column if not exists formato text;
alter table public.match_log add column if not exists juegos text;
alter table public.match_log add column if not exists salida text;

alter table public.match_log drop constraint if exists match_log_formato_ok;
alter table public.match_log add constraint match_log_formato_ok
  check (formato is null or formato in ('bo1', 'bo3'));

-- Hasta tres juegos, y al mejor de uno, uno.
alter table public.match_log drop constraint if exists match_log_juegos_ok;
alter table public.match_log add constraint match_log_juegos_ok
  check (juegos is null or (juegos ~ '^[WLT]{1,3}$' and (formato = 'bo3' or length(juegos) = 1)));

-- Una marca de salida por juego, ni más ni menos.
alter table public.match_log drop constraint if exists match_log_salida_ok;
alter table public.match_log add constraint match_log_salida_ok
  check (salida is null or (juegos is not null and salida ~ '^[12-]{1,3}$' and length(salida) = length(juegos)));

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que devolver las tres columnas.
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'match_log' and column_name in ('formato', 'juegos', 'salida');
