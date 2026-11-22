-- Tanda 1415 — En la ficha de un evento, «Quién tiene lo que buscas» (PINGU,
-- de «Dónde va cada función»: «9, sí»). Si has dicho «Voy», debajo de «Quién
-- va» salen los que van y tienen para cambio cartas de tu La quiero, y los que
-- buscan cartas que tú das. Y la víspera, un aviso a la campana si hay algo.
--
-- Solo cuenta lo PÚBLICO: lo que cada uno pone para cambio (con
-- `cambio_libres_de`, lo que no está ya comprometido en un trato) y La quiero,
-- que se ve en cada perfil. Quien va «sin decirlo» no sale a los demás (él
-- sí ve lo suyo). Una colección privada no se mira nunca: «la tiene» es «la
-- da».
--
-- Se ejecuta entera en el SQL Editor; sin tablas temporales (la 631).

-- ── El cruce, para una persona ──
-- Interna: la llaman `evento_cruces` (con quien pregunta) y `eventos_vispera`
-- (con cada asistente). Sin «Voy» no devuelve nada.
create or replace function public.evento_cruces_de(p_evento uuid, p_yo uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  tiene jsonb,
  busca jsonb,
  tiene_n int,
  busca_n int
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select a.user_id as id
      from evento_asistentes a
      join user_profiles p on p.id = a.user_id
     where a.evento_id = p_evento and a.user_id = p_yo
       and not coalesce(p.is_banned, false)
  ),
  otros as (
    select a.user_id
      from evento_asistentes a
      join user_profiles p on p.id = a.user_id
     where a.evento_id = p_evento
       and not a.oculto
       and a.user_id <> (select id from yo)
       and not coalesce(p.is_banned, false)
  ),
  -- Lo que dan los otros y está en mi La quiero (con su idioma y versión si
  -- los pedí: la regla del Mercado).
  tiene as (
    select distinct c.user_id, c.card_id, c.market
      from user_collection c
      join otros o on o.user_id = c.user_id
     where c.cambio > 0
       and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
       and exists (
         select 1 from user_wants w
          where w.user_id = (select id from yo) and w.card_id = c.card_id
            and (w.idioma is null or w.idioma = c.idioma)
            and (w.variante is null or w.variante = coalesce(c.variante, 'normal')))
  ),
  -- Lo que buscan los otros y yo doy.
  busca as (
    select distinct w.user_id, c.card_id, c.market
      from user_wants w
      join otros o on o.user_id = w.user_id
      join user_collection c on c.user_id = (select id from yo) and c.card_id = w.card_id
     where c.cambio > 0
       and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
       and (w.idioma is null or w.idioma = c.idioma)
       and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  ),
  -- Doce cartas de cada lado como mucho: es para ver de un vistazo, no la
  -- lista entera (esa está en su perfil).
  t as (
    select x.user_id, count(*)::int as n,
           jsonb_agg(jsonb_build_object('id', x.card_id, 'market', x.market) order by x.card_id) filter (where x.k <= 12) as cartas
      from (select tiene.*, row_number() over (partition by tiene.user_id order by tiene.card_id) as k from tiene) x
     group by x.user_id
  ),
  b as (
    select x.user_id, count(*)::int as n,
           jsonb_agg(jsonb_build_object('id', x.card_id, 'market', x.market) order by x.card_id) filter (where x.k <= 12) as cartas
      from (select busca.*, row_number() over (partition by busca.user_id order by busca.card_id) as k from busca) x
     group by x.user_id
  )
  select o.user_id, p.username, p.display_name, p.avatar_url,
         coalesce(t.cartas, '[]'::jsonb), coalesce(b.cartas, '[]'::jsonb),
         coalesce(t.n, 0), coalesce(b.n, 0)
    from otros o
    join user_profiles p on p.id = o.user_id
    left join t on t.user_id = o.user_id
    left join b on b.user_id = o.user_id
   where coalesce(t.n, 0) + coalesce(b.n, 0) > 0
   order by coalesce(t.n, 0) desc, coalesce(b.n, 0) desc, p.username
   limit 40
$$;
revoke all on function public.evento_cruces_de(uuid, uuid) from public, anon, authenticated;

-- ── Para la ficha ──
create or replace function public.evento_cruces(p_evento uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  tiene jsonb,
  busca jsonb,
  tiene_n int,
  busca_n int
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.evento_cruces_de(p_evento, auth.uid())
$$;
revoke all on function public.evento_cruces(uuid) from public, anon;
grant execute on function public.evento_cruces(uuid) to authenticated;

-- ── La víspera ──
-- Una vez por evento y persona: se apunta ANTES de avisar (la 665).
create table if not exists public.evento_vispera_avisos (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evento_id, user_id)
);
-- Sin políticas: solo la toca `eventos_vispera`, que es security definer.
alter table public.evento_vispera_avisos enable row level security;

-- La llama cada hora `avisos-recordatorio` (Netlify). Solo hace algo entre
-- las 18 y las 21 de Madrid, para los eventos que empiezan MAÑANA; y solo
-- avisa a quien tiene algo que ver allí. Devuelve a cuántos avisó. `p_ahora`
-- es para la prueba; la función programada no lo manda.
create or replace function public.eventos_vispera(p_ahora timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora int := extract(hour from p_ahora at time zone 'Europe/Madrid');
  v_manana date := (p_ahora at time zone 'Europe/Madrid')::date + 1;
  r record;
  v_personas int;
  v_dan int;
  v_buscan int;
  v_n int := 0;
  v_cuerpo text;
begin
  if v_hora < 18 or v_hora > 21 then
    return 0;
  end if;
  for r in
    select e.id, e.nombre, e.slug, a.user_id
      from eventos e
      join evento_asistentes a on a.evento_id = e.id
      join user_profiles p on p.id = a.user_id
     where e.publicado
       and (e.empieza at time zone 'Europe/Madrid')::date = v_manana
       and not coalesce(p.is_banned, false)
       and not ('evento_vispera' = any (coalesce(p.notification_prefs_disabled, '{}'::text[])))
       and not exists (select 1 from evento_vispera_avisos v where v.evento_id = e.id and v.user_id = a.user_id)
  loop
    insert into evento_vispera_avisos (evento_id, user_id) values (r.id, r.user_id) on conflict do nothing;
    select count(*)::int,
           count(*) filter (where c.tiene_n > 0)::int,
           count(*) filter (where c.busca_n > 0)::int
      into v_personas, v_dan, v_buscan
      from public.evento_cruces_de(r.id, r.user_id) c;
    if v_personas > 0 then
      v_cuerpo := concat_ws(' y ',
        case when v_dan = 1 then '1 de los que van da cartas de tu La quiero'
             when v_dan > 1 then v_dan || ' de los que van dan cartas de tu La quiero' end,
        case when v_buscan = 1 then '1 busca cartas que tú das'
             when v_buscan > 1 then v_buscan || ' buscan cartas que tú das' end) || '. Míralo antes de ir.';
      insert into user_notifications (recipient_id, type, title, body, link)
      values (r.user_id, 'evento_vispera', left('Mañana: ' || r.nombre, 200), v_cuerpo, '/eventos/' || r.slug || '#evCruces');
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.eventos_vispera(timestamptz) from public, anon, authenticated;
grant execute on function public.eventos_vispera(timestamptz) to service_role;
