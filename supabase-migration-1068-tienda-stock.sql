-- ============================================================
-- Tanda 1068: el stock de una tienda.
--
-- Lo de «Portal de tiendas» que PINGU eligió: cada carta (o producto
-- sellado) con lo que costó, a cuánto se vende, lo que vale en Cardmarket
-- en su idioma y el margen; filtros en un panel lateral, vistas guardadas
-- y precio en bloque. NO va en `user_collection`: el stock de una tienda
-- tiene unidades, coste y precio de venta, y todo lo que lee la colección
-- (el Panel, los álbumes, el valor diario, el Mercado) no lo tiene que ver.
--
--   1. `tienda_stock`: una fila por copia distinta. Solo la ve y la cambia
--      su tienda (una cuenta de tipo «tienda», la 1067).
--   2. `tienda_vistas`: combinaciones de filtros con nombre.
--   3. `tienda_stock_lista(filtros, orden, desde, cuántas)`: filtra, ordena,
--      suma y cuenta EN LA BASE (una tienda pasa del tope de 1.000 filas de
--      Supabase), con el precio de Cardmarket de `valor_de_copia`, la misma
--      cuenta que el valor de una colección.
--   4. `tienda_stock_precio_bloque(ids, %, redondeo)`: «Cardmarket + 10 %,
--      a ,95» sobre lo marcado.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067 (el tipo de cuenta).
-- ============================================================

-- ¿Es una tienda quien pregunta? (lo usan las políticas).
create or replace function public.soy_tienda()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from user_profiles where id = auth.uid() and tipo = 'tienda')
$$;
revoke all on function public.soy_tienda() from public;
grant execute on function public.soy_tienda() to authenticated;

-- ── 1. El stock ──
create table if not exists public.tienda_stock (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Una carta (con su catálogo) o un producto sellado de `tcg_products`.
  card_id text,
  market text not null default 'WEST',
  product_id bigint,
  idioma text not null default 'es',
  estado text not null default 'NM',
  variante text not null default 'normal',
  gradeo text,
  unidades int not null default 1,
  -- Por unidad. Sin coste no hay margen (se dice «sin coste»), no un cero.
  coste numeric(10, 2),
  precio numeric(10, 2),
  ubicacion text,
  visible boolean not null default true,
  notas text,
  entro_el timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tienda_stock_que check ((card_id is null) <> (product_id is null)),
  constraint tienda_stock_market check (market in ('WEST', 'JP')),
  constraint tienda_stock_estado check (estado in ('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO', 'sellado')),
  constraint tienda_stock_idioma check (char_length(idioma) between 2 and 3),
  constraint tienda_stock_variante check (char_length(variante) between 1 and 60),
  constraint tienda_stock_unidades check (unidades between 0 and 99999),
  constraint tienda_stock_dinero check ((coste is null or coste >= 0) and (precio is null or precio >= 0)),
  constraint tienda_stock_textos check (
    (gradeo is null or char_length(gradeo) between 1 and 20)
    and (ubicacion is null or char_length(ubicacion) <= 60)
    and (notas is null or char_length(notas) <= 300)
  )
);

create index if not exists tienda_stock_tienda_idx on public.tienda_stock (tienda_id, entro_el desc);
create index if not exists tienda_stock_carta_idx on public.tienda_stock (card_id) where card_id is not null;

alter table public.tienda_stock enable row level security;
drop policy if exists tienda_stock_suyo on public.tienda_stock;
create policy tienda_stock_suyo on public.tienda_stock for all to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda())
  with check (tienda_id = auth.uid() and public.soy_tienda());
grant select, insert, update, delete on public.tienda_stock to authenticated;

-- ── 2. Las vistas guardadas ──
create table if not exists public.tienda_vistas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  filtros jsonb not null default '{}'::jsonb,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  constraint tienda_vistas_nombre check (char_length(nombre) between 1 and 40)
);
alter table public.tienda_vistas enable row level security;
drop policy if exists tienda_vistas_suyas on public.tienda_vistas;
create policy tienda_vistas_suyas on public.tienda_vistas for all to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda())
  with check (tienda_id = auth.uid() and public.soy_tienda());
grant select, insert, update, delete on public.tienda_vistas to authenticated;

-- ── 3. La lista, filtrada en la base ──
--
-- ¿Cumple una fila los filtros? `p_sin` es el grupo que NO se mira: para
-- contar cuántas deja cada opción de un grupo, se cuenta con todos los
-- demás puestos (si no, al marcar «ES» el grupo de idiomas diría 0 en todos
-- los demás). Los filtros (todos opcionales):
--   q          texto: cada palabra en el nombre, o el número
--   catalogo   ['WEST','JP','sellado']
--   sets, idioma, estado, variante, rareza, ubicacion   listas
--   precio_min, precio_max, cm_min, cm_max, coste_min, coste_max
--   margen     ['pierdes','0-20','20-50','50+','sin_coste'] (sobre lo pagado)
--   contra     ['debajo','igual','encima'] (tu precio contra Cardmarket, ±5 %)
--   dias       ['30','30-90','90+'] (desde que entró)
--   unidades   ['agotadas','una','varias']
--   gradeadas  ['si','no']
--   visible    ['si','no']
create or replace function public.tienda_cumple(
  p jsonb, p_sin text,
  v_texto text, v_numero text, v_catalogo text, v_set text, v_idioma text, v_estado text, v_variante text, v_rareza text,
  v_ubicacion text, v_precio numeric, v_coste numeric, v_cm numeric, v_unidades int, v_gradeo text, v_visible boolean,
  v_entro timestamptz
)
returns boolean
language plpgsql
stable
as $$
declare
  palabra text;
  lista text[];
  ok boolean;
  margen numeric;
begin
  p := coalesce(p, '{}'::jsonb);
  -- Las listas: si el filtro trae una lista no vacía, el valor tiene que estar.
  if p_sin <> 'catalogo' and jsonb_typeof(p->'catalogo') = 'array' and jsonb_array_length(p->'catalogo') > 0
     and not (p->'catalogo') ? v_catalogo then return false; end if;
  if p_sin <> 'sets' and jsonb_typeof(p->'sets') = 'array' and jsonb_array_length(p->'sets') > 0
     and not (p->'sets') ? coalesce(v_set, '') then return false; end if;
  if p_sin <> 'idioma' and jsonb_typeof(p->'idioma') = 'array' and jsonb_array_length(p->'idioma') > 0
     and not (p->'idioma') ? v_idioma then return false; end if;
  if p_sin <> 'estado' and jsonb_typeof(p->'estado') = 'array' and jsonb_array_length(p->'estado') > 0
     and not (p->'estado') ? v_estado then return false; end if;
  if p_sin <> 'variante' and jsonb_typeof(p->'variante') = 'array' and jsonb_array_length(p->'variante') > 0
     and not (p->'variante') ? v_variante then return false; end if;
  if p_sin <> 'rareza' and jsonb_typeof(p->'rareza') = 'array' and jsonb_array_length(p->'rareza') > 0
     and not (p->'rareza') ? coalesce(v_rareza, '') then return false; end if;
  if p_sin <> 'ubicacion' and jsonb_typeof(p->'ubicacion') = 'array' and jsonb_array_length(p->'ubicacion') > 0
     and not (p->'ubicacion') ? coalesce(v_ubicacion, '') then return false; end if;

  -- El texto: cada palabra en el nombre (ya plegado), o el número entero.
  if p_sin <> 'q' and coalesce(btrim(p->>'q'), '') <> '' then
    for palabra in select unnest(regexp_split_to_array(lower(btrim(p->>'q')), '\s+')) loop
      if palabra <> '' and position(palabra in coalesce(v_texto, '')) = 0
         and lower(coalesce(v_numero, '')) <> palabra then
        return false;
      end if;
    end loop;
  end if;

  -- Los rangos (en euros, por unidad).
  if p_sin <> 'precio' then
    if p ? 'precio_min' and (v_precio is null or v_precio < (p->>'precio_min')::numeric) then return false; end if;
    if p ? 'precio_max' and (v_precio is null or v_precio > (p->>'precio_max')::numeric) then return false; end if;
  end if;
  if p_sin <> 'cm' then
    if p ? 'cm_min' and (v_cm is null or v_cm < (p->>'cm_min')::numeric) then return false; end if;
    if p ? 'cm_max' and (v_cm is null or v_cm > (p->>'cm_max')::numeric) then return false; end if;
  end if;
  if p_sin <> 'coste' then
    if p ? 'coste_min' and (v_coste is null or v_coste < (p->>'coste_min')::numeric) then return false; end if;
    if p ? 'coste_max' and (v_coste is null or v_coste > (p->>'coste_max')::numeric) then return false; end if;
  end if;

  -- El margen, sobre lo pagado: (precio − coste) / coste.
  if p_sin <> 'margen' and jsonb_typeof(p->'margen') = 'array' and jsonb_array_length(p->'margen') > 0 then
    margen := case when v_coste > 0 and v_precio is not null then (v_precio - v_coste) / v_coste * 100 end;
    ok := ((p->'margen') ? 'sin_coste' and (v_coste is null or v_coste = 0 or v_precio is null))
       or ((p->'margen') ? 'pierdes' and margen < 0)
       or ((p->'margen') ? '0-20' and margen >= 0 and margen < 20)
       or ((p->'margen') ? '20-50' and margen >= 20 and margen < 50)
       or ((p->'margen') ? '50+' and margen >= 50);
    if not coalesce(ok, false) then return false; end if;
  end if;

  if p_sin <> 'contra' and jsonb_typeof(p->'contra') = 'array' and jsonb_array_length(p->'contra') > 0 then
    if v_precio is null or v_cm is null or v_cm = 0 then return false; end if;
    ok := ((p->'contra') ? 'debajo' and v_precio < v_cm * 0.95)
       or ((p->'contra') ? 'igual' and v_precio between v_cm * 0.95 and v_cm * 1.05)
       or ((p->'contra') ? 'encima' and v_precio > v_cm * 1.05);
    if not ok then return false; end if;
  end if;

  if p_sin <> 'dias' and jsonb_typeof(p->'dias') = 'array' and jsonb_array_length(p->'dias') > 0 then
    ok := ((p->'dias') ? '30' and v_entro > now() - interval '30 days')
       or ((p->'dias') ? '30-90' and v_entro <= now() - interval '30 days' and v_entro > now() - interval '90 days')
       or ((p->'dias') ? '90+' and v_entro <= now() - interval '90 days');
    if not ok then return false; end if;
  end if;

  if p_sin <> 'unidades' and jsonb_typeof(p->'unidades') = 'array' and jsonb_array_length(p->'unidades') > 0 then
    ok := ((p->'unidades') ? 'agotadas' and v_unidades = 0)
       or ((p->'unidades') ? 'una' and v_unidades = 1)
       or ((p->'unidades') ? 'varias' and v_unidades > 1);
    if not ok then return false; end if;
  end if;

  if p_sin <> 'gradeadas' and jsonb_typeof(p->'gradeadas') = 'array' and jsonb_array_length(p->'gradeadas') = 1 then
    if ((p->'gradeadas') ? 'si') <> (v_gradeo is not null) then return false; end if;
  end if;

  if p_sin <> 'visible' and jsonb_typeof(p->'visible') = 'array' and jsonb_array_length(p->'visible') = 1 then
    if ((p->'visible') ? 'si') <> v_visible then return false; end if;
  end if;

  return true;
end;
$$;

-- La lista de SU stock (quien pregunta tiene que ser una tienda), una
-- página cada vez, con las sumas y las cuentas de cada grupo de filtros.
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
      'ubicacion', ubicacion, 'visible', visible, 'notas', notas, 'entro_el', entro_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 50), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

-- ── 4. Precio en bloque ──
-- «Cardmarket + 10 %», redondeado: 'centimo' (tal cual), '95' (a ,95 por
-- arriba), '99', 'entero' (al euro de arriba). Las que no tienen precio de
-- Cardmarket se dejan como estaban y se cuentan.
create or replace function public.tienda_redondear(p numeric, p_modo text)
returns numeric
language sql
immutable
as $$
  select case
    when p is null then null
    when p_modo = '95' then greatest(floor(p) + 0.95 - case when p - floor(p) > 0.95 then -1 else 0 end, 0.95)
    when p_modo = '99' then greatest(floor(p) + 0.99 - case when p - floor(p) > 0.99 then -1 else 0 end, 0.99)
    when p_modo = 'entero' then ceil(p)
    else round(p, 2)
  end
$$;

create or replace function public.tienda_stock_precio_bloque(p_ids uuid[], p_pct numeric, p_redondeo text default 'centimo')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hechas int;
  v_sin int;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene stock.' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < -90 or p_pct > 1000 then
    raise exception 'El porcentaje tiene que estar entre −90 y 1000.' using errcode = '22023';
  end if;

  with valores as (
    select s.id,
      case
        when s.product_id is not null then (select coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) from tcg_products p where p.id = s.product_id)
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_card_prices pr on pr.card_id = s.card_id
    where s.tienda_id = v_uid and s.id = any(p_ids)
  ),
  cambio as (
    update tienda_stock s
      set precio = tienda_redondear(v.cm * (1 + p_pct / 100), p_redondeo), updated_at = now()
      from valores v
      where s.id = v.id and v.cm is not null and v.cm > 0
      returning s.id
  )
  select (select count(*) from cambio), (select count(*) from valores where cm is null or cm = 0)
    into v_hechas, v_sin;

  return jsonb_build_object('cambiadas', v_hechas, 'sin_cardmarket', v_sin);
end;
$$;

revoke all on function public.tienda_stock_lista(jsonb, text, int, int) from public;
grant execute on function public.tienda_stock_lista(jsonb, text, int, int) to authenticated;
revoke all on function public.tienda_stock_precio_bloque(uuid[], numeric, text) from public;
grant execute on function public.tienda_stock_precio_bloque(uuid[], numeric, text) to authenticated;

notify pgrst, 'reload schema';
