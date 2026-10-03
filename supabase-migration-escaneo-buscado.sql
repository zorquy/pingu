-- Tanda 488 — cuándo se le buscó el escaneo a una carta.
--
-- La API de TCGdex se calla el campo `image` en miles de cartas asiáticas
-- cuyo fichero SÍ está publicado en su servidor de imágenes (medido el
-- 2026-10-03: en japonés la API dice 3.882 y existen 7.365). La función
-- programada `escaneos-asia` monta la dirección a mano y pregunta si
-- existe, y necesita apuntar a cuáles ya les preguntó: si no, las ~9.000
-- que de verdad no tienen foto volverían en cada pasada para siempre.
--
--   null   → todavía no se ha mirado
--   fecha  → se miró ese día. Si sigue sin `image_path`, es que no había,
--            y se vuelve a mirar pasado un mes (TCGdex va recibiendo
--            escaneos).
--
-- Se puede ejecutar dos veces sin romper nada. No toca ninguna fila.

alter table public.tcg_cards add column if not exists escaneo_buscado_at timestamptz;

-- La cola: cartas sin foto, de las que no se han mirado a las que hace
-- más que se miraron. Parcial, porque las que ya tienen foto no entran
-- nunca y son la mayoría de la tabla.
create index if not exists tcg_cards_escaneo_cola_idx
  on public.tcg_cards (escaneo_buscado_at nulls first)
  where image_path is null;

-- ── Comprobación ──
--
-- Cuántas cartas de cada mercado tienen foto, cuántas están en la cola y
-- cuántas se miraron y no tenían. Vuelve a ejecutarla unas horas después:
-- `con_foto` de JP tiene que subir de ~3.900 hacia ~7.400.
select market,
       count(*)                                                        as cartas,
       count(*) filter (where image_path is not null)                  as con_foto,
       count(*) filter (where image_path is null
                          and escaneo_buscado_at is null)              as por_mirar,
       count(*) filter (where image_path is null
                          and escaneo_buscado_at is not null)          as miradas_sin_foto,
       count(*) filter (where name_es is not null)                     as con_nombre_latino
from public.tcg_cards
group by market
order by market;
