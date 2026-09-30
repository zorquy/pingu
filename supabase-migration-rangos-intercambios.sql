-- Tanda 386 — el rango de quien da o busca una carta
--
-- El tablón de intercambios y el «quién da esta carta» de la ficha
-- enseñan el nombre de alguien CON ENLACE A SU PERFIL, así que ese
-- nombre tiene que llevar el color de su rango como los demás. Pero
-- esos nombres no salen de un `select` del cliente: salen de tres
-- funciones, y una función solo devuelve las columnas que declara.
--
-- Así que hay que ampliar las tres. **Y no vale `create or replace`**:
-- Postgres no deja cambiar las columnas de salida de una función
-- existente («cannot change return type of existing function»), hay que
-- tirarla y volver a crearla. De ahí los tres `drop`.
--
-- Lo demás no cambia ni una coma: es el mismo cuerpo de
-- supabase-migration-intercambios.sql con dos columnas más, puestas
-- detrás de `avatar_url`, que es donde acaba «quién es esta persona».
--
-- Las dos van con `coalesce(..., false)`: `is_moderator` tiene valor por
-- defecto en la tabla, pero una fila vieja podría traerlo nulo y en el
-- cliente un `null` no asciende a nadie — mejor que la función diga lo
-- que quiere decir.
--
-- El cliente aguanta esta migración sin poner: si las columnas no
-- llegan, `rangoDe` ve `undefined` y no pinta ningún rango, que es
-- exactamente lo que hacía antes.

drop function if exists public.intercambios_quien_tiene(int);
drop function if exists public.intercambios_quien_busca(int);
drop function if exists public.intercambios_de_carta(text, int);

create or replace function public.intercambios_quien_tiene(p_limite int default 200)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_moderator boolean,
  card_id text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int,
  prioridad int,
  reciproco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select auth.uid() as id),
  -- Lo que yo doy, para saber si la otra persona busca algo mío.
  mias as (
    select c.card_id, c.idioma
    from public.user_collection c, yo
    where c.user_id = yo.id and c.cambio > 0
  )
  select
    c.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_moderator, false),
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_wants w2
      join mias m on m.card_id = w2.card_id and (w2.idioma is null or w2.idioma = m.idioma)
      where w2.user_id = c.user_id
    ) as reciproco
  from public.user_wants w
  join yo on w.user_id = yo.id
  join public.user_collection c
    on c.card_id = w.card_id
   and c.cambio > 0
   and c.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
  join public.user_profiles p on p.id = c.user_id
  where not coalesce(p.is_banned, false)
  -- Lo recíproco primero: es lo único que se cierra de un mensaje.
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- Y al revés: quién busca alguna de las cartas que yo doy.
create or replace function public.intercambios_quien_busca(p_limite int default 200)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_moderator boolean,
  card_id text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int,
  prioridad int,
  reciproco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select auth.uid() as id),
  -- Lo que yo busco, para saber si la otra persona da algo que quiero.
  busco as (select w.card_id, w.idioma from public.user_wants w, yo where w.user_id = yo.id)
  select
    w.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_moderator, false),
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_collection c2
      join busco b on b.card_id = c2.card_id and (b.idioma is null or b.idioma = c2.idioma)
      where c2.user_id = w.user_id and c2.cambio > 0
    ) as reciproco
  from public.user_collection c
  join yo on c.user_id = yo.id
  join public.user_wants w
    on w.card_id = c.card_id
   and w.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
  join public.user_profiles p on p.id = w.user_id
  where c.cambio > 0 and not coalesce(p.is_banned, false)
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- Y el escaparate de una carta suelta: quién da ESTA. Va sin sesión a
-- propósito — es lo que se enseña en la ficha de una carta, que se ve
-- sin cuenta, igual que los torneos (tanda 252).
create or replace function public.intercambios_de_carta(p_card_id text, p_limite int default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_moderator boolean,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.user_id, p.username, p.display_name, p.avatar_url,
         coalesce(p.is_admin, false), coalesce(p.is_moderator, false),
         c.idioma, c.estado, c.variante, c.gradeo, c.cambio
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.card_id = p_card_id
    and c.cambio > 0
    and not coalesce(p.is_banned, false)
    and c.user_id is distinct from auth.uid()
  order by c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 20), 100));
$$;

-- Los permisos se van con el `drop`, así que se vuelven a dar. Las dos
-- primeras piden sesión (miran `auth.uid()`); la de una carta suelta es
-- el escaparate de la ficha y se ve sin cuenta, igual que los torneos.
grant execute on function public.intercambios_quien_tiene(int) to authenticated;
grant execute on function public.intercambios_quien_busca(int) to authenticated;
grant execute on function public.intercambios_de_carta(text, int) to anon, authenticated;
