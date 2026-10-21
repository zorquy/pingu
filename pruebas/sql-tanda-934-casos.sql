\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, service_role;
set role authenticated;

-- Un usuario normal no crea versiones ni borra cartas.
set prueba.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin perform public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "Metálica"}'::jsonb);
    insert into resultado (caso, ok) values ('alguien que no es admin no crea versiones', false);
  exception when insufficient_privilege then insert into resultado (caso, ok) values ('alguien que no es admin no crea versiones', true); end;
  begin perform public.catalogo_borrar_carta('mano-sv10.5b-999', 'WEST');
    insert into resultado (caso, ok) values ('  …ni borra cartas', false);
  exception when insufficient_privilege then insert into resultado (caso, ok) values ('  …ni borra cartas', true); end;
end $$;

set prueba.uid = '00000000-0000-0000-0000-00000000000a';
-- La metálica del Charizard: sin id de TCGGO, el suyo es negativo.
select public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "Metálica", "icono": "metalica", "imagen": "https://x/metal.png", "salio_en": "Celebrations Ultra-Premium Collection", "lanzamiento": "2021-10-22", "clase": "adicional", "link_cm": "https://www.cardmarket.com/es/Pokemon/Products/x"}'::jsonb);
insert into resultado (caso, ok) select 'el admin crea la versión, con su id negativo y todo lo suyo',
  count(*) = 1 and bool_and(tcggo_id < 0 and origen = 'mano' and set_id = 'base1' and nombre = 'Charizard' and salio_en like 'Celebrations%' and lanzamiento = '2021-10-22' and clase = 'adicional' and icono = 'metalica')
  from tcg_card_versions where card_id = 'base1-4';
-- Con el id de TCGGO, ese.
select public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "Sello Pokémon Day", "clase": "sello", "tcggo_id": "77001"}'::jsonb);
insert into resultado (caso, ok) select 'con id de TCGGO, la versión lleva ese', exists (select 1 from tcg_card_versions where tcggo_id = 77001 and origen = 'mano' and clase = 'sello');
do $$ begin
  begin perform public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "Otra", "tcggo_id": "77001"}'::jsonb);
    insert into resultado (caso, ok) values ('  …y no se repite', false);
  exception when unique_violation then insert into resultado (caso, ok) values ('  …y no se repite', true); end;
  begin perform public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "Reverse Holo"}'::jsonb);
    insert into resultado (caso, ok) values ('un nombre de las de siempre no vale', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('un nombre de las de siempre no vale', true); end;
  begin perform public.catalogo_version_mano('base1-4', 'WEST', '{"clase": "sello"}'::jsonb);
    insert into resultado (caso, ok) values ('sin nombre no hay versión', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('sin nombre no hay versión', true); end;
end $$;
-- El id de la versión, como el de la web.
insert into resultado (caso, ok) select 'el id de una versión es el de la web («Metálica» → metalica, «Sello Pokémon Day» → sello-pokemon-day)',
  public.catalogo_id_de_version('Metálica') = 'metalica' and public.catalogo_id_de_version('Sello Pokémon Day') = 'sello-pokemon-day' and public.catalogo_id_de_version('  ¡Gold Star! ') = 'gold-star';
-- Renombrar mueve las copias.
reset role;
insert into user_collection (card_id, user_id, cantidad, variante) values ('base1-4', '00000000-0000-0000-0000-0000000000c2', 1, 'metalica');
set role authenticated;
select public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "Metal Card", "icono": "metalica", "clase": "adicional"}'::jsonb, (select tcggo_id from tcg_card_versions where card_id = 'base1-4' and tcggo_id < 0));
insert into resultado (caso, ok) select 'renombrar una versión mueve las copias apuntadas a su nombre nuevo',
  (select count(*) from user_collection where card_id = 'base1-4' and variante = 'metal-card') = 1 and (select count(*) from user_collection where variante = 'metalica') = 0;
-- Borrar una versión con copias, no; sin copias, sí.
do $$ begin
  begin perform public.catalogo_borrar_version_mano((select tcggo_id from tcg_card_versions where card_id = 'base1-4' and tcggo_id < 0));
    insert into resultado (caso, ok) values ('una versión con copias apuntadas no se borra', false);
  exception when foreign_key_violation then insert into resultado (caso, ok) values ('una versión con copias apuntadas no se borra', true); end;
end $$;
select public.catalogo_borrar_version_mano(77001);
insert into resultado (caso, ok) select '  …y una sin copias, sí', not exists (select 1 from tcg_card_versions where tcggo_id = 77001);
reset role;
insert into tcg_card_versions (tcggo_id, card_id, etiqueta) values (55555, 'base1-4', 'Poké Ball');
set role authenticated;
do $$ begin
  begin perform public.catalogo_borrar_version_mano(55555);
    insert into resultado (caso, ok) values ('una versión de TCGGO no se borra desde aquí', false);
  exception when insufficient_privilege then insert into resultado (caso, ok) values ('una versión de TCGGO no se borra desde aquí', true); end;
end $$;

-- ── Borrar una carta ──
insert into resultado (caso, ok) select 'quién la tiene: copias, personas, deseos y álbumes',
  (q->>'copias')::int = 2 and (q->>'personas')::int = 1 and (q->>'deseos')::int = 2 and (q->>'albumes')::int = 1
  from (select public.catalogo_quien_tiene_carta('tcggo-9060', 'WEST') q) x;
do $$ begin
  begin perform public.catalogo_borrar_carta('tcggo-9060', 'WEST');
    insert into resultado (caso, ok) values ('una carta que alguien tiene no se borra sin decir a dónde pasa', false);
  exception when foreign_key_violation then insert into resultado (caso, ok) values ('una carta que alguien tiene no se borra sin decir a dónde pasa', true); end;
end $$;
select public.catalogo_borrar_carta('tcggo-9060', 'WEST', 'sv10.5b-060');
insert into resultado (caso, ok) select 'con destino: la carta se va con su precio',
  not exists (select 1 from tcg_cards where id = 'tcggo-9060') and not exists (select 1 from tcg_card_prices where card_id = 'tcggo-9060');
insert into resultado (caso, ok) select '  …las copias pasan a la buena',
  (select coalesce(sum(cantidad), 0) from user_collection where card_id = 'sv10.5b-060') = 2;
insert into resultado (caso, ok) select '  …el deseo repetido se queda el de allí, y el otro pasa',
  (select count(*) from user_wants where card_id = 'sv10.5b-060') = 2 and (select count(*) from user_wants where card_id = 'tcggo-9060') = 0;
insert into resultado (caso, ok) select '  …y el álbum apunta a la buena, en su sitio y con lo demás',
  (select cartas from user_albums limit 1) = '[{"id": "base1-4"}, {"id": "sv10.5b-060", "pos": 3}]'::jsonb;
insert into resultado (caso, ok) select '  …y queda la lápida', exists (select 1 from tcg_correcciones where id = 'tcggo-9060' and columna = '__borrada');
-- La pasada intenta volver a crearla: no puede, y sin error.
reset role;
insert into tcg_cards (id, market, set_id, local_id, name, origen) values
  ('tcggo-9060', 'WEST', 'sv10.5b', '60', 'Escavalier', 'tcggo'),
  ('tcggo-7777', 'WEST', 'sv10.5b', '77', 'Karrablast', 'tcggo')
  on conflict (id, market) do update set name = excluded.name;
insert into resultado (caso, ok) select 'una pasada no la vuelve a crear (y no da error)', not exists (select 1 from tcg_cards where id = 'tcggo-9060');
insert into resultado (caso, ok) select '  …y la otra carta de la misma sentencia sí se escribe', exists (select 1 from tcg_cards where id = 'tcggo-7777');
set role authenticated;
-- La de a mano, sin dueño: se borra y no deja lápida.
select public.catalogo_borrar_carta('mano-sv10.5b-999', 'WEST');
insert into resultado (caso, ok) select 'una de a mano sin dueño se borra sin lápida',
  not exists (select 1 from tcg_cards where id = 'mano-sv10.5b-999') and not exists (select 1 from tcg_correcciones where id = 'mano-sv10.5b-999');

reset role;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado order by n;
