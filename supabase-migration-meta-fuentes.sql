-- ─────────────────────────────────────────────────────────────────────
-- LOS MAZOS DEL META, CON TRES FUENTES (tanda 366).
--
-- Hasta la 364, /meta solo contaba los torneos ONLINE de Limitless. PINGU
-- pidió sumar los OFICIALES de Pokémon (regionales, internacionales,
-- especiales y el Mundial) y los torneos de PokeDoc. Cada torneo lleva
-- ahora su `fuente`:
--   · 'online'  — play.limitlesstcg.com (función meta-limitless).
--   · 'oficial' — limitlesstcg.com, que publica los oficiales con las
--                 listas del día 2 (función meta-oficiales).
--   · 'pokedoc' — los torneos terminados y públicos de PokeDoc (función
--                 meta-pokedoc), leídos como el público.
-- Y todas las lecturas aceptan `p_fuente` (null = todas).
--
-- Lo que cambia por fuente:
--   · Retención: lo online se borra a los 65 días (es mucho y cambia
--     rápido); lo oficial y lo de PokeDoc se guarda 400 días (son pocos
--     torneos y se consultan a meses vista).
--   · La lista media: las listas de PokeDoc NO suman cartas, porque el
--     export de TCG Live llega en el idioma de cada jugador y «Órdenes
--     del jefe» y «Boss's Orders» saldrían como dos cartas. Cuentan para
--     el ranking y sus listas se ven; la media sale de Limitless.
--   · Los oficiales no traen resultado (V-D-E), solo puesto: suman 0
--     partidas y no mueven el % de victorias.
--
-- Requiere supabase-migration-meta.sql (tanda 364). Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

alter table public.meta_torneos add column if not exists fuente text not null default 'online';
alter table public.meta_torneos add column if not exists tipo text;
alter table public.meta_torneos add column if not exists enlace text;
alter table public.meta_torneos drop constraint if exists meta_torneos_fuente;
alter table public.meta_torneos add constraint meta_torneos_fuente check (fuente in ('online', 'oficial', 'pokedoc'));
create index if not exists meta_torneos_fuente_idx on public.meta_torneos (fuente, fecha desc);

alter table public.meta_resultados add column if not exists enlace text;

-- ── Ingerir (misma firma: lo nuevo viaja dentro de p_torneo) ──
--   p_torneo: { id, name, date, players, organizerId,
--               fuente?, tipo?, enlace?, contar_cartas? }
--   cada jugador puede traer `enlace` (la lista en su web de origen).
create or replace function public.meta_ingerir_torneo(p_torneo jsonb, p_clasificacion jsonb, p_top int default 8)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id text := p_torneo->>'id';
  v_fecha timestamptz := (p_torneo->>'date')::timestamptz;
  v_dia date := ((p_torneo->>'date')::timestamptz at time zone 'UTC')::date;
  v_fuente text := coalesce(nullif(p_torneo->>'fuente', ''), 'online');
  v_contar boolean := coalesce((p_torneo->>'contar_cartas')::boolean, true);
  v_clasificados int := 0;
  v_con_lista int := 0;
begin
  if v_id is null or v_fecha is null then
    raise exception 'meta_ingerir_torneo: falta el id o la fecha del torneo';
  end if;
  if jsonb_typeof(p_clasificacion) is distinct from 'array' then
    raise exception 'meta_ingerir_torneo: la clasificación no es una lista';
  end if;

  perform 1 from public.meta_torneos where id = v_id for update;
  if found then
    return jsonb_build_object('torneo', v_id, 'ya_leido', true);
  end if;

  create temporary table if not exists _meta_filas (
    jugador text, nombre text, pais text, puesto int, v int, d int, e int,
    abandono int, arquetipo text, arquetipo_nombre text, iconos text[], lista jsonb, enlace text
  ) on commit drop;
  -- Si la tabla venía de la versión de la 364 (sin `enlace`), se rehace.
  if not exists (select 1 from pg_attribute where attrelid = '_meta_filas'::regclass and attname = 'enlace') then
    drop table _meta_filas;
    create temporary table _meta_filas (
      jugador text, nombre text, pais text, puesto int, v int, d int, e int,
      abandono int, arquetipo text, arquetipo_nombre text, iconos text[], lista jsonb, enlace text
    ) on commit drop;
  end if;
  truncate _meta_filas;

  insert into _meta_filas
  select distinct on (x->>'player')
    x->>'player', x->>'name', x->>'country',
    nullif(x->>'placing', '')::int,
    coalesce((x->'record'->>'wins')::int, 0),
    coalesce((x->'record'->>'losses')::int, 0),
    coalesce((x->'record'->>'ties')::int, 0),
    nullif(x->>'drop', '')::int,
    x->'deck'->>'id',
    coalesce(x->'deck'->>'name', x->'deck'->>'id'),
    case when jsonb_typeof(x->'deck'->'icons') = 'array'
      then array(select jsonb_array_elements_text(x->'deck'->'icons')) else '{}' end,
    case when jsonb_typeof(x->'decklist') = 'object' then x->'decklist' end,
    nullif(x->>'enlace', '')
  from jsonb_array_elements(p_clasificacion) x
  where coalesce(x->'deck'->>'id', '') <> '' and coalesce(x->>'player', '') <> '';

  select count(*), count(lista) into v_clasificados, v_con_lista from _meta_filas;

  insert into public.meta_torneos (id, nombre, fecha, jugadores, organizador, clasificados, con_lista, fuente, tipo, enlace)
  values (
    v_id, left(coalesce(p_torneo->>'name', v_id), 200), v_fecha,
    coalesce((p_torneo->>'players')::int, jsonb_array_length(p_clasificacion)),
    nullif(p_torneo->>'organizerId', '')::int,
    v_clasificados, v_con_lista, v_fuente,
    left(nullif(p_torneo->>'tipo', ''), 40), left(nullif(p_torneo->>'enlace', ''), 300)
  );

  if v_clasificados = 0 then
    return jsonb_build_object('torneo', v_id, 'clasificados', 0, 'con_lista', 0);
  end if;

  -- Un arquetipo que ya existe NO se renombra desde PokeDoc: su nombre e
  -- iconos buenos son los de Limitless.
  insert into public.meta_arquetipos as a (id, nombre, iconos, visto_at)
  select distinct on (arquetipo) arquetipo, arquetipo_nombre, iconos, v_fecha
  from _meta_filas
  order by arquetipo
  on conflict (id) do update
    set nombre = case when v_fuente <> 'pokedoc' and excluded.visto_at >= a.visto_at then excluded.nombre else a.nombre end,
        iconos = case when v_fuente <> 'pokedoc' and excluded.visto_at >= a.visto_at and cardinality(excluded.iconos) > 0 then excluded.iconos else a.iconos end,
        visto_at = greatest(a.visto_at, excluded.visto_at);

  insert into public.meta_resultados
    (torneo_id, jugador, arquetipo, puesto, victorias, derrotas, empates, abandono, con_lista, nombre_jugador, pais, lista, enlace)
  select
    v_id, jugador, arquetipo, puesto, v, d, e, abandono, lista is not null,
    case when lista is not null and puesto between 1 and p_top then left(nombre, 80) end,
    case when lista is not null and puesto between 1 and p_top then left(pais, 2) end,
    case when puesto between 1 and p_top then lista end,
    case when puesto between 1 and p_top then left(enlace, 300) end
  from _meta_filas;

  if v_contar then
    with lineas as (
      select f.jugador, f.arquetipo, s.seccion,
        trim(l->>'name') as nombre,
        upper(coalesce(l->>'set', '')) as set_codigo,
        coalesce(l->>'number', '') as numero,
        coalesce((l->>'count')::int, 0) as copias
      from _meta_filas f
      cross join (values ('pokemon'), ('trainer'), ('energy')) as s (seccion)
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(f.lista->s.seccion) = 'array' then f.lista->s.seccion else '[]'::jsonb end
      ) l
      where f.lista is not null
    ),
    claves as (
      select *,
        case when seccion = 'pokemon' then lower(nombre) || '|' || set_codigo || '|' || numero else lower(nombre) end as clave
      from lineas
      where copias > 0 and coalesce(nombre, '') <> ''
    ),
    por_mazo as (
      select jugador, arquetipo, seccion, clave, min(nombre) as nombre,
        (array_agg(set_codigo || ' ' || numero order by copias desc))[1] as impresion,
        sum(copias) as copias
      from claves
      group by jugador, arquetipo, seccion, clave
    ),
    por_arquetipo as (
      select arquetipo, seccion, clave, min(nombre) as nombre,
        mode() within group (order by impresion) as impresion,
        count(*)::int as mazos, sum(copias)::int as copias
      from por_mazo
      group by arquetipo, seccion, clave
    )
    insert into public.meta_cartas_dia as c (dia, arquetipo, seccion, clave, nombre, set_codigo, numero, mazos, copias)
    select v_dia, arquetipo, seccion, clave, nombre,
      split_part(impresion, ' ', 1), split_part(impresion, ' ', 2), mazos, copias
    from por_arquetipo
    on conflict (dia, arquetipo, clave) do update
      set mazos = c.mazos + excluded.mazos,
          copias = c.copias + excluded.copias;
  end if;

  delete from public.meta_torneos where fuente = 'online' and fecha < now() - interval '65 days';
  delete from public.meta_torneos where fuente <> 'online' and fecha < now() - interval '400 days';
  delete from public.meta_cartas_dia where dia < (now() - interval '400 days')::date;

  return jsonb_build_object('torneo', v_id, 'clasificados', v_clasificados, 'con_lista', v_con_lista, 'fuente', v_fuente);
end;
$$;

revoke all on function public.meta_ingerir_torneo(jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.meta_ingerir_torneo(jsonb, jsonb, int) to service_role;

-- Nota sobre la lista media: `meta_cartas_dia` no guarda la fuente (se
-- suma por día y arquetipo). Por eso la lista media cuenta el total de
-- listas de las fuentes que SUMAN cartas (online y oficial) y, si se
-- filtra por fuente, lo hace sobre ese total: es una aproximación que
-- solo se nota los días en que coinciden un oficial y torneos online, y
-- se acepta a cambio de no duplicar la tabla por fuente.

-- ── Las lecturas, con fuente ──
drop function if exists public.meta_resumen(int);
drop function if exists public.meta_totales(int);
drop function if exists public.meta_lista_media(text, int);
drop function if exists public.meta_listas(text, int, int);

-- El largo de la ventana: hasta un año (los oficiales son pocos al mes).
create or replace function public.meta_dias(p_dias int)
returns int
language sql
immutable
as $$ select greatest(1, least(coalesce(p_dias, 14), 365)) $$;

create or replace function public.meta_resumen(p_dias int default 14, p_fuente text default null)
returns table (
  arquetipo text, nombre text, iconos text[],
  mazos int, cuota numeric, cuota_anterior numeric,
  victorias int, derrotas int, empates int, porcentaje_victorias numeric,
  top8 int, torneos int, listas int
)
language sql
stable
set search_path = public
as $$
  with dias as (select public.meta_dias(p_dias) as n),
  base as (
    select r.*, (t.fecha at time zone 'UTC')::date as dia
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - 2 * (select n from dias)
      and (p_fuente is null or t.fuente = p_fuente)
  ),
  ahora as (select * from base where dia > (now() at time zone 'UTC')::date - (select n from dias)),
  -- El periodo anterior solo se compara si hay datos de él: lo online se
  -- borra a los 65 días, así que con más de 30 días de ventana lo de
  -- «antes» estaría a medias y la flecha mentiría.
  antes as (
    select * from base
    where dia <= (now() at time zone 'UTC')::date - (select n from dias)
      and ((select n from dias) <= 30 or p_fuente in ('oficial', 'pokedoc'))
  ),
  total_ahora as (select count(*)::numeric as n from ahora),
  total_antes as (select count(*)::numeric as n from antes),
  cuotas_antes as (select arquetipo, count(*)::numeric as n from antes group by arquetipo)
  select
    x.arquetipo, coalesce(a.nombre, x.arquetipo), coalesce(a.iconos, '{}'),
    count(*)::int,
    round(100 * count(*) / nullif((select n from total_ahora), 0), 2),
    round(100 * max(ca.n) / nullif((select n from total_antes), 0), 2),
    sum(x.victorias)::int, sum(x.derrotas)::int, sum(x.empates)::int,
    round(100 * sum(x.victorias)::numeric / nullif(sum(x.victorias + x.derrotas + x.empates), 0), 1),
    (count(*) filter (where x.puesto between 1 and 8))::int,
    count(distinct x.torneo_id)::int,
    (count(*) filter (where x.con_lista))::int
  from ahora x
  left join public.meta_arquetipos a on a.id = x.arquetipo
  left join cuotas_antes ca on ca.arquetipo = x.arquetipo
  group by x.arquetipo, a.nombre, a.iconos
  order by count(*) desc, x.arquetipo;
$$;

create or replace function public.meta_totales(p_dias int default 14, p_fuente text default null)
returns table (torneos int, jugadores int, desde date, ultima_lectura timestamptz, oficiales int, pokedoc int, online int)
language sql
stable
set search_path = public
as $$
  select count(*)::int, coalesce(sum(clasificados), 0)::int, min((fecha at time zone 'UTC')::date),
    (select max(leido_at) from public.meta_torneos),
    (count(*) filter (where fuente = 'oficial'))::int,
    (count(*) filter (where fuente = 'pokedoc'))::int,
    (count(*) filter (where fuente = 'online'))::int
  from public.meta_torneos
  where (fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - public.meta_dias(p_dias)
    and (p_fuente is null or fuente = p_fuente);
$$;

create or replace function public.meta_lista_media(p_arquetipo text, p_dias int default 14, p_fuente text default null)
returns table (seccion text, nombre text, set_codigo text, numero text, mazos int, listas int, porcentaje numeric, media numeric)
language sql
stable
set search_path = public
as $$
  with dias as (select public.meta_dias(p_dias) as n),
  total as (
    select count(*)::int as n
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where r.arquetipo = p_arquetipo and r.con_lista
      and t.fuente <> 'pokedoc'
      and (p_fuente is null or t.fuente = p_fuente)
      and (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - (select n from dias)
  ),
  cartas as (
    select c.seccion, c.clave, min(c.nombre) as nombre,
      (array_agg(c.set_codigo order by c.mazos desc))[1] as set_codigo,
      (array_agg(c.numero order by c.mazos desc))[1] as numero,
      sum(c.mazos)::int as mazos, sum(c.copias)::int as copias
    from public.meta_cartas_dia c
    where c.arquetipo = p_arquetipo
      and c.dia > (now() at time zone 'UTC')::date - (select n from dias)
      -- Filtrando por fuente, solo los días en que esa fuente tuvo torneo.
      and (p_fuente is null or exists (
        select 1 from public.meta_torneos t
        where t.fuente = p_fuente and (t.fecha at time zone 'UTC')::date = c.dia))
    group by c.seccion, c.clave
  )
  select seccion, nombre, set_codigo, numero, least(mazos, (select n from total)), (select n from total),
    round(100 * least(mazos, (select n from total))::numeric / nullif((select n from total), 0), 1),
    round(copias::numeric / nullif(mazos, 0), 2)
  from cartas
  where (select n from total) > 0
  order by case seccion when 'pokemon' then 1 when 'trainer' then 2 else 3 end, mazos desc, copias desc, nombre;
$$;

-- Las listas de referencia: primero las OFICIALES (un top 8 de un
-- regional pesa más que el de un torneo online de 40), después por
-- puesto y tamaño del torneo.
create or replace function public.meta_listas(p_arquetipo text, p_dias int default 14, p_limite int default 12, p_fuente text default null)
returns table (
  torneo_id text, torneo text, fecha timestamptz, jugadores int, fuente text, tipo text,
  jugador text, nombre_jugador text, pais text,
  puesto int, victorias int, derrotas int, empates int, lista jsonb, enlace text, torneo_enlace text
)
language sql
stable
set search_path = public
as $$
  select t.id, t.nombre, t.fecha, t.jugadores, t.fuente, t.tipo,
    r.jugador, r.nombre_jugador, r.pais,
    r.puesto, r.victorias, r.derrotas, r.empates, r.lista, r.enlace, t.enlace
  from public.meta_resultados r
  join public.meta_torneos t on t.id = r.torneo_id
  where r.arquetipo = p_arquetipo and r.lista is not null
    and (p_fuente is null or t.fuente = p_fuente)
    and (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - public.meta_dias(p_dias)
  order by (t.fuente = 'oficial') desc, r.puesto asc nulls last, t.jugadores desc, t.fecha desc
  limit greatest(1, least(coalesce(p_limite, 12), 40));
$$;

-- Las FIRMAS de cada arquetipo: los Pokémon (por colección y número) que
-- lleva al menos el 80 % de sus listas en los últimos 60 días. Sirven
-- para encajar un mazo de PokeDoc en el arquetipo de Limitless que le
-- toca: un mazo es de un arquetipo si lleva TODA su firma.
create or replace function public.meta_firmas()
returns table (arquetipo text, nombre text, firma text[])
language sql
stable
set search_path = public
as $$
  with listas as (
    select r.arquetipo, count(*) as n
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where r.con_lista and t.fuente <> 'pokedoc' and t.fecha > now() - interval '60 days'
    group by r.arquetipo
    having count(*) >= 10
  ),
  cartas as (
    select c.arquetipo, c.set_codigo || ' ' || c.numero as impresion, sum(c.mazos) as mazos
    from public.meta_cartas_dia c
    where c.seccion = 'pokemon' and c.dia > (now() - interval '60 days')::date
    group by c.arquetipo, c.set_codigo, c.numero
  )
  select l.arquetipo, a.nombre, array_agg(c.impresion order by c.mazos desc)
  from listas l
  join cartas c on c.arquetipo = l.arquetipo and c.mazos >= 0.8 * l.n
  join public.meta_arquetipos a on a.id = l.arquetipo
  where l.arquetipo <> 'other'
  group by l.arquetipo, a.nombre;
$$;

grant execute on function public.meta_dias(int) to anon, authenticated;
grant execute on function public.meta_resumen(int, text) to anon, authenticated;
grant execute on function public.meta_totales(int, text) to anon, authenticated;
grant execute on function public.meta_lista_media(text, int, text) to anon, authenticated;
grant execute on function public.meta_listas(text, int, int, text) to anon, authenticated;
grant execute on function public.meta_firmas() to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
