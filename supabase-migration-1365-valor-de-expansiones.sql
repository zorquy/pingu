-- Tanda 1365 — El valor de cada expansión en el tiempo (la E y la F de «Lo
-- nuevo de la API de TCGGO», aprobadas por PINGU el 2026-11-15: «las dos, y el
-- sellado semanal»).
--
-- `tcg_set_valor` (646) guarda una fila por expansión y día con la suma de los
-- mínimos de sus cartas (`valor_cm`) y de TCGplayer (`valor_tp`). Desde la 1365
-- la pasada `tcggo-valor-historico` rellena el último año hacia atrás (filas
-- con `origen = 'tcggo-historico'`, sin pisar ningún día que ya hubiera) y
-- apunta aquí, aparte, lo que suman sus productos SELLADOS (`valor_sellado`,
-- en euros), que se repasa una vez a la semana.
--
-- Solo una columna: lo de las cartas no necesita migración (ya tenía dónde
-- ir). La web pide `valor_sellado` con respaldo (sin ella, la consulta se
-- repite sin pedirla, la 624).
--
-- Re-ejecutable. Una sola sentencia (la 631).

alter table public.tcg_set_valor add column if not exists valor_sellado numeric(12,2);
