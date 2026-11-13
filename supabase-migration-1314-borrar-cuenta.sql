-- Tanda 1314 — borrar tu cuenta tú solo, con 14 días para arrepentirte (S11).
--
-- Hasta hoy, «Borrar mi cuenta» apuntaba una solicitud y el equipo borraba a
-- mano en Supabase, porque nadie sabía qué harían las claves ajenas al borrar
-- `auth.users` (cascada, restricción…). Esa prudencia se queda: aquí NO se
-- borra ninguna fila de `auth.users` ni de `user_profiles`. Lo que se hace,
-- pasados 14 días, es:
--   · BORRAR lo privado: colección, deseos, álbumes, mazos, partidas,
--     direcciones, cobros, avisos, seguidos, suscripciones…;
--   · VACIAR tus mensajes privados (la conversación del otro sigue, con
--     «Mensaje eliminado»);
--   · ANONIMIZAR el perfil: «Usuario borrado», sin foto, sin bio. Tus temas,
--     respuestas y tratos cerrados quedan firmados así (la otra persona y el
--     foro los necesitan);
--   · y quitar el acceso: el email de la cuenta pasa a uno que no existe, sin
--     contraseña, sin Google y sin sesiones.
-- Así ninguna clave ajena se rompe y no queda nada que te identifique.
-- Una cuenta de TIENDA no se borra sola: sus ventas y su caja las revisa el
-- equipo (la solicitud queda como antes).
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

alter table public.account_deletion_requests add column if not exists borrar_at timestamptz;

alter table public.account_deletion_requests drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests add constraint account_deletion_requests_status_check
  check (status in ('pending', 'done', 'dismissed', 'cancelled'));

alter table public.user_profiles add column if not exists borrado_at timestamptz;

-- Tu solicitud de ahora (si la hay).
create or replace function public.cuenta_borrado_pendiente()
returns table (id uuid, borrar_at timestamptz, creada timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select r.id, r.borrar_at, r.created_at
  from public.account_deletion_requests r
  where r.user_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc
  limit 1
$$;

-- Pedirlo. Devuelve el día en que se borrará (o null si es una tienda, que
-- pasa por el equipo).
create or replace function public.cuenta_pedir_borrado(p_motivo text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_tienda boolean;
  v_cuando timestamptz;
begin
  if v_uid is null then
    raise exception 'Hace falta entrar.' using errcode = '42501';
  end if;
  select coalesce(p.tipo = 'tienda', false) into v_tienda from public.user_profiles p where p.id = v_uid;
  v_cuando := case when coalesce(v_tienda, false) then null else now() + interval '14 days' end;
  update public.account_deletion_requests set status = 'cancelled' where user_id = v_uid and status = 'pending';
  insert into public.account_deletion_requests (user_id, reason, status, borrar_at)
  values (v_uid, left(nullif(trim(p_motivo), ''), 500), 'pending', v_cuando);
  return v_cuando;
end $$;

-- Arrepentirse: basta con entrar y pulsarlo.
create or replace function public.cuenta_cancelar_borrado()
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.account_deletion_requests set status = 'cancelled'
  where user_id = auth.uid() and status = 'pending';
  return found;
end $$;

-- El borrado en sí. Solo lo llaman `cuentas_borrar_vencidas` (el cron) o el
-- equipo desde el SQL Editor. Cada tabla y columna se mira antes: lo que no
-- exista en esta base se salta.
create or replace function public.cuenta_borrar(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_par text[];
  v_n integer;
  v_hecho jsonb := '{}'::jsonb;
  v_col text;
  -- Lo privado: se borra entero. (tabla, columna con el usuario)
  v_borrar text[][] := array[
    array['user_collection', 'user_id'], array['user_collection_value', 'user_id'],
    array['user_wants', 'user_id'], array['user_want_list_items', 'user_id'], array['user_want_lists', 'user_id'],
    array['user_products', 'user_id'], array['user_albums', 'user_id'], array['user_decks', 'user_id'],
    array['user_direcciones', 'user_id'], array['user_cobros', 'user_id'], array['user_cumple', 'user_id'],
    array['user_privado', 'user_id'], array['user_follows', 'follower_id'], array['user_follows', 'following_id'],
    array['push_subscriptions', 'user_id'], array['user_price_alerts', 'user_id'], array['user_release_alerts', 'user_id'],
    array['user_showcase', 'user_id'], array['user_play_pokemon', 'user_id'],
    array['match_log', 'user_id'], array['match_log_ajustes', 'user_id'], array['match_log_torneos', 'user_id'],
    array['user_notifications', 'recipient_id'], array['forum_subscriptions', 'user_id'], array['forum_thread_reads', 'user_id'],
    array['collection_folders', 'user_id'], array['collection_favorite_sets', 'user_id'], array['online_now', 'user_id'],
    array['trade_offer_direcciones', 'quien'], array['trade_offer_cobros', 'quien'],
    array['retos_partidas', 'user_id'], array['evento_asistentes', 'user_id'], array['aviso_participantes', 'user_id'],
    array['course_attempts', 'user_id'], array['course_review_queue', 'user_id'], array['daily_challenge_results', 'user_id'],
    array['guide_helpful', 'user_id'], array['forum_post_likes', 'user_id'], array['forum_post_reactions', 'user_id'],
    array['private_message_reactions', 'user_id'], array['tienda_avisos', 'user_id'], array['adviento_casillas', 'user_id'],
    array['replay_puzzle_answers', 'user_id'], array['user_cumple', 'user_id']
  ];
  -- Del perfil: lo que se vacía (si existe).
  v_vaciar text[] := array['avatar_url', 'banner_url', 'banner_color', 'bio', 'birthday_md', 'forum_title', 'showcase_achievement',
    'website', 'instagram', 'twitter', 'location', 'ciudad', 'favorite_pokemon', 'pokemon_favorito', 'tcg_live_name', 'play_pokemon_id'];
begin
  if p_user is null then
    return '{}'::jsonb;
  end if;
  foreach v_par slice 1 in array v_borrar loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_par[1] and column_name = v_par[2]) then
      execute format('delete from public.%I where %I = $1', v_par[1], v_par[2]) using p_user;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_hecho := v_hecho || jsonb_build_object(v_par[1], coalesce((v_hecho ->> v_par[1])::int, 0) + v_n); end if;
    end if;
  end loop;
  -- Los mensajes privados: vacíos y marcados, para que la conversación del
  -- otro no se rompa.
  if to_regclass('public.private_messages') is not null then
    update public.private_messages set body = '', adjuntos = '[]'::jsonb, deleted_at = coalesce(deleted_at, now()) where sender_id = p_user;
    get diagnostics v_n = row_count;
    v_hecho := v_hecho || jsonb_build_object('mensajes_vaciados', v_n);
  end if;
  -- El perfil, anónimo.
  update public.user_profiles set
    username = 'borrado-' || left(replace(p_user::text, '-', ''), 10),
    display_name = 'Usuario borrado',
    borrado_at = now()
  where id = p_user;
  foreach v_col in array v_vaciar loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = v_col) then
      execute format('update public.user_profiles set %I = null where id = $1', v_col) using p_user;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'hide_activity') then
    update public.user_profiles set hide_activity = true where id = p_user;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'coleccion_publica') then
    update public.user_profiles set coleccion_publica = false where id = p_user;
  end if;
  -- El acceso: sin email de verdad, sin contraseña, sin Google, sin sesiones.
  begin
    update auth.users set
      email = 'borrado+' || replace(p_user::text, '-', '') || '@pokedoc.invalid',
      encrypted_password = null,
      phone = null,
      raw_user_meta_data = '{}'::jsonb,
      banned_until = 'infinity'
    where id = p_user;
  exception when others then
    v_hecho := v_hecho || jsonb_build_object('auth_users', sqlerrm);
  end;
  begin execute 'delete from auth.identities where user_id = $1' using p_user; exception when others then null; end;
  begin execute 'delete from auth.sessions where user_id = $1' using p_user; exception when others then null; end;
  begin execute 'delete from auth.mfa_factors where user_id = $1' using p_user; exception when others then null; end;
  update public.account_deletion_requests set status = 'done' where user_id = p_user and status = 'pending';
  return v_hecho;
end $$;

-- Las que han cumplido sus 14 días. Una tienda (sin fecha) no entra nunca.
create or replace function public.cuentas_borrar_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_r record;
  v_n integer := 0;
begin
  for v_r in select distinct user_id from public.account_deletion_requests
             where status = 'pending' and borrar_at is not null and borrar_at <= now() loop
    perform public.cuenta_borrar(v_r.user_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.cuenta_borrar(uuid) from public, anon, authenticated;

revoke all on function public.cuentas_borrar_vencidas() from public, anon, authenticated;

revoke all on function public.cuenta_pedir_borrado(text) from public, anon;

revoke all on function public.cuenta_cancelar_borrado() from public, anon;

revoke all on function public.cuenta_borrado_pendiente() from public, anon;

grant execute on function public.cuenta_pedir_borrado(text) to authenticated;

grant execute on function public.cuenta_cancelar_borrado() to authenticated;

grant execute on function public.cuenta_borrado_pendiente() to authenticated;

-- Cada día a las 04:17 (hora del servidor). Sin pg_cron (la 1310 lo
-- activa), un aviso: el equipo puede llamar a la función a mano.
do $$
begin
  perform cron.schedule('pokedoc-borrar-cuentas', '17 4 * * *', 'select public.cuentas_borrar_vencidas()');
exception when others then
  raise notice 'pg_cron no está activado: actívalo (Database → Extensions) y vuelve a ejecutar esto, o llama a cuentas_borrar_vencidas() a mano.';
end $$;

notify pgrst, 'reload schema';
