-- Encuestas en el foro
-- ============================================================
--
-- Abrir un tema con votación. Sirve para decidir qué guía escribir a
-- continuación, para preguntarle a la comunidad qué prefiere, o para lo
-- primero que se va a hacer con ella: ponerle nombre a la mascota
-- votándolo entre todos.
--
-- Es la función que más movimiento genera en un foro nuevo, porque votar
-- cuesta un clic y participar en un hilo cuesta escribir un párrafo.
--
-- Necesita supabase-migration-foro.sql.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- La encuesta cuelga del TEMA, una como mucho. No es una tabla suelta a
-- propósito: una encuesta sin su hilo no tiene dónde discutirse, que es
-- justo lo que la hace de un foro y no de un formulario.
create table if not exists public.forum_polls (
  thread_id uuid primary key references public.forum_threads (id) on delete cascade,
  question text not null,
  -- Varias respuestas por persona. Se decide al crearla y no se puede
  -- cambiar después: si se pudiera, los votos ya emitidos significarían
  -- otra cosa distinta de la que quiso decir quien los echó.
  multiple boolean not null default false,
  -- Una encuesta puede cerrarse sola. Nulo = abierta para siempre.
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.forum_poll_options (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_polls (thread_id) on delete cascade,
  label text not null,
  order_pos integer not null default 0
);

create index if not exists forum_poll_options_thread_idx
  on public.forum_poll_options (thread_id, order_pos);

-- Hace falta para la clave ajena compuesta de los votos (ver abajo).
-- thread_id ya es la clave primaria, así que esto no restringe nada
-- nuevo: solo le da a Postgres un índice al que apuntar.
create unique index if not exists forum_polls_thread_multiple
  on public.forum_polls (thread_id, multiple);

create table if not exists public.forum_poll_votes (
  option_id uuid not null references public.forum_poll_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Se guarda también el tema: sin él, "un voto por persona en esta
  -- encuesta" no se puede imponer con una restricción, solo mirando las
  -- opciones una a una desde el cliente — que es lo mismo que no
  -- imponerlo.
  thread_id uuid not null,
  -- Y se copia si la encuesta admite varias respuestas.
  --
  -- Copiar un dato duele, pero aquí compra lo que no se puede comprar de
  -- otra forma: un índice único PARCIAL no puede llevar una subconsulta
  -- (Postgres no lo permite), así que sin esta columna no hay manera de
  -- decir "único por persona SOLO si la encuesta es de respuesta única".
  --
  -- Y no puede mentir: la clave ajena compuesta de abajo obliga a que
  -- este valor sea EXACTAMENTE el de la encuesta. Quien inserte un voto
  -- con multiple = true en una encuesta de respuesta única se lleva un
  -- error de integridad, no un voto extra.
  multiple boolean not null,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id),
  constraint forum_poll_votes_encuesta_fk
    foreign key (thread_id, multiple)
    references public.forum_polls (thread_id, multiple)
    on delete cascade on update cascade
);

-- ESTA es la que hace que un voto sea un voto.
--
-- En una encuesta de respuesta única, un índice único por (tema,
-- persona) impide la segunda opción A NIVEL DE BASE. Sin él, bastaría
-- con abrir dos pestañas —o llamar a la API dos veces— para votar dos
-- veces, y ninguna comprobación del navegador lo evitaría. Una
-- comprobación en un disparador tampoco bastaría: dos inserciones a la
-- vez podrían pasarla las dos.
--
-- En las de respuesta múltiple no aplica: ahí varias filas por persona
-- son justo lo que se quiere.
create unique index if not exists forum_poll_votes_una_por_persona
  on public.forum_poll_votes (thread_id, user_id)
  where multiple = false;

create index if not exists forum_poll_votes_option_idx
  on public.forum_poll_votes (option_id);

alter table public.forum_polls enable row level security;
alter table public.forum_poll_options enable row level security;
alter table public.forum_poll_votes enable row level security;

-- ── Quién puede ver qué ──
-- Las encuestas se leen sin cuenta, igual que los temas: quien llega de
-- fuera tiene que poder ver el resultado.
drop policy if exists "forum_polls_select" on public.forum_polls;
create policy "forum_polls_select" on public.forum_polls for select using (true);

drop policy if exists "forum_poll_options_select" on public.forum_poll_options;
create policy "forum_poll_options_select" on public.forum_poll_options for select using (true);

drop policy if exists "forum_poll_votes_select" on public.forum_poll_votes;
create policy "forum_poll_votes_select" on public.forum_poll_votes for select using (true);

-- ── Crear la encuesta: solo quien abre el tema ──
--
-- La comprobación es que sea el autor del tema Y que el tema se acabe de
-- crear. Sin lo segundo, alguien podría colgarle una encuesta a un hilo
-- suyo de hace meses en el que ya hay conversación.
drop policy if exists "forum_polls_insert" on public.forum_polls;
create policy "forum_polls_insert" on public.forum_polls
  for insert with check (
    not public.is_banned()
    and not public.is_muted()
    and exists (
      select 1 from public.forum_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
        and t.created_at > now() - interval '5 minutes'
    )
  );

drop policy if exists "forum_poll_options_insert" on public.forum_poll_options;
create policy "forum_poll_options_insert" on public.forum_poll_options
  for insert with check (
    exists (
      select 1 from public.forum_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
        and t.created_at > now() - interval '5 minutes'
    )
  );

-- Nadie edita ni borra opciones después: cambiarle el texto a una opción
-- ya votada convierte los votos emitidos en votos a otra cosa. Para
-- retirar una encuesta está el staff, que puede borrar el tema entero.
drop policy if exists "forum_polls_staff" on public.forum_polls;
create policy "forum_polls_staff" on public.forum_polls
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "forum_poll_options_staff" on public.forum_poll_options;
create policy "forum_poll_options_staff" on public.forum_poll_options
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Votar ──
--
-- Con cuenta, sin estar baneado, y solo si la encuesta sigue abierta. Lo
-- del cierre va AQUÍ y no solo en el navegador: si no, esconder el botón
-- no impediría votar llamando a la API.
drop policy if exists "forum_poll_votes_insert" on public.forum_poll_votes;
create policy "forum_poll_votes_insert" on public.forum_poll_votes
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned()
    and exists (
      select 1 from public.forum_polls p
      join public.forum_poll_options o on o.thread_id = p.thread_id
      where o.id = option_id
        and p.thread_id = forum_poll_votes.thread_id
        and (p.closes_at is null or p.closes_at > now())
    )
  );

-- Cambiar de opinión mientras esté abierta: se borra el voto y se echa
-- otro. Es lo que espera cualquiera que haya usado una encuesta.
drop policy if exists "forum_poll_votes_delete" on public.forum_poll_votes;
create policy "forum_poll_votes_delete" on public.forum_poll_votes
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.forum_polls p
      where p.thread_id = forum_poll_votes.thread_id
        and (p.closes_at is null or p.closes_at > now())
    )
  );

-- ── El recuento ──
--
-- Se cuenta en la base y no en el cliente: traerse todos los votos para
-- contarlos en JavaScript significa mandar una fila por voto, y además
-- deja el resultado a merced de lo que el cliente decida contar.
create or replace function public.forum_poll_resultados(p_thread uuid)
returns table (option_id uuid, label text, order_pos integer, votos bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select o.id, o.label, o.order_pos, count(v.user_id)
  from public.forum_poll_options o
  left join public.forum_poll_votes v on v.option_id = o.id
  where o.thread_id = p_thread
  group by o.id, o.label, o.order_pos
  order by o.order_pos
$$;

commit;
