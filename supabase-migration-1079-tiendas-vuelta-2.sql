-- ============================================================
-- Tandas 1079–1083: la segunda vuelta de las tiendas (lo que PINGU dio por
-- bueno de «Lo siguiente para tiendas»: «adelante con lo recomendado»).
--
--   1. (1079) Destacadas: hasta ocho líneas que la tienda elige con una
--      estrella y salen arriba en su escaparate. Y Novedades: lo que entró
--      en los últimos siete días.
--   2. (1082) Ofertas: un precio rebajado con fecha de fin opcional. El
--      precio que cuenta (`tienda_precio_de`) es el de la oferta mientras
--      dure; el de siempre sale tachado al lado.
--   3. `tienda_escaparate` con las secciones (destacadas, nuevas, ofertas),
--      una línea suelta por su id (1080, «Me interesa») y las cuentas.
--   4. `tienda_stock_lista` devuelve la estrella y la oferta de cada línea.
--   5. `tiendas_que_tienen` y `mercado_con_tiendas`, con el precio que
--      cuenta (y `precio_antes` en la ficha de una carta).
--   6. (1083) Cifras: `tienda_valor_diario` (una foto del stock por día, que
--      apunta el Panel al abrirse con `tienda_apuntar_valor`) y
--      `tienda_cifras` (lo más vendido, por carta y por expansión, lo que no
--      rota y la serie del valor).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1068, la 1069, la 1072 y la 1073.
-- ============================================================

-- ── 1 y 2. Las columnas ──
alter table public.tienda_stock add column if not exists destacada boolean not null default false;
alter table public.tienda_stock add column if not exists oferta_precio numeric(10, 2);
alter table public.tienda_stock add column if not exists oferta_hasta timestamptz;
alter table public.tienda_stock drop constraint if exists tienda_stock_oferta;
alter table public.tienda_stock add constraint tienda_stock_oferta check (oferta_precio is null or oferta_precio >= 0);
create index if not exists tienda_stock_destacadas_idx on public.tienda_stock (tienda_id) where destacada;

-- Como mucho ocho destacadas: un escaparate con veinte «destacadas» no
-- destaca ninguna.
create or replace function public.tienda_stock_tope_destacadas()
returns trigger
language plpgsql
as $$
begin
  if new.destacada and (tg_op = 'INSERT' or not old.destacada) then
    if (select count(*) from public.tienda_stock where tienda_id = new.tienda_id and destacada and id <> new.id) >= 8 then
      raise exception 'Como mucho 8 destacadas: quita la estrella a otra antes.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_tienda_stock_tope_destacadas on public.tienda_stock;
create trigger trg_tienda_stock_tope_destacadas
  before insert or update of destacada on public.tienda_stock
  for each row execute function public.tienda_stock_tope_destacadas();

-- El precio que cuenta: el de la oferta mientras dure (sin fecha, hasta que
-- se quite), y si no, el de siempre.
create or replace function public.tienda_precio_de(p_precio numeric, p_oferta numeric, p_hasta timestamptz)
returns numeric
language sql
stable
as $$
  select case when p_oferta is not null and (p_hasta is null or p_hasta > now()) then p_oferta else p_precio end
$$;
grant execute on function public.tienda_precio_de(numeric, numeric, timestamptz) to anon, authenticated;

-- ── 3. El escaparate ──
-- Filtros nuevos: `seccion` ('destacadas', 'nuevas', 'ofertas') e `id` (una
-- línea concreta, para la tarjeta de «Me interesa»).
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
      public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
      (v_precios and s.oferta_precio is not null and (s.oferta_hasta is null or s.oferta_hasta > now())) as en_oferta,
      s.precio as precio_lista, s.oferta_hasta, s.destacada, s.entro_el,
      (s.entro_el > now() - interval '7 days') as nueva,
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
      and (coalesce(f->>'id', '') = '' or b.id::text = f->>'id')
      and (coalesce(f->>'seccion', '') = ''
        or (f->>'seccion' = 'destacadas' and b.destacada)
        or (f->>'seccion' = 'nuevas' and b.nueva)
        or (f->>'seccion' = 'ofertas' and b.en_oferta))
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
    'destacadas', (select count(*) from base where destacada),
    'nuevas', (select count(*) from base where nueva),
    'ofertas', (select count(*) from base where en_oferta),
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
      'precio_antes', case when en_oferta then precio_lista end,
      'oferta_hasta', case when en_oferta then oferta_hasta end,
      'destacada', destacada, 'nueva', nueva, 'entro_el', entro_el,
      'de_tu_lista', de_tu_lista
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 60), 1), 200)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

-- ── 4. La lista del stock, con la estrella y la oferta ──
-- La misma de la 1068; solo cambian las filas (y la cuenta de destacadas,
-- para saber cuántas quedan de las ocho).
create or replace function public.tienda_stock_lista(
  p_filtros jsonb default '{}'::jsonb,
  p_orden text default 'recientes',
  p_desde int default 0,
  p_cuantas int default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene stock.' using errcode = '42501';
  end if;

  with
  base as (
    select s.*,
      coalesce(c.set_id, null) as set_id,
      coalesce(c.rarity_en, c.rarity) as rareza,
      c.local_id as numero,
      case when s.product_id is not null then 'sellado' else s.market end as catalogo,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(pr_nombre.n, '')) as texto,
      coalesce(c.name_es, c.name, pr_nombre.n) as nombre,
      case
        when s.product_id is not null then pr_nombre.cm
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_card_prices pr on pr.card_id = s.card_id
    left join lateral (
      select p.name as n, coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) as cm
      from tcg_products p where p.id = s.product_id
    ) pr_nombre on true
    where s.tienda_id = v_uid
  ),
  marcada as (
    select b.*,
      public.tienda_cumple(p_filtros, '', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza,
        b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el) as pasa
    from base b
  ),
  filtrada as (select * from marcada where pasa),
  ordenada as (
    select f.*, row_number() over (
      order by
        case when p_orden = 'nombre' then f.nombre end asc nulls last,
        case when p_orden = 'precio_desc' then f.precio end desc nulls last,
        case when p_orden = 'precio_asc' then f.precio end asc nulls last,
        case when p_orden = 'cm_desc' then f.cm end desc nulls last,
        case when p_orden = 'margen_desc' then (f.precio - f.coste) / nullif(f.coste, 0) end desc nulls last,
        case when p_orden = 'margen_asc' then (f.precio - f.coste) / nullif(f.coste, 0) end asc nulls last,
        case when p_orden = 'antiguas' then f.entro_el end asc,
        case when p_orden = 'unidades' then f.unidades end desc,
        f.entro_el desc, f.id
    ) as puesto
    from filtrada f
  ),
  -- Cuántas deja cada opción de un grupo, con los OTROS grupos puestos.
  facetas as (
    select 'catalogo' as grupo, catalogo as valor, count(*) as n from base b
      where public.tienda_cumple(p_filtros, 'catalogo', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by catalogo
    union all
    select 'sets', set_id, count(*) from base b
      where set_id is not null and public.tienda_cumple(p_filtros, 'sets', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by set_id
    union all
    select 'idioma', idioma, count(*) from base b
      where public.tienda_cumple(p_filtros, 'idioma', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by idioma
    union all
    select 'estado', estado, count(*) from base b
      where public.tienda_cumple(p_filtros, 'estado', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by estado
    union all
    select 'variante', variante, count(*) from base b
      where public.tienda_cumple(p_filtros, 'variante', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by variante
    union all
    select 'rareza', rareza, count(*) from base b
      where rareza is not null and public.tienda_cumple(p_filtros, 'rareza', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by rareza
    union all
    select 'ubicacion', ubicacion, count(*) from base b
      where ubicacion is not null and public.tienda_cumple(p_filtros, 'ubicacion', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by ubicacion
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'en_stock', (select count(*) from base),
    'destacadas', (select count(*) from base where destacada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'coste', (select coalesce(sum(coste * unidades), 0) from filtrada),
      'precio', (select coalesce(sum(precio * unidades), 0) from filtrada),
      'cm', (select coalesce(sum(cm * unidades), 0) from filtrada),
      'sin_coste', (select count(*) from filtrada where coste is null),
      'sin_precio', (select count(*) from filtrada where precio is null)
    ),
    'facetas', coalesce((select jsonb_object_agg(grupo, valores) from (
      select grupo, jsonb_object_agg(valor, n) as valores from facetas group by grupo
    ) g), '{}'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre,
      'set_id', set_id, 'numero', numero, 'rareza', rareza,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'coste', coste, 'precio', precio, 'cm', round(cm, 2),
      'ubicacion', ubicacion, 'visible', visible, 'notas', notas, 'entro_el', entro_el,
      'destacada', destacada, 'oferta_precio', oferta_precio, 'oferta_hasta', oferta_hasta,
      'en_oferta', (oferta_precio is not null and (oferta_hasta is null or oferta_hasta > now()))
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 50), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

-- ── 5. Las tiendas que tienen una carta, con el precio que cuenta ──
-- Cambia lo que devuelve (`precio_antes`), así que se borra y se vuelve a
-- crear.
drop function if exists public.tiendas_que_tienen(text, int);
create function public.tiendas_que_tienen(p_card_id text, p_limite int default 12)
returns table (
  tienda_id uuid, username text, display_name text, avatar_url text, ciudad text,
  idioma text, estado text, variante text, gradeo text, unidades int, precio numeric,
  de_tu_lista boolean, precio_antes numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad,
         s.idioma, s.estado, s.variante, s.gradeo, s.unidades,
         case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end,
         (auth.uid() is not null and exists (
           select 1 from user_wants w
           where w.user_id = auth.uid() and w.card_id = s.card_id
             and (w.idioma is null or w.idioma = s.idioma)
             and (w.variante is null or w.variante = s.variante))),
         case when coalesce(t.precio_visible, true) and s.oferta_precio is not null
                   and (s.oferta_hasta is null or s.oferta_hasta > now()) then s.precio end
  from tienda_stock s
  join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  left join tiendas t on t.user_id = s.tienda_id
  where s.card_id = p_card_id and s.visible and s.unidades > 0
  order by case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end asc nulls last, p.username
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

-- El Mercado, igual que en la 1069 salvo el precio de una tienda.
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

-- ── 6. Las cifras ──
-- Una foto del stock por día. Sin una pasada programada: la apunta el Panel
-- al abrirse (`tienda_apuntar_valor`), así que un día sin abrirlo es un
-- hueco en la serie, no un cero.
create table if not exists public.tienda_valor_diario (
  tienda_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  lineas int not null default 0,
  unidades int not null default 0,
  valor numeric(12, 2) not null default 0,
  cm numeric(12, 2) not null default 0,
  coste numeric(12, 2) not null default 0,
  primary key (tienda_id, dia)
);
alter table public.tienda_valor_diario enable row level security;
drop policy if exists tienda_valor_diario_suyo on public.tienda_valor_diario;
create policy tienda_valor_diario_suyo on public.tienda_valor_diario for select to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda());
grant select on public.tienda_valor_diario to authenticated;

-- El valor es el de venta (el precio que cuenta), Cardmarket en su idioma (la
-- cuenta de `tienda_stock_lista`) y lo que costó; solo lo que tiene unidades.
create or replace function public.tienda_apuntar_valor(p_zona text default 'Europe/Madrid')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fila tienda_valor_diario%rowtype;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene stock.' using errcode = '42501';
  end if;
  insert into tienda_valor_diario (tienda_id, dia, lineas, unidades, valor, cm, coste)
  select v_uid, (now() at time zone coalesce(p_zona, 'Europe/Madrid'))::date,
    count(*), coalesce(sum(x.unidades), 0),
    coalesce(round(sum(x.precio * x.unidades), 2), 0),
    coalesce(round(sum(x.cm * x.unidades), 2), 0),
    coalesce(round(sum(x.coste * x.unidades), 2), 0)
  from (
    select s.unidades, s.coste, public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
      case
        when s.product_id is not null then (select coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) from tcg_products p where p.id = s.product_id)
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_card_prices pr on pr.card_id = s.card_id
    where s.tienda_id = v_uid and s.unidades > 0
  ) x
  on conflict (tienda_id, dia) do update
    set lineas = excluded.lineas, unidades = excluded.unidades, valor = excluded.valor, cm = excluded.cm, coste = excluded.coste
  returning * into v_fila;
  return to_jsonb(v_fila);
end;
$$;

-- Lo más vendido en el periodo (por carta o producto, y por expansión), lo
-- que no rota (90 días o más en el stock sin vender una sola unidad, lo que
-- más dinero tiene parado primero) y la serie del valor.
create or replace function public.tienda_cifras(p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene cifras.' using errcode = '42501';
  end if;

  with
  ventas as (
    select v.card_id, v.market, v.product_id, v.unidades, v.precio * v.unidades as importe,
      case when v.coste is not null then (v.precio - v.coste) * v.unidades end as beneficio,
      c.set_id, c.local_id as numero, coalesce(c.name_es, c.name, p.name) as nombre
    from tienda_ventas v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    where v.tienda_id = v_uid and v.vendida_el >= p_desde and v.vendida_el < p_hasta
  ),
  por_carta as (
    select card_id, market, product_id, max(nombre) as nombre, max(set_id) as set_id, max(numero) as numero,
      sum(unidades) as unidades, sum(importe) as importe, sum(beneficio) as beneficio
    from ventas group by card_id, market, product_id
  ),
  por_set as (
    select v.set_id, v.market, max(st.name) as nombre, sum(v.unidades) as unidades, sum(v.importe) as importe,
      count(distinct v.card_id) as cartas
    from ventas v
    left join tcg_sets st on st.id = v.set_id and st.market = v.market
    where v.set_id is not null
    group by v.set_id, v.market
  ),
  quietas as (
    select s.id, s.card_id, s.market, s.product_id, s.idioma, s.estado, s.variante, s.unidades, s.entro_el,
      coalesce(c.name_es, c.name, p.name) as nombre, c.set_id, c.local_id as numero,
      public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_products p on p.id = s.product_id
    where s.tienda_id = v_uid and s.unidades > 0 and s.entro_el <= now() - interval '90 days'
      and not exists (select 1 from tienda_ventas v where v.stock_id = s.id and v.vendida_el > now() - interval '90 days')
  )
  select jsonb_build_object(
    'cartas', coalesce((select jsonb_agg(jsonb_build_object(
        'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre, 'set_id', set_id,
        'numero', numero, 'unidades', unidades, 'importe', importe, 'beneficio', beneficio) order by unidades desc, importe desc, nombre)
      from (select * from por_carta order by unidades desc, importe desc, nombre limit 8) x), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(jsonb_build_object(
        'set_id', set_id, 'market', market, 'nombre', nombre, 'unidades', unidades, 'importe', importe, 'cartas', cartas) order by importe desc, unidades desc, set_id)
      from (select * from por_set order by importe desc, unidades desc, set_id limit 6) x), '[]'::jsonb),
    'quietas', jsonb_build_object(
      'lineas', (select count(*) from quietas),
      'unidades', (select coalesce(sum(unidades), 0) from quietas),
      'valor', (select coalesce(sum(precio * unidades), 0) from quietas),
      'filas', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre, 'set_id', set_id,
          'numero', numero, 'idioma', idioma, 'estado', estado, 'variante', variante, 'unidades', unidades,
          'precio', precio, 'entro_el', entro_el) order by coalesce(precio, 0) * unidades desc, entro_el, id)
        from (select * from quietas order by coalesce(precio, 0) * unidades desc, entro_el, id limit 8) x), '[]'::jsonb)),
    'valor', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'valor', valor, 'cm', cm, 'coste', coste, 'unidades', unidades) order by dia)
      from tienda_valor_diario
      where tienda_id = v_uid and dia >= (now() - interval '180 days')::date), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.tienda_escaparate(uuid, jsonb, text, int, int) from public;
grant execute on function public.tienda_escaparate(uuid, jsonb, text, int, int) to anon, authenticated;
revoke all on function public.tienda_stock_lista(jsonb, text, int, int) from public;
grant execute on function public.tienda_stock_lista(jsonb, text, int, int) to authenticated;
revoke all on function public.tiendas_que_tienen(text, int) from public;
grant execute on function public.tiendas_que_tienen(text, int) to anon, authenticated;
revoke all on function public.mercado_con_tiendas(text, text, text, text[], boolean, text, int, int, text) from public;
grant execute on function public.mercado_con_tiendas(text, text, text, text[], boolean, text, int, int, text) to anon, authenticated;
revoke all on function public.tienda_apuntar_valor(text) from public;
grant execute on function public.tienda_apuntar_valor(text) to authenticated;
revoke all on function public.tienda_cifras(timestamptz, timestamptz) from public;
grant execute on function public.tienda_cifras(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
