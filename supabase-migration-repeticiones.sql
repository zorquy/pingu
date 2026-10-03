-- ─────────────────────────────────────────────────────────────────────
-- Las repeticiones guardadas y compartidas (/repeticiones).
--
-- POR QUÉ HACE FALTA
--
-- /repeticiones lee el registro de una partida de JCC Pokémon Live en el
-- navegador y lo reproduce. PINGU: «me gustaría poder compartir el link de
-- una repetición para que quien la abra lo pueda ver», y «un apartado
-- para ver tus repeticiones guardadas, como lo de los mazos».
--
-- La web funciona SIN esta migración: el botón de compartir da entonces un
-- enlace que LLEVA la partida dentro (comprimida, detrás de un #), y eso
-- son 3 o 4 KB de enlace — Discord corta un mensaje a los 2.000
-- caracteres. Lo que cambia al ejecutarla: con sesión se puede GUARDAR
-- una partida (sale en «Tus repeticiones») y el enlace sale corto,
-- /repeticiones?r=1a2b3c4d5e.
--
-- CÓMO ESTÁ PENSADA
--
--   · Una repetición es de UNA persona, como un mazo. El dueño la ve, le
--     cambia el título, la comparte o deja de compartirla y la borra, con
--     su sesión y directamente sobre la tabla (las políticas de abajo).
--   · Guardar va por UNA función (`repeticiones_guardar`) y no por un
--     insert: así se valida el texto, se pone un tope por hora (una tabla
--     en la que escribe cualquiera es una tabla de spam) y guardar dos
--     veces la MISMA partida no duplica la fila — se busca por la huella
--     del texto, que la pantalla no sabe calcular (el navegador no trae
--     MD5).
--   · Compartida NO es pública: nadie puede LISTAR las repeticiones que
--     otros comparten. Con una política de «todos leen las compartidas»,
--     un `select * from replays where compartida` las daría todas. Una
--     compartida solo la abre quien tiene su enlace, por
--     `repeticiones_leer`.
--   · El registro no se cambia una vez guardado (un disparador lo deja
--     como estaba): el enlace que alguien ha mandado tiene que seguir
--     enseñando la misma partida.
--   · Jugadores, ganador y turnos van aparte para la lista y para la
--     vista previa al pegar el enlace, que así no se traen el registro.
--
-- LO QUE SE AÑADIÓ DESPUÉS (tandas 494 a 496)
--
--   · El MAZO de cada uno, deducido de lo que se vio (`mazo_a`, `mazo_b`):
--     para etiquetar «Tus repeticiones» sin traerse el registro entero.
--   · Las NOTAS del dueño en jugadas concretas (`notas`).
--   · Mis partidas: una partida apuntada al guardar una repetición lleva
--     su enlace (`match_log.replay_id`), y guardarla otra vez no la apunta
--     dos veces.
--   · Los torneos: un jugador adjunta la repetición de su partida, y la
--     ven los dos jugadores y quien lleva o arbitra el torneo.
--
-- Si ya la ejecutaste antes, ejecútala OTRA VEZ: lo de arriba se añade sin
-- tocar lo que ya hay.
--
-- CÓMO SE EJECUTA
--
-- Pégalo entero en el SQL Editor de Supabase y dale a Run. Es idempotente:
-- se puede ejecutar dos veces sin romper nada. Al final hay una
-- comprobación.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- ── 1. La tabla ──
create table if not exists public.replays (
  -- Diez caracteres hexadecimales: 40 bits, sin depender de ninguna
  -- extensión. Es lo que va en el enlace.
  id text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null default 'Repetición',
  registro text not null,
  -- La huella del texto. Generada: no la puede escribir nadie a mano.
  registro_md5 text generated always as (md5(registro)) stored,
  jugador_a text,
  jugador_b text,
  ganador text,
  turnos int,
  compartida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint replays_titulo check (char_length(titulo) between 1 and 120),
  -- Un registro de verdad son 10 o 20 KB; 200.000 caracteres es el techo
  -- de lo absurdo, no de lo normal.
  constraint replays_largo check (char_length(registro) between 100 and 200000),
  constraint replays_jugadores check (
    char_length(coalesce(jugador_a, '')) <= 40
    and char_length(coalesce(jugador_b, '')) <= 40
    and char_length(coalesce(ganador, '')) <= 40),
  constraint replays_turnos check (turnos is null or turnos between 0 and 500)
);

-- La misma partida, una vez por persona.
create unique index if not exists replays_dueno_registro on public.replays (user_id, registro_md5);
create index if not exists replays_dueno on public.replays (user_id, created_at desc);

-- updated_at lo pone la base, y lo que no se debe tocar se queda como
-- estaba: el dueño, el enlace, la fecha y la PARTIDA (un enlace mandado
-- tiene que seguir enseñando lo mismo). Además del permiso por columnas de
-- abajo: este cubre también lo que haga una función.
create or replace function public.replays_tocar()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.id := old.id;
  new.user_id := old.user_id;
  new.registro := old.registro;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists replays_tocar on public.replays;
create trigger replays_tocar
  before update on public.replays
  for each row execute function public.replays_tocar();

-- Un tope por persona, como el de los mazos: 500 es muchísimo para una
-- persona y nada para la base.
create or replace function public.replays_tope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.replays where user_id = new.user_id) >= 500 then
    raise exception 'Has llegado al máximo de 500 repeticiones guardadas. Borra alguna para guardar más.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists replays_tope on public.replays;
create trigger replays_tope
  before insert on public.replays
  for each row execute function public.replays_tope();

-- ── 1 bis. Lo que se añadió después ──
--
-- Con `add column if not exists`: en una base donde ya estaba la tabla se
-- añaden, y en una nueva no estorban.
alter table public.replays add column if not exists mazo_a text;
alter table public.replays add column if not exists mazo_b text;
alter table public.replays add column if not exists notas jsonb not null default '[]'::jsonb;

alter table public.replays drop constraint if exists replays_mazos;
alter table public.replays add constraint replays_mazos check (
  char_length(coalesce(mazo_a, '')) <= 120 and char_length(coalesce(mazo_b, '')) <= 120);

-- Una nota es { fila, texto }: la jugada y lo que dice, de 1 a 500
-- caracteres. Como mucho 300 por repetición. La jugada va por la LÍNEA del
-- registro (`fila`, contando desde 0) y no por el número de jugada de la
-- página: el registro guardado no cambia nunca, y el número de jugada sí
-- cambia el día que el lector aprende a leer una línea más. Se comprueba
-- nota a nota con una función (un `check` no puede recorrer una lista él
-- solo).
create or replace function public.replays_notas_validas(n jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(n) = 'array'
     and jsonb_array_length(n) <= 300
     and coalesce((
       select bool_and(
         jsonb_typeof(e) = 'object'
         and jsonb_typeof(e -> 'fila') = 'number'
         and (e ->> 'fila')::numeric between 0 and 100000
         and jsonb_typeof(e -> 'texto') = 'string'
         and char_length(e ->> 'texto') between 1 and 500)
       from jsonb_array_elements(n) e), true)
$$;
alter table public.replays drop constraint if exists replays_notas;
alter table public.replays add constraint replays_notas check (public.replays_notas_validas(notas));

-- ── 2. Quién ve y toca qué ──
alter table public.replays enable row level security;

drop policy if exists replays_ver on public.replays;
create policy replays_ver on public.replays
  for select using (auth.uid() = user_id);

drop policy if exists replays_editar on public.replays;
create policy replays_editar on public.replays
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists replays_borrar on public.replays;
create policy replays_borrar on public.replays
  for delete using (auth.uid() = user_id);

-- Sin política de insert, a propósito: se guarda por la función. Y el
-- permiso de cambiar va POR COLUMNAS: el título, si se comparte y las
-- notas. Los mazos los pone la función al guardar: salen del registro, no
-- de lo que alguien escriba.
revoke all on table public.replays from anon, authenticated;
grant select, delete on table public.replays to authenticated;
grant update (titulo, compartida, notas) on table public.replays to authenticated;

-- ── 3. Guardar ──
--
-- Devuelve el identificador del enlace, si queda compartida y si la fila
-- es nueva. Guardar otra vez la misma partida cambia el título (si se da)
-- y lo de compartir (si se dice), y devuelve la de antes.
-- La de antes tenía un argumento menos: se quita, porque dos funciones del
-- mismo nombre con argumentos por defecto se pisan al llamarlas por la API.
drop function if exists public.repeticiones_guardar(text, text, text[], text, int, boolean);
create or replace function public.repeticiones_guardar(
  p_registro text,
  p_titulo text default null,
  p_jugadores text[] default null,
  p_ganador text default null,
  p_turnos int default null,
  p_compartida boolean default null,
  p_mazos text[] default null
)
returns table (id text, compartida boolean, nueva boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_titulo text := left(nullif(trim(coalesce(p_titulo, '')), ''), 120);
  v_id text;
  v_compartida boolean;
  v_intentos int := 0;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión para guardar una repetición.' using errcode = '28000';
  end if;
  if p_registro is null or char_length(p_registro) < 100 or char_length(p_registro) > 200000 then
    raise exception 'Eso no parece el registro de una partida.' using errcode = '22023';
  end if;

  -- La misma partida otra vez: la de antes, con lo nuevo.
  select r.id into v_id from public.replays r where r.user_id = v_yo and r.registro_md5 = md5(p_registro);
  if v_id is not null then
    update public.replays r
       set titulo = coalesce(v_titulo, r.titulo),
           compartida = coalesce(p_compartida, r.compartida),
           mazo_a = coalesce(left(nullif(trim(p_mazos[1]), ''), 120), r.mazo_a),
           mazo_b = coalesce(left(nullif(trim(p_mazos[2]), ''), 120), r.mazo_b)
     where r.id = v_id
     returning r.compartida into v_compartida;
    return query select v_id, v_compartida, false;
    return;
  end if;

  if (select count(*) from public.replays r where r.user_id = v_yo and r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Has guardado muchas repeticiones seguidas. Prueba dentro de un rato.' using errcode = 'P0001';
  end if;

  loop
    v_intentos := v_intentos + 1;
    begin
      insert into public.replays (user_id, titulo, registro, jugador_a, jugador_b, ganador, turnos, compartida, mazo_a, mazo_b)
      values (
        v_yo,
        coalesce(v_titulo, 'Repetición'),
        p_registro,
        left(nullif(trim(p_jugadores[1]), ''), 40),
        left(nullif(trim(p_jugadores[2]), ''), 40),
        left(nullif(trim(p_ganador), ''), 40),
        case when p_turnos between 0 and 500 then p_turnos end,
        coalesce(p_compartida, false),
        left(nullif(trim(p_mazos[1]), ''), 120),
        left(nullif(trim(p_mazos[2]), ''), 120)
      )
      returning replays.id, replays.compartida into v_id, v_compartida;
      return query select v_id, v_compartida, true;
      return;
    exception when unique_violation then
      -- O ha chocado el identificador (se prueba otro), o esa misma
      -- partida se acaba de guardar en otra pestaña: entonces, esa.
      select r.id, r.compartida into v_id, v_compartida
        from public.replays r where r.user_id = v_yo and r.registro_md5 = md5(p_registro);
      if v_id is not null then
        return query select v_id, v_compartida, false;
        return;
      end if;
      if v_intentos >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- ── 4. Abrir una con su enlace ──
--
-- La tuya siempre; la de otra persona, solo si está compartida.
-- Con los mazos y las notas desde las tandas 494 y 495: cambiar lo que devuelve
-- una función pide quitarla antes.
drop function if exists public.repeticiones_leer(text);
create or replace function public.repeticiones_leer(p_id text)
returns table (registro text, titulo text, jugador_a text, jugador_b text, turnos int, created_at timestamptz, mia boolean, compartida boolean, notas jsonb, mazo_a text, mazo_b text)
language sql
stable
security definer
set search_path = public
as $$
  select r.registro, r.titulo, r.jugador_a, r.jugador_b, r.turnos, r.created_at,
         coalesce(r.user_id = auth.uid(), false), r.compartida, r.notas, r.mazo_a, r.mazo_b
  from public.replays r
  where r.id = p_id
    and (r.compartida or r.user_id = auth.uid())
$$;

-- Lo mismo sin el registro, para la vista previa del enlace
-- (netlify/edge-functions/meta-social.js). Solo las compartidas: la vista
-- previa la pide el robot de WhatsApp, que no tiene sesión.
create or replace function public.repeticiones_resumen(p_id text)
returns table (titulo text, jugador_a text, jugador_b text, turnos int)
language sql
stable
security definer
set search_path = public
as $$
  select r.titulo, r.jugador_a, r.jugador_b, r.turnos
  from public.replays r
  where r.id = p_id and r.compartida
$$;

-- ── 5. Quién puede llamar a qué ──
--
-- Una función nueva nace con EXECUTE para PUBLIC: se quita y se da a quien
-- toca (y a `service_role` aparte, que el `revoke` de public se lo quita
-- también — tanda 387).
revoke all on function public.repeticiones_guardar(text, text, text[], text, int, boolean, text[]) from public, anon;
grant execute on function public.repeticiones_guardar(text, text, text[], text, int, boolean, text[]) to authenticated, service_role;

revoke all on function public.repeticiones_leer(text) from public;
grant execute on function public.repeticiones_leer(text) to anon, authenticated, service_role;

revoke all on function public.repeticiones_resumen(text) from public;
grant execute on function public.repeticiones_resumen(text) to anon, authenticated, service_role;

revoke all on function public.replays_tope() from public, anon, authenticated;

-- ── 6. Mis partidas (tanda 494) ──
--
-- Guardar una repetición apunta la partida en Mis partidas (si dices cuál
-- de los dos eres): la fila lleva el enlace de la repetición, y guardarla
-- otra vez no la apunta dos veces. Si Mis partidas no está puesta en esta
-- base (supabase-migration-partidas.sql), esto se salta.
do $$
begin
  if to_regclass('public.match_log') is not null then
    alter table public.match_log add column if not exists replay_id text references public.replays (id) on delete set null;
    create unique index if not exists match_log_repeticion on public.match_log (user_id, replay_id) where replay_id is not null;
  end if;
end
$$;

-- ── 7. La repetición de una partida de torneo (tanda 496) ──
--
-- Un jugador adjunta la repetición de SU partida: hasta tres por jugador y
-- partida, que es lo que dura un BO3. La ven los dos jugadores, quien
-- lleva el torneo y sus jueces:
-- sirve para resolver una disputa con la partida delante. Nadie escribe en
-- la tabla directamente (tanda 252: un jugador normal no escribe en las
-- tablas del torneo): se adjunta y se quita por dos funciones. Adjuntar la
-- COMPARTE, porque si no, los demás no la podrían abrir.
--
-- Si los torneos no están puestos en esta base, esto se salta.
-- El juez de un torneo, si los jueces están puestos (tanda 394); si no, no
-- hay jueces que mirar.
create or replace function public.repeticiones_juez_de(p_torneo uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if to_regclass('public.judge_applications') is null then
    return false;
  end if;
  return exists (
    select 1 from public.judge_applications j
     where j.tournament_id = p_torneo and j.user_id = auth.uid() and j.status = 'approved');
end;
$$;

do $$
begin
  if to_regclass('public.tournament_matches') is null or to_regclass('public.rounds') is null then
    return;
  end if;

  create table if not exists public.tournament_match_replays (
    match_id uuid not null references public.tournament_matches (id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    replay_id text not null references public.replays (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (match_id, replay_id)
  );
  create index if not exists tmr_por_jugador on public.tournament_match_replays (match_id, user_id);
  alter table public.tournament_match_replays enable row level security;
  revoke all on table public.tournament_match_replays from anon, authenticated;
  grant select on table public.tournament_match_replays to authenticated;

  drop policy if exists tmr_ver on public.tournament_match_replays;
  create policy tmr_ver on public.tournament_match_replays for select using (
    exists (
      select 1
        from public.tournament_matches m
        join public.rounds r on r.id = m.round_id
       where m.id = match_id
         and (m.player_a_id = auth.uid()
           or m.player_b_id = auth.uid()
           or public.torneos_mando(r.tournament_id)
           or public.repeticiones_juez_de(r.tournament_id))
    )
  );
end
$$;

create or replace function public.torneos_adjuntar_repeticion(p_partida uuid, p_repeticion text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.tournament_matches m
     where m.id = p_partida and (m.player_a_id = v_yo or m.player_b_id = v_yo)
  ) then
    raise exception 'Solo los dos jugadores de una partida pueden adjuntarle su repetición.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.replays r where r.id = p_repeticion and r.user_id = v_yo) then
    raise exception 'Esa repetición no es tuya: guárdala primero en «Tus repeticiones».' using errcode = '42501';
  end if;
  -- La misma otra vez no cuenta: ya está.
  if exists (select 1 from public.tournament_match_replays t where t.match_id = p_partida and t.replay_id = p_repeticion) then
    return true;
  end if;
  if (select count(*) from public.tournament_match_replays t where t.match_id = p_partida and t.user_id = v_yo) >= 3 then
    raise exception 'Caben tres repeticiones tuyas por partida (una por juego de un BO3): quita una antes.' using errcode = 'P0001';
  end if;
  update public.replays set compartida = true where id = p_repeticion;
  insert into public.tournament_match_replays (match_id, user_id, replay_id)
  values (p_partida, v_yo, p_repeticion);
  return true;
end;
$$;

-- Quitar una: solo la tuya. La repetición se queda guardada (y compartida,
-- que es cosa de «Tus repeticiones»): esto solo la desengancha de la mesa.
drop function if exists public.torneos_quitar_repeticion(uuid);
create or replace function public.torneos_quitar_repeticion(p_partida uuid, p_repeticion text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  delete from public.tournament_match_replays
   where match_id = p_partida and replay_id = p_repeticion and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.repeticiones_juez_de(uuid) from public, anon;
grant execute on function public.repeticiones_juez_de(uuid) to authenticated, service_role;
revoke all on function public.torneos_adjuntar_repeticion(uuid, text) from public, anon;
grant execute on function public.torneos_adjuntar_repeticion(uuid, text) to authenticated, service_role;
revoke all on function public.torneos_quitar_repeticion(uuid, text) from public, anon;
grant execute on function public.torneos_quitar_repeticion(uuid, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';

-- ── Comprobación ──
--
-- Debe salir la tabla con sus TRES políticas (ver, editar, borrar).
select policyname, cmd from pg_policies where tablename = 'replays' order by policyname;
