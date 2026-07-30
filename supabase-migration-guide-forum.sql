-- ============================================================
-- Migración: comentarios de guía estilo foro (citar/responder).
-- ============================================================

alter table guide_comments add column if not exists reply_to_id uuid references guide_comments(id) on delete set null;
