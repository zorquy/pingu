-- ============================================================
-- Migración: "Guía Pro" — una pestaña extra por guía (aparte de la
-- Documentación y el Curso, que siguen siendo siempre gratis) con
-- contenido exclusivo para usuarios Pro. Vive en su propia tabla para
-- que la protección sea de verdad a nivel de RLS: a un usuario sin Pro,
-- Supabase ni siquiera le devuelve la fila, así que no basta con
-- esconder el botón en el frontend para saltárselo por la API.
-- ============================================================

-- Bandera pública y cosmética (no expone el contenido, solo dice "existe
-- una pestaña Pro publicada para esta guía") para que el frontend sepa si
-- mostrar la pestaña "Guía Pro" sin necesitar acceso al contenido real.
alter table guides add column if not exists has_pro_content boolean not null default false;

create table if not exists guide_pro_content (
  guide_id uuid primary key references guides(id) on delete cascade,
  blocks jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table guide_pro_content enable row level security;

-- Usuarios Pro: solo pueden leer contenido ya publicado.
create policy "guide_pro_content_select_pro" on guide_pro_content
  for select using (
    published_at is not null
    and exists (select 1 from user_profiles where id = auth.uid() and is_pro = true)
  );

-- Equipo de moderación: acceso total (editar el borrador antes de publicar, etc.).
create policy "guide_pro_content_admin_all" on guide_pro_content
  for all using (is_admin()) with check (is_admin());
