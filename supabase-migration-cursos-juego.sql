-- ============================================================
-- Los cursos dejan de ser un examen
-- ============================================================
--
-- EL PROBLEMA
--
-- El comentario de un tester fue: "parecen las preguntas de un curso
-- online, no un curso gamificado". Tenía razón, y mirando el código se
-- ve por qué:
--
--   · Fallar no costaba nada. Acertaras o fallaras, el botón de
--     continuar se habilitaba igual. Sin consecuencia no hay tensión, y
--     sin tensión aquello es un formulario.
--   · Todo valía +5 XP fijos. Una recompensa constante y predecible
--     deja de leerse como recompensa a los treinta segundos.
--   · No había marcador. Terminabas y te daban un número fijo que no
--     dependía de lo bien que lo hubieras hecho: daba igual acertarlo
--     todo que fallarlo todo.
--   · Se hacía una vez y ya. Ningún motivo para volver.
--
-- QUÉ AÑADE ESTO
--
--   1. `course_attempts` — cada partida a un curso, con su puntuación,
--      sus aciertos y su medalla. Es lo que convierte "he terminado el
--      curso" en "quiero el oro": el curso se puede repetir y la
--      medalla se puede mejorar.
--
--   2. `question_stats` — cuántas veces se ha respondido cada pregunta
--      y cuántas se ha acertado, para poder decir "el 43 % de la
--      comunidad falló esta". Se escribe solo a través de una función,
--      nunca directamente: si la tabla fuera escribible desde el
--      cliente, cualquiera podría inventarse los porcentajes.
--
--   3. `course_review_queue` — las preguntas que fallaste, guardadas
--      para repasarlas dentro de unos días. Guarda una copia del bloque
--      porque el curso puede cambiar (o desaparecer) entre que fallas y
--      que repasas.
--
--   4. `daily_challenge_results` — el resultado del reto diario, que es
--      el mismo para todo el mundo cada día. Con esto hay racha y hay
--      tabla del día.
--
-- LO QUE **NO** HACE
--
-- No reparte XP. El XP lo sigue dando el cliente por `addXP()`, como
-- todo lo demás del sitio. Lo que sí impide esta migración es que
-- repetir un curso valga como una partida nueva inventada: la medalla
-- la calcula la base a partir de los aciertos (disparador), no la manda
-- el navegador, y las puntuaciones tienen topes.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Las partidas a un curso
-- ------------------------------------------------------------
-- Una fila por PARTIDA, no por persona: el historial es lo que permite
-- decir "tu mejor marca" y "has mejorado tu medalla".
--
-- `correct`/`total` son lo único que de verdad importa; `score` es el
-- adorno (base por acierto × multiplicador de racha + bonus) y por eso
-- lleva un tope: aunque alguien trastee con el navegador, no puede
-- meter una marca absurda en la tabla de mejores.
create table if not exists public.course_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  score integer not null default 0,
  correct integer not null default 0,
  total integer not null default 0,
  medal text,
  duration_ms integer,
  created_at timestamptz not null default now(),

  constraint course_attempts_total_sano check (total >= 0 and total <= 200),
  constraint course_attempts_correct_sano check (correct >= 0 and correct <= total),
  -- 30 por pregunta es el máximo teórico (10 de base × 3 del
  -- multiplicador) y 500 de margen para los bonus de partida perfecta.
  constraint course_attempts_score_sano check (score >= 0 and score <= total * 30 + 500),
  constraint course_attempts_duracion_sana check (duration_ms is null or duration_ms >= 0),
  constraint course_attempts_medalla_valida check (medal is null or medal in ('bronce', 'plata', 'oro'))
);

create index if not exists course_attempts_guide_score_idx
  on public.course_attempts (guide_id, score desc, created_at);
create index if not exists course_attempts_user_idx
  on public.course_attempts (user_id, guide_id, created_at desc);

comment on table public.course_attempts is
  'Una fila por partida a un curso. La medalla la pone el disparador a partir de correct/total, no el cliente.';

-- La medalla NO la manda el navegador: se calcula aquí a partir de los
-- aciertos. Si viniera del cliente, el oro sería una cadena de texto que
-- cualquiera puede escribir.
create or replace function public.course_attempt_medalla()
returns trigger
language plpgsql
as $$
declare
  ratio numeric;
begin
  if new.total <= 0 then
    new.medal := null;
    return new;
  end if;

  ratio := new.correct::numeric / new.total::numeric;

  new.medal := case
    when ratio >= 1 then 'oro'
    when ratio >= 0.8 then 'plata'
    when ratio >= 0.5 then 'bronce'
    else null
  end;

  return new;
end;
$$;

drop trigger if exists course_attempts_medalla on public.course_attempts;
create trigger course_attempts_medalla
  before insert or update on public.course_attempts
  for each row execute function public.course_attempt_medalla();

alter table public.course_attempts enable row level security;

-- Las marcas son públicas — son una tabla de clasificación — salvo que
-- esa persona haya escondido su actividad, igual que en `user_progress`.
drop policy if exists "course_attempts_select" on public.course_attempts;
create policy "course_attempts_select" on public.course_attempts
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_profiles p
      where p.id = course_attempts.user_id
        and coalesce(p.hide_activity, false) = false
    )
  );

drop policy if exists "course_attempts_insert" on public.course_attempts;
create policy "course_attempts_insert" on public.course_attempts
  for insert with check (auth.uid() = user_id);

-- No se actualizan ni se borran: una partida jugada es un hecho. Si
-- alguien quiere una marca mejor, que la juegue.

-- ------------------------------------------------------------
-- 2. Cuánta gente falla cada pregunta
-- ------------------------------------------------------------
-- `question_key` es un hash corto del enunciado, no la posición del
-- bloque. A propósito: si el autor reordena los bloques, las
-- estadísticas siguen pegadas a su pregunta; y si REESCRIBE el
-- enunciado, la pregunta pasa a ser otra y empieza de cero, que es lo
-- correcto — el 43 % que falló la pregunta vieja no dice nada de la
-- nueva.
create table if not exists public.question_stats (
  guide_id uuid not null references public.guides (id) on delete cascade,
  question_key text not null,
  times_answered integer not null default 0,
  times_correct integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (guide_id, question_key)
);

comment on table public.question_stats is
  'Veces respondida y veces acertada cada pregunta. Solo se escribe por record_question_answer(); no hay políticas de insert/update a propósito.';

alter table public.question_stats enable row level security;

-- Leer sí: el porcentaje se enseña a todo el mundo, incluso sin cuenta.
drop policy if exists "question_stats_select" on public.question_stats;
create policy "question_stats_select" on public.question_stats
  for select using (true);

-- Y no hay más políticas. Sin política de insert ni de update, RLS
-- rechaza cualquier escritura directa desde el navegador: la única
-- puerta es la función de aquí abajo, que solo sabe SUMAR UNO. Si la
-- tabla fuera escribible, un `update ... set times_correct = 99999`
-- desde la consola del navegador se cargaría el dato para todos.

drop function if exists public.record_question_answer(uuid, text, boolean);
create or replace function public.record_question_answer(
  p_guide_id uuid,
  p_question_key text,
  p_correct boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo gente con cuenta, y no la que está baneada: si no, el
  -- porcentaje lo puede mover cualquiera desde fuera con un bucle.
  if auth.uid() is null then
    return;
  end if;
  if public.is_banned() then
    return;
  end if;

  -- Una clave absurdamente larga solo puede venir de alguien trasteando.
  if p_question_key is null or length(p_question_key) > 64 then
    return;
  end if;

  -- Y que la pregunta sea de un curso que existe y se puede ver.
  if not exists (
    select 1 from public.guides g
    where g.id = p_guide_id and g.published_at is not null
  ) then
    return;
  end if;

  insert into public.question_stats (guide_id, question_key, times_answered, times_correct)
  values (p_guide_id, p_question_key, 1, case when p_correct then 1 else 0 end)
  on conflict (guide_id, question_key) do update
    set times_answered = public.question_stats.times_answered + 1,
        times_correct = public.question_stats.times_correct + case when p_correct then 1 else 0 end,
        updated_at = now();
end;
$$;

comment on function public.record_question_answer(uuid, text, boolean) is
  'Suma uno a las estadísticas de una pregunta. Es la única forma de escribir en question_stats.';

grant execute on function public.record_question_answer(uuid, text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. Lo que fallaste, para repasarlo
-- ------------------------------------------------------------
-- Guarda una COPIA del bloque (`block`), no una referencia. El curso
-- puede editarse o despublicarse entre que fallas la pregunta y te toca
-- repasarla; el repaso tiene que seguir funcionando igual.
create table if not exists public.course_review_queue (
  user_id uuid not null references auth.users (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  question_key text not null,
  block jsonb not null,
  failed_at timestamptz not null default now(),
  review_after timestamptz not null default (now() + interval '2 days'),
  times_failed integer not null default 1,
  primary key (user_id, guide_id, question_key)
);

create index if not exists course_review_queue_pendientes_idx
  on public.course_review_queue (user_id, review_after);

comment on table public.course_review_queue is
  'Preguntas falladas pendientes de repaso. Se borra la fila cuando se acierta en el repaso.';

alter table public.course_review_queue enable row level security;

-- Esto es privado de cada uno. Lo que fallas no es asunto de nadie más.
drop policy if exists "course_review_queue_own" on public.course_review_queue;
create policy "course_review_queue_own" on public.course_review_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. El reto diario
-- ------------------------------------------------------------
-- Las cinco preguntas del día NO se guardan aquí: las elige el cliente
-- con la fecha como semilla, así que a todo el mundo le salen las
-- mismas sin necesidad de un proceso que las prepare cada noche. Lo que
-- se guarda es el resultado.
--
-- La clave primaria (user_id, day) es la que impide repetir el reto
-- hasta sacar un 5 de 5: una tirada por persona y día.
create table if not exists public.daily_challenge_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  correct integer not null default 0,
  total integer not null default 0,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, day),

  constraint daily_total_sano check (total >= 0 and total <= 20),
  constraint daily_correct_sano check (correct >= 0 and correct <= total),
  constraint daily_score_sano check (score >= 0 and score <= total * 30 + 500)
);

create index if not exists daily_challenge_results_dia_idx
  on public.daily_challenge_results (day, score desc);

comment on table public.daily_challenge_results is
  'Resultado del reto diario. Uno por persona y día — la clave primaria es lo que impide repetirlo hasta acertar.';

alter table public.daily_challenge_results enable row level security;

-- Público (hay tabla del día), con la misma excepción de siempre para
-- quien esconde su actividad.
drop policy if exists "daily_challenge_results_select" on public.daily_challenge_results;
create policy "daily_challenge_results_select" on public.daily_challenge_results
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_profiles p
      where p.id = daily_challenge_results.user_id
        and coalesce(p.hide_activity, false) = false
    )
  );

drop policy if exists "daily_challenge_results_insert" on public.daily_challenge_results;
create policy "daily_challenge_results_insert" on public.daily_challenge_results
  for insert with check (auth.uid() = user_id);

-- Sin update ni delete: el reto del día se juega una vez.

-- ------------------------------------------------------------
-- 5. La tabla de mejores marcas de un curso
-- ------------------------------------------------------------
-- Una consulta en vez de traerse todas las partidas al navegador y
-- ordenarlas allí. Devuelve la MEJOR partida de cada persona, no todas:
-- si no, quien juega diez veces ocupa la tabla entera.
--
-- Devuelve la clasificación COMPLETA con su puesto, no solo los diez
-- primeros: hace falta para poder decirte "vas el 23º" cuando no estás
-- entre los mejores. Quedarse con los diez de arriba es cosa de quien
-- llama, que ya tiene su propia fila a mano.
drop function if exists public.course_leaderboard(uuid, integer);
drop function if exists public.course_leaderboard(uuid);
create or replace function public.course_leaderboard(p_guide_id uuid, p_limit integer default 100)
returns table (
  posicion bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  score integer,
  correct integer,
  total integer,
  medal text,
  duration_ms integer,
  achieved_at timestamptz
)
language sql
stable
as $$
  select
    row_number() over (
      order by m.score desc, m.duration_ms asc nulls last, m.created_at asc
    ) as posicion,
    m.user_id, m.username, m.display_name, m.avatar_url,
    m.score, m.correct, m.total, m.medal, m.duration_ms, m.created_at
  from (
    -- `distinct on` obliga a que el orden empiece por user_id; el resto
    -- del orden es lo que decide CUÁL de tus partidas es la buena.
    select distinct on (a.user_id)
      a.user_id, p.username, p.display_name, p.avatar_url,
      a.score, a.correct, a.total, a.medal, a.duration_ms, a.created_at
    from public.course_attempts a
    join public.user_profiles p on p.id = a.user_id
    where a.guide_id = p_guide_id
      and coalesce(p.hide_activity, false) = false
      and coalesce(p.is_banned, false) = false
    order by a.user_id, a.score desc, a.duration_ms asc nulls last, a.created_at asc
  ) m
  order by posicion
  limit greatest(coalesce(p_limit, 100), 1)
$$;

comment on function public.course_leaderboard(uuid, integer) is
  'Clasificación de un curso: la mejor partida de cada persona, con su puesto.';

grant execute on function public.course_leaderboard(uuid, integer) to anon, authenticated;

commit;

-- ============================================================
-- Comprobación rápida (opcional): pega esto después y mira que salgan
-- las cuatro tablas.
-- ============================================================
-- select table_name from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('course_attempts', 'question_stats',
--                      'course_review_queue', 'daily_challenge_results')
-- order by table_name;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
