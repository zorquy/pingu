-- ─────────────────────────────────────────────────────────────────────
-- Tanda 854 — la Classic Collection de Celebrations, en su set.
--
-- TCGGO tiene UNA expansión «Celebrations» (la 35) con la Classic
-- Collection dentro, numerada como la carta original. La 687 reemplazó
-- `cel25` ENTERO por esa lista: las 25 de siempre se conservaron (mismo
-- número, mismo id `cel25-N`) y las 25 de la Classic entraron NUEVAS
-- (`tcggo-N`), al lado de las 25 que ya teníamos en `cel25cc` (TCGdex,
-- `CC001`–`CC025`). Resultado: Celebrations con 50, números repetidos y
-- en el orden de TCGGO, y la Classic aparte con otras 25.
--
-- PINGU (2026-10-15): «yo las sacaría y las metería en la Classic
-- Collection y ya está: 25 en un lado y 25 en otro». Eso hace esto: cada
-- carta de TCGGO en `cel25` (las `tcggo-*`: las de siempre llevan `cel25-N`)
-- se funde en su gemela de `cel25cc` —la del mismo nombre inglés, cuando es
-- único en los dos lados— igual que las Trainer Gallery en la 853: la
-- gemela se queda con el id de TCGGO, su foto, sus ids de Cardmarket y lo
-- que la gente tuviera apuntado, y la de TCGGO se borra. La que no tenga
-- gemela por el nombre se MUEVE a `cel25cc` tal cual (sale en la
-- comprobación final, por si es la misma carta con otro nombre).
--
-- Desde la 854 el catálogo cuenta `cel25cc` como set hermano de `cel25`
-- (casa por el id de TCGGO antes de crear nada) y la pasada de precios lo
-- incluye, así que no vuelven a entrar en `cel25`.
--
-- 1) Ejecuta primero la vista previa. 2) Luego el bloque `do`.
-- Es re-ejecutable: sin `tcggo-*` en `cel25` no hace nada.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Vista previa: qué carta de TCGGO en Celebrations va a qué gemela ──
select t.id as de_tcggo, t.local_id as numero, coalesce(t.name_en, t.name) as nombre,
       g.id as a_gemela, g.local_id as numero_gemela, coalesce(g.name_en, g.name) as nombre_gemela,
       case when g.id is null then 'SE MUEVE tal cual (sin gemela por el nombre)' else 'se funde' end as que_pasa,
       (select count(*) from public.user_collection u where u.card_id = t.id) as lineas_que_se_mueven
  from public.tcg_cards t
  left join public.tcg_cards g
    on g.market = 'WEST' and g.set_id = 'cel25cc' and g.id not like 'tcggo-%'
   and lower(coalesce(g.name_en, g.name)) = lower(coalesce(t.name_en, t.name))
   and (select count(*) from public.tcg_cards g2 where g2.market = 'WEST' and g2.set_id = 'cel25cc' and g2.id not like 'tcggo-%'
         and lower(coalesce(g2.name_en, g2.name)) = lower(coalesce(t.name_en, t.name))) = 1
   and (select count(*) from public.tcg_cards t2 where t2.market = 'WEST' and t2.set_id = 'cel25' and t2.id like 'tcggo-%'
         and lower(coalesce(t2.name_en, t2.name)) = lower(coalesce(t.name_en, t.name))) = 1
 where t.market = 'WEST' and t.set_id = 'cel25' and t.id like 'tcggo-%'
 order by t.local_id;

-- ── 2. La mudanza ──
do $$
declare
  r record;
  dup record;
begin
  -- 2a. Con gemela única por el nombre: se funde (como la 853).
  for r in
    select t.id as id_tcggo, g.id as id_gemela, t.tcggo_id, t.image_tcggo, t.cm_id_product, t.tp_id_product, t.cm_id_product_propio,
           t.rarity_en, t.hp, t.illustrator
      from public.tcg_cards t
      join public.tcg_cards g
        on g.market = 'WEST' and g.set_id = 'cel25cc' and g.id not like 'tcggo-%'
       and lower(coalesce(g.name_en, g.name)) = lower(coalesce(t.name_en, t.name))
       and (select count(*) from public.tcg_cards g2 where g2.market = 'WEST' and g2.set_id = 'cel25cc' and g2.id not like 'tcggo-%'
             and lower(coalesce(g2.name_en, g2.name)) = lower(coalesce(t.name_en, t.name))) = 1
       and (select count(*) from public.tcg_cards t2 where t2.market = 'WEST' and t2.set_id = 'cel25' and t2.id like 'tcggo-%'
             and lower(coalesce(t2.name_en, t2.name)) = lower(coalesce(t.name_en, t.name))) = 1
     where t.market = 'WEST' and t.set_id = 'cel25' and t.id like 'tcggo-%'
  loop
    update public.tcg_cards g
       set tcggo_id = coalesce(g.tcggo_id, r.tcggo_id),
           image_tcggo = coalesce(g.image_tcggo, r.image_tcggo),
           cm_id_product = coalesce(g.cm_id_product, r.cm_id_product),
           tp_id_product = coalesce(g.tp_id_product, r.tp_id_product),
           cm_id_product_propio = coalesce(g.cm_id_product_propio, r.cm_id_product_propio),
           rarity_en = coalesce(g.rarity_en, r.rarity_en),
           hp = coalesce(g.hp, r.hp),
           illustrator = coalesce(g.illustrator, r.illustrator)
     where g.id = r.id_gemela and g.market = 'WEST';

    for dup in
      select d.id as id_dup, d.cantidad, e.id as id_destino
        from public.user_collection d
        join public.user_collection e
          on e.user_id = d.user_id and e.card_id = r.id_gemela and e.market = d.market
         and e.idioma = d.idioma and e.estado = d.estado and e.variante = d.variante
       where d.card_id = r.id_tcggo and d.market = 'WEST'
    loop
      update public.user_collection set cantidad = least(999, cantidad + dup.cantidad) where id = dup.id_destino;
      delete from public.collection_folder_cards f where f.line_id = dup.id_dup
         and exists (select 1 from public.collection_folder_cards f2 where f2.folder_id = f.folder_id and f2.line_id = dup.id_destino);
      update public.collection_folder_cards set line_id = dup.id_destino where line_id = dup.id_dup;
      delete from public.user_collection where id = dup.id_dup;
    end loop;
    update public.user_collection set card_id = r.id_gemela where card_id = r.id_tcggo and market = 'WEST';

    delete from public.user_wants w where w.card_id = r.id_tcggo
       and exists (select 1 from public.user_wants w2 where w2.user_id = w.user_id and w2.card_id = r.id_gemela and coalesce(w2.idioma, '*') = coalesce(w.idioma, '*'));
    update public.user_wants set card_id = r.id_gemela where card_id = r.id_tcggo;
    update public.user_albums
       set cartas = replace(replace(cartas::text, '"id": "' || r.id_tcggo || '"', '"id": "' || r.id_gemela || '"'),
                            '"id":"' || r.id_tcggo || '"', '"id":"' || r.id_gemela || '"')::jsonb
     where cartas::text like '%' || r.id_tcggo || '%';
    update public.user_price_alerts set card_id = r.id_gemela where card_id = r.id_tcggo;
    update public.user_showcase set card_id = r.id_gemela where card_id = r.id_tcggo;
    update public.tcg_card_versions set card_id = r.id_gemela where card_id = r.id_tcggo;
    update public.carta_del_dia set card_id = r.id_gemela where card_id = r.id_tcggo;
    update public.mas_caro_del_dia set card_ids = array_replace(card_ids, r.id_tcggo, r.id_gemela) where r.id_tcggo = any (card_ids);

    if exists (select 1 from public.tcg_card_prices where card_id = r.id_tcggo) then
      delete from public.tcg_card_prices where card_id = r.id_gemela;
      update public.tcg_card_prices set card_id = r.id_gemela where card_id = r.id_tcggo;
    end if;
    delete from public.tcg_card_history h where h.card_id = r.id_gemela
       and exists (select 1 from public.tcg_card_history h2 where h2.card_id = r.id_tcggo and h2.dia = h.dia);
    update public.tcg_card_history set card_id = r.id_gemela where card_id = r.id_tcggo;

    delete from public.tcg_cards where id = r.id_tcggo and market = 'WEST';
  end loop;

  -- 2b. Las de TCGGO que quedan en `cel25` sin gemela por el nombre: a la
  --     Classic tal cual, con todo lo suyo (el id no cambia, así que las
  --     líneas de la gente las siguen).
  update public.tcg_cards set set_id = 'cel25cc' where market = 'WEST' and set_id = 'cel25' and id like 'tcggo-%';
end $$;

-- ── 3. Comprobación: 25 y 25, y lo que se movió sin gemela ──
select set_id, count(*) as cartas from public.tcg_cards where market = 'WEST' and set_id in ('cel25', 'cel25cc') group by set_id;
-- Las que se movieron sin gemela (si las hay, mirar si son la misma carta con otro nombre):
select id, local_id, coalesce(name_en, name) as nombre from public.tcg_cards where market = 'WEST' and set_id = 'cel25cc' and id like 'tcggo-%' order by local_id;
-- Y la Classic con su id de TCGGO puesto (para los precios y el catálogo):
select id, local_id, coalesce(name_en, name) as nombre, tcggo_id, cm_id_product_propio from public.tcg_cards where market = 'WEST' and set_id = 'cel25cc' order by local_id;
