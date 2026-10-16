-- ════════════════════════════════════════════════════════════════════
-- Tanda 876: el subforo «Noticias» se esconde.
--
-- PINGU: «no sé si tiene sentido que las noticias generen un hilo en el
-- foro... normalmente se quedan sin comentarios y la gente comenta
-- directamente en la noticia». Desde la 876 una noticia ya NO abre hilo
-- (se fue js/noticias-foro.js); se comenta debajo del artículo, y esos
-- comentarios salen en «Lo que se está hablando» y en la actividad del
-- perfil.
--
-- El subforo se ESCONDE, no se borra: dentro quedan los hilos que se
-- abrieron desde la 273, con lo poco que se haya comentado. Escondido no
-- sale en el índice (ni para administración, desde la 876) ni en la
-- franja de arriba; los hilos siguen abriéndose por su dirección. Si
-- algún día se quiere borrar, es un `delete` de ese foro (los hilos y
-- mensajes van en cascada) — mejor con los enlaces viejos ya olvidados.
--
-- `guides.forum_thread_id` se queda: la columna la leen /admin y el hilo
-- de actividad (para no contar dos veces una noticia vieja).
--
-- Ejecutar en el SQL Editor de Supabase. Cada sentencia se sostiene sola.
-- ════════════════════════════════════════════════════════════════════

update public.forum_boards set is_hidden = true where slug = 'noticias';

-- Comprobación: tiene que salir UNA fila, con is_hidden = true.
select name, slug, is_hidden from public.forum_boards where slug = 'noticias';
