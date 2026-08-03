-- ============================================================
-- Comentarios de guía estilo foro (citar/responder).
--
-- SI NO SE EJECUTA, NADIE PUEDE COMENTAR EN NINGUNA GUÍA. El código
-- manda `reply_to_id` en cada comentario, también en los que no
-- responden a nadie (va a null), así que sin esta columna PostgREST
-- rechaza la fila entera con:
--
--   Could not find the 'reply_to_id' column of 'guide_comments'
--   in the schema cache
--
-- No es un fallo del formulario ni del texto: es esta columna.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- `on delete set null` y no `cascade` a propósito: si se borra un
-- comentario, sus respuestas NO deben desaparecer con él. Se quedan
-- como comentarios sueltos, que es lo que espera quien los escribió.
alter table guide_comments
  add column if not exists reply_to_id uuid references guide_comments (id) on delete set null;

-- El hilo pide las respuestas de un comentario al pintar cada página.
create index if not exists guide_comments_reply_to_idx
  on guide_comments (reply_to_id)
  where reply_to_id is not null;

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Tiene que devolver UNA fila. Si sale vacía, la columna no se ha
-- creado y comentar seguirá fallando.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'guide_comments' and column_name = 'reply_to_id';

-- Cuántos comentarios hay y cuántos son respuestas.
select
  count(*) as comentarios,
  count(*) filter (where reply_to_id is not null) as son_respuestas
from guide_comments;
