-- Extras del foro: resuelto, contador, firma, reacciones y quién lee
-- ============================================================
--
-- Cinco cosas de foro de toda la vida, aprobadas de la lista:
--
--   1. "Resuelto": quien abre una duda marca la respuesta que se la
--      resolvió. El tema sale con su ✓ y la respuesta destacada.
--   2. Contador de mensajes bajo el avatar ("Mensajes: 336").
--   3. Firma al pie de los mensajes (texto plano, corta).
--   4. Reacciones 👍 ❤️ 😂 😮 en vez de solo "Me gusta".
--   5. Quién está leyendo este tema (sobre los usuarios en línea).
--
-- Necesita supabase-migration-foro.sql, foro-titulos.sql y en-linea.sql.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Resuelto
-- ------------------------------------------------------------
alter table public.forum_threads
  add column if not exists solved_post_id uuid references public.forum_posts (id) on delete set null;

-- La política de update ya deja al autor (y al equipo) tocar su tema; lo
-- que la política no puede comprobar es que el mensaje elegido SEA de ese
-- tema — sin esto, se podría marcar como solución un mensaje de otro hilo.
create or replace function public.forum_valida_resuelto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.solved_post_id is not null
     and not exists (
       select 1 from public.forum_posts p
       where p.id = new.solved_post_id and p.thread_id = new.id
     ) then
    raise exception 'La solución tiene que ser un mensaje de este mismo tema.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_forum_valida_resuelto on public.forum_threads;
create trigger trg_forum_valida_resuelto
  before update of solved_post_id on public.forum_threads
  for each row execute function public.forum_valida_resuelto();

-- ------------------------------------------------------------
-- 2. Contador de mensajes
-- ------------------------------------------------------------
-- Lo mantiene un disparador, no una cuenta al vuelo: la columna del autor
-- sale en CADA mensaje de CADA tema, y contar mensajes de cada persona en
-- cada carga sería la consulta más repetida de la web.
alter table public.user_profiles
  add column if not exists forum_post_count integer not null default 0;

create or replace function public.forum_contar_mensajes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.user_profiles
     set forum_post_count = greatest(0, forum_post_count + (case when tg_op = 'INSERT' then 1 else -1 end))
   where id = coalesce(new.author_id, old.author_id);
  return null;
end;
$$;

drop trigger if exists trg_forum_contar_mensajes on public.forum_posts;
create trigger trg_forum_contar_mensajes
  after insert or delete on public.forum_posts
  for each row execute function public.forum_contar_mensajes();

-- Los mensajes que ya existen: el disparador solo cuenta a partir de
-- ahora, así que se rellena una vez.
update public.user_profiles p
   set forum_post_count = (select count(*) from public.forum_posts fp where fp.author_id = p.id)
 where true;

-- ------------------------------------------------------------
-- 3. Firma
-- ------------------------------------------------------------
-- HTML del mismo editor que los mensajes (formato, enlaces, una imagen),
-- guardado ya saneado y RE-saneado al pintarse. El tope de 1.000 es para
-- el HTML entero (una imagen del editor ocupa ~150); el de las 240 letras
-- visibles lo impone la pantalla, y el tamaño EN pantalla lo impone el
-- CSS: la firma se recorta a su altura con scroll propio e imágenes a
-- tamaño de firma — las firmas de tres párrafos con imágenes gigantes son
-- lo que hizo ilegibles los foros de 2008.
alter table public.user_profiles
  add column if not exists forum_signature text;

alter table public.user_profiles
  drop constraint if exists user_profiles_forum_signature_corta;
alter table public.user_profiles
  add constraint user_profiles_forum_signature_corta
  check (forum_signature is null or char_length(forum_signature) <= 1000);

-- ------------------------------------------------------------
-- 4. Reacciones
-- ------------------------------------------------------------
-- UNA reacción por persona y mensaje (cambiar de emoji es un update, no
-- una segunda fila): con cuatro emojis y filas ilimitadas, un mensaje se
-- "auto-infla" reaccionando cuatro veces.
create table if not exists public.forum_post_reactions (
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('like', 'love', 'laugh', 'wow')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists forum_post_reactions_post_idx
  on public.forum_post_reactions (post_id);

alter table public.forum_post_reactions enable row level security;

drop policy if exists "forum_post_reactions_select" on public.forum_post_reactions;
create policy "forum_post_reactions_select" on public.forum_post_reactions for select using (true);

-- Reaccionarse a uno mismo no es una señal de nada: la base lo prohíbe,
-- igual que hacía con el "me gusta".
drop policy if exists "forum_post_reactions_insert" on public.forum_post_reactions;
create policy "forum_post_reactions_insert" on public.forum_post_reactions
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned()
    and exists (
      select 1 from public.forum_posts p
      where p.id = post_id and p.author_id is distinct from auth.uid()
    )
  );

drop policy if exists "forum_post_reactions_update" on public.forum_post_reactions;
create policy "forum_post_reactions_update" on public.forum_post_reactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forum_post_reactions_delete" on public.forum_post_reactions;
create policy "forum_post_reactions_delete" on public.forum_post_reactions
  for delete using (auth.uid() = user_id);

-- Los "me gusta" que ya había se convierten en reacciones 👍 para no
-- perder ni uno. La tabla vieja se queda (por si acaso), pero la web ya
-- no la escribe.
insert into public.forum_post_reactions (post_id, user_id, kind, created_at)
select l.post_id, l.user_id, 'like', l.created_at
  from public.forum_post_likes l
on conflict (post_id, user_id) do nothing;

-- ------------------------------------------------------------
-- 5. Quién está leyendo este tema
-- ------------------------------------------------------------
-- Sobre los usuarios en línea: el latido apunta también EN QUÉ tema estás
-- (y solo eso — los temas son públicos, y el dato caduca con el latido).
-- En cualquier otra página, el latido lo deja a null.
alter table public.online_now
  add column if not exists thread_id uuid;

create index if not exists online_now_thread_idx
  on public.online_now (thread_id) where thread_id is not null;

-- La función cambia de firma: hay que retirar la vieja para que PostgREST
-- no vea dos candidatas.
drop function if exists public.latido_en_linea(text);

create or replace function public.latido_en_linea(p_token text, p_thread uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f-]{36}$' then
    return;
  end if;

  -- Un tema que no existe se ignora en vez de romper el latido: el
  -- contador de en línea vale más que el dato del tema.
  if p_thread is not null and not exists (select 1 from public.forum_threads t where t.id = p_thread) then
    p_thread := null;
  end if;

  insert into public.online_now as o (token, user_id, thread_id, last_seen)
  values (p_token, auth.uid(), p_thread, now())
  on conflict (token) do update
    set last_seen = now(),
        -- El tema SE SOBRESCRIBE siempre, incluso a null: si no, salir de
        -- un tema te dejaría "leyéndolo" un cuarto de hora más.
        thread_id = excluded.thread_id,
        user_id = coalesce(auth.uid(), o.user_id);

  delete from public.online_now where last_seen < now() - interval '1 day';
end;
$$;

grant execute on function public.latido_en_linea(text, uuid) to anon, authenticated;

commit;

-- Que PostgREST vea la tabla y las columnas nuevas sin esperar.
notify pgrst, 'reload schema';

-- ── Comprobación ──
-- select username, forum_post_count from public.user_profiles order by forum_post_count desc limit 5;
-- select kind, count(*) from public.forum_post_reactions group by kind;
