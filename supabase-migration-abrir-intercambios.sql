-- ════════════════════════════════════════════════════════════════════
-- Abrir el foro de Intercambios (tanda 264)
-- ════════════════════════════════════════════════════════════════════
--
-- No se crea nada: el foro ESTÁ desde supabase-migration-foro.sql, en
-- la sección «Colección», con `is_hidden = true`. Se dejó preparado a
-- propósito («un foro preparado pero todavía sin enseñar, para abrirlo
-- el día que haga falta — Intercambios, sin ir más lejos») y ese día
-- llegó: alguien abrió un tema de intercambio el 2026-09-07.
--
-- Se ejecuta en el SQL Editor. Es reversible con un update igual
-- poniendo true, y no toca ningún tema ni ningún mensaje.

begin;

update public.forum_boards
   set is_hidden = false
 where slug = 'intercambios';

commit;

-- ────────────────────────────────────────────────────────────────────
-- Comprobación (opcional)
-- ────────────────────────────────────────────────────────────────────
-- select name, slug, is_hidden from public.forum_boards
--  where slug = 'intercambios';
