-- ════════════════════════════════════════════════════════════════════
-- Crear torneos: abierto a todo el mundo, y el sello de OFICIAL
-- (tanda 266)
-- ════════════════════════════════════════════════════════════════════
--
-- Dos cosas que van juntas porque la segunda es la consecuencia de la
-- primera:
--
--   1. CUALQUIERA con cuenta puede crear y llevar su torneo. Hasta hoy
--      `torneos_escribir` pedía ser admin del SITIO, así que a un
--      usuario normal no le salía el botón — y aunque le hubiera
--      salido, el INSERT lo habría rechazado la política EN SILENCIO
--      (no da error: no toca nada y vuelve como si fuera bien).
--
--   2. Con torneos de cualquiera, «oficial» deja de poder deducirse de
--      quién lo creó. Hasta ahora era «lo creó un admin»; ahora es una
--      CASILLA que solo administración puede marcar, porque un admin
--      también quiere poder montarse una pachanga suya que no vaya con
--      el sello de PokeDoc.
--
-- Se ejecuta en el SQL Editor. Requiere tener puesta antes
-- supabase-migration-torneos-publico.sql, de donde salen
-- `torneos_soy_admin()` y las políticas que aquí se sustituyen.

begin;

-- ------------------------------------------------------------
-- 1. La casilla de oficial
-- ------------------------------------------------------------
alter table public.tournaments
  add column if not exists is_official boolean not null default false;

comment on column public.tournaments.is_official is
  'Torneo oficial de PokeDoc. Solo lo marca administración (ver el disparador torneos_solo_admin_marca_oficial). Antes de la tanda 266 esto se deducía de si el creador era admin.';

-- Los que ya existen y los creó un admin se quedan como oficiales, que
-- es lo que la web venía enseñando: sin esto, la Copa Inaugural pasaría
-- a ser «de la comunidad» de un día para otro.
update public.tournaments t
   set is_official = true
  from public.user_profiles p
 where p.id = t.admin_id and p.is_admin;

-- ------------------------------------------------------------
-- 2. Quién puede escribir en un torneo
-- ------------------------------------------------------------
-- «El admin del sitio O el dueño del torneo». Se saca a una función
-- para no repetir la pareja en las cinco tablas del ciclo y para que el
-- día que cambie el criterio haya UN sitio que tocar.
create or replace function public.torneos_es_mio(p_torneo uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.tournaments t
     where t.id = p_torneo and t.admin_id = auth.uid()
  );
$$;

grant execute on function public.torneos_es_mio(uuid) to anon, authenticated;

drop policy if exists torneos_escribir on public.tournaments;
create policy torneos_escribir on public.tournaments for all
  using (torneos_soy_admin() or admin_id = auth.uid())
  with check (torneos_soy_admin() or admin_id = auth.uid());

-- Las tablas del ciclo cuelgan del torneo por caminos distintos, así que
-- cada una necesita su forma de llegar hasta él. Se escriben a mano en
-- vez de en el bucle de la migración anterior justamente por eso.
drop policy if exists torneos_escribir on public.rounds;
create policy torneos_escribir on public.rounds for all
  using (torneos_soy_admin() or torneos_es_mio(tournament_id))
  with check (torneos_soy_admin() or torneos_es_mio(tournament_id));

drop policy if exists torneos_escribir on public.tournament_matches;
create policy torneos_escribir on public.tournament_matches for all
  using (torneos_soy_admin() or exists (
    select 1 from public.rounds r where r.id = round_id and torneos_es_mio(r.tournament_id)))
  with check (torneos_soy_admin() or exists (
    select 1 from public.rounds r where r.id = round_id and torneos_es_mio(r.tournament_id)));

drop policy if exists torneos_escribir on public.match_results;
create policy torneos_escribir on public.match_results for all
  using (torneos_soy_admin() or exists (
    select 1 from public.tournament_matches m join public.rounds r on r.id = m.round_id
     where m.id = match_id and torneos_es_mio(r.tournament_id)))
  with check (torneos_soy_admin() or exists (
    select 1 from public.tournament_matches m join public.rounds r on r.id = m.round_id
     where m.id = match_id and torneos_es_mio(r.tournament_id)));

drop policy if exists torneos_escribir on public.pairing_history;
create policy torneos_escribir on public.pairing_history for all
  using (torneos_soy_admin() or torneos_es_mio(tournament_id))
  with check (torneos_soy_admin() or torneos_es_mio(tournament_id));

-- Y las inscripciones: el organizador de su torneo tiene que poder
-- expulsar y dar de baja igual que un admin del sitio.
drop policy if exists inscripciones_admin on public.tournament_registrations;
create policy inscripciones_admin on public.tournament_registrations for delete
  using (torneos_soy_admin() or torneos_es_mio(tournament_id));

-- ------------------------------------------------------------
-- 3. Marcar «oficial» es cosa de administración
-- ------------------------------------------------------------
-- El mismo patrón que `solo_admin_da_titulos` con is_moderator: si
-- quien escribe no es admin del sitio, el valor se revierte al que
-- había. Sin esto, cualquiera podría ponerle el sello de PokeDoc a su
-- torneo con una llamada a la API — el formulario no enseña la casilla,
-- pero eso no protege nada.
--
-- `auth.uid() is not null` importa: sin él, esto revertiría también lo
-- que se escribe desde el SQL Editor o con la clave de servicio, y
-- marcar un torneo a mano no funcionaría (y encima sin dar error).
create or replace function public.torneos_solo_admin_marca_oficial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is not null and not public.torneos_soy_admin() then
    new.is_official := coalesce(old.is_official, false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_torneos_solo_admin_marca_oficial on public.tournaments;
create trigger trg_torneos_solo_admin_marca_oficial
  before insert or update on public.tournaments
  for each row execute function public.torneos_solo_admin_marca_oficial();

commit;

-- PostgREST guarda en memoria el esquema que conoce: sin este aviso, la
-- columna nueva NO existe para la API y el cliente recibe «Could not
-- find the 'is_official' column of 'tournaments' in the schema cache».
notify pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────
-- Comprobación rápida (opcional)
-- ────────────────────────────────────────────────────────────────────
-- select name, is_official, admin_id from public.tournaments order by created_at desc limit 10;
-- select policyname, cmd, qual from pg_policies
--  where tablename in ('tournaments','rounds','tournament_matches','match_results')
--    and policyname = 'torneos_escribir';
