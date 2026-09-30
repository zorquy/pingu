-- ─────────────────────────────────────────────────────────────────────
-- LA POKÉDEX DE MI COLECCIÓN (tanda 381).
--
-- PINGU quiere en «Mi colección» lo que hace la app de TCGdex: entras en
-- Pikachu y ves TODAS sus cartas, de todas las colecciones, con cuáles
-- tienes. Es lo que convierte un listado de cartas en una colección: la
-- gente no colecciona sets, colecciona Pokémon.
--
-- ── DE DÓNDE SALE LA ESPECIE: DEL NOMBRE, Y NO CUESTA NADA ──
--
-- `tcg_cards.dex_ids` existe desde la primera migración del catálogo y
-- está VACÍA en las 21.356 filas: nadie la rellenó nunca.
--
-- La tentación es pedírsela a TCGdex (su carta trae `dexId`). Serían
-- ~21.000 peticiones, dos días de función programada, contra un catálogo
-- comunitario y gratuito — la cuenta que esta casa lleva haciendo desde
-- la tanda 233.
--
-- Y no hace falta: **la especie está en el NOMBRE, que ya tenemos**.
-- `especiesDeCarta` (js/pokedex-especies.js) la saca con el mismo
-- mecanismo que ya mueve los minisprites y los arquetipos de mazo, así
-- que está probado desde la tanda 231. Rellenar la columna es leer y
-- escribir en NUESTRA base, sin salir a internet.
--
-- ── EL CENTINELA ──
--
-- `null` = «no lo hemos mirado». `{}` = «mirado, y no sale ningún
-- Pokémon» — un Entrenador, una Energía. Son cosas distintas y sin el
-- centinela la función volvería a mirar los ~5.000 Entrenadores en cada
-- pasada, para siempre. Es la misma lección de la 333 y de la 380:
-- **una cola que no distingue «no preguntado» de «no hay» no se vacía
-- nunca.**
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- Por aquí entra la Pokédex: «dame las cartas del 25». PostgREST lo
-- manda como `dex_ids=cs.{25}`, que es el operador `@>` — y ese lo
-- resuelve un GIN, no un btree.
create index if not exists tcg_cards_dex_idx
  on public.tcg_cards using gin (dex_ids);

-- Y la cola de lo que falta por mirar, parcial: son 21.356 al empezar y
-- cero al acabar, así que el índice se vacía solo y deja de costar.
create index if not exists tcg_cards_sin_dex_idx
  on public.tcg_cards (market)
  where dex_ids is null;

-- ── Cuántas cartas hay de cada Pokémon ──
--
-- Es el número de la derecha de cada fila de la Pokédex («tienes 12 de
-- 40»). Sale de una pasada por el catálogo y NO depende de quién
-- pregunte, así que se puede pedir una vez por visita y guardar.
--
-- Lo que tiene cada uno NO se pregunta aquí: la página ya tiene su
-- colección cargada en memoria, así que contar por especie es gratis en
-- el navegador. Una consulta que ya está hecha no se vuelve a hacer.
create or replace function public.pokedex_resumen()
returns table (dex int, cartas int)
language sql
stable
as $$
  select d.dex, count(*)::int
    from public.tcg_cards c, unnest(c.dex_ids) as d(dex)
   where c.market = 'WEST' and c.dex_ids is not null
   group by d.dex
   order by d.dex;
$$;

grant execute on function public.pokedex_resumen() to anon, authenticated;

commit;

-- ── Comprobación: el tamaño de la cola ──
select count(*) filter (where dex_ids is null)                    as por_mirar,
       count(*) filter (where dex_ids is not null and dex_ids <> '{}') as con_pokemon,
       count(*) filter (where dex_ids = '{}')                      as sin_pokemon,
       count(*)                                                    as total
  from public.tcg_cards where market = 'WEST';

notify pgrst, 'reload schema';
