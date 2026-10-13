-- Los productos, por CATÁLOGO (tanda 808).
--
-- PINGU: «no están todos: solo hasta Stellar Crown, y hacia abajo hasta
-- Evolutions; y el catálogo japonés de productos está vacío». Dos causas:
--
--   1. La estantería contaba los productos de cada expansión pidiendo la
--      columna `episode_id` de TODA la tabla con `.limit(10000)`, y Supabase
--      corta cualquier respuesta a 1.000 filas sin dar error. Solo salían
--      las expansiones de esas 1.000 primeras. La cuenta la hace ahora la
--      base (`productos_por_expansion`), una fila por expansión.
--   2. Lo japonés: los ids de expansión de TCGGO del catálogo japonés son
--      OTROS que los del occidental (la 807), y `tcg_products` no decía de
--      qué catálogo es cada producto. Desde aquí lo dice `market`.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera. Sin
-- tablas temporales (la 631).

alter table public.tcg_products add column if not exists market text not null default 'WEST';

create index if not exists tcg_products_mercado_episodio on public.tcg_products (market, episode_id);

-- Cuántos productos tiene cada expansión de un catálogo. Invoker: la lee
-- quien la llama con sus permisos, y `tcg_products` se lee sin cuenta.
create or replace function public.productos_por_expansion(p_market text default 'WEST')
returns table (episode_id bigint, productos int)
language sql
stable
security invoker
set search_path = public
as $$
  select p.episode_id, count(*)::int
    from public.tcg_products p
   where p.market = coalesce(p_market, 'WEST') and p.episode_id is not null
   group by p.episode_id
$$;

grant execute on function public.productos_por_expansion(text) to anon, authenticated;

notify pgrst, 'reload schema';
