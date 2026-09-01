-- ═══════════════════════════════════════════════════════════════════
-- EL FORO DE TORNEOS (tanda 247)
--
-- Desde la tanda 247, el botón «Anunciar en el foro» de la ficha de un
-- torneo abre el hilo en el foro de TORNEOS (sección «Juego») en vez de
-- en el primero de la lista. Lo busca por nombre, porque la estructura
-- del foro vive en la base y se cambia desde /admin sin desplegar.
--
-- Si ese foro ya existe —creado a mano desde /admin— este fichero NO
-- HACE NADA: la guarda de abajo se salta la inserción en cuanto hay
-- CUALQUIER foro cuyo nombre o slug empiece por «torneo». Solo hace
-- falta ejecutarlo si «Juego → Torneos» todavía no está.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- La sección. Va al final del índice (position 4: detrás de Comunidad,
-- Colección y Café), que es donde encaja algo que se estrena.
--
-- La MISMA guarda que el foro de abajo, y no solo «¿existe la sección
-- Juego?»: si el foro de torneos ya vive en otra sección («Jugar», por
-- ejemplo), crear «Juego» dejaría en el índice una sección con la
-- cabecera puesta y nada debajo.
insert into public.forum_sections (name, position)
select 'Juego', 4
 where not exists (select 1 from public.forum_sections s where lower(s.name) = 'juego')
   and not exists (
     select 1 from public.forum_boards b
      where lower(b.name) like 'torneo%' or lower(b.slug) like 'torneo%'
   );

-- El foro. La guarda mira nombre Y slug para no duplicar lo que ya
-- exista con otro nombre («Torneos y ligas», «torneos-pokedoc»…).
insert into public.forum_boards (section_id, parent_id, name, slug, description, position, post_policy, is_hidden)
select s.id, null, 'Torneos', 'torneos',
       'Los torneos de PokeDoc: anuncios, dudas y lo que se cuece en cada uno.',
       1, 'todos', false
  from public.forum_sections s
 where lower(s.name) = 'juego'
   and not exists (
     select 1 from public.forum_boards b
      where lower(b.name) like 'torneo%' or lower(b.slug) like 'torneo%'
   );

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que salir UNA fila, y su sección tiene que ser «Juego» para que
-- el desplegable del anuncio lo elija con la regla más precisa.
select b.name as foro, s.name as seccion, b.slug, b.is_hidden
  from public.forum_boards b
  join public.forum_sections s on s.id = b.section_id
 where lower(b.name) like 'torneo%' or lower(b.slug) like 'torneo%';
