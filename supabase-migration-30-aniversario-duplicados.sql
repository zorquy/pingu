-- ─────────────────────────────────────────────────────────────────────
-- Tanda 652 — el 30 aniversario es la expansión de TCGGO, entera.
--
-- TCGGO tiene UNA expansión «30th Celebration» con la Classic Collection
-- dentro, numerada como la carta original («Charizard 4/102», «Zacian V
-- SSH138»). TCGdex la tenía como set aparte («30th-c», numerado 001–030),
-- así que el catálogo (640) no casó ninguna por número y CREÓ las de
-- TCGGO en el set «30th» (origen 'tcggo'), con su foto y su precio; las
-- de TCGdex se quedaron sin foto y en pantalla caían al respaldo de
-- Limitless por código + número: con «30C» y «001», el Exeggcute del
-- Celebration rotulado «Charizard». PINGU lo vio el 2026-10-05.
--
-- PINGU: «¿por qué no coges simplemente la expansión entera de la API y
-- listo?». Eso hace esto: el 30 aniversario pasa a ser EXACTAMENTE la
-- lista de TCGGO. Las cartas de la Classic que vinieron de TCGdex se van,
-- y el set «30th-c» con ellas. Lo único que no se tira es lo que la gente
-- tuviera apuntado en ellas: cada copia, deseo, álbum soñado y precio
-- pasa a la carta equivalente de TCGGO —la del mismo nombre inglés,
-- cuando es único en los dos lados— ANTES de borrar la de TCGdex. Una de
-- TCGdex sin equivalente y con copias apuntadas NO se borra: sale en la
-- comprobación final para mirarla a mano.
--
-- 1) Ejecuta primero la vista previa. 2) Luego el bloque `do`.
-- Es re-ejecutable: sin cartas en «30th-c» no hace nada.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Vista previa: qué carta de TCGdex pasa a qué carta de TCGGO ──
select c.id as de_tcgdex, c.local_id as numero_tcgdex, t.id as a_tcggo, t.local_id as numero_tcggo, t.name as nombre,
       (select count(*) from public.user_collection u where u.card_id = c.id) as lineas_de_coleccion_que_se_mueven
  from public.tcg_cards c
  join public.tcg_cards t
    on t.market = 'WEST' and t.set_id = '30th' and lower(t.name) = lower(coalesce(c.name_en, c.name))
 where c.market = 'WEST' and c.set_id = '30th-c'
   and (select count(*) from public.tcg_cards t2
         where t2.market = 'WEST' and t2.set_id = '30th' and lower(t2.name) = lower(coalesce(c.name_en, c.name))) = 1
   and (select count(*) from public.tcg_cards c2
         where c2.market = 'WEST' and c2.set_id = '30th-c' and lower(coalesce(c2.name_en, c2.name)) = lower(coalesce(c.name_en, c.name))) = 1
 order by c.local_id;

-- Las de TCGdex SIN equivalente único en TCGGO (se borran solo si nadie
-- tiene copias apuntadas; si no, se quedan y hay que mirarlas):
select c.id, c.local_id, coalesce(c.name_en, c.name) as nombre,
       (select count(*) from public.user_collection u where u.card_id = c.id) as lineas_de_coleccion
  from public.tcg_cards c
 where c.market = 'WEST' and c.set_id = '30th-c'
   and (select count(*) from public.tcg_cards t2
         where t2.market = 'WEST' and t2.set_id = '30th' and lower(t2.name) = lower(coalesce(c.name_en, c.name))) <> 1
 order by c.local_id;

-- ── 2. La mudanza y la limpieza ──
do $$
declare
  r record;
  dup record;
begin
  -- 2a. Cada carta de TCGdex con equivalente único en TCGGO: lo suyo pasa
  --     a la de TCGGO y se borra.
  for r in
    select c.id as id_tcgdex, t.id as id_tcggo
      from public.tcg_cards c
      join public.tcg_cards t
        on t.market = 'WEST' and t.set_id = '30th' and lower(t.name) = lower(coalesce(c.name_en, c.name))
     where c.market = 'WEST' and c.set_id = '30th-c'
       and (select count(*) from public.tcg_cards t2
             where t2.market = 'WEST' and t2.set_id = '30th' and lower(t2.name) = lower(coalesce(c.name_en, c.name))) = 1
       and (select count(*) from public.tcg_cards c2
             where c2.market = 'WEST' and c2.set_id = '30th-c' and lower(coalesce(c2.name_en, c2.name)) = lower(coalesce(c.name_en, c.name))) = 1
  loop
    -- Las copias. Si alguien tenía las DOS con el mismo idioma, estado y
    -- versión, se suman (tope 999) y la de TCGdex se borra.
    for dup in
      select d.id as id_dup, d.cantidad, e.id as id_destino
        from public.user_collection d
        join public.user_collection e
          on e.user_id = d.user_id and e.card_id = r.id_tcggo and e.market = d.market
         and e.idioma = d.idioma and e.estado = d.estado and e.variante = d.variante
       where d.card_id = r.id_tcgdex and d.market = 'WEST'
    loop
      update public.user_collection set cantidad = least(999, cantidad + dup.cantidad) where id = dup.id_destino;
      delete from public.user_collection where id = dup.id_dup;
    end loop;
    update public.user_collection set card_id = r.id_tcggo where card_id = r.id_tcgdex and market = 'WEST';

    -- Los deseos y los álbumes soñados (sus cartas van en un JSON de ids).
    update public.user_wants set card_id = r.id_tcggo where card_id = r.id_tcgdex;
    update public.user_albums
       set cartas = replace(replace(cartas::text, '"id": "' || r.id_tcgdex || '"', '"id": "' || r.id_tcggo || '"'),
                            '"id":"' || r.id_tcgdex || '"', '"id":"' || r.id_tcggo || '"')::jsonb
     where cartas::text like '%' || r.id_tcgdex || '%';

    -- Los precios y el histórico: los de TCGGO mandan si los hay; si no,
    -- se quedan los que tuviera la de TCGdex, a nombre de la de TCGGO.
    delete from public.tcg_card_prices where card_id = r.id_tcgdex
       and exists (select 1 from public.tcg_card_prices p where p.card_id = r.id_tcggo);
    update public.tcg_card_prices set card_id = r.id_tcggo where card_id = r.id_tcgdex;
    delete from public.tcg_card_history h where h.card_id = r.id_tcgdex
       and exists (select 1 from public.tcg_card_history h2 where h2.card_id = r.id_tcggo and h2.dia = h.dia);
    update public.tcg_card_history set card_id = r.id_tcggo where card_id = r.id_tcgdex;

    delete from public.tcg_cards where id = r.id_tcgdex and market = 'WEST';
  end loop;

  -- 2b. Las de TCGdex sin equivalente y sin copias de nadie: fuera. Las
  --     que tengan copias se quedan (salen en la comprobación de abajo).
  delete from public.tcg_cards c
   where c.market = 'WEST' and c.set_id = '30th-c'
     and not exists (select 1 from public.user_collection u where u.card_id = c.id);

  -- 2c. El set «30th-c» se va si se ha quedado vacío: su valor diario, sus
  --     favoritos y la fila. Las cartas del 30 son las de «30th».
  if not exists (select 1 from public.tcg_cards where market = 'WEST' and set_id = '30th-c') then
    delete from public.tcg_set_valor where set_id = '30th-c' and market = 'WEST';
    delete from public.collection_favorite_sets where set_id = '30th-c';
    delete from public.tcg_sets where id = '30th-c' and market = 'WEST';
  end if;
end $$;

-- ── 3. Comprobación: lo que queda en «30th-c» (debería ser nada) ──
select c.id, c.local_id, coalesce(c.name_en, c.name) as nombre,
       (select count(*) from public.user_collection u where u.card_id = c.id) as lineas_de_coleccion
  from public.tcg_cards c
 where c.market = 'WEST' and c.set_id = '30th-c';
select count(*) as cartas_del_30 from public.tcg_cards where market = 'WEST' and set_id = '30th';
