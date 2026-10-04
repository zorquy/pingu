-- ════════════════════════════════════════════════════════════════════
-- Tanda 521 — puzles «¿Qué jugarías?» sacados de una repetición
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU, de la lista de ideas: «un puzle: una posición de una repetición,
-- la pregunta "¿qué jugarías?", unas opciones y la solución explicada».
--
-- Va DESPUÉS de supabase-migration-repeticiones.sql (necesita su tabla).
--
-- ── Cómo es ──
--
-- Un puzle es una JUGADA de una repetición tuya (`foto`, la misma cuenta
-- que el deslizador de /repeticiones), una pregunta, de 2 a 4 opciones y
-- cuál es la buena, con su explicación. Quien lo abre ve la mesa en esa
-- jugada —y nada de lo que viene después— y elige; al elegir, se le dice si
-- acertó, por qué, y qué eligió la gente.
--
-- ── Lo que no se ve antes de contestar ──
--
-- La buena y la explicación NO se pueden leer de la tabla: el permiso de
-- lectura es por columnas y esas dos no están. Salen de
-- puzles_responder(), que además apunta tu respuesta (una por persona, la
-- primera: cambiarla después de ver la solución sería hacer trampa a la
-- estadística). Sin cuenta también se contesta: se ve la solución y no se
-- apunta nada. No es un examen: quien quiera la solución sin pensar la
-- tiene a un clic, como en cualquier libro de problemas.
--
-- Hacer un puzle deja su repetición COMPARTIDA: sin el registro no hay mesa
-- que enseñar. Y si su dueño deja de compartirla, el puzle deja de verse.
--
-- Se ejecuta en el SQL Editor de Supabase. Se puede repetir entera.

begin;

create table if not exists public.replay_puzzles (
  id text primary key default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  replay_id text not null references public.replays (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  foto int not null,
  pregunta text not null,
  opciones text[] not null,
  correcta int not null,
  explicacion text not null,
  created_at timestamptz not null default now(),
  constraint replay_puzzles_foto check (foto between 1 and 5000),
  constraint replay_puzzles_pregunta check (char_length(pregunta) between 3 and 200),
  constraint replay_puzzles_opciones check (
    cardinality(opciones) between 2 and 4
    and array_position(opciones, null) is null
    and char_length(array_to_string(opciones, '')) <= 480),
  constraint replay_puzzles_correcta check (correcta >= 0 and correcta < cardinality(opciones)),
  constraint replay_puzzles_explicacion check (char_length(explicacion) between 3 and 1000)
);

create index if not exists replay_puzzles_recientes on public.replay_puzzles (created_at desc);

create table if not exists public.replay_puzzle_answers (
  puzzle_id text not null references public.replay_puzzles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  opcion int not null,
  created_at timestamptz not null default now(),
  primary key (puzzle_id, user_id)
);

alter table public.replay_puzzles enable row level security;
alter table public.replay_puzzle_answers enable row level security;

-- Si una repetición está compartida. Con `security definer` porque
-- `replays` solo se la deja leer a su dueño: desde la política, quien
-- pregunta no vería la fila y la respuesta sería siempre que no.
create or replace function public.repeticion_compartida(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.replays r where r.id = p_id and r.compartida)
$$;
revoke all on function public.repeticion_compartida(text) from public;
grant execute on function public.repeticion_compartida(text) to anon, authenticated;

-- Se ve el puzle si se puede abrir su repetición (compartida), o si es tuyo.
drop policy if exists puzles_leer on public.replay_puzzles;
create policy puzles_leer on public.replay_puzzles for select
  using (user_id = auth.uid() or public.repeticion_compartida(replay_id));

-- Borrar, el dueño. Crear y contestar, solo por función.
drop policy if exists puzles_borrar on public.replay_puzzles;
create policy puzles_borrar on public.replay_puzzles for delete using (user_id = auth.uid());

revoke all on table public.replay_puzzles from anon, authenticated;
grant select (id, replay_id, user_id, foto, pregunta, opciones, created_at) on table public.replay_puzzles to anon, authenticated;
grant delete on table public.replay_puzzles to authenticated;
revoke all on table public.replay_puzzle_answers from anon, authenticated;

-- Hacer un puzle de una jugada de una repetición TUYA. Devuelve su id.
create or replace function public.puzles_crear(p_repeticion text, p_foto int, p_pregunta text, p_opciones text[], p_correcta int, p_explicacion text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_opciones text[];
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.replays r where r.id = p_repeticion and r.user_id = auth.uid()) then
    raise exception 'Solo se hacen puzles de repeticiones tuyas: guárdala primero.' using errcode = '42501';
  end if;
  if (select count(*) from public.replay_puzzles where user_id = auth.uid()) >= 100 then
    raise exception 'Caben 100 puzles por persona: borra alguno antes.' using errcode = 'P0001';
  end if;
  select array_agg(btrim(o) order by k) into v_opciones
  from unnest(p_opciones) with ordinality as t(o, k)
  where btrim(coalesce(o, '')) <> '';
  if v_opciones is null or cardinality(v_opciones) < 2 or cardinality(v_opciones) > 4 then
    raise exception 'Hacen falta de 2 a 4 opciones.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_opciones) o where char_length(o) > 120) then
    raise exception 'Cada opción cabe en 120 caracteres.' using errcode = '22023';
  end if;
  insert into public.replay_puzzles (replay_id, foto, pregunta, opciones, correcta, explicacion)
  values (p_repeticion, p_foto, btrim(p_pregunta), v_opciones, p_correcta, btrim(p_explicacion))
  returning id into v_id;
  -- Sin el registro a la vista no hay mesa que enseñar.
  update public.replays set compartida = true where id = p_repeticion;
  return v_id;
end;
$$;

-- Contestar: la solución, la explicación y lo que eligió la gente. Con
-- cuenta, apunta tu PRIMERA respuesta.
create or replace function public.puzles_responder(p_puzle text, p_opcion int)
returns table (correcta int, explicacion text, recuento int[], tuya int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.replay_puzzles;
begin
  select pz.* into v from public.replay_puzzles pz
  where pz.id = p_puzle
    and (pz.user_id = auth.uid() or exists (select 1 from public.replays r where r.id = pz.replay_id and r.compartida));
  if v.id is null then
    raise exception 'Ese puzle no existe o ya no se comparte.' using errcode = 'P0002';
  end if;
  if p_opcion is null or p_opcion < 0 or p_opcion >= cardinality(v.opciones) then
    raise exception 'Esa opción no es de este puzle.' using errcode = '22023';
  end if;
  if auth.uid() is not null then
    insert into public.replay_puzzle_answers (puzzle_id, user_id, opcion)
    values (v.id, auth.uid(), p_opcion)
    on conflict (puzzle_id, user_id) do nothing;
  end if;
  return query
    select v.correcta, v.explicacion,
           (select array_agg((select count(*)::int from public.replay_puzzle_answers a where a.puzzle_id = v.id and a.opcion = k - 1) order by k)
              from generate_series(1, cardinality(v.opciones)) k),
           (select a.opcion from public.replay_puzzle_answers a where a.puzzle_id = v.id and a.user_id = auth.uid());
end;
$$;

-- Los puzles recientes de todo el mundo, para la lista.
create or replace function public.puzles_lista(p_limite int default 20)
returns table (id text, pregunta text, created_at timestamptz, autor text, respuestas int, aciertos int)
language sql
stable
security definer
set search_path = public
as $$
  select pz.id, pz.pregunta, pz.created_at, coalesce(p.display_name, p.username),
         (select count(*)::int from public.replay_puzzle_answers a where a.puzzle_id = pz.id),
         (select count(*)::int from public.replay_puzzle_answers a where a.puzzle_id = pz.id and a.opcion = pz.correcta)
  from public.replay_puzzles pz
  join public.replays r on r.id = pz.replay_id and r.compartida
  left join public.user_profiles p on p.id = pz.user_id
  order by pz.created_at desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50)
$$;

revoke all on function public.puzles_crear(text, int, text, text[], int, text) from public, anon;
grant execute on function public.puzles_crear(text, int, text, text[], int, text) to authenticated;
revoke all on function public.puzles_responder(text, int) from public;
grant execute on function public.puzles_responder(text, int) to anon, authenticated;
revoke all on function public.puzles_lista(int) from public;
grant execute on function public.puzles_lista(int) to anon, authenticated;

commit;
