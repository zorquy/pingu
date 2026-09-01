-- ═══════════════════════════════════════════════════════════════════
-- TORNEO DE PRUEBA (tanda 236): un torneo TERMINADO para poder
-- comprobar el historial de partidas sin jugar uno de verdad.
--
-- Lo pidió Ibai: «créame un torneo con partidas ya jugadas y con
-- distintas decklists que puedas sacar de los últimos torneos de
-- Limitless». Las 8 listas son las del top del World Championships
-- 2026 (28-08-2026, limitlesstcg.com/tournaments/515), un arquetipo
-- distinto por jugador, y los parsed_cards salen del MISMO parser de
-- la web (js/torneos/motor.js), no de una imitación.
--
-- Crea 7 cuentas de MENTIRA (demo-worlds-1..7, sin contraseña posible:
-- encrypted_password vacío) y usa la cuenta REAL de Ibai
-- (admin@cardzone.es) como octavo jugador, con 2-1: así /mis-partidas
-- y el palmarés del perfil tienen algo que enseñar.
--
-- Es RE-EJECUTABLE (on conflict do nothing) y se DESHACE entero con el
-- bloque comentado del final.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── Los 7 jugadores de mentira ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000001'::uuid, 'authenticated', 'authenticated', 'demo-worlds-1@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000002'::uuid, 'authenticated', 'authenticated', 'demo-worlds-2@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000003'::uuid, 'authenticated', 'authenticated', 'demo-worlds-3@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000004'::uuid, 'authenticated', 'authenticated', 'demo-worlds-4@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000005'::uuid, 'authenticated', 'authenticated', 'demo-worlds-5@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000006'::uuid, 'authenticated', 'authenticated', 'demo-worlds-6@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'deb00000-0000-4000-8000-000000000007'::uuid, 'authenticated', 'authenticated', 'demo-worlds-7@pokedoc.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.user_profiles (id, username, display_name, onboarding_completed)
values
  ('deb00000-0000-4000-8000-000000000001'::uuid, 'demo-worlds-1', 'Andrew Hedrick (demo)', true),
  ('deb00000-0000-4000-8000-000000000002'::uuid, 'demo-worlds-2', 'Henry Chao (demo)', true),
  ('deb00000-0000-4000-8000-000000000003'::uuid, 'demo-worlds-3', 'Rune Heiremans (demo)', true),
  ('deb00000-0000-4000-8000-000000000004'::uuid, 'demo-worlds-4', 'Mateusz Łaszkiewicz (demo)', true),
  ('deb00000-0000-4000-8000-000000000005'::uuid, 'demo-worlds-5', 'Nathan Spry (demo)', true),
  ('deb00000-0000-4000-8000-000000000006'::uuid, 'demo-worlds-6', 'Öjvind Svinhufvud (demo)', true),
  ('deb00000-0000-4000-8000-000000000007'::uuid, 'demo-worlds-7', 'Hui Yuan Huang (demo)', true)
-- Upsert y no do-nothing: si el proyecto tuviera un trigger que crea el
-- perfil al nacer el usuario, el nuestro chocaría y los nombres se
-- quedarían vacíos. Así, gane quien gane la carrera, el nombre queda.
on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name,
      onboarding_completed = true;

-- ── El torneo, terminado ──
insert into public.tournaments (id, slug, admin_id, name, description, start_at, status, max_players, swiss_rounds, round_time_minutes, checkin_minutes, swiss_bo, top_cut_bo, top_cut_size, pairing_seed, champion_id, podium)
values (
  'debf0000-0000-4000-8000-0000000000aa', 'demo-worlds-2026', (select id from auth.users where email = 'admin@cardzone.es'),
  'Mundial PokeDoc (demo)',
  '<p>Torneo de PRUEBA con las decklists del top del World Championships 2026 (Limitless). Para probar el historial de partidas.</p>',
  '2026-08-30 16:00:00+02', 'finished', 8, 3, 30, 5, 1, 3, 0, 'demo-worlds-2026',
  'deb00000-0000-4000-8000-000000000001'::uuid, jsonb_build_array('deb00000-0000-4000-8000-000000000001'::uuid::text, (select id from auth.users where email = 'admin@cardzone.es')::text, 'deb00000-0000-4000-8000-000000000003'::uuid::text, 'deb00000-0000-4000-8000-000000000002'::uuid::text)
)
on conflict (id) do nothing;

-- ── Las 3 rondas suizas, cerradas ──
insert into public.rounds (id, tournament_id, round_number, phase, started_at, ends_at, closed_at, status)
values
  ('debf0000-0000-4000-8000-0000000000b1', 'debf0000-0000-4000-8000-0000000000aa', 1, 'swiss', '2026-08-30 16:00:00+02', '2026-08-30 16:30:00+02', '2026-08-30 16:40:00+02', 'finished'),
  ('debf0000-0000-4000-8000-0000000000b2', 'debf0000-0000-4000-8000-0000000000aa', 2, 'swiss', '2026-08-30 17:00:00+02', '2026-08-30 17:30:00+02', '2026-08-30 17:40:00+02', 'finished'),
  ('debf0000-0000-4000-8000-0000000000b3', 'debf0000-0000-4000-8000-0000000000aa', 3, 'swiss', '2026-08-30 18:00:00+02', '2026-08-30 18:30:00+02', '2026-08-30 18:40:00+02', 'finished')
on conflict (id) do nothing;

-- ── Inscripciones (todas confirmadas) ──
insert into public.tournament_registrations (tournament_id, user_id, status, tcg_live_username, participation_confirmed_at)
values
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000001'::uuid, 'active', 'demo1', now()),
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000002'::uuid, 'active', 'demo2', now()),
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000003'::uuid, 'active', 'demo3', now()),
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000004'::uuid, 'active', 'demo4', now()),
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000005'::uuid, 'active', 'demo5', now()),
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000006'::uuid, 'active', 'demo6', now()),
  ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000007'::uuid, 'active', 'demo7', now()),
  ('debf0000-0000-4000-8000-0000000000aa', (select id from auth.users where email = 'admin@cardzone.es'), 'active', 'ibai', now())
on conflict (tournament_id, user_id) do nothing;

-- ── Las decklists del Mundial (selladas) ──
-- P1: Dragapult — #1 Andrew Hedrick
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000001'::uuid, 'Pokémon: 19
4 Dreepy TWM 128
4 Drakloak TWM 129
3 Dragapult ex TWM 130
2 Munkidori TWM 95
2 Budew ASC 16
1 Dunsparce JTG 120
1 Dudunsparce TEF 129
1 Meowth ex POR 62
1 Fezandipiti ex ASC 142

Entrenador: 32
4 Lillie''s Determination MEG 119
3 Boss''s Orders MEG 114
2 Crispin SCR 133
1 Rosa''s Encouragement POR 84
4 Poké Pad POR 81
4 Crushing Hammer POR 71
4 Buddy-Buddy Poffin TEF 144
3 Night Stretcher ASC 196
3 Ultra Ball MEG 131
1 Unfair Stamp TWM 165
1 Special Red Card CRI 82
2 Risky Ruins MEG 127

Energía: 9
3 Fire Energy MEE 2
3 Darkness Energy MEE 7
3 Psychic Energy MEE 5

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Dreepy","set":"TWM","number":"128"},{"quantity":4,"name":"Drakloak","set":"TWM","number":"129"},{"quantity":3,"name":"Dragapult ex","set":"TWM","number":"130"},{"quantity":2,"name":"Munkidori","set":"TWM","number":"95"},{"quantity":2,"name":"Budew","set":"ASC","number":"16"},{"quantity":1,"name":"Dunsparce","set":"JTG","number":"120"},{"quantity":1,"name":"Dudunsparce","set":"TEF","number":"129"},{"quantity":1,"name":"Meowth ex","set":"POR","number":"62"},{"quantity":1,"name":"Fezandipiti ex","set":"ASC","number":"142"}],"trainer":[{"quantity":4,"name":"Lillie''s Determination","set":"MEG","number":"119"},{"quantity":3,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":2,"name":"Crispin","set":"SCR","number":"133"},{"quantity":1,"name":"Rosa''s Encouragement","set":"POR","number":"84"},{"quantity":4,"name":"Poké Pad","set":"POR","number":"81"},{"quantity":4,"name":"Crushing Hammer","set":"POR","number":"71"},{"quantity":4,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":3,"name":"Night Stretcher","set":"ASC","number":"196"},{"quantity":3,"name":"Ultra Ball","set":"MEG","number":"131"},{"quantity":1,"name":"Unfair Stamp","set":"TWM","number":"165"},{"quantity":1,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":2,"name":"Risky Ruins","set":"MEG","number":"127"}],"energy":[{"quantity":3,"name":"Fire Energy","set":"MEE","number":"2"},{"quantity":3,"name":"Darkness Energy","set":"MEE","number":"7"},{"quantity":3,"name":"Psychic Energy","set":"MEE","number":"5"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P2: Dragapult Dusknoir — #4 Henry Chao
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000002'::uuid, 'Pokémon: 22
4 Dreepy TWM 128
4 Drakloak TWM 129
3 Dragapult ex TWM 130
2 Duskull PRE 35
2 Dusclops PRE 36
1 Dusknoir PRE 37
2 Budew ASC 16
1 Meowth ex POR 62
1 Patrat CRI 70
1 Fezandipiti ex ASC 142
1 Moltres PFL 14

Entrenador: 30
4 Lillie''s Determination MEG 119
3 Boss''s Orders MEG 114
1 Crispin SCR 133
1 Rosa''s Encouragement POR 84
1 Dawn PFL 87
1 Judge POR 76
4 Buddy-Buddy Poffin TEF 144
4 Poké Pad POR 81
4 Ultra Ball MEG 131
4 Night Stretcher ASC 196
1 Special Red Card CRI 82
1 Unfair Stamp TWM 165
1 Jamming Tower TWM 153

Energía: 8
4 Psychic Energy MEE 5
4 Fire Energy MEE 2

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Dreepy","set":"TWM","number":"128"},{"quantity":4,"name":"Drakloak","set":"TWM","number":"129"},{"quantity":3,"name":"Dragapult ex","set":"TWM","number":"130"},{"quantity":2,"name":"Duskull","set":"PRE","number":"35"},{"quantity":2,"name":"Dusclops","set":"PRE","number":"36"},{"quantity":1,"name":"Dusknoir","set":"PRE","number":"37"},{"quantity":2,"name":"Budew","set":"ASC","number":"16"},{"quantity":1,"name":"Meowth ex","set":"POR","number":"62"},{"quantity":1,"name":"Patrat","set":"CRI","number":"70"},{"quantity":1,"name":"Fezandipiti ex","set":"ASC","number":"142"},{"quantity":1,"name":"Moltres","set":"PFL","number":"14"}],"trainer":[{"quantity":4,"name":"Lillie''s Determination","set":"MEG","number":"119"},{"quantity":3,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":1,"name":"Crispin","set":"SCR","number":"133"},{"quantity":1,"name":"Rosa''s Encouragement","set":"POR","number":"84"},{"quantity":1,"name":"Dawn","set":"PFL","number":"87"},{"quantity":1,"name":"Judge","set":"POR","number":"76"},{"quantity":4,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":4,"name":"Poké Pad","set":"POR","number":"81"},{"quantity":4,"name":"Ultra Ball","set":"MEG","number":"131"},{"quantity":4,"name":"Night Stretcher","set":"ASC","number":"196"},{"quantity":1,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":1,"name":"Unfair Stamp","set":"TWM","number":"165"},{"quantity":1,"name":"Jamming Tower","set":"TWM","number":"153"}],"energy":[{"quantity":4,"name":"Psychic Energy","set":"MEE","number":"5"},{"quantity":4,"name":"Fire Energy","set":"MEE","number":"2"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P3: Crustle — #5 Rune Heiremans
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000003'::uuid, 'Pokémon: 10
4 Mega Kangaskhan ex MEG 104
3 Dwebble DRI 11
3 Crustle DRI 12

Entrenador: 37
4 Team Rocket''s Petrel DRI 176
4 Lillie''s Determination MEG 119
4 Boss''s Orders MEG 114
3 Eri TEF 146
2 Hilda WHT 84
1 Xerosic''s Machinations SFA 64
1 Pokémon Center Lady MEG 123
4 Jumbo Ice Cream PFL 91
3 Pokégear 3.0 SVI 186
2 Buddy-Buddy Poffin TEF 144
1 Special Red Card CRI 82
1 Switch MEG 130
1 Ultra Ball MEG 131
1 Enhanced Hammer TWM 148
1 Handheld Fan TWM 150
1 Hero''s Cape TEF 152
1 Lumiose City POR 77
1 Festival Grounds TWM 149
1 Team Rocket''s Factory DRI 173

Energía: 13
4 Growing Grass Energy POR 86
4 Mist Energy TEF 161
4 Spiky Energy JTG 159
1 Grass Energy MEE 1

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Mega Kangaskhan ex","set":"MEG","number":"104"},{"quantity":3,"name":"Dwebble","set":"DRI","number":"11"},{"quantity":3,"name":"Crustle","set":"DRI","number":"12"}],"trainer":[{"quantity":4,"name":"Team Rocket''s Petrel","set":"DRI","number":"176"},{"quantity":4,"name":"Lillie''s Determination","set":"MEG","number":"119"},{"quantity":4,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":3,"name":"Eri","set":"TEF","number":"146"},{"quantity":2,"name":"Hilda","set":"WHT","number":"84"},{"quantity":1,"name":"Xerosic''s Machinations","set":"SFA","number":"64"},{"quantity":1,"name":"Pokémon Center Lady","set":"MEG","number":"123"},{"quantity":4,"name":"Jumbo Ice Cream","set":"PFL","number":"91"},{"quantity":3,"name":"Pokégear 3.0","set":"SVI","number":"186"},{"quantity":2,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":1,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":1,"name":"Switch","set":"MEG","number":"130"},{"quantity":1,"name":"Ultra Ball","set":"MEG","number":"131"},{"quantity":1,"name":"Enhanced Hammer","set":"TWM","number":"148"},{"quantity":1,"name":"Handheld Fan","set":"TWM","number":"150"},{"quantity":1,"name":"Hero''s Cape","set":"TEF","number":"152"},{"quantity":1,"name":"Lumiose City","set":"POR","number":"77"},{"quantity":1,"name":"Festival Grounds","set":"TWM","number":"149"},{"quantity":1,"name":"Team Rocket''s Factory","set":"DRI","number":"173"}],"energy":[{"quantity":4,"name":"Growing Grass Energy","set":"POR","number":"86"},{"quantity":4,"name":"Mist Energy","set":"TEF","number":"161"},{"quantity":4,"name":"Spiky Energy","set":"JTG","number":"159"},{"quantity":1,"name":"Grass Energy","set":"MEE","number":"1"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P4: Alakazam Dusknoir — #7 Mateusz Łaszkiewicz
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000004'::uuid, 'Pokémon: 24
4 Duskull PRE 35
2 Dusclops PRE 36
2 Dusknoir PRE 37
2 Abra TWM 80
2 Abra MEG 54
4 Kadabra MEG 55
3 Alakazam MEG 56
2 Budew ASC 16
1 Shaymin DRI 10
1 Patrat CRI 70
1 Fezandipiti ex ASC 142

Entrenador: 31
4 Gwynn PBL 78
4 Hilda WHT 84
2 Dawn PFL 87
1 Boss''s Orders MEG 114
4 Poké Pad POR 81
4 Rare Candy MEG 125
3 Buddy-Buddy Poffin TEF 144
3 Strange Timepiece MEG 128
2 Night Stretcher ASC 196
2 Special Red Card CRI 82
1 Sacred Ash DRI 168
1 Prime Catcher TEF 157

Energía: 5
4 Telepathic Psychic Energy POR 88
1 Psychic Energy MEE 5

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Duskull","set":"PRE","number":"35"},{"quantity":2,"name":"Dusclops","set":"PRE","number":"36"},{"quantity":2,"name":"Dusknoir","set":"PRE","number":"37"},{"quantity":2,"name":"Abra","set":"TWM","number":"80"},{"quantity":2,"name":"Abra","set":"MEG","number":"54"},{"quantity":4,"name":"Kadabra","set":"MEG","number":"55"},{"quantity":3,"name":"Alakazam","set":"MEG","number":"56"},{"quantity":2,"name":"Budew","set":"ASC","number":"16"},{"quantity":1,"name":"Shaymin","set":"DRI","number":"10"},{"quantity":1,"name":"Patrat","set":"CRI","number":"70"},{"quantity":1,"name":"Fezandipiti ex","set":"ASC","number":"142"}],"trainer":[{"quantity":4,"name":"Gwynn","set":"PBL","number":"78"},{"quantity":4,"name":"Hilda","set":"WHT","number":"84"},{"quantity":2,"name":"Dawn","set":"PFL","number":"87"},{"quantity":1,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":4,"name":"Poké Pad","set":"POR","number":"81"},{"quantity":4,"name":"Rare Candy","set":"MEG","number":"125"},{"quantity":3,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":3,"name":"Strange Timepiece","set":"MEG","number":"128"},{"quantity":2,"name":"Night Stretcher","set":"ASC","number":"196"},{"quantity":2,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":1,"name":"Sacred Ash","set":"DRI","number":"168"},{"quantity":1,"name":"Prime Catcher","set":"TEF","number":"157"}],"energy":[{"quantity":4,"name":"Telepathic Psychic Energy","set":"POR","number":"88"},{"quantity":1,"name":"Psychic Energy","set":"MEE","number":"5"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P5: Ogerpon Box — #8 Nathan Spry
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000005'::uuid, 'Pokémon: 20
4 Mega Kangaskhan ex MEG 104
3 Meowth ex POR 62
2 Latias ex SSP 76
2 Lillie''s Clefairy ex JTG 56
2 Teal Mask Ogerpon ex TWM 25
1 Wellspring Mask Ogerpon ex TWM 64
1 Iron Leaves ex TEF 25
1 Enamorus TWM 93
1 Fezandipiti ex ASC 142
1 Chien-Pao SSP 56
1 Iron Crown ex TEF 81
1 Raging Bolt ex TEF 123

Entrenador: 27
4 Crispin SCR 133
2 Cyrano SSP 170
2 Boss''s Orders MEG 114
1 Ciphermaniac''s Codebreaking TEF 145
4 Ultra Ball MEG 131
4 Energy Switch MEG 115
2 Night Stretcher ASC 196
2 Glass Trumpet SCR 135
1 Special Red Card CRI 82
1 Prime Catcher TEF 157
3 Area Zero Underdepths SCR 131
1 Jamming Tower TWM 153

Energía: 13
6 Grass Energy MEE 1
2 Lightning Energy MEE 4
2 Psychic Energy MEE 5
2 Fighting Energy MEE 6
1 Water Energy MEE 3

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Mega Kangaskhan ex","set":"MEG","number":"104"},{"quantity":3,"name":"Meowth ex","set":"POR","number":"62"},{"quantity":2,"name":"Latias ex","set":"SSP","number":"76"},{"quantity":2,"name":"Lillie''s Clefairy ex","set":"JTG","number":"56"},{"quantity":2,"name":"Teal Mask Ogerpon ex","set":"TWM","number":"25"},{"quantity":1,"name":"Wellspring Mask Ogerpon ex","set":"TWM","number":"64"},{"quantity":1,"name":"Iron Leaves ex","set":"TEF","number":"25"},{"quantity":1,"name":"Enamorus","set":"TWM","number":"93"},{"quantity":1,"name":"Fezandipiti ex","set":"ASC","number":"142"},{"quantity":1,"name":"Chien-Pao","set":"SSP","number":"56"},{"quantity":1,"name":"Iron Crown ex","set":"TEF","number":"81"},{"quantity":1,"name":"Raging Bolt ex","set":"TEF","number":"123"}],"trainer":[{"quantity":4,"name":"Crispin","set":"SCR","number":"133"},{"quantity":2,"name":"Cyrano","set":"SSP","number":"170"},{"quantity":2,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":1,"name":"Ciphermaniac''s Codebreaking","set":"TEF","number":"145"},{"quantity":4,"name":"Ultra Ball","set":"MEG","number":"131"},{"quantity":4,"name":"Energy Switch","set":"MEG","number":"115"},{"quantity":2,"name":"Night Stretcher","set":"ASC","number":"196"},{"quantity":2,"name":"Glass Trumpet","set":"SCR","number":"135"},{"quantity":1,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":1,"name":"Prime Catcher","set":"TEF","number":"157"},{"quantity":3,"name":"Area Zero Underdepths","set":"SCR","number":"131"},{"quantity":1,"name":"Jamming Tower","set":"TWM","number":"153"}],"energy":[{"quantity":6,"name":"Grass Energy","set":"MEE","number":"1"},{"quantity":2,"name":"Lightning Energy","set":"MEE","number":"4"},{"quantity":2,"name":"Psychic Energy","set":"MEE","number":"5"},{"quantity":2,"name":"Fighting Energy","set":"MEE","number":"6"},{"quantity":1,"name":"Water Energy","set":"MEE","number":"3"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P6: N''s Zoroark — #9 Öjvind Svinhufvud
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000006'::uuid, 'Pokémon: 19
4 N''s Zorua JTG 97
4 N''s Zoroark ex JTG 98
2 N''s Zekrom ASC 155
1 N''s Darumaka JTG 26
1 N''s Darmanitan JTG 27
1 Budew ASC 16
1 Yveltal MEG 88
1 Tatsugiri TWM 131
1 Munkidori TWM 95
1 Pecharunt ex SFA 39
1 Meowth ex POR 62
1 Fezandipiti ex ASC 142

Entrenador: 33
4 Lillie''s Determination MEG 119
3 Boss''s Orders MEG 114
2 Cyrano SSP 170
1 Black Belt''s Training JTG 143
4 Buddy-Buddy Poffin TEF 144
4 Transformation Tome CRI 83
3 N''s PP Up JTG 153
3 Ultra Ball MEG 131
2 Poké Pad POR 81
1 Night Stretcher ASC 196
1 Special Red Card CRI 82
1 Secret Box TWM 163
2 Binding Mochi PRE 95
2 N''s Castle JTG 152

Energía: 8
8 Darkness Energy MEE 7

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"N''s Zorua","set":"JTG","number":"97"},{"quantity":4,"name":"N''s Zoroark ex","set":"JTG","number":"98"},{"quantity":2,"name":"N''s Zekrom","set":"ASC","number":"155"},{"quantity":1,"name":"N''s Darumaka","set":"JTG","number":"26"},{"quantity":1,"name":"N''s Darmanitan","set":"JTG","number":"27"},{"quantity":1,"name":"Budew","set":"ASC","number":"16"},{"quantity":1,"name":"Yveltal","set":"MEG","number":"88"},{"quantity":1,"name":"Tatsugiri","set":"TWM","number":"131"},{"quantity":1,"name":"Munkidori","set":"TWM","number":"95"},{"quantity":1,"name":"Pecharunt ex","set":"SFA","number":"39"},{"quantity":1,"name":"Meowth ex","set":"POR","number":"62"},{"quantity":1,"name":"Fezandipiti ex","set":"ASC","number":"142"}],"trainer":[{"quantity":4,"name":"Lillie''s Determination","set":"MEG","number":"119"},{"quantity":3,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":2,"name":"Cyrano","set":"SSP","number":"170"},{"quantity":1,"name":"Black Belt''s Training","set":"JTG","number":"143"},{"quantity":4,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":4,"name":"Transformation Tome","set":"CRI","number":"83"},{"quantity":3,"name":"N''s PP Up","set":"JTG","number":"153"},{"quantity":3,"name":"Ultra Ball","set":"MEG","number":"131"},{"quantity":2,"name":"Poké Pad","set":"POR","number":"81"},{"quantity":1,"name":"Night Stretcher","set":"ASC","number":"196"},{"quantity":1,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":1,"name":"Secret Box","set":"TWM","number":"163"},{"quantity":2,"name":"Binding Mochi","set":"PRE","number":"95"},{"quantity":2,"name":"N''s Castle","set":"JTG","number":"152"}],"energy":[{"quantity":8,"name":"Darkness Energy","set":"MEE","number":"7"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P7: Dragapult Dudunsparce — #14 Hui Yuan Huang
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', 'deb00000-0000-4000-8000-000000000007'::uuid, 'Pokémon: 22
4 Dreepy TWM 128
4 Drakloak TWM 129
3 Dragapult ex TWM 130
2 Dunsparce JTG 120
2 Dudunsparce TEF 129
1 Dudunsparce ex JTG 121
2 Munkidori TWM 95
1 Budew ASC 16
1 Lillie''s Clefairy ex JTG 56
1 Meowth ex POR 62
1 Yveltal MEG 88

Entrenador: 29
4 Lillie''s Determination MEG 119
3 Crispin SCR 133
3 Boss''s Orders MEG 114
1 Team Rocket''s Petrel DRI 176
4 Poké Pad POR 81
4 Buddy-Buddy Poffin TEF 144
4 Ultra Ball MEG 131
2 Night Stretcher ASC 196
1 Special Red Card CRI 82
1 Hero''s Cape TEF 152
2 Risky Ruins MEG 127

Energía: 9
3 Psychic Energy MEE 5
3 Darkness Energy MEE 7
3 Fire Energy MEE 2

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Dreepy","set":"TWM","number":"128"},{"quantity":4,"name":"Drakloak","set":"TWM","number":"129"},{"quantity":3,"name":"Dragapult ex","set":"TWM","number":"130"},{"quantity":2,"name":"Dunsparce","set":"JTG","number":"120"},{"quantity":2,"name":"Dudunsparce","set":"TEF","number":"129"},{"quantity":1,"name":"Dudunsparce ex","set":"JTG","number":"121"},{"quantity":2,"name":"Munkidori","set":"TWM","number":"95"},{"quantity":1,"name":"Budew","set":"ASC","number":"16"},{"quantity":1,"name":"Lillie''s Clefairy ex","set":"JTG","number":"56"},{"quantity":1,"name":"Meowth ex","set":"POR","number":"62"},{"quantity":1,"name":"Yveltal","set":"MEG","number":"88"}],"trainer":[{"quantity":4,"name":"Lillie''s Determination","set":"MEG","number":"119"},{"quantity":3,"name":"Crispin","set":"SCR","number":"133"},{"quantity":3,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":1,"name":"Team Rocket''s Petrel","set":"DRI","number":"176"},{"quantity":4,"name":"Poké Pad","set":"POR","number":"81"},{"quantity":4,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":4,"name":"Ultra Ball","set":"MEG","number":"131"},{"quantity":2,"name":"Night Stretcher","set":"ASC","number":"196"},{"quantity":1,"name":"Special Red Card","set":"CRI","number":"82"},{"quantity":1,"name":"Hero''s Cape","set":"TEF","number":"152"},{"quantity":2,"name":"Risky Ruins","set":"MEG","number":"127"}],"energy":[{"quantity":3,"name":"Psychic Energy","set":"MEE","number":"5"},{"quantity":3,"name":"Darkness Energy","set":"MEE","number":"7"},{"quantity":3,"name":"Fire Energy","set":"MEE","number":"2"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- P8 (IBAI): Alakazam Dudunsparce — #2 Diego Cassiraga
insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, locked_at)
values ('debf0000-0000-4000-8000-0000000000aa', (select id from auth.users where email = 'admin@cardzone.es'), 'Pokémon: 22
4 Abra MEG 54
4 Kadabra MEG 55
3 Alakazam MEG 56
3 Dunsparce JTG 120
3 Dudunsparce TEF 129
2 Genesect SFA 40
1 Dedenne SSP 87
1 Fezandipiti ex ASC 142
1 Shaymin DRI 10

Entrenador: 32
4 Dawn PFL 87
3 Hilda WHT 84
2 Boss''s Orders MEG 114
1 Lana''s Aid TWM 155
1 Eri TEF 146
4 Buddy-Buddy Poffin TEF 144
4 Poké Pad POR 81
3 Rare Candy MEG 125
2 Enhanced Hammer TWM 148
1 Sacred Ash DRI 168
2 Air Balloon ASC 181
1 Lucky Helmet TWM 158
4 Battle Cage PFL 85

Energía: 6
4 Telepathic Psychic Energy POR 88
1 Psychic Energy MEE 5
1 Enriching Energy SSP 191

Total de cartas: 60', '{"pokemon":[{"quantity":4,"name":"Abra","set":"MEG","number":"54"},{"quantity":4,"name":"Kadabra","set":"MEG","number":"55"},{"quantity":3,"name":"Alakazam","set":"MEG","number":"56"},{"quantity":3,"name":"Dunsparce","set":"JTG","number":"120"},{"quantity":3,"name":"Dudunsparce","set":"TEF","number":"129"},{"quantity":2,"name":"Genesect","set":"SFA","number":"40"},{"quantity":1,"name":"Dedenne","set":"SSP","number":"87"},{"quantity":1,"name":"Fezandipiti ex","set":"ASC","number":"142"},{"quantity":1,"name":"Shaymin","set":"DRI","number":"10"}],"trainer":[{"quantity":4,"name":"Dawn","set":"PFL","number":"87"},{"quantity":3,"name":"Hilda","set":"WHT","number":"84"},{"quantity":2,"name":"Boss''s Orders","set":"MEG","number":"114"},{"quantity":1,"name":"Lana''s Aid","set":"TWM","number":"155"},{"quantity":1,"name":"Eri","set":"TEF","number":"146"},{"quantity":4,"name":"Buddy-Buddy Poffin","set":"TEF","number":"144"},{"quantity":4,"name":"Poké Pad","set":"POR","number":"81"},{"quantity":3,"name":"Rare Candy","set":"MEG","number":"125"},{"quantity":2,"name":"Enhanced Hammer","set":"TWM","number":"148"},{"quantity":1,"name":"Sacred Ash","set":"DRI","number":"168"},{"quantity":2,"name":"Air Balloon","set":"ASC","number":"181"},{"quantity":1,"name":"Lucky Helmet","set":"TWM","number":"158"},{"quantity":4,"name":"Battle Cage","set":"PFL","number":"85"}],"energy":[{"quantity":4,"name":"Telepathic Psychic Energy","set":"POR","number":"88"},{"quantity":1,"name":"Psychic Energy","set":"MEE","number":"5"},{"quantity":1,"name":"Enriching Energy","set":"SSP","number":"191"}],"total":60}'::jsonb, '2026-08-30 16:00:00+02')
on conflict (tournament_id, user_id) do nothing;

-- ── Mesas y resultados ──
insert into public.tournament_matches (id, round_id, table_number, player_a_id, player_b_id, status, finished_at)
values
  ('debf0000-0000-4000-8000-0000000000c1', 'debf0000-0000-4000-8000-0000000000b1', 1, 'deb00000-0000-4000-8000-000000000001'::uuid, 'deb00000-0000-4000-8000-000000000002'::uuid, 'finished', '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c2', 'debf0000-0000-4000-8000-0000000000b1', 2, 'deb00000-0000-4000-8000-000000000003'::uuid, 'deb00000-0000-4000-8000-000000000004'::uuid, 'finished', '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c3', 'debf0000-0000-4000-8000-0000000000b1', 3, 'deb00000-0000-4000-8000-000000000005'::uuid, 'deb00000-0000-4000-8000-000000000006'::uuid, 'finished', '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c4', 'debf0000-0000-4000-8000-0000000000b1', 4, 'deb00000-0000-4000-8000-000000000007'::uuid, (select id from auth.users where email = 'admin@cardzone.es'), 'finished', '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c5', 'debf0000-0000-4000-8000-0000000000b2', 1, 'deb00000-0000-4000-8000-000000000001'::uuid, 'deb00000-0000-4000-8000-000000000003'::uuid, 'finished', '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c6', 'debf0000-0000-4000-8000-0000000000b2', 2, (select id from auth.users where email = 'admin@cardzone.es'), 'deb00000-0000-4000-8000-000000000005'::uuid, 'finished', '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c7', 'debf0000-0000-4000-8000-0000000000b2', 3, 'deb00000-0000-4000-8000-000000000002'::uuid, 'deb00000-0000-4000-8000-000000000004'::uuid, 'finished', '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c8', 'debf0000-0000-4000-8000-0000000000b2', 4, 'deb00000-0000-4000-8000-000000000006'::uuid, 'deb00000-0000-4000-8000-000000000007'::uuid, 'finished', '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c9', 'debf0000-0000-4000-8000-0000000000b3', 1, 'deb00000-0000-4000-8000-000000000001'::uuid, (select id from auth.users where email = 'admin@cardzone.es'), 'finished', '2026-08-30 18:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000ca', 'debf0000-0000-4000-8000-0000000000b3', 2, 'deb00000-0000-4000-8000-000000000003'::uuid, 'deb00000-0000-4000-8000-000000000005'::uuid, 'finished', '2026-08-30 18:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000cb', 'debf0000-0000-4000-8000-0000000000b3', 3, 'deb00000-0000-4000-8000-000000000002'::uuid, 'deb00000-0000-4000-8000-000000000006'::uuid, 'finished', '2026-08-30 18:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000cc', 'debf0000-0000-4000-8000-0000000000b3', 4, 'deb00000-0000-4000-8000-000000000004'::uuid, 'deb00000-0000-4000-8000-000000000007'::uuid, 'finished', '2026-08-30 18:25:00+02')
on conflict (id) do nothing;

insert into public.match_results (match_id, result, winner_id, resolved_at)
values
  ('debf0000-0000-4000-8000-0000000000c1', 'a_wins', 'deb00000-0000-4000-8000-000000000001'::uuid, '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c2', 'a_wins', 'deb00000-0000-4000-8000-000000000003'::uuid, '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c3', 'a_wins', 'deb00000-0000-4000-8000-000000000005'::uuid, '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c4', 'b_wins', (select id from auth.users where email = 'admin@cardzone.es'), '2026-08-30 16:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c5', 'a_wins', 'deb00000-0000-4000-8000-000000000001'::uuid, '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c6', 'a_wins', (select id from auth.users where email = 'admin@cardzone.es'), '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c7', 'a_wins', 'deb00000-0000-4000-8000-000000000002'::uuid, '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c8', 'a_wins', 'deb00000-0000-4000-8000-000000000006'::uuid, '2026-08-30 17:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000c9', 'a_wins', 'deb00000-0000-4000-8000-000000000001'::uuid, '2026-08-30 18:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000ca', 'a_wins', 'deb00000-0000-4000-8000-000000000003'::uuid, '2026-08-30 18:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000cb', 'a_wins', 'deb00000-0000-4000-8000-000000000002'::uuid, '2026-08-30 18:25:00+02'),
  ('debf0000-0000-4000-8000-0000000000cc', 'draw', null, '2026-08-30 18:25:00+02')
on conflict (match_id) do nothing;

-- ── El catálogo de los 8 arquetipos del Mundial ──
insert into public.tcg_archetypes (id, nombre, iconos, requiere)
values
  ('dragapult', 'Dragapult', '[{"nombre":"Dragapult ex","set":"TWM","numero":"130"}]'::jsonb, '[{"nombres":["Dragapult ex"],"set":"TWM","numero":"130"}]'::jsonb),
  ('dragapult-dusknoir', 'Dragapult Dusknoir', '[{"nombre":"Dragapult ex","set":"TWM","numero":"130"},{"nombre":"Dusknoir","set":"PRE","numero":"37"}]'::jsonb, '[{"nombres":["Dragapult ex"],"set":"TWM","numero":"130"},{"nombres":["Dusknoir"],"set":"PRE","numero":"37"}]'::jsonb),
  ('dragapult-dudunsparce', 'Dragapult Dudunsparce', '[{"nombre":"Dragapult ex","set":"TWM","numero":"130"},{"nombre":"Dudunsparce ex","set":"JTG","numero":"121"}]'::jsonb, '[{"nombres":["Dragapult ex"],"set":"TWM","numero":"130"},{"nombres":["Dudunsparce ex"],"set":"JTG","numero":"121"}]'::jsonb),
  ('alakazam-dudunsparce', 'Alakazam Dudunsparce', '[{"nombre":"Alakazam","set":"MEG","numero":"56"},{"nombre":"Dudunsparce","set":"TEF","numero":"129"}]'::jsonb, '[{"nombres":["Alakazam"],"set":"MEG","numero":"56"},{"nombres":["Dudunsparce"],"set":"TEF","numero":"129"}]'::jsonb),
  ('alakazam-dusknoir', 'Alakazam Dusknoir', '[{"nombre":"Alakazam","set":"MEG","numero":"56"},{"nombre":"Dusknoir","set":"PRE","numero":"37"}]'::jsonb, '[{"nombres":["Alakazam"],"set":"MEG","numero":"56"},{"nombres":["Dusknoir"],"set":"PRE","numero":"37"}]'::jsonb),
  ('crustle', 'Crustle', '[{"nombre":"Crustle","set":"DRI","numero":"12"},{"nombre":"Mega Kangaskhan ex","set":"MEG","numero":"104"}]'::jsonb, '[{"nombres":["Crustle"],"set":"DRI","numero":"12"}]'::jsonb),
  ('ogerpon-box', 'Ogerpon Box', '[{"nombre":"Teal Mask Ogerpon ex","set":"TWM","numero":"25"},{"nombre":"Mega Kangaskhan ex","set":"MEG","numero":"104"}]'::jsonb, '[{"nombres":["Teal Mask Ogerpon ex"],"set":"TWM","numero":"25"},{"nombres":["Latias ex"],"set":"SSP","numero":"76"}]'::jsonb),
  ('ns-zoroark', 'N''s Zoroark', '[{"nombre":"N''s Zoroark ex","set":"JTG","numero":"98"},{"nombre":"N''s Zekrom","set":"ASC","numero":"155"}]'::jsonb, '[{"nombres":["N''s Zoroark ex"],"set":"JTG","numero":"98"}]'::jsonb)
on conflict (id) do nothing;

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- 8 inscritos, 8 decklists, 12 mesas y 12 resultados.
select
  (select count(*) from public.tournament_registrations where tournament_id = 'debf0000-0000-4000-8000-0000000000aa') as inscritos,
  (select count(*) from public.tournament_decklists where tournament_id = 'debf0000-0000-4000-8000-0000000000aa') as decklists,
  (select count(*) from public.tournament_matches m join public.rounds r on r.id = m.round_id where r.tournament_id = 'debf0000-0000-4000-8000-0000000000aa') as mesas,
  (select count(*) from public.match_results res join public.tournament_matches m on m.id = res.match_id join public.rounds r on r.id = m.round_id where r.tournament_id = 'debf0000-0000-4000-8000-0000000000aa') as resultados;

-- ── Deshacer (cuando la prueba ya no haga falta) ────────────────────
-- delete from public.tournaments where id = 'debf0000-0000-4000-8000-0000000000aa';
-- delete from public.user_profiles where username like 'demo-worlds-%';
-- delete from auth.users where email like 'demo-worlds-%@pokedoc.invalid';
