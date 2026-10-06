-- Tanda 671 — el precio de las impresiones coreana y china (de TCGGO).
--
-- Su catálogo japonés da, al lado del mínimo japonés, el de la impresión
-- coreana y el de la china de la misma carta (en su web: «Japanese 9 € ·
-- Korean 8 € · Chinese 8,50 €»). Dos columnas más en la tabla de precios;
-- la pasada de precios las escribe en cuanto existan, y mientras no
-- existan las quita de la fila y escribe lo demás (sin esto la base
-- rechazaba la fila entera, la lección de la 624).
--
-- Ejecutar en el SQL Editor de Supabase.
begin;
alter table public.tcg_card_prices add column if not exists cm_low_ko numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_low_zh numeric(10, 2);
commit;
notify pgrst, 'reload schema';

-- Comprobación: cuántas cartas japonesas tienen ya precio coreano o chino.
select count(*) filter (where cm_low_ko is not null) as con_coreano,
       count(*) filter (where cm_low_zh is not null) as con_chino,
       count(*) filter (where cm_low_ja is not null) as con_japones
  from public.tcg_card_prices;
