-- ============================================================
-- Tanda 1236: las tiendas en el Mercado (PINGU eligió lo recomendado de la
-- propuesta «Tiendas en el Mercado»).
--
--   1. `tiendas_con_la_carta`: lo de `tiendas_que_tienen` (que se queda,
--      para la web de antes) más la LÍNEA del stock (`stock_id`), que es lo
--      que piden «Me interesa» (el mensaje con esa carta dentro) y «Ver
--      fotos», y si la tienda tiene local. Una función nueva y no la de
--      siempre redefinida: cambiar lo que devuelve obliga a borrarla, y una
--      página abierta con la web de antes se quedaría sin tiendas.
--   2. `tiendas_agenda`: la agenda de tiendas (/tiendas y la tira de la
--      pestaña «Tiendas»): cada tienda con cuántas cartas enseña y cuántas
--      de tu lista tiene, las de tu lista primero. Nunca el coste.
--
-- Se puede ejecutar más de una vez. Cada sentencia va por su lado (631).
-- ============================================================

-- ── 1. Las tiendas que tienen una carta, con su línea ──
create or replace function public.tiendas_con_la_carta(p_card_id text, p_limite int default 12)
returns table (
  stock_id uuid, tienda_id uuid, username text, display_name text, avatar_url text, ciudad text,
  con_local boolean, idioma text, estado text, variante text, gradeo text, unidades int, precio numeric,
  de_tu_lista boolean, precio_antes numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad,
         nullif(trim(t.direccion), '') is not null,
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
  order by case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end asc nulls last, p.username, s.id
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

-- ── 2. La agenda ──
-- `p_texto` busca en el nombre, el usuario y la ciudad; `p_ciudad` es la
-- ciudad exacta del desplegable; `p_de_mi_lista`, solo las que tienen algo
-- de tu «La quiero». Devuelve { total, ciudades: {ciudad: n}, tiendas: [...] }:
-- las ciudades salen de TODAS las tiendas (sin los filtros), para que el
-- desplegable no se vacíe al elegir una.
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
  cumplen as (
    select * from base b
    where (coalesce(trim(p_texto), '') = '' or
           lower(coalesce(b.display_name, '') || ' ' || coalesce(b.username, '') || ' ' || coalesce(b.ciudad, ''))
             like '%' || lower(trim(p_texto)) || '%')
      and (coalesce(trim(p_ciudad), '') = '' or lower(b.ciudad) = lower(trim(p_ciudad)))
      and (not coalesce(p_con_local, false) or b.con_local)
      and (not coalesce(p_de_mi_lista, false) or b.de_tu_lista > 0)
  ),
  ordenadas as (
    select c.*, row_number() over (
             order by c.de_tu_lista desc, (c.cartas + c.productos > 0) desc, c.ultima desc nulls last,
                      lower(coalesce(c.display_name, c.username)), c.user_id) as puesto
    from cumplen c
  )
  select jsonb_build_object(
    'total', (select count(*) from cumplen),
    'ciudades', coalesce((select jsonb_object_agg(ciudad, n) from (
        select ciudad, count(*) as n from base where ciudad is not null group by ciudad) x), '{}'::jsonb),
    'tiendas', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', o.user_id, 'username', o.username, 'display_name', o.display_name,
        'avatar_url', o.avatar_url, 'banner_url', o.banner_url, 'ciudad', o.ciudad,
        'con_local', o.con_local, 'cartas', o.cartas, 'productos', o.productos,
        'de_tu_lista', o.de_tu_lista) order by o.puesto)
      from ordenadas o
      where o.puesto > greatest(coalesce(p_desde, 0), 0)
        and o.puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 24), 1), 100)), '[]'::jsonb)
  );
$$;

revoke all on function public.tiendas_con_la_carta(text, int) from public;
grant execute on function public.tiendas_con_la_carta(text, int) to anon, authenticated;
revoke all on function public.tiendas_agenda(text, text, boolean, boolean, int, int) from public;
grant execute on function public.tiendas_agenda(text, text, boolean, boolean, int, int) to anon, authenticated;

notify pgrst, 'reload schema';
