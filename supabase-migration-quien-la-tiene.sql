-- Tanda 403 — quién de los tuyos tiene esta carta
--
-- PINGU, enseñando Dex: su ficha lleva un bloque «FRIENDS» con los
-- amigos que tienen esa carta. Aquí no hay amigos, hay SEGUIDOS: la
-- gente a la que sigues en PokeDoc.
--
-- ── POR QUÉ UNA FUNCIÓN Y NO UNA CONSULTA ──
--
-- La colección de otra persona no se lee desde fuera: su política solo
-- deja ver la tuya, y abrirla entera para esto sería enseñar a cualquiera
-- lo que tiene todo el mundo. Esta función va con `security definer` y
-- contesta UNA pregunta muy concreta —de esta carta, quién de los que YO
-- sigo la tiene— sin dejar hacer ninguna otra.
--
-- Y además respeta `coleccion_publica`: quien tiene la colección en
-- privado no sale, aunque le sigas. Seguir a alguien no es permiso para
-- mirarle los cajones.

create or replace function public.coleccion_quien_la_tiene(p_card_id text)
-- `is_admin` e `is_moderator` porque este nombre sale CON ENLACE al
-- perfil, y desde la tanda 386 un nombre enlazado lleva el color de su
-- rango. Sin ellos saldrían todos en azul y parecería que no hay ni un
-- admin — sin dar error. Lo vigila `test-tanda-386.mjs`.
returns table (user_id uuid, username text, display_name text, avatar_url text,
               is_admin boolean, is_moderator boolean, copias bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         sum(c.cantidad)
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
   where c.card_id = p_card_id
     and c.user_id <> auth.uid()
     -- Solo a quien sigues: la pregunta es «quién de los MÍOS», no
     -- «quién en toda la web». Lo segundo sería un directorio de
     -- colecciones ajenas.
     and exists (
       select 1 from public.user_follows f
        where f.follower_id = auth.uid() and f.following_id = c.user_id
     )
     and coalesce(p.coleccion_publica, false)
     and not coalesce(p.is_banned, false)
   group by p.id, p.username, p.display_name, p.avatar_url, p.is_admin, p.is_moderator
   order by sum(c.cantidad) desc, p.username
   limit 20;
$$;

-- Pide sesión: sin ella no hay «a quién sigues» y la función no tiene
-- ninguna pregunta que contestar.
revoke all on function public.coleccion_quien_la_tiene(text) from public, anon;
grant execute on function public.coleccion_quien_la_tiene(text) to authenticated, service_role;
