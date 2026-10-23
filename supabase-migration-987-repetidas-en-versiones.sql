-- ============================================================
-- Tanda 987: las cartas repetidas de TCGGO, convertidas en versiones.
--
-- PINGU, con el N's Darmanitan SVP 181 dos veces en las promos: «una es la
-- promo normal y la otra es la promo staff… ¿no es mejor traernos solamente
-- una y meterle dos variantes?», y «que en el panel de admin tenga algún
-- aviso por cada carta que salga como repetida y yo elija». Eligió lo
-- recomendado: la lista propone y él decide; una Staff o una Prerelease es un
-- SELLO (no cuenta para completar la expansión); la principal es la que ya
-- teníamos.
--
-- Por qué pasa: en Cardmarket la Staff es OTRO producto, TCGGO lista cada
-- producto como una carta (mismo nombre, mismo número) y el catálogo (640)
-- crea lo que no casa. Es la forma de la 945 (las Poké Ball de Black Bolt),
-- pero sin una migración por set.
--
--  1. `catalogo_posibles_repetidas`: las cartas de la MISMA colección con el
--     mismo número (cada tramo de dígitos sin sus ceros, como
--     `numeroComparable`) y el mismo nombre, en grupos, con lo que hace falta
--     para decidir (fotos, PS, ataques, ilustrador, producto, precio, quién
--     las tiene). Sin las colecciones escondidas ni lo marcado «distintas».
--  2. `catalogo_repetida_resolver`: «versión» crea en la principal una fila
--     `tcg_card_versions` con `origen = 'fundida'` (su foto, su producto de
--     Cardmarket y el precio que tenía; la pasada de precios la sigue por su
--     producto), pasa a ella lo que la gente tenía apuntado en la repetida
--     (las copias, con la versión nueva) y borra la repetida dejando LÁPIDA
--     (la 934) para su id y para el `tcggo-<id>` que la volvería a crear.
--     «misma» hace lo mismo sin versión. Todo queda en `tcg_repetidas_hechas`.
--  3. `catalogo_repetida_deshacer`: vuelve a poner la carta, su precio, sus
--     correcciones y lo apuntado donde estaba, y quita la versión si nadie
--     más la usa. El histórico de precios de la repetida no vuelve.
--  4. `catalogo_repetidas_distintas`: «son distintas» (y quitarlo). Se guarda
--     con los ids del grupo: si aparece otra carta en él, vuelve a salir.
--
-- Y la forma del Play! Pokémon Prize Pack: la normal y la holo son dos
-- productos, así que «Holo», «Normal» y «Reverse Holo» también valen como
-- nombre (impresiones, cuentan para completar).
--
-- Va DESPUÉS de la 934 (la lápida, la secuencia de ids negativos y
-- `catalogo_id_de_version`) y de la 935 (la columna `origen` de las
-- versiones se usa con `in.(…)` en la pasada de precios). Se puede ejecutar
-- dos veces.
-- ============================================================
begin;

-- ── 0. El origen nuevo y las tablas ──
-- La regla de orígenes de la 935 y la 945 no dejaba escribir «fundida»
-- (PINGU, la primera vez: «violates check constraint
-- tcg_card_versions_origen_ok»). La llamada falla entera, así que no quedó
-- nada a medias.
alter table public.tcg_card_versions drop constraint if exists tcg_card_versions_origen_ok;
alter table public.tcg_card_versions add constraint tcg_card_versions_origen_ok
  check (origen is null or origen in ('mano', 'edicion', 'foto', 'tcgdex', 'fundida'));

create table if not exists public.tcg_repetidas_distintas (
  market text not null,
  set_id text not null,
  numero text not null,
  nombre text not null,
  ids text[] not null,
  autor uuid,
  creado_at timestamptz not null default now(),
  primary key (market, set_id, numero, nombre)
);

create table if not exists public.tcg_repetidas_hechas (
  id bigserial primary key,
  market text not null,
  carta text not null,
  destino text not null,
  decision text not null check (decision in ('version', 'misma')),
  etiqueta text,
  version_id int,
  version_creada boolean not null default false,
  fila jsonb not null,
  precio jsonb,
  correcciones jsonb,
  coleccion jsonb,
  deseos jsonb,
  deseos_borrados jsonb,
  avisos jsonb,
  vitrina jsonb,
  albumes jsonb,
  lapidas text[] not null default '{}',
  autor uuid,
  hecha_at timestamptz not null default now(),
  deshecha_at timestamptz
);

-- Solo el admin las lee (el panel); escriben las funciones de abajo. La
-- política de lectura va aquí mismo (la 510: sin ella el panel leería cero).
alter table public.tcg_repetidas_distintas enable row level security;
alter table public.tcg_repetidas_hechas enable row level security;
drop policy if exists "repetidas_distintas_admin" on public.tcg_repetidas_distintas;
create policy "repetidas_distintas_admin" on public.tcg_repetidas_distintas
  for select to authenticated using (public.is_admin());
drop policy if exists "repetidas_hechas_admin" on public.tcg_repetidas_hechas;
create policy "repetidas_hechas_admin" on public.tcg_repetidas_hechas
  for select to authenticated using (public.is_admin());

-- Cada tramo de dígitos sin sus ceros de delante: «060» → «60», «TG01» →
-- «tg1». Es `numeroComparable` (netlify/lib/scrydex.mjs).
create or replace function public.catalogo_numero_comparable(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p, ''))), '(^|[^0-9])0+([0-9])', '\1\2', 'g')
$$;

-- El id con el que la web apunta una versión (`varianteDeEtiqueta` en
-- js/mi-coleccion/variantes.js): «Reverse Holo» es `reverse` y «Holofoil»,
-- `holo`; lo demás, como `catalogo_id_de_version`.
create or replace function public.catalogo_variante_de_etiqueta(p text)
returns text
language sql
immutable
as $$
  select case v when 'reverse-holo' then 'reverse' when 'reverse-holofoil' then 'reverse' when 'holofoil' then 'holo' else v end
    from (select public.catalogo_id_de_version(p) as v) x
$$;

-- ── 1. Las posibles repetidas ──
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
    select c.*, public.catalogo_numero_comparable(c.local_id) as n, public.immutable_unaccent(lower(trim(c.name))) as k
      from public.tcg_cards c
      join public.tcg_sets s on s.id = c.set_id and s.market = c.market
     where (p_market is null or c.market = p_market)
       and not coalesce(s.oculto, false)
       and trim(coalesce(c.local_id, '')) <> ''
  ), g as (
    select market, set_id, n, k, array_agg(id order by id) as ids
      from c group by market, set_id, n, k having count(*) > 1
  ), vivos as (
    select g.* from g
     where not exists (
       select 1 from public.tcg_repetidas_distintas d
        where d.market = g.market and d.set_id = g.set_id and d.numero = g.n and d.nombre = g.k and g.ids <@ d.ids)
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
            from c where c.market = e.market and c.set_id = e.set_id and c.n = e.n and c.k = e.k)
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

-- ── 2. Resolver una: versión o la misma carta ──
create or replace function public.catalogo_repetida_resolver(
  p_carta text,
  p_destino text,
  p_market text,
  p_decision text,
  p_etiqueta text default null,
  p_clase text default 'sello',
  p_imagen text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.tcg_cards%rowtype;
  v_d public.tcg_cards%rowtype;
  v_etiqueta text := nullif(trim(coalesce(p_etiqueta, '')), '');
  v_var text;
  v_clase text := coalesce(nullif(p_clase, ''), 'sello');
  v_precio jsonb;
  v_version int;
  v_creada boolean := false;
  v_lapidas text[] := '{}';
  v_hecha bigint;
  v_tcggo text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_decision not in ('version', 'misma') then
    raise exception 'La decisión es «version» o «misma».' using errcode = '22023';
  end if;
  if p_carta = p_destino then
    raise exception 'Una carta no puede ser versión de sí misma.' using errcode = '22023';
  end if;
  select * into v_c from public.tcg_cards where id = p_carta and market = p_market for update;
  if not found then
    raise exception 'No existe la carta % (%).', p_carta, p_market using errcode = 'P0002';
  end if;
  select * into v_d from public.tcg_cards where id = p_destino and market = p_market;
  if not found then
    raise exception 'No existe la carta % (%).', p_destino, p_market using errcode = 'P0002';
  end if;
  if v_c.set_id is distinct from v_d.set_id then
    raise exception 'Las dos cartas tienen que ser de la misma colección.' using errcode = '22023';
  end if;
  if p_decision = 'version' then
    if v_etiqueta is null then
      raise exception 'La versión necesita un nombre.' using errcode = '22023';
    end if;
    -- Holo, Normal y Reverse valen: en el Prize Pack la normal y la holo son
    -- dos productos de Cardmarket y TCGGO las da como dos cartas. Esas son
    -- impresiones (cuentan). La «Standard» de TCGGO (la carta misma) y las
    -- ediciones de Wizards (la 935) no se crean aquí.
    if public.catalogo_id_de_version(v_etiqueta) in ('standard', '1st-edition', 'first-edition', 'primera', 'primera-edicion') then
      raise exception 'Ese nombre no vale para una versión de aquí (p. ej. «Staff» u «Holo»).' using errcode = '22023';
    end if;
    v_var := public.catalogo_variante_de_etiqueta(v_etiqueta);
    if v_var = '' then
      raise exception 'La versión necesita un nombre.' using errcode = '22023';
    end if;
    if v_var in ('normal', 'holo', 'reverse') then
      v_clase := 'impresion';
    end if;
    if v_clase not in ('impresion', 'sello', 'adicional') then
      raise exception 'La clase es impresion, sello o adicional.' using errcode = '22023';
    end if;
  end if;

  select to_jsonb(p) into v_precio from public.tcg_card_prices p where p.card_id = p_carta;

  -- Lo apuntado, ANTES de moverlo: es lo que se deshace.
  insert into public.tcg_repetidas_hechas (market, carta, destino, decision, etiqueta, fila, precio, correcciones, coleccion, deseos, deseos_borrados, avisos, vitrina, albumes, autor)
  values (p_market, p_carta, p_destino, p_decision, v_etiqueta, to_jsonb(v_c), v_precio,
    (select jsonb_agg(to_jsonb(x)) from public.tcg_correcciones x where x.tabla = 'tcg_cards' and x.id = p_carta and x.market = p_market),
    (select jsonb_agg(jsonb_build_object('id', u.id::text, 'variante', u.variante)) from public.user_collection u where u.card_id = p_carta and u.market = p_market),
    (select jsonb_agg(w.id::text) from public.user_wants w where w.card_id = p_carta
       and not exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'))),
    (select jsonb_agg(to_jsonb(w)) from public.user_wants w where w.card_id = p_carta
       and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'))),
    (select jsonb_agg(a.id::text) from public.user_price_alerts a where a.card_id = p_carta and a.market = p_market),
    (select jsonb_agg(jsonb_build_object('user_id', s.user_id::text, 'posicion', s.posicion)) from public.user_showcase s where s.card_id = p_carta and s.market = p_market),
    (select jsonb_agg(jsonb_build_object('id', a.id::text, 'pos', (
        select jsonb_agg(n) from jsonb_array_elements(a.cartas) with ordinality as x(e, n) where e->>'id' = p_carta)))
       from public.user_albums a where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_carta))),
    auth.uid())
  returning id into v_hecha;

  -- La versión: la que ya tenga la principal con ese nombre, o una nueva
  -- con id negativo (la secuencia de la 934: ninguna pasada los escribe).
  if p_decision = 'version' then
    select tcggo_id into v_version from public.tcg_card_versions
     where card_id = p_destino and market = p_market and public.catalogo_variante_de_etiqueta(etiqueta) = v_var
     order by tcggo_id limit 1;
    if v_version is null then
      v_version := -nextval('public.tcg_card_versions_mano_seq')::int;
      v_creada := true;
      insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, nombre, etiqueta, imagen, clase, origen,
        cm_id_product, cm_low, cm_low_en, cm_low_de, cm_low_fr, cm_low_es, cm_low_it, cm_avg7, cm_avg30, cm_disponibles, tp_market_eur, tp_mid_eur, actualizado_at)
      values (v_version, p_market, p_destino, v_d.set_id, v_c.local_id, v_d.name, v_etiqueta, nullif(trim(coalesce(p_imagen, '')), ''), v_clase, 'fundida',
        coalesce(v_c.cm_id_product_propio, (v_precio->>'cm_id_product')::int),
        (v_precio->>'cm_low')::numeric, (v_precio->>'cm_low_en')::numeric, (v_precio->>'cm_low_de')::numeric, (v_precio->>'cm_low_fr')::numeric,
        (v_precio->>'cm_low_es')::numeric, (v_precio->>'cm_low_it')::numeric, (v_precio->>'cm_avg7')::numeric, (v_precio->>'cm_avg30')::numeric,
        (v_precio->>'cm_disponibles')::int, (v_precio->>'tp_market_eur')::numeric, (v_precio->>'tp_mid_eur')::numeric, now());
    end if;
    update public.user_collection set card_id = p_destino, variante = v_var where card_id = p_carta and market = p_market;
  else
    update public.user_collection set card_id = p_destino where card_id = p_carta and market = p_market;
  end if;

  -- Lo demás, como `catalogo_borrar_carta` (934), pero sin salirse del
  -- catálogo: el japonés y el occidental pueden compartir ids.
  delete from public.user_wants w
   where w.card_id = p_carta
     and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'));
  update public.user_wants set card_id = p_destino where card_id = p_carta;
  update public.user_price_alerts set card_id = p_destino where card_id = p_carta and market = p_market;
  update public.user_showcase set card_id = p_destino where card_id = p_carta and market = p_market;
  update public.user_albums a set cartas = (
    select coalesce(jsonb_agg(case when e->>'id' = p_carta then jsonb_set(e, '{id}', to_jsonb(p_destino)) else e end order by n), '[]'::jsonb)
      from jsonb_array_elements(a.cartas) with ordinality as x(e, n))
   where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_carta));

  delete from public.tcg_card_prices where card_id = p_carta;
  delete from public.tcg_card_history where card_id = p_carta;
  delete from public.tcg_card_versions where card_id = p_carta and market = p_market;
  delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = p_carta and market = p_market;

  -- Las lápidas: la repetida no vuelve por la pasada que la trajo. Si era de
  -- TCGdex y la de TCGGO casaba con ella, sin ella esa nacería como
  -- `tcggo-<id>`: también lleva la suya.
  if v_c.origen is distinct from 'mano' then
    v_lapidas := array_append(v_lapidas, p_carta);
  end if;
  if v_c.tcggo_id is not null then
    v_tcggo := 'tcggo-' || v_c.tcggo_id;
    if v_tcggo <> p_carta and not exists (select 1 from public.tcg_cards where id = v_tcggo and market = p_market) then
      v_lapidas := array_append(v_lapidas, v_tcggo);
    end if;
  end if;
  insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
  select 'tcg_cards', l, p_market, '__borrada', 'true'::jsonb, null, auth.uid(), now() from unnest(v_lapidas) l
  on conflict (tabla, id, market, columna) do update set updated_at = now();

  delete from public.tcg_cards where id = p_carta and market = p_market;

  update public.tcg_repetidas_hechas set version_id = v_version, version_creada = v_creada, lapidas = v_lapidas where id = v_hecha;
  return jsonb_build_object('hecha', v_hecha, 'version', v_version, 'variante', v_var, 'creada', v_creada, 'lapidas', to_jsonb(v_lapidas),
    'copias', (select count(*) from public.user_collection where card_id = p_destino and market = p_market and (v_var is null or variante = v_var)));
end;
$$;

revoke all on function public.catalogo_repetida_resolver(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.catalogo_repetida_resolver(text, text, text, text, text, text, text) to authenticated, service_role;

-- ── 3. Deshacer ──
create or replace function public.catalogo_repetida_deshacer(p_hecha bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.tcg_repetidas_hechas%rowtype;
  v_cols text;
  v_var text;
  v_quita boolean := false;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select * into h from public.tcg_repetidas_hechas where id = p_hecha for update;
  if not found then
    raise exception 'No hay nada hecho con ese número.' using errcode = 'P0002';
  end if;
  if h.deshecha_at is not null then
    raise exception 'Eso ya se deshizo.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tcg_cards where id = h.carta and market = h.market) then
    raise exception 'La carta % ya vuelve a estar en el catálogo.', h.carta using errcode = '23505';
  end if;

  delete from public.tcg_correcciones where tabla = 'tcg_cards' and market = h.market and columna = '__borrada' and id = any(h.lapidas);

  -- Las correcciones primero: el disparador de la 885 las pone encima de la
  -- carta al volver a escribirla.
  if h.correcciones is not null then
    insert into public.tcg_correcciones select * from jsonb_populate_recordset(null::public.tcg_correcciones, h.correcciones)
    on conflict (tabla, id, market, columna) do nothing;
  end if;
  -- La carta, tal cual estaba, sin las columnas que calcula la base (las
  -- generadas no se pueden escribir).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'tcg_cards' and is_generated = 'NEVER';
  execute format('insert into public.tcg_cards (%1$s) select %1$s from jsonb_populate_record(null::public.tcg_cards, $1)', v_cols) using h.fila;
  if h.precio is not null then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'tcg_card_prices' and is_generated = 'NEVER';
    execute format('insert into public.tcg_card_prices (%1$s) select %1$s from jsonb_populate_record(null::public.tcg_card_prices, $1) on conflict (card_id) do nothing', v_cols) using h.precio;
  end if;

  -- Lo apuntado vuelve, y solo lo que sigue donde se dejó.
  update public.user_collection u set card_id = h.carta, variante = x.variante
    from jsonb_to_recordset(coalesce(h.coleccion, '[]'::jsonb)) as x(id text, variante text)
   where u.id::text = x.id and u.card_id = h.destino and u.market = h.market;
  update public.user_wants set card_id = h.carta
   where id::text in (select jsonb_array_elements_text(coalesce(h.deseos, '[]'::jsonb))) and card_id = h.destino;
  if h.deseos_borrados is not null then
    insert into public.user_wants select * from jsonb_populate_recordset(null::public.user_wants, h.deseos_borrados) on conflict do nothing;
  end if;
  update public.user_price_alerts set card_id = h.carta
   where id::text in (select jsonb_array_elements_text(coalesce(h.avisos, '[]'::jsonb))) and card_id = h.destino;
  update public.user_showcase s set card_id = h.carta
    from jsonb_to_recordset(coalesce(h.vitrina, '[]'::jsonb)) as x(user_id text, posicion int)
   where s.user_id::text = x.user_id and s.posicion = x.posicion and s.card_id = h.destino;
  update public.user_albums a set cartas = (
    select coalesce(jsonb_agg(case when e->>'id' = h.destino and n in (select (jsonb_array_elements_text(x.pos))::bigint) then jsonb_set(e, '{id}', to_jsonb(h.carta)) else e end order by n), '[]'::jsonb)
      from jsonb_array_elements(a.cartas) with ordinality as y(e, n))
    from jsonb_to_recordset(coalesce(h.albumes, '[]'::jsonb)) as x(id text, pos jsonb)
   where a.id::text = x.id;

  -- La versión nueva se va si nadie más la ha apuntado mientras tanto.
  if h.decision = 'version' and h.version_creada and h.version_id is not null then
    v_var := public.catalogo_variante_de_etiqueta(h.etiqueta);
    if not exists (select 1 from public.user_collection where card_id = h.destino and market = h.market and variante = v_var) then
      delete from public.tcg_card_versions where tcggo_id = h.version_id and origen = 'fundida';
      v_quita := true;
    end if;
  end if;

  update public.tcg_repetidas_hechas set deshecha_at = now() where id = h.id;
  return jsonb_build_object('carta', h.carta, 'version_quitada', v_quita);
end;
$$;

revoke all on function public.catalogo_repetida_deshacer(bigint) from public, anon;
grant execute on function public.catalogo_repetida_deshacer(bigint) to authenticated, service_role;

-- ── 4. «Son distintas» ──
create or replace function public.catalogo_repetidas_distintas(
  p_market text,
  p_set text,
  p_numero text,
  p_nombre text,
  p_ids text[],
  p_quitar boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_quitar then
    delete from public.tcg_repetidas_distintas where market = p_market and set_id = p_set and numero = p_numero and nombre = p_nombre;
    return true;
  end if;
  if coalesce(array_length(p_ids, 1), 0) < 2 then
    raise exception 'Hacen falta las cartas del grupo.' using errcode = '22023';
  end if;
  insert into public.tcg_repetidas_distintas (market, set_id, numero, nombre, ids, autor)
  values (p_market, p_set, p_numero, p_nombre, p_ids, auth.uid())
  on conflict (market, set_id, numero, nombre) do update set ids = excluded.ids, autor = excluded.autor, creado_at = now();
  return true;
end;
$$;

revoke all on function public.catalogo_repetidas_distintas(text, text, text, text, text[], boolean) from public, anon;
grant execute on function public.catalogo_repetidas_distintas(text, text, text, text, text[], boolean) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
