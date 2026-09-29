-- ─────────────────────────────────────────────────────────────────────
-- LOS MAZOS DEL META (tanda 364): /meta y /meta/<arquetipo>.
--
-- Lo pidió PINGU mirando la sección «Decks» de Limitless: qué mazos se
-- juegan más, cómo les va, una lista para copiar y guías para aprender
-- a llevarlos.
--
-- ── DE DÓNDE SALEN LOS DATOS ──
--
-- De la API PÚBLICA de play.limitlesstcg.com (no pide clave para leer
-- torneos ni clasificaciones): los torneos online de Estándar, con la
-- lista de cada jugador y el arquetipo en el que Limitless la ha
-- clasificado. Los torneos de PokeDoc NO entran aquí: su muestra es de
-- decenas de mazos y ya tienen su bloque en la ficha de cada carta.
--
-- La función programada `meta-limitless` lee los torneos y le pasa la
-- clasificación ENTERA, tal cual llega, a `meta_ingerir_torneo`. Todo el
-- trabajo se hace aquí dentro y en UNA transacción por torneo: o entra
-- el torneo entero o no entra nada. Si se hiciera en la función,
-- una pasada cortada a los 30 segundos (Netlify las mata ahí) dejaría
-- medio torneo sumado — y como las cartas se van SUMANDO, repetirlo
-- después lo contaría dos veces sin dar error.
--
-- ── POR QUÉ NO SE GUARDAN TODAS LAS LISTAS ──
--
-- Son ~1.600 jugadores al día en torneos de 16 o más. Guardar la lista
-- de cada uno (~1,5 KB) son 70 MB al mes, y el plan gratuito de
-- Supabase tiene 500. Así que se guarda:
--   · De CADA jugador, una fila pequeña: arquetipo, puesto y resultado.
--     Con eso salen el % de uso, el % de victorias y los tops.
--   · La lista ENTERA solo del top 8 de cada torneo: son las listas de
--     referencia que se copian.
--   · Y de las demás listas, solo el RECUENTO de cartas por arquetipo y
--     por día (`meta_cartas_dia`): con eso sale la «lista media» — qué
--     % de mazos lleva cada carta y cuántas copias — sin guardar ninguna.
-- Todo lo de más de 65 días se borra solo al ingerir.
--
-- ── LAS GUÍAS ──
--
-- `meta_guias` une una guía publicada de PokeDoc con un arquetipo. Puede
-- vincularla su AUTOR (o un admin); verla, todo el mundo. La guía no se
-- toca: sigue siendo la misma, con su revisión y sus comentarios.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- ── Los torneos leídos ──
-- Sirve para dos cosas: fechar los resultados, y saber qué torneo ya
-- se ha leído (la función no vuelve a pedirlo).
create table if not exists public.meta_torneos (
  id text primary key,                 -- el id de Limitless
  nombre text not null,
  fecha timestamptz not null,
  jugadores int not null default 0,
  organizador int,
  -- Cuántos jugadores traían arquetipo y cuántos lista. Un torneo sin
  -- listas se apunta igual (con ceros) para no volver a pedirlo.
  clasificados int not null default 0,
  con_lista int not null default 0,
  leido_at timestamptz not null default now()
);
create index if not exists meta_torneos_fecha_idx on public.meta_torneos (fecha desc);

-- ── Los arquetipos, como los nombra Limitless ──
-- `iconos` son los nombres de sus minisprites («dragapult»,
-- «sharpedo-mega»), los mismos que ya usa la web para los arquetipos
-- de los torneos (r2.limitlesstcg.net/pokemon/gen9/<icono>.png).
create table if not exists public.meta_arquetipos (
  id text primary key,
  nombre text not null,
  iconos text[] not null default '{}',
  visto_at timestamptz not null default now()
);

-- ── Un jugador en un torneo ──
create table if not exists public.meta_resultados (
  torneo_id text not null references public.meta_torneos (id) on delete cascade,
  jugador text not null,               -- el usuario de Limitless
  arquetipo text not null,
  puesto int,                          -- null si abandonó sin puesto
  victorias int not null default 0,
  derrotas int not null default 0,
  empates int not null default 0,
  abandono int,                        -- ronda en la que se fue
  con_lista boolean not null default false,
  -- Solo en las listas de referencia (top 8). Del resto se guarda el
  -- recuento en meta_cartas_dia, no la lista.
  nombre_jugador text,
  pais text,
  lista jsonb,
  primary key (torneo_id, jugador)
);
create index if not exists meta_resultados_arquetipo_idx on public.meta_resultados (arquetipo);
create index if not exists meta_resultados_listas_idx on public.meta_resultados (arquetipo) where lista is not null;

-- ── Qué cartas lleva cada arquetipo, sumado por día ──
-- `clave` agrupa las copias de una misma carta: los ENTRENADORES y las
-- energías por nombre (el Boss's Orders de MEG y el de PAL son la misma
-- carta a efectos de mazo), y los POKÉMON por nombre + colección +
-- número, porque dos Dudunsparce de colecciones distintas son dos cartas
-- distintas con ataques distintos — Limitless los separa igual.
create table if not exists public.meta_cartas_dia (
  dia date not null,
  arquetipo text not null,
  seccion text not null check (seccion in ('pokemon', 'trainer', 'energy')),
  clave text not null,
  nombre text not null,
  set_codigo text not null default '',
  numero text not null default '',
  mazos int not null default 0,        -- en cuántas listas sale
  copias int not null default 0,       -- cuántas copias suman entre todas
  primary key (dia, arquetipo, clave)
);
create index if not exists meta_cartas_dia_arquetipo_idx on public.meta_cartas_dia (arquetipo, dia);

-- ── Las guías vinculadas a un arquetipo ──
create table if not exists public.meta_guias (
  arquetipo text not null references public.meta_arquetipos (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  added_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (arquetipo, guide_id)
);
create index if not exists meta_guias_guia_idx on public.meta_guias (guide_id);

-- ─────────────────────────────────────────────────────────────────────
-- INGERIR UN TORNEO
--
-- `p_torneo` es la fila del listado de Limitless ({id, name, date,
-- players, organizerId}) y `p_clasificacion` la respuesta ENTERA de
-- /tournaments/<id>/standings. Devuelve qué ha hecho.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.meta_ingerir_torneo(p_torneo jsonb, p_clasificacion jsonb, p_top int default 8)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id text := p_torneo->>'id';
  v_fecha timestamptz := (p_torneo->>'date')::timestamptz;
  v_dia date := ((p_torneo->>'date')::timestamptz at time zone 'UTC')::date;
  v_clasificados int := 0;
  v_con_lista int := 0;
begin
  if v_id is null or v_fecha is null then
    raise exception 'meta_ingerir_torneo: falta el id o la fecha del torneo';
  end if;
  if jsonb_typeof(p_clasificacion) is distinct from 'array' then
    raise exception 'meta_ingerir_torneo: la clasificación no es una lista';
  end if;

  -- Idempotente por construcción: un torneo ya leído no se vuelve a
  -- sumar. El `for update` es por si dos pasadas se pisan: la segunda
  -- espera y ve la fila de la primera.
  perform 1 from public.meta_torneos where id = v_id for update;
  if found then
    return jsonb_build_object('torneo', v_id, 'ya_leido', true);
  end if;

  -- Solo las filas con arquetipo, y una por jugador (una clasificación
  -- no debería repetir a nadie, pero la clave primaria no perdona).
  create temporary table if not exists _meta_filas (
    jugador text, nombre text, pais text, puesto int, v int, d int, e int,
    abandono int, arquetipo text, arquetipo_nombre text, iconos text[], lista jsonb
  ) on commit drop;
  truncate _meta_filas;

  insert into _meta_filas
  select distinct on (x->>'player')
    x->>'player',
    x->>'name',
    x->>'country',
    nullif(x->>'placing', '')::int,
    coalesce((x->'record'->>'wins')::int, 0),
    coalesce((x->'record'->>'losses')::int, 0),
    coalesce((x->'record'->>'ties')::int, 0),
    nullif(x->>'drop', '')::int,
    x->'deck'->>'id',
    coalesce(x->'deck'->>'name', x->'deck'->>'id'),
    case when jsonb_typeof(x->'deck'->'icons') = 'array'
      then array(select jsonb_array_elements_text(x->'deck'->'icons')) else '{}' end,
    case when jsonb_typeof(x->'decklist') = 'object' then x->'decklist' end
  from jsonb_array_elements(p_clasificacion) x
  where coalesce(x->'deck'->>'id', '') <> '' and coalesce(x->>'player', '') <> '';

  select count(*), count(lista) into v_clasificados, v_con_lista from _meta_filas;

  insert into public.meta_torneos (id, nombre, fecha, jugadores, organizador, clasificados, con_lista)
  values (
    v_id,
    left(coalesce(p_torneo->>'name', v_id), 200),
    v_fecha,
    coalesce((p_torneo->>'players')::int, jsonb_array_length(p_clasificacion)),
    nullif(p_torneo->>'organizerId', '')::int,
    v_clasificados,
    v_con_lista
  );

  if v_clasificados = 0 then
    return jsonb_build_object('torneo', v_id, 'clasificados', 0, 'con_lista', 0);
  end if;

  -- El nombre y los iconos de un arquetipo pueden cambiar en Limitless;
  -- manda lo del torneo MÁS RECIENTE, no lo del último que se lee (la
  -- primera pasada lee hacia atrás en el tiempo).
  insert into public.meta_arquetipos as a (id, nombre, iconos, visto_at)
  select distinct on (arquetipo) arquetipo, arquetipo_nombre, iconos, v_fecha
  from _meta_filas
  order by arquetipo
  on conflict (id) do update
    set nombre = case when excluded.visto_at >= a.visto_at then excluded.nombre else a.nombre end,
        iconos = case when excluded.visto_at >= a.visto_at then excluded.iconos else a.iconos end,
        visto_at = greatest(a.visto_at, excluded.visto_at);

  insert into public.meta_resultados
    (torneo_id, jugador, arquetipo, puesto, victorias, derrotas, empates, abandono, con_lista, nombre_jugador, pais, lista)
  select
    v_id, jugador, arquetipo, puesto, v, d, e, abandono, lista is not null,
    case when lista is not null and puesto between 1 and p_top then left(nombre, 80) end,
    case when lista is not null and puesto between 1 and p_top then left(pais, 2) end,
    case when puesto between 1 and p_top then lista end
  from _meta_filas;

  -- Las cartas de TODAS las listas, sumadas por día. Primero por mazo
  -- (dos líneas de la misma carta en una lista cuentan como UN mazo y
  -- la suma de sus copias) y después por arquetipo.
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
    select jugador, arquetipo, seccion, clave,
      min(nombre) as nombre,
      -- La impresión que más copias pone en ESTE mazo.
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

  -- La limpieza va aquí y no en otra función programada: cada torneo
  -- que entra empuja fuera lo viejo, y si no entra nada, no crece nada.
  delete from public.meta_torneos where fecha < now() - interval '65 days';
  delete from public.meta_cartas_dia where dia < (now() - interval '65 days')::date;

  return jsonb_build_object('torneo', v_id, 'clasificados', v_clasificados, 'con_lista', v_con_lista);
end;
$$;

-- Ingerir es cosa SOLO de la función programada (clave de servicio).
-- Sin esto, cualquiera con la clave pública podría inventarse torneos.
revoke all on function public.meta_ingerir_torneo(jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.meta_ingerir_torneo(jsonb, jsonb, int) to service_role;

-- ─────────────────────────────────────────────────────────────────────
-- LEER: el ranking, la lista media y las listas de referencia.
--
-- Se calculan AL LEER y no se guardan: son unos pocos miles de filas
-- por ventana, Postgres las agrupa en milisegundos, y así no hay ningún
-- agregado que se quede viejo ni una segunda función que mantener.
--
-- La ventana va por DÍA (UTC) en todas, para que el total de listas de
-- un arquetipo y el recuento de sus cartas cuenten exactamente los
-- mismos torneos.
-- ─────────────────────────────────────────────────────────────────────

-- El ranking. `cuota_anterior` es la del periodo de antes, del mismo
-- largo: es lo que dice si un mazo sube o baja.
create or replace function public.meta_resumen(p_dias int default 14)
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
  with dias as (select greatest(1, least(coalesce(p_dias, 14), 30)) as n),
  base as (
    select r.*, (t.fecha at time zone 'UTC')::date as dia
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - 2 * (select n from dias)
  ),
  ahora as (select * from base where dia > (now() at time zone 'UTC')::date - (select n from dias)),
  antes as (select * from base where dia <= (now() at time zone 'UTC')::date - (select n from dias)),
  total_ahora as (select count(*)::numeric as n from ahora),
  total_antes as (select count(*)::numeric as n from antes),
  cuotas_antes as (select arquetipo, count(*)::numeric as n from antes group by arquetipo)
  select
    x.arquetipo,
    coalesce(a.nombre, x.arquetipo),
    coalesce(a.iconos, '{}'),
    count(*)::int,
    round(100 * count(*) / nullif((select n from total_ahora), 0), 2),
    round(100 * max(ca.n) / nullif((select n from total_antes), 0), 2),
    sum(x.victorias)::int,
    sum(x.derrotas)::int,
    sum(x.empates)::int,
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

-- Las cifras de la cabecera: cuántos torneos y jugadores hay detrás.
create or replace function public.meta_totales(p_dias int default 14)
returns table (torneos int, jugadores int, desde date, ultima_lectura timestamptz)
language sql
stable
set search_path = public
as $$
  select count(*)::int, coalesce(sum(clasificados), 0)::int, min((fecha at time zone 'UTC')::date),
    (select max(leido_at) from public.meta_torneos)
  from public.meta_torneos
  where (fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - greatest(1, least(coalesce(p_dias, 14), 30));
$$;

-- La lista media de un arquetipo: cada carta, en qué % de sus listas
-- sale y cuántas copias lleva de media la lista que la lleva.
create or replace function public.meta_lista_media(p_arquetipo text, p_dias int default 14)
returns table (seccion text, nombre text, set_codigo text, numero text, mazos int, listas int, porcentaje numeric, media numeric)
language sql
stable
set search_path = public
as $$
  with dias as (select greatest(1, least(coalesce(p_dias, 14), 30)) as n),
  total as (
    select count(*)::int as n
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where r.arquetipo = p_arquetipo and r.con_lista
      and (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - (select n from dias)
  ),
  cartas as (
    select c.seccion, c.clave, min(c.nombre) as nombre,
      -- La impresión del día con más mazos.
      (array_agg(c.set_codigo order by c.mazos desc))[1] as set_codigo,
      (array_agg(c.numero order by c.mazos desc))[1] as numero,
      sum(c.mazos)::int as mazos, sum(c.copias)::int as copias
    from public.meta_cartas_dia c
    where c.arquetipo = p_arquetipo
      and c.dia > (now() at time zone 'UTC')::date - (select n from dias)
    group by c.seccion, c.clave
  )
  select seccion, nombre, set_codigo, numero, mazos, (select n from total),
    round(100 * mazos::numeric / nullif((select n from total), 0), 1),
    round(copias::numeric / nullif(mazos, 0), 2)
  from cartas
  order by case seccion when 'pokemon' then 1 when 'trainer' then 2 else 3 end, mazos desc, copias desc, nombre;
$$;

-- Las listas de referencia: las del top 8, primero las que mejor
-- quedaron y, a igual puesto, las del torneo más grande.
create or replace function public.meta_listas(p_arquetipo text, p_dias int default 14, p_limite int default 12)
returns table (
  torneo_id text, torneo text, fecha timestamptz, jugadores int,
  jugador text, nombre_jugador text, pais text,
  puesto int, victorias int, derrotas int, empates int, lista jsonb
)
language sql
stable
set search_path = public
as $$
  select t.id, t.nombre, t.fecha, t.jugadores,
    r.jugador, r.nombre_jugador, r.pais,
    r.puesto, r.victorias, r.derrotas, r.empates, r.lista
  from public.meta_resultados r
  join public.meta_torneos t on t.id = r.torneo_id
  where r.arquetipo = p_arquetipo and r.lista is not null
    and (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - greatest(1, least(coalesce(p_dias, 14), 30))
  order by r.puesto asc nulls last, t.jugadores desc, t.fecha desc
  limit greatest(1, least(coalesce(p_limite, 12), 40));
$$;

grant execute on function public.meta_resumen(int) to anon, authenticated;
grant execute on function public.meta_totales(int) to anon, authenticated;
grant execute on function public.meta_lista_media(text, int) to anon, authenticated;
grant execute on function public.meta_listas(text, int, int) to anon, authenticated;

-- ── RLS ──
-- Los datos del meta son PÚBLICOS: son resultados de torneos públicos,
-- los mismos que enseña Limitless. Escribir, solo la clave de servicio
-- (que se salta la RLS): no hay política de escritura a propósito.
alter table public.meta_torneos enable row level security;
alter table public.meta_arquetipos enable row level security;
alter table public.meta_resultados enable row level security;
alter table public.meta_cartas_dia enable row level security;
alter table public.meta_guias enable row level security;

drop policy if exists meta_torneos_leer on public.meta_torneos;
create policy meta_torneos_leer on public.meta_torneos for select using (true);
drop policy if exists meta_arquetipos_leer on public.meta_arquetipos;
create policy meta_arquetipos_leer on public.meta_arquetipos for select using (true);
drop policy if exists meta_resultados_leer on public.meta_resultados;
create policy meta_resultados_leer on public.meta_resultados for select using (true);
drop policy if exists meta_cartas_dia_leer on public.meta_cartas_dia;
create policy meta_cartas_dia_leer on public.meta_cartas_dia for select using (true);

grant select on public.meta_torneos, public.meta_arquetipos, public.meta_resultados, public.meta_cartas_dia to anon, authenticated;

-- Las guías: verlas, todo el mundo (la guía en sí la sigue filtrando
-- su propia política: un borrador vinculado no se ve).
drop policy if exists meta_guias_leer on public.meta_guias;
create policy meta_guias_leer on public.meta_guias for select using (true);

-- Vincular: tu propia guía PUBLICADA (o cualquiera si eres admin), y
-- sin estar baneado. Firmada con tu id: `added_by` no se puede fingir.
drop policy if exists meta_guias_vincular on public.meta_guias;
create policy meta_guias_vincular on public.meta_guias for insert
  with check (
    auth.uid() = added_by
    and not public.is_banned()
    and exists (
      select 1 from public.guides g
      where g.id = guide_id
        and g.published_at is not null
        and (g.author_id = auth.uid() or public.is_admin())
    )
  );

-- Desvincular: quien la vinculó, el autor de la guía o un admin.
drop policy if exists meta_guias_desvincular on public.meta_guias;
create policy meta_guias_desvincular on public.meta_guias for delete
  using (
    auth.uid() = added_by
    or public.is_admin()
    or exists (select 1 from public.guides g where g.id = guide_id and g.author_id = auth.uid())
  );

grant select on public.meta_guias to anon;
grant select, insert, delete on public.meta_guias to authenticated;

commit;

-- Comprobación: tienen que salir las cinco tablas con RLS activada.
select relname, relrowsecurity from pg_class
where relname in ('meta_torneos', 'meta_arquetipos', 'meta_resultados', 'meta_cartas_dia', 'meta_guias')
order by relname;

notify pgrst, 'reload schema';
