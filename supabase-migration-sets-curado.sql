-- ════════════════════════════════════════════════════════════════════
-- Tanda 343 — saber si un set se ha VISITADO, no si le falta un campo
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU, comparando /cartas con Limitless: «los sets están mal, pones la
-- nomenclatura asiática y no la occidental». Tiene razón — donde
-- Limitless dice PBL, SSP o TWM, PokeDoc decía ME05, SV08 o SV06. Lo
-- primero es el código de TCG Live, que es el que sale en las decklists
-- y con el que habla la gente; lo segundo es el identificador interno de
-- TCGdex.
--
-- Y el código de pintar YA prefiere el de Live (`insignia` en
-- js/cartas.js). Lo que falta es el DATO.
--
-- ── Por qué falta ──
--
-- El código de TCG Live solo viene en el SET COMPLETO, nunca en el
-- listado (la lección de la 233 y la 322). Lo curaba la fase de sets de
-- la tarea programada, que visita los que `leFaltaAlgo` marca como
-- incompletos.
--
-- En la 333 esa condición se estrechó a «le falta la serie», y con
-- razón: los sets anteriores a TCG Online no tienen código, así que
-- pedirlo como requisito los dejaba «incompletos» para siempre, la fase
-- no acababa nunca y el engorde no arrancaba jamás.
--
-- Pero al quitarlo, **el código dejó de curarse en silencio**. Un set
-- que ya tenía serie no se volvía a visitar aunque le faltara el código.
--
-- ── El arreglo: preguntar por la VISITA, no por el campo ──
--
-- Las dos versiones preguntaban «¿le falta este dato?», y eso no puede
-- distinguir «no lo hemos pedido» de «TCGdex no lo tiene». Es el mismo
-- error que la chapa de legalidad de la 338, un piso más arriba.
--
-- `curado_at` responde a otra pregunta: «¿hemos ido a mirar?». Un set
-- visitado se queda con lo que TCGdex tenga —código incluido, o sin él
-- si no existe— y no se vuelve a pedir. La fase termina SIEMPRE, que era
-- lo que la 333 quería, y el código se cura, que era lo que se perdió.
--
-- No se rellena nada de entrada: los ~220 sets se visitan una vez,
-- acotados por el presupuesto de cada pasada. Es menos de una hora y
-- pasa solo.
--
-- Ejecutar en el SQL Editor de Supabase.

alter table public.tcg_sets
  add column if not exists curado_at timestamptz;

comment on column public.tcg_sets.curado_at is
  'Cuándo se pidió por última vez el SET COMPLETO a TCGdex. Null = no se '
  'ha visitado. Es lo que decide si la tarea programada vuelve a pedirlo, '
  'y responde «¿hemos ido a mirar?» en vez de «¿le falta este campo?»: lo '
  'segundo no distingue un hueco nuestro de un dato que TCGdex no tiene.';

-- ── Para mirar cómo va ──
--
-- select count(*) filter (where curado_at is null) as sin_visitar,
--        count(*) filter (where tcg_online_code is null) as sin_codigo,
--        count(*) as sets
-- from public.tcg_sets where market = 'WEST';
