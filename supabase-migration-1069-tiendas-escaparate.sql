-- ============================================================
-- Tanda 1069: lo que ve la gente de una tienda.
--
-- Lo que PINGU eligió de «Portal de tiendas»: una tienda es un perfil más,
-- y su perfil es su inventario (sin vitrina, guías ni medallas); sale en el
-- Mercado de Deseos y cambios con las personas, con su avatar cuadrado y su
-- precio, y arriba una franja con las tiendas que tienen algo de tu lista;
-- y en la ficha de una carta, las tiendas que la tienen.
--
--   1. `tienda_escaparate`: el stock VISIBLE de una tienda (sin coste nunca),
--      con lo que tiene de tu lista.
--   2. `tiendas_que_tienen`: las tiendas que tienen una carta.
--   3. `tiendas_con_mis_deseos`: la franja del Mercado.
--   4. `mercado_con_tiendas`: el Mercado de siempre (`intercambios_mercado`,
--      que no se toca) con las tiendas mezcladas, y «Personas / Tiendas».
--
-- Un deseo casa con una línea de tienda con la regla de siempre (1047): sin
-- idioma vale cualquiera, sin versión vale cualquiera.
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067 y la 1068.
-- ============================================================

-- ── 1. El escaparate de una tienda ──
create or replace function public.tienda_escaparate(
  p_tienda uuid,
  p_filtros jsonb default '{}'::jsonb,
  p_orden text default 'recientes',
  p_desde int default 0,
  p_cuantas int default 60
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res jsonb;
  v_precios boolean;
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
begin
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda' and not coalesce(is_banned, false)) then
    return null;
  end if;
  select coalesce(precio_visible, true) into v_precios from tiendas where user_id = p_tienda;
  v_precios := coalesce(v_precios, true);

  with
  base as (
    select s.id, s.card_id, s.market, s.product_id, s.idioma, s.estado, s.variante, s.gradeo, s.unidades,
      s.precio, s.entro_el,
      c.set_id, c.local_id as numero,
      case when s.product_id is not null then 'sellado' else s.market end as catalogo,
      coalesce(c.name_es, c.name, p.name) as nombre,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '')) as texto,
      (auth.uid() is not null and s.card_id is not null and exists (
        select 1 from user_wants w
        where w.user_id = auth.uid() and w.card_id = s.card_id
          and (w.idioma is null or w.idioma = s.idioma)
          and (w.variante is null or w.variante = s.variante))) as de_tu_lista
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_products p on p.id = s.product_id
    where s.tienda_id = p_tienda and s.visible and s.unidades > 0
  ),
  filtrada as (
    select * from base b
    where (not coalesce((f->>'de_tu_lista')::boolean, false) or b.de_tu_lista)
      -- Una carta concreta: desde «En tiendas» de su ficha (`?carta=`).
      and (coalesce(f->>'carta', '') = '' or b.card_id = f->>'carta')
      and (jsonb_typeof(f->'catalogo') is distinct from 'array' or jsonb_array_length(f->'catalogo') = 0 or (f->'catalogo') ? b.catalogo)
      and (jsonb_typeof(f->'idioma') is distinct from 'array' or jsonb_array_length(f->'idioma') = 0 or (f->'idioma') ? b.idioma)
      and (jsonb_typeof(f->'sets') is distinct from 'array' or jsonb_array_length(f->'sets') = 0 or (f->'sets') ? coalesce(b.set_id, ''))
      and (coalesce(btrim(f->>'q'), '') = '' or not exists (
        select 1 from unnest(regexp_split_to_array(lower(btrim(f->>'q')), '\s+')) palabra
        where palabra <> '' and position(palabra in b.texto) = 0 and lower(coalesce(b.numero, '')) <> palabra))
  ),
  ordenada as (
    select fi.*, row_number() over (
      order by
        case when p_orden = 'precio_asc' and v_precios then fi.precio end asc nulls last,
        case when p_orden = 'precio_desc' and v_precios then fi.precio end desc nulls last,
        case when p_orden = 'nombre' then fi.nombre end asc nulls last,
        fi.de_tu_lista desc, fi.entro_el desc, fi.id
    ) as puesto
    from filtrada fi
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'en_escaparate', (select count(*) from base),
    'de_tu_lista', (select count(*) from base where de_tu_lista),
    'precios', v_precios,
    'facetas', jsonb_build_object(
      'catalogo', coalesce((select jsonb_object_agg(catalogo, n) from (select catalogo, count(*) n from base group by catalogo) x), '{}'::jsonb),
      'idioma', coalesce((select jsonb_object_agg(idioma, n) from (select idioma, count(*) n from base group by idioma) x), '{}'::jsonb),
      'sets', coalesce((select jsonb_object_agg(set_id, n) from (select set_id, count(*) n from base where set_id is not null group by set_id) x), '{}'::jsonb)
    ),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre,
      'set_id', set_id, 'numero', numero, 'idioma', idioma, 'estado', estado, 'variante', variante,
      'gradeo', gradeo, 'unidades', unidades, 'precio', case when v_precios then precio end,
      'de_tu_lista', de_tu_lista
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 60), 1), 200)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

-- ── 2. Las tiendas que tienen una carta ──
-- La más barata primero. Sin coste, sin lo oculto ni lo agotado; sin precio
-- si la tienda no lo enseña.
create or replace function public.tiendas_que_tienen(p_card_id text, p_limite int default 12)
returns table (
  tienda_id uuid, username text, display_name text, avatar_url text, ciudad text,
  idioma text, estado text, variante text, gradeo text, unidades int, precio numeric,
  de_tu_lista boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad,
         s.idioma, s.estado, s.variante, s.gradeo, s.unidades,
         case when coalesce(t.precio_visible, true) then s.precio end,
         (auth.uid() is not null and exists (
           select 1 from user_wants w
           where w.user_id = auth.uid() and w.card_id = s.card_id
             and (w.idioma is null or w.idioma = s.idioma)
             and (w.variante is null or w.variante = s.variante)))
  from tienda_stock s
  join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  left join tiendas t on t.user_id = s.tienda_id
  where s.card_id = p_card_id and s.visible and s.unidades > 0
  order by case when coalesce(t.precio_visible, true) then s.precio end asc nulls last, p.username
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

-- ── 3. La franja del Mercado: las tiendas con algo de tu lista ──
create or replace function public.tiendas_con_mis_deseos(p_limite int default 12)
returns table (tienda_id uuid, username text, display_name text, avatar_url text, ciudad text, cartas int)
language sql
stable
security definer
set search_path = public
as $$
  select s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad, count(distinct s.card_id)::int
  from tienda_stock s
  join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  left join tiendas t on t.user_id = s.tienda_id
  where auth.uid() is not null and s.visible and s.unidades > 0 and s.card_id is not null
    and s.tienda_id is distinct from auth.uid()
    and exists (
      select 1 from user_wants w
      where w.user_id = auth.uid() and w.card_id = s.card_id
        and (w.idioma is null or w.idioma = s.idioma)
        and (w.variante is null or w.variante = s.variante))
  group by s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad
  order by count(distinct s.card_id) desc, p.username
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

-- ── 4. El Mercado con las tiendas ──
--
-- Lo mismo que `intercambios_mercado` (la de la 1047, que se queda: sin esta
-- migración la web la sigue usando), con las tiendas: sus líneas visibles
-- entran como las de una persona, con `tienda` y su precio en `gente`, y la
-- carta dice cuántas tiendas la tienen y desde cuánto. Una cuenta de tienda
-- no da cartas a cambio (su colección no cuenta aquí: lo suyo es su stock).
-- `p_quien`: 'todos', 'personas' o 'tiendas'.
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
    select c.card_id, c.market, c.user_id, c.idioma, c.cambio as copias, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator,
           false as es_tienda, null::numeric as precio, null::text as ciudad
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where coalesce(p_quien, 'todos') <> 'tiendas'
      and c.cambio > 0
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
           true, case when coalesce(t.precio_visible, true) then s.precio end, t.ciudad
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

revoke all on function public.tienda_escaparate(uuid, jsonb, text, int, int) from public;
grant execute on function public.tienda_escaparate(uuid, jsonb, text, int, int) to anon, authenticated;
revoke all on function public.tiendas_que_tienen(text, int) from public;
grant execute on function public.tiendas_que_tienen(text, int) to anon, authenticated;
revoke all on function public.tiendas_con_mis_deseos(int) from public;
grant execute on function public.tiendas_con_mis_deseos(int) to authenticated;
revoke all on function public.mercado_con_tiendas(text, text, text, text[], boolean, text, int, int, text) from public;
grant execute on function public.mercado_con_tiendas(text, text, text, text[], boolean, text, int, int, text) to anon, authenticated;

notify pgrst, 'reload schema';
