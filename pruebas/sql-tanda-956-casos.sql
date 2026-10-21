-- Casos de la 956, después de la 911 y de la 956 (dos veces).
\set ON_ERROR_STOP on
-- El admin pone y quita por las funciones; uno normal no puede.
set role authenticated;
select set_config('prueba.uid', '00000000-0000-0000-0000-00000000000a', false);
select public.catalogo_idioma_de_set('bw10', 'WEST', 'nl', true) is not null as puesto \gset
select public.catalogo_version_de_idioma('bw10', 'WEST', 'reverse', 'fr', false) is not null as marcada \gset
select public.catalogo_version_de_idioma('bw10', 'WEST', 'holo', 'fr', false) is not null as marcada2 \gset
select public.catalogo_version_de_idioma('bw10', 'WEST', 'holo', 'fr', true) is not null as devuelta \gset
select set_config('prueba.uid', '00000000-0000-0000-0000-00000000000b', false);
\set ON_ERROR_STOP off
select public.catalogo_idioma_de_set('bw10', 'WEST', 'es', true);
\set ON_ERROR_STOP on
select set_config('prueba.uid', '', false);
reset role;

select case when cond then 'ok ' else 'MAL ' end || que from (values
  ('pt' <> all (public.idiomas_de_set('hgss3')) and 'pt' = any (public.idiomas_de_set_calculados('hgss3')), 'Undaunted sin portugués (y lo calculado lo sigue diciendo, para /admin)'),
  ('es' <> all (public.idiomas_de_set('bw5')) and 'es' = any (public.idiomas_de_set_calculados('bw5')), 'Dark Explorers sin español aunque Cardmarket tenga un anuncio en español'),
  ('nl' = any (public.idiomas_de_set('base2')), 'Jungle con neerlandés'),
  ((select count(*) from public.tcg_version_idioma where variante = 'reverse' and not hay and (set_id, idioma) in (('dp7', 'es'), ('bw5', 'pt'), ('bw7', 'pt'))) = 3, 'las tres Reverse que no salieron (Stormfront ES, Dark Explorers PT, Boundaries Crossed PT)'),
  ('nl' = any (public.idiomas_de_set('bw10')), 'el admin pone un idioma por la función'),
  ((select count(*) from public.tcg_version_idioma where set_id = 'bw10' and variante = 'reverse' and idioma = 'fr' and not hay) = 1, '  …y marca una versión que no salió'),
  ((select count(*) from public.tcg_version_idioma where set_id = 'bw10' and variante = 'holo') = 0, '  …y devolverla («sí salió») no deja fila'),
  ('es' <> all (public.idiomas_de_set('bw10')), 'uno que no es admin no puede poner nada'),
  ((select count(*) from public.tcg_set_idiomas_mano) = 4 and (select count(*) from public.tcg_version_idioma) = 4, 'ejecutarla dos veces no repite nada')
) as t(cond, que);

-- El neerlandés se puede guardar; un idioma inventado no.
insert into public.user_collection (idioma) values ('nl');
insert into public.user_wants (idioma) values ('nl');
select 'ok el neerlandés se guarda en la colección y en «La quiero»';
