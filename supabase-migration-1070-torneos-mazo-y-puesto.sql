-- Tanda 1070 — los torneos apuntados con tu mazo guardado y tu puesto, y tu
-- mazo predeterminado.
--
-- Ibai: «al guardar tus partidas/torneos jugados, que puedas seleccionar algún
-- mazo de tu constructor en vez de añadir a mano tu mazo (esto podría sumar
-- para las estadísticas)», «al añadir tus torneos jugados, un input opcional
-- que sea la posición en el torneo» y «que puedas ponerte un mazo
-- predeterminado para tus torneos, para que cuando los añadas no lo tengas que
-- seleccionar».
--
-- Tres cosas:
--   1. `match_log_torneos.user_deck_id`: el mazo guardado del constructor con
--      el que jugaste el torneo. Como el arquetipo (`mi_mazo`), se copia a
--      cada ronda (`match_log.user_deck_id`, la columna de la 627) y lo
--      arrastra el disparador de la 251 al cambiarlo: así las rondas de un
--      torneo cuentan en «Con cada mazo guardado» y en el récord de /mazos.
--   2. `match_log_torneos.puesto` y `jugadores`, los dos opcionales: «3.º de
--      24». Solo se guardan; nada se calcula con ellos.
--   3. `match_log_ajustes`: tu mazo PREDETERMINADO (uno guardado, un
--      arquetipo escrito a mano, o los dos). Una tabla aparte y PRIVADA, como
--      `user_play_pokemon` (834): a qué juegas es justo lo que no se enseña
--      antes de un torneo (lo dice match_log desde la 230), y `user_profiles`
--      lo lee cualquiera.
--
-- Necesita la 627 (supabase-migration-partidas-mazo-guardado.sql): la
-- columna de las rondas es la suya. La función que exige que el mazo sea
-- TUYO se vuelve a escribir aquí igual que allí, para poder colgarla de las
-- dos tablas nuevas aunque se ejecute en otro orden.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631): el SQL
-- Editor puede mandarlas por separado.

-- ── 0. La de la 627, por si acaso (misma columna, misma función) ──
alter table public.match_log
  add column if not exists user_deck_id uuid references public.user_decks (id) on delete set null;

-- Solo un mazo TUYO. La clave ajena comprueba que el mazo EXISTE, no de quién
-- es (no pasa por la RLS), y un mazo público de otro se puede leer. Vale para
-- las tres tablas porque las tres llaman igual a sus columnas.
create or replace function public.match_log_mazo_propio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_deck_id is not null and not exists (
    select 1 from public.user_decks d where d.id = new.user_deck_id and d.user_id = new.user_id
  ) then
    raise exception 'Ese mazo no es tuyo.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists match_log_mazo_propio on public.match_log;
create trigger match_log_mazo_propio
  before insert or update of user_deck_id, user_id on public.match_log
  for each row execute function public.match_log_mazo_propio();

-- ── 1. El mazo guardado del torneo ──
alter table public.match_log_torneos
  add column if not exists user_deck_id uuid references public.user_decks (id) on delete set null;

-- Borrar un mazo suelta sus torneos: sin índice, cada borrado recorre la tabla.
create index if not exists log_torneos_por_mazo
  on public.match_log_torneos (user_deck_id)
  where user_deck_id is not null;

drop trigger if exists match_log_torneos_mazo_propio on public.match_log_torneos;
create trigger match_log_torneos_mazo_propio
  before insert or update of user_deck_id, user_id on public.match_log_torneos
  for each row execute function public.match_log_mazo_propio();

-- ── 2. El puesto, opcional ──
alter table public.match_log_torneos add column if not exists puesto integer;
alter table public.match_log_torneos add column if not exists jugadores integer;

alter table public.match_log_torneos drop constraint if exists match_log_torneos_puesto_ok;
alter table public.match_log_torneos add constraint match_log_torneos_puesto_ok
  check (puesto is null or puesto between 1 and 9999);

alter table public.match_log_torneos drop constraint if exists match_log_torneos_jugadores_ok;
alter table public.match_log_torneos add constraint match_log_torneos_jugadores_ok
  check (jugadores is null or jugadores between 2 and 99999);

-- «5.º de 4» no existe.
alter table public.match_log_torneos drop constraint if exists match_log_torneos_puesto_cabe;
alter table public.match_log_torneos add constraint match_log_torneos_puesto_cabe
  check (puesto is null or jugadores is null or puesto <= jugadores);

-- ── 3. Cambiar el mazo del torneo arrastra también el GUARDADO a sus rondas ──
--
-- La misma función de la 251 con una columna más: el mazo guardado va copiado
-- en cada ronda igual que el arquetipo, y por el mismo motivo (la ronda es una
-- fila de `match_log` que la matriz y /mazos leen sin mirar su torneo). Un
-- disparador no se olvida: las dos escrituras pasan juntas o no pasa ninguna.
create or replace function public.match_log_torneo_arrastra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- `is distinct from` y no `<>`: estas columnas admiten NULL (251).
  if new.mi_mazo is distinct from old.mi_mazo
     or new.mi_mazo_nombre is distinct from old.mi_mazo_nombre
     or new.user_deck_id is distinct from old.user_deck_id
     or new.nombre is distinct from old.nombre
     or new.jugado_el is distinct from old.jugado_el then
    update match_log
       set mi_mazo = new.mi_mazo,
           mi_mazo_nombre = new.mi_mazo_nombre,
           user_deck_id = new.user_deck_id,
           donde = new.nombre,
           jugada_el = new.jugado_el
     where torneo_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists match_log_torneo_arrastra on public.match_log_torneos;
create trigger match_log_torneo_arrastra
  after update on public.match_log_torneos
  for each row execute function public.match_log_torneo_arrastra();

-- ── 4. Tu mazo predeterminado, privado ──
create table if not exists public.match_log_ajustes (
  user_id uuid primary key default auth.uid() references public.user_profiles (id) on delete cascade,
  -- El mazo guardado. Si se borra, se queda el arquetipo de abajo: sigue
  -- siendo lo que juegas.
  user_deck_id uuid references public.user_decks (id) on delete set null,
  -- El arquetipo, con la clave de `match_log.mi_mazo` (claveDeArquetipo) y el
  -- nombre que se enseña. Van juntos o no va ninguno.
  mi_mazo text check (mi_mazo is null or char_length(mi_mazo) between 1 and 200),
  mi_mazo_nombre text check (mi_mazo_nombre is null or char_length(mi_mazo_nombre) between 1 and 200),
  updated_at timestamptz not null default now(),
  constraint match_log_ajustes_mazo_entero check ((mi_mazo is null) = (mi_mazo_nombre is null))
);

alter table public.match_log_ajustes enable row level security;

-- Solo la fila propia, en las cuatro operaciones; sin cuenta no hay fila.
drop policy if exists ajustes_partidas_ver on public.match_log_ajustes;
create policy ajustes_partidas_ver on public.match_log_ajustes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists ajustes_partidas_crear on public.match_log_ajustes;
create policy ajustes_partidas_crear on public.match_log_ajustes for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists ajustes_partidas_cambiar on public.match_log_ajustes;
create policy ajustes_partidas_cambiar on public.match_log_ajustes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ajustes_partidas_borrar on public.match_log_ajustes;
create policy ajustes_partidas_borrar on public.match_log_ajustes for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists match_log_ajustes_mazo_propio on public.match_log_ajustes;
create trigger match_log_ajustes_mazo_propio
  before insert or update of user_deck_id, user_id on public.match_log_ajustes
  for each row execute function public.match_log_mazo_propio();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.match_log_ajustes to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.match_log_ajustes from anon;
  end if;
end $$;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tienen que salir las tres columnas del torneo y la tabla de ajustes vacía
-- (o con lo que ya hubiera), sin error.
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'match_log_torneos'
   and column_name in ('user_deck_id', 'puesto', 'jugadores');
select count(*) as ajustes from public.match_log_ajustes;

-- PostgREST guarda en memoria el esquema que conoce: sin este aviso las
-- columnas no existen para la API hasta que Supabase recarga (tanda 250).
notify pgrst, 'reload schema';
