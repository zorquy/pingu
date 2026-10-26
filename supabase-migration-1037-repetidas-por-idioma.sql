-- ============================================================
-- Tanda 1037: «Posibles repetidas» casa también los nombres en inglés y en
-- español, y el Zekrom de N (MEP 031) deja de salir dos veces.
--
-- Va DESPUÉS de la 987, la 996 y la 1007 (redefine
-- `catalogo_posibles_repetidas` y llama a `catalogo_repetida_resolver`). Se
-- puede ejecutar más de una vez, y cada sentencia va sola (la 631).
--
-- PINGU, con el Zekrom de N de las promos de Mega Evolución: «está
-- repetido». En la base hay dos cartas MEP 031: la de TCGdex (`mep-031`,
-- con `name` = «Zekrom de N») y la que creó el catálogo de TCGGO
-- (`tcggo-33636`, «N's Zekrom», con la versión de Pokémon Center fundida).
-- La lista de /admin junta por número y por NOMBRE, y el nombre era el
-- `name` tal cual: en el occidental parte de las filas de TCGdex lo llevan en
-- español (la 505), así que «Zekrom de N» y «N's Zekrom» nunca cayeron
-- juntas y PINGU no la vio.
--
-- 1. Dos cartas de la misma colección y el mismo número son posibles
--    repetidas si COMPARTEN algún nombre: el `name`, el `name_en` o el
--    `name_es`, cada uno pasado por `catalogo_nombre_de_repetida` (la 1007).
--    Lo marcado «son distintas» se sigue reconociendo por sus cartas.
-- 2. El Zekrom de N se resuelve como «es la misma carta», con la MISMA
--    función que el botón de /admin (queda en «Hechas» y se puede deshacer):
--    la de TCGGO se va a la de TCGdex, que es la de la expansión, con su
--    versión de Pokémon Center, las copias y lo demás. Antes, lo que hace
--    falta para que la de TCGdex tenga precio: su producto de Cardmarket y la
--    fila de precio, si no los tenía.
-- ============================================================

create or replace function public.catalogo_posibles_repetidas(p_market text default null, p_limite int default 300)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  with c as (
    select c.*, public.catalogo_numero_de_repetida(c.local_id) as n,
           public.catalogo_nombre_de_repetida(coalesce(nullif(trim(c.name_en), ''), c.name)) as k,
           array(select distinct x from unnest(array[
             public.catalogo_nombre_de_repetida(c.name),
             public.catalogo_nombre_de_repetida(c.name_en),
             public.catalogo_nombre_de_repetida(c.name_es)]) as x where x <> '') as ks
      from public.tcg_cards c
      join public.tcg_sets s on s.id = c.set_id and s.market = c.market
     where (p_market is null or c.market = p_market)
       and not coalesce(s.oculto, false)
       and trim(coalesce(c.local_id, '')) <> ''
  ), m as (
    -- Las que comparten algún nombre con otra del mismo número.
    select distinct a.id, a.market from c a
      join c b on b.market = a.market and b.set_id = a.set_id and b.n = a.n and b.id <> a.id and a.ks && b.ks
  ), cm as (
    select c.* from c join m on m.id = c.id and m.market = c.market
  ), g as (
    select market, set_id, n, min(k) as k, array_agg(id order by id) as ids
      from cm group by market, set_id, n
  ), vivos as (
    select g.* from g
     where not exists (
       select 1 from public.tcg_repetidas_distintas d
        where d.market = g.market and d.set_id = g.set_id and g.ids <@ d.ids)
  ), elegidos as (
    select v.*, s.name as set_nombre, s.name_en as set_nombre_en, s.release_date, s.serie_id, s.tcg_online_code
      from vivos v join public.tcg_sets s on s.id = v.set_id and s.market = v.market
     order by s.release_date desc nulls last, v.set_id, v.n
     limit greatest(1, least(coalesce(p_limite, 300), 1000))
  )
  select jsonb_build_object(
    'total', (select count(*) from vivos),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', e.market, 'set_id', e.set_id, 'numero', e.n, 'nombre', e.k,
        'set', jsonb_build_object('id', e.set_id, 'name', e.set_nombre, 'name_en', e.set_nombre_en, 'release_date', e.release_date),
        'cartas', (
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'market', c.market, 'set_id', c.set_id, 'local_id', c.local_id, 'name', c.name, 'name_es', c.name_es,
            'origen', c.origen, 'tcggo_id', c.tcggo_id, 'hp', c.hp, 'illustrator', c.illustrator, 'attacks', c.attacks,
            'category', c.category, 'stage', c.stage, 'types', c.types,
            'abilities', c.abilities, 'rarity', c.rarity, 'variants', c.variants, 'image_path', c.image_path,
            'image_tcggo', c.image_tcggo, 'cm_id_product_propio', c.cm_id_product_propio,
            'tcg_sets', jsonb_build_object('serie_id', e.serie_id, 'tcg_online_code', e.tcg_online_code, 'release_date', e.release_date),
            'precio', (select jsonb_build_object('cm_id_product', p.cm_id_product, 'cm_low', p.cm_low, 'cm_low_es', p.cm_low_es, 'cm_low_en', p.cm_low_en)
                         from public.tcg_card_prices p where p.card_id = c.id),
            'personas', (select count(distinct u.user_id) from public.user_collection u where u.card_id = c.id and u.market = c.market),
            'copias', (select coalesce(sum(u.cantidad), 0) from public.user_collection u where u.card_id = c.id and u.market = c.market)
          ) order by (c.origen = 'tcggo') nulls first, c.tcggo_id nulls first, c.id)
            from cm c where c.market = e.market and c.set_id = e.set_id and c.n = e.n)
      ) order by e.release_date desc nulls last, e.set_id, e.n)
        from elegidos e), '[]'::jsonb),
    'hechas', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'market', h.market, 'carta', h.carta, 'destino', h.destino, 'decision', h.decision,
        'etiqueta', h.etiqueta, 'nombre', h.fila->>'name', 'set_id', h.fila->>'set_id', 'local_id', h.fila->>'local_id', 'hecha_at', h.hecha_at)
        order by h.hecha_at desc)
        from (select * from public.tcg_repetidas_hechas where deshecha_at is null and (p_market is null or market = p_market) order by hecha_at desc limit 200) h), '[]'::jsonb),
    'distintas', coalesce((
      select jsonb_agg(jsonb_build_object('market', d.market, 'set_id', d.set_id, 'numero', d.numero, 'nombre', d.nombre, 'ids', d.ids, 'creado_at', d.creado_at)
        order by d.creado_at desc)
        from public.tcg_repetidas_distintas d where p_market is null or d.market = p_market), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.catalogo_posibles_repetidas(text, int) from public, anon;
grant execute on function public.catalogo_posibles_repetidas(text, int) to authenticated, service_role;


-- El Zekrom de N. La función de /admin pide un admin (`auth.uid()`), y en el
-- SQL Editor no hay sesión: se le presta la del primer admin SOLO dentro de
-- este `do` (`set_config(…, true)` vale para esta transacción), y la jugada
-- queda apuntada a su nombre en «Hechas», como si la hubiera pulsado.
do $$
declare
  v_admin uuid;
  v_principal public.tcg_cards%rowtype;
  v_repetida public.tcg_cards%rowtype;
  v_r jsonb;
begin
  select * into v_principal from public.tcg_cards where id = 'mep-031' and market = 'WEST';
  select * into v_repetida from public.tcg_cards where id = 'tcggo-33636' and market = 'WEST';
  if v_principal.id is null or v_repetida.id is null then
    raise notice 'Zekrom de N: no están las dos (mep-031 y tcggo-33636); ya estaba resuelto o no hay nada que juntar.';
    return;
  end if;
  if v_principal.set_id is distinct from v_repetida.set_id then
    raise notice 'Zekrom de N: mep-031 está en % y tcggo-33636 en %; no se tocan.', v_principal.set_id, v_repetida.set_id;
    return;
  end if;
  select id into v_admin from public.user_profiles where is_admin order by id limit 1;
  if v_admin is null then
    raise notice 'Zekrom de N: no hay ningún admin en user_profiles; no se ha tocado nada.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- El producto de Cardmarket: la pasada de precios del occidental casa por
  -- él, así que sin él la de TCGdex se quedaría sin precio. Como corrección
  -- (la 885), que ninguna pasada lo vuelva a quitar.
  if v_principal.cm_id_product_propio is null and v_repetida.cm_id_product_propio is not null then
    insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
    values ('tcg_cards', 'mep-031', 'WEST', 'cm_id_product_propio', to_jsonb(v_repetida.cm_id_product_propio), null, v_admin, now())
    on conflict (tabla, id, market, columna) do update set valor = excluded.valor, updated_at = now();
    update public.tcg_cards set cm_id_product_propio = v_repetida.cm_id_product_propio where id = 'mep-031' and market = 'WEST';
    raise notice 'Zekrom de N: mep-031 lleva ahora el producto de Cardmarket %.', v_repetida.cm_id_product_propio;
  end if;
  -- El precio de hoy, si la de TCGdex no tenía: hasta la pasada siguiente.
  if not exists (select 1 from public.tcg_card_prices where card_id = 'mep-031')
     and exists (select 1 from public.tcg_card_prices where card_id = 'tcggo-33636') then
    update public.tcg_card_prices set card_id = 'mep-031' where card_id = 'tcggo-33636';
    raise notice 'Zekrom de N: el precio de tcggo-33636 pasa a mep-031.';
  end if;

  v_r := public.catalogo_repetida_resolver('tcggo-33636', 'mep-031', 'WEST', 'misma');
  raise notice 'Zekrom de N: tcggo-33636 juntada en mep-031 (hecha %, versiones mudadas %, copias en mep-031 %). Se deshace desde /admin → Colecciones → Posibles repetidas → Hechas.',
    v_r->>'hecha', v_r->>'versiones_movidas', v_r->>'copias';

  -- Su `tcggo_id` (el de la que se ha ido), si no tenía: es la misma carta de
  -- TCGGO y así la reconocen las pasadas que miran por él.
  if v_principal.tcggo_id is null and v_repetida.tcggo_id is not null
     and not exists (select 1 from public.tcg_cards where market = 'WEST' and tcggo_id = v_repetida.tcggo_id) then
    update public.tcg_cards set tcggo_id = v_repetida.tcggo_id where id = 'mep-031' and market = 'WEST';
  end if;
end
$$;

notify pgrst, 'reload schema';

-- Lo que queda, para mirarlo: una sola MEP 031, con Holo y la de Pokémon
-- Center.
select c.id, c.local_id, c.name, c.variants, c.cm_id_product_propio, c.tcggo_id,
       (select jsonb_agg(jsonb_build_object('tcggo_id', v.tcggo_id, 'etiqueta', v.etiqueta, 'clase', v.clase, 'origen', v.origen) order by v.tcggo_id)
          from public.tcg_card_versions v where v.card_id = c.id and v.market = c.market) as versiones
from public.tcg_cards c
where c.market = 'WEST' and lower(c.set_id) = 'mep' and ltrim(c.local_id, '0') = '31';
