-- Casos de supabase-migration-1007-repetidas-nombres.sql, encima del fixture
-- de la 987 y de la 996. El Reshiram & Charizard GX de las SM Black Star
-- Promos de PINGU: TCGdex lo escribe con guion («-GX»), TCGGO con espacio, y su
-- Jumbo lleva «(Oversized)».
\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, service_role;
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen, tcggo_id, image_path) values
  ('svp-SM201', 'WEST', 'svp', 'SM201', 'Reshiram & Charizard-GX', 'Reshiram & Charizard-GX', null, null, 'sm/smp/SM201'),
  ('tcggo-70001', 'WEST', 'svp', 'SM201', 'Reshiram & Charizard GX', 'Reshiram & Charizard GX', 'tcggo', 70001, null),
  ('tcggo-70002', 'WEST', 'svp', 'SM201', 'Reshiram & Charizard GX (Oversized)', 'Reshiram & Charizard GX (Oversized)', 'tcggo', 70002, null),
  -- Lo que NO debe juntarse: otro nombre con el mismo número.
  ('svp-SM202', 'WEST', 'svp', 'SM202', 'Pikachu V', 'Pikachu V', null, null, null),
  ('tcggo-70003', 'WEST', 'svp', 'SM202', 'Pikachu VMAX', 'Pikachu VMAX', 'tcggo', 70003, null),
  -- Una pareja marcada «son distintas» con el nombre de antes (tal cual).
  ('svp-SM203', 'WEST', 'svp', 'SM203', 'Mew-EX', 'Mew-EX', null, null, null),
  ('tcggo-70004', 'WEST', 'svp', 'SM203', 'Mew EX', 'Mew EX', 'tcggo', 70004, null);
insert into public.tcg_repetidas_distintas (market, set_id, numero, nombre, ids)
  values ('WEST', 'svp', 'sm203', 'mew-ex', array['svp-SM203', 'tcggo-70004']);
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';

insert into resultado (caso, ok) select 'el nombre sin guiones, signos, paréntesis ni «Jumbo»/«Oversized»',
  public.catalogo_nombre_de_repetida('Reshiram & Charizard-GX') = 'reshiramcharizardgx'
  and public.catalogo_nombre_de_repetida('Reshiram & Charizard GX (Oversized)') = 'reshiramcharizardgx'
  and public.catalogo_nombre_de_repetida('Reshiram & Charizard GX [Jumbo]') = 'reshiramcharizardgx'
  and public.catalogo_nombre_de_repetida('Pokémon Jumbo Charizard') = 'pokemoncharizard';
insert into resultado (caso, ok) select '  …y lo distinto sigue distinto («Pikachu V» no es «Pikachu VMAX»)',
  public.catalogo_nombre_de_repetida('Pikachu V') <> public.catalogo_nombre_de_repetida('Pikachu VMAX');
insert into resultado (caso, ok) select 'el Reshiram & Charizard GX sale, las tres juntas (la de TCGdex primero)',
  exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g
           where g->>'numero' = 'sm201' and jsonb_array_length(g->'cartas') = 3 and g->'cartas'->0->>'id' = 'svp-SM201');
insert into resultado (caso, ok) select '  …el Pikachu V y el VMAX no',
  not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g, jsonb_array_elements(g->'cartas') c where c->>'id' = 'tcggo-70003');
insert into resultado (caso, ok) select 'lo marcado «son distintas» con el nombre de antes no vuelve a salir',
  not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g, jsonb_array_elements(g->'cartas') c where c->>'id' = 'svp-SM203');
-- Marcarla con el nombre nuevo y quitar la marca, por la función de la 987.
-- Cada paso en su sentencia: la lista es `stable` y en la misma no vería lo
-- recién escrito.
select public.catalogo_repetidas_distintas('WEST', 'svp', 'sm201', 'reshiramcharizardgx', array['svp-SM201', 'tcggo-70001', 'tcggo-70002']);
insert into resultado (caso, ok) select 'marcar «son distintas» la del Reshiram la esconde',
  not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'numero' = 'sm201');
select public.catalogo_repetidas_distintas('WEST', 'svp', 'sm201', 'reshiramcharizardgx', null, true);
insert into resultado (caso, ok) select '  …y quitar la marca la devuelve',
  exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'numero' = 'sm201');

reset role;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado order by n;
