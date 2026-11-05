-- ============================================================
-- Tanda 1253 — el SKU de una copia, en la BASE
-- ============================================================
-- PINGU eligió lo recomendado: el SKU es GENERAL (el mismo en todas las
-- tiendas: «ASC-276-ES-NM-H»), va escrito y en código de barras en la
-- etiqueta, y el QR lleva a /s/<tienda>/<SKU>, que abre la línea en el panel
-- si quien escanea es la tienda y la carta en su escaparate si es otra
-- persona. Un lector de códigos USB escribe el SKU y un Intro: el Stock y
-- Vender lo buscan aquí.
--
--   1. `tienda_sku(...)`: la MISMA regla que `skuDe` de js/tiendas-puro.js
--      (la prueba compara las dos con los mismos casos). Pura.
--   2. `tienda_sku_de(stock)`: el SKU de una línea, con el código de su set.
--   3. `tienda_sku_buscar(tienda, sku)`: las líneas de esa tienda con ese SKU.
--      La tienda ve todas las suyas; los demás, solo lo que enseña el
--      escaparate (visible, con unidades y no de pruebas). Nunca el coste.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1068 (`tienda_stock`), la 1234 (`gradeo`) y la 1245
-- (`tienda_publica`).
-- ============================================================

begin;

-- Lo que hace `limpio` en la web: mayúsculas, sin acentos, solo A-Z y 0-9.
create or replace function public.tienda_sku_limpio(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(public.immutable_unaccent(upper(coalesce(p, ''))), '[^A-Z0-9]', '', 'g')
$$;

-- `versionCorta`: normal no dice nada, reverse R, holo H, primera 1E; otra
-- (`poke-ball`, `master-ball`), sus iniciales (un trozo que empieza por
-- número va entero).
create or replace function public.tienda_sku_version(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(nullif(p, ''), 'normal'))
    when 'normal' then ''
    when 'reverse' then 'R'
    when 'holo' then 'H'
    when 'primera' then '1E'
    else upper(coalesce((
      select string_agg(case when t ~ '^[0-9]' then t else left(t, 1) end, '' order by i)
      from regexp_split_to_table(lower(p), '[^a-z0-9]+') with ordinality as x(t, i)
      where t <> ''), ''))
  end
$$;

create or replace function public.tienda_sku(p_codigo text, p_set text, p_numero text, p_idioma text, p_estado text, p_gradeo text, p_variante text, p_producto text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(p_producto, '') is not null then
      concat_ws('-', 'SEL', public.tienda_sku_limpio(p_producto), nullif(public.tienda_sku_limpio(coalesce(nullif(p_idioma, ''), 'es')), ''))
    else concat_ws('-',
      coalesce(nullif(public.tienda_sku_limpio(p_codigo), ''), nullif(public.tienda_sku_limpio(p_set), ''), 'X'),
      -- El número tal como va impreso, sin el total ni los ceros de delante.
      (select case when n ~ '^[0-9]+$' then coalesce(nullif(ltrim(n, '0'), ''), '0')
                   else coalesce(nullif(public.tienda_sku_limpio(n), ''), '0') end
         from (select split_part(coalesce(p_numero, ''), '/', 1) as n) q),
      nullif(public.tienda_sku_limpio(coalesce(nullif(p_idioma, ''), 'es')), ''),
      nullif(case when nullif(p_gradeo, '') is not null then public.tienda_sku_limpio(p_gradeo)
                  else public.tienda_sku_limpio(coalesce(nullif(p_estado, ''), 'NM')) end, ''),
      nullif(public.tienda_sku_version(p_variante), ''))
  end
$$;

create or replace function public.tienda_sku_de(p_stock uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.tienda_sku(st.tcg_online_code, c.set_id, c.local_id, s.idioma, s.estado, s.gradeo, s.variante, s.product_id::text)
  from tienda_stock s
  left join tcg_cards c on c.id = s.card_id
  left join tcg_sets st on st.id = c.set_id and st.market = c.market
  -- La de otra tienda, solo si su escaparate la enseña.
  where s.id = p_stock and (s.tienda_id = auth.uid() or (s.visible and public.tienda_publica(s.tienda_id)))
$$;

-- Las líneas de una tienda con ese SKU (sin tienda, las tuyas). Primero las
-- que tienen unidades, y de ellas la más barata.
create or replace function public.tienda_sku_buscar(p_tienda uuid, p_sku text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tienda uuid := coalesce(p_tienda, auth.uid());
  v_mia boolean;
  v_sku text := upper(regexp_replace(coalesce(p_sku, ''), '[^A-Za-z0-9-]', '', 'g'));
begin
  if v_tienda is null or v_sku = '' then
    return '[]'::jsonb;
  end if;
  v_mia := v_tienda = auth.uid();
  if not v_mia and not public.tienda_publica(v_tienda) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(x.f order by x.k1, x.k2) from (
    select jsonb_build_object(
      'id', s.id, 'card_id', s.card_id, 'market', s.market, 'product_id', s.product_id,
      'idioma', s.idioma, 'estado', s.estado, 'variante', s.variante, 'gradeo', s.gradeo,
      'unidades', s.unidades, 'visible', s.visible,
      'precio', public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta),
      'nombre', coalesce(c.name_es, c.name, p.name), 'sku', v_sku
    ) f,
    case when s.unidades > 0 then 0 else 1 end k1,
    coalesce(public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta), 1e9) k2
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id
    left join tcg_sets st on st.id = c.set_id and st.market = c.market
    left join tcg_products p on p.id = s.product_id
    where s.tienda_id = v_tienda
      and (v_mia or (s.visible and s.unidades > 0))
      and public.tienda_sku(st.tcg_online_code, c.set_id, c.local_id, s.idioma, s.estado, s.gradeo, s.variante, s.product_id::text) = v_sku
    limit 50
  ) x), '[]'::jsonb);
end;
$$;

revoke all on function public.tienda_sku_de(uuid) from public, anon;
grant execute on function public.tienda_sku_de(uuid) to authenticated;
grant execute on function public.tienda_sku_limpio(text) to anon, authenticated;
grant execute on function public.tienda_sku_version(text) to anon, authenticated;
grant execute on function public.tienda_sku(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.tienda_sku_buscar(uuid, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
