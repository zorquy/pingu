-- Tanda 1304 — la fecha de nacimiento deja de ser PÚBLICA.
--
-- `user_profiles` se lee entera para todo el mundo (la política
-- «user_profiles_public_read» es `using (true)`, también sin cuenta), y
-- `birthday` vivía ahí con el AÑO: cualquiera podía pedir a la API la fecha
-- de nacimiento completa de quien la hubiera puesto en Ajustes, que solo
-- promete «el día señalado el foro te felicita». En una comunidad con
-- gente de 14 años, eso es un dato personal que no tenía que salir.
--
-- Lo que hace falta en público es el MES y el DÍA (el foro felicita a quien
-- cumple hoy): eso se queda en `user_profiles.birthday_md`. La fecha entera
-- se muda a `user_cumple`, que solo lee y escribe su dueño, y un disparador
-- mantiene `birthday_md` al día. Al final, `user_profiles.birthday` se borra.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.user_cumple (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  birthday date not null,
  updated_at timestamptz not null default now()
);

alter table public.user_cumple enable row level security;

drop policy if exists user_cumple_mio on public.user_cumple;

create policy user_cumple_mio on public.user_cumple for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.user_cumple to authenticated;
  end if;
end $$;

-- Lo que ya había, a la tabla nueva (solo si la columna vieja sigue).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'birthday') then
    execute 'insert into public.user_cumple (user_id, birthday)
             select id, birthday from public.user_profiles where birthday is not null
             on conflict (user_id) do nothing';
  end if;
end $$;

-- `birthday_md` era una columna GENERADA a partir de `birthday`: así no
-- sobrevive a borrar `birthday`. Se rehace como columna normal (solo si
-- todavía es generada: a la segunda pasada ya no lo es y no se toca).
do $$
begin
  if exists (select 1 from pg_attribute a
             join pg_class c on c.oid = a.attrelid
             join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'user_profiles'
               and a.attname = 'birthday_md' and a.attgenerated <> '') then
    alter table public.user_profiles drop column birthday_md;
  end if;
end $$;

alter table public.user_profiles add column if not exists birthday_md text;

update public.user_profiles p
  set birthday_md = lpad(extract(month from c.birthday)::int::text, 2, '0') || '-' || lpad(extract(day from c.birthday)::int::text, 2, '0')
  from public.user_cumple c
  where c.user_id = p.id
    and p.birthday_md is distinct from lpad(extract(month from c.birthday)::int::text, 2, '0') || '-' || lpad(extract(day from c.birthday)::int::text, 2, '0');

create index if not exists user_profiles_birthday_md_idx
  on public.user_profiles (birthday_md)
  where birthday_md is not null;

-- El disparador: lo que se pone o se quita en `user_cumple` llega a
-- `birthday_md`. Es security definer para escribir en el perfil sin pasar
-- por la guarda de columnas de quien lo cambia.
create or replace function public.cumple_al_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    update public.user_profiles set birthday_md = null where id = old.user_id;
    return old;
  end if;
  update public.user_profiles
    set birthday_md = lpad(extract(month from new.birthday)::int::text, 2, '0') || '-' || lpad(extract(day from new.birthday)::int::text, 2, '0')
    where id = new.user_id;
  return new;
end $$;

drop trigger if exists trg_cumple_al_perfil on public.user_cumple;

create trigger trg_cumple_al_perfil
  after insert or update or delete on public.user_cumple
  for each row execute function public.cumple_al_perfil();

-- Y lo público deja de tener el año.
alter table public.user_profiles drop column if exists birthday;

notify pgrst, 'reload schema';
