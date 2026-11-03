-- Tanda 1197 — El hilo del foro de cada evento (PINGU: «desde el panel de
-- admin yo creo un hilo en el foro… quizá tenemos que crear una categoría
-- nueva»; eligió lo recomendado: un foro «Eventos y quedadas» en Comunidad,
-- detrás de Anuncios, donde solo el equipo abre temas y responde todo el
-- mundo).
--
-- 1. El foro, con `post_policy = 'staff'`: las políticas del foro ya dejan
--    abrir temas ahí solo al equipo (`forum_threads_insert`) y responder a
--    cualquiera (`forum_posts_insert`). Se busca por su slug, `eventos`.
-- 2. `eventos.hilo_id`: el hilo de cada evento (lo abre /admin al publicar).
--    Si se borra el hilo, el evento sigue (`on delete set null`); si se
--    borra el evento, el hilo se queda con lo que se habló.
-- Las funciones de la 1192 lo devuelven solo (`evento_json` es `to_jsonb`).
-- Se puede ejecutar dos veces; cada sentencia vale por sí sola (la 631): la
-- guarda va repetida en las dos primeras.

-- Hueco detrás de Anuncios: lo de después de Anuncios en Comunidad baja uno.
update public.forum_boards b
   set position = b.position + 1
  from public.forum_boards a
 where a.slug = 'anuncios'
   and b.section_id = a.section_id
   and b.parent_id is null
   and b.position > a.position
   and not exists (select 1 from public.forum_boards x where x.slug = 'eventos');

insert into public.forum_boards (section_id, parent_id, name, slug, description, position, post_policy, is_hidden)
select a.section_id, null, 'Eventos y quedadas', 'eventos',
       'Un hilo por cada evento de la agenda: quién va, qué llevas para cambiar y cómo llegar.',
       a.position + 1, 'staff', false
  from public.forum_boards a
 where a.slug = 'anuncios'
   and not exists (select 1 from public.forum_boards x where x.slug = 'eventos');

alter table public.eventos add column if not exists hilo_id uuid references public.forum_threads (id) on delete set null;

notify pgrst, 'reload schema';
