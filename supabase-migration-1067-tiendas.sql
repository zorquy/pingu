-- ============================================================
-- Tanda 1067: la cuenta de tienda, solo por invitación.
--
-- PINGU eligió lo recomendado de «Portal de tiendas»: una tienda es una
-- cuenta de PokeDoc de tipo «tienda» (su @, su perfil, sus mensajes), y
-- solo se crea con una invitación. El login de siempre no cambia:
--
--   1. Una tienda pide acceso en /tiendas (sin cuenta): `tienda_pedir`.
--   2. El equipo lo ve en /admin → Tiendas (y en la campanita) y acepta o
--      rechaza: `tienda_decidir`. Aceptar crea la invitación (un uso,
--      14 días, atada al email de la solicitud) y la función de Netlify
--      `tienda-decidir` manda el correo con el enlace.
--   3. El enlace lleva a /alta-tienda: `tienda_invitacion` dice si vale, y
--      `tienda_alta` convierte la cuenta en tienda si el email de quien
--      entra es el de la invitación.
--
-- Quien abre la puerta es la BASE: el tipo de cuenta no se lo puede poner
-- nadie a sí mismo (disparador `tienda_guarda_tipo`), y las tablas de
-- solicitudes solo las lee el equipo.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- ============================================================

-- ── 1. El tipo de cuenta ──
alter table public.user_profiles add column if not exists tipo text not null default 'persona';
alter table public.user_profiles drop constraint if exists user_profiles_tipo_valido;
alter table public.user_profiles add constraint user_profiles_tipo_valido check (tipo in ('persona', 'tienda'));

-- Nadie se pone «tienda» a sí mismo (ni se lo quita): solo las funciones de
-- la casa (`security definer`, el SQL Editor) y el equipo. Va en su propio
-- disparador para no reescribir `perfil_guarda_columnas`.
create or replace function public.tienda_guarda_tipo()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if coalesce(public.is_admin(), false) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tipo := 'persona';
  else
    new.tipo := old.tipo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tienda_guarda_tipo on public.user_profiles;
create trigger trg_tienda_guarda_tipo
  before insert or update on public.user_profiles
  for each row execute function public.tienda_guarda_tipo();

-- ── 2. Los datos de la tienda ──
-- Uno a uno con el perfil. Lo que sale en su perfil (ciudad, dirección,
-- horario, web) es público; lo escribe la propia tienda.
create table if not exists public.tiendas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciudad text,
  direccion text,
  horario text,
  web text,
  -- Si el escaparate enseña precios o «Pregunta en la tienda» (lo usa la 1069).
  precio_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiendas_ciudad_largo check (ciudad is null or char_length(ciudad) <= 80),
  constraint tiendas_direccion_largo check (direccion is null or char_length(direccion) <= 160),
  constraint tiendas_horario_largo check (horario is null or char_length(horario) <= 120),
  constraint tiendas_web_largo check (web is null or char_length(web) <= 160)
);

alter table public.tiendas enable row level security;

drop policy if exists tiendas_se_ven on public.tiendas;
create policy tiendas_se_ven on public.tiendas for select using (true);

-- La fila la crea `tienda_alta`; la tienda solo cambia la suya.
drop policy if exists tiendas_cambia_la_suya on public.tiendas;
create policy tiendas_cambia_la_suya on public.tiendas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.tiendas to anon, authenticated;
grant update (ciudad, direccion, horario, web, precio_visible, updated_at) on public.tiendas to authenticated;

-- ── 3. Las solicitudes (y su invitación) ──
create table if not exists public.tienda_solicitudes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text not null,
  email text not null,
  contacto text,
  web text,
  tamano text,
  estado text not null default 'pendiente',
  decidio uuid references auth.users (id) on delete set null,
  decidida_el timestamptz,
  -- La invitación: nace al aceptar, sirve una vez y caduca.
  token uuid unique,
  caduca timestamptz,
  usada_el timestamptz,
  usada_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tienda_solicitudes_estado check (estado in ('pendiente', 'aceptada', 'rechazada', 'usada')),
  constraint tienda_solicitudes_tamano check (tamano is null or tamano in ('poca', 'media', 'mucha')),
  constraint tienda_solicitudes_largos check (
    char_length(nombre) between 2 and 80 and char_length(ciudad) between 2 and 80
    and char_length(email) between 5 and 160
    and (contacto is null or char_length(contacto) <= 80)
    and (web is null or char_length(web) <= 160)
  )
);

create index if not exists tienda_solicitudes_email_idx on public.tienda_solicitudes (lower(email));
create index if not exists tienda_solicitudes_creada_idx on public.tienda_solicitudes (created_at desc);

-- Solo el equipo la lee; nadie escribe a pelo (todo va por las funciones).
alter table public.tienda_solicitudes enable row level security;
drop policy if exists tienda_solicitudes_equipo on public.tienda_solicitudes;
create policy tienda_solicitudes_equipo on public.tienda_solicitudes for select to authenticated
  using (coalesce(public.is_admin(), false));
grant select on public.tienda_solicitudes to authenticated;

-- ── 4. Pedir acceso (desde /tiendas, sin cuenta) ──
--
-- Contesta siempre lo mismo a una solicitud repetida: decir «ese email ya
-- está aceptado» a quien escribe un email cualquiera sería contar algo que
-- no es suyo. Y un tope por hora para todo el mundo, que el formulario está
-- abierto: 30 en una hora no las manda una tienda, las manda un bot.
create or replace function public.tienda_pedir(
  p_nombre text, p_ciudad text, p_email text,
  p_contacto text default null, p_web text default null, p_tamano text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_ciudad text := btrim(coalesce(p_ciudad, ''));
  v_id uuid;
begin
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de la tienda.' using errcode = '22023';
  end if;
  if char_length(v_ciudad) < 2 or char_length(v_ciudad) > 80 then
    raise exception 'Escribe la ciudad de la tienda.' using errcode = '22023';
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

  insert into tienda_solicitudes (nombre, ciudad, email, contacto, web, tamano)
  values (
    v_nombre, v_ciudad, v_email,
    nullif(left(btrim(coalesce(p_contacto, '')), 80), ''),
    nullif(left(btrim(coalesce(p_web, '')), 160), ''),
    case when p_tamano in ('poca', 'media', 'mucha') then p_tamano end
  )
  returning id into v_id;

  -- La campanita del equipo.
  insert into user_notifications (recipient_id, type, title, body, link)
  select id, 'tienda_solicitud', 'Una tienda pide acceso',
    left(v_nombre || ' · ' || v_ciudad, 200), '/admin/?ver=tiendas'
  from user_profiles where is_admin = true;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 5. Aceptar o rechazar (el equipo) ──
--
-- Aceptar crea la invitación; aceptar OTRA VEZ una aceptada sin usar la
-- renueva (token nuevo y otros 14 días): es el «Reenviar» de /admin. Devuelve
-- lo que hace falta para el correo; el correo lo manda `tienda-decidir`.
create or replace function public.tienda_decidir(p_id uuid, p_aceptar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v tienda_solicitudes%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo puede decidir las solicitudes de tienda.' using errcode = '42501';
  end if;
  select * into v from tienda_solicitudes where id = p_id for update;
  if not found then
    raise exception 'Esa solicitud no existe.' using errcode = 'P0002';
  end if;
  if v.estado = 'usada' then
    raise exception 'Esa tienda ya tiene su cuenta.' using errcode = '22023';
  end if;

  if p_aceptar then
    update tienda_solicitudes
      set estado = 'aceptada', token = gen_random_uuid(), caduca = now() + interval '14 days',
          decidio = auth.uid(), decidida_el = now()
      where id = p_id
      returning * into v;
  else
    update tienda_solicitudes
      set estado = 'rechazada', token = null, caduca = null, decidio = auth.uid(), decidida_el = now()
      where id = p_id
      returning * into v;
  end if;

  return jsonb_build_object(
    'id', v.id, 'estado', v.estado, 'nombre', v.nombre, 'email', v.email,
    'contacto', v.contacto, 'token', v.token, 'caduca', v.caduca
  );
end;
$$;

-- ── 6. ¿Vale esta invitación? (desde /alta-tienda, con o sin cuenta) ──
-- Solo con el token en la mano: sin él no se sabe ni que existe.
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
    'web', v.web, 'caduca', v.caduca
  );
end;
$$;

-- ── 7. Convertirse en tienda ──
--
-- Con sesión, y con el email de la invitación: copiar el enlace a otra
-- persona no sirve. Una cuenta que ya era de alguien (con su nombre puesto)
-- no se convierte: sería quitarle su perfil personal. Esa persona pide la
-- tienda con el email de la tienda.
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

  insert into tiendas (user_id, ciudad, direccion, web)
  values (
    v_uid,
    nullif(left(btrim(coalesce(p_ciudad, v.ciudad, '')), 80), ''),
    nullif(left(btrim(coalesce(p_direccion, '')), 160), ''),
    nullif(left(btrim(coalesce(p_web, v.web, '')), 160), '')
  )
  on conflict (user_id) do update
    set ciudad = excluded.ciudad, direccion = excluded.direccion, web = excluded.web, updated_at = now();

  update tienda_solicitudes set estado = 'usada', usada_el = now(), usada_por = v_uid where id = v.id;

  return jsonb_build_object('ok', true, 'username', v_user);
end;
$$;

revoke all on function public.tienda_pedir(text, text, text, text, text, text) from public;
grant execute on function public.tienda_pedir(text, text, text, text, text, text) to anon, authenticated;
revoke all on function public.tienda_decidir(uuid, boolean) from public;
grant execute on function public.tienda_decidir(uuid, boolean) to authenticated, service_role;
revoke all on function public.tienda_invitacion(uuid) from public;
grant execute on function public.tienda_invitacion(uuid) to anon, authenticated;
revoke all on function public.tienda_alta(uuid, text, text, text, text, text) from public;
grant execute on function public.tienda_alta(uuid, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
