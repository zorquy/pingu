-- Tanda 1058 — las listas de «La quiero» que NO cuentan para los cruces, y
-- una lista en el Modo evento.
--
-- PINGU aprobó (propuesta 1056, versión 1) que cada lista decida si cuenta
-- para los cruces: «A vigilar» o «Ideas» son cosas que no buscas de verdad,
-- y no deberían salir en tu perfil, en el Mercado de nadie ni avisar a nadie.
--
-- · user_want_lists.cruces (por defecto sí).
-- · deseo_cuenta(usuario, carta): un deseo cuenta salvo que la carta esté en
--   alguna lista que no cuenta Y en ninguna que sí. Sin listas, cuenta, como
--   siempre. La lista va por carta (no por versión ni catálogo), como en la
--   1057.
-- · La política de lectura de user_wants: lo que no cuenta lo ve solo su
--   dueño (el perfil, el modo evento y los cruces del navegador leen la
--   tabla). Y las cuatro funciones de los cruces (las de la 1047, enteras,
--   con la condición puesta): quién tiene, quién busca, el Mercado de lo que
--   busco y el aviso.
-- · evento_lista(lista): las cartas de UNA lista para el QR del Modo evento
--   (/evento/<usuario>?lista=<id>). El id es un uuid que solo tiene quien
--   recibe el enlace; devuelve solo cartas que su dueño sigue queriendo.
--
-- Sentencias sueltas, sin tablas temporales (la 631). Se puede ejecutar dos
-- veces.

alter table public.user_want_lists add column if not exists cruces boolean not null default true;

create or replace function public.deseo_cuenta(p_user uuid, p_card text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
           select 1 from public.user_want_list_items i
           join public.user_want_lists l on l.id = i.list_id
           where i.user_id = p_user and i.card_id = p_card and not l.cruces)
      or exists (
           select 1 from public.user_want_list_items i
           join public.user_want_lists l on l.id = i.list_id
           where i.user_id = p_user and i.card_id = p_card and l.cruces);
$$;

-- La usa la política de lectura: la tienen que poder ejecutar los dos roles
-- (la 555: una función que tu rol no ejecuta tumba la consulta entera).
grant execute on function public.deseo_cuenta(uuid, text) to anon, authenticated;

drop policy if exists user_wants_ver on public.user_wants;
create policy user_wants_ver on public.user_wants for select
  using (user_id = auth.uid() or public.deseo_cuenta(user_id, card_id));

-- Si ya existía con otras columnas, create or replace no la cambia.
drop function if exists public.evento_lista(uuid);
create or replace function public.evento_lista(p_lista uuid)
returns table (card_id text, market text, nombre text, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select i.card_id, i.market, l.nombre, l.user_id
  from public.user_want_list_items i
  join public.user_want_lists l on l.id = i.list_id
  where i.list_id = p_lista
    and exists (select 1 from public.user_wants w where w.user_id = i.user_id and w.card_id = i.card_id);
$$;

grant execute on function public.evento_lista(uuid) to anon, authenticated;

-- ── Los cruces (los de la 1047, con deseo_cuenta) ──
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
    select c.card_id, c.idioma, c.variante
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
                 and (w2.variante is null or w2.variante = coalesce(m.variante, 'normal'))
      where w2.user_id = c.user_id
        and public.deseo_cuenta(w2.user_id, w2.card_id)
    ) as reciproco
  from public.user_wants w
  join yo on w.user_id = yo.id and public.deseo_cuenta(w.user_id, w.card_id)
  join public.user_collection c
    on c.card_id = w.card_id
   and c.cambio > 0
   and c.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = c.user_id
  where not coalesce(p.is_banned, false)
  -- Lo recíproco primero: es lo único que se cierra de un mensaje.
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;
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
  busco as (select w.card_id, w.idioma, w.variante from public.user_wants w, yo where w.user_id = yo.id and public.deseo_cuenta(w.user_id, w.card_id))
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
                  and (b.variante is null or b.variante = coalesce(c2.variante, 'normal'))
      where c2.user_id = w.user_id and c2.cambio > 0
    ) as reciproco
  from public.user_collection c
  join yo on c.user_id = yo.id
  join public.user_wants w
    on w.card_id = c.card_id
   and w.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = w.user_id
  where c.cambio > 0 and not coalesce(p.is_banned, false)
    and public.deseo_cuenta(w.user_id, w.card_id)
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- ── 3. El Mercado: «Solo las que busco» (supabase-migration-mercado.sql) ──
create or replace function public.intercambios_mercado(
  p_market text default 'WEST',
  p_idioma text default null,
  p_texto text default null,
  p_sets text[] default null,
  p_solo_mias boolean default false,
  p_orden text default 'nuevo',
  p_limite int default 60,
  p_desde int default 0
)
returns table (
  card_id text,
  market text,
  personas int,
  copias int,
  idiomas text[],
  dan uuid[],
  gente jsonb,
  ultima timestamptz,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with dan as (
    select c.card_id, c.market, c.user_id, c.idioma, c.cambio, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where c.cambio > 0
      and c.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and c.user_id is distinct from auth.uid()
      and (p_idioma is null or c.idioma = p_idioma)
      -- El texto llega ya normalizado (minúsculas, sin acentos), que es
      -- como está `name_search`, columna generada.
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.set_id = any (p_sets)))
      -- «Solo las que busco»: con la misma regla de idioma que los cruces
      -- (un deseo sin idioma vale cualquiera).
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = c.card_id
          and public.deseo_cuenta(w.user_id, w.card_id)
          and (w.idioma is null or w.idioma = c.idioma)
          and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))))
  ),
  -- Una persona puede dar la misma carta en dos líneas (en dos idiomas):
  -- en los avatares sale una vez.
  por_persona as (
    select d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url,
           d.is_admin, d.is_moderator, max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url, d.is_admin, d.is_moderator
  ),
  por_carta as (
    select d.card_id, d.market,
           count(distinct d.user_id)::int as personas,
           sum(d.cambio)::int as copias,
           array_agg(distinct d.idioma order by d.idioma) as idiomas,
           max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market
  )
  select pc.card_id, pc.market, pc.personas, pc.copias, pc.idiomas,
         (select array_agg(pp.user_id order by pp.ultima desc)
            from por_persona pp where pp.card_id = pc.card_id and pp.market = pc.market) as dan,
         (select jsonb_agg(jsonb_build_object(
                   'user_id', s.user_id, 'username', s.username, 'display_name', s.display_name,
                   'avatar_url', s.avatar_url, 'is_admin', s.is_admin, 'is_moderator', s.is_moderator)
                 order by s.ultima desc)
            from (select * from por_persona pp
                  where pp.card_id = pc.card_id and pp.market = pc.market
                  order by pp.ultima desc limit 5) s) as gente,
         pc.ultima,
         count(*) over () as total
  from por_carta pc
  left join public.tcg_card_prices pr on pr.card_id = pc.card_id
  order by
    case when p_orden = 'gente' then pc.personas end desc nulls last,
    case when p_orden = 'caro' then coalesce(pr.cm_low, pr.cm_trend) end desc nulls last,
    pc.ultima desc,
    pc.card_id
  limit greatest(1, least(coalesce(p_limite, 60), 200))
  offset greatest(0, coalesce(p_desde, 0));
$$;

-- ── 4. El aviso de «alguien da una carta que buscas» (cambios-seguidos) ──
create or replace function public.intercambios_avisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_quien text;
begin
  if coalesce(new.cambio, 0) <= 0 or coalesce(old.cambio, 0) > 0 then
    return new;
  end if;

  select coalesce(name_es, name) into v_nombre from public.tcg_cards where id = new.card_id;
  select username into v_quien from public.user_profiles where id = new.user_id;

  insert into public.user_notifications (recipient_id, type, title, body, link)
  select d.user_id,
         case when d.sigue then 'trade_match_seguido' else 'trade_match' end,
         case when d.sigue and v_quien is not null then '@' || v_quien || ', a quien sigues, da una carta que buscas'
              else 'Alguien da una carta que buscas' end,
         d.nombre,
         '/mi-coleccion?ver=cambios'
    from (
      select distinct on (w.user_id)
             w.user_id,
             w.prioridad,
             w.created_at,
             coalesce(v_nombre, new.card_id) as nombre,
             exists (select 1 from public.user_follows f where f.follower_id = w.user_id and f.following_id = new.user_id) as sigue,
             coalesce(u.notification_prefs_disabled, '{}') as apagados
        from public.user_wants w
        join public.user_profiles u on u.id = w.user_id
       where w.card_id = new.card_id
         and w.user_id <> new.user_id
         and (w.idioma is null or w.idioma = new.idioma)
         and (w.variante is null or w.variante = coalesce(new.variante, 'normal'))
         and coalesce(u.is_banned, false) = false
         and public.deseo_cuenta(w.user_id, w.card_id)
         and not exists (
           select 1 from public.user_notifications n
            where n.recipient_id = w.user_id
              and n.type in ('trade_match', 'trade_match_seguido')
              and n.read_at is null
              and n.body = coalesce(v_nombre, new.card_id)
         )
       order by w.user_id, w.prioridad desc, w.created_at
    ) d
   -- Cada uno con SU preferencia: quien apagó el de los que sigue sigue
   -- recibiendo el general de los demás, y al revés.
   where not (d.apagados @> array[case when d.sigue then 'trade_match_seguido' else 'trade_match' end])
   -- Los que siguen a quien la da, primero; luego los que más la buscan.
   order by d.sigue desc, d.prioridad desc, d.created_at
   limit 25;

  return new;
end;
$$;

notify pgrst, 'reload schema';
