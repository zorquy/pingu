-- ¿Puede un desconocido escribir en el chat de una mesa o de una llamada
-- al juez que no son suyos? (tanda 294)
--
-- En PostgreSQL, un INSERT NO mira el `using` de la política: SOLO el
-- `with check`. Las dos políticas de chat pedían pertenecer a la mesa
-- para LEER… y solo firmar con tu nombre para ESCRIBIR.
--
-- Esto NO argumenta: lo prueba. Primero con las políticas como estaban,
-- y después aplicando el fichero de migración DE VERDAD.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-chats.sql
\set ON_ERROR_STOP off
\set QUIET on

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.judge_messages, public.judge_calls, public.match_messages,
  public.tournament_matches, public.rounds, public.tournaments, public.user_profiles cascade;

create table public.user_profiles (id uuid primary key, username text, is_admin boolean default false);
create table public.tournaments (id uuid primary key, name text, admin_id uuid);
create table public.rounds (id uuid primary key, tournament_id uuid references public.tournaments(id));
create table public.tournament_matches (id uuid primary key, round_id uuid references public.rounds(id), player_a_id uuid, player_b_id uuid);
create table public.match_messages (id uuid primary key default gen_random_uuid(), match_id uuid references public.tournament_matches(id), sender_id uuid, message text);
create table public.judge_calls (id uuid primary key, tournament_id uuid references public.tournaments(id), match_id uuid, created_by uuid, status text);
create table public.judge_messages (id uuid primary key default gen_random_uuid(), judge_call_id uuid references public.judge_calls(id), sender_id uuid, message text);

create or replace function public.torneos_soy_admin() returns boolean language sql stable security definer as $$
  select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false) $$;
create or replace function public.torneos_soy_juez(t uuid) returns boolean language sql stable security definer as $$ select false $$;

insert into public.user_profiles values
  ('00000000-0000-0000-0000-0000000000b1','ash',false),
  ('00000000-0000-0000-0000-0000000000b2','misty',false),
  ('00000000-0000-0000-0000-0000000000c9','cotilla',false);
insert into public.tournaments values ('00000000-0000-0000-0000-000000000011','Copa','00000000-0000-0000-0000-0000000000b1');
insert into public.rounds values ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011');
insert into public.tournament_matches values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2');
insert into public.judge_calls values ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000b1','open');

alter table public.match_messages enable row level security;
alter table public.judge_messages enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.judge_calls enable row level security;
create policy todos on public.tournament_matches for select using (true);
-- Como en producción: una llamada la ve quien la abrió, jueces y admin.
create policy llamadas_ver on public.judge_calls for select
  using (created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(tournament_id));

create role jugador nologin;
grant usage on schema public, auth to jugador;
grant select, insert on all tables in schema public to jugador;
grant execute on all functions in schema public, auth to jugador;

-- Las políticas TAL Y COMO ESTABAN antes de la tanda 294.
create policy mensajes_mesa on public.match_messages for all
  using (exists (select 1 from tournament_matches m where m.id = match_id
    and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid() or torneos_soy_admin()
         or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))))
  with check (sender_id = auth.uid());
create policy mensajes_llamada on public.judge_messages for all
  using (exists (select 1 from judge_calls c where c.id = judge_call_id
    and (c.created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(c.tournament_id))))
  with check (sender_id = auth.uid());

select public.ponerse('00000000-0000-0000-0000-0000000000c9');
\set QUIET off

\echo ''
\echo '════ ANTES: un desconocido escribe donde no debe ════'
set role jugador;
insert into public.match_messages (match_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000c9','me cuelo en vuestra mesa');
insert into public.judge_messages (judge_call_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-0000000000c9','y en la llamada al juez');
reset role;
select (select count(*) from public.match_messages) as en_la_mesa,
       (select count(*) from public.judge_messages) as en_el_juez;

\echo ''
\echo '════ Se aplica supabase-migration-torneos-chats.sql ════'
\set QUIET on
\i /home/user/pingu/supabase-migration-torneos-chats.sql
delete from public.match_messages;
delete from public.judge_messages;
\set QUIET off

\echo ''
\echo '════ DESPUÉS: el mismo desconocido ════'
set role jugador;
insert into public.match_messages (match_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000c9','otra vez');
insert into public.judge_messages (judge_call_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-0000000000c9','otra vez');
reset role;

\echo ''
\echo '════ Y Ash, que SÍ juega esa mesa y abrió esa llamada ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
insert into public.match_messages (match_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000b1','voy con Pikachu');
insert into public.judge_messages (judge_call_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-0000000000b1','juez, una duda');
-- Y firmar con el nombre de otro tampoco cuela.
insert into public.match_messages (match_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000b2','soy Misty, en serio');
reset role;
select (select count(*) from public.match_messages) as en_la_mesa,
       (select count(*) from public.judge_messages) as en_el_juez;
