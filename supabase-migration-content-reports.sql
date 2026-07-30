-- ============================================================
-- Migración: reportar contenido inapropiado (guías, comentarios
-- del muro, comentarios de guía, reseñas de perfil).
-- ============================================================

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) not null,
  content_type text not null check (content_type in ('guide', 'profile_comment', 'guide_comment', 'profile_review')),
  content_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table content_reports enable row level security;

-- Cualquier usuario logueado puede reportar (como sí mismo).
create policy "content_reports_insert_own" on content_reports
  for insert with check (auth.uid() = reporter_id);

-- Solo el equipo de moderación puede ver y gestionar los reportes
-- (is_admin() ya existe de migraciones anteriores).
create policy "content_reports_admin_select" on content_reports
  for select using (is_admin());

create policy "content_reports_admin_update" on content_reports
  for update using (is_admin());
