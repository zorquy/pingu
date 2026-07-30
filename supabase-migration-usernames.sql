-- Usernames únicos y "slugificados" para poder enlazar perfiles con
-- URLs legibles (usuario.html?u=ash-ketchum en vez de ?id=<uuid>).
-- Ejecutar en el SQL Editor de Supabase.

-- 1) Normaliza y rellena el username de TODOS los perfiles existentes,
--    generándolo a partir del username actual (si lo hay) o del
--    display_name, y desambiguando con un sufijo -2, -3... si hace falta.
--    Se hace fila a fila para poder comprobar colisiones contra lo que
--    ya se ha ido asignando en el propio bucle.
do $$
declare
  r record;
  base_slug text;
  candidate text;
  suffix int;
begin
  for r in select id, username, display_name from public.user_profiles order by id loop
    base_slug := lower(regexp_replace(coalesce(nullif(trim(r.username), ''), nullif(trim(r.display_name), ''), 'user'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then
      base_slug := 'user';
    end if;

    candidate := base_slug;
    suffix := 1;
    while exists (
      select 1 from public.user_profiles
      where id <> r.id and lower(username) = lower(candidate)
    ) loop
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix;
    end loop;

    update public.user_profiles set username = candidate where id = r.id;
  end loop;
end $$;

-- 2) A partir de ahora, el username tiene que ser único (sin distinguir
--    mayúsculas/minúsculas).
create unique index if not exists user_profiles_username_unique_idx
  on public.user_profiles (lower(username));
