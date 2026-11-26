-- Tanda 1457 — Torneos que se repiten (propuesta «Torneos, versión final»,
-- PINGU: adelante con lo recomendado).
--
-- Una tienda hace SU torneo cada viernes (o cada dos). Hasta ahora lo
-- duplicaba a mano cada semana; ahora, al crearlo, contesta «¿Se repite?»
-- y, cuando un torneo de la serie TERMINA, la base crea solo el siguiente:
--   · misma configuración (formato, plazas, reloj, sitio, precio, premios…);
--   · a la MISMA HORA DE MADRID 7 o 14 días después (si se termina tarde y esa
--     fecha ya pasó, se salta a la siguiente que venga);
--   · con las inscripciones ya ABIERTAS: el barredor lo anuncia como cualquier
--     torneo que abre (campanita y push), sin código nuevo que mantener;
--   · y él también se repite, hasta que alguien pulse «Dejar de repetir» (que
--     es poner `repite` a null en el que viene; la RLS de siempre deja hacerlo
--     a quien lo organiza).
--
-- Solo los torneos de un día: una liga ya tiene sus jornadas.
-- Solo al TERMINAR, no al cancelar: si cancelas uno, la serie se para (y si
-- era por un festivo, «Duplicar» lo arregla en un minuto). Así cancelar nunca
-- crea un torneo que nadie esperaba.
--
-- Se puede ejecutar dos veces. Sin tablas temporales (tanda 631).

-- ── Las columnas ────────────────────────────────────────────────────────────
alter table public.tournaments add column if not exists repite text;
-- La serie: el id del PRIMER torneo. Todos los que salen de él lo llevan.
alter table public.tournaments add column if not exists serie_id uuid;

do $$ begin
  alter table public.tournaments add constraint tournaments_repite_ok
    check (repite is null or (repite in ('semanal', 'quincenal') and format = 'standard'));
exception when duplicate_object then null;
end $$;

create index if not exists tournaments_serie on public.tournaments (serie_id) where serie_id is not null;

-- ── La fecha del siguiente ─────────────────────────────────────────────────
--
-- En hora de Madrid y no en UTC: «cada viernes a las 18:00» sigue siendo a
-- las 18:00 cuando cambia la hora en marzo y en octubre (sumar 7 días en UTC
-- lo movería a las 17:00 o a las 19:00).
create or replace function public.torneos_fecha_siguiente(p_inicio timestamptz, p_repite text, p_ahora timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_paso interval := case p_repite when 'semanal' then interval '7 days' when 'quincenal' then interval '14 days' end;
  v_local timestamp := p_inicio at time zone 'Europe/Madrid';
  v_vueltas int := 0;
begin
  if v_paso is null then return null; end if;
  loop
    v_local := v_local + v_paso;
    v_vueltas := v_vueltas + 1;
    -- Al menos una hora por delante, para que dé tiempo a apuntarse.
    exit when (v_local at time zone 'Europe/Madrid') > p_ahora + interval '1 hour' or v_vueltas > 60;
  end loop;
  return v_local at time zone 'Europe/Madrid';
end $$;

-- ── Crear el siguiente ─────────────────────────────────────────────────────
--
-- Devuelve el id del siguiente (el nuevo, o el que ya había: llamarla dos
-- veces no crea dos). No la llama la web: la dispara el paso a «finished».
create or replace function public.torneos_crear_siguiente(p_torneo uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  t tournaments%rowtype;
  v_serie uuid;
  v_inicio timestamptz;
  v_id uuid;
  v_slug text;
begin
  select * into t from tournaments where id = p_torneo;
  if not found or t.repite is null or t.format <> 'standard' then return null; end if;

  v_serie := coalesce(t.serie_id, t.id);
  if t.serie_id is null then
    update tournaments set serie_id = v_serie where id = t.id;
  end if;

  -- Ya hay uno por delante en la serie (no cancelado): ese es el siguiente.
  select x.id into v_id from tournaments x
   where (x.serie_id = v_serie or x.id = v_serie) and x.id <> t.id
     and x.start_at > t.start_at and x.status <> 'cancelled'
   order by x.start_at limit 1;
  if v_id is not null then return v_id; end if;

  v_inicio := torneos_fecha_siguiente(t.start_at, t.repite);
  -- El slug de siempre (nombre + sufijo): el sufijo viejo fuera, uno nuevo.
  v_slug := left(regexp_replace(t.slug, '-[a-z0-9]{4,12}$', ''), 80) || '-' || substr(md5(gen_random_uuid()::text), 1, 8);

  insert into tournaments (
    slug, admin_id, name, description, start_at, status,
    max_players, swiss_rounds, round_time_minutes, checkin_minutes,
    swiss_bo, top_cut_bo, top_cut_size, pairing_seed, format,
    show_opponent_decklists, image_url, decklist_visibility, banner_url,
    is_official, is_private, prizes, rounds_per_matchday, precio_entrada,
    modalidad, lugar, direccion, inscripcion, repite, serie_id
  ) values (
    v_slug, t.admin_id, t.name, t.description, v_inicio, 'registration_open',
    t.max_players, t.swiss_rounds, t.round_time_minutes, t.checkin_minutes,
    t.swiss_bo, t.top_cut_bo, t.top_cut_size,
    -- Semilla nueva: el sorteo de la ronda 1 no se repite aunque el torneo sí.
    md5(gen_random_uuid()::text), t.format,
    t.show_opponent_decklists, t.image_url, t.decklist_visibility, t.banner_url,
    t.is_official, t.is_private, t.prizes, t.rounds_per_matchday, t.precio_entrada,
    t.modalidad, t.lugar, t.direccion, t.inscripcion, t.repite, v_serie
  ) returning id into v_id;

  -- Un torneo con código sigue con el mismo código.
  insert into tournament_join_codes (tournament_id, code)
  select v_id, c.code from tournament_join_codes c where c.tournament_id = t.id
  on conflict do nothing;

  return v_id;
end $$;

revoke all on function public.torneos_crear_siguiente(uuid) from public, anon, authenticated;

-- ── El disparador: al terminar ─────────────────────────────────────────────
create or replace function public.torneos_repetir_al_terminar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Que un fallo aquí NUNCA impida terminar el torneo: lo importante es el
  -- que acaba; el siguiente se puede crear con «Duplicar».
  begin
    perform torneos_crear_siguiente(new.id);
  exception when others then
    raise warning 'torneos_repetir_al_terminar(%): %', new.id, sqlerrm;
  end;
  return null;
end $$;

revoke all on function public.torneos_repetir_al_terminar() from public, anon, authenticated;

drop trigger if exists trg_torneos_repetir on public.tournaments;
create trigger trg_torneos_repetir
  after update of status on public.tournaments
  for each row
  when (new.status = 'finished' and old.status is distinct from 'finished' and new.repite is not null)
  execute function public.torneos_repetir_al_terminar();
