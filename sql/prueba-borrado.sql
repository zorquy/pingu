-- ── ¿Quién puede borrar un torneo? (tanda 222) ──
-- Se prueba contra la RLS de verdad, no contra el botón: un rol sin
-- BYPASSRLS que se hace pasar por cada usuario con prueba.uid.
set client_min_messages = warning;

insert into public.user_profiles (id, username, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'jefa',    true),
  ('22222222-2222-2222-2222-222222222222', 'duenyo',  false),
  ('33333333-3333-3333-3333-333333333333', 'extranyo',false)
on conflict (id) do nothing;

-- Tres torneos idénticos, todos creados por «duenyo».
insert into public.tournaments (id, slug, admin_id, name, start_at, max_players, swiss_rounds, pairing_seed)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 't-uno',  '22222222-2222-2222-2222-222222222222', 'Uno',  now(), 8, 3, 's'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 't-dos',  '22222222-2222-2222-2222-222222222222', 'Dos',  now(), 8, 3, 's'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 't-tres', '22222222-2222-2222-2222-222222222222', 'Tres', now(), 8, 3, 's')
on conflict (id) do nothing;

-- Y uno con hijos, para ver que el borrado los arrastra en cascada.
insert into public.tournament_registrations (tournament_id, user_id, tcg_live_username)
values ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'TCG_extranyo')
on conflict do nothing;
insert into public.rounds (tournament_id, round_number, phase)
values ('aaaaaaaa-0000-0000-0000-000000000002', 1, 'swiss')
on conflict do nothing;

drop role if exists jugador;
create role jugador nologin;
grant usage on schema public, auth to jugador;
grant select, insert, update, delete on all tables in schema public to jugador;
grant execute on all functions in schema auth to jugador;

\echo ''
\echo '── 1. Un tercero NO puede borrar el torneo de otro ──'
set role jugador;
set prueba.uid = '33333333-3333-3333-3333-333333333333';
delete from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select case when count(*) = 1 then '  ok  sigue ahí' else '  FALLA  se lo ha cargado' end
  from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo ''
\echo '── 2. Quien lo creó SÍ puede, aunque no sea admin del sitio ──'
set role jugador;
set prueba.uid = '22222222-2222-2222-2222-222222222222';
delete from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000002';
reset role;
select case when count(*) = 0 then '  ok  borrado por su dueño' else '  FALLA  no ha podido' end
  from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select case when count(*) = 0 then '  ok  y sus inscripciones se van en cascada' else '  FALLA  quedan inscripciones huérfanas' end
  from public.tournament_registrations where tournament_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select case when count(*) = 0 then '  ok  y sus rondas también' else '  FALLA  quedan rondas huérfanas' end
  from public.rounds where tournament_id = 'aaaaaaaa-0000-0000-0000-000000000002';

\echo ''
\echo '── 3. El admin del sitio puede con el de cualquiera ──'
set role jugador;
set prueba.uid = '11111111-1111-1111-1111-111111111111';
delete from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
select case when count(*) = 0 then '  ok  borrado por la jefa' else '  FALLA  no ha podido' end
  from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000003';

\echo ''
\echo '── 4. Sin sesión no se borra nada ──'
set role jugador;
set prueba.uid = '';
delete from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select case when count(*) = 1 then '  ok  sigue ahí' else '  FALLA  borrado sin sesión' end
  from public.tournaments where id = 'aaaaaaaa-0000-0000-0000-000000000001';
