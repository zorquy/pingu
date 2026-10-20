-- Tanda 915 — «Quién la tiene» en la ficha de una carta, para TODOS.
--
-- La ficha nueva (estilo Dex) enseña quién tiene la carta: PINGU eligió
-- «todos los que dejan ver su colección, con la gente que sigues primero».
-- `coleccion_quien_la_tiene` (403) solo mira a los que sigues; esta es su
-- hermana y no la sustituye (la web cae a la vieja si esta no está).
--
-- Quién sale:
--   · quien tiene la colección pública (`coleccion_publica`), con todas sus
--     copias;
--   · y quien la DA para cambio aunque su colección no sea pública: lo que
--     se da ya se enseña en el Mercado y en su perfil (887), así que aquí
--     salen solo las que da (`copias` = las que da), nunca las demás.
--   · Nunca tú, ni alguien baneado.
-- Orden: los que sigues, luego los que la dan, luego quien más tiene.
-- `total` es cuántas personas son en total (para «Ver todos»).
-- Se ve también sin cuenta: la ficha se abre igual desde /cartas.

create or replace function public.coleccion_quien_la_tiene_todos(p_card_id text, p_limite int default 12)
returns table (user_id uuid, username text, display_name text, avatar_url text,
               is_admin boolean, is_moderator boolean, copias bigint, da bigint,
               sigues boolean, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with suyos as (
    select c.user_id,
           sum(c.cantidad)::bigint as copias,
           sum(greatest(coalesce(c.cambio, 0), 0))::bigint as da
      from public.user_collection c
     where c.card_id = p_card_id
       and c.user_id is distinct from auth.uid()
     group by c.user_id
  ), visibles as (
    select p.id,
           p.username,
           p.display_name,
           p.avatar_url,
           coalesce(p.is_admin, false) as es_admin,
           coalesce(p.is_moderator, false) as es_mod,
           case when coalesce(p.coleccion_publica, false) then s.copias else s.da end as copias,
           s.da,
           exists (
             select 1 from public.user_follows f
              where f.follower_id = auth.uid() and f.following_id = p.id
           ) as sigues
      from suyos s
      join public.user_profiles p on p.id = s.user_id
     where (coalesce(p.coleccion_publica, false) or s.da > 0)
       and not coalesce(p.is_banned, false)
  )
  select id, username, display_name, avatar_url, es_admin, es_mod, copias, da, sigues,
         count(*) over ()::bigint as total
    from visibles
   order by sigues desc, (da > 0) desc, copias desc, username
   limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

revoke all on function public.coleccion_quien_la_tiene_todos(text, int) from public;
grant execute on function public.coleccion_quien_la_tiene_todos(text, int) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
