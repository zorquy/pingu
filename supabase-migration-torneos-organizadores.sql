-- Un rol para organizar torneos, y solo torneos (tanda 295).
--
-- PINGU: una comunidad de fuera se ha organizado —hasta con presidente—
-- y quiere llevar los torneos de PokeDoc. Él no tiene tiempo de estar
-- encima, así que les da el mando de la sección «Jugar»… y de nada más.
-- Ni panel de administración, ni foro, ni guías, ni usuarios.
--
-- ── POR QUÉ ESTO SE HACE EN UNA SOLA FUNCIÓN ──
--
-- Todos los permisos de escritura de la sección cuelgan de
-- `torneos_soy_admin()`, y esa función SOLO la usan políticas de
-- torneos: tournaments, rounds, tournament_matches, match_results,
-- pairing_history, inscripciones, decklists, jueces y chats. Ninguna
-- otra parte del sitio la mira.
--
-- O sea que el nombre ya estaba bien puesto: «soy admin PARA TORNEOS».
-- Ampliarla no es un parche — es lo que la función dice que hace. Y
-- hacerlo en un sitio en vez de reescribir cuarenta políticas es lo que
-- evita el fallo de dejarse una.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera.

alter table public.user_profiles
  add column if not exists is_tournament_admin boolean not null default false;

comment on column public.user_profiles.is_tournament_admin is
  'Organiza torneos: manda en la sección Jugar y en nada más. No da acceso al panel de administración.';

-- ── Quién manda en los torneos ──
create or replace function public.torneos_soy_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_tournament_admin, false))
  )
$$;

-- ── Y quién manda en el SITIO ──
--
-- Hace falta separarlo, porque hay una cosa que un organizador no puede
-- hacer: marcar un torneo como OFICIAL de PokeDoc. Esa chapa dice «esto
-- lo organiza el equipo de la casa», y si la pudiera poner cualquiera
-- dejaría de querer decir nada.
--
-- El disparador que la defiende miraba `torneos_soy_admin()`, que a
-- partir de ahora incluye a los organizadores. Pasa a mirar esta.
create or replace function public.torneos_soy_admin_del_sitio()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin)
$$;

create or replace function public.torneos_solo_admin_marca_oficial()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if auth.uid() is not null and not public.torneos_soy_admin_del_sitio() then
    new.is_official := coalesce(old.is_official, false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_torneos_solo_admin_marca_oficial on public.tournaments;
create trigger trg_torneos_solo_admin_marca_oficial
  before insert or update on public.tournaments
  for each row execute function public.torneos_solo_admin_marca_oficial();

-- ── Y que nadie se dé el rol a sí mismo ──
--
-- El disparador que ya había sobre `user_profiles` (tanda de los títulos
-- del foro) devolvía a su sitio `forum_title` e `is_moderator` cuando
-- quien edita no es admin. NO cubría `is_admin`.
--
-- Desde el repositorio no se puede saber si la política de esa tabla
-- deja a alguien editar su propia fila — esas políticas se pusieron a
-- mano en Supabase y no están en ninguna migración. Así que esto se
-- cierra por el lado que sí se controla: si quien edita no es admin del
-- SITIO, las tres columnas de mando vuelven a su valor anterior, pase lo
-- que pase con la política.
create or replace function public.solo_admin_da_titulos()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.forum_title := old.forum_title;
    new.is_moderator := old.is_moderator;
    -- Lo nuevo: el mando no se lo da uno mismo.
    new.is_admin := old.is_admin;
    new.is_tournament_admin := coalesce(old.is_tournament_admin, false);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solo_admin_da_titulos on public.user_profiles;
create trigger trg_solo_admin_da_titulos
  before update on public.user_profiles
  for each row execute function public.solo_admin_da_titulos();

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select username, is_admin, is_tournament_admin
--   from public.user_profiles
--  where is_admin or is_tournament_admin
--  order by is_admin desc, username;
