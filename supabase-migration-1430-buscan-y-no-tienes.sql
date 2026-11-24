-- Tanda 1430 — Lo que busca la gente y NO tienes (de «Funciones de tienda»,
-- PINGU: «me gustan todas»). El Panel ya enseñaba lo que se busca y la tienda
-- tiene (`tienda_hoy`, 1073); esto es la otra mitad: lo que más gente tiene en
-- «La quiero» y la tienda no tiene a la venta. Es lo que solo PokeDoc le puede
-- dar a una tienda: qué comprar. Y en el Mostrador, al Comprar, cuántos buscan
-- la carta que te traen.
--
-- Como en la 1073 y la 1089: CUÁNTOS, nunca quiénes. Y en la lista del Panel
-- solo las cartas que buscan al menos DOS personas: con una sola, en una
-- ciudad pequeña, «1 la busca» es casi decir quién.
--
-- Sin tablas nuevas; sentencia a sentencia (la 631).

-- La lista del Panel: lo más buscado que la tienda no tiene con unidades.
-- Cuentan las personas (no otras tiendas), sin baneados y sin ella misma.
create or replace function public.tienda_buscan_y_no_tienes(p_limite int default 8)
returns table (card_id text, market text, nombre text, set_id text, numero text, quieren int, cardmarket numeric)
language sql
stable
security definer
set search_path = public
as $$
  select w.card_id, c.market, coalesce(c.name_es, c.name), c.set_id, c.local_id,
         count(distinct w.user_id)::int,
         coalesce(pr.cm_trend, pr.cm_trend_holo, pr.cm_avg30)
  from user_wants w
  join tcg_cards c on c.id = w.card_id
  join user_profiles u on u.id = w.user_id and coalesce(u.tipo, 'persona') <> 'tienda' and not coalesce(u.is_banned, false)
  left join tcg_card_prices pr on pr.card_id = w.card_id
  where exists (select 1 from user_profiles yo where yo.id = auth.uid() and yo.tipo = 'tienda')
    and w.user_id <> auth.uid()
    and not exists (select 1 from tienda_stock s where s.tienda_id = auth.uid() and s.card_id = w.card_id and s.unidades > 0)
  group by w.card_id, c.market, c.name_es, c.name, c.set_id, c.local_id, pr.cm_trend, pr.cm_trend_holo, pr.cm_avg30
  having count(distinct w.user_id) >= 2
  order by count(distinct w.user_id) desc, coalesce(pr.cm_trend, pr.cm_trend_holo, pr.cm_avg30) desc nulls last, w.card_id
  limit greatest(1, least(coalesce(p_limite, 8), 50));
$$;
revoke all on function public.tienda_buscan_y_no_tienes(int) from public;
grant execute on function public.tienda_buscan_y_no_tienes(int) to authenticated;

-- En Comprar: de estas cartas, cuántas personas las buscan. Como en el Panel,
-- solo las que buscan dos o más (las demás no vuelven). Solo lo pregunta una tienda.
create or replace function public.tienda_quieren(p_cards text[])
returns table (card_id text, quieren int)
language sql
stable
security definer
set search_path = public
as $$
  select w.card_id, count(distinct w.user_id)::int
  from user_wants w
  join user_profiles u on u.id = w.user_id and coalesce(u.tipo, 'persona') <> 'tienda' and not coalesce(u.is_banned, false)
  where exists (select 1 from user_profiles yo where yo.id = auth.uid() and yo.tipo = 'tienda')
    and w.user_id <> auth.uid()
    and w.card_id = any ((coalesce(p_cards, '{}'::text[]))[1:60])
  group by w.card_id
  having count(distinct w.user_id) >= 2;
$$;
revoke all on function public.tienda_quieren(text[]) from public;
grant execute on function public.tienda_quieren(text[]) to authenticated;
