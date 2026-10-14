-- Tanda 834 — los datos de Play! Pokémon de cada uno, PRIVADOS.
--
-- Ibai: «imprimir decklist […] pokemon id (que estaría bien un campo en el
-- perfil para añadirlo y que esto se haga automáticamente)». La decklist
-- oficial pide nombre y apellidos, Player ID y fecha de nacimiento. Se
-- guardan aquí para rellenarla sola desde el constructor.
--
-- Va en una tabla APARTE y no en `user_profiles` a propósito: los perfiles
-- los lee cualquiera (supabase-migration-social.sql) y estos tres datos no
-- los tiene que ver nadie más que su dueño — ni el resto de la comunidad,
-- ni quien lleva un torneo. Por eso la RLS solo deja tocar la fila propia,
-- en las cuatro operaciones.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.user_play_pokemon (
  user_id uuid primary key default auth.uid() references public.user_profiles(id) on delete cascade,
  -- El Player ID de Play! Pokémon: cifras, sin espacios ni guiones.
  player_id text check (player_id is null or player_id ~ '^[0-9]{1,10}$'),
  -- Nombre y apellidos tal como van en la decklist (no el nombre visible).
  player_name text check (player_name is null or char_length(player_name) between 1 and 80),
  -- La fecha de nacimiento de la decklist (MM/DD/AAAA). La de
  -- `user_profiles.birthday` es OTRA cosa: la pone quien quiere que el foro
  -- le felicite, y es pública.
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  updated_at timestamptz not null default now()
);

alter table public.user_play_pokemon enable row level security;

-- Solo la fila propia. `to authenticated`: sin cuenta no hay fila que ver.
drop policy if exists play_pokemon_ver on public.user_play_pokemon;
create policy play_pokemon_ver on public.user_play_pokemon for select to authenticated
  using (user_id = auth.uid());
drop policy if exists play_pokemon_crear on public.user_play_pokemon;
create policy play_pokemon_crear on public.user_play_pokemon for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists play_pokemon_cambiar on public.user_play_pokemon;
create policy play_pokemon_cambiar on public.user_play_pokemon for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists play_pokemon_borrar on public.user_play_pokemon;
create policy play_pokemon_borrar on public.user_play_pokemon for delete to authenticated
  using (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on public.user_play_pokemon to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.user_play_pokemon from anon;
  end if;
end $$;

notify pgrst, 'reload schema';
