-- Los casos de la 803. Cada uno escribe una fila en `resultado` (ok/MAL).
\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated;
update public.user_profiles set is_news_writer = true where username = 'redactora';

set role authenticated;

-- ── Redactora ──
set prueba.uid = '00000000-0000-0000-0000-00000000000b';
insert into guides (id, author_id, title, review_status, kind) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Noticia R', 'draft', 'news');
insert into resultado (caso, ok) select 'la redactora crea un borrador de noticia y sigue siendo noticia', kind = 'news' from guides where id = '10000000-0000-0000-0000-000000000001';
update guides set review_status = 'approved', published_at = '2000-01-01' where id = '10000000-0000-0000-0000-000000000001';
insert into resultado (caso, ok) select 'la redactora publica su noticia: approved y con fecha de AHORA (no la que manda)', review_status = 'approved' and published_at > now() - interval '1 minute' from guides where id = '10000000-0000-0000-0000-000000000001';
update guides set kind = 'guide' where id = '10000000-0000-0000-0000-000000000001';
insert into resultado (caso, ok) select 'una noticia publicada no vuelve a guía', kind = 'news' from guides where id = '10000000-0000-0000-0000-000000000001';
update guides set title = 'Noticia R corregida' where id = '10000000-0000-0000-0000-000000000001';
insert into resultado (caso, ok) select 'la redactora corrige su noticia publicada y sigue publicada', title = 'Noticia R corregida' and review_status = 'approved' from guides where id = '10000000-0000-0000-0000-000000000001';

insert into guides (id, author_id, title, review_status, kind) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Guía R', 'pending', 'guide');
do $$ begin
  update guides set review_status = 'approved' where id = '10000000-0000-0000-0000-000000000002';
  insert into resultado (caso, ok) values ('la redactora NO se publica una GUÍA', false);
exception when check_violation then
  insert into resultado (caso, ok) values ('la redactora NO se publica una GUÍA', true);
end $$;

update user_profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000b';
insert into resultado (caso, ok) select 'la redactora no se hace admin', not is_admin from user_profiles where id = '00000000-0000-0000-0000-00000000000b';

insert into forum_threads (board_id, author_id, title) select id, '00000000-0000-0000-0000-00000000000b', 'Hilo' from forum_boards where slug = 'noticias';
insert into resultado (caso, ok) select 'la redactora abre el hilo de su noticia en el foro Noticias', count(*) = 1 from forum_threads;
do $$ begin
  insert into forum_threads (board_id, author_id, title) select id, '00000000-0000-0000-0000-00000000000b', 'Hilo' from forum_boards where slug = 'anuncios';
  insert into resultado (caso, ok) values ('la redactora NO abre temas en Anuncios', false);
exception when insufficient_privilege then
  insert into resultado (caso, ok) values ('la redactora NO abre temas en Anuncios', true);
end $$;

-- ── Alguien normal ──
set prueba.uid = '00000000-0000-0000-0000-00000000000c';
insert into guides (id, author_id, title, review_status, kind) values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', 'Falsa', 'pending', 'news');
insert into resultado (caso, ok) select 'alguien normal no crea noticias: se queda en guía', kind = 'guide' from guides where id = '10000000-0000-0000-0000-000000000003';
do $$ begin
  update guides set kind = 'news', review_status = 'approved' where id = '10000000-0000-0000-0000-000000000003';
  insert into resultado (caso, ok) values ('alguien normal NO se publica nada pidiendo noticia + publicada', false);
exception when check_violation then
  insert into resultado (caso, ok) values ('alguien normal NO se publica nada pidiendo noticia + publicada', true);
end $$;
update user_profiles set is_news_writer = true where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select 'alguien normal no se da el rol de redactor', not is_news_writer from user_profiles where id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  insert into forum_threads (board_id, author_id, title) select id, '00000000-0000-0000-0000-00000000000c', 'Hilo' from forum_boards where slug = 'noticias';
  insert into resultado (caso, ok) values ('alguien normal NO abre temas en Noticias', false);
exception when insufficient_privilege then
  insert into resultado (caso, ok) values ('alguien normal NO abre temas en Noticias', true);
end $$;

-- ── Admin ──
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
update user_profiles set is_news_writer = true where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select 'el admin da el rol', is_news_writer from user_profiles where id = '00000000-0000-0000-0000-00000000000c';

-- ── Sin sesión (SQL Editor) ──
reset role;
set prueba.uid = '';
update guides set kind = 'news' where id = '10000000-0000-0000-0000-000000000003';
insert into resultado (caso, ok) select 'desde el SQL Editor se puede marcar como noticia', kind = 'news' from guides where id = '10000000-0000-0000-0000-000000000003';

select case when ok then 'ok  ' else 'MAL ' end || caso from resultado order by n;
