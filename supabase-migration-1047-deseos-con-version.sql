-- Tanda 1047 — «La quiero» con versión.
--
-- Un foro: «cuando doy al corazón para tenerlo en la lista de deseos, no
-- puedo seleccionar si quiero la variante holo o normal». El corazón
-- preguntaba el idioma (771) y apuntaba la carta en CUALQUIER versión, así
-- que quien buscaba la Chikorita Holo del McDonald's 2021 se cruzaba con
-- todo el que tenía la normal. Ahora el deseo guarda su versión
-- (`variante`, vacía = cualquiera) y los cruces la respetan, igual que el
-- idioma: «cualquiera» casa con todo, una versión solo con esa. Una copia
-- sin versión (`null`) es la «normal», como en la web.
--
-- Se puede ejecutar dos veces. Lo que cambia, además de la columna:
--   1. la regla de «no repetir» cuenta la versión (la Holo y la Normal son
--      dos deseos);
--   2. quién tiene lo que buscas y quién busca lo que das;
--   3. el Mercado con «Solo las que busco»;
--   4. el aviso de «alguien da una carta que buscas»;
--   5. al cerrar un cambio, solo se tacha el deseo de esa versión;
--   6. juntar repetidas en /admin deja los deseos con su versión, y
--      deshacer los devuelve como estaban.
-- Las funciones son las de antes con la condición de la versión al lado de
-- la del idioma; nada más cambia (mismos parámetros, mismas columnas, así
-- que los permisos se quedan).

-- ── 1. La columna, su forma y la regla de no repetir ──
alter table public.user_wants add column if not exists variante text;

-- Los mismos ids que `user_collection.variante` (normal, holo, reverse,
-- primera, quick-ball…).
alter table public.user_wants drop constraint if exists user_wants_variante;
alter table public.user_wants add constraint user_wants_variante
  check (variante is null or (variante ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(variante) <= 40));

-- `coalesce(variante, '*')` por lo mismo que el idioma (376): en un índice
-- único los NULL no chocan, y «cualquier versión» se podría apuntar cien
-- veces.
drop index if exists public.user_wants_unico;
create unique index user_wants_unico
  on public.user_wants (user_id, card_id, coalesce(idioma, '*'), coalesce(variante, '*'));

-- ── 2. Los cruces: quién tiene lo que buscas y quién busca lo que das ──
-- (los de supabase-migration-rangos-intercambios.sql con la versión).
create or replace function public.intercambios_quien_tiene(p_limite int default 200)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_moderator boolean,
  card_id text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int,
  prioridad int,
  reciproco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select auth.uid() as id),
  -- Lo que yo doy, para saber si la otra persona busca algo mío.
  mias as (
    select c.card_id, c.idioma, c.variante
    from public.user_collection c, yo
    where c.user_id = yo.id and c.cambio > 0
  )
  select
    c.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_moderator, false),
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_wants w2
      join mias m on m.card_id = w2.card_id and (w2.idioma is null or w2.idioma = m.idioma)
                 and (w2.variante is null or w2.variante = coalesce(m.variante, 'normal'))
      where w2.user_id = c.user_id
    ) as reciproco
  from public.user_wants w
  join yo on w.user_id = yo.id
  join public.user_collection c
    on c.card_id = w.card_id
   and c.cambio > 0
   and c.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = c.user_id
  where not coalesce(p.is_banned, false)
  -- Lo recíproco primero: es lo único que se cierra de un mensaje.
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;
create or replace function public.intercambios_quien_busca(p_limite int default 200)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_moderator boolean,
  card_id text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int,
  prioridad int,
  reciproco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select auth.uid() as id),
  -- Lo que yo busco, para saber si la otra persona da algo que quiero.
  busco as (select w.card_id, w.idioma, w.variante from public.user_wants w, yo where w.user_id = yo.id)
  select
    w.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_moderator, false),
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_collection c2
      join busco b on b.card_id = c2.card_id and (b.idioma is null or b.idioma = c2.idioma)
                  and (b.variante is null or b.variante = coalesce(c2.variante, 'normal'))
      where c2.user_id = w.user_id and c2.cambio > 0
    ) as reciproco
  from public.user_collection c
  join yo on c.user_id = yo.id
  join public.user_wants w
    on w.card_id = c.card_id
   and w.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = w.user_id
  where c.cambio > 0 and not coalesce(p.is_banned, false)
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- ── 3. El Mercado: «Solo las que busco» (supabase-migration-mercado.sql) ──
create or replace function public.intercambios_mercado(
  p_market text default 'WEST',
  p_idioma text default null,
  p_texto text default null,
  p_sets text[] default null,
  p_solo_mias boolean default false,
  p_orden text default 'nuevo',
  p_limite int default 60,
  p_desde int default 0
)
returns table (
  card_id text,
  market text,
  personas int,
  copias int,
  idiomas text[],
  dan uuid[],
  gente jsonb,
  ultima timestamptz,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with dan as (
    select c.card_id, c.market, c.user_id, c.idioma, c.cambio, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where c.cambio > 0
      and c.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and c.user_id is distinct from auth.uid()
      and (p_idioma is null or c.idioma = p_idioma)
      -- El texto llega ya normalizado (minúsculas, sin acentos), que es
      -- como está `name_search`, columna generada.
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.set_id = any (p_sets)))
      -- «Solo las que busco»: con la misma regla de idioma que los cruces
      -- (un deseo sin idioma vale cualquiera).
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = c.card_id
          and (w.idioma is null or w.idioma = c.idioma)
          and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))))
  ),
  -- Una persona puede dar la misma carta en dos líneas (en dos idiomas):
  -- en los avatares sale una vez.
  por_persona as (
    select d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url,
           d.is_admin, d.is_moderator, max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url, d.is_admin, d.is_moderator
  ),
  por_carta as (
    select d.card_id, d.market,
           count(distinct d.user_id)::int as personas,
           sum(d.cambio)::int as copias,
           array_agg(distinct d.idioma order by d.idioma) as idiomas,
           max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market
  )
  select pc.card_id, pc.market, pc.personas, pc.copias, pc.idiomas,
         (select array_agg(pp.user_id order by pp.ultima desc)
            from por_persona pp where pp.card_id = pc.card_id and pp.market = pc.market) as dan,
         (select jsonb_agg(jsonb_build_object(
                   'user_id', s.user_id, 'username', s.username, 'display_name', s.display_name,
                   'avatar_url', s.avatar_url, 'is_admin', s.is_admin, 'is_moderator', s.is_moderator)
                 order by s.ultima desc)
            from (select * from por_persona pp
                  where pp.card_id = pc.card_id and pp.market = pc.market
                  order by pp.ultima desc limit 5) s) as gente,
         pc.ultima,
         count(*) over () as total
  from por_carta pc
  left join public.tcg_card_prices pr on pr.card_id = pc.card_id
  order by
    case when p_orden = 'gente' then pc.personas end desc nulls last,
    case when p_orden = 'caro' then coalesce(pr.cm_low, pr.cm_trend) end desc nulls last,
    pc.ultima desc,
    pc.card_id
  limit greatest(1, least(coalesce(p_limite, 60), 200))
  offset greatest(0, coalesce(p_desde, 0));
$$;

-- ── 4. El aviso de «alguien da una carta que buscas» (cambios-seguidos) ──
create or replace function public.intercambios_avisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_quien text;
begin
  if coalesce(new.cambio, 0) <= 0 or coalesce(old.cambio, 0) > 0 then
    return new;
  end if;

  select coalesce(name_es, name) into v_nombre from public.tcg_cards where id = new.card_id;
  select username into v_quien from public.user_profiles where id = new.user_id;

  insert into public.user_notifications (recipient_id, type, title, body, link)
  select d.user_id,
         case when d.sigue then 'trade_match_seguido' else 'trade_match' end,
         case when d.sigue and v_quien is not null then '@' || v_quien || ', a quien sigues, da una carta que buscas'
              else 'Alguien da una carta que buscas' end,
         d.nombre,
         '/mi-coleccion?ver=cambios'
    from (
      select distinct on (w.user_id)
             w.user_id,
             w.prioridad,
             w.created_at,
             coalesce(v_nombre, new.card_id) as nombre,
             exists (select 1 from public.user_follows f where f.follower_id = w.user_id and f.following_id = new.user_id) as sigue,
             coalesce(u.notification_prefs_disabled, '{}') as apagados
        from public.user_wants w
        join public.user_profiles u on u.id = w.user_id
       where w.card_id = new.card_id
         and w.user_id <> new.user_id
         and (w.idioma is null or w.idioma = new.idioma)
         and (w.variante is null or w.variante = coalesce(new.variante, 'normal'))
         and coalesce(u.is_banned, false) = false
         and not exists (
           select 1 from public.user_notifications n
            where n.recipient_id = w.user_id
              and n.type in ('trade_match', 'trade_match_seguido')
              and n.read_at is null
              and n.body = coalesce(v_nombre, new.card_id)
         )
       order by w.user_id, w.prioridad desc, w.created_at
    ) d
   -- Cada uno con SU preferencia: quien apagó el de los que sigue sigue
   -- recibiendo el general de los demás, y al revés.
   where not (d.apagados @> array[case when d.sigue then 'trade_match_seguido' else 'trade_match' end])
   -- Los que siguen a quien la da, primero; luego los que más la buscan.
   order by d.sigue desc, d.prioridad desc, d.created_at
   limit 25;

  return new;
end;
$$;

-- ── 5. Al cerrar un cambio, el deseo que se cumple (942): solo el de esa versión ──
create or replace function public.cambio_mover(p_oferta uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.trade_offers;
  it public.trade_offer_items;
  l public.user_collection;
  dest public.user_collection;
  v_rec uuid;
  n int;
  v_nueva uuid;
  v_deseos jsonb;
  hecho jsonb := '[]'::jsonb;
begin
  select * into o from public.trade_offers where id = p_oferta;
  for it in select * from public.trade_offer_items where oferta = o.id order by id loop
    v_rec := case when it.quien = o.de then o.para else o.de end;
    n := it.cantidad;
    select * into l from public.user_collection where id = it.linea and user_id = it.quien for update;
    if l.id is null then
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'faltaba', 'card_id', it.card_id, 'quien', it.quien));
    else
      n := least(n, l.cantidad);
      if l.cantidad - n <= 0 then
        hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'borrada', 'fila', to_jsonb(l)));
        delete from public.user_collection where id = l.id;
      else
        hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'restada', 'id', l.id, 'n', n, 'cambio', l.cambio));
        update public.user_collection
        set cantidad = cantidad - n, cambio = greatest(0, least(cambio - n, cantidad - n))
        where id = l.id;
      end if;
    end if;
    select * into dest from public.user_collection
    where user_id = v_rec and card_id = it.card_id and market = it.market and idioma = it.idioma
      and estado = it.estado and variante = it.variante and gradeo is not distinct from it.gradeo
    order by created_at
    limit 1
    for update;
    if dest.id is not null then
      update public.user_collection set cantidad = least(999, cantidad + n) where id = dest.id;
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'sumada', 'id', dest.id, 'n', n));
    else
      insert into public.user_collection (user_id, card_id, market, idioma, estado, variante, gradeo, cantidad)
      values (v_rec, it.card_id, it.market, it.idioma, it.estado, it.variante, it.gradeo, n)
      returning id into v_nueva;
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'creada', 'id', v_nueva));
    end if;
    -- Lo que buscaba quien la recibe, tachado (en cualquier idioma o en ese, y
    -- en cualquier versión o en esa: 1047).
    with fuera as (
      delete from public.user_wants
      where user_id = v_rec and card_id = it.card_id and (idioma is null or idioma = it.idioma)
        and (variante is null or variante = coalesce(it.variante, 'normal'))
      returning *
    )
    select coalesce(jsonb_agg(jsonb_build_object('op', 'deseo', 'fila', to_jsonb(fuera))), '[]'::jsonb) into v_deseos from fuera;
    hecho := hecho || v_deseos;
  end loop;
  return hecho;
end
$$;

-- ── 6. Juntar repetidas en /admin (996): los deseos pasan con su versión ──
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
  v_movidas int := 0;
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
    (select jsonb_agg(jsonb_build_object('id', w.id::text, 'variante', w.variante)) from public.user_wants w where w.card_id = p_carta
       and not exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*')
         and coalesce(o.variante, '*') = coalesce(case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end, '*'))),
    (select jsonb_agg(to_jsonb(w)) from public.user_wants w where w.card_id = p_carta
       and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*')
         and coalesce(o.variante, '*') = coalesce(case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end, '*'))),
    (select jsonb_agg(a.id::text) from public.user_price_alerts a where a.card_id = p_carta and a.market = p_market),
    (select jsonb_agg(jsonb_build_object('user_id', s.user_id::text, 'posicion', s.posicion)) from public.user_showcase s where s.card_id = p_carta and s.market = p_market),
    (select jsonb_agg(jsonb_build_object('id', a.id::text, 'pos', (
        select jsonb_agg(n) from jsonb_array_elements(a.cartas) with ordinality as x(e, n) where e->>'id' = p_carta)))
       from public.user_albums a where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_carta))),
    auth.uid())
  returning id into v_hecha;
  -- Sus versiones, tal cual (996): se mudan a la principal y, al deshacer,
  -- vuelven de aquí.
  update public.tcg_repetidas_hechas
     set versiones = (select jsonb_agg(to_jsonb(v)) from public.tcg_card_versions v where v.card_id = p_carta and v.market = p_market)
   where id = v_hecha;

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
  -- Un deseo de la repetida pasa a la principal EN SU VERSIÓN (1047): quien
  -- quería la Chikorita Holo suelta quiere la Chikorita en «Holo».
  delete from public.user_wants w
   where w.card_id = p_carta
     and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*')
         and coalesce(o.variante, '*') = coalesce(case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end, '*'));
  update public.user_wants w set card_id = p_destino, variante = case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end where w.card_id = p_carta;
  update public.user_price_alerts set card_id = p_destino where card_id = p_carta and market = p_market;
  update public.user_showcase set card_id = p_destino where card_id = p_carta and market = p_market;
  update public.user_albums a set cartas = (
    select coalesce(jsonb_agg(case when e->>'id' = p_carta then jsonb_set(e, '{id}', to_jsonb(p_destino)) else e end order by n), '[]'::jsonb)
      from jsonb_array_elements(a.cartas) with ordinality as x(e, n))
   where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_carta));

  delete from public.tcg_card_prices where card_id = p_carta;
  delete from public.tcg_card_history where card_id = p_carta;
  -- Las versiones de la repetida se MUDAN a la principal (996): eran las
  -- que PINGU le había puesto a mano al Mewtwo ex SVP 205 de TCGGO, y
  -- borrarlas las perdía. Solo se queda atrás (y se va) la que repite una que
  -- la principal ya tiene.
  update public.tcg_card_versions v set card_id = p_destino, set_id = v_d.set_id
   where v.card_id = p_carta and v.market = p_market
     and not exists (select 1 from public.tcg_card_versions o
                      where o.card_id = p_destino and o.market = p_market
                        and public.catalogo_variante_de_etiqueta(o.etiqueta) = public.catalogo_variante_de_etiqueta(v.etiqueta));
  get diagnostics v_movidas = row_count;
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
  return jsonb_build_object('hecha', v_hecha, 'version', v_version, 'variante', v_var, 'creada', v_creada, 'lapidas', to_jsonb(v_lapidas), 'versiones_movidas', v_movidas,
    'copias', (select count(*) from public.user_collection where card_id = p_destino and market = p_market and (v_var is null or variante = v_var)));
end;
$$;

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

  -- Sus versiones (996): las que se mudaron salen de la principal y vuelven
  -- todas a la repetida, como estaban.
  if h.versiones is not null and jsonb_array_length(h.versiones) > 0 then
    delete from public.tcg_card_versions v
     where v.market = h.market and v.card_id = h.destino
       and v.tcggo_id in (select (e->>'tcggo_id')::int from jsonb_array_elements(h.versiones) e);
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'tcg_card_versions' and is_generated = 'NEVER';
    execute format('insert into public.tcg_card_versions (%1$s) select %1$s from jsonb_populate_recordset(null::public.tcg_card_versions, $1) on conflict do nothing', v_cols) using h.versiones;
  end if;

  -- Lo apuntado vuelve, y solo lo que sigue donde se dejó.
  update public.user_collection u set card_id = h.carta, variante = x.variante
    from jsonb_to_recordset(coalesce(h.coleccion, '[]'::jsonb)) as x(id text, variante text)
   where u.id::text = x.id and u.card_id = h.destino and u.market = h.market;
  -- Los deseos vuelven con la versión que tenían (1047); lo apuntado antes de
  -- la 1047 es una lista de ids y deja la versión como esté.
  update public.user_wants w set card_id = h.carta, variante = case when x.trae then x.variante else w.variante end
    from (select case when jsonb_typeof(e) = 'object' then e->>'id' else e #>> '{}' end as id,
                 jsonb_typeof(e) = 'object' as trae, e->>'variante' as variante
            from jsonb_array_elements(coalesce(h.deseos, '[]'::jsonb)) e) x
   where w.id::text = x.id and w.card_id = h.destino;
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

notify pgrst, 'reload schema';

-- Para ver que ha ido: la columna existe y cuántos deseos tienen versión
-- (cero al ejecutarla la primera vez: los de antes son «cualquiera»).
select 'user_wants.variante' as que,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'user_wants' and column_name = 'variante') as existe,
       (select count(*) from public.user_wants where variante is not null) as deseos_con_version;
