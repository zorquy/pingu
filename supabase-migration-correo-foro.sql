-- ============================================================
-- Avisos por correo del foro: respuestas y menciones
-- ============================================================
--
-- QUÉ ARREGLA
--   Hasta ahora el correo solo salía por mensajes privados y respuestas
--   a comentarios de guías. El foro entero se quedaba en la campanita, y
--   la campanita solo la ve quien entra. O sea: sigues un tema, te
--   contestan, y no te enteras hasta que vuelves por tu cuenta — que es
--   justo lo que no pasa cuando la comunidad es pequeña.
--
-- A QUIÉN SE LE ESCRIBE
--   · A quien te MENCIONA con @tunombre. Es lo más directo que hay: te
--     están llamando por tu nombre.
--   · A quien SIGUE el tema, y a quien has CITADO.
--
--   No se escribe por cada mensaje del foro a todo el mundo. La regla es
--   la misma que en supabase-migration-correo-avisos.sql: un correo se
--   justifica cuando alguien se dirige a ti, no cuando pasa algo cerca.
--
-- POR QUÉ EL DISPARADOR VA SOBRE forum_posts
--   Por lo mismo que los otros dos no cuelgan de `user_notifications`:
--   esa tabla deja insertar a cualquiera una fila para cualquiera con el
--   texto que quiera, así que colgar el correo de ahí sería dejar que
--   cualquier miembro mandara un correo desde pokedoc.es con el asunto
--   que le diera la gana.
--
--   En `forum_posts` la RLS ya demuestra quién escribió qué. El
--   destinatario y el texto se DEDUCEN aquí; no se aceptan del cliente.
--
-- REQUIERE: supabase-migration-correo-avisos.sql (de ahí salen
-- `enqueue_email` y `email_preview`) y supabase-migration-foro-mejoras.sql
-- (de ahí sale `forum_subscriptions`).
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- ────────────────────────────────────────────────────────────
-- 1. Los nombres mencionados en un texto
-- ────────────────────────────────────────────────────────────
--
-- ⚠️ ESTA REGLA ESTÁ DUPLICADA. La otra copia es PATRON, en
-- js/menciones.js, y las dos tienen que decir lo mismo: si divergen,
-- alguien recibe el correo pero no la campanita, o al revés. No se puede
-- compartir el código (una vive en Postgres y la otra en el navegador),
-- así que lo que se comparte son los casos de prueba.
--
-- Se come el carácter de DELANTE de la arroba y exige que sea el
-- principio del texto o algo que no forme parte de una dirección de
-- correo. Sin eso, "escribe a hola@pokedoc.es" menciona a @pokedoc.
--
-- El tope de cinco es el mismo, y no es por rendimiento: un mensaje con
-- veinte menciones no es una conversación, es una lista de correo.
create or replace function public.menciones_de(p_texto text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(nombre), '{}')
  from (
    select distinct lower(m[1]) as nombre
    from regexp_matches(
      coalesce(p_texto, ''),
      '(?:^|[^a-zA-Z0-9@._-])@([a-zA-Z0-9][a-zA-Z0-9_-]{1,29})',
      'g'
    ) as m
    limit 5
  ) n
$$;

comment on function public.menciones_de(text) is
  'Los @nombre de un texto plano, en minúsculas y como mucho cinco. Misma regla que PATRON en js/menciones.js: si se cambia una, hay que cambiar la otra.';


-- ────────────────────────────────────────────────────────────
-- 2. El disparador
-- ────────────────────────────────────────────────────────────
create or replace function public.on_forum_post_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text;
  v_nombre text;
  v_titulo text;
  v_enlace text;
  v_vista text;
  v_mencionados uuid[];
  v_citado uuid;
  v_id uuid;
begin
  -- El cuerpo se guarda como HTML. Las etiquetas fuera antes de nada:
  -- si no, un @nombre metido en un href contaría como mención y la
  -- vista previa del correo saldría llena de <p> y <strong>.
  --
  -- Dos pasadas, y la diferencia importa:
  --
  --   · Las etiquetas de BLOQUE dejan un espacio. Sin él,
  --     "<p>hola</p><p>@ash</p>" es "hola@ash", que por la regla de las
  --     direcciones de correo deja de ser una mención.
  --   · Las de dentro de una frase (b, i, a, code…) no dejan nada. Con
  --     un espacio, "<b>@ash</b>," se leería "@ash ," y así saldría en
  --     la vista previa del correo.
  --
  -- Es la misma división que BLOQUES en js/menciones.js. Si divergen,
  -- alguien recibe el correo pero no ve el enlace en el mensaje.
  v_texto := regexp_replace(coalesce(new.body_html, ''),
    '</?(p|div|br|li|ul|ol|h[1-6]|blockquote|tr|td|pre|hr)( [^>]*)?/?>', ' ', 'gi');
  v_texto := regexp_replace(v_texto, '<[^>]*>', '', 'g');
  v_vista := email_preview(v_texto);

  -- email_preview colapsa cualquier espacio en blanco, saltos de línea
  -- incluidos. Va aquí porque el nombre y el título acaban en la
  -- CABECERA Subject del correo, y un \n ahí permitiría inyectar
  -- cabeceras.
  select email_preview(coalesce(display_name, username, 'Alguien'), 60) into v_nombre
  from user_profiles where id = new.author_id;
  v_nombre := coalesce(v_nombre, 'Alguien');

  select email_preview(t.title, 80) into v_titulo
  from forum_threads t where t.id = new.thread_id;
  v_titulo := coalesce(v_titulo, 'un tema del foro');

  v_enlace := '/tema/' || new.thread_id::text;

  -- ── Los mencionados ──
  --
  -- `lower(username)` a los dos lados: el índice único de los usernames
  -- es sobre lower(username), así que esto es lo que hay.
  select coalesce(array_agg(distinct u.id), '{}') into v_mencionados
  from unnest(menciones_de(v_texto)) as nombre
  join user_profiles u on lower(u.username) = nombre
  where u.id is distinct from new.author_id
    and coalesce(u.is_banned, false) = false;

  foreach v_id in array v_mencionados loop
    perform enqueue_email(
      v_id,
      'forum_mention',
      v_nombre || ' te ha mencionado en «' || v_titulo || '»',
      v_vista,
      v_enlace,
      -- Clave propia, distinta de la de las respuestas: que te
      -- mencionen es lo bastante directo como para no quedarse
      -- tragado por el correo de "hay movimiento en ese tema".
      'foromen:' || new.thread_id::text
    );
  end loop;

  -- ── A quien se cita y a quien sigue el tema ──
  --
  -- El citado va aunque no siga el tema: es una respuesta a SU mensaje,
  -- igual que en las respuestas a comentarios de guías.
  --
  -- Quien abrió el tema no necesita caso aparte: el disparador
  -- trg_forum_suscribir_al_escribir ya le suscribió al escribir el
  -- primer mensaje.
  if new.reply_to_id is not null then
    select author_id into v_citado from forum_posts where id = new.reply_to_id;
  end if;

  for v_id in
    select u.id
    from user_profiles u
    where u.id is distinct from new.author_id
      and coalesce(u.is_banned, false) = false
      -- Ya avisado por mención: uno y no dos.
      and not (u.id = any (v_mencionados))
      and (
        u.id = v_citado
        or exists (
          select 1 from forum_subscriptions s
          where s.thread_id = new.thread_id and s.user_id = u.id
        )
      )
  loop
    perform enqueue_email(
      v_id,
      'forum_reply',
      v_nombre || ' ha respondido en «' || v_titulo || '»',
      v_vista,
      v_enlace,
      -- Diez respuestas seguidas en un tema animado son UN correo, no
      -- diez (enqueue_email agrupa por esta clave y además espera 30
      -- minutos desde el último enviado).
      'foro:' || new.thread_id::text
    );
  end loop;

  return new;
end $$;

-- Igual que las otras: SECURITY DEFINER y expuesta por PostgREST sería
-- una puerta para mandar correo a quien fuera. Los disparadores siguen
-- funcionando porque los invoca el motor, que no mira el permiso EXECUTE
-- de quien hace el INSERT.
revoke all on function public.on_forum_post_email() from public;
revoke all on function public.on_forum_post_email() from anon, authenticated;

drop trigger if exists forum_post_email on public.forum_posts;
create trigger forum_post_email
  after insert on public.forum_posts
  for each row execute function public.on_forum_post_email();

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- El disparador está puesto.
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_name = 'forum_post_email';

-- Las menciones se sacan bien. Lo esperado, en orden:
--   {jesus}   {}   {jesus,misty}   {}
select menciones_de('hola @jesus que tal')            as una,
       menciones_de('escribe a hola@pokedoc.es')      as un_correo_no_cuenta,
       menciones_de('@jesus @misty a ver')            as dos,
       menciones_de('sin nadie a quien llamar')       as ninguna;

-- Y que nadie de fuera pueda llamar a la función del disparador: las
-- tres columnas tienen que salir en `false`.
select p.proname as funcion,
       has_function_privilege('public', p.oid, 'execute') as puede_public,
       has_function_privilege('anon', p.oid, 'execute') as puede_anon,
       has_function_privilege('authenticated', p.oid, 'execute') as puede_logueado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'on_forum_post_email';
