-- ¿Puede JUGAR un usuario normal con la sección abierta? (tanda 252)
--
-- Esto es lo que decide si el torneo se puede jugar: la RLS fina
-- sustituye al candado solo-admins, y si falta una política un jugador
-- pulsa un botón y NO PASA NADA — sin error, porque un INSERT o un
-- DELETE que la política rechaza no da error, simplemente no toca nada.
\set ON_ERROR_STOP off
\pset pager off

-- Dos personas y un torneo con las inscripciones abiertas.
insert into public.user_profiles (id, username, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', true),
  ('00000000-0000-0000-0000-0000000000b1', 'ash', false),
  ('00000000-0000-0000-0000-0000000000b2', 'misty', false)
on conflict (id) do nothing;

insert into public.tournaments (id, slug, admin_id, name, start_at, status, max_players, swiss_rounds, pairing_seed)
values ('10000000-0000-0000-0000-000000000001', 'copa', '00000000-0000-0000-0000-0000000000a1',
        'Copa Inaugural', now() + interval '2 hours', 'registration_open', 16, 3, 'semilla')
on conflict (id) do nothing;

\echo ''
\echo '=== 1. ASH (usuario normal) se apunta ==='
set role authenticated;
select set_config('prueba.uid', '00000000-0000-0000-0000-0000000000b1', false);

\echo '-- insert DIRECTO: tiene que fallar o no tocar nada'
insert into public.tournament_registrations (tournament_id, user_id, status, tcg_live_username)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'active', 'AshK');

\echo '-- por la RPC: tiene que funcionar'
select public.torneos_inscribirse('10000000-0000-0000-0000-000000000001', 'AshK') is not null as apuntado;
select count(*) as inscripciones_de_ash from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';

\echo ''
\echo '=== 2. Y puede salirse antes de que empiece ==='
delete from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
select count(*) as tras_salirse from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
\echo '-- y volver a apuntarse (por eso se BORRA la fila y no se marca)'
select public.torneos_inscribirse('10000000-0000-0000-0000-000000000001', 'AshK') is not null as reapuntado;

\echo ''
\echo '=== 3. Con el torneo EN JUEGO ya no se puede borrar la fila ==='
reset role;
update public.tournaments set status = 'in_progress' where id = '10000000-0000-0000-0000-000000000001';
insert into public.tournament_registrations (tournament_id, user_id, status, tcg_live_username)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'active', 'MistyW')
  on conflict do nothing;
insert into public.rounds (id, tournament_id, round_number, phase, status)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'swiss', 'active')
  on conflict (id) do nothing;
insert into public.tournament_matches (id, round_id, table_number, player_a_id, player_b_id, status)
  values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1,
          '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 'active')
  on conflict (id) do nothing;
set role authenticated;
select set_config('prueba.uid', '00000000-0000-0000-0000-0000000000b1', false);
delete from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
select count(*) as sigue_inscrito from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
\echo '-- pero SÍ darse de baja (deja rastro)'
update public.tournament_registrations set status = 'dropped' where user_id = '00000000-0000-0000-0000-0000000000b1';
select status as estado_tras_baja from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
update public.tournament_registrations set status = 'active' where user_id = '00000000-0000-0000-0000-0000000000b1';

\echo ''
\echo '=== 4. Check-in: directo NO, por la RPC SÍ ==='
update public.tournament_matches set check_in_a_at = now() where id = '30000000-0000-0000-0000-000000000001';
select check_in_a_at is null as sigue_sin_checkin from public.tournament_matches where id = '30000000-0000-0000-0000-000000000001';
select public.torneos_checkin('30000000-0000-0000-0000-000000000001') as checkin_rpc;
select check_in_a_at is not null as ya_con_checkin from public.tournament_matches where id = '30000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== 5. Reportar: directo NO, por la RPC SÍ ==='
insert into public.match_reports (match_id, reporter_id, result)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'win');
select count(*) as reportes_directos from public.match_reports;
select public.torneos_reportar('30000000-0000-0000-0000-000000000001', 'win') as primer_reporte;
select set_config('prueba.uid', '00000000-0000-0000-0000-0000000000b2', false);
select public.torneos_reportar('30000000-0000-0000-0000-000000000001', 'loss') as segundo_reporte;
select result, winner_id = '00000000-0000-0000-0000-0000000000b1' as gana_ash from public.match_results
  where match_id = '30000000-0000-0000-0000-000000000001';
select status as estado_mesa from public.tournament_matches where id = '30000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== 6. Y lo que NO puede hacer un jugador ==='
update public.tournament_matches set status = 'finished' where id = '30000000-0000-0000-0000-000000000001';
select status as estado_intacto from public.tournament_matches where id = '30000000-0000-0000-0000-000000000001';
update public.tournaments set name = 'Mi torneo' where id = '10000000-0000-0000-0000-000000000001';
select name as nombre_intacto from public.tournaments where id = '10000000-0000-0000-0000-000000000001';
delete from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
select count(*) as no_borra_al_otro from public.tournament_registrations where user_id = '00000000-0000-0000-0000-0000000000b1';
reset role;
