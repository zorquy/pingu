-- ═══════════════════════════════════════════════════════════════════
-- TORNEOS (tanda 203): el esquema de TrainerArena portado a Supabase.
--
-- Origen: apps/api/prisma/schema.prisma de TrainerArena (Ibai Manso),
-- adaptado: los usuarios son las cuentas de PokeDoc (uuid de
-- user_profiles), fuera todo lo de pagos (decisión de los admins), y
-- los enums de Prisma pasan a checks de texto.
--
-- MIENTRAS LOS TORNEOS ESTÉN EN PRUEBAS, TODO ES SOLO PARA ADMINS: las
-- políticas de abajo cierran lectura y escritura a user_profiles con
-- is_admin. Cuando se abra al público habrá una migración que afloje
-- lo que toque (lectura pública de torneos/clasificaciones, escritura
-- de cada cual en lo suyo).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- ── Torneos ──
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  admin_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  description text,
  start_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','registration_open','registration_closed','in_progress','finished','cancelled')),
  max_players integer not null check (max_players between 4 and 2048),
  swiss_rounds integer not null check (swiss_rounds between 1 and 12),
  round_time_minutes integer not null default 30 check (round_time_minutes between 5 and 120),
  checkin_minutes integer not null default 5 check (checkin_minutes between 0 and 30),
  swiss_bo integer not null default 1 check (swiss_bo in (1, 3)),
  top_cut_bo integer not null default 3 check (top_cut_bo in (1, 3)),
  top_cut_size integer not null default 0 check (top_cut_size in (0, 4, 8, 16, 32, 64)),
  current_round_id uuid, -- fk al final, cuando exista rounds
  pairing_seed text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Rondas ──
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number smallint not null,
  phase text not null check (phase in ('swiss','top_cut')),
  started_at timestamptz,
  ends_at timestamptz, -- siempre null en top cut
  closed_at timestamptz,
  -- El barredor por minuto avisa por push cuando la ronda arranca y
  -- apunta aquí que ya avisó, para no repetirse.
  players_notified_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active','finished')),
  created_at timestamptz not null default now(),
  unique (tournament_id, round_number)
);
create index if not exists rounds_torneo_estado on public.rounds (tournament_id, status);

-- Re-ejecutable: si el script se corrió a medias, la clave ya existe y
-- un ADD a secas revienta con 42710. Se tira y se vuelve a crear.
alter table public.tournaments
  drop constraint if exists tournaments_current_round_fk;
alter table public.tournaments
  add constraint tournaments_current_round_fk
  foreign key (current_round_id) references public.rounds(id) on delete set null;

-- Para bases donde `rounds` nació con una versión anterior del script:
-- CREATE TABLE IF NOT EXISTS no añade columnas nuevas, esto sí.
alter table public.rounds
  add column if not exists players_notified_at timestamptz;

-- El barredor anuncia por push la apertura de inscripciones UNA vez y
-- lo apunta aquí (tanda 211).
alter table public.tournaments
  add column if not exists registration_notified_at timestamptz;

-- Tanda 217 — el final celebrado: quién ganó, el podio congelado (los
-- cuatro primeros en orden, para el palmarés del perfil sin recalcular
-- nada) y la marca de que el resultado ya se anunció en el foro.
alter table public.tournaments
  add column if not exists champion_id uuid references public.user_profiles (id) on delete set null;
alter table public.tournaments
  add column if not exists podium jsonb;
alter table public.tournaments
  add column if not exists result_announced_at timestamptz;

-- Tanda 216 (parte 1) — la marca del toque de check-in por caducar (un
-- push por ronda; sus hermanas de tournament_matches van tras el CREATE
-- de esa tabla, que en una base fresca aún no existe aquí).
alter table public.rounds
  add column if not exists checkin_warned_at timestamptz;

-- ── Inscripciones ──
-- Sin email ni teléfono (la cuenta de PokeDoc ya identifica) y sin el
-- estado pending_payment: los pagos quedaron fuera del porte.
create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','dropped')),
  tcg_live_username text not null,
  registered_at timestamptz not null default now(),
  dropped_at timestamptz,
  dropped_after_round_id uuid references public.rounds(id) on delete set null,
  unique (tournament_id, user_id)
);
create index if not exists inscripciones_torneo_estado on public.tournament_registrations (tournament_id, status);

-- ── Solicitudes de juez ──
create table if not exists public.judge_applications (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.user_profiles(id) on delete set null,
  unique (tournament_id, user_id)
);

-- ── Decklists ──
create table if not exists public.tournament_decklists (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  raw_text text not null,
  parsed_cards jsonb not null,
  submitted_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (tournament_id, user_id)
);

-- ── Partidas ──
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  table_number smallint not null,
  player_a_id uuid not null references public.user_profiles(id) on delete cascade,
  player_b_id uuid references public.user_profiles(id) on delete cascade, -- null = bye
  status text not null default 'pending'
    check (status in ('pending','active','awaiting_confirmation','disputed','finished','bye','forfeit_a','forfeit_b','forfeit_both')),
  is_bye boolean not null default false,
  check_in_a_at timestamptz,
  check_in_b_at timestamptz,
  finished_at timestamptz,
  bracket_position smallint, -- solo top cut
  created_at timestamptz not null default now(),
  unique (round_id, table_number)
);

-- Tanda 216 (parte 2) — las marcas de «tu rival ya reportó» y «vuestra
-- mesa está resuelta» (un push por mesa cada uno).
alter table public.tournament_matches
  add column if not exists await_notified_at timestamptz;
alter table public.tournament_matches
  add column if not exists resolved_notified_at timestamptz;
create index if not exists partidas_ronda_estado on public.tournament_matches (round_id, status);

-- ── Reportes (lo que dice cada jugador de su partida) ──
create table if not exists public.match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.tournament_matches(id) on delete cascade,
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  result text not null check (result in ('win','loss','draw')), -- relativo a quien reporta
  score text,
  reported_at timestamptz not null default now(),
  unique (match_id, reporter_id)
);

-- ── Resultado final de la partida ──
create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.tournament_matches(id) on delete cascade,
  result text not null
    check (result in ('a_wins','b_wins','draw','bye','forfeit_a','forfeit_b','forfeit_both')),
  winner_id uuid references public.user_profiles(id) on delete set null,
  score text,
  resolved_by uuid references public.user_profiles(id) on delete set null, -- null = automático
  resolved_at timestamptz not null default now()
);

-- ── Histórico de cruces (evita recruces en el pareo) ──
create table if not exists public.pairing_history (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_low_id uuid not null,
  player_high_id uuid not null,
  round_id uuid not null references public.rounds(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tournament_id, player_low_id, player_high_id)
);

-- ── Llamadas a juez y sus chats ──
create table if not exists public.judge_calls (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid not null references public.tournament_matches(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id) on delete cascade,
  assigned_judge_id uuid references public.user_profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists llamadas_torneo_estado on public.judge_calls (tournament_id, status);

create table if not exists public.judge_messages (
  id uuid primary key default gen_random_uuid(),
  judge_call_id uuid not null references public.judge_calls(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  message text not null check (char_length(message) <= 2000),
  sent_at timestamptz not null default now()
);
create index if not exists mensajes_juez_llamada on public.judge_messages (judge_call_id);

-- ── Chat de partida (en la web irá en un desplegable) ──
create table if not exists public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.tournament_matches(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  message text not null check (char_length(message) <= 2000),
  sent_at timestamptz not null default now()
);
create index if not exists mensajes_partida on public.match_messages (match_id);

-- ═══ RLS: TODO solo para admins mientras dure la prueba ═══
do $$
declare t text;
begin
  foreach t in array array[
    'tournaments', 'rounds', 'tournament_registrations', 'judge_applications',
    'tournament_decklists', 'tournament_matches', 'match_reports',
    'match_results', 'pairing_history', 'judge_calls', 'judge_messages',
    'match_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists torneos_solo_admins on public.%I', t);
    execute format($pol$
      create policy torneos_solo_admins on public.%I
        for all
        using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin))
        with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin))
    $pol$, t);
  end loop;
end $$;


-- ── Logros de torneos (tanda 208) ─────────────────────────────────
-- Condición `manual`: no los concede el comprobador automático de
-- gamification.js (no conoce ese tipo), sino la ficha del torneo al
-- verlo terminado habiendo jugado. Idempotentes por el ON CONFLICT.
insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('torneo_jugado', 'Competidor', 'Jugaste un torneo de PokeDoc hasta el final.', 'medal', 'bronze', 30, true, '{"type":"manual"}'::jsonb),
  ('torneo_top_cut', 'En el corte', 'Te metiste en el top cut de un torneo.', 'target', 'silver', 60, true, '{"type":"manual"}'::jsonb),
  ('torneo_campeon', 'Campeón de torneo', 'Ganaste un torneo de PokeDoc.', 'crown', 'gold', 150, true, '{"type":"manual"}'::jsonb)
on conflict (id) do nothing;
