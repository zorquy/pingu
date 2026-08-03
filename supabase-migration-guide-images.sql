-- ============================================================
-- Migración: bucket de Storage para imágenes subidas en guías
-- (portada, documentación y bloques del curso). Ejecuta esto
-- ADEMÁS de las migraciones anteriores.
-- ============================================================

-- 1. Bucket público para imágenes de guías.
insert into storage.buckets (id, name, public)
values ('guide-images', 'guide-images', true)
on conflict (id) do nothing;

-- 2. Políticas: lectura pública, y cada usuario solo puede subir/editar/
--    borrar archivos dentro de su propia carpeta (guide-images/<su-user-id>/...).
drop policy if exists "guide_images_public_read" on storage.objects;
create policy "guide_images_public_read" on storage.objects
  for select using (bucket_id = 'guide-images');

drop policy if exists "guide_images_owner_insert" on storage.objects;
create policy "guide_images_owner_insert" on storage.objects
  for insert with check (bucket_id = 'guide-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guide_images_owner_update" on storage.objects;
create policy "guide_images_owner_update" on storage.objects
  for update using (bucket_id = 'guide-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "guide_images_owner_delete" on storage.objects;
create policy "guide_images_owner_delete" on storage.objects
  for delete using (bucket_id = 'guide-images' and (storage.foldername(name))[1] = auth.uid()::text);
