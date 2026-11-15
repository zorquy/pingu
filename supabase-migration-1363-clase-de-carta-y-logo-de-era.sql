-- Tanda 1363 — Lo nuevo de la API de TCGGO (propuesta aprobada por PINGU el
-- 2026-11-15, la A y la B).
--
-- A. LA CLASE Y LA FASE DE CADA CARTA. TCGGO da ahora `card_type` y
--    `card_subtype` («Pokémon · Basic», «Supporter»…). Las cartas que crea el
--    catálogo nacían sin clase, y en Jugar una carta sin clase no es Pokémon
--    ni Entrenador ni Energía (con Delta Reign hubo que clasificar a mano sus
--    141, la 1281). `tcggo_guardar_cartas` recibe ahora también
--    `trainer_type`, `stage` y `energy_type` (ya traducidos a nuestros
--    valores por `fichaDeJuegoDe`, en netlify/lib/tcggo.mjs) y, como la
--    categoría, SOLO los escribe si estaban vacíos: lo de TCGdex (en español,
--    con ataques) y lo corregido en /admin siguen mandando.
--
-- B. EL LOGO DE CADA ERA. Cada expansión de TCGGO cuelga de su serie, que
--    ahora trae su logo. Se guarda en el set (`logo_serie_tcggo`) y no en
--    `tcg_eras`: así vale para todas las eras, también las que nadie ha
--    colocado a mano en /admin, y para el japonés. La estantería pinta en la
--    cabecera de cada era el logo de su expansión más nueva que lo tenga.
--    Lo escribe `tcggo_guardar_sets` (la pasada de precios, una vez al día),
--    como el logo y el símbolo del set: el de TCGGO cuando lo da.
--
-- La web pide la columna nueva como OPCIONAL (se quita sola si no existe,
-- la 624), así que el despliegue no depende de esta migración, ni al revés.
--
-- Re-ejecutable. Sin tablas temporales (la 631).

alter table public.tcg_sets add column if not exists logo_serie_tcggo text;

create or replace function public.tcggo_guardar_sets(p_sets jsonb, p_market text default 'WEST') returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_filas int;
begin
  update public.tcg_sets s
     set logo_tcggo = coalesce(nullif(p.logo, ''), s.logo_tcggo),
         -- El símbolo, como el logo: el de TCGGO cuando lo da.
         symbol_tcggo = coalesce(nullif(p.simbolo, ''), s.symbol_tcggo),
         -- Y el de su era (1363), igual.
         logo_serie_tcggo = coalesce(nullif(p.logo_serie, ''), s.logo_serie_tcggo),
         tcggo_id = coalesce(p.tcggo_id, s.tcggo_id),
         release_date = coalesce(s.release_date, p.fecha),
         card_count_total = coalesce(s.card_count_total, nullif(p.cartas, 0)),
         card_count_official = coalesce(s.card_count_official, nullif(p.impresas, 0))
    from jsonb_to_recordset(p_sets) as p(id text, tcggo_id int, logo text, simbolo text, logo_serie text, fecha date, cartas int, impresas int)
   where s.id = p.id and s.market = p_market;
  get diagnostics v_filas = row_count;

  insert into public.tcg_set_valor (set_id, market, dia, valor_cm, valor_tp)
  select p.id, p_market, current_date, nullif(p.valor_cm, 0), nullif(p.valor_tp, 0)
    from jsonb_to_recordset(p_sets) as p(id text, valor_cm numeric, valor_tp numeric)
   where (p.valor_cm is not null or p.valor_tp is not null)
     and exists (select 1 from public.tcg_sets s where s.id = p.id and s.market = p_market)
  on conflict (set_id, market, dia) do update
    set valor_cm = excluded.valor_cm,
        valor_tp = excluded.valor_tp;

  return v_filas;
end;
$$;

revoke all on function public.tcggo_guardar_sets(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_guardar_sets(jsonb, text) to service_role;

create or replace function public.tcggo_guardar_cartas(p_cartas jsonb, p_market text default 'WEST') returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_filas int;
begin
  insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, tcggo_id, image_tcggo, cm_id_product_propio, tp_id_product_propio, cm_por, cm_emparejado_at, rarity_en, hp, illustrator, category, trainer_type, stage, energy_type, origen, tcggo_at, detalle_at, detalle_lang)
  select p.id, p_market, p.set_id, coalesce(p.local_id, ''), coalesce(p.name, p.id), p.name_en, p.tcggo_id, p.image_tcggo,
         p.cm_id_product, p.tp_id_product, case when p.cm_id_product is not null then 'tcggo' end, case when p.cm_id_product is not null then now() end,
         p.rarity_en, p.hp, p.illustrator, p.category, p.trainer_type, p.stage, p.energy_type, 'tcggo', now(), now(), 'tcggo'
    from jsonb_to_recordset(p_cartas) as p(id text, set_id text, local_id text, name text, name_en text, tcggo_id int, image_tcggo text, cm_id_product int, tp_id_product int, rarity_en text, hp int, illustrator text, category text, trainer_type text, stage text, energy_type text)
  on conflict (id, market) do update
    set tcggo_id = excluded.tcggo_id,
        image_tcggo = coalesce(excluded.image_tcggo, tcg_cards.image_tcggo),
        cm_id_product_propio = coalesce(tcg_cards.cm_id_product_propio, excluded.cm_id_product_propio),
        tp_id_product_propio = coalesce(tcg_cards.tp_id_product_propio, excluded.tp_id_product_propio),
        cm_por = case when tcg_cards.cm_id_product_propio is null and excluded.cm_id_product_propio is not null then 'tcggo' else tcg_cards.cm_por end,
        cm_emparejado_at = case when tcg_cards.cm_id_product_propio is null and excluded.cm_id_product_propio is not null then now() else tcg_cards.cm_emparejado_at end,
        rarity_en = coalesce(excluded.rarity_en, tcg_cards.rarity_en),
        hp = coalesce(excluded.hp, tcg_cards.hp),
        illustrator = coalesce(excluded.illustrator, tcg_cards.illustrator),
        name_en = coalesce(tcg_cards.name_en, excluded.name_en),
        category = coalesce(tcg_cards.category, excluded.category),
        -- La clase y la fase (1363): solo lo vacío, como la categoría. Y solo
        -- si la carta no tiene ya OTRA categoría: un «Item» de TCGGO no se le
        -- cuelga a lo que TCGdex dice que es un Pokémon.
        trainer_type = case when coalesce(tcg_cards.category, excluded.category) is not distinct from excluded.category
                            then coalesce(tcg_cards.trainer_type, excluded.trainer_type) else tcg_cards.trainer_type end,
        stage = case when coalesce(tcg_cards.category, excluded.category) is not distinct from excluded.category
                     then coalesce(tcg_cards.stage, excluded.stage) else tcg_cards.stage end,
        energy_type = case when coalesce(tcg_cards.category, excluded.category) is not distinct from excluded.category
                           then coalesce(tcg_cards.energy_type, excluded.energy_type) else tcg_cards.energy_type end,
        tcggo_at = now();
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke all on function public.tcggo_guardar_cartas(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_guardar_cartas(jsonb, text) to service_role;
