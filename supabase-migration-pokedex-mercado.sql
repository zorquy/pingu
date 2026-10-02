-- La Pokédex, por mercado (tanda 437)
-- ============================================================
--
-- `pokedex_resumen()` nació en la tanda de la Pokédex con 'WEST' escrito
-- dentro, porque entonces el catálogo era uno solo. Ya no: en la base
-- están el japonés (186 colecciones, 12.309 cartas), el taiwanés (98 y
-- 7.436) y el chino simplificado (56 y 877), y /mi-coleccion deja elegir
-- cuál se mira.
--
-- Sin esto, la Pokédex en japonés diría «de Pikachu hay 312 cartas»
-- contando las INGLESAS, y el progreso de al lado contaría las japonesas
-- que tienes. Dos números de dos catálogos distintos en la misma frase, y
-- sin dar ningún error: es lo de siempre, el fallo que se ve bien.
--
-- El parámetro lleva valor por defecto A PROPÓSITO: así `pokedex_resumen()`
-- a secas sigue significando lo mismo que antes y el cliente que todavía
-- no sepa de mercados no se entera de nada. Es la misma forma del puente
-- de la columna `cambio`.
--
-- Necesita supabase-migration-pokedex.sql.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- `create or replace` no vale cuando cambia la FIRMA (Postgres la trata
-- como otra función y se queda con las dos), así que la vieja se tira
-- primero. Nadie la guarda en una vista ni en un disparador.
drop function if exists public.pokedex_resumen();

create or replace function public.pokedex_resumen(p_market text default 'WEST')
returns table (dex int, cartas int)
language sql
stable
as $$
  select d.dex, count(*)::int
    from public.tcg_cards c, unnest(c.dex_ids) as d(dex)
   where c.market = p_market and c.dex_ids is not null
   group by d.dex
   order by d.dex;
$$;

grant execute on function public.pokedex_resumen(text) to anon, authenticated;

commit;

-- ── Comprobación: cuántas especies tiene cada catálogo ──
--
-- El japonés tiene que dar un número parecido al occidental y los chinos
-- bastante menor. Si alguno sale a 0, es que ese mercado no está
-- importado todavía, no que la función esté mal.
select 'WEST' as mercado, count(*) as especies from public.pokedex_resumen('WEST')
union all select 'JP', count(*) from public.pokedex_resumen('JP')
union all select 'TW', count(*) from public.pokedex_resumen('TW')
union all select 'CN', count(*) from public.pokedex_resumen('CN');

notify pgrst, 'reload schema';
