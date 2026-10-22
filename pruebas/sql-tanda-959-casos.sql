\set ON_ERROR_STOP on
select case when cond then 'ok ' else 'MAL ' end || que from (values
  (public.idiomas_de_set('pl3') = array['de', 'en', 'fr'], 'Supreme Victors: inglés, francés y alemán'),
  (public.idiomas_de_set('pl4') = array['de', 'en', 'fr', 'it'], 'Arceus: inglés, francés, alemán e italiano, aunque haya un anuncio en español'),
  (public.idiomas_de_set('pl2') = array['de', 'en', 'fr', 'it'], 'Rising Rivals igual'),
  ((select count(*) from public.tcg_set_idiomas_mano where set_id = 'pl1') = 0, 'Platinum: sus idiomas no se tocan'),
  ((select count(*) from public.tcg_version_idioma where card_id like 'pl3-SH%') = 3 * 3 * 3, 'las SH de Supreme Victors: tres versiones en tres idiomas'),
  ((select count(*) from public.tcg_version_idioma where card_id like 'pl4-SH%') = 3 * 3 * 4, 'las de Arceus, en cuatro'),
  ((select bool_and(hay = (variante = 'reverse')) from public.tcg_version_idioma where card_id like 'pl%-SH%' and idioma <> 'es'), '  …Reverse sí, Holo y Normal no'),
  ((select string_agg(variante || ':' || hay, ',' order by variante) from public.tcg_version_idioma where card_id = 'pl1-SH5' and idioma = 'es') = 'holo:true,normal:false,reverse:false', 'Platinum en español: Holo, como el Duskull'),
  ((select count(*) from public.tcg_version_idioma where idioma = 'es' and card_id like 'pl_-SH%' and card_id not like 'pl1-%') = 0, '  …y solo en Platinum'),
  ((select count(*) from public.tcg_version_idioma where card_id = 'pl4-1') = 0, 'una carta normal no se toca')
) as t(cond, que);
