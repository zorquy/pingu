\set ON_ERROR_STOP off
\set QUIET on
-- Semilla: un organizador, dos jugadores, un torneo publicado, un
-- borrador, una ronda, una mesa y un resultado.
insert into public.user_profiles (id, username, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1','organizador', true),
  ('00000000-0000-0000-0000-0000000000b1','ash', false),
  ('00000000-0000-0000-0000-0000000000b2','misty', false)
on conflict do nothing;

insert into public.tournaments (id, slug, name, status, admin_id, start_at, max_players, swiss_rounds, pairing_seed)
values ('00000000-0000-0000-0000-000000000011','copa','Copa','registration_open','00000000-0000-0000-0000-0000000000a1', now(), 16, 4, 'semilla1'),
       ('00000000-0000-0000-0000-000000000012','borrador','Borrador','draft','00000000-0000-0000-0000-0000000000a1', now(), 16, 4, 'semilla2')
on conflict do nothing;

insert into public.tournament_registrations (id, tournament_id, user_id, status, tcg_live_username)
values ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b1','active','AshKetchum'),
       ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b2','active','MistyW')
on conflict do nothing;

insert into public.rounds (id, tournament_id, round_number, phase, status)
values ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011',1,'swiss','active') on conflict do nothing;
insert into public.tournament_matches (id, round_id, table_number, player_a_id, player_b_id, status)
values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000031',1,'00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','active') on conflict do nothing;
insert into public.tournament_decklists (id, tournament_id, user_id, raw_text, parsed_cards)
values ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b1','4 Pikachu','{}'::jsonb) on conflict do nothing;
insert into public.match_messages (match_id, sender_id, message)
values ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000b1','hola') on conflict do nothing;

\set QUIET off
\echo ''
\echo '── COMO ANÓNIMO (sin sesión) ──'
set role anon;
select set_config('prueba.uid', '', false);

\echo '1. El torneo publicado SÍ se ve (debe salir 1):'
select count(*) from public.tournaments where slug = 'copa';
\echo '2. El BORRADOR no (debe salir 0):'
select count(*) from public.tournaments where slug = 'borrador';
\echo '3. Los inscritos SÍ, por sus columnas públicas (debe salir 2):'
select count(*) from public.tournament_registrations;
\echo '4. El usuario de TCG Live NO (debe dar «permission denied for column»):'
select tcg_live_username from public.tournament_registrations limit 1;
\echo '5. Y un select * TAMPOCO (debe dar «permission denied»):'
select * from public.tournament_registrations limit 1;
\echo '5b. Pero las columnas públicas SÍ se leen (debe salir 2 nombres de jugador):'
select count(user_id) from public.tournament_registrations;
\echo '6. Rondas, mesas y resultados SÍ (debe salir 1 y 1):'
select count(*) from public.rounds;
select count(*) from public.tournament_matches;
\echo '7. Las decklists NO (debe salir 0):'
select count(*) from public.tournament_decklists;
\echo '8. El chat de mesa NO (debe salir 0):'
select count(*) from public.match_messages;
\echo '9. El historial de cruces NO (debe salir 0):'
select count(*) from public.pairing_history;
\echo '10. Y no puede ESCRIBIR nada (debe dar error de política):'
insert into public.tournament_registrations (tournament_id, user_id, status, tcg_live_username)
  values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b2','active','Colado');

reset role;
\echo ''
\echo '── COMO JUGADOR CON CUENTA (ash) ──'
set role authenticated;
select set_config('prueba.uid', '00000000-0000-0000-0000-0000000000b1', false);
\echo '11. Ve su propio usuario de TCG Live y el de los demás (debe salir 2):'
select count(tcg_live_username) from public.tournament_registrations;
\echo '12. Ve su decklist (debe salir 1):'
select count(*) from public.tournament_decklists;
reset role;
