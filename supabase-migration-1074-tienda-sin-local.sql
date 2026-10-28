-- Tanda 1074 — Una tienda no tiene por qué tener local.
--
-- PINGU: «no hace falta que sea una tienda física… yo soy un particular,
-- pero tengo un montón de cartas y me dedico a la compraventa. Ese es el
-- enfoque». Así que la ciudad deja de ser obligatoria al pedir acceso (la
-- dirección y el horario ya eran opcionales), y la web y el Instagram van
-- cada uno en su campo («la web por un lado y el Instagram, por si tienen»).
--
-- El Instagram se guarda como el usuario a secas, sin @ ni enlace: la web
-- lo pinta como «@usuario» y enlaza a su perfil.
--
-- Se puede ejecutar más de una vez.

-- ── 1. El Instagram de una tienda ──
alter table public.tiendas add column if not exists instagram text;
alter table public.tiendas drop constraint if exists tiendas_instagram_forma;
alter table public.tiendas add constraint tiendas_instagram_forma
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
grant update (instagram) on public.tiendas to authenticated;

-- Lo que se escribió antes en «Web o Instagram» y era un Instagram, a su sitio.
update public.tiendas
  set instagram = substring(btrim(web) from '(?i)^(?:https?://)?(?:www\.)?(?:instagram\.com/|@)([A-Za-z0-9._]{1,30})/?(?:\?.*)?$'),
      web = null
  where instagram is null
    and btrim(coalesce(web, '')) ~* '^((https?://)?(www\.)?instagram\.com/|@)[A-Za-z0-9._]{1,30}/?(\?.*)?$';

-- ── 2. La solicitud: ciudad opcional y su Instagram ──
alter table public.tienda_solicitudes alter column ciudad drop not null;
alter table public.tienda_solicitudes add column if not exists instagram text;
alter table public.tienda_solicitudes drop constraint if exists tienda_solicitudes_largos;
alter table public.tienda_solicitudes add constraint tienda_solicitudes_largos check (
  char_length(nombre) between 2 and 80
  and (ciudad is null or char_length(ciudad) between 2 and 80)
  and char_length(email) between 5 and 160
  and (contacto is null or char_length(contacto) <= 80)
  and (web is null or char_length(web) <= 160)
  and (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$')
);

-- Y en las solicitudes que ya había, igual (el alta copia el de la solicitud).
update public.tienda_solicitudes
  set instagram = substring(btrim(web) from '(?i)^(?:https?://)?(?:www\.)?(?:instagram\.com/|@)([A-Za-z0-9._]{1,30})/?(?:\?.*)?$'),
      web = null
  where instagram is null
    and btrim(coalesce(web, '')) ~* '^((https?://)?(www\.)?instagram\.com/|@)[A-Za-z0-9._]{1,30}/?(\?.*)?$';

-- El usuario de Instagram de lo que alguien escribe (@tienda, instagram.com/
-- tienda, con o sin https): null si no hay nada; un error si no lo es. La
-- misma regla que `instagramDe` (js/tiendas-puro.js).
create or replace function public.tienda_instagram(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := btrim(coalesce(p, ''));
  u text;
begin
  if v = '' then
    return null;
  end if;
  u := substring(v from '(?i)^(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:\?.*)?$');
  if u is null then
    u := substring(v from '^@?([A-Za-z0-9._]{1,30})$');
  end if;
  if u is null then
    raise exception 'Ese Instagram no parece un usuario: escribe solo tu @.' using errcode = '22023';
  end if;
  return u;
end;
$$;

-- `tienda_pedir` gana `p_instagram`: con otra firma es otra función, así que
-- la vieja se quita (dos con el mismo nombre confunden a PostgREST).
drop function if exists public.tienda_pedir(text, text, text, text, text, text);
create or replace function public.tienda_pedir(
  p_nombre text, p_ciudad text, p_email text,
  p_contacto text default null, p_web text default null, p_tamano text default null,
  p_instagram text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_ciudad text := nullif(btrim(coalesce(p_ciudad, '')), '');
  v_ig text := public.tienda_instagram(p_instagram);
  v_id uuid;
begin
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de la tienda.' using errcode = '22023';
  end if;
  if v_ciudad is not null and (char_length(v_ciudad) < 2 or char_length(v_ciudad) > 80) then
    raise exception 'Escribe la ciudad entera, o déjala vacía.' using errcode = '22023';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 160 then
    raise exception 'Revisa que el email sea correcto.' using errcode = '22023';
  end if;

  -- Ya hay una viva con ese email: no se repite.
  if exists (
    select 1 from tienda_solicitudes
    where lower(email) = v_email and estado in ('pendiente', 'aceptada', 'usada')
  ) then
    return jsonb_build_object('ok', true);
  end if;

  if (select count(*) from tienda_solicitudes where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Ahora mismo llegan demasiadas solicitudes. Prueba dentro de un rato.' using errcode = '54000';
  end if;

  insert into tienda_solicitudes (nombre, ciudad, email, contacto, web, tamano, instagram)
  values (
    v_nombre, v_ciudad, v_email,
    nullif(left(btrim(coalesce(p_contacto, '')), 80), ''),
    nullif(left(btrim(coalesce(p_web, '')), 160), ''),
    case when p_tamano in ('poca', 'media', 'mucha') then p_tamano end,
    v_ig
  )
  returning id into v_id;

  -- La campanita del equipo.
  insert into user_notifications (recipient_id, type, title, body, link)
  select id, 'tienda_solicitud', 'Una tienda pide acceso',
    left(v_nombre || coalesce(' · ' || v_ciudad, ''), 200), '/admin/?ver=tiendas'
  from user_profiles where is_admin = true;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.tienda_pedir(text, text, text, text, text, text, text) from public;
grant execute on function public.tienda_pedir(text, text, text, text, text, text, text) to anon, authenticated;

-- ── 3. La invitación devuelve también el Instagram ──
create or replace function public.tienda_invitacion(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v tienda_solicitudes%rowtype;
begin
  select * into v from tienda_solicitudes where token = p_token;
  if not found then
    return jsonb_build_object('valida', false, 'motivo', 'no_existe');
  end if;
  if v.estado = 'usada' or v.usada_el is not null then
    return jsonb_build_object('valida', false, 'motivo', 'usada');
  end if;
  if v.estado <> 'aceptada' then
    return jsonb_build_object('valida', false, 'motivo', 'no_existe');
  end if;
  if v.caduca < now() then
    return jsonb_build_object('valida', false, 'motivo', 'caducada');
  end if;
  return jsonb_build_object(
    'valida', true, 'nombre', v.nombre, 'ciudad', v.ciudad, 'email', v.email,
    'web', v.web, 'instagram', v.instagram, 'caduca', v.caduca
  );
end;
$$;

-- ── 4. El alta copia el Instagram de la solicitud ──
-- La misma firma: lo que la tienda cambie en el formulario del alta lo
-- escribe la web después (es su fila, y `instagram` se puede actualizar).
create or replace function public.tienda_alta(
  p_token uuid, p_username text, p_nombre text,
  p_ciudad text default null, p_direccion text default null, p_web text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
  v tienda_solicitudes%rowtype;
  v_user text := lower(btrim(coalesce(p_username, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_perfil user_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Entra con la cuenta de la tienda para terminar el alta.' using errcode = '42501';
  end if;
  select * into v from tienda_solicitudes where token = p_token for update;
  if not found or v.estado <> 'aceptada' or v.usada_el is not null then
    raise exception 'Esta invitación ya no vale. Pide otra desde /tiendas.' using errcode = '22023';
  end if;
  if v.caduca < now() then
    raise exception 'Esta invitación ha caducado. Escríbenos y te mandamos otra.' using errcode = '22023';
  end if;
  if lower(v.email) <> v_email then
    raise exception 'Has entrado con otro email. La invitación es para %.', v.email using errcode = '42501';
  end if;
  if v_user !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Tu @ solo puede llevar letras, números y guiones (de 3 a 40).' using errcode = '22023';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de la tienda.' using errcode = '22023';
  end if;
  if exists (select 1 from user_profiles where lower(username) = v_user and id <> v_uid) then
    raise exception 'Ese @ ya lo tiene otra cuenta. Prueba con otro.' using errcode = '23505';
  end if;

  select * into v_perfil from user_profiles where id = v_uid;
  if found and v_perfil.tipo = 'persona' and v_perfil.onboarding_completed is true then
    raise exception 'Este email ya tiene una cuenta personal en PokeDoc. Pide la tienda con el email de la tienda.' using errcode = '22023';
  end if;

  insert into user_profiles (id, username, display_name, tipo, onboarding_completed)
  values (v_uid, v_user, v_nombre, 'tienda', true)
  on conflict (id) do update
    set username = excluded.username, display_name = excluded.display_name,
        tipo = 'tienda', onboarding_completed = true;

  -- La ciudad que se deja vacía en el alta se queda vacía (1074): es
  -- opcional, y la de la solicitud solo rellena el formulario.
  insert into tiendas (user_id, ciudad, direccion, web, instagram)
  values (
    v_uid,
    nullif(left(btrim(coalesce(p_ciudad, '')), 80), ''),
    nullif(left(btrim(coalesce(p_direccion, '')), 160), ''),
    nullif(left(btrim(coalesce(p_web, '')), 160), ''),
    v.instagram
  )
  on conflict (user_id) do update
    set ciudad = excluded.ciudad, direccion = excluded.direccion, web = excluded.web,
        instagram = excluded.instagram, updated_at = now();

  update tienda_solicitudes set estado = 'usada', usada_el = now(), usada_por = v_uid where id = v.id;

  return jsonb_build_object('ok', true, 'username', v_user);
end;
$$;

revoke all on function public.tienda_alta(uuid, text, text, text, text, text) from public;
grant execute on function public.tienda_alta(uuid, text, text, text, text, text) to authenticated;
revoke all on function public.tienda_invitacion(uuid) from public;
grant execute on function public.tienda_invitacion(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
