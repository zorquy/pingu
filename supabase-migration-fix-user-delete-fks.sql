-- ============================================================
-- Arregla "Failed to delete user" al borrar una cuenta desde
-- Authentication en Supabase Studio. Varias tablas apuntan a
-- auth.users(id) sin ON DELETE CASCADE ni SET NULL, así que
-- Postgres bloquea el borrado del usuario con una violación de
-- clave foránea en cuanto tiene una sola fila en cualquiera de
-- ellas — y el Studio no muestra el motivo real, solo un [] vacío.
--
-- Reglas elegidas:
-- - user_profiles, account_deletion_requests, app_feedback,
--   content_reports: se borran junto con el usuario (son datos que
--   no tienen sentido sin él).
-- - client_errors, page_views, guides.author_id: se conservan y
--   solo se pone a NULL la referencia (el registro de error o la
--   vista de página sigue siendo útil, y una guía no debería
--   desaparecer porque su autor borre la cuenta — pasa a mostrarse
--   como "Guía oficial de PokeDoc", que ya es como se comporta el
--   código cuando author_id es null).
-- ============================================================

-- user_profiles no se creó con ningún script de este repo, así que
-- no sabemos el nombre exacto de su restricción — la buscamos en
-- vez de asumirlo.
do $$
declare
  fk record;
begin
  for fk in
    select conname from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.user_profiles drop constraint %I', fk.conname);
  end loop;

  alter table public.user_profiles
    add constraint user_profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
end $$;

-- El resto sí se creó con migraciones de este repo (referencia
-- inline sin nombre propio), así que Postgres les puso el nombre
-- automático <tabla>_<columna>_fkey.
alter table account_deletion_requests drop constraint if exists account_deletion_requests_user_id_fkey;
alter table account_deletion_requests add constraint account_deletion_requests_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table app_feedback drop constraint if exists app_feedback_user_id_fkey;
alter table app_feedback add constraint app_feedback_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table content_reports drop constraint if exists content_reports_reporter_id_fkey;
alter table content_reports add constraint content_reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete cascade;

alter table client_errors drop constraint if exists client_errors_user_id_fkey;
alter table client_errors add constraint client_errors_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table page_views drop constraint if exists page_views_user_id_fkey;
alter table page_views add constraint page_views_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table guides drop constraint if exists guides_author_id_fkey;
alter table guides add constraint guides_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;
