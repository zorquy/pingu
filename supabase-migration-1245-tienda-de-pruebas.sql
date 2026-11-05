-- Tanda 1245 — Una tienda DE PRUEBAS no existe para nadie más (PINGU: «la
-- tienda de prueba… no quiero que se vea en el apartado de tiendas… y también
-- ocultar todo lo que tenga que ver con esa tienda, el stock también. Que sea un
-- perfil como fantasma de pruebas»).
--
--   1. `tiendas.de_pruebas`: la marca. La pone el equipo en /admin → Tiendas
--      (`admin_tienda_de_pruebas`) y, de entrada, esta migración se la pone a la
--      que se llama «Tienda de Prueba».
--   2. `tienda_publica(tienda)`: si lo de esa tienda se puede enseñar a quien
--      pregunta. Una de pruebas solo se la enseña a SÍ MISMA (para probar su
--      escaparate); a nadie más, tampoco al equipo, que es justo quien no
--      quiere verla en la agenda.
--   3. Las funciones que enseñan tiendas o su stock a la gente, redefinidas tal
--      cual estaban con esa condición donde ya decían «lo que está a la vista»
--      (`s.visible`): la agenda y «Recién llegado» (1244), el escaparate (1079),
--      «En tiendas» de una carta (1236), las de la 1069, el Mercado (1109) y las
--      fotos de una copia (1235). El panel de la tienda no cambia: es suyo.
--   4. «Avisar a los que la buscan» (1089) no avisa a nadie desde una de
--      pruebas: `tienda_por_avisar` no devuelve a nadie.

alter table public.tiendas add column if not exists de_pruebas boolean not null default false;

create or replace function public.tienda_publica(p_tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- `coalesce`: sin cuenta, `auth.uid()` es NULL y la comparación también; en
  -- un `where` NULL no deja pasar, pero en el `if` del escaparate NULL no
  -- entra en la rama y la de pruebas se enseñaba a quien no tiene cuenta.
  select coalesce(p_tienda = auth.uid(), false)
      or not exists (select 1 from tiendas t where t.user_id = p_tienda and t.de_pruebas)
$$;
grant execute on function public.tienda_publica(uuid) to anon, authenticated;

-- Marcar o desmarcar desde /admin → Tiendas (solo el equipo).
create or replace function public.admin_tienda_de_pruebas(p_tienda uuid, p_si boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda') then
    raise exception 'Esa cuenta no es una tienda.' using errcode = '22023';
  end if;
  insert into tiendas (user_id, de_pruebas) values (p_tienda, coalesce(p_si, false))
  on conflict (user_id) do update set de_pruebas = excluded.de_pruebas, updated_at = now();
end;
$$;
revoke all on function public.admin_tienda_de_pruebas(uuid, boolean) from public;
grant execute on function public.admin_tienda_de_pruebas(uuid, boolean) to authenticated;

-- La de pruebas de PINGU, ya marcada.
update public.tiendas set de_pruebas = true
where user_id in (select id from public.user_profiles where tipo = 'tienda' and display_name = 'Tienda de Prueba');

-- tiendas_que_tienen: la de la 1079, con `tienda_publica`.
create or replace function public.tiendas_que_tienen(p_card_id text, p_limite int default 12)
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
  where s.card_id = p_card_id and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0
  order by case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end asc nulls last, p.username
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;
revoke all on function public.tiendas_que_tienen(text, int) from public;
grant execute on function public.tiendas_que_tienen(text, int) to anon, authenticated;

-- tiendas_con_mis_deseos: la de la 1069, con `tienda_publica`.
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
  where auth.uid() is not null and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0 and s.card_id is not null
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
revoke all on function public.tiendas_con_mis_deseos(int) from public;
grant execute on function public.tiendas_con_mis_deseos(int) to authenticated;

-- mercado_con_tiendas: la de la 1109, con `tienda_publica`.
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
      and s.card_id is not null and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0
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

-- tiendas_con_la_carta: la de la 1236, con `tienda_publica`.
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
  where s.card_id = p_card_id and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0
  order by case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end asc nulls last, p.username, s.id
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;
revoke all on function public.tiendas_con_la_carta(text, int) from public;
grant execute on function public.tiendas_con_la_carta(text, int) to anon, authenticated;

-- tienda_escaparate: la de la 1079, con `tienda_publica`.
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
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda' and not coalesce(is_banned, false)) or not public.tienda_publica(p_tienda) then
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
revoke all on function public.tienda_escaparate(uuid, jsonb, text, int, int) from public;
grant execute on function public.tienda_escaparate(uuid, jsonb, text, int, int) to anon, authenticated;

-- tienda_foto_se_ve: la de la 1235, con `tienda_publica`.
create or replace function public.tienda_foto_se_ve(p_stock uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from tienda_stock s
    where s.id = p_stock and (s.tienda_id = auth.uid() or (s.visible and s.unidades > 0 and public.tienda_publica(s.tienda_id)))
  );
$$;
revoke all on function public.tienda_foto_se_ve(uuid) from public;
grant execute on function public.tienda_foto_se_ve(uuid) to anon, authenticated;

-- tiendas_agenda: la de la 1244, con `tienda_publica`.
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
    where p.tipo = 'tienda' and not coalesce(p.is_banned, false) and public.tienda_publica(p.id)
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

-- tiendas_recien: la de la 1244, con `tienda_publica`.
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
    where x.de_la_tienda <= 2
    order by x.entro_el desc, x.id
    limit least(greatest(coalesce(p_cuantas, 8), 1), 24)
  ) r;
$$;
revoke all on function public.tiendas_recien(int) from public;
grant execute on function public.tiendas_recien(int) to anon, authenticated;

-- tienda_por_avisar: la de la 1089. Una tienda de pruebas no avisa a nadie de
-- verdad («Avisar a los que la buscan» le contesta 0).
create or replace function public.tienda_por_avisar(p_tienda uuid, p_card text, p_market text)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct w.user_id
  from user_wants w
  join user_profiles u on u.id = w.user_id
  where w.card_id = p_card and w.user_id <> p_tienda
    and exists (select 1 from tienda_stock s
      where s.tienda_id = p_tienda and s.card_id = p_card and s.market = p_market and s.unidades > 0 and s.visible
        and (w.idioma is null or w.idioma = s.idioma) and (w.variante is null or w.variante = s.variante))
    and coalesce(u.tipo, 'persona') <> 'tienda'
    and not exists (select 1 from tiendas t where t.user_id = p_tienda and t.de_pruebas)
    and not (coalesce(u.notification_prefs_disabled, '{}') @> array['tienda_la_tiene'])
    and not exists (select 1 from tienda_avisos a
      where a.tienda_id = p_tienda and a.card_id = p_card and a.market = p_market and a.user_id = w.user_id)
$$;
revoke all on function public.tienda_por_avisar(uuid, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
