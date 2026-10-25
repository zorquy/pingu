-- ============================================================
-- Tanda 1009: las cuatro barajas de «My First Battle».
--
-- PINGU, con las listas de Bulbapedia: «créame esos cuatro decks… se llama My
-- First Battle y luego el nombre del deck… no hace falta que les metas número,
-- y después yo ya subo las imágenes».
--
-- Cuatro colecciones del catálogo occidental (Bulbasaur, Charmander, Pikachu y
-- Squirtle), doce cartas distintas cada una (la lista sin repetir: «Ivysaur
-- 2×» es una carta). Las cartas no llevan número impreso, pero la base pide
-- uno para distinguirlas (`local_id`): es el ORDEN de la lista (1–12) y se
-- cambia desde /admin. El primer Pokémon y la energía inicial son cartas
-- aparte de su gemela («First Pokémon», «Starting Energy») y lo dicen en el
-- nombre. Sin foto (PINGU las sube), sin PS ni ataques (no hay fuente a mano),
-- versión «Normal», era de Escarlata y Púrpura y sin fecha (se pone en /admin).
-- Nacen «a mano» (885): ninguna pasada las esconde ni las borra. Ids como los
-- de «Nueva carta» del panel (`mano-<set>-<n>`).
--
-- Va después de la 885. Se puede ejecutar dos veces; cada sentencia va sola
-- (la 631).
-- ============================================================

insert into public.tcg_sets (id, market, name, name_en, serie_id, card_count_official, card_count_total, origen, oculto)
select v.id, 'WEST', v.name, v.name_en,
  coalesce((select serie_id from public.tcg_sets where id = 'sv01' and market = 'WEST'), 'sv'), 12, 12, 'mano', false
from (values
  ('mfb-bulbasaur', 'My First Battle: Bulbasaur Deck', 'My First Battle: Bulbasaur Deck'),
  ('mfb-charmander', 'My First Battle: Charmander Deck', 'My First Battle: Charmander Deck'),
  ('mfb-pikachu', 'My First Battle: Pikachu Deck', 'My First Battle: Pikachu Deck'),
  ('mfb-squirtle', 'My First Battle: Squirtle Deck', 'My First Battle: Squirtle Deck')
) as v(id, name, name_en)
on conflict (id, market) do update set oculto = false, origen = coalesce(public.tcg_sets.origen, 'mano');

insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, name_es, category, types, dex_ids, trainer_type, energy_type, variants, origen)
select v.id, 'WEST', v.set_id, v.n, v.en, v.en, v.es, v.categoria, v.tipos, v.dex, v.tt, v.et, '{"normal": true}'::jsonb, 'mano'
from (values
  ('mano-mfb-bulbasaur-1', 'mfb-bulbasaur', '1', 'Bulbasaur (First Pokémon)', 'Bulbasaur (primer Pokémon)', 'Pokemon', array['Grass'], array[1], null, null),
  ('mano-mfb-bulbasaur-2', 'mfb-bulbasaur', '2', 'Bulbasaur', 'Bulbasaur', 'Pokemon', array['Grass'], array[1], null, null),
  ('mano-mfb-bulbasaur-3', 'mfb-bulbasaur', '3', 'Ivysaur', 'Ivysaur', 'Pokemon', array['Grass'], array[2], null, null),
  ('mano-mfb-bulbasaur-4', 'mfb-bulbasaur', '4', 'Oddish', 'Oddish', 'Pokemon', array['Grass'], array[43], null, null),
  ('mano-mfb-bulbasaur-5', 'mfb-bulbasaur', '5', 'Gloom', 'Gloom', 'Pokemon', array['Grass'], array[44], null, null),
  ('mano-mfb-bulbasaur-6', 'mfb-bulbasaur', '6', 'Exeggcute', 'Exeggcute', 'Pokemon', array['Grass'], array[102], null, null),
  ('mano-mfb-bulbasaur-7', 'mfb-bulbasaur', '7', 'Exeggutor', 'Exeggutor', 'Pokemon', array['Grass'], array[103], null, null),
  ('mano-mfb-bulbasaur-8', 'mfb-bulbasaur', '8', 'Scyther', 'Scyther', 'Pokemon', array['Grass'], array[123], null, null),
  ('mano-mfb-bulbasaur-9', 'mfb-bulbasaur', '9', 'Potion', 'Poción', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-bulbasaur-10', 'mfb-bulbasaur', '10', 'Switch', 'Cambio', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-bulbasaur-11', 'mfb-bulbasaur', '11', 'Basic Grass Energy (Starting Energy)', 'Energía Planta (energía inicial)', 'Energy', array['Grass'], null, null, 'Basic'),
  ('mano-mfb-bulbasaur-12', 'mfb-bulbasaur', '12', 'Basic Grass Energy', 'Energía Planta', 'Energy', array['Grass'], null, null, 'Basic'),
  ('mano-mfb-charmander-1', 'mfb-charmander', '1', 'Charmander (First Pokémon)', 'Charmander (primer Pokémon)', 'Pokemon', array['Fire'], array[4], null, null),
  ('mano-mfb-charmander-2', 'mfb-charmander', '2', 'Charmander', 'Charmander', 'Pokemon', array['Fire'], array[4], null, null),
  ('mano-mfb-charmander-3', 'mfb-charmander', '3', 'Charmeleon', 'Charmeleon', 'Pokemon', array['Fire'], array[5], null, null),
  ('mano-mfb-charmander-4', 'mfb-charmander', '4', 'Vulpix', 'Vulpix', 'Pokemon', array['Fire'], array[37], null, null),
  ('mano-mfb-charmander-5', 'mfb-charmander', '5', 'Ninetales', 'Ninetales', 'Pokemon', array['Fire'], array[38], null, null),
  ('mano-mfb-charmander-6', 'mfb-charmander', '6', 'Growlithe', 'Growlithe', 'Pokemon', array['Fire'], array[58], null, null),
  ('mano-mfb-charmander-7', 'mfb-charmander', '7', 'Arcanine', 'Arcanine', 'Pokemon', array['Fire'], array[59], null, null),
  ('mano-mfb-charmander-8', 'mfb-charmander', '8', 'Magmar', 'Magmar', 'Pokemon', array['Fire'], array[126], null, null),
  ('mano-mfb-charmander-9', 'mfb-charmander', '9', 'Potion', 'Poción', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-charmander-10', 'mfb-charmander', '10', 'Switch', 'Cambio', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-charmander-11', 'mfb-charmander', '11', 'Basic Fire Energy (Starting Energy)', 'Energía Fuego (energía inicial)', 'Energy', array['Fire'], null, null, 'Basic'),
  ('mano-mfb-charmander-12', 'mfb-charmander', '12', 'Basic Fire Energy', 'Energía Fuego', 'Energy', array['Fire'], null, null, 'Basic'),
  ('mano-mfb-pikachu-1', 'mfb-pikachu', '1', 'Pikachu (First Pokémon)', 'Pikachu (primer Pokémon)', 'Pokemon', array['Lightning'], array[25], null, null),
  ('mano-mfb-pikachu-2', 'mfb-pikachu', '2', 'Pikachu', 'Pikachu', 'Pokemon', array['Lightning'], array[25], null, null),
  ('mano-mfb-pikachu-3', 'mfb-pikachu', '3', 'Raichu', 'Raichu', 'Pokemon', array['Lightning'], array[26], null, null),
  ('mano-mfb-pikachu-4', 'mfb-pikachu', '4', 'Magnemite', 'Magnemite', 'Pokemon', array['Lightning'], array[81], null, null),
  ('mano-mfb-pikachu-5', 'mfb-pikachu', '5', 'Magneton', 'Magneton', 'Pokemon', array['Lightning'], array[82], null, null),
  ('mano-mfb-pikachu-6', 'mfb-pikachu', '6', 'Voltorb', 'Voltorb', 'Pokemon', array['Lightning'], array[100], null, null),
  ('mano-mfb-pikachu-7', 'mfb-pikachu', '7', 'Electrode', 'Electrode', 'Pokemon', array['Lightning'], array[101], null, null),
  ('mano-mfb-pikachu-8', 'mfb-pikachu', '8', 'Electabuzz', 'Electabuzz', 'Pokemon', array['Lightning'], array[125], null, null),
  ('mano-mfb-pikachu-9', 'mfb-pikachu', '9', 'Potion', 'Poción', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-pikachu-10', 'mfb-pikachu', '10', 'Switch', 'Cambio', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-pikachu-11', 'mfb-pikachu', '11', 'Basic Lightning Energy (Starting Energy)', 'Energía Rayo (energía inicial)', 'Energy', array['Lightning'], null, null, 'Basic'),
  ('mano-mfb-pikachu-12', 'mfb-pikachu', '12', 'Basic Lightning Energy', 'Energía Rayo', 'Energy', array['Lightning'], null, null, 'Basic'),
  ('mano-mfb-squirtle-1', 'mfb-squirtle', '1', 'Squirtle (First Pokémon)', 'Squirtle (primer Pokémon)', 'Pokemon', array['Water'], array[7], null, null),
  ('mano-mfb-squirtle-2', 'mfb-squirtle', '2', 'Squirtle', 'Squirtle', 'Pokemon', array['Water'], array[7], null, null),
  ('mano-mfb-squirtle-3', 'mfb-squirtle', '3', 'Wartortle', 'Wartortle', 'Pokemon', array['Water'], array[8], null, null),
  ('mano-mfb-squirtle-4', 'mfb-squirtle', '4', 'Poliwag', 'Poliwag', 'Pokemon', array['Water'], array[60], null, null),
  ('mano-mfb-squirtle-5', 'mfb-squirtle', '5', 'Poliwhirl', 'Poliwhirl', 'Pokemon', array['Water'], array[61], null, null),
  ('mano-mfb-squirtle-6', 'mfb-squirtle', '6', 'Magikarp', 'Magikarp', 'Pokemon', array['Water'], array[129], null, null),
  ('mano-mfb-squirtle-7', 'mfb-squirtle', '7', 'Gyarados', 'Gyarados', 'Pokemon', array['Water'], array[130], null, null),
  ('mano-mfb-squirtle-8', 'mfb-squirtle', '8', 'Lapras', 'Lapras', 'Pokemon', array['Water'], array[131], null, null),
  ('mano-mfb-squirtle-9', 'mfb-squirtle', '9', 'Potion', 'Poción', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-squirtle-10', 'mfb-squirtle', '10', 'Switch', 'Cambio', 'Trainer', null, null, 'Item', null),
  ('mano-mfb-squirtle-11', 'mfb-squirtle', '11', 'Basic Water Energy (Starting Energy)', 'Energía Agua (energía inicial)', 'Energy', array['Water'], null, null, 'Basic'),
  ('mano-mfb-squirtle-12', 'mfb-squirtle', '12', 'Basic Water Energy', 'Energía Agua', 'Energy', array['Water'], null, null, 'Basic')
) as v(id, set_id, n, en, es, categoria, tipos, dex, tt, et)
on conflict (id, market) do nothing;

-- Lo que ha quedado: cuatro colecciones de doce.
select s.name as coleccion, count(c.id) as cartas
  from public.tcg_sets s left join public.tcg_cards c on c.set_id = s.id and c.market = s.market
 where s.market = 'WEST' and s.id like 'mfb-%'
 group by s.name order by s.name;
