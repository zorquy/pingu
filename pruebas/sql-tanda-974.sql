-- Tanda 974: los «Sí» de la caja de valoraciones pasan a «Me ha servido».
--
-- Contra PostgreSQL, con la migración DE VERDAD (\i):
--   1. Los «Sí» (rating >= 4) se copian; los «No tanto» no.
--   2. Quien ya había pulsado los dos cuenta una vez.
--   3. El autor no cuenta en su propia guía.
--   4. El disparador de XP NO se dispara en la copia, y queda ENCENDIDO.
--   5. Ejecutarla dos veces no copia nada más.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-974.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = warning;

drop table if exists public.guide_helpful, public.guide_reviews, public.guides, public.xp_dado cascade;
create table public.guides (id uuid primary key, author_id uuid);
create table public.guide_reviews (id uuid primary key default gen_random_uuid(), guide_id uuid references public.guides(id), reviewer_id uuid not null, rating int not null, created_at timestamptz not null default now(), unique (guide_id, reviewer_id));
create table public.guide_helpful (guide_id uuid not null references public.guides(id) on delete cascade, user_id uuid not null, created_at timestamptz not null default now(), primary key (guide_id, user_id));
create table public.xp_dado (guide_id uuid, user_id uuid);

create or replace function public.xp_autor_por_agradecimiento() returns trigger language plpgsql as $$
begin insert into public.xp_dado values (new.guide_id, new.user_id); return new; end $$;
create trigger trg_xp_autor_por_agradecimiento after insert on public.guide_helpful for each row execute function public.xp_autor_por_agradecimiento();

-- Guía G de A; B dijo Sí, C dijo No tanto, D dijo Sí y ADEMÁS pulsó el botón; A se valoró a sí mismo.
insert into public.guides values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a');
insert into public.guide_reviews (guide_id, reviewer_id, rating, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 5, '2026-09-01'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000c', 2, '2026-09-02'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000d', 5, '2026-09-03'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 5, '2026-09-04');
insert into public.guide_helpful (guide_id, user_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000d');
delete from public.xp_dado;

\i /home/user/pingu/supabase-migration-974-servido-desde-valoraciones.sql

select case when (select array_agg(right(user_id::text, 1) order by user_id) from public.guide_helpful) = array['b', 'd']
  then 'ok  los «Sí» se copian (B), los «No tanto» no (C), el autor no (A), y D sigue una vez'
  else 'FALLA  quedan: ' || (select string_agg(right(user_id::text, 1), ',' order by user_id) from public.guide_helpful) end;
select case when (select created_at::date from public.guide_helpful where right(user_id::text, 1) = 'b') = '2026-09-01'
  then 'ok  con el día de la valoración' else 'FALLA  el día no es el de la valoración' end;
select case when (select count(*) from public.xp_dado) = 0 then 'ok  la copia no da XP' else 'FALLA  la copia dio XP: ' || (select count(*) from public.xp_dado) end;
select case when (select tgenabled from pg_trigger where tgname = 'trg_xp_autor_por_agradecimiento') = 'O'
  then 'ok  el disparador de XP queda encendido' else 'FALLA  el disparador se quedó apagado' end;

insert into public.guide_helpful (guide_id, user_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000ee');
select case when (select count(*) from public.xp_dado) = 1 then 'ok    …y un «Me ha servido» nuevo sí da XP' else 'FALLA  un «Me ha servido» nuevo no dio XP' end;

\i /home/user/pingu/supabase-migration-974-servido-desde-valoraciones.sql
select case when (select count(*) from public.guide_helpful) = 3 then 'ok  ejecutarla otra vez no copia nada' else 'FALLA  la segunda vez copió: ' || (select count(*) from public.guide_helpful) end;

drop table if exists public.guide_helpful, public.guide_reviews, public.guides, public.xp_dado cascade;
drop function if exists public.xp_autor_por_agradecimiento() cascade;
