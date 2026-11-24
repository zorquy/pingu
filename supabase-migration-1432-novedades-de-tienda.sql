-- Tanda 1432 — Seguidores y novedades de una tienda (de «Funciones de tienda»,
-- PINGU: «me gustan todas»). Seguir a una tienda ya se podía (`user_follows`,
-- como a la gente). Lo nuevo: la tienda escribe una novedad corta, con hasta
-- seis cartas («Ha llegado la caja de 151…»), sale arriba de su escaparate y
-- les llega a la campanita a quienes la siguen.
--
-- UNA POR SEMANA como mucho, y lo cuenta la base, no la web: es lo que hace que
-- seguir a una tienda no acabe en apagar los avisos. Borrar una novedad no
-- devuelve la semana (si no, borrar y volver a escribir sería mandar dos).
--
-- Al correo, no: los avisos que van al correo son los personales y urgentes
-- (js/notifications.js); esto es de campanita (y del móvil, si tiene el push).
--
-- Sentencia a sentencia (la 631): nada de tablas temporales.

create table if not exists public.tienda_novedades (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.user_profiles(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 280),
  -- [{card_id, market}], en el orden en que las eligió; como mucho seis.
  cartas jsonb not null default '[]'::jsonb check (jsonb_typeof(cartas) = 'array' and jsonb_array_length(cartas) <= 6),
  avisados int not null default 0,
  borrada_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tienda_novedades_tienda_idx on public.tienda_novedades (tienda_id, created_at desc);

alter table public.tienda_novedades enable row level security;

-- La ve todo el mundo (es su escaparate), menos las borradas. Nadie escribe a
-- pelo: se publica y se borra por las funciones de abajo.
drop policy if exists tienda_novedades_leer on public.tienda_novedades;
create policy tienda_novedades_leer on public.tienda_novedades
  for select to anon, authenticated
  using (borrada_at is null);

revoke all on public.tienda_novedades from anon, authenticated;
grant select on public.tienda_novedades to anon, authenticated;

-- Para el panel: cuántos la siguen, la última y desde cuándo puede escribir otra.
create or replace function public.tienda_novedades_estado()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_ultima timestamptz;
begin
  if v_yo is null or not exists (select 1 from user_profiles where id = v_yo and tipo = 'tienda') then
    return null;
  end if;
  select max(created_at) into v_ultima from tienda_novedades where tienda_id = v_yo;
  return jsonb_build_object(
    'seguidores', (select count(*) from user_follows where following_id = v_yo),
    'ultima_at', v_ultima,
    'proxima', case when v_ultima > now() - interval '7 days' then v_ultima + interval '7 days' end
  );
end;
$$;
revoke all on function public.tienda_novedades_estado() from public;
grant execute on function public.tienda_novedades_estado() to authenticated;

-- Publicar: comprueba la semana, limpia las cartas (solo las que existen, sin
-- repetir, seis como mucho) y avisa a quien la sigue y no lo tiene apagado.
-- No lanza errores para lo esperable: devuelve `vale` y, si no, el motivo.
create or replace function public.tienda_publicar_novedad(p_texto text, p_cartas jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_perfil record;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_ultima timestamptz;
  v_cartas jsonb;
  v_id uuid;
  v_n int := 0;
begin
  select id, username, display_name, tipo, coalesce(is_banned, false) as baneada into v_perfil
    from user_profiles where id = v_yo;
  if v_yo is null or v_perfil.id is null or v_perfil.tipo is distinct from 'tienda' or v_perfil.baneada then
    return jsonb_build_object('vale', false, 'motivo', 'solo_tiendas');
  end if;
  if char_length(v_texto) < 1 or char_length(v_texto) > 280 then
    return jsonb_build_object('vale', false, 'motivo', 'texto');
  end if;
  select max(created_at) into v_ultima from tienda_novedades where tienda_id = v_yo;
  if v_ultima > now() - interval '7 days' then
    return jsonb_build_object('vale', false, 'motivo', 'una_por_semana', 'proxima', v_ultima + interval '7 days');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('card_id', x.id, 'market', x.market) order by x.n), '[]'::jsonb)
    into v_cartas
    from (
      select c.id, c.market, min(e.n) as n
        from jsonb_array_elements(case when jsonb_typeof(p_cartas) = 'array' then p_cartas else '[]'::jsonb end) with ordinality as e(v, n)
        join tcg_cards c on c.id = e.v->>'card_id' and c.market = coalesce(nullif(e.v->>'market', ''), 'WEST')
       group by c.id, c.market
       order by min(e.n)
       limit 6
    ) x;

  insert into tienda_novedades (tienda_id, texto, cartas)
  values (v_yo, v_texto, v_cartas)
  returning id into v_id;

  insert into user_notifications (recipient_id, type, title, body, link)
  select f.follower_id,
         'tienda_novedad',
         coalesce(nullif(v_perfil.display_name, ''), v_perfil.username, 'Una tienda') || ' tiene novedades',
         left(v_texto, 140),
         '/tiendas/' || coalesce(v_perfil.username, '') || '#novedad-' || v_id
    from user_follows f
    join user_profiles u on u.id = f.follower_id
   where f.following_id = v_yo
     and not coalesce(u.is_banned, false)
     and not (coalesce(u.notification_prefs_disabled, '{}'::text[]) @> array['tienda_novedad']);
  get diagnostics v_n = row_count;

  update tienda_novedades set avisados = v_n where id = v_id;
  return jsonb_build_object('vale', true, 'id', v_id, 'avisados', v_n, 'proxima', now() + interval '7 days');
end;
$$;
revoke all on function public.tienda_publicar_novedad(text, jsonb) from public;
grant execute on function public.tienda_publicar_novedad(text, jsonb) to authenticated;

-- Borrar: deja de verse y se quitan los avisos que nadie ha abierto aún. La
-- semana sigue contando (ver arriba).
create or replace function public.tienda_borrar_novedad(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update tienda_novedades set borrada_at = now()
   where id = p_id and tienda_id = auth.uid() and borrada_at is null;
  if not found then
    return false;
  end if;
  delete from user_notifications
   where type = 'tienda_novedad' and read_at is null and link like '%#novedad-' || p_id::text;
  return true;
end;
$$;
revoke all on function public.tienda_borrar_novedad(uuid) from public;
grant execute on function public.tienda_borrar_novedad(uuid) to authenticated;
