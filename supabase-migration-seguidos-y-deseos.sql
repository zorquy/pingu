-- Tanda 766 — DC1: en «La quiero», quién de los que sigues tiene cada carta.
--
-- Es la pregunta de la ficha (`coleccion_quien_la_tiene`, tanda 403), pero
-- para TODA tu lista de una vez: con cuarenta cartas apuntadas serían
-- cuarenta llamadas cada vez que abres la pestaña. Mismas reglas que la de
-- la ficha, y por los mismos motivos:
--   · solo la gente a la que TÚ sigues («quién de los míos», no un
--     directorio de colecciones ajenas);
--   · solo quien tiene la colección pública (seguir a alguien no es permiso
--     para mirarle los cajones);
--   · sin baneados.
-- Y con `is_admin` e `is_moderator` aunque hoy el nombre salga sin enlace:
-- si mañana lleva enlace al perfil, lleva el color de su rango (la 386).
--
-- Sin esta función la web pregunta carta a carta, y solo por las primeras
-- veinte. Sin tablas temporales y sentencia a sentencia (la 631).

create or replace function public.coleccion_seguidos_y_mis_deseos()
returns table (card_id text, user_id uuid, username text, display_name text, avatar_url text,
               is_admin boolean, is_moderator boolean, copias bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.card_id,
         p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         sum(c.cantidad)
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
   where c.card_id in (select w.card_id from public.user_wants w where w.user_id = auth.uid())
     and c.user_id <> auth.uid()
     and exists (
       select 1 from public.user_follows f
        where f.follower_id = auth.uid() and f.following_id = c.user_id
     )
     and coalesce(p.coleccion_publica, false)
     and not coalesce(p.is_banned, false)
   group by c.card_id, p.id, p.username, p.display_name, p.avatar_url, p.is_admin, p.is_moderator
   order by c.card_id, sum(c.cantidad) desc, p.username
   limit 2000;
$$;

-- Pide sesión: sin ella no hay ni lista ni «a quién sigues».
revoke all on function public.coleccion_seguidos_y_mis_deseos() from public, anon;
grant execute on function public.coleccion_seguidos_y_mis_deseos() to authenticated, service_role;

notify pgrst, 'reload schema';
