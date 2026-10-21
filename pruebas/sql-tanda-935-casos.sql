\set ON_ERROR_STOP on
create table public.resultado935 (n serial, caso text, ok boolean);
grant all on public.resultado935, public.resultado935_n_seq to authenticated, service_role;
create function pg_temp.etqs(p text) returns text language sql as $$
  select string_agg(etiqueta || ':' || clase, ', ' order by tcggo_id desc) from public.tcg_card_versions where card_id = p and origen = 'edicion' $$;
create function pg_temp.var(p_user text, p_card text) returns text language sql as $$
  select string_agg(variante, ',' order by variante) from public.user_collection where user_id = ('00000000-0000-0000-0000-0000000000' || p_user)::uuid and card_id = p_card $$;

insert into resultado935 (caso, ok) select 'el Charizard lleva sus cuatro ediciones, en orden y con su clase — ' || coalesce(pg_temp.etqs('base1-4'), '(nada)'),
  pg_temp.etqs('base1-4') = '1st Edition:impresion, Shadowless:impresion, Unlimited:impresion, Unlimited (1999-2000):adicional';
insert into resultado935 (caso, ok) select '  …con su producto de Cardmarket (la 1.ª edición y la Shadowless comparten el suyo)',
  (select string_agg(coalesce(cm_id_product::text, '-'), ',' order by tcggo_id desc) from tcg_card_versions where card_id = 'base1-4' and origen = 'edicion') = '660224,660224,273699,-';
insert into resultado935 (caso, ok) select 'la Shadowless repetida de TCGGO ya no existe, y deja lápida',
  not exists (select 1 from tcg_cards where id = 'tcggo-4001') and exists (select 1 from tcg_correcciones where id = 'tcggo-4001' and columna = '__borrada');
insert into resultado935 (caso, ok) select '  …ni sus precios ni su histórico',
  not exists (select 1 from tcg_card_prices where card_id = 'tcggo-4001') and not exists (select 1 from tcg_card_history where card_id = 'tcggo-4001');
insert into resultado935 (caso, ok) select 'sus copias pasan al Charizard: la «holo» a Shadowless y la «1.ª edición» se queda',
  pg_temp.var('c1', 'base1-4') = 'shadowless,unlimited' and pg_temp.var('c2', 'base1-4') = 'primera';
insert into resultado935 (caso, ok) select '  …y la «holo» que ya estaba en el Charizard pasa a Unlimited (lo recomendado)',
  (select variante from user_collection where card_id = 'base1-4' and user_id = '00000000-0000-0000-0000-0000000000c1' and cantidad = 1 order by id limit 1) = 'unlimited';
insert into resultado935 (caso, ok) select 'la foto de TCGGO va a la Shadowless y a la 1.ª edición (mismo producto), no a la Unlimited',
  (select string_agg(etiqueta || '=' || coalesce(imagen, '-'), ' | ' order by tcggo_id desc) from tcg_card_versions where card_id = 'base1-4' and origen = 'edicion')
    = '1st Edition=https://tcggo/charizard-shadowless.png | Shadowless=https://tcggo/charizard-shadowless.png | Unlimited=- | Unlimited (1999-2000)=-';
insert into resultado935 (caso, ok) select 'la «1st Edition» de TCGGO, con su precio, cuelga ahora del Charizard',
  (select card_id from tcg_card_versions where tcggo_id = 50001) = 'base1-4';
insert into resultado935 (caso, ok) select 'el deseo repetido se queda el de la buena, y el otro pasa',
  (select count(*) from user_wants where card_id = 'base1-4') = 2 and not exists (select 1 from user_wants where card_id = 'tcggo-4001');
insert into resultado935 (caso, ok) select '  …y el álbum la apunta en su sitio',
  (select cartas from user_albums where user_id = '00000000-0000-0000-0000-0000000000c3') = '[{"id": "base1-4", "pos": 1}, {"id": "si1-1"}]'::jsonb;
insert into resultado935 (caso, ok) select 'la repetida con un producto que no es de ninguna edición NO se toca (se cuenta)',
  exists (select 1 from tcg_cards where id = 'tcggo-4002');
insert into resultado935 (caso, ok) select 'una de TCGGO de otro número no se toca',
  exists (select 1 from tcg_cards where id = 'tcggo-5800');
insert into resultado935 (caso, ok) select 'Chansey: la Shadowless se funde, sus 3 copias «normal» son Shadowless y la vitrina pasa',
  not exists (select 1 from tcg_cards where id = 'tcggo-3001')
  and (select sum(cantidad) from user_collection where card_id = 'base1-3' and variante = 'shadowless') = 3
  and (select card_id from user_showcase where user_id = '00000000-0000-0000-0000-0000000000c3') = 'base1-3';
insert into resultado935 (caso, ok) select '  …y ya no tiene una «Normal»: la suya es Unlimited, la 1.ª edición se queda',
  pg_temp.var('c1', 'base1-3') = 'unlimited' and pg_temp.var('c2', 'base1-3') = 'primera,shadowless';
insert into resultado935 (caso, ok) select 'Gym Challenge: la Unlimited no tenía producto y se queda con el de la de TCGGO',
  (select cm_id_product from tcg_card_versions where card_id = 'gym2-1' and origen = 'edicion' and etiqueta = 'Unlimited') = 555555
  and not exists (select 1 from tcg_cards where id = 'tcggo-6001') and pg_temp.var('c1', 'gym2-1') = 'unlimited';
insert into resultado935 (caso, ok) select '  …y su foto',
  (select imagen from tcg_card_versions where card_id = 'gym2-1' and origen = 'edicion' and etiqueta = 'Unlimited') = 'https://tcggo/arcanine.png';
insert into resultado935 (caso, ok) select 'Southern Islands: una sola impresión, sin ediciones ni cambios',
  not exists (select 1 from tcg_card_versions where card_id = 'si1-1') and pg_temp.var('c1', 'si1-1') = 'normal';
insert into tcg_cards (id, market, set_id, local_id, name, origen) values ('tcggo-4001', 'WEST', 'base1', '4', 'Charizard', 'tcggo') on conflict do nothing;
insert into resultado935 (caso, ok) select 'el catálogo de TCGGO no vuelve a crear la repetida (la lápida)',
  not exists (select 1 from tcg_cards where id = 'tcggo-4001');
insert into resultado935 (caso, ok) select 'el id de versión de la base es el de la web: ' || string_agg(x || '→' || public.catalogo_id_de_version(x), ' '),
  string_agg(public.catalogo_id_de_version(x), ',') = 'primera,reverse,unlimited-1999-2000,poke-ball,normal,holo,shadowless,reverse'
  from unnest(array['1st Edition', 'Reverse Holo', 'Unlimited (1999-2000)', 'Poké Ball', 'Standard', 'Holofoil', 'Shadowless', '']) as x;

-- La foto de una versión, como admin.
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin perform public.catalogo_version_foto('base1-4', 'WEST', 'shadowless', 'https://x/s.png');
    insert into resultado935 (caso, ok) values ('quien no es admin no pone fotos', false);
  exception when insufficient_privilege then insert into resultado935 (caso, ok) values ('quien no es admin no pone fotos', true); end;
end $$;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select public.catalogo_version_foto('base1-4', 'WEST', 'unlimited', 'https://x/unlimited.png');
insert into resultado935 (caso, ok) select 'el admin pone la foto de la Unlimited en SU fila de edición',
  (select imagen from tcg_card_versions where card_id = 'base1-4' and origen = 'edicion' and etiqueta = 'Unlimited') = 'https://x/unlimited.png';
select public.catalogo_version_foto('base1-4', 'WEST', 'primera', 'https://x/primera.png');
insert into resultado935 (caso, ok) select '  …y la de la 1.ª edición, en la de edición (no en la de TCGGO)',
  (select imagen from tcg_card_versions where card_id = 'base1-4' and origen = 'edicion' and etiqueta = '1st Edition') = 'https://x/primera.png'
  and (select imagen from tcg_card_versions where tcggo_id = 50001) is null;
select public.catalogo_version_foto('sv10.5b-060', 'WEST', 'reverse', 'https://x/rev.png');
insert into resultado935 (caso, ok) select 'una versión de siempre sin fila (la Reverse) gana una fila «foto» con su foto',
  exists (select 1 from tcg_card_versions where card_id = 'sv10.5b-060' and origen = 'foto' and etiqueta = 'Reverse Holo' and imagen = 'https://x/rev.png');
select public.catalogo_version_foto('sv10.5b-060', 'WEST', 'reverse', '');
insert into resultado935 (caso, ok) select '  …y quitarla quita la fila',
  not exists (select 1 from tcg_card_versions where card_id = 'sv10.5b-060' and origen = 'foto');
do $$ begin
  begin perform public.catalogo_version_mano('base1-4', 'WEST', '{"etiqueta": "1st Edition"}'::jsonb);
    insert into resultado935 (caso, ok) values ('la 934 sigue sin dejar crear a mano una «1st Edition»', false);
  exception when sqlstate '22023' then insert into resultado935 (caso, ok) values ('la 934 sigue sin dejar crear a mano una «1st Edition»', true); end;
end $$;
reset role;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado935 order by n;
