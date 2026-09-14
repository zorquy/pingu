-- La cola de espera vuelve a funcionar (tanda 293).
--
-- ── EL FALLO ──
--
-- Desde la apertura (tanda 252), `tournament_registrations` NO tiene
-- política de INSERT para nadie: la única puerta es la RPC
-- `torneos_inscribirse`, que es SECURITY DEFINER.
--
-- Pero esa RPC no sabe de cola de espera, así que el cliente, para
-- apuntar a alguien a la cola de un torneo lleno, escribía A PELO en la
-- tabla. Y ahí está lo malo: un INSERT que la política rechaza NO DA
-- ERROR. No toca nada y vuelve como si todo hubiera ido bien.
--
-- O sea: se llena un torneo, alguien le da a apuntarse a la cola, la web
-- le dice que sí, y no se ha apuntado nadie. Sin rastro.
--
-- ── EL ARREGLO ──
--
-- La RPC aprende la cola. Y la vieja se QUITA con un drop explícito: con
-- el parámetro nuevo teniendo valor por defecto, dejarla al lado haría
-- que una llamada de dos argumentos encajara en las dos y Postgres
-- respondiera «function is not unique» — rompiendo TODAS las
-- inscripciones. (Es la misma trampa de la migración del BO3.)
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera.

drop function if exists public.torneos_inscribirse(uuid, text);

create or replace function public.torneos_inscribirse(
  p_torneo uuid, p_tcg_live text, p_cola boolean default false
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_torneo tournaments%rowtype;
  v_ocupadas int;
  v_lleno boolean;
  v_estado text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribirte.'; end if;
  if coalesce(trim(p_tcg_live), '') = '' then raise exception 'Di tu usuario de TCG Live.'; end if;

  -- El lock de fila serializa el recuento: dos inscripciones a la vez
  -- ya no pueden rebasar las plazas.
  select * into v_torneo from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_torneo.status <> 'registration_open' then
    raise exception 'Las inscripciones no están abiertas.';
  end if;
  if exists (select 1 from tournament_registrations where tournament_id = p_torneo and user_id = auth.uid()) then
    raise exception 'Ya estás inscrito en este torneo.';
  end if;

  select count(*) into v_ocupadas
    from tournament_registrations
    where tournament_id = p_torneo and status = 'active';
  -- max_players NULL = aforo sin límite (tanda 229): no hay cupo que
  -- comprobar. El IS NOT NULL va explícito, no fiado de que NULL >= n
  -- «ya dé falso»: la intención tiene que leerse.
  v_lleno := v_torneo.max_players is not null and v_ocupadas >= v_torneo.max_players;

  -- A la cola se va por dos caminos: porque la persona lo elige, o
  -- porque el torneo se llenó mientras rellenaba el formulario. En el
  -- segundo no se la echa — para eso está la cola.
  if p_cola or v_lleno then
    v_estado := 'waitlisted';
  else
    v_estado := 'active';
  end if;

  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username)
    values (p_torneo, auth.uid(), v_estado, trim(p_tcg_live))
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.torneos_inscribirse(uuid, text, boolean) from public;
grant execute on function public.torneos_inscribirse(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
