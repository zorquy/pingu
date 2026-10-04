-- ─────────────────────────────────────────────────────────────────────
-- EL ENLACE EXACTO A CARDMARKET Y LA SEGUNDA FUENTE DE PRECIOS (tanda 585).
--
-- PINGU: «hay muchas cartas que no vienen con precio, y creo que es
-- porque no estamos linkando bien la carta exacta con la de Cardmarket».
-- Las dos cosas salían del mismo sitio —`pricing.cardmarket` de TCGdex—
-- y cuando TCGdex no lo trae nos quedábamos sin precio Y sin enlace.
--
-- `cm_url` es la URL exacta del producto en Cardmarket, tal como la
-- publica pokemontcg.io (redirige a la ficha). `origen` dice de dónde
-- salió la fila: 'tcgdex' (lo de siempre) o 'pokemontcg' (el respaldo).
-- La política de lectura es la de la tabla (pública): no hace falta otra.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

alter table public.tcg_card_prices add column if not exists cm_url text;
alter table public.tcg_card_prices add column if not exists origen text;

commit;

notify pgrst, 'reload schema';
