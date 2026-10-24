-- Casos de supabase-migration-996-repetidas-promos.sql, encima del fixture
-- de la 987. El Mewtwo ex del Team Rocket SVP 205 de PINGU: la de TCGdex
-- («205», con foto) y la que creó el catálogo de TCGGO con SU número
-- («SVP 205»), sin foto y con dos versiones puestas a mano.
\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, service_role;
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen, tcggo_id, image_path) values
  ('svp-205', 'WEST', 'svp', '205', 'Team Rocket''s Mewtwo ex', 'Team Rocket''s Mewtwo ex', null, null, 'sv/svp/205'),
  ('tcggo-48064', 'WEST', 'svp', 'SVP 205', 'Team Rocket''s Mewtwo ex', 'Team Rocket''s Mewtwo ex', 'tcggo', 48064, null),
  -- Lo que NO debe juntarse: «TG01» es otra numeración (sin espacio).
  ('svp-tg01', 'WEST', 'svp', 'TG01', 'Pikachu de prueba', 'Pikachu de prueba', null, null, null),
  ('svp-001b', 'WEST', 'svp', '1', 'Pikachu de prueba', 'Pikachu de prueba', null, null, null);
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, nombre, etiqueta, clase, origen) values
  (-9001, 'WEST', 'tcggo-48064', 'svp', 'SVP 205', 'Team Rocket''s Mewtwo ex', 'Reverse Holo', 'impresion', 'mano'),
  (-9002, 'WEST', 'tcggo-48064', 'svp', 'SVP 205', 'Team Rocket''s Mewtwo ex', 'Sello Pokémon Center', 'sello', 'mano'),
  -- La principal ya tiene su Reverse: la de la repetida no se duplica.
  (-9003, 'WEST', 'svp-205', 'svp', '205', 'Team Rocket''s Mewtwo ex', 'Reverse Holo', 'impresion', 'mano');
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';

insert into resultado (caso, ok) select 'el número sin el código de delante: «SVP 205» es «205», «MEP 001» es «1»',
  public.catalogo_numero_de_repetida('SVP 205') = '205' and public.catalogo_numero_de_repetida('MEP 001') = '1' and public.catalogo_numero_de_repetida('205') = '205';
insert into resultado (caso, ok) select '  …y sin espacio se queda como estaba («TG01» no es «1»)',
  public.catalogo_numero_de_repetida('TG01') = 'tg1' and public.catalogo_numero_de_repetida('SWSH001') = 'swsh1';
insert into resultado (caso, ok) select 'el Mewtwo sale en «Posibles repetidas», con la de TCGdex primero',
  exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g
           where g->>'numero' = '205' and g->'cartas'->0->>'id' = 'svp-205' and g->'cartas'->1->>'id' = 'tcggo-48064');
insert into resultado (caso, ok) select '  …y el Pikachu «TG01» y «1» no',
  not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g, jsonb_array_elements(g->'cartas') c where c->>'id' = 'svp-tg01');

-- «Es la misma carta»: la de TCGGO se va a la de TCGdex.
create temp table r1 as select public.catalogo_repetida_resolver('tcggo-48064', 'svp-205', 'WEST', 'misma') as v;
insert into resultado (caso, ok)
  select 'resolver como la misma se muda la versión que la principal no tenía (1)', (v->>'versiones_movidas')::int = 1 from r1;
insert into resultado (caso, ok) select '  …el sello está ahora en svp-205',
  exists (select 1 from public.tcg_card_versions where tcggo_id = -9002 and card_id = 'svp-205' and set_id = 'svp');
insert into resultado (caso, ok) select '  …la Reverse no sale dos veces (se queda la que ya tenía)',
  (select count(*) from public.tcg_card_versions where card_id = 'svp-205' and etiqueta = 'Reverse Holo') = 1
  and exists (select 1 from public.tcg_card_versions where tcggo_id = -9003 and card_id = 'svp-205');
insert into resultado (caso, ok) select '  …y la de TCGGO ya no existe ni deja versiones sueltas',
  not exists (select 1 from public.tcg_cards where id = 'tcggo-48064') and not exists (select 1 from public.tcg_card_versions where card_id = 'tcggo-48064');

-- Deshacer: todo como estaba.
insert into resultado (caso, ok) select 'deshacer devuelve la carta',
  public.catalogo_repetida_deshacer((select (v->>'hecha')::bigint from r1))->>'carta' = 'tcggo-48064';
insert into resultado (caso, ok) select '  …con sus dos versiones, como las tenía',
  (select array_agg(tcggo_id order by tcggo_id) from public.tcg_card_versions where card_id = 'tcggo-48064') = array[-9002, -9001];
insert into resultado (caso, ok) select '  …y la principal se queda solo con la suya',
  (select array_agg(tcggo_id order by tcggo_id) from public.tcg_card_versions where card_id = 'svp-205') = array[-9003];

-- «Es una versión»: también se mudan las suyas.
create temp table r2 as select public.catalogo_repetida_resolver('tcggo-48064', 'svp-205', 'WEST', 'version', 'Staff') as v;
insert into resultado (caso, ok) select 'como versión («Staff»): la nueva versión y el sello mudado',
  (select (v->>'versiones_movidas')::int = 1 from r2)
  and exists (select 1 from public.tcg_card_versions where card_id = 'svp-205' and etiqueta = 'Staff' and origen = 'fundida')
  and exists (select 1 from public.tcg_card_versions where tcggo_id = -9002 and card_id = 'svp-205');
create temp table d2 as select public.catalogo_repetida_deshacer((select (v->>'hecha')::bigint from r2)) as v;
insert into resultado (caso, ok) select '  …y deshacer quita la Staff', (select (v->>'version_quitada')::boolean from d2)
  and not exists (select 1 from public.tcg_card_versions where card_id = 'svp-205' and etiqueta = 'Staff');
insert into resultado (caso, ok) select '  …y devuelve el sello a la repetida',
  (select array_agg(tcggo_id order by tcggo_id) from public.tcg_card_versions where card_id = 'tcggo-48064') = array[-9002, -9001];

reset role;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado order by n;
