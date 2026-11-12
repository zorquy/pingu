-- Tanda 1305 — los dos cubos de fotos más viejos, con límite.
--
-- `avatars` (avatar, portada del perfil, imagen de un torneo) y
-- `guide-images` (las fotos de las guías y del foro) nacieron sin tope de
-- tamaño ni de tipo: cualquiera con cuenta podía subir a su carpeta un
-- fichero de cualquier peso y de cualquier tipo —también un SVG o un HTML,
-- que el almacén sirve tal cual en una dirección pública—. Los cubos nuevos
-- (mensajes, tiendas, avisos) ya llevan los dos topes; estos dos, ahora
-- también: 5 MB (lo que ya dice la web, `MAX_IMAGE_MB`) y solo fotos.
--
-- Lo ya subido no se toca: el tope se mira al subir. Re-ejecutable.

update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  where id in ('avatars', 'guide-images');
