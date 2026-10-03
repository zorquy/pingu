-- Tanda 472 — el idioma «chino» en la colección y en los deseos.
--
-- POR QUÉ HACE FALTA
--
-- Desde la tanda 437 se puede mirar el catálogo CHINO en /mi-coleccion, y
-- desde la 471 ese catálogo se llena solo. Pero el idioma con el que se
-- guardaba una carta seguía saliendo de una lista que no lo tenía, así que
-- quien añadía una carta china la guardaba como ESPAÑOLA. PINGU: «al haber
-- metido el filtro de inglés, debería añadirse en inglés… lo mismo con la
-- carta en japonés, en chino».
--
-- Las dos tablas tienen un CHECK con los idiomas permitidos, así que el
-- código nuevo no puede guardar 'zh' hasta que esto se ejecute. Y aquí el
-- fallo SÍ se ve: Postgres rechaza la fila y la web enseña el error. No es
-- de los silenciosos, pero hay que ejecutarlo igual.
--
-- CÓMO SE EJECUTA
--
-- Pégalo entero en el SQL Editor de Supabase y dale a Run. Es idempotente:
-- se puede ejecutar dos veces sin romper nada.
--
-- No toca ninguna fila: solo cambia qué valores se admiten de aquí en
-- adelante. Lo que ya está guardado sigue siendo válido.

-- ── 1. La colección ──
alter table public.user_collection
  drop constraint if exists user_collection_idioma;

alter table public.user_collection
  add constraint user_collection_idioma
  check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'zh'));

-- ── 2. Los deseos (los intercambios, tanda 376) ──
--
-- Aquí el idioma puede ser null, que significa «cualquier idioma»: eso no
-- se toca.
alter table public.user_wants
  drop constraint if exists user_wants_idioma;

alter table public.user_wants
  add constraint user_wants_idioma
  check (idioma is null or idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'zh'));

-- ── Comprobación ──
--
-- Debe devolver DOS filas, las dos con 'zh' dentro.
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conname in ('user_collection_idioma', 'user_wants_idioma');
