-- Lo que tiene que haber quedado tras la 948 (cada renglón, «ok …» o «MAL …»).
\set ON_ERROR_STOP on
with v as (select card_id, etiqueta, cm_id_product, clase, market from public.tcg_card_versions where origen = 'edicion' and market = 'JP')
select case when cond then 'ok ' else 'MAL ' end || que from (values
  ((select count(*) from v where card_id = 'tcggo-50003') = 2, 'el Scyther de PCG4 (casado por el día) tiene sus dos ediciones'),
  ((select cm_id_product from v where card_id = 'tcggo-50003' and etiqueta = 'Unlimited') = 700003, '  …la Unlimited con el producto de la carta'),
  ((select cm_id_product from v where card_id = 'tcggo-50003' and etiqueta = '1st Edition') is null, '  …y la 1.ª edición sin él'),
  ((select bool_and(clase = 'impresion') from v where card_id = 'tcggo-50003'), '  …las dos son impresiones'),
  ((select count(*) from v where card_id = 'tcggo-50004') = 2, 'un número «4/106» casa con el «004» de TCGdex'),
  ((select count(*) from v where card_id = 'tcggo-50001') = 2, 'un número «1» casa con el «001»'),
  ((select count(*) from v where card_id = 'tcggo-60001') = 0, 'la baraja del mismo día no se toca (desempata la cuenta)'),
  ((select count(*) from v where card_id = 'tcggo-61003') = 2, 'el de E3 casa por el código aunque el día no coincida'),
  ((select count(*) from v where card_id = 'tcggo-62001') = 0, 'PCG3 con 10 cartas de 85: se salta'),
  ((select count(*) from v where card_id = 'tcggo-63001') = 0, 'PCG2 con dos sets ese día y ninguno con su cuenta: se salta'),
  ((select count(*) from public.tcg_card_versions where card_id = 'PCG4-003') = 0, 'el set escondido de TCGdex no se toca'),
  ((select count(*) from public.tcg_card_versions where market = 'WEST' and origen = 'edicion' and card_id = 'ex-uf-3') = 0, 'el occidental del mismo día tampoco'),
  ((select count(*) from public.tcg_card_versions where card_id = 'tcggo-50003' and etiqueta = 'Standard') = 1, 'la «Standard» de la pasada de precios se queda'),
  ((select string_agg(coalesce(variante, '-'), ',' order by variante) from public.user_collection where card_id = 'tcggo-50003') = 'primera,unlimited', 'las copias: la 1.ª edición se queda y la normal pasa a Unlimited'),
  ((select variante from public.user_collection where card_id = 'tcggo-50004') = 'unlimited', '  …otra normal también'),
  ((select count(distinct card_id) from v where card_id like 'tcggo-5%') = 106, 'PCG4 entero: las 106 cartas con sus dos ediciones'),
  ((select variante from public.user_collection where card_id = 'tcggo-61003') = 'unlimited', '  …y una holo'),
  ((select variante from public.user_collection where card_id = 'tcggo-60001') = 'normal', '  …la de la baraja se queda como estaba'),
  ((select variante from public.user_collection where card_id = 'ex-uf-3') = 'normal', '  …y la occidental también'),
  ((select count(*) from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') x where e.clave = 'ediciones_jp_948') = 16, 'el informe tiene un renglón por cada set de TCGdex'),
  ((select x->>'por' from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') x where e.clave = 'ediciones_jp_948' and x->>'tcgdex' = 'PCG4') = 'día de salida y cuenta', '  …y dice cómo casó PCG4'),
  ((select x->>'por' from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') x where e.clave = 'ediciones_jp_948' and x->>'tcgdex' = 'PCG2') = 'empate el mismo día', '  …y por qué se saltó PCG2'),
  ((select x->>'por' from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') x where e.clave = 'ediciones_jp_948' and x->>'tcgdex' = 'PCG3') like '%saltado', '  …y PCG3')
) as t(cond, que);
