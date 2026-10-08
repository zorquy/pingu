-- Tanda 764 — Z4: la portada de un binder, una carta tuya.
--
-- En la rejilla de Mis álbumes (759) un binder enseña su tapa con sus cuatro
-- primeras cartas; con esto, la que elijas, grande. Es el id de una carta
-- (`tcg_cards.id`), sin clave ajena a propósito: si esa carta se borra del
-- catálogo, el binder vuelve a la hojita, no se rompe. La web la lee con
-- `select('*')` (la 759): sin esta columna, el botón de portada no sale.
-- Una sentencia (la 631).

alter table public.user_albums add column if not exists portada text;

notify pgrst, 'reload schema';
