-- ════════════════════════════════════════════════════════════════════
-- Liga de Friki de Nacimiento: volcar la jornada 1 (9 de octubre de 2026).
--
-- PINGU: «los resultados de la jornada 1, que se jugó un poco rara y fuera
-- de PokeDoc, están apuntados en un Excel... no hagas caso a la posición,
-- lo importante es las victorias y derrotas». En PokeDoc la jornada 1 se
-- SALTÓ (tanda 833): sus tres rondas existen cerradas y sin mesas, así que
-- nadie suma puntos por ella. Esto mete las mesas de verdad en las rondas
-- 1 y 2 (se jugaron dos; la tercera no, y se queda saltada), con el
-- resultado de cada una, y la clasificación se recalcula sola.
--
-- De dónde sale cada mesa: de las dos capturas de los pareos (ronda 1 y
-- ronda 2), comprobadas contra la pestaña «Rondas» del Excel jugador a
-- jugador: cuadran las 17 mesas. Las dos incomparecencias van como
-- incomparecencia (cuentan igual que una victoria y una derrota).
--
-- Los mazos: la web enseña la lista que cada uno tiene en la liga. Si
-- alguien mandó lista para la jornada 1 y todavía no tiene lista de liga,
-- esa pasa a ser la suya (es lo que hace «publicar las listas» al
-- emparejar). Las demás se quedan como están.
--
-- Es UNA sentencia (un bloque `do`), que en el SQL Editor cada sentencia
-- va por su lado (la 631). Antes de escribir nada comprueba que la liga es
-- una sola, que los 19 están en la base y en la liga, y que las rondas 1 y
-- 2 están vacías; si algo no cuadra, se para y dice qué, sin tocar nada.
-- Ejecutar UNA vez: la segunda se para porque las rondas ya tienen mesas.
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  -- Si la liga no se encuentra sola por el nombre, pon aquí su slug.
  v_slug text := null;
  -- Quien no esté inscrito en la liga se inscribe (con su TCG Live del
  -- Excel) para que su mesa cuente; false = pararse y avisar.
  v_inscribir_faltantes boolean := true;

  v_torneo uuid;
  v_nombre text;
  v_ronda1 uuid;
  v_ronda2 uuid;
  v_inicio timestamptz := '2026-10-09 19:00:00+02';
  v_fin timestamptz := '2026-10-09 21:00:00+02';
  v_faltan text;
  v_mesa record;
  v_a uuid;
  v_b uuid;
  v_match uuid;
  v_low uuid;
  v_high uuid;
  v_ganador uuid;
  v_estado text;
  v_n int := 0;
  v_listas int := 0;
begin
  -- 1. La liga ───────────────────────────────────────────────────────
  if v_slug is not null then
    select id, name into v_torneo, v_nombre from public.tournaments where slug = v_slug;
  else
    select id, name into v_torneo, v_nombre
      from public.tournaments
     where format = 'league'
       and status in ('in_progress', 'registration_open', 'registration_closed')
       and (name ilike '%fdn%' or name ilike '%friki%');
    if not found then
      raise exception 'No encuentro la liga por el nombre. Pon su slug en v_slug.';
    end if;
    if (select count(*) from public.tournaments where format = 'league' and status in ('in_progress', 'registration_open', 'registration_closed') and (name ilike '%fdn%' or name ilike '%friki%')) > 1 then
      raise exception 'Hay más de una liga que casa con el nombre. Pon su slug en v_slug.';
    end if;
  end if;
  if v_torneo is null then
    raise exception 'No encuentro la liga.';
  end if;
  raise notice 'Liga: % (%)', v_nombre, v_torneo;

  -- 2. Las rondas 1 y 2 de la jornada 1, vacías ──────────────────────
  select id into v_ronda1 from public.rounds where tournament_id = v_torneo and round_number = 1 and phase = 'swiss';
  select id into v_ronda2 from public.rounds where tournament_id = v_torneo and round_number = 2 and phase = 'swiss';
  if v_ronda1 is null or v_ronda2 is null then
    raise exception 'La liga no tiene las rondas 1 y 2 (¿se saltó la jornada 1 desde la ficha?).';
  end if;
  if exists (select 1 from public.tournament_matches where round_id in (v_ronda1, v_ronda2)) then
    raise exception 'Las rondas 1 y 2 ya tienen mesas: esto ya se ejecutó, o la jornada se jugó en PokeDoc. No se toca nada.';
  end if;

  -- 3. Los 19, en la base (por su nombre de usuario de PokeDoc) ──────
  create temp table j1_gente (username text primary key, tcg_live text) on commit drop;
  insert into j1_gente values
    ('daniel-orellana', 'daniorellana'), ('gorka-rubio', 'gorkarubio77055'), ('srpaquito', 'sr_Paquito'),
    ('adriikoala', 'happykoal233213'), ('aristu', 'aristu'), ('enege', 'dratini4608'), ('jsensoker', 'mGolem76'),
    ('laiafdn', 'gonvi12'), ('maripau', 'maripau235'), ('misstopillo', 'misstopillo'), ('pepopepo5', 'pepopepo5'),
    ('soyfedeegb', 'soyfedeegb'), ('trollkoal', 'trollkoal'), ('signacioc', 'steelbrods'),
    ('carloscampillofernandez', 'campillo96'), ('jesus-bless', 'blessedCards'), ('mikymazinguer', 'mikymazinguer'),
    ('thormigas-2', 'cazabichosBaron');
  select string_agg(g.username, ', ') into v_faltan
    from j1_gente g
   where not exists (select 1 from public.user_profiles p where lower(p.username) = lower(g.username));
  if v_faltan is not null then
    raise exception 'No existen en PokeDoc estos usuarios (¿se escriben distinto?): %', v_faltan;
  end if;

  -- …y en la liga. Quien falte se inscribe (o se para, según la bandera).
  select string_agg(g.username, ', ') into v_faltan
    from j1_gente g
    join public.user_profiles p on lower(p.username) = lower(g.username)
   where not exists (select 1 from public.tournament_registrations r where r.tournament_id = v_torneo and r.user_id = p.id);
  if v_faltan is not null then
    if not v_inscribir_faltantes then
      raise exception 'No están inscritos en la liga: %. Inscríbelos o pon v_inscribir_faltantes a true.', v_faltan;
    end if;
    insert into public.tournament_registrations (tournament_id, user_id, status, tcg_live_username, participation_confirmed_at)
    select v_torneo, p.id, 'active', g.tcg_live, v_inicio
      from j1_gente g
      join public.user_profiles p on lower(p.username) = lower(g.username)
     where not exists (select 1 from public.tournament_registrations r where r.tournament_id = v_torneo and r.user_id = p.id);
    raise notice 'Inscritos en la liga para que cuente su mesa: %', v_faltan;
  end if;

  -- 4. Las mesas (ronda, mesa, jugador A, jugador B, quién gana) ──────
  --    resultado: 'a' | 'b' | 'empate' | 'forfeit_a' (no vino A, gana B) | 'forfeit_b' (no vino B, gana A)
  create temp table j1_mesas (ronda int, mesa int, a text, b text, resultado text) on commit drop;
  insert into j1_mesas values
    -- Ronda 1 (captura 095250)
    (1, 1, 'jsensoker', 'daniel-orellana', 'b'),
    (1, 2, 'adriikoala', 'signacioc', 'empate'),
    (1, 3, 'pepopepo5', 'srpaquito', 'b'),
    (1, 4, 'thormigas-2', 'gorka-rubio', 'b'),
    (1, 5, 'enege', 'laiafdn', 'a'),
    (1, 6, 'soyfedeegb', 'aristu', 'b'),
    (1, 7, 'maripau', 'trollkoal', 'a'),
    (1, 8, 'jesus-bless', 'misstopillo', 'b'),
    -- Ronda 2 (captura 095303)
    (2, 1, 'misstopillo', 'daniel-orellana', 'b'),
    (2, 2, 'jsensoker', 'mikymazinguer', 'forfeit_b'),
    (2, 3, 'adriikoala', 'aristu', 'a'),
    (2, 4, 'signacioc', 'pepopepo5', 'b'),
    (2, 5, 'thormigas-2', 'gorka-rubio', 'b'),
    (2, 6, 'enege', 'soyfedeegb', 'b'),
    (2, 7, 'maripau', 'srpaquito', 'b'),
    (2, 8, 'jesus-bless', 'trollkoal', 'b'),
    (2, 9, 'carloscampillofernandez', 'laiafdn', 'forfeit_a');

  -- 5. Las rondas pasan a jugadas (con hora: una ronda cerrada sin
  --    `started_at` es «saltada» para la web). La 3 se queda saltada.
  update public.rounds set status = 'finished', started_at = v_inicio, ends_at = v_inicio + interval '30 minutes', closed_at = v_inicio + interval '45 minutes'
   where id = v_ronda1;
  update public.rounds set status = 'finished', started_at = v_inicio + interval '50 minutes', ends_at = v_inicio + interval '80 minutes', closed_at = v_fin
   where id = v_ronda2;

  -- 6. Mesa a mesa: la partida, su resultado y el histórico de cruces.
  for v_mesa in select * from j1_mesas order by ronda, mesa loop
    select p.id into v_a from public.user_profiles p where lower(p.username) = lower(v_mesa.a);
    select p.id into v_b from public.user_profiles p where lower(p.username) = lower(v_mesa.b);
    v_estado := case when v_mesa.resultado like 'forfeit%' then v_mesa.resultado else 'finished' end;
    v_ganador := case v_mesa.resultado when 'a' then v_a when 'b' then v_b when 'forfeit_a' then v_b when 'forfeit_b' then v_a else null end;
    insert into public.tournament_matches (round_id, table_number, player_a_id, player_b_id, status, is_bye, check_in_a_at, check_in_b_at, finished_at)
    values (case v_mesa.ronda when 1 then v_ronda1 else v_ronda2 end, v_mesa.mesa, v_a, v_b, v_estado, false,
            case when v_mesa.resultado = 'forfeit_a' then null else v_inicio end,
            case when v_mesa.resultado = 'forfeit_b' then null else v_inicio end,
            case v_mesa.ronda when 1 then v_inicio + interval '40 minutes' else v_fin - interval '5 minutes' end)
    returning id into v_match;
    insert into public.match_results (match_id, result, winner_id, resolved_by, resolved_at)
    values (v_match,
            case v_mesa.resultado when 'a' then 'a_wins' when 'b' then 'b_wins' when 'empate' then 'draw' else v_mesa.resultado end,
            v_ganador, null, case v_mesa.ronda when 1 then v_inicio + interval '40 minutes' else v_fin - interval '5 minutes' end);
    if v_a < v_b then v_low := v_a; v_high := v_b; else v_low := v_b; v_high := v_a; end if;
    insert into public.pairing_history (tournament_id, player_low_id, player_high_id, round_id)
    values (v_torneo, v_low, v_high, case v_mesa.ronda when 1 then v_ronda1 else v_ronda2 end)
    on conflict (tournament_id, player_low_id, player_high_id) do nothing;
    v_n := v_n + 1;
  end loop;

  -- 7. Las listas de la jornada 1, para quien no tenga lista de liga.
  if to_regclass('public.tournament_matchday_decklists') is not null then
    insert into public.tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, submitted_at, locked_at)
    select d.tournament_id, d.user_id, d.raw_text, d.parsed_cards, d.submitted_at, v_inicio
      from public.tournament_matchday_decklists d
     where d.tournament_id = v_torneo and d.matchday = 1
    on conflict (tournament_id, user_id) do nothing;
    get diagnostics v_listas = row_count;
  end if;

  raise notice 'Hecho: % mesas en las rondas 1 y 2; % listas de la jornada 1 pasadas a lista de liga.', v_n, v_listas;
end $$;

-- Comprobación: 17 mesas (8 + 9), todas con resultado, en la jornada 1.
select r.round_number as ronda, count(m.id) as mesas, count(x.id) as con_resultado
  from public.rounds r
  left join public.tournament_matches m on m.round_id = r.id
  left join public.match_results x on x.match_id = m.id
 where r.tournament_id = (select id from public.tournaments where format = 'league' and (name ilike '%fdn%' or name ilike '%friki%') and status in ('in_progress', 'registration_open', 'registration_closed') limit 1)
   and r.round_number <= 3
 group by r.round_number order by r.round_number;
