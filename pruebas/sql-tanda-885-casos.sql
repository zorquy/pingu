\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, service_role;

-- Un usuario normal no corrige.
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    perform public.catalogo_corregir('tcg_cards', 'ex7-15', 'WEST', '{"name": "Pisada"}'::jsonb);
    insert into resultado (caso, ok) values ('alguien que no es admin no corrige', false);
  exception when insufficient_privilege then
    insert into resultado (caso, ok) values ('alguien que no es admin no corrige', true);
  end;
end $$;

-- El admin corrige: el nombre inglés, la foto (dirección entera), las
-- impresiones y el id de Cardmarket, de una vez.
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select public.catalogo_corregir('tcg_cards', 'ex7-15', 'WEST',
  '{"name_en": "Dark Dragonite (corregida)", "image_path": "https://ejemplo.supabase.co/storage/v1/object/public/guide-images/a/foto.png", "variants": {"holo": true}, "cm_id_product_propio": 123456}'::jsonb);
insert into resultado (caso, ok) select 'el admin corrige cuatro columnas de una carta',
  name_en = 'Dark Dragonite (corregida)' and image_path like 'https://%' and variants = '{"holo": true}'::jsonb and cm_id_product_propio = 123456
  from tcg_cards where id = 'ex7-15';
insert into resultado (caso, ok) select '  …y quedan apuntadas con lo que había antes',
  count(*) = 4 and bool_and(case columna when 'name_en' then anterior = '"Dark Dragonite"'::jsonb when 'image_path' then anterior = '"ex/ex7/15"'::jsonb when 'cm_id_product_propio' then anterior = 'null'::jsonb else true end)
  from tcg_correcciones where id = 'ex7-15';

-- Una columna que no está en la lista, no.
do $$ begin
  begin
    perform public.catalogo_corregir('tcg_cards', 'ex7-15', 'WEST', '{"tcggo_id": 1}'::jsonb);
    insert into resultado (caso, ok) values ('tcggo_id no se corrige desde aquí', false);
  exception when invalid_parameter_value then
    insert into resultado (caso, ok) values ('tcggo_id no se corrige desde aquí', true);
  end;
end $$;

-- LO AUTOMÁTICO NO PISA: una pasada (clave de servicio, como
-- tcggo_guardar_cartas o cartas-detalle) reescribe la fila entera.
reset role;
set role service_role;
update tcg_cards set name_en = 'Dark Dragonite', image_path = 'ex/ex7/15', variants = '{"holo": true, "normal": true}', cm_id_product_propio = 999, hp = 130 where id = 'ex7-15';
insert into resultado (caso, ok) select 'una pasada automática que reescribe la fila NO pisa lo corregido',
  name_en = 'Dark Dragonite (corregida)' and image_path like 'https://%' and variants = '{"holo": true}'::jsonb and cm_id_product_propio = 123456
  from tcg_cards where id = 'ex7-15';
insert into resultado (caso, ok) select '  …pero sí escribe lo que no está corregido (hp)', hp = 130 from tcg_cards where id = 'ex7-15';
-- Y un upsert como el de PostgREST (insert … on conflict do update).
insert into tcg_cards (id, market, set_id, local_id, name, name_en, image_path) values ('ex7-15', 'WEST', 'ex7', '15', 'Dark Dragonite', 'Dark Dragonite', 'ex/ex7/15')
  on conflict (id, market) do update set name_en = excluded.name_en, image_path = excluded.image_path;
insert into resultado (caso, ok) select '  …ni un upsert', name_en = 'Dark Dragonite (corregida)' and image_path like 'https://%' from tcg_cards where id = 'ex7-15';

-- El set: el calco rotula con lo de TCGGO; el admin corrige el nombre y el
-- logo, y el rotulado no lo pisa.
reset role;
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select public.catalogo_corregir('tcg_sets', 's12a', 'JP', '{"name_en": "VSTAR Universe (High Class)", "logo_tcggo": "https://ejemplo/logo-mano.png", "logo_scrydex": "https://ejemplo/logo-mano.png"}'::jsonb);
reset role;
set role service_role;
update tcg_sets set name_en = 'VSTAR Universe', logo_tcggo = 'https://tcggo/logo2.png', card_count_total = 263 where id = 's12a' and market = 'JP';
insert into resultado (caso, ok) select 'el set corregido aguanta el rotulado del calco (nombre y logo), y lo demás entra',
  name_en = 'VSTAR Universe (High Class)' and logo_tcggo = 'https://ejemplo/logo-mano.png' and card_count_total = 263 from tcg_sets where id = 's12a';

-- Quitar una corrección devuelve lo de antes, y a partir de ahí lo
-- automático vuelve a mandar.
reset role;
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select public.catalogo_descorregir('tcg_cards', 'ex7-15', 'WEST', 'image_path');
insert into resultado (caso, ok) select 'quitar la corrección de la foto devuelve la de TCGdex', image_path = 'ex/ex7/15' from tcg_cards where id = 'ex7-15';
reset role;
set role service_role;
update tcg_cards set image_path = 'ex/ex7/15-nueva' where id = 'ex7-15';
insert into resultado (caso, ok) select '  …y lo automático vuelve a escribirla', image_path = 'ex/ex7/15-nueva' from tcg_cards where id = 'ex7-15';
insert into resultado (caso, ok) select '  …mientras el nombre sigue corregido', name_en = 'Dark Dragonite (corregida)' from tcg_cards where id = 'ex7-15';
do $$ begin
  begin
    perform public.catalogo_descorregir('tcg_cards', 'ex7-15', 'WEST', 'image_path');
    insert into resultado (caso, ok) values ('quitar una corrección que no existe avisa', false);
  exception when others then
    insert into resultado (caso, ok) values ('quitar una corrección que no existe avisa', true);
  end;
end $$;

-- Crear a mano: un set y una carta nueva (el Silver Deck Kit desde /admin).
reset role;
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select public.catalogo_corregir('tcg_sets', 'pcg-silver_ja', 'JP', '{"name": "ロケット団ハーフデッキW -silver-", "name_en": "Silver Deck Kit", "release_date": "2004-10-15", "card_count_total": 20}'::jsonb, true);
select public.catalogo_corregir('tcg_cards', 'pcg-silver_ja-014', 'JP', '{"set_id": "pcg-silver_ja", "local_id": "014", "name": "わるいカイリュー", "name_en": "Dark Dragonite", "hp": 120, "types": ["Darkness"], "dex_ids": [149], "variants": {"holo": true}}'::jsonb, true);
insert into resultado (caso, ok) select 'se crea un set a mano, con origen «mano»', origen = 'mano' and name_en = 'Silver Deck Kit' and release_date = '2004-10-15' from tcg_sets where id = 'pcg-silver_ja';
insert into resultado (caso, ok) select 'se crea una carta a mano con sus tipos, Pokédex e impresiones', origen = 'mano' and hp = 120 and types = array['Darkness'] and dex_ids = array[149] and variants = '{"holo": true}'::jsonb from tcg_cards where id = 'pcg-silver_ja-014';
insert into resultado (caso, ok) select '  …sin apuntar correcciones (nada automático la va a pisar)', count(*) = 0 from tcg_correcciones where id = 'pcg-silver_ja-014';
do $$ begin
  begin
    perform public.catalogo_corregir('tcg_cards', 'pcg-silver_ja-999', 'JP', '{"name": "sin set"}'::jsonb, true);
    insert into resultado (caso, ok) values ('una carta nueva sin set ni número no entra', false);
  exception when invalid_parameter_value then
    insert into resultado (caso, ok) values ('una carta nueva sin set ni número no entra', true);
  end;
end $$;
do $$ begin
  begin
    perform public.catalogo_corregir('tcg_cards', 'no-existe', 'JP', '{"name": "x"}'::jsonb);
    insert into resultado (caso, ok) values ('corregir una carta que no existe, sin p_crear, avisa', false);
  exception when no_data_found then
    insert into resultado (caso, ok) values ('corregir una carta que no existe, sin p_crear, avisa', true);
  end;
end $$;

-- Borrar: solo las de mano y sin dueño.
do $$ begin
  begin
    perform public.catalogo_borrar_carta('ex7-15', 'WEST');
    insert into resultado (caso, ok) values ('una carta de una API no se borra desde aquí', false);
  exception when insufficient_privilege then
    insert into resultado (caso, ok) values ('una carta de una API no se borra desde aquí', true);
  end;
end $$;
insert into user_collection (card_id, user_id) values ('pcg-silver_ja-014', '00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin
    perform public.catalogo_borrar_carta('pcg-silver_ja-014', 'JP');
    insert into resultado (caso, ok) values ('una carta a mano que alguien tiene no se borra', false);
  exception when foreign_key_violation then
    insert into resultado (caso, ok) values ('una carta a mano que alguien tiene no se borra', true);
  end;
end $$;
delete from user_collection where card_id = 'pcg-silver_ja-014';
insert into resultado (caso, ok) select 'sin dueño, se borra', public.catalogo_borrar_carta('pcg-silver_ja-014', 'JP');
insert into resultado (caso, ok) select '  …y ya no está', count(*) = 0 from tcg_cards where id = 'pcg-silver_ja-014';

-- Lo que lee el admin: sus correcciones; un usuario normal, nada (RLS).
insert into resultado (caso, ok) select 'el admin ve las correcciones', count(*) >= 1 from tcg_correcciones;
set prueba.uid = '00000000-0000-0000-0000-00000000000b';
insert into resultado (caso, ok) select 'un usuario normal no las ve', count(*) = 0 from tcg_correcciones;
reset role;
select case when ok then 'ok  ' else 'MAL ' end || caso from resultado order by n;
