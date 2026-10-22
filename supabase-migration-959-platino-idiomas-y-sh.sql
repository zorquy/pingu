-- ============================================================
-- Tanda 959: los idiomas de la era Platino y sus SH.
--
-- PINGU, set a set (2026-10-22):
--   · Supreme Victors salió en inglés, francés y alemán, nada más;
--   · Arceus y Rising Rivals, en inglés, francés, alemán e italiano (en
--     español tampoco);
--   · las SH (las shiny) son Reverse; en Platinum, que sí salió en español,
--     en español son Holo, como el Duskull de Stormfront (958).
--
-- Los idiomas van a mano encima de lo calculado (956): los que dice, puestos,
-- y el español, el italiano y el portugués que no dice, quitados. Las SH van
-- carta a carta (958): Reverse sí y Holo y Normal no en sus idiomas, y en
-- Platinum en español al revés. TCGdex ya las da como Reverse, pero lo de
-- TCGGO o una versión a mano podría traer otra: así se dice para todas.
--
-- Va después de la 958. Se puede ejecutar dos veces.
-- ============================================================

begin;

-- ── 1. Los idiomas de los tres sets ──
insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, updated_at)
select v.set_id, 'WEST', l.idioma, l.idioma = any (v.salio), now()
from (values
  ('pl2', array['en', 'fr', 'de', 'it']),   -- Rising Rivals
  ('pl3', array['en', 'fr', 'de']),         -- Supreme Victors
  ('pl4', array['en', 'fr', 'de', 'it'])    -- Arceus
) as v(set_id, salio)
cross join (values ('es'), ('en'), ('fr'), ('de'), ('it'), ('pt')) as l(idioma)
where exists (select 1 from public.tcg_sets s where s.id = v.set_id and s.market = 'WEST')
on conflict (set_id, market, idioma) do update set hay = excluded.hay, updated_at = now();

-- ── 2. Las SH, carta a carta ──
-- Platinum SH4–SH6, Supreme Victors SH7–SH9 y Arceus SH10–SH12: Reverse en
-- sus idiomas; en Platinum, en español, Holo.
insert into public.tcg_version_idioma (set_id, market, card_id, variante, idioma, hay, updated_at)
select c.set_id, 'WEST', c.id, x.variante, x.idioma, x.hay, now()
from public.tcg_cards c
join (values ('pl1', array['en', 'fr', 'de', 'it']), ('pl3', array['en', 'fr', 'de']), ('pl4', array['en', 'fr', 'de', 'it'])) as s(set_id, idiomas)
  on s.set_id = c.set_id
cross join lateral (
  select l.idioma, v.variante, v.hay
  from unnest(s.idiomas) as l(idioma)
  cross join (values ('reverse', true), ('holo', false), ('normal', false)) as v(variante, hay)
  union all
  select 'es', v.variante, v.hay
  from (values ('holo', true), ('reverse', false), ('normal', false)) as v(variante, hay)
  where c.set_id = 'pl1'
) as x
where c.market = 'WEST'
  and c.id in ('pl1-SH4', 'pl1-SH5', 'pl1-SH6', 'pl3-SH7', 'pl3-SH8', 'pl3-SH9', 'pl4-SH10', 'pl4-SH11', 'pl4-SH12')
on conflict (set_id, market, card_id, variante, idioma) do update set hay = excluded.hay, updated_at = now();

commit;

-- ── Comprobación (el SQL Editor enseña la última) ──
select s.id, s.name, public.idiomas_de_set(s.id, 'WEST') as idiomas,
       (select string_agg(distinct v.card_id, ', ') from public.tcg_version_idioma v where v.set_id = s.id and v.market = 'WEST' and v.card_id <> '') as sh_con_sus_versiones
from public.tcg_sets s
where s.market = 'WEST' and s.id in ('pl1', 'pl2', 'pl3', 'pl4', 'dp7')
order by s.id;
