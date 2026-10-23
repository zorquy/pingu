-- Tanda 993 — Un aviso por respuesta en el foro, no dos.
--
-- Se puede ejecutar más de una vez, y cada sentencia va sola (la 631).
--
-- Lo que pasaba: quien abre un tema queda suscrito solo (el disparador de
-- foro-mejoras), así que al responderle le llegaban DOS avisos: «Te han
-- respondido en el foro», que manda la web, y «Nueva respuesta en un tema
-- que sigues», que manda esta función. Igual a quien citabas o mencionabas
-- si además seguía el tema.
--
-- Ahora la web le pasa a quién ha avisado ya (`p_ya_avisados`) y aquí se
-- salta a esos. Con la firma vieja (tres argumentos) se sigue pudiendo
-- llamar: el cuarto tiene valor por defecto.

drop function if exists public.forum_avisar_suscritos(uuid, uuid, text);

create or replace function public.forum_avisar_suscritos(
  p_thread uuid,
  p_post uuid,
  p_titulo text,
  p_ya_avisados uuid[] default '{}'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := auth.uid();
  v_cuantos integer := 0;
begin
  if v_yo is null then
    return 0;
  end if;

  -- Que el mensaje exista, sea de ese tema y sea de quien dice ser.
  if not exists (
    select 1 from forum_posts p
    where p.id = p_post and p.thread_id = p_thread and p.author_id = v_yo
  ) then
    return 0;
  end if;

  with destinatarios as (
    select s.user_id
      from forum_subscriptions s
      join user_profiles u on u.id = s.user_id
     where s.thread_id = p_thread
       and s.user_id <> v_yo
       and not (s.user_id = any(coalesce(p_ya_avisados, '{}')))
       and coalesce(u.is_banned, false) = false
       and not (coalesce(u.notification_prefs_disabled, '{}') @> array['forum_reply'])
  ), insertados as (
    insert into user_notifications (recipient_id, type, title, body, link)
    select d.user_id,
           'forum_reply',
           'Nueva respuesta en un tema que sigues',
           left(coalesce(p_titulo, ''), 200),
           '/tema/' || p_thread::text
      from destinatarios d
    returning 1
  )
  select count(*) into v_cuantos from insertados;

  return v_cuantos;
end;
$$;

grant execute on function public.forum_avisar_suscritos(uuid, uuid, text, uuid[]) to authenticated;
