-- Tanda 1285 — EL CALENDARIO DE ADVIENTO (PINGU eligió lo recomendado: con XP
-- y logro). Del 1 al 24 de diciembre, una casilla al día en Inicio: la primera
-- vez que se abre da +10 XP, y las 24 dan el logro «Adviento <año>». Las de
-- días pasados se pueden abrir tarde hasta el 31 de diciembre.
--
-- El DÍA lo decide la base con la hora de España: el navegador de cada uno
-- puede ir adelantado (o tener la fecha mal puesta) y abrir la casilla de
-- mañana sería un premio regalado. La XP y el logro los suma esta función, no
-- el navegador: si el cliente decidiera cuánto, cualquiera podría pedirse 24
-- casillas el día 1.
--
-- Se puede ejecutar dos veces: todo es «if not exists» / «or replace» y el
-- logro va con «on conflict».

create table if not exists public.adviento_casillas (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  anio int not null,
  dia int not null check (dia between 1 and 24),
  abierta_at timestamptz not null default now(),
  primary key (user_id, anio, dia)
);

comment on table public.adviento_casillas is
  'Calendario de Adviento (1285): las casillas que ha abierto cada persona, por año. Se escribe solo por adviento_abrir.';

-- Cada uno lee las suyas (para pintar el calendario); nadie escribe a mano:
-- sin política de insert, la RLS lo impide y solo entra por la función.
alter table public.adviento_casillas enable row level security;
drop policy if exists adviento_ver_las_mias on public.adviento_casillas;
create policy adviento_ver_las_mias on public.adviento_casillas
  for select to authenticated using (user_id = auth.uid());
grant select on public.adviento_casillas to authenticated;

-- El logro del año. Su condición es de un tipo que el navegador no cuenta
-- (`adviento`, sin `count`): gamification.js no lo da nunca por su cuenta; lo
-- da adviento_abrir al abrir la casilla 24.ª.
insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('adviento_2026', 'Adviento 2026', 'Abriste las 24 casillas del Calendario de Adviento de 2026.', 'gift', 'gold', 50, true, '{"type": "adviento", "anio": 2026}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  condition = excluded.condition;

-- El día de hoy en España, aparte para que la prueba pueda ponerle la fecha
-- que quiera (now() no se puede fingir).
create or replace function public.adviento_hoy()
returns date
language sql
stable
as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- Abrir una casilla. Devuelve qué ha pasado para que la web lo cuente:
--   nueva     — si es la primera vez (si no, no suma nada)
--   xp        — lo sumado ahora (10, más el del logro si toca)
--   abiertas  — cuántas lleva este año
--   logro     — el id del logro si se acaba de ganar (si no, null)
--   total_xp  — su XP después
create or replace function public.adviento_abrir(p_dia int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := public.adviento_hoy();
  v_anio int := extract(year from v_hoy)::int;
  v_filas int;
  v_xp int := 0;
  v_abiertas int;
  v_logro text := 'adviento_' || extract(year from v_hoy)::int;
  v_xp_logro int;
  v_tenia boolean;
  v_ganado text := null;
  v_total int;
begin
  if v_uid is null then
    raise exception 'hay que tener sesión para abrir el calendario';
  end if;
  if extract(month from v_hoy) <> 12 then
    raise exception 'el calendario de Adviento es de diciembre';
  end if;
  if p_dia is null or p_dia < 1 or p_dia > 24 or p_dia > extract(day from v_hoy) then
    raise exception 'esa casilla todavía no se puede abrir';
  end if;

  insert into adviento_casillas (user_id, anio, dia)
  values (v_uid, v_anio, p_dia)
  on conflict do nothing;
  get diagnostics v_filas = row_count;

  if v_filas > 0 then
    v_xp := 10;
    -- El nivel en el MISMO update (la 387): subir el XP sin tocar `level`
    -- deja la chapa vieja sin dar error.
    update user_profiles
       set total_xp = coalesce(total_xp, 0) + 10,
           level = public.nivel_de_xp(coalesce(total_xp, 0) + 10)
     where id = v_uid;
  end if;

  select count(*)::int into v_abiertas
    from adviento_casillas
   where user_id = v_uid and anio = v_anio;

  if v_abiertas >= 24 then
    select greatest(coalesce(xp_reward, 0), 0) into v_xp_logro
      from achievement_definitions
     where id = v_logro and coalesce(is_active, true);
    select coalesce(v_logro = any(achievements), false) into v_tenia
      from user_profiles where id = v_uid;
    if v_xp_logro is not null and not coalesce(v_tenia, true) then
      update user_profiles
         set achievements = array_append(coalesce(achievements, '{}'::text[]), v_logro),
             total_xp = coalesce(total_xp, 0) + v_xp_logro,
             level = public.nivel_de_xp(coalesce(total_xp, 0) + v_xp_logro)
       where id = v_uid;
      v_xp := v_xp + v_xp_logro;
      v_ganado := v_logro;
    end if;
  end if;

  select total_xp into v_total from user_profiles where id = v_uid;
  if v_total is null then
    raise exception 'no hay perfil para %', v_uid;
  end if;

  return jsonb_build_object('nueva', v_filas > 0, 'xp', v_xp, 'abiertas', v_abiertas, 'logro', v_ganado, 'total_xp', v_total);
end;
$$;

revoke all on function public.adviento_abrir(int) from public, anon;
grant execute on function public.adviento_abrir(int) to authenticated, service_role;

notify pgrst, 'reload schema';
