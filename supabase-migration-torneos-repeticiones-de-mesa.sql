-- ════════════════════════════════════════════════════════════════════
-- Tanda 555 — la repetición de una MESA, la añaden los jueces y la ve
-- todo el mundo en «Rondas»
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «que los jueces puedan asociar repeticiones a cada mesa de cada
-- ronda para que los jugadores puedan ver la repetición de las mesas que
-- quieran pasar su log […] y que se quede en el apartado de rondas en los
-- torneos. Puede que tengan repetición o puede que no, no es obligatorio».
--
-- Va DESPUÉS de supabase-migration-repeticiones.sql (necesita la tabla
-- tournament_match_replays y repeticiones_juez_de) y de los torneos.
--
-- ── Qué cambia ──
--
-- Hasta ahora (tanda 496) la repetición de una mesa la adjuntaba uno de
-- sus dos jugadores y la veían ellos dos, quien lleva el torneo y los
-- jueces: era para resolver disputas. Ahora hay otra clase: la que añade
-- un JUEZ (o quien lleva el torneo) con el registro que le pasa un
-- jugador, marcada `publica`, y esa la ve cualquiera que vea la mesa —con
-- cuenta o sin ella, como el resto de la ficha, que es el escaparate
-- (tanda 252)—. Las de los jugadores siguen igual de privadas.
--
-- Nadie escribe en la tabla a mano: se añade y se quita por función, y
-- añadir COMPARTE la repetición (si no, los demás no la podrían abrir).
-- Hasta tres por mesa, una por partida de un BO3.
--
-- Se ejecuta en el SQL Editor de Supabase. Se puede repetir entera.

begin;

do $$
begin
  if to_regclass('public.tournament_match_replays') is null then
    raise exception 'Falta la tabla tournament_match_replays: ejecuta antes supabase-migration-repeticiones.sql.';
  end if;
end
$$;

alter table public.tournament_match_replays add column if not exists publica boolean not null default false;

-- Las de mesa: las ve quien pueda ver la mesa (la política de
-- tournament_matches decide, con la consulta de dentro).
drop policy if exists tmr_ver_de_mesa on public.tournament_match_replays;
create policy tmr_ver_de_mesa on public.tournament_match_replays for select to anon, authenticated
  using (publica and exists (select 1 from public.tournament_matches m where m.id = match_id));

-- Sin cuenta también se ven. Pero la política de las de JUGADOR (tanda
-- 496) tiene que quedarse en `authenticated`: llama a dos funciones que sin
-- cuenta no se pueden ejecutar, y Postgres evalúa TODAS las políticas de la
-- tabla, así que con ella para todo el mundo una consulta sin cuenta falla
-- ENTERA («permission denied for function repeticiones_juez_de») — y la
-- página se queda sin ninguna, sin un solo aviso. Lo cazó la prueba contra
-- PostgreSQL; un doble que devuelve lo que puede no lo habría visto.
alter policy tmr_ver on public.tournament_match_replays to authenticated;
grant select on table public.tournament_match_replays to anon, authenticated;

-- Añadir la de una mesa: quien lleva el torneo o un juez aprobado, con una
-- repetición SUYA (la acaba de guardar con el registro que le pasaron).
create or replace function public.torneos_juez_adjuntar_repeticion(p_partida uuid, p_repeticion text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_torneo uuid;
  v_estado text;
  v_b uuid;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  select r.tournament_id, m.status, m.player_b_id into v_torneo, v_estado, v_b
    from public.tournament_matches m
    join public.rounds r on r.id = m.round_id
   where m.id = p_partida;
  if v_torneo is null then
    raise exception 'Esa mesa no existe.' using errcode = 'P0002';
  end if;
  if not (public.torneos_mando(v_torneo) or public.repeticiones_juez_de(v_torneo)) then
    raise exception 'Solo quien lleva el torneo y sus jueces añaden la repetición de una mesa.' using errcode = '42501';
  end if;
  if v_estado in ('pending', 'bye') or v_b is null then
    raise exception 'Esa mesa no tiene partida que ver (sin empezar, o un bye).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.replays x where x.id = p_repeticion and x.user_id = v_yo) then
    raise exception 'Esa repetición no es tuya: guárdala primero.' using errcode = '42501';
  end if;
  if (select count(*) from public.tournament_match_replays t where t.match_id = p_partida and t.publica and t.replay_id <> p_repeticion) >= 3 then
    raise exception 'Caben tres repeticiones por mesa (una por partida de un BO3): quita una antes.' using errcode = 'P0001';
  end if;
  update public.replays set compartida = true where id = p_repeticion;
  insert into public.tournament_match_replays (match_id, user_id, replay_id, publica)
  values (p_partida, v_yo, p_repeticion, true)
  on conflict (match_id, replay_id) do update set publica = true;
  return true;
end;
$$;

-- Quitar una de mesa: quien lleva el torneo o un juez. Las de los
-- jugadores (no públicas) no se tocan desde aquí: son suyas.
create or replace function public.torneos_juez_quitar_repeticion(p_partida uuid, p_repeticion text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_torneo uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  select r.tournament_id into v_torneo
    from public.tournament_matches m
    join public.rounds r on r.id = m.round_id
   where m.id = p_partida;
  if v_torneo is null or not (public.torneos_mando(v_torneo) or public.repeticiones_juez_de(v_torneo)) then
    raise exception 'Solo quien lleva el torneo y sus jueces quitan la repetición de una mesa.' using errcode = '42501';
  end if;
  delete from public.tournament_match_replays
   where match_id = p_partida and replay_id = p_repeticion and publica;
  return found;
end;
$$;

revoke all on function public.torneos_juez_adjuntar_repeticion(uuid, text) from public, anon;
grant execute on function public.torneos_juez_adjuntar_repeticion(uuid, text) to authenticated, service_role;
revoke all on function public.torneos_juez_quitar_repeticion(uuid, text) from public, anon;
grant execute on function public.torneos_juez_quitar_repeticion(uuid, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
