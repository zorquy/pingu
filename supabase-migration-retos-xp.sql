-- ─────────────────────────────────────────────────────────────────────
-- LOS RETOS DIARIOS DAN XP (tanda 835).
--
-- PINGU: «deberían dar experiencia, y tener logros por completar retos
-- diarios, retos diarios seguidos…». Hasta aquí solo el reto de preguntas
-- guardaba algo en la base (`daily_challenge_results`); «¿Qué carta es?» y
-- «¿Más caro o más barato?» vivían en el navegador, así que no podían dar
-- XP ni contar para nada. Esto pone:
--
--   · `retos_resultados`: una fila por persona, juego y día (la clave
--     primaria es la que impide repetir un reto para volver a cobrarlo).
--   · `retos_bonos`: el «día perfecto» (los seis retos del día) y cada
--     siete días seguidos jugando, también una vez.
--   · `retos_reto_del_dia`: el contenido del día de los retos nuevos
--     (ordena por precio, ¿de qué expansión es?), como `mas_caro_del_dia`.
--   · `retos_guardar(…)`: la ÚNICA puerta para escribir un resultado. Calcula
--     la XP aquí —no se fía de la que diga el navegador— y la suma con
--     `xp_sumar` (la de la 388, con su tope diario).
--   · `retos_estadisticas(juego, día)`: lo de «hoy la ha acertado el 41 % de
--     la gente», sin enseñar quién.
--   · `retos_mis_numeros()`: tus días, tu racha y lo que miran los logros.
--   · diez logros nuevos en `achievement_definitions`.
--
-- Las reglas de XP están TAMBIÉN en js/retos-xp.js (para enseñar «ahora
-- vale +40 XP» antes de jugar); test-tanda-835 comprueba que las dos dicen
-- lo mismo. Cada sentencia se puede ejecutar por su lado (tanda 631) y la
-- migración entera se puede volver a ejecutar.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.retos_resultados (
  user_id uuid not null references auth.users (id) on delete cascade,
  juego text not null,
  day date not null,
  aciertos integer not null default 0,
  total integer not null default 0,
  intentos integer,
  acertada boolean not null default false,
  xp integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, juego, day),
  constraint retos_resultados_juego check (juego in ('reto', 'carta', 'caro', 'silueta', 'ordena', 'expansion')),
  constraint retos_resultados_cuentas check (total between 0 and 20 and aciertos between 0 and total),
  constraint retos_resultados_intentos check (intentos is null or intentos between 0 and 10),
  constraint retos_resultados_xp check (xp between 0 and 100)
);

-- La partida tal cual (841): lo que el navegador guarda del reto de hoy, para
-- que al abrirlo en OTRO aparato salga hecho y no se vuelva a jugar. Pequeño:
-- unos intentos o unas rondas; lo que pase de 8 KB no se guarda.
alter table public.retos_resultados add column if not exists estado jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'retos_resultados_estado') then
    alter table public.retos_resultados add constraint retos_resultados_estado
      check (estado is null or (jsonb_typeof(estado) = 'object' and octet_length(estado::text) <= 8000));
  end if;
end $$;

create index if not exists retos_resultados_juego_dia_idx on public.retos_resultados (juego, day);

alter table public.retos_resultados enable row level security;

-- Cada uno ve lo suyo. Lo de todos sale agregado por `retos_estadisticas`.
-- Sin políticas de escribir: escribe solo `retos_guardar`.
drop policy if exists retos_resultados_ver on public.retos_resultados;
create policy retos_resultados_ver on public.retos_resultados for select to authenticated using (auth.uid() = user_id);
grant select on public.retos_resultados to authenticated;

create table if not exists public.retos_bonos (
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  day date not null,
  xp integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, tipo, day),
  constraint retos_bonos_tipo check (tipo in ('perfecto', 'racha7'))
);

alter table public.retos_bonos enable row level security;
drop policy if exists retos_bonos_ver on public.retos_bonos;
create policy retos_bonos_ver on public.retos_bonos for select to authenticated using (auth.uid() = user_id);
grant select on public.retos_bonos to authenticated;

-- El contenido del día de los retos nuevos: lo elige la primera petición
-- (netlify/functions/ordena-precio.mjs y que-expansion.mjs) y lo leen las
-- demás. Público, como `mas_caro_del_dia`; escribe la clave de servicio.
create table if not exists public.retos_reto_del_dia (
  juego text not null,
  day date not null,
  datos jsonb not null,
  created_at timestamptz not null default now(),
  primary key (juego, day)
);

alter table public.retos_reto_del_dia enable row level security;
drop policy if exists retos_reto_del_dia_ver on public.retos_reto_del_dia;
create policy retos_reto_del_dia_ver on public.retos_reto_del_dia for select using (true);
grant select on public.retos_reto_del_dia to anon, authenticated;

-- ── La XP de cada reto (la misma tabla que js/retos-xp.js) ──
create or replace function public.retos_xp(p_juego text, p_aciertos int, p_total int, p_intentos int, p_acertada boolean, p_tira boolean[] default null)
returns int
language plpgsql
immutable
set search_path = public
as $$
declare
  v_puntos int := 0;
  v_racha int := 0;
  v_i int;
begin
  if p_juego = 'reto' then
    -- El de preguntas ya da su XP en curso.js (los 15 de siempre): aquí se
    -- apunta para el día perfecto y la racha, sin cobrar dos veces.
    return 0;
  elsif p_juego = 'carta' then
    if not coalesce(p_acertada, false) then return 5; end if;
    return case coalesce(p_intentos, 6) when 1 then 50 when 2 then 45 when 3 then 40 when 4 then 30 when 5 then 20 else 15 end;
  elsif p_juego = 'caro' then
    -- 3 por acierto, 6 desde el tercero seguido, y 6 más con los cinco.
    if p_tira is null then return least(30, greatest(0, coalesce(p_aciertos, 0)) * 3); end if;
    for v_i in 1 .. least(coalesce(array_length(p_tira, 1), 0), 5) loop
      if p_tira[v_i] then
        v_racha := v_racha + 1;
        v_puntos := v_puntos + case when v_racha >= 3 then 6 else 3 end;
      else
        v_racha := 0;
      end if;
    end loop;
    if coalesce(array_length(p_tira, 1), 0) = 5 and not (false = any (p_tira)) then v_puntos := v_puntos + 6; end if;
    return least(30, v_puntos);
  elsif p_juego = 'silueta' then
    if not coalesce(p_acertada, false) then return 0; end if;
    return case coalesce(p_intentos, 3) when 1 then 20 when 2 then 10 else 5 end;
  elsif p_juego = 'ordena' then
    if not coalesce(p_acertada, false) then return 2; end if;
    return case coalesce(p_intentos, 3) when 1 then 25 when 2 then 15 else 8 end;
  elsif p_juego = 'expansion' then
    return least(5, greatest(0, coalesce(p_aciertos, 0))) * 4;
  end if;
  return 0;
end;
$$;

-- ── Los días en que alguien jugó algo (los retos nuevos y el de preguntas
-- de antes de esta migración, que vive en `daily_challenge_results`) ──
create or replace function public.retos_dias_de(p_user uuid)
returns table (day date, juegos int)
language sql
stable
security definer
set search_path = public
as $$
  select d.day, count(distinct d.juego)::int
    from (
      select r.day, r.juego from public.retos_resultados r where r.user_id = p_user
      union
      select c.day, 'reto' from public.daily_challenge_results c where c.user_id = p_user
    ) d
   group by d.day;
$$;
revoke all on function public.retos_dias_de(uuid) from public, anon, authenticated;

-- La racha que acaba en `p_hasta` (o en el día anterior, si hoy aún no se
-- ha jugado: la racha de ayer sigue viva hasta medianoche).
create or replace function public.retos_racha_de(p_user uuid, p_hasta date)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dia date := p_hasta;
  v_n int := 0;
begin
  if not exists (select 1 from public.retos_dias_de(p_user => p_user) d where d.day = v_dia) then
    v_dia := v_dia - 1;
  end if;
  while exists (select 1 from public.retos_dias_de(p_user => p_user) d where d.day = v_dia) loop
    v_n := v_n + 1;
    v_dia := v_dia - 1;
    exit when v_n > 3650;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.retos_racha_de(uuid, date) from public, anon, authenticated;

-- ── Guardar un resultado: la única puerta ──
-- Con la partida (841) cambia la firma: la vieja se quita para que no
-- queden dos y PostgREST no sepa a cuál llamar.
drop function if exists public.retos_guardar(text, date, int, int, int, boolean, boolean[]);
create or replace function public.retos_guardar(
  p_juego text, p_dia date, p_aciertos int default 0, p_total int default 0,
  p_intentos int default null, p_acertada boolean default false, p_tira boolean[] default null,
  p_estado jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_xp int;
  v_filas int;
  v_total int := null;
  v_juegos_hoy int;
  v_perfecto boolean := false;
  v_racha int;
  v_bono_racha boolean := false;
begin
  if v_uid is null then raise exception 'hay que tener sesión para guardar un reto'; end if;
  -- El día es el UTC del reto; uno de margen a cada lado por los husos.
  if p_dia is null or p_dia < current_date - 1 or p_dia > current_date + 1 then
    raise exception 'ese día no es el de hoy: %', p_dia;
  end if;

  v_xp := public.retos_xp(p_juego, p_aciertos, p_total, p_intentos, p_acertada, p_tira);
  insert into public.retos_resultados (user_id, juego, day, aciertos, total, intentos, acertada, xp, estado)
  values (v_uid, p_juego, p_dia, greatest(0, coalesce(p_aciertos, 0)), greatest(0, coalesce(p_total, 0)), p_intentos, coalesce(p_acertada, false), v_xp,
    case when jsonb_typeof(p_estado) = 'object' and octet_length(p_estado::text) <= 8000 then p_estado end)
  on conflict (user_id, juego, day) do nothing;
  get diagnostics v_filas = row_count;

  -- Ya estaba guardado: ni XP ni bonos otra vez.
  if v_filas = 0 then
    return jsonb_build_object('nuevo', false, 'xp', (select xp from public.retos_resultados where user_id = v_uid and juego = p_juego and day = p_dia));
  end if;

  if v_xp > 0 then v_total := public.xp_sumar(v_xp); end if;

  -- El día perfecto: los seis retos el mismo día.
  select d.juegos into v_juegos_hoy from public.retos_dias_de(p_user => v_uid) d where d.day = p_dia;
  if coalesce(v_juegos_hoy, 0) >= 6 then
    insert into public.retos_bonos (user_id, tipo, day, xp) values (v_uid, 'perfecto', p_dia, 25) on conflict do nothing;
    get diagnostics v_filas = row_count;
    if v_filas > 0 then v_perfecto := true; v_total := public.xp_sumar(25); end if;
  end if;

  -- Cada siete días seguidos, +50 (una vez ese día).
  v_racha := public.retos_racha_de(v_uid, p_dia);
  if v_racha > 0 and v_racha % 7 = 0 then
    insert into public.retos_bonos (user_id, tipo, day, xp) values (v_uid, 'racha7', p_dia, 50) on conflict do nothing;
    get diagnostics v_filas = row_count;
    if v_filas > 0 then v_bono_racha := true; v_total := public.xp_sumar(50); end if;
  end if;

  return jsonb_build_object(
    'nuevo', true, 'xp', v_xp, 'perfecto', v_perfecto, 'xpPerfecto', case when v_perfecto then 25 else 0 end,
    'racha', v_racha, 'bonoRacha', v_bono_racha, 'xpRacha', case when v_bono_racha then 50 else 0 end,
    'juegosHoy', coalesce(v_juegos_hoy, 0), 'totalXp', v_total
  );
end;
$$;
revoke all on function public.retos_guardar(text, date, int, int, int, boolean, boolean[], jsonb) from public, anon;
grant execute on function public.retos_guardar(text, date, int, int, int, boolean, boolean[], jsonb) to authenticated;

-- ── Lo de todos, agregado: cuántos han jugado, cuántos han acertado y el
-- reparto por intentos y por aciertos. Nadie sale con nombre. ──
create or replace function public.retos_estadisticas(p_juego text, p_dia date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'jugadores', count(*),
    'acertaron', count(*) filter (where acertada),
    'porIntentos', coalesce((select jsonb_object_agg(i, n) from (select intentos as i, count(*) as n from public.retos_resultados where juego = p_juego and day = p_dia and acertada and intentos is not null group by intentos) x), '{}'::jsonb),
    'porAciertos', coalesce((select jsonb_object_agg(a, n) from (select aciertos as a, count(*) as n from public.retos_resultados where juego = p_juego and day = p_dia group by aciertos) y), '{}'::jsonb)
  )
  from public.retos_resultados
  where juego = p_juego and day = p_dia;
$$;
revoke all on function public.retos_estadisticas(text, date) from public;
grant execute on function public.retos_estadisticas(text, date) to anon, authenticated;

-- ── Tus números: los días (para el calendario), la racha, lo de hoy y lo
-- que miran los logros ──
create or replace function public.retos_mis_numeros(p_dias int default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mejor int := 0;
begin
  if v_uid is null then return null; end if;
  select coalesce(max(n), 0) into v_mejor from (
    select count(*) as n from (
      select day, day - (row_number() over (order by day))::int as grupo from public.retos_dias_de(p_user => v_uid)
    ) g group by grupo
  ) islas;
  return jsonb_build_object(
    'dias', coalesce((select jsonb_object_agg(d.day, d.juegos) from public.retos_dias_de(p_user => v_uid) d where d.day > current_date - greatest(1, least(p_dias, 400))), '{}'::jsonb),
    'jugados', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego <> 'reto'), 0)
               + coalesce((select count(*) from public.daily_challenge_results where user_id = v_uid), 0),
    'racha', public.retos_racha_de(v_uid, current_date),
    'mejorRacha', v_mejor,
    'diasPerfectos', coalesce((select count(*) from public.retos_bonos where user_id = v_uid and tipo = 'perfecto'), 0),
    'cartaPrimera', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego = 'carta' and acertada and intentos = 1), 0),
    'cartaAciertos', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego = 'carta' and acertada), 0),
    'caroPerfectos', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego = 'caro' and aciertos = 5), 0),
    'xpHoy', coalesce((select sum(xp) from public.retos_resultados where user_id = v_uid and day = current_date), 0)
             + coalesce((select sum(xp) from public.retos_bonos where user_id = v_uid and day = current_date), 0),
    'hoy', coalesce((select jsonb_object_agg(juego, jsonb_build_object('aciertos', aciertos, 'total', total, 'intentos', intentos, 'acertada', acertada, 'xp', xp, 'estado', estado)) from public.retos_resultados where user_id = v_uid and day = current_date), '{}'::jsonb),
    'cartaIntentos', coalesce((select jsonb_object_agg(i, n) from (select intentos as i, count(*) as n from public.retos_resultados where user_id = v_uid and juego = 'carta' and acertada and intentos is not null group by intentos) x), '{}'::jsonb)
  );
end;
$$;
revoke all on function public.retos_mis_numeros(int) from public, anon;
grant execute on function public.retos_mis_numeros(int) to authenticated;

-- ── Los logros de los retos. Los cuenta js/gamification.js con
-- `retos_mis_numeros` (solo si alguno está activo). ──
insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('retos_semana', 'Semana en llamas', 'Jugaste algún reto diario siete días seguidos.', 'flame', 'bronze', 50, true, '{"type": "retos_racha", "count": 7}'::jsonb),
  ('retos_imparable', 'Imparable', 'Treinta días seguidos jugando retos diarios.', 'flame', 'gold', 150, true, '{"type": "retos_racha", "count": 30}'::jsonb),
  ('retos_leyenda', 'Leyenda diaria', 'Cien días seguidos jugando retos diarios.', 'flame', 'platinum', 500, true, '{"type": "retos_racha", "count": 100}'::jsonb),
  ('retos_perfecto', 'Día perfecto', 'Completaste todos los retos de un mismo día.', 'crown', 'silver', 25, true, '{"type": "retos_perfectos", "count": 1}'::jsonb),
  ('retos_perfectos_10', 'Diez días perfectos', 'Diez días con todos los retos completados.', 'crown', 'gold', 100, true, '{"type": "retos_perfectos", "count": 10}'::jsonb),
  ('carta_ojo_halcon', 'Ojo de halcón', 'Acertaste «¿Qué carta es?» a la primera.', 'eye', 'gold', 50, true, '{"type": "carta_primera", "count": 1}'::jsonb),
  ('carta_detective', 'Detective', 'Has acertado 25 cartas de «¿Qué carta es?».', 'cards', 'silver', 75, true, '{"type": "carta_aciertos", "count": 25}'::jsonb),
  ('caro_tasador', 'Tasador', 'Cinco de cinco en «¿Más caro o más barato?».', 'coins', 'silver', 40, true, '{"type": "caro_perfectos", "count": 1}'::jsonb),
  ('caro_ojo_valor', 'Ojo para el valor', 'Diez veces cinco de cinco en «¿Más caro o más barato?».', 'gem', 'gold', 150, true, '{"type": "caro_perfectos", "count": 10}'::jsonb),
  ('retos_centenario', 'Centenario', 'Has jugado cien retos diarios.', 'medal', 'gold', 100, true, '{"type": "retos_jugados", "count": 100}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  is_active = excluded.is_active,
  condition = excluded.condition;

notify pgrst, 'reload schema';
