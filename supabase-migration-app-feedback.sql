-- ============================================================
-- Migración: feedback general de producto (bugs, sugerencias),
-- separado del sistema de "reportar contenido" (content_reports),
-- que es para denunciar algo que ha publicado otro usuario.
-- ============================================================

create table if not exists app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  body text not null,
  page_url text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table app_feedback enable row level security;

-- Cualquier usuario logueado puede mandar feedback (como sí mismo).
drop policy if exists "app_feedback_insert_own" on app_feedback;
create policy "app_feedback_insert_own" on app_feedback
  for insert with check (auth.uid() = user_id);

-- Solo el equipo puede verlo y gestionarlo (is_admin() ya existe de
-- migraciones anteriores).
drop policy if exists "app_feedback_admin_select" on app_feedback;
create policy "app_feedback_admin_select" on app_feedback
  for select using (is_admin());

drop policy if exists "app_feedback_admin_update" on app_feedback;
create policy "app_feedback_admin_update" on app_feedback
  for update using (is_admin());
