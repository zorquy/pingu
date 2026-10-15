-- Tanda 862 — las versiones de TCGGO en la colección.
--
-- `user_collection.variante` solo admitía las cuatro impresiones de TCGdex
-- (normal, reverse, holo, primera). TCGGO da además los patrones de Mega
-- Evolution («Energy Symbol Pattern», «Quick Ball»…) como versiones con
-- producto propio en Cardmarket (861), y PINGU quiere apuntar «tengo la
-- Quick Ball». La versión va con el id que le da la web: la etiqueta de
-- TCGGO en minúsculas, sin acentos y con guiones (`quick-ball`,
-- `energy-symbol-pattern`), de hasta 40 letras. Las cuatro de siempre
-- cumplen la forma, así que nada de lo guardado cambia.
--
-- Se puede ejecutar más de una vez. Cada sentencia va por su lado (la 631).

alter table public.user_collection drop constraint if exists user_collection_variante;

alter table public.user_collection add constraint user_collection_variante
  check (variante ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(variante) between 1 and 40);
