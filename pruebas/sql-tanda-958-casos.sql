-- Casos de la 958: sobre la base de la 956 (con las SH de Stormfront), la
-- 911, la 956 y la 958 dos veces.
\set ON_ERROR_STOP on
set role authenticated;
select set_config('prueba.uid', '00000000-0000-0000-0000-00000000000a', false);
-- En una carta se guardan el sí y el no; null lo quita.
select public.catalogo_version_de_idioma('dp7', 'WEST', 'normal', 'pt', true, 'dp7-1') is not null as a \gset
select public.catalogo_version_de_idioma('dp7', 'WEST', 'holo', 'pt', false, 'dp7-1') is not null as b \gset
select public.catalogo_version_de_idioma('dp7', 'WEST', 'holo', 'pt', null, 'dp7-1') is not null as c \gset
-- Sin carta, como en la 956: el sí del set no se guarda.
select public.catalogo_version_de_idioma('dp7', 'WEST', 'normal', 'fr', false) is not null as d \gset
select public.catalogo_version_de_idioma('dp7', 'WEST', 'normal', 'fr', true, null) is not null as e \gset
\set ON_ERROR_STOP off
-- Una carta de otro set no se acepta.
select public.catalogo_version_de_idioma('dp7', 'WEST', 'holo', 'en', true, 'bw5-1');
\set ON_ERROR_STOP on
select set_config('prueba.uid', '', false);
reset role;

select case when cond then 'ok ' else 'MAL ' end || que from (values
  ((select count(*) from public.tcg_version_idioma where set_id = 'dp7' and card_id in ('dp7-SH1', 'dp7-SH2', 'dp7-SH3')) = 3 * 2 * 4, 'las tres SH de Stormfront, con Reverse sí y Holo no en cuatro idiomas'),
  ((select bool_and(hay) from public.tcg_version_idioma where card_id = 'dp7-SH2' and variante = 'reverse') and not (select bool_or(hay) from public.tcg_version_idioma where card_id = 'dp7-SH2' and variante = 'holo'), '  …la Reverse a sí y la Holo a no'),
  ((select string_agg(idioma, ',' order by idioma) from public.tcg_version_idioma where card_id = 'dp7-SH2' and variante = 'holo') = 'de,en,fr,it', '  …en inglés, francés, alemán e italiano (el español, como el set)'),
  ((select count(*) from public.tcg_version_idioma where card_id = 'dp7-SH9') = 0, 'una SH que no existe no se inventa'),
  ((select count(*) from public.tcg_version_idioma where set_id = 'dp7' and card_id = '' and variante = 'reverse' and idioma = 'es' and not hay) = 1, 'la Reverse española del set (956) sigue'),
  ((select hay from public.tcg_version_idioma where card_id = 'dp7-1' and variante = 'normal' and idioma = 'pt'), 'en una carta el sí se guarda'),
  ((select count(*) from public.tcg_version_idioma where card_id = 'dp7-1' and variante = 'holo') = 0, '  …y null lo quita'),
  ((select count(*) from public.tcg_version_idioma where card_id = '' and set_id = 'dp7' and variante = 'normal' and idioma = 'fr') = 0, 'en el set el sí no se guarda (es lo de por defecto)'),
  ((select count(*) from public.tcg_version_idioma where card_id = 'bw5-1') = 0, 'una carta de otro set no se acepta'),
  ((select count(*) from pg_proc where proname = 'catalogo_version_de_idioma') = 1, 'queda una sola función (sin la de cinco, que chocaría con la de seis)')
) as t(cond, que);
