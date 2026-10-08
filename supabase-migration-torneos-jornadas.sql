-- Tanda 634 — en una LIGA, cada jugador dice qué jornadas juega.
--
-- Hasta ahora, quien no podía ir a una jornada tenía dos salidas y
-- ninguna buena: no hacer el check-in (se le empareja igual y su rival
-- gana por incomparecencia después de esperar) o darse de baja (para
-- siempre). PINGU: «que te puedas apuntar o desapuntar a las jornadas
-- siempre antes de que den comienzo».
--
-- Una fila aquí = «este jugador NO juega esta jornada». Sin fila, juega
-- (lo normal es ir a todas). Quien no juega una jornada no se empareja
-- en ella: no suma puntos ni se le apunta derrota, y la jornada
-- siguiente entra solo.
--
-- «Antes de que den comienzo» = antes de que se generen los pareos de
-- esa jornada: con las mesas hechas, quitarse dejaría a alguien sin
-- rival. Si el organizador deshace los pareos, se vuelve a poder.
--
-- Re-ejecutable: todo es `if not exists` / `create or replace` / `drop
-- policy if exists`. Y cada sentencia vale por sí sola (tanda 631: el
-- SQL Editor puede mandarlas por separado).

create table if not exists public.tournament_matchday_absences (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  matchday int not null check (matchday >= 1),
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id, matchday)
);

alter table public.tournament_matchday_absences enable row level security;

-- Se LEE como la lista de inscritos (que es pública dentro del torneo):
-- el organizador tiene que saber quién no viene antes de emparejar, y
-- el jugador ver lo que marcó. Sin esta política la RLS devolvería una
-- lista VACÍA sin error (tanda 510) y el pareo sentaría a quien avisó.
drop policy if exists ausencias_leer on public.tournament_matchday_absences;
create policy ausencias_leer on public.tournament_matchday_absences for select using (true);

-- Y no se ESCRIBE directo: sin política de insert/delete, solo por la
-- función de abajo, que comprueba que la jornada no ha empezado.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.tournament_matchday_absences to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.tournament_matchday_absences to authenticated;
  end if;
end $$;

-- Apuntarse (p_juega = true) o desapuntarse (false) de una jornada.
-- Lo hace el propio jugador, y solo:
--   · en una liga que no ha terminado ni se ha cancelado,
--   · de una jornada que existe en su calendario,
--   · con su inscripción activa (ni en la cola ni retirado),
--   · y mientras los pareos de esa jornada no estén generados.
-- Devuelve true si cambió algo y false si ya estaba así.
create or replace function public.torneos_jornada(p_torneo uuid, p_jornada int, p_juega boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_t tournaments%rowtype;
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'Entra en tu cuenta para elegir tus jornadas.';
  end if;
  select * into v_t from tournaments where id = p_torneo;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_t.format is distinct from 'league' then
    raise exception 'Solo las ligas tienen jornadas.';
  end if;
  if v_t.status in ('finished', 'cancelled') then
    raise exception 'La liga ya no está en juego.';
  end if;
  if p_jornada is null or p_jornada < 1 or p_jornada > v_t.swiss_rounds then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if not exists (
    select 1 from tournament_registrations r
    where r.tournament_id = p_torneo and r.user_id = auth.uid() and r.status = 'active'
  ) then
    raise exception 'Solo los inscritos de la liga eligen sus jornadas.';
  end if;
  if exists (select 1 from rounds where tournament_id = p_torneo and round_number = p_jornada) then
    raise exception 'La jornada % ya ha empezado: sus pareos están hechos.', p_jornada;
  end if;

  if p_juega then
    delete from tournament_matchday_absences
      where tournament_id = p_torneo and user_id = auth.uid() and matchday = p_jornada;
  else
    insert into tournament_matchday_absences (tournament_id, user_id, matchday)
      values (p_torneo, auth.uid(), p_jornada)
      on conflict do nothing;
  end if;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke all on function public.torneos_jornada(uuid, int, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.torneos_jornada(uuid, int, boolean) to authenticated;
  end if;
end $$;
