-- Tanda 1109: lo que está en una propuesta en marcha sale del Mercado (PINGU:
-- «si una carta está en un cambio, si se ha propuesto algo, una venta, un
-- cambio, lo que sea, esa carta debería salir del mercado»).
--
-- Hasta aquí una copia solo contaba como reservada con el trato ACEPTADO, y
-- solo en la ficha de una carta («Reservada»). Ahora, desde que se propone:
--
--   1. `cambio_libres_de(linea, cambio, cantidad)`: las copias que esa línea
--      da y no están en una propuesta enviada o aceptada. Al cerrarse el trato
--      se mueven solas; si se rechaza, se anula o se cambia por otra, vuelven.
--   2. El Mercado (`mercado_con_tiendas`, `intercambios_mercado`), «quién la
--      da» (`intercambios_de_carta`), tus cruces (`intercambios_quien_tiene`)
--      y la pestaña Cambios del perfil (`intercambios_de_persona`) cuentan
--      solo esas: son las de su última migración (1079, 1047, rangos, 1047 y
--      887) con ese cambio y nada más.
--   3. `cambios_reservadas` cuenta también las propuestas enviadas.
--
-- `cambio_reservadas_linea` (la que usan proponer y aceptar) NO cambia: si
-- contara las enviadas, aceptar una propuesta chocaría con ella misma.
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 942, la 1047, la 887 y la 1079.
begin;

create index if not exists trade_offer_items_linea_idx on public.trade_offer_items (linea) where linea is not null;

create or replace function public.cambio_libres_de(p_linea uuid, p_cambio int, p_cantidad int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, least(coalesce(p_cambio, 0), coalesce(p_cantidad, 0) - coalesce((
    select sum(i.cantidad)
    from public.trade_offer_items i
    join public.trade_offers o on o.id = i.oferta
    where i.linea = p_linea and o.estado in ('enviada', 'aceptada')
  ), 0)))::int
$$;

-- El Mercado, con las tiendas (la de la 1079).
create or replace function public.mercado_con_tiendas(
  p_market text default 'WEST',
  p_idioma text default null,
  p_texto text default null,
  p_sets text[] default null,
  p_solo_mias boolean default false,
  p_orden text default 'nuevo',
  p_limite int default 60,
  p_desde int default 0,
  p_quien text default 'todos'
)
returns table (
  card_id text,
  market text,
  personas int,
  tiendas int,
  copias int,
  idiomas text[],
  dan uuid[],
  gente jsonb,
  desde numeric,
  ultima timestamptz,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with dan as (
    select c.card_id, c.market, c.user_id, c.idioma, public.cambio_libres_de(c.id, c.cambio, c.cantidad) as copias, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator,
           false as es_tienda, null::numeric as precio, null::text as ciudad
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where coalesce(p_quien, 'todos') <> 'tiendas'
      and c.cambio > 0
      and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
      and coalesce(p.tipo, 'persona') <> 'tienda'
      and c.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and c.user_id is distinct from auth.uid()
      and (p_idioma is null or c.idioma = p_idioma)
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.set_id = any (p_sets)))
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = c.card_id
          and (w.idioma is null or w.idioma = c.idioma)
          and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))))
    union all
    select s.card_id, s.market, s.tienda_id, s.idioma, s.unidades, s.updated_at,
           p.username, p.display_name, p.avatar_url, false, false,
           true, case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end, t.ciudad
    from public.tienda_stock s
    join public.user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda'
    left join public.tiendas t on t.user_id = s.tienda_id
    where coalesce(p_quien, 'todos') <> 'personas'
      and s.card_id is not null and s.visible and s.unidades > 0
      and s.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and s.tienda_id is distinct from auth.uid()
      and (p_idioma is null or s.idioma = p_idioma)
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards tc
        where tc.id = s.card_id and tc.market = s.market and tc.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards tc
        where tc.id = s.card_id and tc.market = s.market and tc.set_id = any (p_sets)))
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = s.card_id
          and (w.idioma is null or w.idioma = s.idioma)
          and (w.variante is null or w.variante = s.variante)))
  ),
  por_quien as (
    select d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url,
           d.is_admin, d.is_moderator, d.es_tienda, min(d.precio) as precio, d.ciudad, max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url, d.is_admin, d.is_moderator, d.es_tienda, d.ciudad
  ),
  por_carta as (
    select d.card_id, d.market,
           count(distinct d.user_id) filter (where not d.es_tienda)::int as personas,
           count(distinct d.user_id) filter (where d.es_tienda)::int as tiendas,
           sum(d.copias)::int as copias,
           array_agg(distinct d.idioma order by d.idioma) as idiomas,
           min(d.precio) as desde,
           max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market
  )
  select pc.card_id, pc.market, pc.personas, pc.tiendas, pc.copias, pc.idiomas,
         (select array_agg(pq.user_id order by pq.ultima desc)
            from por_quien pq where pq.card_id = pc.card_id and pq.market = pc.market and not pq.es_tienda) as dan,
         (select jsonb_agg(jsonb_build_object(
                   'user_id', s.user_id, 'username', s.username, 'display_name', s.display_name,
                   'avatar_url', s.avatar_url, 'is_admin', s.is_admin, 'is_moderator', s.is_moderator,
                   'tienda', s.es_tienda, 'precio', s.precio, 'ciudad', s.ciudad)
                 order by s.es_tienda, s.ultima desc)
            from (select * from por_quien pq
                  where pq.card_id = pc.card_id and pq.market = pc.market
                  order by pq.es_tienda, pq.ultima desc limit 6) s) as gente,
         pc.desde,
         pc.ultima,
         count(*) over () as total
  from por_carta pc
  left join public.tcg_card_prices pr on pr.card_id = pc.card_id
  order by
    case when p_orden = 'gente' then pc.personas + pc.tiendas end desc nulls last,
    case when p_orden = 'caro' then coalesce(pr.cm_low, pr.cm_trend) end desc nulls last,
    pc.ultima desc,
    pc.card_id
  limit greatest(1, least(coalesce(p_limite, 60), 200))
  offset greatest(0, coalesce(p_desde, 0));
$$;

-- El Mercado sin tiendas (la de la 1047).
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
    select c.card_id, c.market, c.user_id, c.idioma, public.cambio_libres_de(c.id, c.cambio, c.cantidad) as cambio, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where c.cambio > 0
      and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
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

-- Quién da esta carta (la de rangos-intercambios).
create or replace function public.intercambios_de_carta(p_card_id text, p_limite int default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_moderator boolean,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.user_id, p.username, p.display_name, p.avatar_url,
         coalesce(p.is_admin, false), coalesce(p.is_moderator, false),
         c.idioma, c.estado, c.variante, c.gradeo, public.cambio_libres_de(c.id, c.cambio, c.cantidad)
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.card_id = p_card_id
    and c.cambio > 0
    and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
    and not coalesce(p.is_banned, false)
    and c.user_id is distinct from auth.uid()
  order by c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 20), 100));
$$;

-- Tus cruces: quién tiene lo que buscas (la de la 1047).
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
    public.cambio_libres_de(c.id, c.cambio, c.cantidad),
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
   and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
   and c.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = c.user_id
  where not coalesce(p.is_banned, false)
  -- Lo recíproco primero: es lo único que se cierra de un mensaje.
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- Lo que da una persona, en su perfil (la de la 887).
create or replace function public.intercambios_de_persona(p_user uuid, p_limite int default 500)
returns table (
  card_id text,
  market text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.card_id, c.market, c.idioma, c.estado, c.variante, c.gradeo, public.cambio_libres_de(c.id, c.cambio, c.cantidad)
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.user_id = p_user
    and c.cambio > 0
    and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
    and not coalesce(p.is_banned, false)
  order by c.updated_at desc nulls last, c.card_id
  limit greatest(1, least(coalesce(p_limite, 500), 2000));
$$;

create or replace function public.cambios_reservadas(p_cards text[])
returns table (user_id uuid, card_id text, cantidad int)
language sql
stable
security definer
set search_path = public
as $$
  select i.quien, i.card_id, sum(i.cantidad)::int
  from public.trade_offer_items i
  join public.trade_offers o on o.id = i.oferta
  where o.estado in ('enviada', 'aceptada') and i.linea is not null and i.card_id = any (p_cards)
  group by i.quien, i.card_id
$$;

revoke all on function public.cambio_libres_de(uuid, int, int) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
