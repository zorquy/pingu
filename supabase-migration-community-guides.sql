-- ============================================================
-- Migración: guías de comunidad visibles antes de la aprobación.
-- Ejecutar en el SQL Editor de Supabase.
--
-- Hasta ahora una guía enviada a revisión (review_status = 'pending')
-- solo la podía leer su propio autor o un admin (guides_select exigía
-- published_at is not null). Para que la sección de Comunidad pueda
-- listar y abrir guías pendientes de revisión, se amplía la política de
-- lectura para incluir también las que están en 'pending'. Las guías en
-- 'draft' o 'rejected' siguen sin ser públicas (solo las ve su autor o
-- un admin) — no se han enviado o no pasaron la revisión.
-- ============================================================

drop policy if exists "guides_select" on guides;

create policy "guides_select" on guides
  for select
  using (published_at is not null or review_status = 'pending' or auth.uid() = author_id or is_admin());
