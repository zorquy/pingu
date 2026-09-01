-- ═══════════════════════════════════════════════════════════════════
-- LO QUE NO ES UNA PARTIDA NORMAL (tanda 233)
--
-- PINGU lo pidió tras enseñarme trainingcourt: además de ganar, perder
-- o empatar, una ronda puede acabar en un acuerdo de empate (ID), en que
-- el rival no se presente, o en un bye.
--
-- No son resultados: son MOTIVOS. Un ID cuenta como empate a efectos de
-- clasificación pero no dice nada del enfrentamiento; un bye no es un
-- enfrentamiento en absoluto. Por eso van en su propia columna en vez de
-- meterlos en `resultado`, que sigue siendo ganada/perdida/empate.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.match_log
  add column if not exists tipo text not null default 'normal';

alter table public.match_log drop constraint if exists match_log_tipo_check;
alter table public.match_log add constraint match_log_tipo_check
  check (tipo in ('normal', 'id', 'no_show', 'bye'));

commit;

select tipo, count(*) from public.match_log group by tipo;
