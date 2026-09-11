-- ════════════════════════════════════════════════════════════════════
-- El foro de Noticias, y el hilo de cada noticia (tanda 273)
--
-- Lo pidió PINGU: un subforo de noticias, y que cada noticia abra su
-- hilo sola —con un resumen y el enlace al artículo completo— como pasa
-- con los torneos.
--
-- Ejecutar en el SQL Editor de Supabase. No borra ni cambia nada.
-- ════════════════════════════════════════════════════════════════════

-- 1. Qué hilo es el de cada noticia ──────────────────────────────────
--
-- Los torneos buscan su hilo POR EL TÍTULO (`where title = 'Torneo: X'`).
-- Funciona, pero se rompe en cuanto alguien renombra el hilo desde la
-- moderación, y entonces el botón vuelve a ofrecer «anunciar» un torneo
-- que ya está anunciado. Aquí se guarda el identificador y ya.
--
-- Y es lo que hace que esto se pueda ejecutar dos veces sin abrir dos
-- hilos: si la columna tiene valor, no se abre nada.
--
-- `on delete set null`: si alguien borra el hilo desde la moderación, la
-- noticia se queda sin hilo (y se le puede abrir otro), no desaparece.
alter table public.guides
  add column if not exists forum_thread_id uuid
    references public.forum_threads (id) on delete set null;

comment on column public.guides.forum_thread_id is
  'El hilo del foro donde se comenta esta noticia. Lo abre solo '
  'js/noticias-foro.js al publicarla. Null = todavía no tiene.';

-- 2. El subforo ──────────────────────────────────────────────────────
--
-- `post_policy = 'staff'`: los temas los abre SOLO el equipo, porque los
-- abre la web sola al publicar. Ojo con lo que eso NO significa —
-- responder sigue siendo de todo el mundo: la política de
-- `forum_posts_insert` no mira `post_policy`, solo que el hilo no esté
-- cerrado y el foro no esté escondido. O sea, exactamente lo que hace
-- falta: nadie abre un hilo suelto, pero todo el mundo comenta.
--
-- Va en «Comunidad» y el PRIMERO (posición 0, por delante de Anuncios):
-- es el foro que va a tener movimiento a diario y el que trae gente de
-- fuera. «Anuncios» se queda para las novedades DE LA WEB, que es otra
-- cosa — ahí no encajan las cartas del 30 aniversario.
--
-- La guarda mira el slug: ejecutar esto dos veces no crea dos foros.
insert into public.forum_boards (section_id, parent_id, name, slug, description, position, post_policy, is_hidden)
select s.id, null, 'Noticias', 'noticias',
       'Las noticias del TCG, una por hilo. El artículo completo está en la web; aquí se comenta.',
       0, 'staff', false
  from public.forum_sections s
 where s.name = 'Comunidad'
   and not exists (select 1 from public.forum_boards b where b.slug = 'noticias');

-- 3. Que la API se entere ────────────────────────────────────────────
notify pgrst, 'reload schema';

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que salir UNA fila: el foro Noticias, en Comunidad, visible y de
-- tipo `staff`.
select b.name as foro, s.name as seccion, b.slug, b.position, b.post_policy, b.is_hidden
  from public.forum_boards b
  join public.forum_sections s on s.id = b.section_id
 where b.slug = 'noticias';
