-- Tanda 1319 — «Respuesta útil» en el foro (P4 del plan).
--
-- Marcar la solución de un tema ya existía (`forum_threads.solved_post_id`,
-- migración foro-extras, con su disparador que comprueba que el mensaje es
-- de ese tema). Lo nuevo: quien escribió la respuesta que resolvió la duda
-- se lleva +15 de XP y un aviso. UNA vez por tema (`forum_solucion_xp`): si
-- se quita la marca y se pone en otra, o se pone y se quita diez veces, no se
-- cobra otra vez. Nadie cobra por marcar su propia respuesta.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.forum_solucion_xp (
  thread_id uuid primary key references public.forum_threads (id) on delete cascade,
  post_id uuid,
  autor uuid,
  dado_at timestamptz not null default now()
);

-- Solo la escribe el disparador (security definer): sin políticas, nadie la
-- lee ni la toca desde la web.
alter table public.forum_solucion_xp enable row level security;

create or replace function public.foro_premiar_solucion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_autor uuid;
  v_nuevo uuid;
begin
  if new.solved_post_id is null or new.solved_post_id is not distinct from old.solved_post_id then
    return new;
  end if;
  select author_id into v_autor from public.forum_posts where id = new.solved_post_id and thread_id = new.id;
  if v_autor is null or v_autor is not distinct from new.author_id then
    return new;
  end if;
  insert into public.forum_solucion_xp (thread_id, post_id, autor)
  values (new.id, new.solved_post_id, v_autor)
  on conflict (thread_id) do nothing
  returning thread_id into v_nuevo;
  if v_nuevo is null then
    return new;
  end if;
  update public.user_profiles
     set total_xp = coalesce(total_xp, 0) + 15,
         level = public.nivel_de_xp(coalesce(total_xp, 0) + 15)
   where id = v_autor;
  insert into public.user_notifications (recipient_id, type, title, body, link)
  values (
    v_autor,
    'forum_solucion',
    'Tu respuesta resolvió una duda',
    left(coalesce(new.title, ''), 140) || ' · +15 XP',
    '/tema/' || new.id || '#mensaje-' || new.solved_post_id
  );
  return new;
end $$;

revoke all on function public.foro_premiar_solucion() from public, anon, authenticated;

drop trigger if exists trg_foro_premiar_solucion on public.forum_threads;

create trigger trg_foro_premiar_solucion
  after update of solved_post_id on public.forum_threads
  for each row execute function public.foro_premiar_solucion();
