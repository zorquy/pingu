-- Tanda 1226: el Pokémon de cada tema de Aprender (PINGU eligió la A de la
-- propuesta: «un Pokémon que tenga que ver» con el tema).
--
-- `categories.pokemon` es el número de la Pokédex del dibujo que lleva la
-- baldosa del tema en /aprender; se cambia en /admin → Guías → Categorías.
-- Vacío, la web lo elige por las palabras del nombre (js/temas-pokemon.js) y,
-- si no casa con nada, enseña el icono del tema.
--
-- Se puede ejecutar más de una vez: solo rellena los que estén vacíos. Cada
-- sentencia va sola (la 631).

alter table public.categories add column if not exists pokemon integer;

update public.categories
set pokemon = case
  when lower(name) ~ '(primeros?|empezar|principiante)' then 172  -- Pichu: el primero de su línea
  when lower(name) ~ '(comprar|vender|venta|cambiar|precio)' then 52  -- Meowth: Día de Pago
  when lower(name) ~ '(real|falsa|falso|falsific)' then 132  -- Ditto: se hace pasar por otro
  when lower(name) ~ 'identific' then 201  -- Unown: leer lo que pone
  when lower(name) ~ '(historia|curiosidad)' then 142  -- Aerodactyl: un fósil
  when lower(name) ~ '(mazo|estrategia|competitivo)' then 65  -- Alakazam: CI de 5.000
end
where pokemon is null
  and lower(name) ~ '(primeros?|empezar|principiante|comprar|vender|venta|cambiar|precio|real|falsa|falso|falsific|identific|historia|curiosidad|mazo|estrategia|competitivo)';
