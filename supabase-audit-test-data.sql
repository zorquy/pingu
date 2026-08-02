-- ============================================================
-- Auditoría de posibles datos de prueba en la base real.
-- Solo hace SELECT, no borra ni modifica nada — pensado para
-- repasar a mano en el SQL Editor de Supabase antes de invitar a
-- testers, y decidir qué limpiar (si es que hay algo que limpiar).
--
-- Nota: esto es un script de diagnóstico, no una migración. No he
-- podido comprobar qué hay realmente en tu base — solo busca
-- patrones típicos de contenido de prueba (títulos con "test",
-- "prueba", "lorem", relleno numerado, etc.).
-- ============================================================

-- Guías con pinta de ser de prueba/relleno.
select id, title, slug, review_status, author_id, created_at
from guides
where title ~* '(test|prueba|xss|lorem ipsum|relleno|placeholder)'
   or slug ~* '(test|prueba|xss|lorem|relleno|placeholder|^g-page-)'
order by created_at desc;

-- Categorías con pinta de ser de prueba.
select id, name, slug
from categories
where name ~* '(test|prueba|placeholder)'
   or slug ~* '(test|prueba|placeholder)';

-- Perfiles con pinta de ser de prueba (no borres tu propia cuenta ni
-- la de gente real por error: revisa cada fila a mano).
select id, username, display_name, is_admin, created_at
from user_profiles
where username ~* '(test|prueba|admin-test|demo)'
   or display_name ~* '(test|prueba|demo)';

-- Comentarios/reseñas con pinta de ser de prueba.
select id, body, created_at from profile_comments where body ~* '(test|prueba)' order by created_at desc;
select id, body, created_at from guide_comments where body ~* '(test|prueba)' order by created_at desc;

-- Recuento general, para hacerte una idea del volumen de contenido
-- real que ya hay antes de invitar a nadie.
select
  (select count(*) from guides where review_status = 'approved') as guias_aprobadas,
  (select count(*) from guides where review_status = 'pending') as guias_pendientes,
  (select count(*) from user_profiles) as usuarios_totales,
  (select count(*) from user_profiles where is_admin) as admins;

-- ── Borrado ──
-- Una vez identificadas a mano las filas que SÍ son de prueba, bórralas
-- por id explícito (no hay un DELETE genérico aquí a propósito, para no
-- arriesgarse a borrar contenido real con un patrón demasiado amplio):
--
--   delete from guides where id in ('...', '...');
--   delete from user_profiles where id in ('...', '...');
