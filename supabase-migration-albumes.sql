-- ─────────────────────────────────────────────────────────────────────
-- LOS ÁLBUMES SOÑADOS (tanda 366), en /mi-coleccion → «Álbumes».
--
-- Lo pidió PINGU: un álbum a tu gusto, con las cartas que quieras —las
-- que tienes o las que te gustaría tener— y en el orden que quieras. La
-- página lo enseña como un archivador y marca qué cartas ya son tuyas
-- (cruzando con `user_collection`) y cuánto costaría completarlo.
--
-- Un álbum guarda SOLO los identificadores de sus cartas, en orden:
--   cartas = [{ "id": "sv06-130" }, …]
-- Ni nombre ni imagen: el catálogo los tiene (misma regla que los mazos
-- del constructor, tanda 354). Una misma carta puede ir dos veces (dos
-- páginas temáticas que la comparten).
--
-- Privado por defecto; uno público se ve con el enlace
-- /mi-coleccion?album=<id>, sin poder tocarlo.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

create table if not exists public.user_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default 'Mi álbum',
  descripcion text,
  cartas jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_albums_nombre check (char_length(nombre) between 1 and 80),
  constraint user_albums_descripcion check (descripcion is null or char_length(descripcion) <= 500),
  -- Un tope en la base y no solo en la pantalla: la API se puede llamar a
  -- mano. 1.080 cartas son 120 páginas de nueve, un archivador enorme.
  constraint user_albums_cartas check (jsonb_typeof(cartas) = 'array' and jsonb_array_length(cartas) <= 1080)
);

create index if not exists user_albums_dueno_idx on public.user_albums (user_id, updated_at desc);

create or replace function public.user_albums_tocar()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists user_albums_tocar on public.user_albums;
create trigger user_albums_tocar
  before update on public.user_albums
  for each row execute function public.user_albums_tocar();

create or replace function public.user_albums_tope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.user_albums where user_id = new.user_id) >= 100 then
    raise exception 'Has llegado al máximo de 100 álbumes.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_albums_tope on public.user_albums;
create trigger user_albums_tope
  before insert on public.user_albums
  for each row execute function public.user_albums_tope();

alter table public.user_albums enable row level security;

drop policy if exists user_albums_ver on public.user_albums;
create policy user_albums_ver on public.user_albums
  for select using (is_public or auth.uid() = user_id);

drop policy if exists user_albums_crear on public.user_albums;
create policy user_albums_crear on public.user_albums
  for insert with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists user_albums_editar on public.user_albums;
create policy user_albums_editar on public.user_albums
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_albums_borrar on public.user_albums;
create policy user_albums_borrar on public.user_albums
  for delete using (auth.uid() = user_id);

grant select on public.user_albums to anon;
grant select, insert, update, delete on public.user_albums to authenticated;

commit;

select policyname, cmd from pg_policies where tablename = 'user_albums' order by policyname;

notify pgrst, 'reload schema';
