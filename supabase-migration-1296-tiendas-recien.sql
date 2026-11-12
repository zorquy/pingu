-- Tanda 1296 — «Recién llegado a las tiendas» llena la fila (PINGU: «en PC se
-- queda corto y hay mucho espacio»). La web pide 8, pero la base dejaba DOS
-- por tienda como mucho: con dos tiendas, 3 o 4 cartas y media fila vacía.
-- Ahora reparte POR TURNOS —la más nueva de cada tienda, luego la segunda de
-- cada una…— hasta llenar lo pedido: sigue habiendo variedad cuando hay
-- muchas tiendas, y con pocas la fila sale llena. Lo elegido se enseña como
-- antes, lo más nuevo primero. Lo demás, la de la 1245 tal cual (con
-- `tienda_publica`: una tienda de pruebas no sale).
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
      join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false) and public.tienda_publica(s.tienda_id)
      left join tiendas t on t.user_id = s.tienda_id
      left join tcg_cards c on c.id = s.card_id and c.market = s.market
      left join tcg_products pr on pr.id = s.product_id
      where s.visible and s.unidades > 0
    ) x
    order by x.de_la_tienda, x.entro_el desc, x.id
    limit least(greatest(coalesce(p_cuantas, 8), 1), 24)
  ) r;
$$;
revoke all on function public.tiendas_recien(int) from public;
grant execute on function public.tiendas_recien(int) to anon, authenticated;

notify pgrst, 'reload schema';
