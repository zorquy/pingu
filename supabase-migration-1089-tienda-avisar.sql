-- ============================================================
-- Tanda 1089: «Avisar a los que la buscan».
--
-- Del Panel de una tienda, «Lo que busca la gente y tienes»: la tienda toca
-- «Avisar» y a cada persona que tiene esa carta en «La quiero» (con la regla
-- de un deseo de siempre: el idioma y la versión, 1047) le llega un aviso a la
-- campanita, «<tienda> tiene <carta>», que abre el escaparate con esa carta.
-- Lo eligió PINGU con las opciones de la propuesta:
--
--   · Lo manda la tienda con su botón; nada sale solo.
--   · UN aviso por persona, carta y tienda: `tienda_avisos` apunta a quién se
--     avisó, y volver a tocar solo avisa a los que la han pedido DESPUÉS.
--   · Cada uno lo apaga en /ajustes («Cuando una tienda tiene una carta que
--     buscas», tipo `tienda_la_tiene`), y quien lo apagó no cuenta.
--   · La tienda nunca ve QUIÉN: solo cuántos. `tienda_avisos` no tiene
--     ninguna política (nadie la lee desde la web) y las dos funciones
--     devuelven cifras.
--
--   1. `tienda_avisos` (tienda, carta, catálogo, persona, cuándo).
--   2. `tienda_por_avisar(tienda, carta, catálogo)`: a quién le tocaría hoy.
--      Interna: no se le da a nadie.
--   3. `tienda_avisos_de(cartas)`: por cada carta, cuántos quedan por avisar
--      y cuántos se avisaron (y cuándo, la última vez). Lo pide el Panel.
--   4. `tienda_avisar(carta, catálogo)`: escribe los avisos y los apunta.
--
-- Los push los manda `enviar-push` solo, como cualquier fila de
-- `user_notifications`. Se puede ejecutar más de una vez. Sin tablas
-- temporales (la 631). Necesita la 1067, la 1068 y la 1047 (versión de un
-- deseo).
-- ============================================================

-- ── 1. A quién se avisó ──
create table if not exists public.tienda_avisos (
  tienda_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  market text not null default 'WEST',
  user_id uuid not null references auth.users (id) on delete cascade,
  avisado_el timestamptz not null default now(),
  primary key (tienda_id, card_id, market, user_id)
);
alter table public.tienda_avisos enable row level security;
-- Sin políticas a propósito: lo que hay dentro es QUIÉN busca qué, y la
-- tienda no debe verlo. Solo la leen y escriben las funciones de abajo.
revoke all on public.tienda_avisos from anon, authenticated;

-- ── 2. A quién le tocaría ──
-- La regla de `demanda` en `tienda_hoy` (1073): lo que se ve en el escaparate
-- con unidades, y un deseo que casa en idioma y versión. Más: que no sea otra
-- tienda (su cuenta solo tiene su panel, 1071, y no abriría el aviso), que no
-- lo haya apagado y que esta tienda no le haya avisado ya de esta carta.
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
    and not (coalesce(u.notification_prefs_disabled, '{}') @> array['tienda_la_tiene'])
    and not exists (select 1 from tienda_avisos a
      where a.tienda_id = p_tienda and a.card_id = p_card and a.market = p_market and a.user_id = w.user_id)
$$;
revoke all on function public.tienda_por_avisar(uuid, text, text) from public, anon, authenticated;

-- ── 3. Cuántos, por carta ──
-- `p_cartas`: [{ "card_id": "…", "market": "WEST" }, …] (las del Panel, ocho
-- como mucho; se cortan a cincuenta por si acaso).
create or replace function public.tienda_avisos_de(p_cartas jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.soy_tienda() then
    raise exception 'Solo una tienda' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'card_id', c.card_id, 'market', c.market,
      'pendientes', (select count(*) from public.tienda_por_avisar(v_uid, c.card_id, c.market)),
      'avisadas', (select count(*) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = c.card_id and a.market = c.market),
      'ultimo', (select max(a.avisado_el) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = c.card_id and a.market = c.market))), '[]'::jsonb)
    from (
      select distinct x->>'card_id' as card_id, coalesce(x->>'market', 'WEST') as market
      from jsonb_array_elements(coalesce(p_cartas, '[]'::jsonb)) x
      where coalesce(x->>'card_id', '') <> ''
      limit 50
    ) c
  );
end;
$$;
revoke all on function public.tienda_avisos_de(jsonb) from public;
grant execute on function public.tienda_avisos_de(jsonb) to authenticated;

-- ── 4. Avisar ──
-- El aviso dice la tienda, la carta y, si la tienda enseña precios, el que
-- cuenta (con la oferta, 1082). Enlaza a su escaparate con esa carta
-- (`?carta=`, 1069). Primero se apunta y luego se avisa, en la misma
-- transacción: o las dos cosas o ninguna.
create or replace function public.tienda_avisar(p_card text, p_market text default 'WEST')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_market text := coalesce(nullif(p_market, ''), 'WEST');
  v_tienda text;
  v_usuario text;
  v_carta text;
  v_precio numeric;
  v_quien uuid[];
begin
  if v_uid is null or not public.soy_tienda() then
    raise exception 'Solo una tienda' using errcode = '42501';
  end if;
  if not exists (select 1 from tienda_stock s where s.tienda_id = v_uid and s.card_id = p_card and s.market = v_market and s.unidades > 0 and s.visible) then
    raise exception 'Esa carta no está a la vista en tu escaparate' using errcode = 'P0001';
  end if;

  select array_agg(user_id) into v_quien from public.tienda_por_avisar(v_uid, p_card, v_market);
  if v_quien is null then
    return jsonb_build_object('avisadas', 0,
      'antes', (select count(*) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = p_card and a.market = v_market));
  end if;

  select coalesce(nullif(u.display_name, ''), u.username, 'Una tienda'), u.username into v_tienda, v_usuario
    from user_profiles u where u.id = v_uid;
  select coalesce(c.name_es, c.name) into v_carta from tcg_cards c where c.id = p_card and c.market = v_market;
  select min(public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta)) into v_precio
    from tienda_stock s
    join tiendas t on t.user_id = s.tienda_id
    where s.tienda_id = v_uid and s.card_id = p_card and s.market = v_market and s.unidades > 0 and s.visible
      and coalesce(t.precio_visible, true);

  insert into tienda_avisos (tienda_id, card_id, market, user_id)
    select v_uid, p_card, v_market, q from unnest(v_quien) q
    on conflict do nothing;

  insert into user_notifications (recipient_id, type, title, body, link)
    select q, 'tienda_la_tiene',
      left(v_tienda || ' tiene ' || coalesce(v_carta, 'una carta que buscas'), 200),
      'Está en tu lista de «La quiero».' ||
        case when v_precio is not null then ' Desde ' || replace(to_char(v_precio, 'FM9999990.00'), '.', ',') || ' €.' else '' end,
      case when v_usuario is not null then '/usuario/' || v_usuario || '?carta=' || p_card else null end
    from unnest(v_quien) q;

  return jsonb_build_object('avisadas', cardinality(v_quien),
    'antes', (select count(*) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = p_card and a.market = v_market) - cardinality(v_quien));
end;
$$;
revoke all on function public.tienda_avisar(text, text) from public;
grant execute on function public.tienda_avisar(text, text) to authenticated;

notify pgrst, 'reload schema';
