-- ─────────────────────────────────────────────────────────────────────
-- Tanda 652 — las cartas de la Classic Collection del 30 aniversario,
-- que estaban DOS veces.
--
-- El 30 aniversario de TCGGO (una sola expansión) lleva dentro la Classic
-- Collection, que TCGdex tiene como set aparte («30th-c», numerado
-- 001–030). TCGGO numera esas cartas como la carta original («Charizard
-- 4/102», «Zacian V SSH138»), así que el catálogo (640) no casó ni una por
-- número y las CREÓ por segunda vez en el set «30th», con origen 'tcggo'.
-- Las nuestras se quedaron sin foto ni precio, y en la pantalla caían al
-- respaldo de Limitless por código + número: con «30C» y «001», el
-- Exeggcute del Celebration rotulado «Charizard». PINGU lo vio el
-- 2026-10-05 en el móvil.
--
-- Esto FUNDE cada duplicado con la nuestra: por el nombre inglés, y solo
-- cuando hay exactamente UNA con ese nombre en cada lado (lo mismo que
-- hace el catálogo desde la 652 al casar por nombre). La nuestra conserva
-- su id (es la llave de las colecciones y de las URLs) y gana la foto, el
-- id de Cardmarket, el de TCGplayer y el de TCGGO del duplicado; lo que
-- apuntaba al duplicado (colecciones, deseos, álbumes soñados, precios e
-- histórico) pasa a la nuestra; y el duplicado se borra. Lo ambiguo se
-- queda como está y sale en la vista previa.
--
-- 1) Ejecuta PRIMERO la vista previa y mira que las parejas tengan
--    sentido. 2) Luego el bloque `do`. Es re-ejecutable: sin duplicados
--    no hace nada.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Vista previa: qué se fundiría con qué ──
select t.id as duplicado, t.name as nombre, c.id as nuestra, c.local_id as numero_nuestro,
       (select count(*) from public.user_collection u where u.card_id = t.id) as lineas_de_coleccion_que_se_mueven
  from public.tcg_cards t
  join public.tcg_cards c
    on c.market = 'WEST' and c.set_id = '30th-c' and coalesce(c.origen, '') <> 'tcggo'
   and lower(coalesce(c.name_en, c.name)) = lower(t.name)
 where t.market = 'WEST' and t.set_id = '30th' and t.origen = 'tcggo'
   and (select count(*) from public.tcg_cards c2
         where c2.market = 'WEST' and c2.set_id = '30th-c' and coalesce(c2.origen, '') <> 'tcggo'
           and lower(coalesce(c2.name_en, c2.name)) = lower(t.name)) = 1
   and (select count(*) from public.tcg_cards t2
         where t2.market = 'WEST' and t2.set_id = '30th' and t2.origen = 'tcggo' and lower(t2.name) = lower(t.name)) = 1
 order by c.local_id;

-- Y lo que NO se puede fundir solo (varias con el mismo nombre en un lado):
select t.id as duplicado, t.name as nombre
  from public.tcg_cards t
 where t.market = 'WEST' and t.set_id = '30th' and t.origen = 'tcggo'
   and not exists (
     select 1 from public.tcg_cards c
      where c.market = 'WEST' and c.set_id = '30th-c' and coalesce(c.origen, '') <> 'tcggo'
        and lower(coalesce(c.name_en, c.name)) = lower(t.name))
 order by t.name;

-- ── 2. La fusión ──
do $$
declare
  r record;
  dup record;
begin
  for r in
    select t.id as id_tcggo, c.id as id_nuestra,
           t.image_tcggo, t.cm_id_product_propio, t.tp_id_product_propio, t.tcggo_id, t.rarity_en, t.hp, t.illustrator
      from public.tcg_cards t
      join public.tcg_cards c
        on c.market = 'WEST' and c.set_id = '30th-c' and coalesce(c.origen, '') <> 'tcggo'
       and lower(coalesce(c.name_en, c.name)) = lower(t.name)
     where t.market = 'WEST' and t.set_id = '30th' and t.origen = 'tcggo'
       and (select count(*) from public.tcg_cards c2
             where c2.market = 'WEST' and c2.set_id = '30th-c' and coalesce(c2.origen, '') <> 'tcggo'
               and lower(coalesce(c2.name_en, c2.name)) = lower(t.name)) = 1
       and (select count(*) from public.tcg_cards t2
             where t2.market = 'WEST' and t2.set_id = '30th' and t2.origen = 'tcggo' and lower(t2.name) = lower(t.name)) = 1
  loop
    -- La nuestra gana lo que le faltaba. `coalesce` y no pisar: lo que ya
    -- tuviera (una foto de Scrydex, un par a mano) se queda.
    update public.tcg_cards
       set image_tcggo = coalesce(image_tcggo, r.image_tcggo),
           cm_id_product_propio = coalesce(cm_id_product_propio, r.cm_id_product_propio),
           cm_por = case when cm_id_product_propio is null and r.cm_id_product_propio is not null then 'tcggo' else cm_por end,
           cm_emparejado_at = case when cm_id_product_propio is null and r.cm_id_product_propio is not null then now() else cm_emparejado_at end,
           tp_id_product_propio = coalesce(tp_id_product_propio, r.tp_id_product_propio),
           tcggo_id = coalesce(tcggo_id, r.tcggo_id),
           rarity_en = coalesce(rarity_en, r.rarity_en),
           hp = coalesce(hp, r.hp),
           illustrator = coalesce(illustrator, r.illustrator)
     where id = r.id_nuestra and market = 'WEST';

    -- Las líneas de colección del duplicado pasan a la nuestra. Si alguien
    -- tenía las DOS con el mismo idioma, estado y versión, se suman las
    -- copias (tope 999) y la del duplicado se borra.
    for dup in
      select d.id as id_dup, d.cantidad, e.id as id_destino
        from public.user_collection d
        join public.user_collection e
          on e.user_id = d.user_id and e.card_id = r.id_nuestra and e.market = d.market
         and e.idioma = d.idioma and e.estado = d.estado and e.variante = d.variante
       where d.card_id = r.id_tcggo and d.market = 'WEST'
    loop
      update public.user_collection set cantidad = least(999, cantidad + dup.cantidad) where id = dup.id_destino;
      delete from public.user_collection where id = dup.id_dup;
    end loop;
    update public.user_collection set card_id = r.id_nuestra where card_id = r.id_tcggo and market = 'WEST';

    -- Los deseos y los álbumes soñados (sus cartas van en un JSON de ids).
    update public.user_wants set card_id = r.id_nuestra where card_id = r.id_tcggo;
    update public.user_albums
       set cartas = replace(replace(cartas::text, '"id": "' || r.id_tcggo || '"', '"id": "' || r.id_nuestra || '"'),
                            '"id":"' || r.id_tcggo || '"', '"id":"' || r.id_nuestra || '"')::jsonb
     where cartas::text like '%' || r.id_tcggo || '%';

    -- Los precios y el histórico: los del duplicado son los de TCGGO (los
    -- frescos), así que mandan sobre los que tuviera la nuestra.
    delete from public.tcg_card_prices where card_id = r.id_nuestra
       and exists (select 1 from public.tcg_card_prices p where p.card_id = r.id_tcggo);
    update public.tcg_card_prices set card_id = r.id_nuestra where card_id = r.id_tcggo;
    delete from public.tcg_card_history h where h.card_id = r.id_nuestra
       and exists (select 1 from public.tcg_card_history h2 where h2.card_id = r.id_tcggo and h2.dia = h.dia);
    update public.tcg_card_history set card_id = r.id_nuestra where card_id = r.id_tcggo;

    delete from public.tcg_cards where id = r.id_tcggo and market = 'WEST';
  end loop;
end $$;

-- ── 3. Comprobación: no queda ningún duplicado con pareja ──
select count(*) as duplicados_que_quedan
  from public.tcg_cards t
 where t.market = 'WEST' and t.set_id = '30th' and t.origen = 'tcggo';
