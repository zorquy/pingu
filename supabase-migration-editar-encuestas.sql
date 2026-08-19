-- Editar (y quitar) la encuesta del propio tema
-- ============================================================
--
-- La migración de encuestas prohibía editar A PROPÓSITO: cambiarle el
-- texto a una opción ya votada convierte los votos en votos a otra cosa.
-- Pero la prohibición total tiene un coste real: quien crea una encuesta
-- marcando "se pueden marcar varias" sin querer, o con una opción mal
-- escrita, se queda con ella para siempre. Le pasó al admin el primer día.
--
-- La salida honrada es dejar editar SIN dejar mentir: si el cambio toca
-- las opciones o el modo de voto, los votos ya emitidos SE BORRAN y la
-- votación empieza de cero. Si solo se corrige la pregunta (una errata),
-- los votos se quedan. Así los votos siempre significan lo que quiso
-- decir quien los echó.
--
-- Va en una función security definer y no en políticas RLS porque borrar
-- los votos de otros no lo permite (ni debe permitirlo) ninguna política:
-- la función es el único camino, comprueba quién llama, y hace todo el
-- cambio de una pieza.
--
-- Necesita supabase-migration-encuestas-foro.sql.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

create or replace function public.forum_editar_encuesta(
  p_thread uuid,
  p_pregunta text,
  p_multiple boolean,
  -- Las opciones nuevas, en orden. NULL = quitar la encuesta entera.
  p_opciones text[]
)
returns integer -- cuántos votos se han borrado (0 si se conservan)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_autor uuid;
  v_de_antes text[];
  v_multiple_antes boolean;
  v_borrados integer := 0;
  v_opcion text;
  v_pos integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Entra con tu cuenta.';
  end if;
  if public.is_banned() or public.is_muted() then
    raise exception 'Tu cuenta no puede hacer cambios en el foro.';
  end if;

  select t.author_id into v_autor from public.forum_threads t where t.id = p_thread;
  if v_autor is null then
    raise exception 'Este tema no existe.';
  end if;
  if v_autor <> auth.uid() and not public.is_staff() then
    raise exception 'Solo quien abrió el tema (o el equipo) puede tocar su encuesta.';
  end if;

  select p.multiple into v_multiple_antes from public.forum_polls p where p.thread_id = p_thread;
  if v_multiple_antes is null then
    raise exception 'Este tema no tiene encuesta.';
  end if;

  -- Quitar la encuesta entera: opciones y votos se van en cascada.
  if p_opciones is null then
    select count(*) into v_borrados from public.forum_poll_votes v where v.thread_id = p_thread;
    delete from public.forum_polls where thread_id = p_thread;
    return v_borrados;
  end if;

  -- Las mismas reglas que al crearla (ver js/encuesta.js): aquí también,
  -- porque esta función es alcanzable llamando a la API sin pasar por la
  -- pantalla.
  if coalesce(trim(p_pregunta), '') = '' or length(p_pregunta) > 150 then
    raise exception 'La pregunta no puede estar vacía (ni pasar de 150 letras).';
  end if;
  if array_length(p_opciones, 1) < 2 or array_length(p_opciones, 1) > 8 then
    raise exception 'La encuesta necesita entre 2 y 8 opciones.';
  end if;
  foreach v_opcion in array p_opciones loop
    if coalesce(trim(v_opcion), '') = '' or length(v_opcion) > 80 then
      raise exception 'Hay una opción vacía o demasiado larga.';
    end if;
  end loop;
  if (select count(distinct lower(trim(o))) from unnest(p_opciones) o) <> array_length(p_opciones, 1) then
    raise exception 'Hay dos opciones repetidas.';
  end if;

  select array_agg(o.label order by o.order_pos)
    into v_de_antes
    from public.forum_poll_options o
   where o.thread_id = p_thread;

  -- ¿El cambio toca la estructura? Si las opciones y el modo quedan
  -- exactamente igual, es una corrección de la pregunta: los votos se
  -- conservan, porque siguen significando lo mismo.
  if v_de_antes is distinct from p_opciones or v_multiple_antes is distinct from p_multiple then
    -- Los votos se borran ANTES de tocar `multiple`: la clave ajena de
    -- los votos copia esa columna con ON UPDATE CASCADE, y pasar de
    -- "varias" a "una" con votos múltiples vivos chocaría con el índice
    -- único de un-voto-por-persona.
    select count(*) into v_borrados from public.forum_poll_votes v where v.thread_id = p_thread;
    delete from public.forum_poll_votes where thread_id = p_thread;
    delete from public.forum_poll_options where thread_id = p_thread;

    update public.forum_polls
       set question = trim(p_pregunta), multiple = p_multiple
     where thread_id = p_thread;

    foreach v_opcion in array p_opciones loop
      insert into public.forum_poll_options (thread_id, label, order_pos)
      values (p_thread, trim(v_opcion), v_pos);
      v_pos := v_pos + 1;
    end loop;
  else
    update public.forum_polls
       set question = trim(p_pregunta)
     where thread_id = p_thread;
  end if;

  return v_borrados;
end;
$$;

grant execute on function public.forum_editar_encuesta(uuid, text, boolean, text[]) to authenticated;

commit;

-- Que PostgREST se entere de la función nueva. Supabase suele recargar el
-- esquema solo, pero a veces tarda — y mientras tanto el botón de editar
-- contesta "Could not find the function ... in the schema cache".
notify pgrst, 'reload schema';

-- ── Comprobación ──
-- select proname from pg_proc where proname = 'forum_editar_encuesta';
