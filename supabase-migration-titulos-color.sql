-- Color para los títulos del foro
-- ============================================================
--
-- El título que un admin le pone a alguien ("Perito de falsificaciones")
-- ya existía; esto le añade un color, elegido también desde /admin. Es lo
-- que hace que un título se lea como un reconocimiento y no como una
-- línea más — el dorado de un veterano, el rojo del staff.
--
-- La columna guarda un color hex (#rrggbb) y NADA más: la restricción de
-- abajo lo impone en la base, porque este valor acaba dentro de un
-- atributo style y ahí no puede entrar texto libre de nadie. La pantalla
-- valida lo mismo antes de pintarlo (js/tema.js), pero la base es el
-- único sitio que no se puede esquivar.
--
-- Necesita supabase-migration-foro-titulos.sql (la de forum_title).
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

alter table public.user_profiles
  add column if not exists forum_title_color text;

alter table public.user_profiles
  drop constraint if exists user_profiles_forum_title_color_hex;
alter table public.user_profiles
  add constraint user_profiles_forum_title_color_hex
  check (forum_title_color is null or forum_title_color ~ '^#[0-9a-fA-F]{6}$');

comment on column public.user_profiles.forum_title_color is
  'Color hex (#rrggbb) del título del foro, puesto por un admin. Solo hex: acaba en un atributo style.';

commit;

-- Que PostgREST vea la columna nueva sin esperar.
notify pgrst, 'reload schema';

-- ── Comprobación ──
-- select username, forum_title, forum_title_color
--   from public.user_profiles where forum_title is not null;
