-- ── El buscador tiene que encontrar por el nombre que SE VE (tanda 546) ──
--
-- PINGU, con la biblioteca japonesa delante: «¿y los nombres en inglés qué?
-- siguen saliendo los kanjis».
--
-- La tanda 546 arregla la pantalla: una carta japonesa se rotula con su
-- nombre occidental (`name_en`, que trae Scrydex) en toda la biblioteca.
-- Pero queda la otra mitad, y es la de siempre: **la pantalla ofrece algo
-- que no funciona**. El buscador del catálogo cruza contra `name_search`,
-- que es una columna GENERADA a partir de `name` y `name_es` — así que de
-- una carta japonesa se lee «Eevee» en la tarjeta y escribir «Eevee» no la
-- encuentra. Ni un error: cero resultados con la carta delante, que es
-- exactamente la lección de la 447.
--
-- `name_key` NO se toca. Esa es la clave con la que se cruzan las
-- decklists, el resolutor y la huella de las reimpresiones (tanda 335), y
-- meterle un nombre más la rompería igual que meterle el español rompió
-- `name_search` en su día. Son dos columnas porque son dos trabajos.
--
-- Una columna generada no se puede alterar en su sitio: hay que tirar el
-- índice y la columna y volver a crearlos.
drop index if exists public.tcg_cards_name_search_trgm_idx;
alter table public.tcg_cards drop column if exists name_search;

alter table public.tcg_cards
  add column name_search text
  generated always as (
    immutable_unaccent(lower(
      coalesce(name, '') || ' ' || coalesce(name_es, '') || ' ' || coalesce(name_en, '')
    ))
  ) stored;

create index if not exists tcg_cards_name_search_trgm_idx
  on public.tcg_cards using gin (name_search gin_trgm_ops);

-- Y el índice por mercado, que la migración de `cartas-mercado` crea sobre
-- esta misma columna: al tirarla se va con ella.
create index if not exists tcg_cards_market_name_idx
  on public.tcg_cards (market, name_search);

-- ── Comprobación: que de verdad se pueda encontrar por el occidental ──
--
-- Tiene que devolver filas. Si devuelve cero con cartas japonesas
-- importadas, es que `name_en` todavía está vacío —lo rellena
-- `scrydex-relleno-jp`— y no que la migración haya fallado.
select count(*) as japonesas_con_nombre_occidental,
       count(*) filter (where name_search like '%eevee%') as encontrables_por_eevee
from public.tcg_cards
where market = 'JP' and name_en is not null;
