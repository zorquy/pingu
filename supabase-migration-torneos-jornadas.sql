-- Tandas 634 y 635 — en una LIGA, cada jornada se juega con SU lista y
-- se cierra por separado.
--
-- PINGU: «en una liga puedes jugar distintas jornadas con distintos
-- mazos, por lo tanto tienes que enviar una decklist en cada jornada, no
-- importa si es la misma todas las jornadas […] y a la hora de cerrar
-- inscripciones que no se cierren para toda la liga y que solo se
-- cierren para la jornada que quieras». Y lo que eligió:
--   · sin lista para una jornada, NO juega esa jornada (no es una baja);
--   · cerrar una jornada congela quién la juega y con qué lista;
--   · la liga admite gente nueva mientras quede alguna jornada abierta.
--
-- Así que en una liga «apuntarse a la jornada N» ES enviar la lista de
-- la N, y «desapuntarse» es retirarla. La 634 lo guardaba como una
-- AUSENCIA aparte (tournament_matchday_absences); con la lista por
-- jornada sobra, y dos fuentes de «quién juega» acabarían diciendo cosas
-- distintas. Esta migración la sustituye entera: si ya se ejecutó la de
-- la 634, se quita lo que dejó.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631: el SQL
-- Editor puede mandarlas por separado, y nada de tablas temporales).

drop function if exists public.torneos_jornada(uuid, int, boolean);
drop table if exists public.tournament_matchday_absences;

-- ── Qué jornadas ha cerrado el organizador ──────────────────────────
create table if not exists public.tournament_matchday_closures (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  matchday int not null check (matchday >= 1),
  closed_at timestamptz not null default now(),
  primary key (tournament_id, matchday)
);
alter table public.tournament_matchday_closures enable row level security;
-- Se lee para todo el mundo (la ficha dice qué jornadas admiten aún
-- listas, y sin la política la RLS daría una lista VACÍA sin error,
-- tanda 510); se escribe solo por torneos_cerrar_jornada.
drop policy if exists jornadas_cerradas_leer on public.tournament_matchday_closures;
create policy jornadas_cerradas_leer on public.tournament_matchday_closures for select using (true);

-- ── La lista de cada uno para cada jornada ──────────────────────────
create table if not exists public.tournament_matchday_decklists (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  matchday int not null check (matchday >= 1),
  raw_text text not null,
  parsed_cards jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (tournament_id, user_id, matchday)
);
alter table public.tournament_matchday_decklists enable row level security;
-- La lista de una jornada que no ha empezado la ven el dueño, quien
-- lleva el torneo y sus jueces. Nadie más: sería enseñar el mazo antes
-- de jugar. La que ya se juega pasa a tournament_decklists al emparejar
-- (torneos_publicar_listas_jornada) y allí manda la regla de siempre
-- (al_terminar / en_juego / nunca).
-- `to authenticated` porque llama a funciones de ese rol (tanda 555).
drop policy if exists listas_jornada_ver on public.tournament_matchday_decklists;
create policy listas_jornada_ver on public.tournament_matchday_decklists for select to authenticated
  using (user_id = auth.uid() or torneos_mando(tournament_id) or torneos_soy_juez(tournament_id));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.tournament_matchday_closures to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.tournament_matchday_closures, public.tournament_matchday_decklists to authenticated;
  end if;
end $$;

-- ── Enviar (o cambiar) tu lista de una jornada ─────────────────────
-- Solo un inscrito ACTIVO, en una liga en juego, de una jornada de su
-- calendario que siga ABIERTA: ni cerrada por el organizador ni con sus
-- pareos generados.
create or replace function public.torneos_lista_jornada(
  p_torneo uuid, p_jornada int, p_texto text, p_cartas jsonb
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_t tournaments%rowtype;
begin
  if auth.uid() is null then raise exception 'Entra en tu cuenta para enviar tu lista.'; end if;
  select * into v_t from tournaments where id = p_torneo;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_t.format is distinct from 'league' then raise exception 'Solo las ligas tienen lista por jornada.'; end if;
  if v_t.status in ('finished', 'cancelled', 'draft') then raise exception 'La liga no admite listas ahora.'; end if;
  if p_jornada is null or p_jornada < 1 or p_jornada > v_t.swiss_rounds then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if not exists (
    select 1 from tournament_registrations r
    where r.tournament_id = p_torneo and r.user_id = auth.uid() and r.status = 'active'
  ) then
    raise exception 'Solo los inscritos de la liga envían listas.';
  end if;
  if exists (select 1 from rounds where tournament_id = p_torneo and round_number = p_jornada)
     or exists (select 1 from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada) then
    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;
  end if;
  if coalesce(trim(p_texto), '') = '' or p_cartas is null then raise exception 'La lista está vacía.'; end if;

  insert into tournament_matchday_decklists (tournament_id, user_id, matchday, raw_text, parsed_cards, submitted_at)
    values (p_torneo, auth.uid(), p_jornada, p_texto, p_cartas, now())
    on conflict (tournament_id, user_id, matchday)
    do update set raw_text = excluded.raw_text, parsed_cards = excluded.parsed_cards, submitted_at = now();
  return true;
end $$;

-- ── Retirar tu lista de una jornada (= no la juegas) ────────────────
create or replace function public.torneos_quitar_lista_jornada(p_torneo uuid, p_jornada int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'Entra en tu cuenta.'; end if;
  if exists (select 1 from rounds where tournament_id = p_torneo and round_number = p_jornada)
     or exists (select 1 from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada) then
    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;
  end if;
  delete from tournament_matchday_decklists
    where tournament_id = p_torneo and user_id = auth.uid() and matchday = p_jornada;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- ── Cerrar (o reabrir) una jornada: quien lleva el torneo ───────────
-- Reabrir solo mientras no haya pareos: con las mesas hechas, cambiar
-- quién juega dejaría a alguien sin rival.
create or replace function public.torneos_cerrar_jornada(p_torneo uuid, p_jornada int, p_cerrar boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_t tournaments%rowtype;
  v_n int;
begin
  select * into v_t from tournaments where id = p_torneo;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if not torneos_mando(p_torneo) then raise exception 'Solo quien lleva la liga cierra sus jornadas.'; end if;
  if v_t.format is distinct from 'league' then raise exception 'Solo las ligas tienen jornadas.'; end if;
  if p_jornada is null or p_jornada < 1 or p_jornada > v_t.swiss_rounds then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if p_cerrar then
    insert into tournament_matchday_closures (tournament_id, matchday) values (p_torneo, p_jornada)
      on conflict do nothing;
  else
    if exists (select 1 from rounds where tournament_id = p_torneo and round_number = p_jornada) then
      raise exception 'La jornada % ya tiene pareos: deshazlos antes de reabrirla.', p_jornada;
    end if;
    delete from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada;
  end if;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- ── Al emparejar una jornada, su lista pasa a ser «la» lista ────────
-- tournament_decklists sigue siendo la lista de cada jugador para todo
-- lo demás (arquetipos, meta, la lista del rival, los jueces, las
-- cartas más jugadas) y con su regla de visibilidad de siempre. En una
-- liga, esa fila es la de la ÚLTIMA jornada emparejada: se copia aquí y
-- no al enviarla, para que una lista de una jornada futura no se vea
-- antes de tiempo. Solo quien lleva la liga.
create or replace function public.torneos_publicar_listas_jornada(p_torneo uuid, p_jornada int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not torneos_mando(p_torneo) then raise exception 'Solo quien lleva la liga publica las listas.'; end if;
  insert into tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, submitted_at, locked_at)
    select d.tournament_id, d.user_id, d.raw_text, d.parsed_cards, d.submitted_at, now()
    from tournament_matchday_decklists d
    where d.tournament_id = p_torneo and d.matchday = p_jornada
  on conflict (tournament_id, user_id)
  do update set raw_text = excluded.raw_text, parsed_cards = excluded.parsed_cards,
    submitted_at = excluded.submitted_at, locked_at = excluded.locked_at;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.torneos_lista_jornada(uuid, int, text, jsonb)',
    'public.torneos_quitar_lista_jornada(uuid, int)',
    'public.torneos_cerrar_jornada(uuid, int, boolean)',
    'public.torneos_publicar_listas_jornada(uuid, int)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

-- ── Apuntarse a una liga que ya ha empezado ─────────────────────────
-- La misma función de supabase-migration-torneos-codigo.sql, con UNA
-- puerta más: una liga admite gente nueva mientras le quede alguna
-- jornada ABIERTA (sin cerrar y sin pareos), aunque ya se esté jugando.
-- Quien entra tarde empieza con 0 puntos y juega desde la jornada a la
-- que mande su lista. Todo lo demás, igual que estaba.
create or replace function public.torneos_inscribirse(
  p_torneo uuid, p_tcg_live text, p_cola boolean default false, p_codigo text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_torneo tournaments%rowtype;
  v_codigo text;
  v_ocupadas int;
  v_lleno boolean;
  v_estado text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribirte.'; end if;
  if coalesce(trim(p_tcg_live), '') = '' then raise exception 'Di tu usuario de TCG Live.'; end if;

  select * into v_torneo from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;

  if coalesce(v_torneo.is_private, false) then
    select trim(code) into v_codigo from tournament_join_codes where tournament_id = p_torneo;
    if coalesce(v_codigo, '') = '' then
      raise exception 'Este torneo pide código para entrar y todavía no tiene ninguno: pídeselo a quien lo organiza.';
    end if;
    if coalesce(trim(p_codigo), '') = '' then
      raise exception 'Este torneo pide un código para entrar.';
    end if;
    if lower(trim(p_codigo)) <> lower(v_codigo) then
      raise exception 'El código no es correcto.';
    end if;
  end if;

  if v_torneo.status <> 'registration_open' and not (
    v_torneo.format = 'league'
    and v_torneo.status in ('registration_closed', 'in_progress')
    and exists (
      select 1 from generate_series(1, v_torneo.swiss_rounds) as j(n)
      where not exists (select 1 from rounds r where r.tournament_id = p_torneo and r.round_number = j.n)
        and not exists (select 1 from tournament_matchday_closures c where c.tournament_id = p_torneo and c.matchday = j.n)
    )
  ) then
    raise exception 'Las inscripciones no están abiertas.';
  end if;
  if exists (select 1 from tournament_registrations where tournament_id = p_torneo and user_id = auth.uid()) then
    raise exception 'Ya estás inscrito en este torneo.';
  end if;

  select count(*) into v_ocupadas
    from tournament_registrations
    where tournament_id = p_torneo and status = 'active';
  v_lleno := v_torneo.max_players is not null and v_ocupadas >= v_torneo.max_players;

  if p_cola or v_lleno then
    v_estado := 'waitlisted';
  else
    v_estado := 'active';
  end if;

  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username)
    values (p_torneo, auth.uid(), v_estado, trim(p_tcg_live))
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.torneos_inscribirse(uuid, text, boolean, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.torneos_inscribirse(uuid, text, boolean, text) to authenticated;
  end if;
end $$;
