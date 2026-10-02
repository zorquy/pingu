-- Nidoran♀ y Nidoran♂ son DOS especies (tanda 460)
--
-- PINGU: «has metido al Nidoran macho dentro de la categoría de Nidoran
-- hembra en la Pokédex. Hay que hacer diferenciación entre estos dos».
--
-- Y tenía razón: al normalizar un nombre para buscar su número de Pokédex
-- se borraba todo lo que no fuera letra o número, así que los dos símbolos
-- de género desaparecían y «Nidoran♀» y «Nidoran♂» se quedaban los dos en
-- «nidoran». Ganaba el primero de la tabla —la hembra, el 29— y todas las
-- cartas del macho acababan en la ficha de la hembra, con su sprite y su
-- línea de evolución. No daba ningún error: la especie existe, la carta
-- existe y el número que salía era un número válido.
--
-- Arreglado en `js/torneos/sprites-pokemon.js` (el símbolo pasa a letra
-- antes de aplastar, igual que ya hacía el slug del sprite: nidoran-f y
-- nidoran-m). Pero `tcg_cards.dex_ids` SE GUARDA, y las filas que ya están
-- escritas se calcularon con el fallo: dicen {29} donde tiene que poner
-- {32}, y la función programada `cartas-pokedex` solo mira las que están a
-- null. O sea que el arreglo del cliente no las alcanza.
--
-- Esto las devuelve a la cola. Son unas pocas decenas de cartas en todo el
-- catálogo, así que la siguiente pasada de la función las recalcula y
-- quedan repartidas entre el 29 y el 32 como toca.
--
-- `null` y no `'{}'`: null es «no lo hemos mirado» y es lo que la función
-- busca; `{}` es «mirado, y no sale ningún Pokémon», que es otra cosa y la
-- dejaría fuera de la cola para siempre.

update public.tcg_cards
   set dex_ids = null
 where name ilike '%nidoran%'
    or name_es ilike '%nidoran%';

-- Para ver cuántas quedan pendientes después de ejecutarlo:
-- select count(*) from public.tcg_cards where name ilike '%nidoran%' and dex_ids is null;
