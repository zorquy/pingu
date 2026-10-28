-- ============================================================
-- Tanda 1073: «Hoy» de una tienda, con cifras.
--
-- PINGU, el primer día: «resumen diario, semanal, mensual, anual». Lo que
-- vendió y lo que ganó en el periodo (con el anterior al lado, cortado a la
-- misma altura: «que ayer a esta hora»), la serie para la gráfica, el valor
-- del stock, los avisos (los mismos criterios que los filtros del stock),
-- lo que busca la gente y tiene la tienda (solo CUÁNTOS, sin nombres: lo
-- eligió PINGU) y las visitas a su escaparate.
--
--   1. `tienda_visitas`: una fila por tienda y día (cuántas visitas, y
--      cuántas desde el QR). Sin quién: el registro de visitas de PokeDoc
--      junta los perfiles en «/usuario» a propósito (page-views.js), y aquí
--      tampoco se apunta quién mira a quién. La escribe
--      `tienda_contar_visita`, que cualquiera puede llamar al abrir una.
--   2. `tienda_hoy(desde, hasta, antes_desde, antes_hasta, paso, zona)`.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067, la 1068 y la 1072.
-- ============================================================

-- ── 1. Las visitas al escaparate ──
create table if not exists public.tienda_visitas (
  tienda_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  visitas int not null default 0,
  qr int not null default 0,
  primary key (tienda_id, dia)
);
alter table public.tienda_visitas enable row level security;
drop policy if exists tienda_visitas_suyas on public.tienda_visitas;
create policy tienda_visitas_suyas on public.tienda_visitas for select to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda());
grant select on public.tienda_visitas to authenticated;

-- Una visita a un escaparate. La propia tienda no cuenta, ni el perfil de
-- quien no es tienda. Con o sin cuenta: el escaparate se ve sin ella.
create or replace function public.tienda_contar_visita(p_tienda uuid, p_qr boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tienda is null or auth.uid() is not distinct from p_tienda then return; end if;
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda') then return; end if;
  insert into tienda_visitas (tienda_id, dia, visitas, qr)
  values (p_tienda, (now() at time zone 'Europe/Madrid')::date, 1, case when p_qr then 1 else 0 end)
  on conflict (tienda_id, dia) do update
    set visitas = tienda_visitas.visitas + 1, qr = tienda_visitas.qr + excluded.qr;
end;
$$;
revoke all on function public.tienda_contar_visita(uuid, boolean) from public;
grant execute on function public.tienda_contar_visita(uuid, boolean) to anon, authenticated;

-- ── 2. Hoy ──
-- Los periodos los arma el navegador en la hora de quien mira (`desde`
-- incluido, `hasta` sin incluir); `paso` es el trozo de la gráfica (hour,
-- day o month) y `zona` dónde se cortan los días.
create or replace function public.tienda_hoy(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_antes_desde timestamptz default null,
  p_antes_hasta timestamptz default null,
  p_paso text default 'day',
  p_zona text default 'Europe/Madrid'
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
  -- Las visitas van por días: un límite a media tarde cuenta su día entero.
  v_d1 date := (p_desde at time zone p_zona)::date;
  v_d2 date := (p_hasta at time zone p_zona)::date + case when (p_hasta at time zone p_zona)::time = '00:00' then 0 else 1 end;
  v_a1 date := (p_antes_desde at time zone p_zona)::date;
  v_a2 date := (p_antes_hasta at time zone p_zona)::date + case when (p_antes_hasta at time zone p_zona)::time = '00:00' then 0 else 1 end;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene panel.' using errcode = '42501';
  end if;
  if p_paso not in ('hour', 'day', 'month') then
    raise exception 'Ese paso no existe.' using errcode = '22023';
  end if;

  with
  ventas as (
    select vendida_el, ticket, unidades, precio * unidades as importe,
      case when coste is not null then (precio - coste) * unidades end as beneficio,
      coste * unidades as coste
    from tienda_ventas
    where tienda_id = v_uid
      and vendida_el >= least(p_desde, coalesce(p_antes_desde, p_desde))
      and vendida_el < greatest(p_hasta, coalesce(p_antes_hasta, p_hasta))
  ),
  -- El stock, con el Cardmarket de su idioma: la cuenta de `tienda_stock_lista`.
  stock as (
    select s.unidades, s.precio, s.coste, s.entro_el,
      case
        when s.product_id is not null then (select coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) from tcg_products p where p.id = s.product_id)
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_card_prices pr on pr.card_id = s.card_id
    where s.tienda_id = v_uid
  ),
  -- Lo que se busca y tiene: la regla de un deseo de siempre (1047), solo lo
  -- que se ve en el escaparate con unidades, y sin decir quién lo busca.
  demanda as (
    select s.card_id, s.market, sum(s.unidades) as tienes,
      (select count(distinct w.user_id) from user_wants w
        where w.card_id = s.card_id and w.user_id <> v_uid
          and exists (select 1 from tienda_stock s2 where s2.tienda_id = v_uid and s2.card_id = s.card_id and s2.unidades > 0 and s2.visible
            and (w.idioma is null or w.idioma = s2.idioma) and (w.variante is null or w.variante = s2.variante))) as quieren
    from tienda_stock s
    where s.tienda_id = v_uid and s.card_id is not null and s.unidades > 0 and s.visible
    group by s.card_id, s.market
  ),
  pasos as (
    select t from generate_series(
      date_trunc(p_paso, p_desde at time zone p_zona),
      date_trunc(p_paso, (p_hasta - interval '1 microsecond') at time zone p_zona),
      ('1 ' || p_paso)::interval) t
  )
  select jsonb_build_object(
    'actual', (select jsonb_build_object(
        'importe', coalesce(sum(importe), 0), 'beneficio', sum(beneficio), 'coste', coalesce(sum(coste), 0),
        'unidades', coalesce(sum(unidades), 0), 'ventas', count(distinct ticket), 'sin_coste', count(*) filter (where beneficio is null))
      from ventas where vendida_el >= p_desde and vendida_el < p_hasta),
    'anterior', case when p_antes_desde is null then null else (select jsonb_build_object(
        'importe', coalesce(sum(importe), 0), 'beneficio', sum(beneficio), 'coste', coalesce(sum(coste), 0),
        'unidades', coalesce(sum(unidades), 0), 'ventas', count(distinct ticket))
      from ventas where vendida_el >= p_antes_desde and vendida_el < p_antes_hasta) end,
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('t', to_char(p.t, 'YYYY-MM-DD"T"HH24:MI'), 'importe', coalesce(x.importe, 0)) order by p.t), '[]'::jsonb)
      from pasos p left join lateral (
        select sum(v.importe) as importe from ventas v
        where v.vendida_el >= p_desde and v.vendida_el < p_hasta and date_trunc(p_paso, v.vendida_el at time zone p_zona) = p.t
      ) x on true),
    'stock', (select jsonb_build_object(
        'lineas', count(*), 'unidades', coalesce(sum(unidades), 0),
        'valor', coalesce(sum(precio * unidades), 0), 'cm', coalesce(round(sum(cm * unidades), 2), 0), 'coste', coalesce(sum(coste * unidades), 0))
      from stock),
    -- Los mismos umbrales que `tienda_cumple` (contra «debajo», margen
    -- «pierdes», días «90+», unidades «agotadas»): la prueba los compara.
    'avisos', (select jsonb_build_object(
        'debajo', count(*) filter (where precio is not null and cm > 0 and precio < cm * 0.95),
        'pierden', count(*) filter (where coste > 0 and precio is not null and precio < coste),
        'viejas', count(*) filter (where entro_el <= now() - interval '90 days'),
        'agotadas', count(*) filter (where unidades = 0))
      from stock),
    'demanda', (select coalesce(jsonb_agg(jsonb_build_object(
        'card_id', d.card_id, 'market', d.market, 'quieren', d.quieren, 'tienes', d.tienes,
        'nombre', coalesce(c.name_es, c.name), 'set_id', c.set_id, 'numero', c.local_id) order by d.quieren desc, d.tienes desc, d.card_id), '[]'::jsonb)
      from (select * from demanda where quieren > 0 order by quieren desc, tienes desc, card_id limit 8) d
      left join tcg_cards c on c.id = d.card_id and c.market = d.market),
    'visitas', jsonb_build_object(
      'actual', (select coalesce(sum(visitas), 0) from tienda_visitas where tienda_id = v_uid and dia >= v_d1 and dia < v_d2),
      'qr', (select coalesce(sum(qr), 0) from tienda_visitas where tienda_id = v_uid and dia >= v_d1 and dia < v_d2),
      'anterior', case when p_antes_desde is null then null else (select coalesce(sum(visitas), 0) from tienda_visitas where tienda_id = v_uid and dia >= v_a1 and dia < v_a2) end)
  ) into v_res;
  return v_res;
end;
$$;
revoke all on function public.tienda_hoy(timestamptz, timestamptz, timestamptz, timestamptz, text, text) from public;
grant execute on function public.tienda_hoy(timestamptz, timestamptz, timestamptz, timestamptz, text, text) to authenticated;
