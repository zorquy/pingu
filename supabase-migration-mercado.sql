-- ════════════════════════════════════════════════════════════════════
-- El Mercado de Deseos y cambios (tanda 770)
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «quiero que salga públicamente lo que la gente tiene para
-- cambio aunque tú no lo desees». Hasta ahora lo que alguien da solo se
-- veía de dos maneras: cruzado con TU lista (los cruces) o carta a carta
-- en su ficha (`intercambios_de_carta`). El Mercado es la tercera: todo
-- lo que se da, agrupado por CARTA, con quién lo da.
--
-- No abre nada nuevo: marcar `cambio > 0` ya es decir en voz alta «doy
-- esta carta» (supabase-migration-intercambios.sql), y la ficha de cada
-- carta ya lo enseña sin cuenta. Aquí solo se junta. Por eso va a `anon`
-- también, como `intercambios_de_carta`.
--
-- UNA FILA POR CARTA, no por copia ni por persona: el Mercado es una
-- rejilla de cartas, y quién la da (con su idioma y su estado) lo pide la
-- ficha de esa carta a `intercambios_de_carta`, que ya existe. Lo que la
-- baldosa necesita viene aquí: cuánta gente, cuántas copias, en qué
-- idiomas, las cinco primeras personas para los avatares y TODAS las ids
-- (`dan`), que es con lo que el navegador marca «Cruce» —si alguna de
-- esas personas busca algo que tú das—.
--
-- Lo tuyo no sale: el Mercado es lo que dan los demás.
--
-- Se ejecuta en el SQL Editor. Es re-ejecutable. Sin tablas temporales
-- (la regla de la 631): todo va en una sentencia.

-- Lo que se pide siempre: lo que se da, de un catálogo, lo más nuevo
-- primero.
create index if not exists user_collection_mercado_idx
  on public.user_collection (market, updated_at desc) where cambio > 0;

drop function if exists public.intercambios_mercado(text, text, text, text[], boolean, text, int, int);

create or replace function public.intercambios_mercado(
  p_market text default 'WEST',
  p_idioma text default null,
  p_texto text default null,
  p_sets text[] default null,
  p_solo_mias boolean default false,
  p_orden text default 'nuevo',
  p_limite int default 60,
  p_desde int default 0
)
returns table (
  card_id text,
  market text,
  personas int,
  copias int,
  idiomas text[],
  dan uuid[],
  gente jsonb,
  ultima timestamptz,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with dan as (
    select c.card_id, c.market, c.user_id, c.idioma, c.cambio, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where c.cambio > 0
      and c.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and c.user_id is distinct from auth.uid()
      and (p_idioma is null or c.idioma = p_idioma)
      -- El texto llega ya normalizado (minúsculas, sin acentos), que es
      -- como está `name_search`, columna generada.
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.set_id = any (p_sets)))
      -- «Solo las que busco»: con la misma regla de idioma que los cruces
      -- (un deseo sin idioma vale cualquiera).
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = c.card_id
          and (w.idioma is null or w.idioma = c.idioma)))
  ),
  -- Una persona puede dar la misma carta en dos líneas (en dos idiomas):
  -- en los avatares sale una vez.
  por_persona as (
    select d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url,
           d.is_admin, d.is_moderator, max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url, d.is_admin, d.is_moderator
  ),
  por_carta as (
    select d.card_id, d.market,
           count(distinct d.user_id)::int as personas,
           sum(d.cambio)::int as copias,
           array_agg(distinct d.idioma order by d.idioma) as idiomas,
           max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market
  )
  select pc.card_id, pc.market, pc.personas, pc.copias, pc.idiomas,
         (select array_agg(pp.user_id order by pp.ultima desc)
            from por_persona pp where pp.card_id = pc.card_id and pp.market = pc.market) as dan,
         (select jsonb_agg(jsonb_build_object(
                   'user_id', s.user_id, 'username', s.username, 'display_name', s.display_name,
                   'avatar_url', s.avatar_url, 'is_admin', s.is_admin, 'is_moderator', s.is_moderator)
                 order by s.ultima desc)
            from (select * from por_persona pp
                  where pp.card_id = pc.card_id and pp.market = pc.market
                  order by pp.ultima desc limit 5) s) as gente,
         pc.ultima,
         count(*) over () as total
  from por_carta pc
  left join public.tcg_card_prices pr on pr.card_id = pc.card_id
  order by
    case when p_orden = 'gente' then pc.personas end desc nulls last,
    case when p_orden = 'caro' then coalesce(pr.cm_low, pr.cm_trend) end desc nulls last,
    pc.ultima desc,
    pc.card_id
  limit greatest(1, least(coalesce(p_limite, 60), 200))
  offset greatest(0, coalesce(p_desde, 0));
$$;

grant execute on function public.intercambios_mercado(text, text, text, text[], boolean, text, int, int) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- Comprobación (opcional)
-- ────────────────────────────────────────────────────────────────────
-- select card_id, personas, copias, idiomas from public.intercambios_mercado() limit 10;
