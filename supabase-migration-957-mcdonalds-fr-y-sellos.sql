-- ============================================================
-- Tanda 957: lo que faltaba del catálogo y sí tiene una fuente.
--
-- Sergio.M en el foro: «McDonald's Collection 2019 Francés (MCD19F), falta
-- este set» y «Dark Explorers: Scyther tiene 4 cartas especiales de 1.º, 2.º,
-- 3.º y 4.º puesto como sello».
--
--  1. «McDonald's Collection 2019» en FRANCÉS: 40 cartas (más la 33b), otra
--     colección que la inglesa de 12 (TCGdex la tiene aparte, «2019sm-fr»).
--     Las fichas son las de tcgdex/cards-database (número, PS, tipo,
--     Pokédex, ilustrador); el nombre inglés sale de su número de Pokédex.
--     Sin foto: una dirección supuesta es una foto rota que nadie distingue
--     (CLAUDE.md); PINGU la pone desde /admin. Nace «a mano» (885): ninguna
--     pasada la esconde ni la borra. Sus idiomas: solo francés (956).
--  2. El Scyther de Dark Explorers (bw5-4): sus cuatro sellos de liga, del
--     1.er al 4.º puesto, como versiones a mano (934) de clase «sello».
--  3. Los idiomas de las dos barajas japonesas que crea `decks-jp-a-mano`
--     (Lucario VSTAR y Zekrom-EX, de la misma lista del foro).
--
-- Va después de la 885, la 934 y la 956. Se puede ejecutar dos veces.
-- ============================================================

begin;

-- ── 1. McDonald's 2019 en francés ──
insert into public.tcg_sets (id, market, name, name_en, serie_id, release_date, card_count_official, card_count_total, origen, oculto)
values ('2019sm-fr', 'WEST', 'McDonald''s Collection 2019 (francés)', 'McDonald''s Collection 2019 (French)',
  coalesce((select serie_id from public.tcg_sets where id = '2019sm' and market = 'WEST'), 'mc'), '2019-10-30', 40, 41, 'mano', false)
on conflict (id, market) do update set oculto = false, origen = coalesce(public.tcg_sets.origen, 'mano');

insert into public.tcg_cards (id, market, set_id, local_id, name, name_es, hp, types, dex_ids, illustrator, category, origen)
select v.id, 'WEST', '2019sm-fr', v.n, v.en, v.es, v.hp, v.tipo, v.dex, v.ilu, 'Pokemon', 'mano'
from (values
  ('2019sm-fr-1', '1', 'Bulbasaur', 'Bulbasaur', 70, array['Grass'], array[1], 'Mizue'),
  ('2019sm-fr-2', '2', 'Caterpie', 'Caterpie', 50, array['Grass'], array[10], 'Sekio'),
  ('2019sm-fr-3', '3', 'Paras', 'Paras', 60, array['Grass'], array[46], 'Ayaka Yoshida'),
  ('2019sm-fr-4', '4', 'Bellsprout', 'Bellsprout', 60, array['Grass'], array[69], 'Masako Yamashita'),
  ('2019sm-fr-5', '5', 'Alolan Exeggutor', 'Exeggutor de Alola', 160, array['Grass'], array[103], 'Satoshi Shirai'),
  ('2019sm-fr-6', '6', 'Tangela', 'Tangela', 80, array['Grass'], array[114], 'Ken Sugimori'),
  ('2019sm-fr-7', '7', 'Scyther', 'Scyther', 70, array['Grass'], array[123], 'Hajime Kusajima'),
  ('2019sm-fr-8', '8', 'Pinsir', 'Pinsir', 110, array['Grass'], array[127], 'Suwama Chiaki'),
  ('2019sm-fr-9', '9', 'Charmander', 'Charmander', 70, array['Fire'], array[4], 'tetsuya koizumi'),
  ('2019sm-fr-10', '10', 'Magmar', 'Magmar', 80, array['Fire'], array[126], 'Yumi'),
  ('2019sm-fr-11', '11', 'Moltres', 'Moltres', 120, array['Fire'], array[146], 'Hitoshi Ariga'),
  ('2019sm-fr-12', '12', 'Alolan Sandshrew', 'Sandshrew de Alola', 60, array['Water'], array[27], 'Shin Nagasawa'),
  ('2019sm-fr-13', '13', 'Alolan Vulpix', 'Vulpix de Alola', 60, array['Water'], array[37], 'Tomokazu Komiya'),
  ('2019sm-fr-14', '14', 'Slowpoke', 'Slowpoke', 70, array['Water'], array[79], 'Tomokazu Komiya'),
  ('2019sm-fr-15', '15', 'Horsea', 'Horsea', 50, array['Water'], array[116], 'Mizue'),
  ('2019sm-fr-16', '16', 'Staryu', 'Staryu', 60, array['Water'], array[120], 'Yukiko Baba'),
  ('2019sm-fr-17', '17', 'Magikarp', 'Magikarp', 30, array['Water'], array[129], 'Sekio'),
  ('2019sm-fr-18', '18', 'Lapras', 'Lapras', 120, array['Water'], array[131], 'Saya Tsuruta'),
  ('2019sm-fr-19', '19', 'Articuno', 'Articuno', 120, array['Water'], array[144], 'Hitoshi Ariga'),
  ('2019sm-fr-20', '20', 'Pikachu', 'Pikachu', 60, array['Lightning'], array[25], 'Kagemaru Himeno'),
  ('2019sm-fr-21', '21', 'Alolan Raichu', 'Raichu de Alola', 110, array['Lightning'], array[26], 'Akira Komayama'),
  ('2019sm-fr-22', '22', 'Alolan Geodude', 'Geodude de Alola', 60, array['Lightning'], array[74], 'Mitsuhiro Arita'),
  ('2019sm-fr-23', '23', 'Magnemite', 'Magnemite', 60, array['Lightning'], array[81], 'MAHOU'),
  ('2019sm-fr-24', '24', 'Voltorb', 'Voltorb', 50, array['Lightning'], array[100], 'Ken Sugimori'),
  ('2019sm-fr-25', '25', 'Electabuzz', 'Electabuzz', 80, array['Lightning'], array[125], 'Kouki Saitou'),
  ('2019sm-fr-26', '26', 'Zapdos', 'Zapdos', 120, array['Lightning'], array[145], 'Hitoshi Ariga'),
  ('2019sm-fr-27', '27', 'Gastly', 'Gastly', 50, array['Psychic'], array[92], 'Shibuzoh.'),
  ('2019sm-fr-28', '28', 'Mankey', 'Mankey', 60, array['Fighting'], array[56], 'Miki Tanaka'),
  ('2019sm-fr-29', '29', 'Onix', 'Onix', 100, array['Fighting'], array[95], 'Mitsuhiro Arita'),
  ('2019sm-fr-30', '30', 'Cubone', 'Cubone', 60, array['Fighting'], array[104], 'sowsow'),
  ('2019sm-fr-31', '31', 'Rhyhorn', 'Rhyhorn', 80, array['Fighting'], array[111], 'miki kudo'),
  ('2019sm-fr-32', '32', 'Alolan Meowth', 'Meowth de Alola', 60, array['Darkness'], array[52], 'Akira Komayama'),
  ('2019sm-fr-33', '33', 'Alolan Diglett', 'Diglett de Alola', 50, array['Metal'], array[50], 'Megumi Mizutani'),
  ('2019sm-fr-33b', '33b', 'Alolan Diglett', 'Diglett de Alola', 50, array['Metal'], array[50], 'Naoyo Kimura'),
  ('2019sm-fr-34', '34', 'Alolan Dugtrio', 'Dugtrio de Alola', 60, array['Metal'], array[51], 'Megumi Mizutani'),
  ('2019sm-fr-35', '35', 'Jigglypuff', 'Jigglypuff', 70, array['Fairy'], array[39], 'Ken Sugimori'),
  ('2019sm-fr-36', '36', 'Dratini', 'Dratini', 60, array['Dragon'], array[147], 'Ayaka Yoshida'),
  ('2019sm-fr-37', '37', 'Lickitung', 'Lickitung', 100, array['Colorless'], array[108], 'Mizue'),
  ('2019sm-fr-38', '38', 'Chansey', 'Chansey', 100, array['Colorless'], array[113], 'MAHOU'),
  ('2019sm-fr-39', '39', 'Kangaskhan', 'Kangaskhan', 120, array['Colorless'], array[115], 'Naoyo Kimura'),
  ('2019sm-fr-40', '40', 'Eevee', 'Eevee', 60, array['Colorless'], array[133], 'Atsuko Nishida')
) as v(id, n, en, es, hp, tipo, dex, ilu)
on conflict (id, market) do nothing;

-- Solo salió en francés.
insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, updated_at)
values ('2019sm-fr', 'WEST', 'fr', true, now())
on conflict (set_id, market, idioma) do update set hay = true, updated_at = now();
insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, updated_at)
select '2019sm-fr', 'WEST', x, false, now()
from unnest(array['es', 'en', 'de', 'it', 'pt']) as x
on conflict (set_id, market, idioma) do update set hay = false, updated_at = now();

-- Y las dos barajas japonesas que crea `decks-jp-a-mano` (957): el Lucario
-- VSTAR salió también en coreano y en chino, y la de Zekrom-EX en coreano
-- (allí con otro código, BGZ). Sin la fila del set no hace nada: la función la
-- crea en su pasada, y esto se queda guardado para cuando exista.
insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, updated_at)
select v.set_id, 'JP', v.idioma, true, now()
from (values ('sll_ja', 'ko'), ('sll_ja', 'zh'), ('bkz_ja', 'ko')) as v(set_id, idioma)
on conflict (set_id, market, idioma) do update set hay = true, updated_at = now();

-- ── 2. Los sellos del Scyther de Dark Explorers ──
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, nombre, etiqueta, icono, clase, origen, actualizado_at)
select -nextval('public.tcg_card_versions_mano_seq')::int, 'WEST', c.id, c.set_id, c.local_id, c.name, v.etiqueta, 'sello', 'sello', 'mano', now()
from public.tcg_cards c
cross join (values ('Sello 1.er puesto'), ('Sello 2.º puesto'), ('Sello 3.er puesto'), ('Sello 4.º puesto')) as v(etiqueta)
where c.id = 'bw5-4' and c.market = 'WEST'
  and not exists (select 1 from public.tcg_card_versions w where w.card_id = c.id and w.market = 'WEST' and w.etiqueta = v.etiqueta);

notify pgrst, 'reload schema';

commit;

-- Lo que ha quedado (el SQL Editor enseña esta tabla).
select 'McDonald''s 2019 (francés)' as que, (select count(*) from public.tcg_cards where set_id = '2019sm-fr' and market = 'WEST') as cuantas,
       array_to_string(public.idiomas_de_set('2019sm-fr', 'WEST'), ', ') as detalle
union all
select 'Sellos del Scyther de Dark Explorers', (select count(*) from public.tcg_card_versions where card_id = 'bw5-4' and market = 'WEST' and clase = 'sello'),
       (select string_agg(etiqueta, ', ' order by etiqueta) from public.tcg_card_versions where card_id = 'bw5-4' and market = 'WEST' and clase = 'sello');
