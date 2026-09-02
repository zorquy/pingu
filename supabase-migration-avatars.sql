-- ============================================================
-- Migración: avatares y banners personalizados
-- Ejecuta esto ADEMÁS de supabase-migration-social.sql (no lo
-- sustituye, y no pasa nada si ya ejecutaste aquel antes).
-- ============================================================

-- 1. Columnas para las imágenes (si hay avatar_url/banner_url, la web
--    las usa en vez del color plano avatar_color/banner_color).
alter table user_profiles add column if not exists avatar_url text;
alter table user_profiles add column if not exists banner_url text;

-- 2. Bucket de Storage público para avatares y banners.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Políticas: lectura pública, y cada usuario solo puede subir/editar/
--    borrar archivos dentro de su propia carpeta (avatars/<su-user-id>/...).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
