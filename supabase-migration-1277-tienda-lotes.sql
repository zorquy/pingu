-- ============================================================
-- Tanda 1277 — EL LOTE SIN DESGLOSAR (comprar o cambiar deprisa)
-- ============================================================
-- Una tienda en un evento: el cambio es lento porque cada carta del cliente
-- hay que buscarla (idioma, estado, versión) con él delante. PINGU eligió la
-- opción A: lo que te da es UN LOTE: escribes lo que vale en total, la web
-- aplica tu tanto por ciento, le haces una foto y cierras. Las cartas se
-- apuntan luego, con calma.
--
--   1. `tienda_lotes`: un lote comprado (o recibido en un cambio) sin decir
--      qué cartas lleva: lo que vale, lo que costó, cuántas cartas más o
--      menos, la foto (cubo `tienda-fotos`, carpeta de la tienda) y si ya se
--      desglosó. Solo lo ve su tienda; escriben las funciones.
--   2. `tienda_compras.lote_id`: el lote es UNA LÍNEA de la compra (ni carta
--      ni producto), con su coste. Así la caja, el cierre del mes, Compras,
--      el recibo, el cambio y Deshacer lo cuentan sin tocarlos. Y
--      `tienda_compras.de_lote`: la carta que salió de desglosar ese lote.
--   3. `tienda_comprar`: la de la 1255, que además acepta líneas
--      `{ "lote": true, "coste", "valorado", "cartas", "foto", "pct" }`. Un
--      lote no entra al stock (no se sabe qué hay): espera a desglosarse.
--   4. `tienda_repartir(total, lineas)`: el coste de un lote repartido entre
--      sus cartas según lo que vale cada una. Es `repartirTotal` de
--      js/tiendas-puro.js, la misma regla (la prueba 1277 las compara).
--   5. `tienda_lote_desglosar(lote, lineas)`: cambia la línea del lote por
--      sus cartas, con el MISMO ticket, día, pago y cliente, y el coste
--      repartido (suma lo que costó el lote): la caja de aquel día no se
--      mueve. Las cartas entran por poner a la venta, como en Comprar.
--   6. `tienda_deshacer_compra`: la de la 1266, que además se lleva el lote.
--   7. `tienda_compras_lista`: la de la 1266, con el lote (nombre y cartas).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1091, la 1255 y la 1266.
-- ============================================================

begin;

-- ── 1. Los lotes ──
create table if not exists public.tienda_lotes (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- El ticket de la compra (o de la mitad «compra» de un cambio).
  compra_ticket uuid not null,
  -- Lo que vale en total para la tienda (tasado a ojo) y lo que costó.
  vale numeric(10, 2),
  coste numeric(10, 2) not null,
  -- El tanto por ciento con el que se tasó, si salió de ahí (informativo).
  pct int,
  -- Cuántas cartas trae, más o menos (opcional).
  cartas int,
  -- La foto: una ruta dentro del cubo `tienda-fotos` (carpeta de la tienda).
  foto text,
  cliente text,
  estado text not null default 'por_desglosar',
  creado_el timestamptz not null default now(),
  desglosado_el timestamptz,
  -- Las unidades que salieron al desglosarlo.
  desglosadas int,
  constraint tienda_lotes_estado check (estado in ('por_desglosar', 'desglosado')),
  constraint tienda_lotes_dinero check (coste >= 0 and (vale is null or vale >= 0)),
  constraint tienda_lotes_pct check (pct is null or pct between 0 and 200),
  constraint tienda_lotes_cartas check (cartas is null or cartas between 1 and 9999),
  constraint tienda_lotes_foto check (foto is null or char_length(foto) between 3 and 200),
  constraint tienda_lotes_cliente check (cliente is null or char_length(cliente) between 1 and 80)
);
create index if not exists tienda_lotes_tienda_idx on public.tienda_lotes (tienda_id, creado_el desc);
create index if not exists tienda_lotes_por_desglosar on public.tienda_lotes (tienda_id) where estado = 'por_desglosar';
create index if not exists tienda_lotes_ticket_idx on public.tienda_lotes (compra_ticket);

alter table public.tienda_lotes enable row level security;
drop policy if exists tienda_lotes_suyos on public.tienda_lotes;
create policy tienda_lotes_suyos on public.tienda_lotes for select to authenticated
  using (tienda_id = auth.uid());
grant select on public.tienda_lotes to authenticated;

-- ── 2. El lote, una línea de la compra ──
alter table public.tienda_compras add column if not exists lote_id uuid references public.tienda_lotes (id) on delete cascade;
alter table public.tienda_compras add column if not exists de_lote uuid references public.tienda_lotes (id) on delete set null;
alter table public.tienda_compras drop constraint if exists tienda_compras_que;
alter table public.tienda_compras add constraint tienda_compras_que check (num_nonnulls(card_id, product_id, lote_id) = 1);
create index if not exists tienda_compras_lote_idx on public.tienda_compras (lote_id) where lote_id is not null;

-- ── 4. El reparto (antes que quien lo usa) ──
-- [{ "unidades", "cm": lo que vale por unidad o null }] → lo que cuesta cada
-- unidad, en euros, para que todo sume `p_total`. Lo que no tiene valor pesa
-- como la media de las que sí; los céntimos que sobran van a una línea de una
-- unidad (o se reparten mientras quepan). Es `repartirTotal`, paso a paso.
create or replace function public.tienda_repartir(p_total numeric, p_lineas jsonb)
returns numeric[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_t bigint;
  v_k int;
  v_n int[] := '{}';
  v_cm numeric[] := '{}';
  v_pesos numeric[] := '{}';
  v_por bigint[] := '{}';
  v_res numeric[] := '{}';
  v_x jsonb;
  v_v numeric;
  v_con int := 0;
  v_sumcm numeric := 0;
  v_media numeric;
  v_suma numeric := 0;
  v_resto bigint;
  v_una int := 0;
  v_q bigint;
  i int;
begin
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    return '{}';
  end if;
  v_k := jsonb_array_length(p_lineas);
  for v_x in select * from jsonb_array_elements(p_lineas) loop
    v_n := array_append(v_n, greatest(0, round(coalesce(nullif(v_x->>'unidades', '')::numeric, 0)))::int);
    v_v := nullif(v_x->>'cm', '')::numeric;
    v_cm := array_append(v_cm, case when v_v > 0 then v_v end);
  end loop;
  v_t := round(p_total * 100);
  if p_total is null or v_t < 0 or v_k = 0 or not exists (select 1 from unnest(v_n) z where z > 0) then
    return array_fill(null::numeric, array[v_k]);
  end if;
  for i in 1..v_k loop
    if v_cm[i] is not null and v_n[i] > 0 then
      v_con := v_con + 1;
      v_sumcm := v_sumcm + v_cm[i];
    end if;
  end loop;
  v_media := case when v_con > 0 then v_sumcm / v_con else 1 end;
  for i in 1..v_k loop
    v_pesos := array_append(v_pesos, case when v_n[i] > 0 then coalesce(v_cm[i], v_media) * v_n[i] else 0 end);
    v_suma := v_suma + v_pesos[i];
  end loop;
  for i in 1..v_k loop
    v_por := array_append(v_por, case when v_n[i] > 0 then floor(v_t * v_pesos[i] / v_suma / v_n[i])::bigint else 0 end);
  end loop;
  v_resto := v_t;
  for i in 1..v_k loop
    v_resto := v_resto - v_por[i] * v_n[i];
  end loop;
  for i in 1..v_k loop
    if v_n[i] = 1 then
      v_una := i;
      exit;
    end if;
  end loop;
  if v_una > 0 then
    v_por[v_una] := v_por[v_una] + v_resto;
  else
    for i in 1..v_k loop
      exit when v_resto < v_n[i];
      continue when v_n[i] = 0;
      v_q := v_resto / v_n[i];
      v_por[i] := v_por[i] + v_q;
      v_resto := v_resto - v_q * v_n[i];
    end loop;
  end if;
  for i in 1..v_k loop
    v_res := array_append(v_res, case when v_n[i] > 0 then round(v_por[i] / 100.0, 2) end);
  end loop;
  return v_res;
end;
$$;

-- ── 3. Comprar, con lotes ──
-- `p_lineas`: las de la 1255 ({ "card_id" | "product_id", "market",
-- "idioma", "estado", "variante", "gradeo", "unidades", "coste", "valorado",
-- "cm" }) y, además, lotes: { "lote": true, "coste": lo que pagas (o cuenta)
-- por el lote entero, "valorado": lo que vale en total, "cartas": cuántas,
-- "foto": la ruta, "pct" }.
create or replace function public.tienda_comprar(p_lineas jsonb, p_cliente text default null, p_pago text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_cliente text := nullif(btrim(coalesce(p_cliente, '')), '');
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_linea jsonb;
  v_card text;
  v_prod bigint;
  v_market text;
  v_idioma text;
  v_estado text;
  v_variante text;
  v_gradeo text;
  v_n int;
  v_coste numeric;
  v_cm numeric;
  v_valor numeric;
  v_stock uuid;
  v_lote uuid;
  v_cartas int;
  v_foto text;
  v_pct int;
  v_total numeric := 0;
  v_valorado numeric := 0;
  v_unidades int := 0;
  v_lineas int := 0;
  v_lotes int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;
  if v_pago is not null and v_pago not in ('efectivo', 'bizum', 'paypal', 'otro') then
    raise exception 'Esa forma de pago no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay nada que comprar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por compra.' using errcode = '22023';
  end if;
  if v_cliente is not null and char_length(v_cliente) > 80 then
    raise exception 'El nombre del cliente, como mucho 80 letras.' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_coste := round((v_linea->>'coste')::numeric, 2);
    v_valor := round(nullif(v_linea->>'valorado', '')::numeric, 2);
    if v_coste is null or v_coste < 0 then
      raise exception 'Cada línea lleva lo que pagas.' using errcode = '22023';
    end if;
    if v_valor is not null and v_valor < 0 then
      raise exception 'Revisa lo que vale.' using errcode = '22023';
    end if;

    -- Un lote: no entra al stock (no se sabe qué lleva); espera a desglosarse.
    if coalesce(v_linea->>'lote', 'false') = 'true' then
      v_cartas := nullif(v_linea->>'cartas', '')::int;
      v_foto := nullif(btrim(coalesce(v_linea->>'foto', '')), '');
      v_pct := nullif(v_linea->>'pct', '')::numeric::int;
      if v_cartas is not null and (v_cartas < 1 or v_cartas > 9999) then
        raise exception 'Revisa cuántas cartas trae el lote.' using errcode = '22023';
      end if;
      -- La foto, en la carpeta de la tienda (la política del cubo, 1235).
      if v_foto is not null and (v_foto not like v_uid::text || '/lotes/%' or char_length(v_foto) > 200 or v_foto like '%..%') then
        raise exception 'Esa foto no es de tu tienda.' using errcode = '22023';
      end if;
      if v_pct is not null and (v_pct < 0 or v_pct > 200) then
        raise exception 'Revisa el tanto por ciento.' using errcode = '22023';
      end if;
      insert into tienda_lotes (tienda_id, compra_ticket, vale, coste, pct, cartas, foto, cliente)
      values (v_uid, v_ticket, v_valor, v_coste, v_pct, v_cartas, v_foto, v_cliente)
      returning id into v_lote;
      insert into tienda_compras (tienda_id, ticket, lote_id, market, idioma, estado, variante, unidades, coste, cliente, pago, valorado)
      values (v_uid, v_ticket, v_lote, 'WEST', '', 'lote', 'normal', 1, v_coste, v_cliente, v_pago, v_valor);
      v_lineas := v_lineas + 1;
      v_lotes := v_lotes + 1;
      v_unidades := v_unidades + coalesce(v_cartas, 1);
      v_total := v_total + v_coste;
      v_valorado := v_valorado + coalesce(v_valor, 0);
      continue;
    end if;

    v_card := nullif(v_linea->>'card_id', '');
    v_prod := nullif(v_linea->>'product_id', '')::bigint;
    v_market := coalesce(nullif(v_linea->>'market', ''), 'WEST');
    v_n := (v_linea->>'unidades')::int;
    v_cm := round(nullif(v_linea->>'cm', '')::numeric, 2);
    if (v_card is null) = (v_prod is null) then
      raise exception 'Cada línea es una carta o un producto.' using errcode = '22023';
    end if;
    if v_n is null or v_n < 1 or v_n > 99999 then
      raise exception 'Cada línea compra al menos una unidad.' using errcode = '22023';
    end if;
    if v_card is not null then
      if not exists (select 1 from tcg_cards where id = v_card and market = v_market) then
        raise exception 'Una de las cartas no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), case when v_market = 'JP' then 'ja' else 'es' end);
      v_estado := coalesce(nullif(v_linea->>'estado', ''), 'NM');
      v_variante := coalesce(nullif(v_linea->>'variante', ''), 'normal');
      v_gradeo := nullif(btrim(coalesce(v_linea->>'gradeo', '')), '');
    else
      if not exists (select 1 from tcg_products where id = v_prod) then
        raise exception 'Uno de los productos no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), 'en');
      v_estado := 'sellado';
      v_variante := 'normal';
      v_gradeo := null;
    end if;

    -- Una línea NUEVA, oculta y por poner a la venta, con su coste exacto.
    insert into tienda_stock (tienda_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, valorado, precio, visible, por_poner, entro_el)
    values (v_uid, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_valor, null, false, true, now())
    returning id into v_stock;

    insert into tienda_compras (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, cm, cliente, pago, valorado)
    values (v_uid, v_ticket, v_stock, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_cm, v_cliente, v_pago, v_valor);

    v_lineas := v_lineas + 1;
    v_unidades := v_unidades + v_n;
    v_total := v_total + v_coste * v_n;
    v_valorado := v_valorado + coalesce(v_valor, v_cm, 0) * v_n;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'unidades', v_unidades, 'total', v_total, 'valorado', v_valorado, 'pago', v_pago, 'lotes', v_lotes);
end;
$$;

-- ── 5. Desglosar un lote ──
-- `p_lineas`: las cartas (o productos) que había, como las de Comprar pero sin
-- «coste»: lo pone el reparto, según lo que vale cada una (`valorado` o, sin
-- él, `cm`). La línea del lote se cambia por ellas en la MISMA compra.
create or replace function public.tienda_lote_desglosar(p_lote uuid, p_lineas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_l tienda_lotes%rowtype;
  v_c tienda_compras%rowtype;
  v_costes numeric[];
  v_linea jsonb;
  v_i int;
  v_card text;
  v_prod bigint;
  v_market text;
  v_idioma text;
  v_estado text;
  v_variante text;
  v_gradeo text;
  v_n int;
  v_cm numeric;
  v_valor numeric;
  v_stock uuid;
  v_total numeric := 0;
  v_unidades int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  select * into v_l from tienda_lotes where id = p_lote and tienda_id = v_uid for update;
  if not found then
    raise exception 'Ese lote no existe.' using errcode = 'P0002';
  end if;
  if v_l.estado <> 'por_desglosar' then
    raise exception 'Ese lote ya está desglosado.' using errcode = 'P0001';
  end if;
  select * into v_c from tienda_compras where lote_id = p_lote and tienda_id = v_uid for update;
  if not found then
    raise exception 'La compra de ese lote ya no existe.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Añade al menos una carta del lote.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por lote.' using errcode = '22023';
  end if;

  v_costes := tienda_repartir(v_c.coste * v_c.unidades, (
    select jsonb_agg(jsonb_build_object('unidades', e->'unidades', 'cm', coalesce(nullif(e->>'valorado', ''), nullif(e->>'cm', ''))::numeric) order by o)
    from jsonb_array_elements(p_lineas) with ordinality as t (e, o)));

  for v_linea, v_i in select e, o::int from jsonb_array_elements(p_lineas) with ordinality as t (e, o) order by o loop
    v_card := nullif(v_linea->>'card_id', '');
    v_prod := nullif(v_linea->>'product_id', '')::bigint;
    v_market := coalesce(nullif(v_linea->>'market', ''), 'WEST');
    v_n := (v_linea->>'unidades')::int;
    v_cm := round(nullif(v_linea->>'cm', '')::numeric, 2);
    v_valor := round(nullif(v_linea->>'valorado', '')::numeric, 2);
    if (v_card is null) = (v_prod is null) then
      raise exception 'Cada línea es una carta o un producto.' using errcode = '22023';
    end if;
    if v_n is null or v_n < 1 or v_n > 99999 then
      raise exception 'Cada línea lleva al menos una unidad.' using errcode = '22023';
    end if;
    if v_valor is not null and v_valor < 0 then
      raise exception 'Revisa lo que vale.' using errcode = '22023';
    end if;
    if v_card is not null then
      if not exists (select 1 from tcg_cards where id = v_card and market = v_market) then
        raise exception 'Una de las cartas no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), case when v_market = 'JP' then 'ja' else 'es' end);
      v_estado := coalesce(nullif(v_linea->>'estado', ''), 'NM');
      v_variante := coalesce(nullif(v_linea->>'variante', ''), 'normal');
      v_gradeo := nullif(btrim(coalesce(v_linea->>'gradeo', '')), '');
    else
      if not exists (select 1 from tcg_products where id = v_prod) then
        raise exception 'Uno de los productos no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), 'en');
      v_estado := 'sellado';
      v_variante := 'normal';
      v_gradeo := null;
    end if;

    insert into tienda_stock (tienda_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, valorado, precio, visible, por_poner, entro_el)
    values (v_uid, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_costes[v_i], v_valor, null, false, true, now())
    returning id into v_stock;

    insert into tienda_compras (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, cm, cliente, pago, valorado, comprada_el, de_lote)
    values (v_uid, v_c.ticket, v_stock, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_costes[v_i], v_cm, v_c.cliente, v_c.pago, v_valor, v_c.comprada_el, p_lote);

    v_lineas := v_lineas + 1;
    v_unidades := v_unidades + v_n;
    v_total := v_total + v_costes[v_i] * v_n;
  end loop;

  delete from tienda_compras where id = v_c.id;
  update tienda_lotes set estado = 'desglosado', desglosado_el = now(), desglosadas = v_unidades where id = p_lote;

  return jsonb_build_object('lote', p_lote, 'ticket', v_c.ticket, 'lineas', v_lineas, 'unidades', v_unidades, 'total', v_total);
end;
$$;

-- ── 6. Deshacer una compra, con su lote ──
-- La de la 1266, y al final se lleva los lotes de ese ticket (por desglosar o
-- ya desglosados: sus cartas salen del stock en el bucle).
create or replace function public.tienda_deshacer_compra(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_compra record;
  v_quedan int;
  v_borradas int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;
  if exists (select 1 from tienda_cambios where compra_ticket = p_ticket and tienda_id = v_uid) then
    raise exception 'Esta compra es parte de un cambio: deshaz el cambio entero.' using errcode = 'P0001';
  end if;
  for v_compra in select * from tienda_compras where ticket = p_ticket and tienda_id = v_uid for update loop
    v_lineas := v_lineas + 1;
    if v_compra.stock_id is not null then
      select unidades into v_quedan from tienda_stock where id = v_compra.stock_id and tienda_id = v_uid for update;
      if found and v_quedan < v_compra.unidades then
        raise exception 'Ya has vendido alguna de esta compra: quítalas del stock a mano.' using errcode = 'P0001';
      end if;
      if found then
        if v_quedan = v_compra.unidades then
          delete from tienda_stock where id = v_compra.stock_id;
          v_borradas := v_borradas + 1;
        else
          update tienda_stock set unidades = unidades - v_compra.unidades, updated_at = now() where id = v_compra.stock_id;
        end if;
      end if;
    end if;
    delete from tienda_compras where id = v_compra.id;
  end loop;
  if v_lineas = 0 then
    raise exception 'Esa compra ya no existe.' using errcode = 'P0002';
  end if;
  delete from tienda_lotes where compra_ticket = p_ticket and tienda_id = v_uid;
  return jsonb_build_object('lineas', v_lineas, 'borradas', v_borradas);
end;
$$;

-- ── 7. La lista de Compras, con el lote ──
-- La de la 1266, y además `lote_id`, `de_lote`, `cartas` y el nombre de un
-- lote («Lote sin desglosar»).
create or replace function public.tienda_compras_lista(
  p_filtros jsonb default '{}'::jsonb,
  p_desde int default 0,
  p_cuantas int default 100
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
  v_q text := lower(btrim(coalesce(p_filtros->>'q', '')));
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;

  with
  base as (
    select v.*,
      c.set_id, c.local_id as numero,
      coalesce(c.name_es, c.name, p.name, case when v.lote_id is not null then 'Lote sin desglosar' end) as nombre,
      l.cartas,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '') || ' ' || coalesce(v.cliente, '') || case when v.lote_id is not null then ' lote' else '' end) as texto
    from tienda_compras v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    left join tienda_lotes l on l.id = v.lote_id
    where v.tienda_id = v_uid
      and (p_filtros->>'desde' is null or v.comprada_el >= (p_filtros->>'desde')::timestamptz)
      and (p_filtros->>'hasta' is null or v.comprada_el < (p_filtros->>'hasta')::timestamptz)
  ),
  filtrada as (
    select * from base b
    where v_q = '' or b.numero = v_q or not exists (
      select 1 from unnest(regexp_split_to_array(v_q, '\s+')) palabra where position(palabra in b.texto) = 0
    )
  ),
  ordenada as (
    select f.*, row_number() over (order by f.comprada_el desc, f.ticket, f.id) as puesto from filtrada f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'tickets', (select count(distinct ticket) from filtrada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'importe', (select coalesce(sum(coste * unidades), 0) from filtrada),
      'cm', (select coalesce(sum(cm * unidades), 0) from filtrada where cm is not null),
      'importe_con_cm', (select coalesce(sum(coste * unidades), 0) from filtrada where cm is not null)
    ),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'ticket', ticket, 'stock_id', stock_id, 'card_id', card_id, 'market', market, 'product_id', product_id,
      'lote_id', lote_id, 'de_lote', de_lote, 'cartas', cartas,
      'nombre', nombre, 'set_id', set_id, 'numero', numero,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'coste', coste, 'cm', cm, 'valorado', valorado, 'cliente', cliente, 'pago', pago, 'comprada_el', comprada_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.tienda_repartir(numeric, jsonb) from public, anon;
grant execute on function public.tienda_repartir(numeric, jsonb) to authenticated;
revoke all on function public.tienda_comprar(jsonb, text, text) from public, anon;
grant execute on function public.tienda_comprar(jsonb, text, text) to authenticated;
revoke all on function public.tienda_lote_desglosar(uuid, jsonb) from public, anon;
grant execute on function public.tienda_lote_desglosar(uuid, jsonb) to authenticated;
revoke all on function public.tienda_deshacer_compra(uuid) from public, anon;
grant execute on function public.tienda_deshacer_compra(uuid) to authenticated;
revoke all on function public.tienda_compras_lista(jsonb, int, int) from public, anon;
grant execute on function public.tienda_compras_lista(jsonb, int, int) to authenticated;

commit;

notify pgrst, 'reload schema';
