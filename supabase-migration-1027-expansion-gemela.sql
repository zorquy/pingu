-- Tanda 1027 — La edición gemela de una expansión (japonesa ↔ occidental).
--
-- TCGGO (anuncio del 25 de octubre de 2026) da en cada expansión sus
-- `related_episodes`: la edición equivalente en el otro catálogo (Chispas
-- Fulgurantes ↔ Super Electric Breaker; Evoluciones en Paldea ↔ Triplet Beat
-- + Snow Hazard + Clay Burst). Con eso la cabecera de una expansión enseña
-- un chip «Edición japonesa / Edición occidental» que lleva a la gemela.
--
-- `tcg_sets.tcggo_gemelos`: la lista de ids de TCGGO (en la numeración del
-- OTRO catálogo, la 808) de las ediciones gemelas de este set; NULL si no
-- tiene. La escribe `tcggo-calco-jp` una vez al día (`pasoDeGemelas`) para
-- los dos catálogos a la vez, solo con pares en los que tenemos los dos
-- sets; y se corrige a mano desde /admin → Colecciones (es una columna
-- corregible: lo corregido manda sobre la pasada, la 885).
--
-- Se ejecuta en el SQL Editor de Supabase. Cada sentencia va por su lado (631).
-- Hasta que esté, la web y la pasada piden la columna con respaldo (la 624):
-- nada se rompe, solo no sale el chip.

alter table public.tcg_sets add column if not exists tcggo_gemelos jsonb;

-- La lista de columnas corregibles de la 885, con la nueva.
create or replace function public.catalogo_columnas_corregibles(p_tabla text)
returns text[]
language sql
immutable
as $$
  select case p_tabla
    when 'tcg_cards' then array['name', 'name_en', 'name_es', 'local_id', 'set_id', 'rarity', 'rarity_en', 'category', 'hp', 'types', 'stage', 'evolve_from', 'retreat', 'attacks', 'abilities', 'weaknesses', 'resistances', 'trainer_type', 'energy_type', 'illustrator', 'description', 'dex_ids', 'regulation_mark', 'variants', 'suffix', 'image_path', 'image_tcggo', 'image_scrydex', 'cm_id_product_propio', 'tp_id_product_propio', 'origen']
    when 'tcg_sets' then array['name', 'name_en', 'serie_id', 'serie_name', 'serie_name_en', 'release_date', 'card_count_official', 'card_count_total', 'tcg_online_code', 'logo_tcggo', 'logo_scrydex', 'logo_path', 'symbol_scrydex', 'oculto', 'orden', 'origen', 'tcggo_gemelos']
    else array[]::text[]
  end
$$;
