-- «Las energías especiales, bien traducidas», contra PostgreSQL (tanda 629).
--
-- supabase-migration-nombres-energias.sql corrige los nombres que TCGdex
-- dejó con el tipo en inglés. Aquí se pregunta, con filas como las de
-- producción (copiadas de la base el 2026-10-05):
--   1. ¿«Energía Psychic Telepática» pasa a «Energía Psíquica Telepática»,
--      en `name_es` y en `name`?
--   2. ¿Los Amuletos Hada, con el tipo como sustantivo?
--   3. ¿El nombre inglés con «[W]» o «\[W\]» pasa a «Water»?
--   4. ¿Las tres de Perfect Order reciben su nombre inglés?
--   5. ¿Lo que ya estaba bien NO se toca (ni «Telepathic Psychic Energy» ni
--      «Energía Psíquica» ni un Pokémon)?
--   6. ¿Se puede ejecutar dos veces?
--
--   psql -h /var/tmp -p 5433 -U postgres -v raiz=/home/user/pingu -f sql-nombres-energias.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = notice;

drop table if exists public.tcg_cards cascade;
create table public.tcg_cards (
  id text not null, market text not null default 'WEST', set_id text, local_id text,
  name text not null, name_es text, name_en text,
  primary key (id, market));
insert into public.tcg_cards (id, set_id, local_id, name, name_es, name_en) values
  ('me03-086', 'me03', '086', 'Energía Grass Creciente', 'Energía Grass Creciente', null),
  ('me03-087', 'me03', '087', 'Energía Fighting Rocosa', 'Energía Fighting Rocosa', null),
  ('me03-088', 'me03', '088', 'Energía Psychic Telepática', 'Energía Psychic Telepática', null),
  ('me04-084', 'me04', '084', 'Energía Water Burbujeante', 'Energía Water Burbujeante', 'Bubbly \[W\] Energy'),
  ('me04-085', 'me04', '085', 'Energía Metal Magnética', 'Energía Metal Magnética', 'Magnetic \[M\] Energy'),
  ('me05-083', 'me05', '083', 'Energía Darkness Sombría', 'Energía Darkness Sombría', 'Shadowy [D] Energy'),
  ('swsh3-176', 'swsh3', '176', 'Powerful Colorless Energy', 'Energía Colorless Poderosa', 'Powerful Colorless Energy'),
  ('sm8-175', 'sm8', '175', 'Fairy Charm Psychic', 'Amuleto Hada Psychic', null),
  ('tcggo-31886', 'me03', '88', 'Telepathic Psychic Energy', null, 'Telepathic Psychic Energy'),
  ('mee-005', 'mee', '005', 'Energía Psíquica', 'Energía Psíquica', null),
  ('me01-056', 'me01', '056', 'Alakazam', 'Alakazam', 'Alakazam'),
  ('xx-1', 'xx', '1', 'Metal Saucer', 'Platillo Metal', 'Metal Saucer');

\i :raiz/supabase-migration-nombres-energias.sql
create temp table primera as select * from public.tcg_cards;
\i :raiz/supabase-migration-nombres-energias.sql

create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;

\echo '── 1. El tipo, traducido ──'
select public.comprobar('«Energía Psychic Telepática» → «Energía Psíquica Telepática» (name_es y name)',
  (select name_es = 'Energía Psíquica Telepática' and name = 'Energía Psíquica Telepática' from public.tcg_cards where id = 'me03-088'),
  (select name_es || ' / ' || name from public.tcg_cards where id = 'me03-088'));
select public.comprobar('y las demás: Planta, Lucha, Agua, Metálica, Oscura, Incolora',
  (select string_agg(name_es, ',' order by id) from public.tcg_cards where id in ('me03-086', 'me03-087', 'me04-084', 'me04-085', 'me05-083', 'swsh3-176'))
   = 'Energía Planta Creciente,Energía Lucha Rocosa,Energía Agua Burbujeante,Energía Metálica Magnética,Energía Oscura Sombría,Energía Incolora Poderosa',
  (select string_agg(name_es, ',' order by id) from public.tcg_cards where id in ('me03-086', 'me03-087', 'me04-084', 'me04-085', 'me05-083', 'swsh3-176')));
select public.comprobar('un `name` en inglés no se toca', (select name = 'Powerful Colorless Energy' from public.tcg_cards where id = 'swsh3-176'));

\echo '── 2. Los Amuletos Hada ──'
select public.comprobar('«Amuleto Hada Psychic» → «Amuleto Hada Psíquico»', (select name_es = 'Amuleto Hada Psíquico' from public.tcg_cards where id = 'sm8-175'));

\echo '── 3. El nombre inglés sin símbolos ──'
select public.comprobar('«Bubbly \[W\] Energy», «Magnetic \[M\] Energy», «Shadowy [D] Energy» → Water, Metal, Darkness',
  (select string_agg(name_en, ',' order by id) from public.tcg_cards where id in ('me04-084', 'me04-085', 'me05-083')) = 'Bubbly Water Energy,Magnetic Metal Energy,Shadowy Darkness Energy',
  (select string_agg(name_en, ',' order by id) from public.tcg_cards where id in ('me04-084', 'me04-085', 'me05-083')));

\echo '── 4. Perfect Order, con su nombre inglés ──'
select public.comprobar('Growing Grass, Rocky Fighting y Telepathic Psychic',
  (select string_agg(name_en, ',' order by id) from public.tcg_cards where id in ('me03-086', 'me03-087', 'me03-088')) = 'Growing Grass Energy,Rocky Fighting Energy,Telepathic Psychic Energy',
  (select string_agg(coalesce(name_en, '∅'), ',' order by id) from public.tcg_cards where id in ('me03-086', 'me03-087', 'me03-088')));

\echo '── 5. Lo que estaba bien, igual ──'
select public.comprobar('ni la inglesa, ni la básica, ni un Pokémon, ni un «Platillo Metal»',
  (select count(*) from public.tcg_cards where (id = 'tcggo-31886' and name = 'Telepathic Psychic Energy' and name_es is null)
     or (id = 'mee-005' and name_es = 'Energía Psíquica') or (id = 'me01-056' and name_es = 'Alakazam') or (id = 'xx-1' and name_es = 'Platillo Metal')) = 4);

\echo '── 6. Dos veces ──'
select public.comprobar('la segunda pasada no cambia nada',
  not exists (select 1 from primera p join public.tcg_cards c using (id, market)
              where p.name is distinct from c.name or p.name_es is distinct from c.name_es or p.name_en is distinct from c.name_en));
