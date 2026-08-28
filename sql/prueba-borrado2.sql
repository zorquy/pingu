-- La MISMA prueba, pero con la RLS del lanzamiento ya puesta: la regla
-- de quién borra tiene que seguir siendo la misma el día que se abra.
set client_min_messages = warning;
insert into public.tournaments (id, slug, admin_id, name, start_at, max_players, swiss_rounds, pairing_seed, status)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'p-uno',  '22222222-2222-2222-2222-222222222222', 'Uno',  now(), 8, 3, 's', 'registration_open'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'p-dos',  '22222222-2222-2222-2222-222222222222', 'Dos',  now(), 8, 3, 's', 'draft')
on conflict (id) do nothing;
grant usage on schema public, auth to jugador;
grant select, insert, update, delete on all tables in schema public to jugador;

\echo ''
\echo '── Con la RLS pública: un tercero sigue sin poder ──'
set role jugador;
set prueba.uid = '33333333-3333-3333-3333-333333333333';
delete from public.tournaments where id = 'bbbbbbbb-0000-0000-0000-000000000001';
reset role;
select case when count(*) = 1 then '  ok  sigue ahí' else '  FALLA  se lo ha cargado' end
  from public.tournaments where id = 'bbbbbbbb-0000-0000-0000-000000000001';

\echo '── Y su dueño sí, incluso con el torneo en BORRADOR ──'
set role jugador;
set prueba.uid = '22222222-2222-2222-2222-222222222222';
delete from public.tournaments where id = 'bbbbbbbb-0000-0000-0000-000000000002';
reset role;
select case when count(*) = 0 then '  ok  borrador borrado por su dueño' else '  FALLA  no ha podido con su propio borrador' end
  from public.tournaments where id = 'bbbbbbbb-0000-0000-0000-000000000002';
