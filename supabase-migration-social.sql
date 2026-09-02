-- ============================================================
-- Migración: contenido colaborativo + perfiles sociales
-- Ejecuta este script completo en el SQL Editor de Supabase.
-- No borra ni modifica ninguna fila existente: todas las columnas
-- nuevas tienen un valor por defecto que mantiene el comportamiento
-- actual (todo lo publicado hasta ahora queda como review_status
-- = 'approved').
-- ============================================================

-- 1. Guías colaborativas ---------------------------------------
-- Cualquier usuario registrado puede crear una guía (author_id),
-- que empieza en 'draft', pasa a 'pending' al enviarla a revisión,
-- y un admin la aprueba ('approved', se le añade published_at) o
-- la rechaza ('rejected', con rejection_reason).

alter table guides add column if not exists author_id uuid references auth.users(id);
alter table guides add column if not exists review_status text not null default 'approved'
  check (review_status in ('draft', 'pending', 'approved', 'rejected'));
alter table guides add column if not exists rejection_reason text;
alter table guides add column if not exists submitted_at timestamptz;

-- Las dos políticas de lectura pública actuales dejan ver TODAS las
-- filas (incluidos borradores ajenos). Las sustituimos por una que
-- solo muestra lo publicado, o lo tuyo, o todo si eres admin.
drop policy if exists "guides_public_read" on guides;
drop policy if exists "Public read guides" on guides;

drop policy if exists "guides_select" on guides;
create policy "guides_select" on guides
  for select
  using (published_at is not null or auth.uid() = author_id or is_admin());

-- El autor puede crear filas propias (empezando en draft o pending).
drop policy if exists "guides_author_insert" on guides;
create policy "guides_author_insert" on guides
  for insert
  with check (auth.uid() = author_id and review_status in ('draft', 'pending'));

-- El autor puede editar sus propias filas SOLO mientras están en
-- draft o rejected (una vez en pending/approved, ya no puede tocarlas
-- sin pasar de nuevo por revisión admin).
drop policy if exists "guides_author_update" on guides;
create policy "guides_author_update" on guides
  for update
  using (auth.uid() = author_id and review_status in ('draft', 'rejected'))
  with check (auth.uid() = author_id and review_status in ('draft', 'pending'));

-- El autor puede borrar sus propios borradores/rechazados.
drop policy if exists "guides_author_delete" on guides;
create policy "guides_author_delete" on guides
  for delete
  using (auth.uid() = author_id and review_status in ('draft', 'rejected'));

-- La política "Admin write guides" (ALL, is_admin()) ya existente
-- no se toca: el admin sigue pudiendo crear/editar/borrar cualquier
-- guía, incluidas las de otros usuarios, para aprobarlas/rechazarlas.

-- 2. Perfiles personalizables ------------------------------------
alter table user_profiles add column if not exists bio text;
alter table user_profiles add column if not exists banner_color text;
alter table user_profiles add column if not exists showcase_achievement text;

-- Ahora mismo solo puedes leer tu propia fila (o ser admin). Para
-- que existan perfiles públicos (muro, reseñas, guías del autor)
-- hace falta lectura pública. Las políticas existentes
-- (user_profiles_own, Admin read profiles, Admin update profiles)
-- no se tocan; esta política adicional solo AMPLÍA quién puede leer.
drop policy if exists "user_profiles_public_read" on user_profiles;
create policy "user_profiles_public_read" on user_profiles
  for select
  using (true);

-- 3. Muro de comentarios en el perfil -----------------------------
create table if not exists profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table profile_comments enable row level security;

drop policy if exists "profile_comments_select" on profile_comments;
create policy "profile_comments_select" on profile_comments
  for select using (true);

drop policy if exists "profile_comments_insert" on profile_comments;
create policy "profile_comments_insert" on profile_comments
  for insert with check (auth.uid() = author_id);

-- Puede borrar el comentario quien lo escribió, el dueño del muro
-- (moderar su propio perfil) o un admin.
drop policy if exists "profile_comments_delete" on profile_comments;
create policy "profile_comments_delete" on profile_comments
  for delete using (auth.uid() = author_id or auth.uid() = profile_id or is_admin());

-- 4. Reseñas entre usuarios -----------------------------------------
create table if not exists profile_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (profile_id, reviewer_id)
);

alter table profile_reviews enable row level security;

drop policy if exists "profile_reviews_select" on profile_reviews;
create policy "profile_reviews_select" on profile_reviews
  for select using (true);

drop policy if exists "profile_reviews_insert" on profile_reviews;
create policy "profile_reviews_insert" on profile_reviews
  for insert with check (auth.uid() = reviewer_id and reviewer_id <> profile_id);

drop policy if exists "profile_reviews_update" on profile_reviews;
create policy "profile_reviews_update" on profile_reviews
  for update using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

-- A propósito: el reseñado NO puede borrar reseñas que no le gusten,
-- solo quien la escribió o un admin. Así una reseña negativa pesa de verdad.
drop policy if exists "profile_reviews_delete" on profile_reviews;
create policy "profile_reviews_delete" on profile_reviews
  for delete using (auth.uid() = reviewer_id or is_admin());

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
