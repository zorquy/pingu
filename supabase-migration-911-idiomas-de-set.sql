-- Tanda 911 — En qué idiomas salió cada set, para no ofrecer los que no.
--
-- PINGU, con el Virizion-EX de Plasma Blast: al añadirla o al darle a «La
-- quiero» salían los ocho idiomas de siempre, y Plasma Blast no salió en
-- español (Cardmarket: inglés, francés, alemán, italiano y portugués). Y al
-- revés en el japonés: solo se podía apuntar en japonés una carta que
-- Cardmarket vende también en coreano y en chino.
--
-- De dónde sale (dos señales que se suman, porque ninguna basta sola):
--   · Los ANUNCIOS de Cardmarket: un idioma en el que alguna carta del set
--     tiene precio mínimo (las columnas `cm_low_*` que escribe tcggo-precios)
--     existe. Es la señal buena, pero el portugués no tiene columna.
--   · La ficha del set en TCGdex (tcgdex/cards-database): las claves de su
--     `name` son los idiomas en los que lo tienen. Se quedan cortos en sets
--     viejos (Gym Heroes sale solo en inglés), por eso SUMAN y no mandan.
--     Se copian aquí, a `tcg_set_idiomas`, para no preguntar fuera.
--   · Un set occidental que TCGdex no tiene (los `tcggo-…`) lleva el
--     portugués de regalo: no hay de dónde saber que no.
-- Si no sale nada (un set sin precios y sin ficha), la función devuelve
-- '{}' y la web ofrece todos, como antes: «no se sabe» no es «ninguno».
--
-- Se puede ejecutar dos veces.

-- ── 1. El coreano, admitido en la colección y en «La quiero» ──
-- (Va primero: la web solo lo ofrece si la función de abajo existe, y la
-- función solo existe si esto ya ha pasado.)
alter table public.user_collection drop constraint if exists user_collection_idioma;
alter table public.user_collection add constraint user_collection_idioma
  check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'));

alter table public.user_wants drop constraint if exists user_wants_idioma;
alter table public.user_wants add constraint user_wants_idioma
  check (idioma is null or idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'));

-- ── 2. Los idiomas de la ficha de TCGdex ──
create table if not exists public.tcg_set_idiomas (
  set_id text not null,
  market text not null default 'WEST',
  idiomas text[] not null,
  primary key (set_id, market)
);
alter table public.tcg_set_idiomas enable row level security;
drop policy if exists tcg_set_idiomas_leer on public.tcg_set_idiomas;
create policy tcg_set_idiomas_leer on public.tcg_set_idiomas for select using (true);
grant select on public.tcg_set_idiomas to anon, authenticated;

insert into public.tcg_set_idiomas (set_id, market, idiomas)
select v.set_id, 'WEST', v.idiomas::text[]
from (values
  ('base4', '{en}'),
  ('base1', '{es,en,fr,de,it,pt}'),
  ('base3', '{es,en,fr,de,it,pt}'),
  ('base2', '{es,en,fr,de,it,pt}'),
  ('base5', '{en,fr,de,it}'),
  ('wp', '{en,fr,it}'),
  ('basep', '{es,en,fr,de,it}'),
  ('bwp', '{es,en,fr,de,it}'),
  ('bw1', '{es,en,fr,de,it,pt}'),
  ('bw7', '{es,en,fr,de,it,pt}'),
  ('bw5', '{es,en,fr,de,it,pt}'),
  ('dv1', '{es,en,fr,de,it,pt}'),
  ('bw6', '{es,en,fr,de,it,pt}'),
  ('bw2', '{es,en,fr,de,it,pt}'),
  ('bw11', '{en,pt}'),
  ('bw4', '{es,en,fr,de,it,pt}'),
  ('bw3', '{es,en,fr,de,it,pt}'),
  ('bw10', '{en,fr,de,it,pt}'),
  ('bw9', '{es,en,fr,de,it,pt}'),
  ('bw8', '{es,en,fr,de,it,pt}'),
  ('rc', '{en,fr}'),
  ('col1', '{es,en,fr,de,it,pt}'),
  ('dpp', '{es,en,fr,de,it}'),
  ('dp1', '{es,en,fr,de,it,pt}'),
  ('dp4', '{es,en,fr,de,it}'),
  ('dp6', '{es,en,fr,de,it}'),
  ('dp5', '{en,fr,de,it}'),
  ('dp2', '{es,en,fr,de,it,pt}'),
  ('dp3', '{es,en,fr,de,it,pt}'),
  ('dp7', '{es,en,fr,de,it}'),
  ('ecard2', '{en,fr,de,it}'),
  ('bog', '{en}'),
  ('ecard1', '{en,fr,de,it}'),
  ('sp', '{en}'),
  ('ecard3', '{en,de,it}'),
  ('ex14', '{en,fr,de,it}'),
  ('ex11', '{en,fr,de,it}'),
  ('ex8', '{en,fr,de,it,pt}'),
  ('ex15', '{en,fr,de,it}'),
  ('ex3', '{en,fr,de,it}'),
  ('ex9', '{en,fr,de,it,pt}'),
  ('ex6', '{en,fr,de,it}'),
  ('ex5', '{en,fr,it}'),
  ('ex13', '{en,fr,de,it}'),
  ('ex12', '{en,fr,de,it}'),
  ('ex5.5', '{en}'),
  ('ex16', '{en,fr,de}'),
  ('ex1', '{es,en,fr,de,it,pt}'),
  ('ex2', '{en,fr,de,it}'),
  ('ex4', '{en,fr,de,it}'),
  ('ex7', '{en,pt}'),
  ('exu', '{es,en,fr,de,it}'),
  ('ex10', '{es,en,fr,de,it,pt}'),
  ('gym2', '{en}'),
  ('gym1', '{en}'),
  ('hgssp', '{es,en,fr,de,it}'),
  ('hgss1', '{es,en,fr,de,it,pt}'),
  ('hgss4', '{en,fr,de,it,pt}'),
  ('hgss3', '{en,fr,de,it,pt}'),
  ('hgss2', '{es,en,fr,de,it,pt}'),
  ('lc', '{en}'),
  ('2013bw', '{fr}'),
  ('2018sm-fr', '{fr}'),
  ('2019sm-fr', '{fr}'),
  ('2011bw', '{es,en,fr,de,it}'),
  ('2012bw', '{es,en,fr,it}'),
  ('2014xy', '{en,fr,it}'),
  ('2015xy', '{en,fr,it}'),
  ('2016xy', '{en,fr,it}'),
  ('2017sm', '{en,fr,de,it}'),
  ('2018sm', '{en,it}'),
  ('2019sm', '{en,de,it}'),
  ('2021swsh', '{es,en,fr,de,it}'),
  ('2022swsh', '{es,en,fr,de,it}'),
  ('2023sv', '{es,en,fr,de,it}'),
  ('2024sv', '{es,en,fr,de,it}'),
  ('30th', '{es,en,fr,de,it,pt}'),
  ('30th-c', '{es,en,fr,de,it,pt}'),
  ('me02.5', '{es,en,fr,de,it,pt}'),
  ('me04', '{es,en,fr,de,it,pt}'),
  ('mep', '{es,en,fr,de,it,pt}'),
  ('mee', '{es,en,fr,de,it,pt}'),
  ('me01', '{es,en,fr,de,it,pt}'),
  ('me03', '{es,en,fr,de,it,pt}'),
  ('me02', '{es,en,fr,de,it,pt}'),
  ('me05', '{es,en,fr,de,it,pt}'),
  ('jumbo', '{en,fr}'),
  ('miscp', '{en}'),
  ('neo4', '{en,fr,de,it}'),
  ('neo2', '{en,fr,de,it}'),
  ('neo1', '{es,en,fr,de,it}'),
  ('neo3', '{en,fr,de,it}'),
  ('si1', '{en}'),
  ('np', '{es,en,fr,de,it}'),
  ('pop1', '{en,fr,de,it}'),
  ('pop2', '{en,fr,de,it}'),
  ('pop3', '{en,fr,de,it}'),
  ('pop4', '{en,fr,de,it}'),
  ('pop5', '{en,de,it}'),
  ('pop6', '{en,de}'),
  ('pop7', '{en,fr,de,it}'),
  ('pop8', '{en,de}'),
  ('pop9', '{en,fr,de,it}'),
  ('pl4', '{es,en,de,it}'),
  ('pl1', '{es,en,fr,de,it}'),
  ('ru1', '{es,en}'),
  ('pl2', '{en,fr,de,it}'),
  ('pl3', '{en,fr,de}'),
  ('A3', '{es,en,fr,de,it}'),
  ('B1a', '{es,en,fr,de,it}'),
  ('A3b', '{en,fr}'),
  ('A3a', '{en,fr}'),
  ('B2', '{es,en,fr,de,it}'),
  ('A1', '{es,en,fr,de,it}'),
  ('B1', '{en,fr}'),
  ('A1a', '{es,en,fr,de,it}'),
  ('B2a', '{es,en,fr,de,it}'),
  ('P-A', '{es,en,fr,de,it}'),
  ('A4a', '{es,en,fr,de,it}'),
  ('A2b', '{es,en,fr,de,it}'),
  ('A2', '{es,en,fr,de,it}'),
  ('A2a', '{es,en,fr,de,it}'),
  ('A4', '{en,fr}'),
  ('sv03.5', '{es,en,fr,de,it,pt}'),
  ('sv10.5b', '{es,en,fr,de,it,pt}'),
  ('sv10', '{es,en,fr,de,it,pt}'),
  ('sv09', '{es,en,fr,de,it,pt}'),
  ('mfb', '{en}'),
  ('sv03', '{es,en,fr,de,it,pt}'),
  ('sv02', '{es,en,fr,de,it,pt}'),
  ('sv04.5', '{es,en,fr,de,it,pt}'),
  ('sv04', '{es,en,fr,de,it,pt}'),
  ('sv08.5', '{es,en,fr,de,it,pt}'),
  ('svp', '{es,en,fr,de,it,pt}'),
  ('sve', '{es,en,fr,de,it,pt}'),
  ('sv01', '{es,en,fr,de,it,pt}'),
  ('sv06.5', '{es,en,fr,de,it,pt}'),
  ('sv07', '{es,en,fr,de,it,pt}'),
  ('sv08', '{es,en,fr,de,it,pt}'),
  ('sv05', '{es,en,fr,de,it,pt}'),
  ('sv06', '{es,en,fr,de,it,pt}'),
  ('sv10.5w', '{es,en,fr,de,it,pt}'),
  ('sm3', '{es,en,fr,de,it,pt}'),
  ('sm7', '{es,en,fr,de,it,pt}'),
  ('sm12', '{es,en,fr,de,it,pt}'),
  ('sm4', '{es,en,fr,de,it,pt}'),
  ('det1', '{es,en,fr,de,it,pt}'),
  ('sm7.5', '{es,en,fr,de,it,pt}'),
  ('sm6', '{es,en,fr,de,it,pt}'),
  ('sm2', '{es,en,fr,de,it,pt}'),
  ('sma', '{es,en,fr,de,it,pt}'),
  ('sm115', '{es,en,fr,de,it,pt}'),
  ('sm8', '{es,en,fr,de,it,pt}'),
  ('smp', '{es,en,fr,de,it,pt}'),
  ('sm3.5', '{es,en,fr,de,it,pt}'),
  ('sm1', '{es,en,fr,de,it,pt}'),
  ('sm9', '{es,en,fr,de,it,pt}'),
  ('sm5', '{es,en,fr,de,it,pt}'),
  ('sm10', '{es,en,fr,de,it,pt}'),
  ('sm11', '{es,en,fr,de,it,pt}'),
  ('swsh10tg', '{es,en,fr,de,it,pt}'),
  ('swsh10', '{es,en,fr,de,it,pt}'),
  ('swsh5', '{es,en,fr,de,it,pt}'),
  ('swsh9tg', '{es,en,fr,de,it,pt}'),
  ('swsh9', '{es,en,fr,de,it,pt}'),
  ('cel25cc', '{es,en,fr,de,it,pt}'),
  ('cel25', '{es,en,fr,de,it,pt}'),
  ('swsh3.5', '{es,en,fr,de,it,pt}'),
  ('swsh6', '{es,en,fr,de,it,pt}'),
  ('swsh12.5gg', '{es,en,fr,de,it,pt}'),
  ('swsh12.5', '{es,en,fr,de,it,pt}'),
  ('swsh3', '{es,en,fr,de,it,pt}'),
  ('swsh7', '{es,en,fr,de,it,pt}'),
  ('swsh8', '{es,en,fr,de,it,pt}'),
  ('swsh11tg', '{es,en,fr,de,it,pt}'),
  ('swsh11', '{es,en,fr,de,it,pt}'),
  ('fut2020', '{en}'),
  ('swsh10.5', '{es,en,fr,de,it,pt}'),
  ('swsh2', '{es,en,fr,de,it,pt}'),
  ('swshp', '{es,en,fr,de,it,pt}'),
  ('swsh4.5sv', '{es,en,fr,de,it,pt}'),
  ('swsh4.5', '{es,en,fr,de,it,pt}'),
  ('swsh12tg', '{es,en,fr,de,it,pt}'),
  ('swsh12', '{es,en,fr,de,it,pt}'),
  ('swsh1', '{es,en,fr,de,it,pt}'),
  ('swsh4', '{es,en,fr,de,it,pt}'),
  ('tk-bw-e', '{es,en,fr}'),
  ('tk-bw-z', '{es,en,fr}'),
  ('tk-dp-l', '{es,en,fr,it}'),
  ('tk-dp-m', '{es,en,fr,it}'),
  ('tk-ex-latia', '{es,en,fr,de,it}'),
  ('tk-ex-latio', '{es,en,fr,de,it}'),
  ('tk-ex-m', '{es,en,fr,it}'),
  ('tk-ex-p', '{es,en,fr,it}'),
  ('tk-hs-g', '{es,en,fr,it}'),
  ('tk-hs-r', '{es,en,fr,it}'),
  ('tk-sm-r', '{es,en,fr,it}'),
  ('tk-sm-l', '{es,en,fr,it}'),
  ('tk-xy-b', '{es,en,fr,it}'),
  ('tk-xy-latia', '{es,en,fr,it}'),
  ('tk-xy-latio', '{es,en,fr,it}'),
  ('tk-xy-n', '{es,en,fr,it}'),
  ('tk-xy-p', '{es,en,fr,it}'),
  ('tk-xy-su', '{es,en,fr,it}'),
  ('tk-xy-sy', '{es,en,fr,it}'),
  ('tk-xy-w', '{es,en,fr,it}'),
  ('xy7', '{es,en,fr,de,it,pt}'),
  ('xy9', '{es,en,fr,de,it,pt}'),
  ('xy8', '{es,en,fr,de,it,pt}'),
  ('dc1', '{en,fr,pt}'),
  ('xy12', '{es,en,fr,de,it,pt}'),
  ('xy10', '{es,en,fr,de,it,pt}'),
  ('xy2', '{es,en,fr,de,it,pt}'),
  ('xy3', '{es,en,fr,de,it,pt}'),
  ('g1', '{es,en,fr,de,it,pt}'),
  ('xy0', '{en,fr,de,it,pt}'),
  ('xy4', '{es,en,fr,de,it,pt}'),
  ('xy5', '{es,en,fr,de,it,pt}'),
  ('xy6', '{es,en,fr,de,it,pt}'),
  ('xy11', '{es,en,fr,de,it,pt}'),
  ('xyp', '{es,en,fr,de,it}'),
  ('xy1', '{es,en,fr,de,it,pt}'),
  ('xya', '{es,en,fr,de,it}')
) as v(set_id, idiomas)
on conflict (set_id, market) do update set idiomas = excluded.idiomas;

-- ── 3. Los idiomas de un set ──
create or replace function public.idiomas_de_set(p_set text, p_market text default 'WEST')
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with precios as (
    select
      bool_or(p.cm_low_es > 0) as es, bool_or(p.cm_low_en > 0) as en,
      bool_or(p.cm_low_de > 0) as de, bool_or(p.cm_low_fr > 0) as fr,
      bool_or(p.cm_low_it > 0) as it, bool_or(p.cm_low_ja > 0) as ja,
      bool_or(p.cm_low_ko > 0) as ko, bool_or(p.cm_low_zh > 0) as zh
    from public.tcg_cards c
    join public.tcg_card_prices p on p.card_id = c.id
    where c.set_id = p_set and c.market = p_market
  ),
  ficha as (
    select idiomas from public.tcg_set_idiomas where set_id = p_set and market = p_market
  )
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(array[
      case when es then 'es' end, case when en then 'en' end, case when de then 'de' end,
      case when fr then 'fr' end, case when it then 'it' end, case when ja then 'ja' end,
      case when ko then 'ko' end, case when zh then 'zh' end
    ]) as x
    from precios
    union all
    select unnest(idiomas) from ficha
    union all
    select 'pt' where p_market = 'WEST'
      and not exists (select 1 from ficha)
      and exists (select 1 from precios where es or en or de or fr or it)
  ) t
  where x is not null
$$;

grant execute on function public.idiomas_de_set(text, text) to anon, authenticated;

-- ── Comprobación ──
-- Plasma Blast: {de,en,fr,it,pt} (sin «es»). Y las dos restricciones con 'ko'.
select public.idiomas_de_set('bw10') as plasma_blast;
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conname in ('user_collection_idioma', 'user_wants_idioma');
