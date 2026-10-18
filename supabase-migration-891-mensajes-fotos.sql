-- ============================================================
-- Tanda 891: fotos en los mensajes privados, y «mensaje eliminado».
--
-- PINGU: «mejora el apartado de los mensajes privados y mete la opción de
-- poder adjuntar imágenes». Tres cosas:
--
--   1. `private_messages.adjuntos`: la lista de fotos de un mensaje, como
--      [{"ruta": "<conversación>/<id>.webp", "w": 1200, "h": 1600}].
--      Hasta 4. Las medidas van guardadas para reservar el hueco antes de
--      que llegue la foto (la norma de la casa). Un mensaje puede ser
--      solo fotos, sin texto.
--   2. `private_messages.deleted_at`: borrar un mensaje ya no lo quita
--      de la conversación: lo deja como «Mensaje eliminado», sin texto ni
--      fotos, para que la otra persona no vea un hueco. Quien lo escribió
--      lo puede marcar; nadie más.
--   3. El cubo `mensajes-adjuntos`, PRIVADO: una carpeta por conversación
--      y solo los dos participantes pueden leer, subir y borrar. Al
--      contrario que las imágenes del foro (guide-images), nadie con el
--      enlace ve la foto: el navegador pide una dirección firmada y
--      Storage comprueba la política antes de dársela.
--
-- Se puede ejecutar más de una vez. Cada sentencia va por su lado (631).
-- ============================================================

-- ── 1 y 2. Columnas ──
alter table public.private_messages add column if not exists adjuntos jsonb not null default '[]'::jsonb;
alter table public.private_messages add column if not exists deleted_at timestamptz;

alter table public.private_messages drop constraint if exists private_messages_adjuntos_lista;
alter table public.private_messages add constraint private_messages_adjuntos_lista
  check (jsonb_typeof(adjuntos) = 'array' and jsonb_array_length(adjuntos) <= 4);

-- Un mensaje tiene texto, o fotos, o está eliminado. `not valid` porque
-- se aplica a lo que entre desde ahora: lo viejo no se revisa.
alter table public.private_messages drop constraint if exists private_messages_con_algo;
alter table public.private_messages add constraint private_messages_con_algo
  check (deleted_at is not null or char_length(body) > 0 or jsonb_array_length(adjuntos) > 0) not valid;

-- Quien lo escribió puede marcarlo como eliminado (y solo eso: el
-- `with check` exige que siga siendo suyo). El borrado de verdad de antes
-- se queda como respaldo para un cliente viejo en caché.
drop policy if exists private_messages_update on public.private_messages;
create policy private_messages_update on public.private_messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- ── 3. El cubo privado ──
-- 3 MB por fichero: el navegador comprime a 1.600 px y WebP antes de
-- subir (js/imagen-comprimir.js), así que una foto normal se queda en
-- 200–300 KB; el tope es por si alguien se salta el cliente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mensajes-adjuntos', 'mensajes-adjuntos', false, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- La carpeta de un fichero es la conversación: `<uuid>/<fichero>`. Se
-- comprueba la forma antes del cast, que un nombre raro no puede tirar la
-- política con un error de uuid.
create or replace function public.mensajes_adjunto_es_mio(nombre text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (storage.foldername(nombre))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.is_conversation_participant(((storage.foldername(nombre))[1])::uuid);
$$;

drop policy if exists "mensajes_adjuntos_select" on storage.objects;
create policy "mensajes_adjuntos_select" on storage.objects
  for select to authenticated using (bucket_id = 'mensajes-adjuntos' and public.mensajes_adjunto_es_mio(name));

drop policy if exists "mensajes_adjuntos_insert" on storage.objects;
create policy "mensajes_adjuntos_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'mensajes-adjuntos' and public.mensajes_adjunto_es_mio(name));

drop policy if exists "mensajes_adjuntos_delete" on storage.objects;
create policy "mensajes_adjuntos_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'mensajes-adjuntos' and public.mensajes_adjunto_es_mio(name));

notify pgrst, 'reload schema';
