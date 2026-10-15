-- ─────────────────────────────────────────────────────────────────────
-- Tanda 853 — las Trainer Gallery (y galerías parecidas) estaban dos veces.
--
-- TCGGO lista la Trainer Gallery DENTRO de su expansión: Lost Origin trae
-- las TG01–TG30 con las demás. Nosotros las tenemos como set aparte
-- (`swsh11tg`, de TCGdex), que es como PINGU quiere verlas. El catálogo
-- (640) escribía lo que no casaba por número en el set PRINCIPAL, así que
-- cada TG de TCGGO nació como `tcggo-N` en Lost Origin, al lado de la de
-- TCGdex en `swsh11tg`: la misma carta dos veces, la de TCGGO sin
-- `variants` («Normal») y la de TCGdex con el suyo («Holo»). PINGU lo vio
-- el 2026-10-15: «sale ese Pikachu dos veces, y pone que hay una versión
-- normal y otra holo, y la normal no existe».
--
-- Desde la 853 el catálogo casa contra los sets hermanos antes de crear
-- nada (`setsHermanos`), y la pasada de precios los incluye. Esto arregla
-- lo que ya está escrito: cada `tcggo-*` de un set principal que tenga su
-- gemela —mismo número impreso— en un set hermano (`<id>tg`, `<id>.5tg`,
-- `<id>gg`, `<id>.5gg`, `<id>sv`, `<id>.5sv`, y las parejas a mano de
-- COLECCIONES_JUNTAS) se funde en la gemela: la gemela se queda con el id
-- de TCGGO, su foto, su id de Cardmarket (para que los precios sigan) y
-- todo lo que la gente tuviera apuntado en la de TCGGO (copias, deseos,
-- álbumes, avisos, vitrina, versiones, precios, histórico), y la de TCGGO
-- se borra. Una de TCGGO sin gemela se queda como está.
--
-- 1) Ejecuta primero la vista previa. 2) Luego el bloque `do`.
-- Es re-ejecutable: sin duplicados no hace nada.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Vista previa: qué carta de TCGGO se funde en qué gemela ──
select t.id as de_tcggo, t.set_id as en_set, t.local_id as numero, g.id as a_gemela, g.set_id as set_gemela, g.local_id as numero_gemela,
       coalesce(t.name_en, t.name) as nombre_tcggo, coalesce(g.name_en, g.name) as nombre_gemela,
       (select count(*) from public.user_collection u where u.card_id = t.id) as lineas_que_se_mueven
  from public.tcg_cards t
  join public.tcg_cards g
    on g.market = t.market and g.id not like 'tcggo-%'
   and (g.set_id in (t.set_id || 'tg', t.set_id || '.5tg', t.set_id || 'gg', t.set_id || '.5gg', t.set_id || 'sv', t.set_id || '.5sv')
        or (t.set_id, g.set_id) in (values ('bw11', 'rc'), ('ex10', 'exu'), ('xyp', 'xya'), ('basep', 'wp'), ('basep', 'miscp'), ('sm115', 'sma')))
   and lower(regexp_replace(g.local_id, '^([a-z]*)[ -]?0*(\d+)$', '\1\2', 'i')) = lower(regexp_replace(t.local_id, '^([a-z]*)[ -]?0*(\d+)$', '\1\2', 'i'))
 where t.market = 'WEST' and t.id like 'tcggo-%'
 order by t.set_id, t.local_id;

-- ── 2. La fusión ──
do $$
declare
  r record;
  dup record;
begin
  for r in
    select t.id as id_tcggo, g.id as id_gemela, t.tcggo_id, t.image_tcggo, t.cm_id_product, t.tp_id_product, t.cm_id_product_propio,
           t.rarity_en, t.hp, t.illustrator
      from public.tcg_cards t
      join public.tcg_cards g
        on g.market = t.market and g.id not like 'tcggo-%'
       and (g.set_id in (t.set_id || 'tg', t.set_id || '.5tg', t.set_id || 'gg', t.set_id || '.5gg', t.set_id || 'sv', t.set_id || '.5sv')
            or (t.set_id, g.set_id) in (values ('bw11', 'rc'), ('ex10', 'exu'), ('xyp', 'xya'), ('basep', 'wp'), ('basep', 'miscp'), ('sm115', 'sma')))
       and lower(regexp_replace(g.local_id, '^([a-z]*)[ -]?0*(\d+)$', '\1\2', 'i')) = lower(regexp_replace(t.local_id, '^([a-z]*)[ -]?0*(\d+)$', '\1\2', 'i'))
     where t.market = 'WEST' and t.id like 'tcggo-%'
  loop
    -- 2a. Lo que la de TCGGO sabía y la gemela no: su id de TCGGO (es lo
    --     que la pasada de precios y el catálogo usan para reconocerla),
    --     su foto, sus ids de Cardmarket y TCGplayer, y los huecos.
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

    -- 2b. Las copias. Si alguien tenía las DOS con el mismo idioma, estado
    --     y versión, se suman (tope 999); las carpetas de la línea que se
    --     va pasan a la que se queda, y la línea se borra.
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

    -- 2c. Deseos (únicos por persona, carta e idioma: si ya quería la
    --     gemela, el deseo repetido se va), álbumes soñados (JSON de ids),
    --     avisos de precio, vitrina y versiones.
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

    -- 2d. Los precios y el histórico: los de la de TCGGO son los buenos
    --     (los escribe la pasada de precios); si la gemela tenía fila, se
    --     va y entra la de TCGGO a su nombre.
    if exists (select 1 from public.tcg_card_prices where card_id = r.id_tcggo) then
      delete from public.tcg_card_prices where card_id = r.id_gemela;
      update public.tcg_card_prices set card_id = r.id_gemela where card_id = r.id_tcggo;
    end if;
    delete from public.tcg_card_history h where h.card_id = r.id_gemela
       and exists (select 1 from public.tcg_card_history h2 where h2.card_id = r.id_tcggo and h2.dia = h.dia);
    update public.tcg_card_history set card_id = r.id_gemela where card_id = r.id_tcggo;

    delete from public.tcg_cards where id = r.id_tcggo and market = 'WEST';
  end loop;
end $$;

-- ── 3. Comprobación: no debería quedar ninguna pareja ──
select count(*) as duplicados_que_quedan
  from public.tcg_cards t
  join public.tcg_cards g
    on g.market = t.market and g.id not like 'tcggo-%'
   and (g.set_id in (t.set_id || 'tg', t.set_id || '.5tg', t.set_id || 'gg', t.set_id || '.5gg', t.set_id || 'sv', t.set_id || '.5sv')
        or (t.set_id, g.set_id) in (values ('bw11', 'rc'), ('ex10', 'exu'), ('xyp', 'xya'), ('basep', 'wp'), ('basep', 'miscp'), ('sm115', 'sma')))
   and lower(regexp_replace(g.local_id, '^([a-z]*)[ -]?0*(\d+)$', '\1\2', 'i')) = lower(regexp_replace(t.local_id, '^([a-z]*)[ -]?0*(\d+)$', '\1\2', 'i'))
 where t.market = 'WEST' and t.id like 'tcggo-%';
-- Y las de la Trainer Gallery de Lost Origin, con su id de TCGGO puesto:
select id, local_id, name, tcggo_id, cm_id_product_propio, variants from public.tcg_cards where market = 'WEST' and set_id = 'swsh11tg' order by local_id;
