-- Tanda 849 — RONDAS POR JORNADA en las ligas.
--
-- PINGU: «tengo una liga con 10 jornadas, pero en cada jornada quiero hacer
-- tres rondas […] no pone tres rondas por jornada o algo así». Hasta ahora
-- una jornada ERA una ronda (la jornada 2 = la ronda 2). Desde aquí una liga
-- dice cuántas rondas suizas tiene cada jornada (`rounds_per_matchday`, 1 por
-- defecto: todo lo que ya existe sigue igual) y la jornada N son las rondas
-- (N−1)·k+1 … N·k. `swiss_rounds` sigue siendo el TOTAL de rondas (10 × 3 =
-- 30), que es lo que cuentan el motor, los cierres y la clasificación; lo que
-- habla de jornadas (las listas, los cierres, apuntarse tarde) pasa por las
-- dos funciones de abajo, que hacen la MISMA cuenta que
-- js/torneos/rondas-jornada.js.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

alter table public.tournaments add column if not exists rounds_per_matchday integer not null default 1;
alter table public.tournaments drop constraint if exists tournaments_rounds_per_matchday_check;
alter table public.tournaments add constraint tournaments_rounds_per_matchday_check check (rounds_per_matchday between 1 and 5);

-- Hasta 12 jornadas × 5 rondas. Un torneo de un día sigue limitado a 12
-- rondas en el formulario; la base acepta lo que una liga necesita.
-- El límite viejo se busca por lo que COMPRUEBA, no por su nombre: si en la
-- base se llamara de otra forma, un `drop … if exists` no haría nada y las
-- dos comprobaciones seguirían a la vez (gana la de 12).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.tournaments'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%swiss_rounds%'
  loop
    execute format('alter table public.tournaments drop constraint %I', c);
  end loop;
end $$;
alter table public.tournaments add constraint tournaments_swiss_rounds_check check (swiss_rounds between 1 and 60);

-- Cuántas jornadas tiene una liga: rondas totales / rondas por jornada.
create or replace function public.torneos_num_jornadas(p_torneo uuid)
returns int language sql stable security definer set search_path = public as $$
  select ceil(t.swiss_rounds::numeric / greatest(coalesce(t.rounds_per_matchday, 1), 1))::int
  from tournaments t where t.id = p_torneo
$$;

-- ¿La jornada ya tiene alguna ronda (jugada o saltada)? Eso es lo que la
-- cierra para las listas y para apuntarse, como antes «tiene su ronda».
create or replace function public.torneos_jornada_con_rondas(p_torneo uuid, p_jornada int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rounds r join tournaments t on t.id = r.tournament_id
    where r.tournament_id = p_torneo and r.phase = 'swiss'
      and r.round_number between (p_jornada - 1) * greatest(coalesce(t.rounds_per_matchday, 1), 1) + 1
                             and p_jornada * greatest(coalesce(t.rounds_per_matchday, 1), 1)
  )
$$;

do $$
declare f text;
begin
  foreach f in array array['public.torneos_num_jornadas(uuid)', 'public.torneos_jornada_con_rondas(uuid, int)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon', f);
    end if;
  end loop;
end $$;

-- ── Las funciones de las jornadas, con la cuenta nueva ──
-- Las mismas de supabase-migration-torneos-jornadas.sql; solo cambia cómo
-- se mira si una jornada existe y si ya tiene rondas.

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
  if p_jornada is null or p_jornada < 1 or p_jornada > torneos_num_jornadas(p_torneo) then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if not exists (
    select 1 from tournament_registrations r
    where r.tournament_id = p_torneo and r.user_id = auth.uid() and r.status = 'active'
  ) then
    raise exception 'Solo los inscritos de la liga envían listas.';
  end if;
  if torneos_jornada_con_rondas(p_torneo, p_jornada)
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

create or replace function public.torneos_quitar_lista_jornada(p_torneo uuid, p_jornada int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'Entra en tu cuenta.'; end if;
  if torneos_jornada_con_rondas(p_torneo, p_jornada)
     or exists (select 1 from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada) then
    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;
  end if;
  delete from tournament_matchday_decklists
    where tournament_id = p_torneo and user_id = auth.uid() and matchday = p_jornada;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

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
  if p_jornada is null or p_jornada < 1 or p_jornada > torneos_num_jornadas(p_torneo) then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if p_cerrar then
    insert into tournament_matchday_closures (tournament_id, matchday) values (p_torneo, p_jornada)
      on conflict do nothing;
  else
    if torneos_jornada_con_rondas(p_torneo, p_jornada) then
      raise exception 'La jornada % ya tiene pareos: deshazlos antes de reabrirla.', p_jornada;
    end if;
    delete from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada;
  end if;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- ── Apuntarse a una liga que ya ha empezado ──
-- La de supabase-migration-torneos-jornadas.sql: admite gente mientras quede
-- alguna JORNADA abierta (sin cerrar y sin ninguna de sus rondas).
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
      select 1 from generate_series(1, torneos_num_jornadas(p_torneo)) as j(n)
      where not torneos_jornada_con_rondas(p_torneo, j.n)
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

notify pgrst, 'reload schema';
