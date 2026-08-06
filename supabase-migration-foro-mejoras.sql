-- ============================================================
-- El foro, para usarlo a diario
-- ============================================================
--
-- Tres cosas que separan un foro que se visita de uno que se USA:
--
--   1. Saber qué hay nuevo desde la última vez. Sin esto, volver al foro
--      es comparar fechas a ojo.
--   2. Que te avisen cuando alguien responde donde tú estabas hablando.
--   3. Poder buscar dentro. El buscador del sitio mira guías y personas;
--      los mensajes del foro no los veía nadie.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada. Requiere haber ejecutado antes
-- supabase-migration-foro.sql y supabase-migration-busqueda-acentos.sql
-- (de esta última usa `plegar_texto()`).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Qué has leído
-- ------------------------------------------------------------
-- Una fila por tema visitado, con la fecha de la visita. Un tema está
-- "sin leer" cuando su último mensaje es más nuevo que tu marca.
--
-- Se guarda la FECHA y no un booleano a propósito: con un booleano, cada
-- mensaje nuevo obligaría a marcar como no leído a todo el mundo (una
-- escritura por persona y mensaje). Con la fecha, escribe solo quien
-- lee, y la comparación la hace la consulta.
create table if not exists public.forum_thread_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

create index if not exists forum_thread_reads_user_idx
  on public.forum_thread_reads (user_id, last_read_at desc);

comment on table public.forum_thread_reads is
  'Cuándo leíste cada tema. Un tema está sin leer si su last_post_at es posterior a esta marca (o a user_profiles.forum_read_all_at).';

alter table public.forum_thread_reads enable row level security;

-- Lo que has leído es asunto tuyo y de nadie más.
drop policy if exists "forum_thread_reads_own" on public.forum_thread_reads;
create policy "forum_thread_reads_own" on public.forum_thread_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- "Marcar todo como leído" en una sola fila, en vez de escribir una por
-- tema. Cualquier tema anterior a esta fecha cuenta como leído aunque no
-- tenga su marca propia.
alter table public.user_profiles
  add column if not exists forum_read_all_at timestamptz;

comment on column public.user_profiles.forum_read_all_at is
  'Fecha del último "marcar todo como leído" del foro. Evita escribir una fila por tema.';

-- ------------------------------------------------------------
-- 2. Suscripciones a un tema
-- ------------------------------------------------------------
create table if not exists public.forum_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

create index if not exists forum_subscriptions_thread_idx
  on public.forum_subscriptions (thread_id);

comment on table public.forum_subscriptions is
  'Quién quiere enterarse de las respuestas de un tema. Solo lo ve cada cual de sí mismo; para avisar se usa forum_avisar_suscritos().';

alter table public.forum_subscriptions enable row level security;

-- Cada uno ve y gestiona SOLO las suyas.
--
-- No es lectura pública a propósito: "quién sigue este tema" es una lista
-- de a quién le interesa qué, y no aporta nada a cambio de enseñarla.
-- Para poder avisar sin exponerla está la función de aquí abajo.
drop policy if exists "forum_subscriptions_own" on public.forum_subscriptions;
create policy "forum_subscriptions_own" on public.forum_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quien escribe en un tema queda suscrito solo.
--
-- Es lo que espera cualquiera: si has hablado ahí, quieres saber qué te
-- contestan. Se puede deshacer con el botón de dejar de seguir, y por eso
-- el insert es `on conflict do nothing`: si te diste de baja a mano y
-- vuelves a escribir, se te vuelve a suscribir — que es lo que significa
-- volver a participar.
create or replace function public.forum_suscribir_al_escribir()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.author_id is not null then
    insert into forum_subscriptions (user_id, thread_id)
    values (new.author_id, new.thread_id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_forum_suscribir_al_escribir on public.forum_posts;
create trigger trg_forum_suscribir_al_escribir
  after insert on public.forum_posts
  for each row execute function public.forum_suscribir_al_escribir();

-- Avisar a los suscritos de un mensaje nuevo.
--
-- Va aquí y no en el navegador porque el navegador NO PUEDE leer la lista
-- de suscritos (la política de arriba solo deja ver los propios). Como
-- `security definer`, esta función sí la ve, pero solo devuelve un
-- número: quién sigue el tema no sale nunca.
--
-- Respeta las preferencias de avisos de cada uno y nunca se avisa al que
-- acaba de escribir.
drop function if exists public.forum_avisar_suscritos(uuid, uuid, text);
create or replace function public.forum_avisar_suscritos(
  p_thread uuid,
  p_post uuid,
  p_titulo text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := auth.uid();
  v_cuantos integer := 0;
begin
  if v_yo is null then
    return 0;
  end if;

  -- Que el mensaje exista, sea de ese tema y sea de quien dice ser. Sin
  -- esto, cualquiera podría llamar a esto con un tema al azar y llenarle
  -- la campanita a media web.
  if not exists (
    select 1 from forum_posts p
    where p.id = p_post and p.thread_id = p_thread and p.author_id = v_yo
  ) then
    return 0;
  end if;

  with destinatarios as (
    select s.user_id
      from forum_subscriptions s
      join user_profiles u on u.id = s.user_id
     where s.thread_id = p_thread
       and s.user_id <> v_yo
       and coalesce(u.is_banned, false) = false
       and not (coalesce(u.notification_prefs_disabled, '{}') @> array['forum_reply'])
  ), insertados as (
    insert into user_notifications (recipient_id, type, title, body, link)
    select d.user_id,
           'forum_reply',
           'Nueva respuesta en un tema que sigues',
           left(coalesce(p_titulo, ''), 200),
           '/tema/' || p_thread::text
      from destinatarios d
    returning 1
  )
  select count(*) into v_cuantos from insertados;

  return v_cuantos;
end;
$$;

comment on function public.forum_avisar_suscritos(uuid, uuid, text) is
  'Avisa a los suscritos de un tema. security definer porque la lista de suscritos no es pública; devuelve solo cuántos avisos se han creado.';

grant execute on function public.forum_avisar_suscritos(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Buscar dentro del foro
-- ------------------------------------------------------------
-- Mismo método que el buscador de guías: una columna generada con el
-- texto plegado (sin acentos, en minúsculas) y un índice trigram encima,
-- para que `ilike '%pikachu%'` no se lea la tabla entera.
alter table public.forum_threads
  add column if not exists search_norm text
  generated always as (public.plegar_texto(coalesce(title, '') || ' ' || coalesce(prefix, ''))) stored;

create index if not exists forum_threads_search_norm_trgm_idx
  on public.forum_threads using gin (search_norm gin_trgm_ops);

-- En los mensajes hay que quitar las etiquetas antes de plegar: el cuerpo
-- se guarda como HTML, y sin esto buscar "div" o "strong" encontraría
-- todos los mensajes del foro.
alter table public.forum_posts
  add column if not exists search_norm text
  generated always as (
    public.plegar_texto(regexp_replace(coalesce(body_html, ''), '<[^>]*>', ' ', 'g'))
  ) stored;

create index if not exists forum_posts_search_norm_trgm_idx
  on public.forum_posts using gin (search_norm gin_trgm_ops);

comment on column public.forum_posts.search_norm is
  'Cuerpo del mensaje sin etiquetas HTML, sin acentos y en minúsculas. Generada: no se escribe a mano.';

commit;

-- ============================================================
-- Comprobación (opcional)
-- ============================================================
-- select table_name from information_schema.tables
--  where table_schema = 'public'
--    and table_name in ('forum_thread_reads', 'forum_subscriptions');
--
-- select title, search_norm from public.forum_threads limit 3;
