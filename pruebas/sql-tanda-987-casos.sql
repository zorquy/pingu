\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, service_role;
set role authenticated;

-- Un usuario normal no ve la lista ni decide nada.
set prueba.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin perform public.catalogo_posibles_repetidas();
    insert into resultado (caso, ok) values ('alguien que no es admin no ve las repetidas', false);
  exception when insufficient_privilege then insert into resultado (caso, ok) values ('alguien que no es admin no ve las repetidas', true); end;
  begin perform public.catalogo_repetida_resolver('tcggo-48211', 'svp-181', 'WEST', 'version', 'Staff');
    insert into resultado (caso, ok) values ('  …ni convierte una en versión', false);
  exception when insufficient_privilege then insert into resultado (caso, ok) values ('  …ni convierte una en versión', true); end;
end $$;

set prueba.uid = '00000000-0000-0000-0000-00000000000a';
-- ── La lista ──
create temp table lista as select public.catalogo_posibles_repetidas('WEST') as v;
insert into resultado (caso, ok) select 'salen el Darmanitan, el Pikachu («060» y «60»), el Snorlax y el Escavalier de la 934 («060» y «60»)',
  (v->>'total')::int = 4 and (select array_agg(g->>'numero' order by g->>'numero') from jsonb_array_elements(v->'grupos') g) = array['181', '200', '60', '60'] from lista;
insert into resultado (caso, ok) select '  …ni Mew contra Mewtwo (otro nombre) ni lo de una colección escondida',
  not exists (select 1 from lista, jsonb_array_elements(v->'grupos') g where g->>'numero' in ('100', '1')) from lista limit 1;
insert into resultado (caso, ok) select 'la primera de cada grupo es la que ya teníamos (la de TCGdex antes que la de TCGGO)',
  (select g->'cartas'->0->>'id' from lista, jsonb_array_elements(v->'grupos') g where g->>'numero' = '181') = 'svp-181';
insert into resultado (caso, ok) select '  …y trae lo que hace falta para decidir (fotos, PS, precio, quién la tiene)',
  (select (c->>'hp')::int = 140 and c->>'image_tcggo' = 'https://tcggo/darmanitan-staff.png' and (c->'precio'->>'cm_low_es')::numeric = 7 and (c->>'personas')::int = 1
            and c->'tcg_sets'->>'tcg_online_code' = 'SVP'
     from lista, jsonb_array_elements(v->'grupos') g, jsonb_array_elements(g->'cartas') c where c->>'id' = 'tcggo-48211');
insert into resultado (caso, ok) select 'el japonés no se mezcla: con el catálogo JP no hay ninguna', (public.catalogo_posibles_repetidas('JP')->>'total')::int = 0;

-- ── Errores ──
do $$ begin
  begin perform public.catalogo_repetida_resolver('tcggo-48211', 'svp-181', 'WEST', 'version', 'Reverse Holo');
    insert into resultado (caso, ok) values ('un nombre de las de siempre no vale', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('un nombre de las de siempre no vale', true); end;
  begin perform public.catalogo_repetida_resolver('tcggo-48211', 'svp-181', 'WEST', 'version', null);
    insert into resultado (caso, ok) values ('sin nombre no hay versión', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('sin nombre no hay versión', true); end;
  begin perform public.catalogo_repetida_resolver('tcggo-48211', 'oc-1', 'WEST', 'misma');
    insert into resultado (caso, ok) values ('dos cartas de colecciones distintas no se juntan', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('dos cartas de colecciones distintas no se juntan', true); end;
end $$;

-- ── La Staff, versión del Darmanitan ──
create temp table r1 as select public.catalogo_repetida_resolver('tcggo-48211', 'svp-181', 'WEST', 'version', 'Staff', 'sello', 'https://tcggo/darmanitan-staff.png') as v;
insert into resultado (caso, ok) select 'la principal gana la versión «Staff»: fundida, sello, con su foto, su producto y su precio',
  count(*) = 1 and bool_and(origen = 'fundida' and clase = 'sello' and tcggo_id < 0 and imagen = 'https://tcggo/darmanitan-staff.png' and cm_id_product = 790002
    and cm_low_es = 7 and cm_low_en = 19 and numero = '181' and nombre = 'N''s Darmanitan' and set_id = 'svp')
  from tcg_card_versions where card_id = 'svp-181' and etiqueta = 'Staff';
insert into resultado (caso, ok) select '  …la repetida se va con su precio, su histórico, sus versiones y sus correcciones',
  not exists (select 1 from tcg_cards where id = 'tcggo-48211') and not exists (select 1 from tcg_card_prices where card_id = 'tcggo-48211')
  and not exists (select 1 from tcg_card_history where card_id = 'tcggo-48211') and not exists (select 1 from tcg_card_versions where card_id = 'tcggo-48211')
  and not exists (select 1 from tcg_correcciones where id = 'tcggo-48211' and columna <> '__borrada');
insert into resultado (caso, ok) select '  …la copia de la Staff pasa a la principal como «staff», y las de la normal no se tocan',
  (select count(*) from user_collection where card_id = 'svp-181' and market = 'WEST' and variante = 'staff' and cantidad = 1) = 1
  and (select count(*) from user_collection where card_id = 'svp-181' and market = 'WEST' and variante = 'normal' and cantidad = 2) = 1;
insert into resultado (caso, ok) select '  …y la del japonés con el mismo id sigue en el japonés',
  (select count(*) from user_collection where card_id = 'svp-181' and market = 'JP' and variante = 'normal') = 1;
insert into resultado (caso, ok) select '  …el deseo repetido se queda el de allí y el otro pasa',
  (select count(*) from user_wants where card_id = 'svp-181') = 2 and (select count(*) from user_wants where card_id = 'tcggo-48211') = 0;
insert into resultado (caso, ok) select '  …el álbum, el aviso y la vitrina apuntan a la principal',
  (select cartas from user_albums where user_id = '00000000-0000-0000-0000-0000000000c1' and cartas @> '[{"pos": 4}]') = '[{"id": "svp-181"}, {"id": "svp-181", "pos": 4}]'::jsonb
  and exists (select 1 from user_price_alerts where card_id = 'svp-181') and exists (select 1 from user_showcase where card_id = 'svp-181');
insert into resultado (caso, ok) select '  …queda la lápida, y lo dice', exists (select 1 from tcg_correcciones where id = 'tcggo-48211' and columna = '__borrada')
  and (select v->'lapidas' from r1) = '["tcggo-48211"]'::jsonb;
reset role;
insert into tcg_cards (id, market, set_id, local_id, name, origen, tcggo_id) values ('tcggo-48211', 'WEST', 'svp', '181', 'N''s Darmanitan', 'tcggo', 48211)
  on conflict (id, market) do update set name = excluded.name;
insert into resultado (caso, ok) select 'el catálogo de TCGGO no la vuelve a crear (y no da error)', not exists (select 1 from tcg_cards where id = 'tcggo-48211');
set role authenticated;
insert into resultado (caso, ok) select 'el grupo ya no sale, y sale en «hechas»',
  not exists (select 1 from jsonb_array_elements(v->'grupos') g where g->>'numero' = '181') and exists (select 1 from jsonb_array_elements(v->'hechas') h where h->>'carta' = 'tcggo-48211' and h->>'etiqueta' = 'Staff')
  from (select public.catalogo_posibles_repetidas('WEST') v) x;

-- ── Deshacer ──
select public.catalogo_repetida_deshacer((select (v->>'hecha')::bigint from r1));
insert into resultado (caso, ok) select 'deshacer: la carta vuelve tal cual (con su número, su producto y su id de TCGGO)',
  exists (select 1 from tcg_cards where id = 'tcggo-48211' and market = 'WEST' and local_id = '181' and cm_id_product_propio = 790002 and tcggo_id = 48211 and origen = 'tcggo' and name_key = 'n''s darmanitan');
insert into resultado (caso, ok) select '  …con su corrección a mano puesta encima y su precio',
  exists (select 1 from tcg_cards where id = 'tcggo-48211' and image_path = 'https://a-mano/staff.png')
  and exists (select 1 from tcg_card_prices where card_id = 'tcggo-48211' and cm_low_es = 7);
insert into resultado (caso, ok) select '  …la lápida se quita y la versión, sin nadie que la use, también',
  not exists (select 1 from tcg_correcciones where id = 'tcggo-48211' and columna = '__borrada')
  and not exists (select 1 from tcg_card_versions where card_id = 'svp-181' and etiqueta = 'Staff');
insert into resultado (caso, ok) select '  …la copia vuelve a la Staff como estaba («normal»)',
  (select count(*) from user_collection where card_id = 'tcggo-48211' and variante = 'normal') = 1
  and (select count(*) from user_collection where card_id = 'svp-181' and market = 'WEST') = 1;
insert into resultado (caso, ok) select '  …y los dos deseos, el álbum, el aviso y la vitrina, también',
  (select count(*) from user_wants where card_id = 'tcggo-48211') = 2
  and (select cartas from user_albums where user_id = '00000000-0000-0000-0000-0000000000c1' and cartas @> '[{"pos": 4}]') = '[{"id": "svp-181"}, {"id": "tcggo-48211", "pos": 4}]'::jsonb
  and exists (select 1 from user_price_alerts where card_id = 'tcggo-48211') and exists (select 1 from user_showcase where card_id = 'tcggo-48211');
do $$ begin
  begin perform public.catalogo_repetida_deshacer((select (v->>'hecha')::bigint from r1));
    insert into resultado (caso, ok) values ('lo deshecho no se deshace dos veces', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('lo deshecho no se deshace dos veces', true); end;
end $$;

-- Otra vez, y ahora alguien apunta la Staff antes de deshacer: la versión
-- se queda.
create temp table r2 as select public.catalogo_repetida_resolver('tcggo-48211', 'svp-181', 'WEST', 'version', 'Staff') as v;
reset role;
insert into user_collection (card_id, market, user_id, cantidad, variante) values ('svp-181', 'WEST', '00000000-0000-0000-0000-0000000000c4', 1, 'staff');
set role authenticated;
select public.catalogo_repetida_deshacer((select (v->>'hecha')::bigint from r2));
insert into resultado (caso, ok) select 'si alguien apuntó la versión entretanto, deshacer la deja (y su copia sigue en la principal)',
  exists (select 1 from tcg_card_versions where card_id = 'svp-181' and etiqueta = 'Staff')
  and exists (select 1 from user_collection where user_id = '00000000-0000-0000-0000-0000000000c4' and card_id = 'svp-181' and variante = 'staff');
-- Con la versión ya puesta, convertir otra vez no crea otra.
create temp table r3 as select public.catalogo_repetida_resolver('tcggo-48211', 'svp-181', 'WEST', 'version', 'Staff') as v;
insert into resultado (caso, ok) select 'si la principal ya tiene «Staff», se usa esa y no se crea otra',
  (select count(*) from tcg_card_versions where card_id = 'svp-181' and etiqueta = 'Staff') = 1 and (select (v->>'creada')::boolean from r3) = false;

-- ── La repetida es la de TCGdex: dos lápidas ──
create temp table r4 as select public.catalogo_repetida_resolver('svp-060', 'tcggo-47701', 'WEST', 'misma') as v;
insert into resultado (caso, ok) select '«la misma carta»: la copia pasa sin cambiar de versión',
  exists (select 1 from user_collection where card_id = 'tcggo-47701' and variante = 'normal' and idioma = 'en') and not exists (select 1 from tcg_cards where id = 'svp-060')
  and not exists (select 1 from tcg_card_versions where card_id = 'tcggo-47701');
insert into resultado (caso, ok) select '  …y deja lápida a su id y al «tcggo-» que la volvería a crear',
  (select v->'lapidas' from r4) = '["svp-060", "tcggo-47700"]'::jsonb
  and (select count(*) from tcg_correcciones where id in ('svp-060', 'tcggo-47700') and columna = '__borrada') = 2;
select public.catalogo_repetida_deshacer((select (v->>'hecha')::bigint from r4));
insert into resultado (caso, ok) select '  …y deshacerla quita las dos',
  exists (select 1 from tcg_cards where id = 'svp-060') and (select count(*) from tcg_correcciones where id in ('svp-060', 'tcggo-47700')) = 0
  and exists (select 1 from user_collection where card_id = 'svp-060');

-- ── «Son distintas» ──
select public.catalogo_repetidas_distintas('WEST', 'svp', '200', 'snorlax', array['svp-200', 'tcggo-200']);
insert into resultado (caso, ok) select '«son distintas»: el grupo deja de salir y sale en su lista',
  not exists (select 1 from jsonb_array_elements(v->'grupos') g where g->>'numero' = '200') and jsonb_array_length(v->'distintas') = 1
  from (select public.catalogo_posibles_repetidas('WEST') v) x;
reset role;
insert into tcg_cards (id, market, set_id, local_id, name, origen) values ('tcggo-201', 'WEST', 'svp', '200', 'Snorlax', 'tcggo');
set role authenticated;
insert into resultado (caso, ok) select '  …pero si llega una tercera, vuelve a salir',
  exists (select 1 from jsonb_array_elements(v->'grupos') g where g->>'numero' = '200' and jsonb_array_length(g->'cartas') = 3)
  from (select public.catalogo_posibles_repetidas('WEST') v) x;
select public.catalogo_repetidas_distintas('WEST', 'svp', '200', 'snorlax', null, true);
insert into resultado (caso, ok) select '  …y quitarlo lo deja como estaba', jsonb_array_length(v->'distintas') = 0
  from (select public.catalogo_posibles_repetidas('WEST') v) x;

reset role;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado order by n;
