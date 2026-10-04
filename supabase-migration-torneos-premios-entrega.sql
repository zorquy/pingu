-- ════════════════════════════════════════════════════════════════════
-- Tanda 516 — quién se lleva cada premio, y si ya se le dio
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU, de la lista de ideas: «que el organizador apunte qué se lleva
-- cada puesto (saldo en tienda, sobres…) y que salga en la ficha y en la
-- clasificación final; la web no cobra nada».
--
-- Qué se lleva cada puesto ya se apuntaba desde la tanda 352
-- (`tournaments.prizes`). Lo nuevo es cruzarlo con la clasificación FINAL
-- —eso lo hace la web, sin tocar la base— y, aquí, apuntar que un premio
-- YA SE HA DADO. Es lo que pregunta el que lo ganó («¿y lo mío?») y lo que
-- se le olvida a quien organiza un torneo de 30 personas: una marca por
-- jugador, con su fecha.
--
-- ── Por qué una tabla aparte y no una columna en las inscripciones ──
--
-- Porque `tournament_registrations` se lee sin cuenta con un grant POR
-- COLUMNAS (supabase-migration-torneos-publico.sql), y en Postgres un
-- select que toca una columna sin grant FALLA ENTERO: una columna nueva en
-- esa tabla, mientras esta migración no esté puesta, dejaría la ficha de
-- todos los torneos sin cargar para quien no ha entrado. Una tabla aparte
-- que no existe solo deja sin la marca de «entregado».
--
-- ── Quién ──
--
-- La ve quien puede ver el torneo (la política mira `tournaments` con la
-- RLS de quien pregunta: un torneo privado sigue siéndolo). La escribe
-- SOLO quien lleva el torneo (`torneos_mando`), y solo por la función: un
-- jugador no se marca su propio premio como dado, y un insert que la
-- política rechaza no da error — vuelve como si hubiera ido bien.
--
-- PokeDoc no cobra ni paga nada: esto es una libreta de quien organiza.
--
-- Se ejecuta en el SQL Editor de Supabase. Se puede repetir entera.

begin;

create table if not exists public.tournament_prize_deliveries (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null,
  delivered_at timestamptz not null default now(),
  delivered_by uuid,
  primary key (tournament_id, user_id)
);

alter table public.tournament_prize_deliveries enable row level security;

drop policy if exists premios_entrega_leer on public.tournament_prize_deliveries;
create policy premios_entrega_leer on public.tournament_prize_deliveries for select
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));

-- Nadie escribe a mano: ni insert, ni update, ni delete en el grant.
revoke all on public.tournament_prize_deliveries from anon, authenticated;
grant select on public.tournament_prize_deliveries to anon, authenticated;

-- Marcar (o desmarcar) que a alguien se le ha dado su premio. Solo quien
-- lleva el torneo, solo con el torneo terminado (antes no hay ganadores)
-- y solo a alguien que estaba inscrito en él.
create or replace function public.torneos_premio_entregado(p_torneo uuid, p_usuario uuid, p_entregado boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not public.torneos_mando(p_torneo) then
    raise exception 'Solo quien lleva el torneo apunta los premios dados.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournaments t where t.id = p_torneo and t.status = 'finished') then
    raise exception 'Los premios se dan con el torneo terminado.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.tournament_registrations r where r.tournament_id = p_torneo and r.user_id = p_usuario) then
    raise exception 'Esa persona no jugó este torneo.' using errcode = 'P0001';
  end if;
  if p_entregado then
    insert into public.tournament_prize_deliveries (tournament_id, user_id, delivered_by)
    values (p_torneo, p_usuario, auth.uid())
    on conflict (tournament_id, user_id) do nothing;
  else
    delete from public.tournament_prize_deliveries where tournament_id = p_torneo and user_id = p_usuario;
  end if;
  return p_entregado;
end;
$$;

revoke all on function public.torneos_premio_entregado(uuid, uuid, boolean) from public;
grant execute on function public.torneos_premio_entregado(uuid, uuid, boolean) to authenticated;

comment on table public.tournament_prize_deliveries is
  'Tanda 516: a quién se le ha dado ya su premio de un torneo. La escribe solo quien lleva el torneo, por torneos_premio_entregado().';

commit;
