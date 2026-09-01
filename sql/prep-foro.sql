-- Andamio mínimo para probar supabase-migration-foro-torneos.sql:
-- solo las dos tablas que toca, con las mismas columnas y guardas que
-- en supabase-migration-foro.sql.
drop schema if exists public cascade;
create schema public;

create table public.forum_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0
);

create table public.forum_boards (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.forum_sections (id) on delete cascade,
  parent_id uuid references public.forum_boards (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  position integer not null default 0,
  post_policy text not null default 'todos' check (post_policy in ('todos', 'staff')),
  is_hidden boolean not null default false
);

-- Las secciones y foros que ya trae el foro de verdad.
insert into public.forum_sections (name, position) values ('Comunidad', 1), ('Colección', 2), ('Café', 3);
insert into public.forum_boards (section_id, name, slug, position)
select id, 'Anuncios', 'anuncios', 1 from public.forum_sections where name = 'Comunidad';
