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
-- permiso de cambiar va POR COLUMNAS: el título y si se comparte.
revoke all on table public.replays from anon, authenticated;
grant select, delete on table public.replays to authenticated;
grant update (titulo, compartida) on table public.replays to authenticated;

-- ── 3. Guardar ──
--
-- Devuelve el identificador del enlace, si queda compartida y si la fila
-- es nueva. Guardar otra vez la misma partida cambia el título (si se da)
-- y lo de compartir (si se dice), y devuelve la de antes.
create or replace function public.repeticiones_guardar(
  p_registro text,
  p_titulo text default null,
  p_jugadores text[] default null,
  p_ganador text default null,
  p_turnos int default null,
  p_compartida boolean default null
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
           compartida = coalesce(p_compartida, r.compartida)
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
      insert into public.replays (user_id, titulo, registro, jugador_a, jugador_b, ganador, turnos, compartida)
      values (
        v_yo,
        coalesce(v_titulo, 'Repetición'),
        p_registro,
        left(nullif(trim(p_jugadores[1]), ''), 40),
        left(nullif(trim(p_jugadores[2]), ''), 40),
        left(nullif(trim(p_ganador), ''), 40),
        case when p_turnos between 0 and 500 then p_turnos end,
        coalesce(p_compartida, false)
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
create or replace function public.repeticiones_leer(p_id text)
returns table (registro text, titulo text, jugador_a text, jugador_b text, turnos int, created_at timestamptz, mia boolean, compartida boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.registro, r.titulo, r.jugador_a, r.jugador_b, r.turnos, r.created_at,
         r.user_id = auth.uid(), r.compartida
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
revoke all on function public.repeticiones_guardar(text, text, text[], text, int, boolean) from public, anon;
grant execute on function public.repeticiones_guardar(text, text, text[], text, int, boolean) to authenticated, service_role;

revoke all on function public.repeticiones_leer(text) from public;
grant execute on function public.repeticiones_leer(text) to anon, authenticated, service_role;

revoke all on function public.repeticiones_resumen(text) from public;
grant execute on function public.repeticiones_resumen(text) to anon, authenticated, service_role;

revoke all on function public.replays_tope() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Comprobación ──
--
-- Debe salir la tabla con sus TRES políticas (ver, editar, borrar).
select policyname, cmd from pg_policies where tablename = 'replays' order by policyname;
