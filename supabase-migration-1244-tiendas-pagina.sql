-- Tanda 1244 — /tiendas, un escaparate de escaparates (PINGU: «que se vean
-- bien las tiendas, que sea un apartado visualmente guapo, que muestre bien
-- las tiendas, con toda la info»). Dos cosas:
--
--   1. `tiendas_agenda` (la de la 1236, MISMA firma: la web de antes la sigue
--      llamando igual) da además lo que la tarjeta grande enseña: horario,
--      web, Instagram, si es online (sin dirección), sus cuatro destacadas
--      (y, si tiene menos, lo último que ha puesto) con su precio solo si lo
--      enseña, y las cifras de la banda (tiendas, ciudades, cartas a la
--      vista). Y el texto busca también por CARTA: «charizard» encuentra las
--      tiendas que lo tienen a la vista.
--   2. `tiendas_recien`: lo último que han puesto a la vista todas las
--      tiendas, como mucho dos por tienda para que una no lo llene todo.
--
-- Nunca el coste ni dónde está guardado (lo de la 1069), y el precio con la
-- oferta que cuenta (`tienda_precio_de`, 1082). Sin la migración, la web pinta
-- lo de la 1236 sin nada roto (js/tiendas-agenda.js).

create or replace function public.tiendas_agenda(
  p_texto text default null,
  p_ciudad text default null,
  p_con_local boolean default false,
  p_de_mi_lista boolean default false,
  p_desde int default 0,
  p_cuantas int default 24
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select p.id as user_id, p.username, p.display_name, p.avatar_url, p.banner_url,
           nullif(trim(t.ciudad), '') as ciudad,
           nullif(trim(t.direccion), '') is not null as con_local,
           nullif(trim(t.horario), '') as horario,
           nullif(trim(t.web), '') as web,
           nullif(trim(t.instagram), '') as instagram,
           coalesce(t.precio_visible, true) as precios,
           (select count(*) from tienda_stock s
             where s.tienda_id = p.id and s.visible and s.unidades > 0 and s.card_id is not null)::int as cartas,
           (select count(*) from tienda_stock s
             where s.tienda_id = p.id and s.visible and s.unidades > 0 and s.product_id is not null)::int as productos,
           (case when auth.uid() is null then 0 else
             (select count(distinct s.card_id) from tienda_stock s
               where s.tienda_id = p.id and s.visible and s.unidades > 0 and s.card_id is not null
                 and exists (select 1 from user_wants w
                   where w.user_id = auth.uid() and w.card_id = s.card_id
                     and (w.idioma is null or w.idioma = s.idioma)
                     and (w.variante is null or w.variante = s.variante))) end)::int as de_tu_lista,
           (select max(s.updated_at) from tienda_stock s where s.tienda_id = p.id and s.visible) as ultima
    from user_profiles p
    left join tiendas t on t.user_id = p.id
    where p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  ),
  buscado as (
    select public.immutable_unaccent(lower(trim(coalesce(p_texto, '')))) as q
  ),
  cumplen as (
    select b.* from base b, buscado
    where (buscado.q = ''
           or public.immutable_unaccent(lower(coalesce(b.display_name, '') || ' ' || coalesce(b.username, '') || ' ' || coalesce(b.ciudad, '')))
                like '%' || buscado.q || '%'
           -- Por carta (1244): la tienda que la tiene a la vista.
           or exists (select 1 from tienda_stock s
                      join tcg_cards c on c.id = s.card_id and c.market = s.market
                      where s.tienda_id = b.user_id and s.visible and s.unidades > 0
                        and coalesce(c.name_search, '') like '%' || buscado.q || '%'))
      and (coalesce(trim(p_ciudad), '') = '' or lower(b.ciudad) = lower(trim(p_ciudad)))
      and (not coalesce(p_con_local, false) or b.con_local)
      and (not coalesce(p_de_mi_lista, false) or b.de_tu_lista > 0)
  ),
  ordenadas as (
    select c.*, row_number() over (
             order by c.de_tu_lista desc, (c.cartas + c.productos > 0) desc, c.ultima desc nulls last,
                      lower(coalesce(c.display_name, c.username)), c.user_id) as puesto
    from cumplen c
  ),
  pagina as (
    select * from ordenadas o
    where o.puesto > greatest(coalesce(p_desde, 0), 0)
      and o.puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 24), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from cumplen),
    'ciudades', coalesce((select jsonb_object_agg(ciudad, n) from (
        select ciudad, count(*) as n from base where ciudad is not null group by ciudad) x), '{}'::jsonb),
    -- La banda (1244): de TODAS, no de las que cumplen los filtros.
    'cifras', jsonb_build_object(
      'tiendas', (select count(*) from base),
      'ciudades', (select count(distinct lower(ciudad)) from base where ciudad is not null),
      'cartas', (select coalesce(sum(cartas), 0) from base)),
    'tiendas', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', o.user_id, 'username', o.username, 'display_name', o.display_name,
        'avatar_url', o.avatar_url, 'banner_url', o.banner_url, 'ciudad', o.ciudad,
        'con_local', o.con_local, 'online', not o.con_local,
        'horario', o.horario, 'web', o.web, 'instagram', o.instagram,
        'cartas', o.cartas, 'productos', o.productos, 'de_tu_lista', o.de_tu_lista,
        'precios', o.precios,
        -- Sus cuatro de escaparate: las destacadas primero y, si faltan, lo
        -- último. Con el precio que cuenta, y solo si la tienda lo enseña.
        'destacadas', coalesce((
          select jsonb_agg(jsonb_build_object(
              'id', d.id, 'card_id', d.card_id, 'market', d.market, 'product_id', d.product_id,
              'precio', case when o.precios then d.precio end,
              'precio_antes', case when o.precios and d.en_oferta then d.precio_lista end,
              'destacada', d.destacada) order by d.n)
          from (
            select s.id, s.card_id, s.market, s.product_id, s.destacada,
                   public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
                   s.precio as precio_lista,
                   (s.oferta_precio is not null and (s.oferta_hasta is null or s.oferta_hasta > now())) as en_oferta,
                   row_number() over (order by s.destacada desc, s.entro_el desc, s.id) as n
            from tienda_stock s
            where s.tienda_id = o.user_id and s.visible and s.unidades > 0
          ) d where d.n <= 4), '[]'::jsonb)
      ) order by o.puesto) from pagina o), '[]'::jsonb)
  );
$$;

revoke all on function public.tiendas_agenda(text, text, boolean, boolean, int, int) from public;
grant execute on function public.tiendas_agenda(text, text, boolean, boolean, int, int) to anon, authenticated;

-- «Recién llegado a las tiendas» (1244): lo último que se ha puesto a la vista,
-- como mucho dos por tienda (una tienda que sube cien cartas no llena la tira).
create or replace function public.tiendas_recien(p_cuantas int default 8)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'card_id', r.card_id, 'market', r.market, 'product_id', r.product_id,
      'nombre', r.nombre, 'precio', case when r.precios then r.precio end,
      'precio_antes', case when r.precios and r.en_oferta then r.precio_lista end,
      'entro_el', r.entro_el,
      'tienda', jsonb_build_object('user_id', r.tienda_id, 'username', r.username, 'display_name', r.display_name)
    ) order by r.entro_el desc, r.id), '[]'::jsonb)
  from (
    select x.* from (
      select s.id, s.card_id, s.market, s.product_id, s.entro_el, s.tienda_id,
             public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
             s.precio as precio_lista,
             (s.oferta_precio is not null and (s.oferta_hasta is null or s.oferta_hasta > now())) as en_oferta,
             coalesce(c.name_es, c.name, pr.name) as nombre,
             p.username, p.display_name, coalesce(t.precio_visible, true) as precios,
             row_number() over (partition by s.tienda_id order by s.entro_el desc, s.id) as de_la_tienda
      from tienda_stock s
      join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
      left join tiendas t on t.user_id = s.tienda_id
      left join tcg_cards c on c.id = s.card_id and c.market = s.market
      left join tcg_products pr on pr.id = s.product_id
      where s.visible and s.unidades > 0
    ) x
    where x.de_la_tienda <= 2
    order by x.entro_el desc, x.id
    limit least(greatest(coalesce(p_cuantas, 8), 1), 24)
  ) r;
$$;

revoke all on function public.tiendas_recien(int) from public;
grant execute on function public.tiendas_recien(int) to anon, authenticated;

notify pgrst, 'reload schema';
