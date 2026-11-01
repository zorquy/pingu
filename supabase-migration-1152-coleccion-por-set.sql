-- Tanda 1152 (D2 de la ronda 6): cuántas cartas DISTINTAS tienes de cada
-- expansión, para el progreso de /lanzamientos («14 / 191» con su barrita).
--
-- La estantería de Mi colección lo cuenta en el navegador porque ya tiene
-- todas tus líneas y todas las cartas cargadas; /lanzamientos no las tiene,
-- y traerlas para contar serían miles de filas y decenas de peticiones. Aquí
-- es una consulta: tus líneas de ese catálogo, su set, y cuántas cartas
-- distintas hay por set. Los sets hermanos (el 30 aniversario y su Classic)
-- los suma el navegador, con la misma regla que pliega la lista.
--
-- `security invoker`: corre con la RLS de quien pregunta, así que solo ve
-- SUS líneas (y `auth.uid()` las filtra además: sin sesión, nada).
-- Se puede ejecutar más de una vez.

create or replace function public.coleccion_por_set(p_market text default 'WEST')
returns table (set_id text, distintas int)
language sql
stable
security invoker
set search_path = public
as $$
  select c.set_id, count(distinct l.card_id)::int
  from public.user_collection l
  join public.tcg_cards c on c.id = l.card_id and c.market = l.market
  where l.user_id = auth.uid()
    and l.market = coalesce(nullif(p_market, ''), 'WEST')
  group by c.set_id
$$;

revoke all on function public.coleccion_por_set(text) from public;
grant execute on function public.coleccion_por_set(text) to authenticated;
