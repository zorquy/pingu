-- Tanda 1361 — Nadie podía crear una cuenta nueva (URGENTE).
--
-- Al crear una cuenta (con Google o con email), Supabase inserta en
-- auth.users y el disparador `on_auth_user_created` llama a
-- `public.handle_new_user()`, que crea la fila de `user_profiles`. Ese
-- disparador se hizo a mano en el panel hace mucho y nunca estuvo en el repo,
-- y seguía escribiendo `saved_guides`... que la 1306 (2026-11-13) se llevó a
-- `user_privado` y BORRÓ de `user_profiles`. Desde que se ejecutó la 1306,
-- cada alta fallaba con «Database error saving new user» y la persona volvía
-- a Inicio sin cuenta (la 1360 lo hizo visible y lo apuntó en /admin).
--
-- Lo nuevo:
--   · solo `id` y el color: lo demás tiene su `default` en la tabla (XP 0,
--     «Novato», logros vacíos…), así que un cambio de columnas no lo rompe;
--   · `search_path` fijo, como el resto de funciones `security definer`;
--   · si aun así el perfil fallara, la cuenta se crea igual (aviso en el
--     registro de Postgres): la web lo crea en la bienvenida (onboarding.js
--     hace `upsert`), y una cuenta sin perfil se arregla; una alta que no
--     entra, no.
-- La fila de `user_privado` la pone el disparador `trg_privado_al_nacer` de
-- `user_profiles` (1306), como hasta ahora.
--
-- Re-ejecutable. Una sola sentencia (tanda 631).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  begin
    insert into public.user_profiles (id, avatar_color)
    values (new.id, '#1e5175')
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user (%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
