-- Tanda 387 — el XP de los torneos, y el nivel calculado en la base
--
-- PINGU: «deberíamos meter experiencia por jugar torneos y ganar
-- torneos también».
--
-- Y tenía razón, aunque el agujero era más raro de lo que parecía: los
-- torneos SÍ daban XP, pero solo al desbloquear un hito
-- (`torneo_jugado`, `torneo_veterano`, `torneo_campeon`…). O sea que tu
-- primer torneo daba 30 XP y **el undécimo daba cero**. Lo más costoso
-- de la web —una tarde entera— no alimentaba la barra, y hacerse una
-- guía sí. Los hitos se quedan como están: son medallas, y una medalla
-- por torneo llenaría el perfil de iconos iguales (decisión de la 262).
-- Lo que falta es el XP de cada vez.
--
-- ── POR QUÉ ESTO NO PUEDE VIVIR EN EL CLIENTE ──
--
-- `addXP` lee el total, le suma y lo guarda. Llamarlo al pintar la ficha
-- de un torneo terminado repartiría XP CADA VEZ que alguien la abre, y
-- la ficha se refresca sola cada diez segundos. El XP de un torneo se
-- reparte UNA vez y lo reparte el servidor.
--
-- Idempotente de verdad, y no «con cuidado»: cada premio deja su fila en
-- `tournament_xp_awards` con la pareja (torneo, persona) como clave, y
-- el XP solo se suma por las filas que el INSERT ha metido de verdad.
-- Si esto se llama dos veces, la segunda no suma nada.

-- ── El nivel, calculado en la base ──
--
-- `addXP` escribe DOS columnas: `total_xp` y `level`, que es el nombre
-- del nivel ya resuelto. Si la base sube el XP y no toca `level`, la
-- chapa de alguien se queda en «Novato» con 4.000 puntos y **no da
-- ningún error**: las dos columnas dicen cosas distintas y gana la que
-- nadie ha tocado.
--
-- Los umbrales son copia de LEVEL_THRESHOLDS en `js/gamification.js`.
-- Copiar cinco líneas es más barato que hacer que el cliente pida el
-- nivel a la base en cada pintada, pero **una copia sin vigilar se
-- separa y no avisa**: `test-tanda-387.mjs` lee el JS como TEXTO y
-- compara los cinco números con los de aquí, igual que la 322 hace con
-- `IDIOMA_POR_MERCADO`. Si tocas uno, la prueba te manda a tocar el otro.
create or replace function public.nivel_de_xp(p_xp int)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_xp, 0) >= 8000 then 'Maestro'
    when coalesce(p_xp, 0) >= 3000 then 'Experto'
    when coalesce(p_xp, 0) >= 1000 then 'Coleccionista'
    when coalesce(p_xp, 0) >= 250  then 'Entrenador'
    else 'Novato'
  end;
$$;

-- ── El libro de premios ──
--
-- Existe para poder no repetirse, pero además deja el rastro: cuánto se
-- llevó cada uno y por qué. Sin él, «¿de dónde han salido estos 150 XP?»
-- no tiene respuesta, y el día que haya que corregir un reparto no se
-- sabría qué deshacer.
create table if not exists public.tournament_xp_awards (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  amount int not null,
  motivo text not null,
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table public.tournament_xp_awards enable row level security;

-- Se lee: es el rastro de tu propio XP y sale en tu perfil. Escribir, no
-- lo hace nadie desde fuera — solo la función, que va con `security
-- definer`.
drop policy if exists tournament_xp_awards_ver on public.tournament_xp_awards;
create policy tournament_xp_awards_ver on public.tournament_xp_awards for select using (true);

-- La marca de «este torneo ya está repartido». Es la misma forma que
-- `finish_notified_at`: una columna que dice qué FALTA, para que el
-- barredor pueda preguntar por lo pendiente sin recorrerlo todo.
alter table public.tournaments
  add column if not exists xp_awarded_at timestamptz;

create index if not exists tournaments_xp_pendiente
  on public.tournaments (status)
  where xp_awarded_at is null;

-- ── El reparto ──
--
-- Cuánto: 30 por jugarlo, +40 por entrar en el podio y +80 más por
-- ganarlo. O sea que el campeón se lleva 150 y el último 30. La escala
-- de niveles pide 250 para dejar de ser Novato y 8.000 para ser Maestro,
-- así que un torneo jugado vale más o menos lo que un curso (~55) y
-- ganarlo, casi tres. Parece justo para una tarde entera.
--
-- Estos números viven SOLO aquí: el cliente nunca reparte XP de torneo,
-- así que no hay copia que se pueda separar.
--
-- ── Y quién cuenta como jugador ──
--
-- No vale estar inscrito: hay que haber JUGADO una mesa con resultado.
-- Si contara la inscripción, cuatro cuentas apuntadas y ni una partida
-- serían 120 XP por torneo — y crear torneos está abierto a todo el
-- mundo desde la tanda 266.
--
-- Por lo mismo hay un mínimo de cuatro jugadores de verdad. Debajo de
-- eso no se reparte nada: ganar un torneo de dos no es ganar un torneo.
-- **Y aun así se marca `xp_awarded_at`**, que es lo que hace que la cola
-- avance: una cola que no distingue «no lo he mirado» de «lo he mirado y
-- no había nada» no se vacía nunca (lecciones de las tandas 333, 380 y
-- 381). Devuelve 0 y no vuelve a mirarlo.
create or replace function public.torneos_repartir_xp(p_torneo uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_torneo record;
  v_jugadores int;
  v_total int := 0;
begin
  -- `for update` para que dos pasadas del barredor a la vez no se pisen.
  -- Las tres condiciones son la guarda: si falta cualquiera, no hay nada
  -- que hacer y se vuelve con 0 sin tocar nada.
  select id, champion_id, podium
    into v_torneo
    from public.tournaments
   where id = p_torneo
     and status = 'finished'
     -- El podio CONGELADO es la única fuente de quién quedó dónde
     -- (lo sella sellarResultado). Si todavía no está, esto no es «no
     -- ha ganado nadie»: es «aún no se sabe», y se deja para luego.
     and podium is not null
     and xp_awarded_at is null
     for update;
  if not found then return 0; end if;

  -- Quien jugó de verdad: inscrito (aunque luego se retirara) y presente
  -- en al menos una mesa terminada.
  create temp table if not exists _jugaron (user_id uuid primary key) on commit drop;
  delete from _jugaron;
  insert into _jugaron (user_id)
  select distinct r.user_id
    from public.tournament_registrations r
   where r.tournament_id = p_torneo
     and r.status in ('active', 'dropped')
     and exists (
       select 1
         from public.tournament_matches m
         join public.rounds ro on ro.id = m.round_id
        where ro.tournament_id = p_torneo
          and m.status in ('finished', 'forfeit_a', 'forfeit_b', 'forfeit_both')
          and r.user_id in (m.player_a_id, m.player_b_id)
     );

  select count(*) into v_jugadores from _jugaron;

  if v_jugadores >= 4 then
    with premios as (
      select j.user_id,
             30
               + case when j.user_id = any (
                   select (jsonb_array_elements_text(v_torneo.podium))::uuid
                 ) then 40 else 0 end
               + case when j.user_id = v_torneo.champion_id then 80 else 0 end as amount,
             case when j.user_id = v_torneo.champion_id then 'campeon'
                  when j.user_id = any (
                    select (jsonb_array_elements_text(v_torneo.podium))::uuid
                  ) then 'podio'
                  else 'jugado' end as motivo
        from _jugaron j
    ),
    -- Aquí está la idempotencia: lo que ya estaba no vuelve a entrar, y
    -- `returning` solo devuelve lo que se ha metido de VERDAD.
    metidos as (
      insert into public.tournament_xp_awards (tournament_id, user_id, amount, motivo)
      select p_torneo, user_id, amount, motivo from premios
      on conflict (tournament_id, user_id) do nothing
      returning user_id, amount
    ),
    sumado as (
      update public.user_profiles u
         set total_xp = coalesce(u.total_xp, 0) + m.amount,
             -- Y el nivel con el XP nuevo, en el MISMO update: si se
             -- dejara para otra pasada, entre las dos habría alguien con
             -- 4.000 puntos y la chapa de Novato.
             level = public.nivel_de_xp(coalesce(u.total_xp, 0) + m.amount)
        from metidos m
       where u.id = m.user_id
      returning m.amount
    )
    select coalesce(sum(amount), 0) into v_total from sumado;
  end if;

  update public.tournaments set xp_awarded_at = now() where id = p_torneo;
  return v_total;
end;
$$;

-- Solo lo llama el barredor, que va con la clave de servicio. Ni el
-- cliente ni nadie con sesión puede repartir XP: la función escribe en
-- `user_profiles` y va con `security definer`.
revoke all on function public.torneos_repartir_xp(uuid) from public, anon, authenticated;
