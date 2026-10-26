-- Casos de supabase-migration-1037-repetidas-por-idioma.sql (después de
-- ejecutarla dos veces sobre sql-tanda-1037-datos.sql).
\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
insert into resultado (caso, ok) select 'el Zekrom de N es UNA carta: se queda mep-031',
  exists (select 1 from public.tcg_cards where id = 'mep-031') and not exists (select 1 from public.tcg_cards where id = 'tcggo-33636');
insert into resultado (caso, ok) select '  …con la de Pokémon Center y la Standard mudadas',
  (select array_agg(tcggo_id order by tcggo_id) from public.tcg_card_versions where card_id = 'mep-031') = array[-18578, 33636];
insert into resultado (caso, ok) select '  …las copias de las dos personas, en mep-031 y con su versión',
  (select array_agg(variante order by variante) from public.user_collection where card_id = 'mep-031') = array['holo', 'pokemon-center'];
insert into resultado (caso, ok) select '  …con el producto de Cardmarket apuntado como corrección',
  (select cm_id_product_propio from public.tcg_cards where id = 'mep-031') = 873702
  and exists (select 1 from public.tcg_correcciones where id = 'mep-031' and columna = 'cm_id_product_propio' and valor = '873702'::jsonb);
insert into resultado (caso, ok) select '  …con el precio que tenía la de TCGGO y su tcggo_id',
  (select cm_low_es from public.tcg_card_prices where card_id = 'mep-031') = 4 and (select tcggo_id from public.tcg_cards where id = 'mep-031') = 33636;
insert into resultado (caso, ok) select '  …lápida para tcggo-33636 y la jugada en «Hechas», a nombre del admin',
  exists (select 1 from public.tcg_correcciones where id = 'tcggo-33636' and columna = '__borrada')
  and (select count(*) from public.tcg_repetidas_hechas where carta = 'tcggo-33636' and destino = 'mep-031' and decision = 'misma' and autor = '00000000-0000-0000-0000-00000000000a') = 1;
insert into resultado (caso, ok) select 'el admin prestado no se queda: fuera del do no hay sesión',
  auth.uid() is null;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into resultado (caso, ok) select 'la lista junta «Pikachu de Ash» y «Ash''s Pikachu» (comparten el nombre en español)',
  exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g
           where g->>'set_id' = 'mep' and g->>'numero' = '50'
             and (select array_agg(c->>'id' order by c->>'id') from jsonb_array_elements(g->'cartas') c) = array['mep-050', 'tcggo-50']);
insert into resultado (caso, ok) select '  …y no Mew con Mewtwo, ni el Zekrom ya resuelto',
  not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'set_id' = 'mep' and g->>'numero' in ('60', '31'));
insert into resultado (caso, ok) select '  …y lo de la 987 sigue: el Darmanitan, el Snorlax, y nada del Mew con el Mewtwo',
  exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'set_id' = 'svp' and g->>'numero' = '181')
  and exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'set_id' = 'svp' and g->>'numero' = '200')
  and not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'set_id' = 'svp' and g->>'numero' = '100');
-- «Son distintas» sigue escondiendo el grupo.
select public.catalogo_repetidas_distintas('WEST', 'mep', '50', 'ashspikachu', array['mep-050', 'tcggo-50']);
insert into resultado (caso, ok) select 'marcadas «son distintas», ya no salen',
  not exists (select 1 from jsonb_array_elements(public.catalogo_posibles_repetidas('WEST')->'grupos') g where g->>'set_id' = 'mep' and g->>'numero' = '50');
-- Deshacer la del Zekrom devuelve las dos.
-- (En dos sentencias: la que llama no ve lo que la función acaba de escribir.)
insert into resultado (caso, ok) select 'deshacer desde /admin devuelve tcggo-33636',
  public.catalogo_repetida_deshacer((select id from public.tcg_repetidas_hechas where carta = 'tcggo-33636'))->>'carta' = 'tcggo-33636';
insert into resultado (caso, ok) select '  …con sus versiones y las copias, como estaban',
  exists (select 1 from public.tcg_cards where id = 'tcggo-33636')
  and (select array_agg(tcggo_id order by tcggo_id) from public.tcg_card_versions where card_id = 'tcggo-33636') = array[-18578, 33636]
  and (select count(*) from public.user_collection where card_id = 'tcggo-33636') = 2;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado order by n;
