-- Tanda 1047: los casos de juntar repetidas con deseos con versión (ver
-- sql-tanda-1047-repetidas.sql).
\pset tuples_only on
\pset format unaligned

-- El Arcanine Holo del Prize Pack (tcggo-9013) es la holo de tcggo-9012.
-- d1 lo quiere en cualquier versión; d2 quiere las dos cartas; d3 ya quiere
-- la 9012 en Holo y también la 9013.
insert into public.user_wants (user_id, card_id, idioma, variante) values
  ('00000000-0000-0000-0000-0000000000d1', 'tcggo-9013', 'es', null),
  ('00000000-0000-0000-0000-0000000000d2', 'tcggo-9012', null, null),
  ('00000000-0000-0000-0000-0000000000d2', 'tcggo-9013', null, null),
  ('00000000-0000-0000-0000-0000000000d3', 'tcggo-9012', null, 'holo'),
  ('00000000-0000-0000-0000-0000000000d3', 'tcggo-9013', null, null);
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select (public.catalogo_repetida_resolver('tcggo-9013', 'tcggo-9012', 'WEST', 'version', 'Holo', 'sello', null)->>'hecha') as hecha \gset
reset prueba.uid;

select case when string_agg(user_id::text || ':' || coalesce(idioma, '*') || ':' || coalesce(variante, '*'), ' ' order by user_id, variante nulls first) =
  '00000000-0000-0000-0000-0000000000d1:es:holo 00000000-0000-0000-0000-0000000000d2:*:* 00000000-0000-0000-0000-0000000000d2:*:holo 00000000-0000-0000-0000-0000000000d3:*:holo'
  then 'ok los deseos de la repetida pasan como «Holo»; el de «cualquiera» de la principal se queda; el repetido se va'
  else 'MAL deseos tras juntar: ' || string_agg(user_id::text || ':' || coalesce(idioma, '*') || ':' || coalesce(variante, '*'), ' ' order by user_id, variante nulls first) end
  from public.user_wants where card_id in ('tcggo-9012', 'tcggo-9013') and user_id::text like '%d_';

set prueba.uid = '00000000-0000-0000-0000-00000000000a';
select public.catalogo_repetida_deshacer(:hecha) is not null;
reset prueba.uid;
select case when string_agg(card_id || ':' || user_id::text || ':' || coalesce(variante, '*'), ' ' order by card_id, user_id) =
  'tcggo-9012:00000000-0000-0000-0000-0000000000d2:* tcggo-9012:00000000-0000-0000-0000-0000000000d3:holo tcggo-9013:00000000-0000-0000-0000-0000000000d1:* tcggo-9013:00000000-0000-0000-0000-0000000000d2:* tcggo-9013:00000000-0000-0000-0000-0000000000d3:*'
  then 'ok deshacer los devuelve como estaban (sin versión, y el borrado vuelve)'
  else 'MAL tras deshacer: ' || string_agg(card_id || ':' || user_id::text || ':' || coalesce(variante, '*'), ' ' order by card_id, user_id) end
  from public.user_wants where card_id in ('tcggo-9012', 'tcggo-9013') and user_id::text like '%d_';

