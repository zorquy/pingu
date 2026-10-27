-- Tanda 1058 — una lista de «La quiero» en el QR del Modo evento.
--
-- El QR puede llevar una lista (/evento/<usuario>?lista=<id>) y quien lo
-- escanea ve solo esas cartas. Las filas de user_want_list_items solo las lee
-- su dueño (RLS de la 1057), así que se sirven por esta función: las cartas
-- de UNA lista que su dueño sigue queriendo, con el nombre de la lista y de
-- quién es (la web comprueba que sea de la persona del perfil). El id es un
-- uuid que solo tiene quien recibe el enlace.
--
-- (La primera 1058 traía además un interruptor «cuenta para los cruces» por
-- lista; PINGU lo descartó antes de ejecutarla: lo que quieres, lo quieres.)
--
-- Sentencias sueltas, sin tablas temporales (la 631). Se puede ejecutar dos
-- veces.

drop function if exists public.evento_lista(uuid);
create or replace function public.evento_lista(p_lista uuid)
returns table (card_id text, market text, nombre text, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select i.card_id, i.market, l.nombre, l.user_id
  from public.user_want_list_items i
  join public.user_want_lists l on l.id = i.list_id
  where i.list_id = p_lista
    and exists (select 1 from public.user_wants w where w.user_id = i.user_id and w.card_id = i.card_id);
$$;

grant execute on function public.evento_lista(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
