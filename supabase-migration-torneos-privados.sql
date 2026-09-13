-- Torneos privados, con código (tanda 292).
--
-- Lo pidió PINGU: hay gente que quiere montar un torneo sin que salga
-- en la lista, y que solo entre quien tenga el código.
--
-- ── QUIÉN DECIDE ──
--
-- La POLÍTICA, no el JavaScript. Está dicho en CLAUDE.md y aquí se ve
-- por qué: si esto fuese un `if` en el cliente, la respuesta de la API
-- llegaría igual y el torneo «privado» lo leería cualquiera abriendo las
-- herramientas del navegador. Un torneo privado es invisible DE VERDAD
-- para quien no está dentro.
--
-- Lo ven: su organizador, los admins del sitio, y quien ya está
-- inscrito. Nadie más — ni en la lista, ni por su enlace, ni por la API.
--
-- Como no se puede leer la fila, tampoco se puede uno inscribir por el
-- camino normal (que pide el id del torneo, y no hay forma de saberlo).
-- De ahí `torneos_entrar_con_codigo`, que va por el slug del enlace.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera.

alter table public.tournaments
  add column if not exists is_private boolean not null default false,
  add column if not exists join_code text;

comment on column public.tournaments.is_private is
  'Privado: no sale en la lista y solo lo ven su organizador, los admins y los inscritos.';
comment on column public.tournaments.join_code is
  'Código para entrar a un torneo privado. Se compara sin distinguir mayúsculas ni espacios.';

-- ── ¿Estoy inscrito en este torneo? ──
--
-- Va en una función SECURITY DEFINER a propósito. Metida a pelo en la
-- política de `tournaments`, la consulta a `tournament_registrations`
-- dispararía la política de ESA tabla, que a su vez mira `tournaments`:
-- recursión infinita y las dos tablas dejarían de leerse.
create or replace function public.torneos_estoy_inscrito(p_torneo uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from tournament_registrations
    where tournament_id = p_torneo and user_id = auth.uid()
  );
$$;

revoke all on function public.torneos_estoy_inscrito(uuid) from public;
grant execute on function public.torneos_estoy_inscrito(uuid) to anon, authenticated;

-- ── La política de lectura, con el candado de lo privado ──
--
-- Lo de antes se conserva tal cual (borradores solo para su organizador,
-- y el resto visible hasta sin cuenta, que es lo que hace que un enlace
-- compartido valga algo). Lo único que se añade es la condición de lo
-- privado.
drop policy if exists torneos_leer on public.tournaments;
create policy torneos_leer on public.tournaments for select
  using (
    (status <> 'draft' or admin_id = auth.uid() or torneos_soy_admin())
    and (
      not coalesce(is_private, false)
      or admin_id = auth.uid()
      or torneos_soy_admin()
      or torneos_estoy_inscrito(id)
    )
  );

-- ── Entrar a un torneo privado con el código ──
--
-- Hace de puerta: comprueba el código, y si encaja inscribe. A partir de
-- ahí la política ya deja ver el torneo, porque estás dentro.
--
-- Un torneo PÚBLICO también entra por aquí sin código, para que el
-- cliente pueda usar un solo camino cuando solo tiene el slug.
create or replace function public.torneos_entrar_con_codigo(
  p_slug text, p_codigo text, p_tcg_live text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_t tournaments%rowtype;
  v_ocupadas int;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para entrar al torneo.'; end if;
  if coalesce(trim(p_tcg_live), '') = '' then raise exception 'Di tu usuario de TCG Live.'; end if;

  select * into v_t from tournaments where slug = p_slug for update;
  -- A propósito el mismo mensaje que si no existiera: decir «existe pero
  -- el código está mal» ya confirma que ese torneo está ahí, que es
  -- justo lo que un torneo privado no quiere contar.
  if not found then raise exception 'Torneo no encontrado o código incorrecto.'; end if;

  if coalesce(v_t.is_private, false) then
    if coalesce(trim(v_t.join_code), '') = '' then
      raise exception 'Este torneo privado no tiene código: pídeselo a quien lo organiza.';
    end if;
    -- Sin distinguir mayúsculas ni espacios de los lados: un código se
    -- copia y se pega, y se pega mal.
    if lower(trim(coalesce(p_codigo, ''))) <> lower(trim(v_t.join_code)) then
      raise exception 'Torneo no encontrado o código incorrecto.';
    end if;
  end if;

  if v_t.status <> 'registration_open' then
    raise exception 'Las inscripciones no están abiertas.';
  end if;
  if exists (select 1 from tournament_registrations where tournament_id = v_t.id and user_id = auth.uid()) then
    raise exception 'Ya estás inscrito en este torneo.';
  end if;
  select count(*) into v_ocupadas
    from tournament_registrations
    where tournament_id = v_t.id and status = 'active';
  if v_t.max_players is not null and v_ocupadas >= v_t.max_players then
    raise exception 'Torneo lleno.';
  end if;

  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username)
    values (v_t.id, auth.uid(), 'active', trim(p_tcg_live))
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.torneos_entrar_con_codigo(text, text, text) from public;
grant execute on function public.torneos_entrar_con_codigo(text, text, text) to authenticated;

-- ── Por qué `join_code` NO se esconde columna a columna ──
--
-- La tentación era quitarle el select de esa columna a anon y a
-- authenticated, como se hizo con `tournament_registrations` en la
-- apertura. Aquí sería un ERROR GORDO, por dos motivos:
--
--   1. En Postgres, un `select *` de un rol que no tiene permiso sobre
--      UNA columna no devuelve esa columna vacía: falla la consulta
--      entera. Y el cliente pide `tournaments` con `*` en varios sitios,
--      así que la sección de torneos dejaría de cargar para todo el
--      mundo. Es exactamente la trampa que ya vigila test-torneos-21.
--   2. No protege de nada. El código solo importa en un torneo PRIVADO,
--      y la fila de un torneo privado solo la puede leer quien ya está
--      dentro (o quien lo organiza). A quien ya está dentro, el código
--      no le abre ninguna puerta que no tenga abierta.

create index if not exists tournaments_privados on public.tournaments (is_private) where is_private;

notify pgrst, 'reload schema';
