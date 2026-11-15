-- Tanda 1362 — Delta Reign sin su cuenta de cartas.
--
-- PINGU: «¿por qué Delta Reign está diferente?». En Lanzamientos salía un «3»
-- suelto en vez del anillo, y en Mi colección «Sin numeración» y sin barra.
-- El set lo creó el catálogo de TCGGO ESCONDIDO antes de salir (756), cuando
-- TCGGO lo daba con cero cartas, así que nació con `card_count_total` y
-- `card_count_official` vacíos. Cuando llegaron sus 141 cartas nadie volvió a
-- apuntarle cuántas trae, y sin cuenta la web no tiene sobre qué calcular el
-- tanto por ciento.
--
-- Esto rellena, UNA vez, la cuenta de los sets de TCGGO que la tienen vacía,
-- con las cartas que ya tienen (la misma que enseña su álbum). Desde la 1362,
-- el catálogo lo hace solo al escribir las cartas de un set sin cuenta.
--
-- Solo lo vacío: nunca pisa una cuenta que ya esté puesta (de TCGdex, de
-- Scrydex o corregida a mano). `card_count_official` (las numeradas impresas)
-- no se inventa: se queda vacía hasta que una fuente la dé.
--
-- Re-ejecutable: la segunda vez no encuentra nada. Una sola sentencia que
-- escribe (tanda 631) y un SELECT al final con lo que ha quedado.

update public.tcg_sets s
   set card_count_total = c.n
  from (
    select set_id, market, count(*)::int as n
      from public.tcg_cards
     group by set_id, market
  ) c
 where c.set_id = s.id
   and c.market = s.market
   and c.n > 0
   and s.tcggo_id is not null
   and s.card_count_total is null
   and s.card_count_official is null;

-- Lo que ha quedado: cada set de TCGGO con su cuenta (los de arriba, ya con
-- número; si sale alguno con la cuenta vacía, es que aún no tiene cartas).
select s.market, s.id, s.name, s.release_date, s.card_count_total, s.card_count_official
  from public.tcg_sets s
 where s.tcggo_id is not null
   and s.release_date >= current_date - 120
 order by s.release_date desc;
