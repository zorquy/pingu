\set ON_ERROR_STOP on
create table public.resultado945 (n serial, caso text, ok boolean);
create function pg_temp.vs(p text) returns text language sql as $$
  select string_agg(etiqueta || ':' || coalesce(cm_id_product::text, '-') || ':' || coalesce(origen, 'tcggo'), ', ' order by etiqueta) from public.tcg_card_versions where card_id = p and coalesce(etiqueta, '') <> 'Standard' $$;

insert into resultado945 (caso, ok) select 'Pansage lleva su Poké Ball y su Master Ball, con el producto de Cardmarket de cada una — ' || coalesce(pg_temp.vs('sv10.5b-004'), '(nada)'),
  pg_temp.vs('sv10.5b-004') = 'Master Ball:836271:tcgdex, Poké Ball:836261:tcgdex';
insert into resultado945 (caso, ok) select '  …como impresiones (cuentan para el maestro)',
  (select bool_and(clase = 'impresion') from tcg_card_versions where card_id = 'sv10.5b-004' and origen = 'tcgdex');
insert into resultado945 (caso, ok) select 'la Poké Ball colada como carta ya no existe, y deja lápida',
  not exists (select 1 from tcg_cards where id = 'tcggo-90041') and exists (select 1 from tcg_correcciones where id = 'tcggo-90041' and columna = '__borrada');
insert into resultado945 (caso, ok) select '  …sus dos copias son Poké Ball del Pansage, y la reverse que había se queda',
  (select string_agg(variante || 'x' || cantidad, ',' order by variante) from user_collection where card_id = 'sv10.5b-004') = 'poke-ballx2,reversex1';
insert into resultado945 (caso, ok) select '  …su deseo pasa al Pansage, su foto a la Poké Ball y su fila de TCGGO a la carta',
  exists (select 1 from user_wants where card_id = 'sv10.5b-004' and user_id = '00000000-0000-0000-0000-0000000000c3')
  and (select imagen from tcg_card_versions where card_id = 'sv10.5b-004' and etiqueta = 'Poké Ball') = 'https://tcggo/pansage-pb.png'
  and (select card_id from tcg_card_versions where tcggo_id = 70041) = 'sv10.5b-004'
  and not exists (select 1 from tcg_card_prices where card_id = 'tcggo-90041');
insert into resultado945 (caso, ok) select 'Snivy: la Poké Ball de TCGGO no se repite (y gana su producto); la Master Ball, sí, de TCGdex — ' || coalesce(pg_temp.vs('sv10.5b-001'), '(nada)'),
  pg_temp.vs('sv10.5b-001') = 'Master Ball:836269:tcgdex, Poké Ball:836259:tcggo';
insert into resultado945 (caso, ok) select 'en el número de Servine hay otra carta: no lleva nada',
  pg_temp.vs('sv10.5b-002') is null;
insert into resultado945 (caso, ok) select 'Simisage, en el set hermano de la misma expansión de TCGGO, también — ' || coalesce(pg_temp.vs('tcggo-610-005'), '(nada)'),
  pg_temp.vs('tcggo-610-005') = 'Master Ball:836272:tcgdex, Poké Ball:836262:tcgdex';
insert into resultado945 (caso, ok) select 'Escavalier (la de la 934): las suyas van a la buena, no a la «tcggo-…» de su número',
  pg_temp.vs('sv10.5b-060') = 'Master Ball:836414:tcgdex, Poké Ball:836416:tcgdex' and not exists (select 1 from tcg_card_versions where card_id = 'tcggo-9060' and origen = 'tcgdex');
insert into resultado945 (caso, ok) select 'el Charizard de la 935 sigue con sus ediciones y nada más',
  not exists (select 1 from tcg_card_versions where card_id = 'base1-4' and origen = 'tcgdex') and (select count(*) from tcg_card_versions where card_id = 'base1-4' and origen = 'edicion') = 4;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado945 order by n;
