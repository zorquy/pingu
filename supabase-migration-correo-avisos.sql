-- ============================================================
-- Avisos por correo: mensajes privados y respuestas a comentarios.
--
-- QUÉ HACE
--   Cuando alguien te escribe un mensaje privado, o responde a un
--   comentario tuyo en una guía, se encola un correo. La función
--   programada de Netlify (netlify/functions/send-emails.mjs) vacía esa
--   cola cada pocos minutos y lo envía.
--
-- POR QUÉ UNA COLA Y NO ENVIAR DESDE EL NAVEGADOR
--   Las direcciones de correo viven en `auth.users`, que el navegador no
--   puede leer (ni debe). Y una cola además permite reintentar cuando el
--   proveedor falla, agrupar y dejar rastro de lo enviado.
--
-- POR QUÉ LOS DISPARADORES NO VAN SOBRE `user_notifications`
--   Esa tabla deja insertar a cualquiera una fila para cualquiera, con
--   el título y el cuerpo que quiera:
--
--     create policy "user_notifications_insert" on user_notifications
--       for insert with check (auth.uid() is not null and recipient_id <> auth.uid());
--
--   Para la campanita eso es una molestia. Para el correo sería que
--   cualquier miembro pudiera hacer que pokedoc.es mande un correo con
--   texto arbitrario a cualquier otro: phishing con tu dominio y camino
--   directo a que te marquen como spam.
--
--   Por eso los disparadores van sobre las tablas de origen, donde la
--   RLS ya demuestra quién escribió qué: `private_messages` (obliga a
--   ser participante de la conversación) y `guide_comments` (obliga a
--   ser el autor). El destinatario y el texto se DEDUCEN ahí; no se
--   aceptan del cliente.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- ────────────────────────────────────────────────────────────
-- 1. Preferencias de correo, separadas de las de la campanita
-- ────────────────────────────────────────────────────────────
--
-- Va en una columna propia y no reutilizando `notification_prefs_disabled`
-- a propósito: "quiero el aviso en la campanita pero NO en el correo" es
-- la preferencia más común, y con un solo array no se puede expresar.
alter table user_profiles
  add column if not exists notification_email_disabled text[] not null default '{}';

-- Token para darse de baja desde el propio correo sin iniciar sesión.
-- Se añade sin NOT NULL y se rellena después, para que las filas que ya
-- existen reciban cada una el suyo.
alter table user_profiles
  add column if not exists email_unsubscribe_token uuid;

update user_profiles
set email_unsubscribe_token = gen_random_uuid()
where email_unsubscribe_token is null;

alter table user_profiles
  alter column email_unsubscribe_token set default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'user_profiles'
      and column_name = 'email_unsubscribe_token'
      and is_nullable = 'YES'
  ) then
    alter table user_profiles alter column email_unsubscribe_token set not null;
  end if;
end $$;

create unique index if not exists user_profiles_unsubscribe_token_idx
  on user_profiles (email_unsubscribe_token);


-- ────────────────────────────────────────────────────────────
-- 2. La cola
-- ────────────────────────────────────────────────────────────
--
-- NO se guarda aquí la dirección de correo: solo el id de la persona. La
-- dirección se resuelve al enviar, con la clave de servicio. Así no hay
-- una segunda copia de un dato personal que luego haya que acordarse de
-- borrar — y al borrarse la cuenta, estas filas se van con ella.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  -- Con qué se construye el correo. Texto ya limpio y acotado, nunca
  -- HTML: lo pinta la función de envío, escapando.
  subject text not null,
  preview text,
  link text,
  -- Para agrupar: dos mensajes de la misma conversación no generan dos
  -- correos si el primero todavía no ha salido.
  thread_key text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- La función de envío pide "lo pendiente, lo más viejo primero".
create index if not exists email_outbox_pending_idx
  on public.email_outbox (created_at)
  where status = 'pending';

create index if not exists email_outbox_recipient_idx
  on public.email_outbox (recipient_id, created_at desc);

-- RLS activada y SIN NINGUNA POLÍTICA: eso deniega todo a `anon` y a
-- `authenticated`. Solo la clave de servicio (que se salta la RLS) puede
-- leerla. Es deliberado — nadie desde el navegador tiene por qué ver la
-- cola de correo de nadie, ni siquiera la suya.
alter table public.email_outbox enable row level security;


-- ────────────────────────────────────────────────────────────
-- 3. Encolar, con las comprobaciones en un solo sitio
-- ────────────────────────────────────────────────────────────

create or replace function public.enqueue_email(
  p_recipient uuid,
  p_type text,
  p_subject text,
  p_preview text,
  p_link text,
  p_thread_key text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desactivados text[];
begin
  if p_recipient is null then
    return;
  end if;

  select notification_email_disabled into v_desactivados
  from user_profiles where id = p_recipient;

  -- Si no hay perfil, no se encola: sin perfil no hay forma de saber si
  -- esa persona quiere correo, y el silencio es la opción segura.
  if v_desactivados is null then
    return;
  end if;

  if p_type = any (v_desactivados) then
    return;
  end if;

  -- Agrupación. Dos casos, y los dos importan:
  --
  --   a) Ya hay un correo PENDIENTE del mismo hilo. Diez mensajes
  --      seguidos en la misma conversación deben ser un correo, no diez.
  --   b) Ya se ENVIÓ uno del mismo hilo hace menos de 30 minutos. Si no,
  --      una conversación en directo se convierte en un correo por cada
  --      frase, que es exactamente lo que hace que la gente se dé de baja.
  if p_thread_key is not null and exists (
    select 1 from email_outbox
    where recipient_id = p_recipient
      and thread_key = p_thread_key
      and (
        status = 'pending'
        or (status = 'sent' and sent_at > now() - interval '30 minutes')
      )
  ) then
    return;
  end if;

  insert into email_outbox (recipient_id, type, subject, preview, link, thread_key)
  values (p_recipient, p_type, p_subject, p_preview, p_link, p_thread_key);
end $$;

-- ¡IMPRESCINDIBLE! En PostgreSQL una función nueva es ejecutable por
-- `public` por defecto. Sin esto, `enqueue_email` es SECURITY DEFINER y
-- está expuesta por PostgREST como RPC: cualquier persona logueada podría
-- llamarla y mandar un correo desde pokedoc.es, a quien quisiera, con el
-- asunto y el texto que le diera la gana — exactamente el agujero que
-- evitamos al no colgar los disparadores de `user_notifications`.
--
-- Denegar la LECTURA de la tabla no bastaba: la puerta de atrás era la
-- función, no la tabla. Comprobado ejecutándolo: antes de estas líneas,
-- `set role authenticated; select enqueue_email(...)` insertaba la fila.
--
-- Los disparadores siguen funcionando: una función de disparador la
-- invoca el propio motor y no comprueba el permiso EXECUTE de quien hace
-- el INSERT.
revoke all on function public.enqueue_email(uuid, text, text, text, text, text) from public;
revoke all on function public.enqueue_email(uuid, text, text, text, text, text) from anon, authenticated;


-- Recorta un texto para la vista previa del correo sin cortar a mitad de
-- palabra y sin dejar pasar saltos de línea (que en una cabecera de
-- asunto permitirían inyectar cabeceras).
create or replace function public.email_preview(p_texto text, p_largo int default 140)
returns text
language sql
immutable
as $$
  select case
    when p_texto is null then null
    when length(regexp_replace(p_texto, '\s+', ' ', 'g')) <= p_largo
      then trim(regexp_replace(p_texto, '\s+', ' ', 'g'))
    else trim(regexp_replace(
      left(regexp_replace(p_texto, '\s+', ' ', 'g'), p_largo),
      '\s\S*$', ''
    )) || '…'
  end
$$;


-- ────────────────────────────────────────────────────────────
-- 4. Disparador: mensaje privado nuevo
-- ────────────────────────────────────────────────────────────
--
-- El destinatario es el OTRO participante de la conversación, leído de
-- la propia tabla. No hay forma de que quien escribe elija a quién le
-- llega el correo.
create or replace function public.on_private_message_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destinatario uuid;
  v_nombre text;
begin
  select cp.user_id into v_destinatario
  from conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id
  limit 1;

  if v_destinatario is null then
    return new;
  end if;

  -- email_preview colapsa cualquier espacio en blanco, saltos de línea
  -- incluidos. Va aquí porque este nombre acaba en la CABECERA Subject
  -- del correo, y un nombre con un \n permitiría inyectar cabeceras.
  select email_preview(coalesce(display_name, username, 'Alguien'), 60) into v_nombre
  from user_profiles where id = new.sender_id;

  perform enqueue_email(
    v_destinatario,
    'private_message',
    coalesce(v_nombre, 'Alguien') || ' te ha enviado un mensaje',
    email_preview(new.body),
    '/mensajes.html?c=' || new.conversation_id::text,
    'dm:' || new.conversation_id::text
  );

  return new;
end $$;

revoke all on function public.on_private_message_email() from public;
revoke all on function public.on_private_message_email() from anon, authenticated;

drop trigger if exists private_message_email on public.private_messages;
create trigger private_message_email
  after insert on public.private_messages
  for each row execute function public.on_private_message_email();


-- ────────────────────────────────────────────────────────────
-- 5. Disparador: respuesta a un comentario
-- ────────────────────────────────────────────────────────────
--
-- Solo respuestas (`reply_to_id not null`). Un comentario suelto en una
-- guía no manda correo: eso es de los que llenan la bandeja sin ser
-- conversación. El destinatario sale del comentario padre.
create or replace function public.on_comment_reply_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destinatario uuid;
  v_nombre text;
  v_titulo text;
  v_slug text;
begin
  if new.reply_to_id is null then
    return new;
  end if;

  select author_id into v_destinatario
  from guide_comments where id = new.reply_to_id;

  -- Nadie se avisa a sí mismo por responderse.
  if v_destinatario is null or v_destinatario = new.author_id then
    return new;
  end if;

  -- email_preview colapsa cualquier espacio en blanco, saltos de línea
  -- incluidos. Va aquí porque este nombre acaba en la CABECERA Subject
  -- del correo, y un nombre con un \n permitiría inyectar cabeceras.
  select email_preview(coalesce(display_name, username, 'Alguien'), 60) into v_nombre
  from user_profiles where id = new.author_id;

  select g.title, g.slug into v_titulo, v_slug
  from guides g where g.id = new.guide_id;

  perform enqueue_email(
    v_destinatario,
    'comment_reply',
    coalesce(v_nombre, 'Alguien') || ' ha respondido a tu comentario',
    email_preview(new.body),
    '/guia.html?slug=' || coalesce(v_slug, ''),
    'reply:' || new.reply_to_id::text
  );

  return new;
end $$;

revoke all on function public.on_comment_reply_email() from public;
revoke all on function public.on_comment_reply_email() from anon, authenticated;

drop trigger if exists comment_reply_email on public.guide_comments;
create trigger comment_reply_email
  after insert on public.guide_comments
  for each row execute function public.on_comment_reply_email();

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Las dos columnas nuevas del perfil.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'user_profiles'
  and column_name in ('notification_email_disabled', 'email_unsubscribe_token')
order by column_name;

-- Nadie debe tener el token a null ni repetido.
select count(*) filter (where email_unsubscribe_token is null) as sin_token,
       count(*) - count(distinct email_unsubscribe_token) as repetidos
from user_profiles;

-- Los dos disparadores.
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_name in ('private_message_email', 'comment_reply_email')
order by trigger_name;

-- La cola debe tener RLS activada y CERO políticas (solo la clave de
-- servicio entra). Si `politicas` no sale 0, alguien le ha puesto una y
-- la cola sería legible desde el navegador.
select c.relrowsecurity as rls_activada,
       (select count(*) from pg_policies where tablename = 'email_outbox') as politicas
from pg_class c where c.relname = 'email_outbox';

-- Y que NADIE de fuera pueda llamar a las funciones. Las tres columnas
-- de permiso tienen que salir en `false`. Si alguna sale `true`, un
-- usuario cualquiera puede hacer que la web le mande un correo a quien
-- quiera con el texto que quiera.
select p.proname as funcion,
       has_function_privilege('public', p.oid, 'execute') as puede_public,
       has_function_privilege('anon', p.oid, 'execute') as puede_anon,
       has_function_privilege('authenticated', p.oid, 'execute') as puede_logueado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('enqueue_email', 'on_private_message_email', 'on_comment_reply_email')
order by p.proname;
