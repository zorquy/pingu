-- Sistema de seguidores/seguidos (perfil "Acerca")
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self check (follower_id <> following_id)
);

create index if not exists user_follows_following_idx on public.user_follows(following_id);
create index if not exists user_follows_follower_idx on public.user_follows(follower_id);

alter table public.user_follows enable row level security;

drop policy if exists "user_follows_public_read" on public.user_follows;
create policy "user_follows_public_read" on public.user_follows
  for select using (true);

drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own" on public.user_follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own" on public.user_follows
  for delete using (auth.uid() = follower_id);

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
