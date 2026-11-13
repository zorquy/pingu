-- Tanda 1330 — Latinoamérica (G9 del plan 2027): un foro por país, empezando
-- por México. Va en su propia sección, «Latinoamérica», al final del índice,
-- para que el resto del foro no cambie de sitio. Re-ejecutable: no repite la
-- sección ni el foro si ya están.

insert into public.forum_sections (name, position)
select 'Latinoamérica', coalesce((select max(position) from public.forum_sections), 0) + 1
 where not exists (select 1 from public.forum_sections where name = 'Latinoamérica');

insert into public.forum_boards (section_id, parent_id, name, slug, description, position, post_policy, is_hidden)
select s.id, null, 'México', 'mexico',
       'Para quien juega y colecciona en México: tiendas, torneos, precios en pesos y cambios en persona.',
       1, 'todos', false
  from public.forum_sections s
 where s.name = 'Latinoamérica'
   and not exists (select 1 from public.forum_boards x where x.slug = 'mexico');

notify pgrst, 'reload schema';
