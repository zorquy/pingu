-- ============================================================
-- Avisos por correo: seguidores nuevos
-- ============================================================
--
-- QUÉ HACE
--   Cuando alguien empieza a seguirte, se encola un correo. Hasta ahora
--   eso solo llegaba a la campanita, o sea solo si entrabas.
--
-- POR QUÉ ESTE SÍ, SI LA NORMA ERA "SOLO LO QUE SE PIERDE"
--   La regla de supabase-migration-correo-avisos.sql es que un correo se
--   justifica cuando alguien se dirige a ti. Un seguidor no espera
--   respuesta, así que en su día se dejó fuera a propósito.
--
--   Se mete ahora porque en una comunidad que arranca un seguidor nuevo
--   SÍ es una señal: es la prueba de que hay alguien al otro lado. Pero
--   se mete AGRUPADO, que es lo que lo hace soportable (ver abajo).
--
-- LA AGRUPACIÓN, QUE AQUÍ ES LO IMPORTANTE
--   La clave de agrupación es `follow:<a-quien>`, una por destinatario y
--   no una por pareja. Así, `enqueue_email` deja pasar como mucho un
--   correo de seguidores cada media hora: cinco seguidores en diez
--   minutos son UN correo, no cinco.
--
--   Eso trae una consecuencia que hay que aceptar: el asunto nombra al
--   primero de la tanda, no a todos. Prometer "y 4 más" obligaría a
--   contar en el momento de enviar, no en el de encolar, y no compensa.
--
--   Y de paso cierra un agujero: sin agrupar, dejar de seguir y volver a
--   seguir en bucle sería un correo por vuelta.
--
-- REQUIERE: supabase-migration-correo-avisos.sql (de ahí salen
-- `enqueue_email` y `email_preview`) y supabase-migration-follows.sql.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

create or replace function public.on_new_follower_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_nombre text;
  v_usuario text;
  v_bio text;
  v_baneado boolean;
begin
  -- La tabla ya prohíbe seguirse a uno mismo (user_follows_no_self),
  -- pero esto no depende de que esa restricción siga ahí mañana.
  if new.follower_id is null or new.follower_id = new.following_id then
    return new;
  end if;

  select email_preview(coalesce(display_name, username, 'Alguien'), 60),
         username,
         email_preview(bio, 140),
         coalesce(is_banned, false)
    into v_nombre, v_usuario, v_bio, v_baneado
    from user_profiles
   where id = new.follower_id;

  -- De un baneado no se avisa: sería usar nuestro correo para que le
  -- llegue a alguien lo que no queremos ni que se vea en la web.
  if v_baneado then
    return new;
  end if;

  -- Al que recibe también se le mira: a una cuenta baneada no se le
  -- escribe.
  if coalesce((select is_banned from user_profiles where id = new.following_id), false) then
    return new;
  end if;

  perform enqueue_email(
    new.following_id,
    'new_follower',
    coalesce(v_nombre, 'Alguien') || ' ha empezado a seguirte',
    -- La bio del que sigue, si la tiene: da contexto para decidir si te
    -- interesa devolverle el seguimiento sin tener que abrir nada.
    v_bio,
    -- Al perfil de quien te sigue, que es lo que quieres mirar.
    case when v_usuario is not null then '/usuario/' || v_usuario else '/usuarios.html' end,
    'follow:' || new.following_id::text
  );

  return new;
end $$;

-- Igual que las otras: es SECURITY DEFINER, y sin el revoke PostgREST la
-- expone como RPC y cualquiera podría mandar correo desde pokedoc.es. Los
-- disparadores siguen funcionando porque los invoca el motor, que no mira
-- el permiso EXECUTE de quien hace el INSERT.
revoke all on function public.on_new_follower_email() from public;
revoke all on function public.on_new_follower_email() from anon, authenticated;

drop trigger if exists new_follower_email on public.user_follows;
create trigger new_follower_email
  after insert on public.user_follows
  for each row execute function public.on_new_follower_email();

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_name = 'new_follower_email';

-- Las tres columnas tienen que salir en `false`.
select p.proname as funcion,
       has_function_privilege('public', p.oid, 'execute') as puede_public,
       has_function_privilege('anon', p.oid, 'execute') as puede_anon,
       has_function_privilege('authenticated', p.oid, 'execute') as puede_logueado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'on_new_follower_email';
