-- Tanda 867: el muro de los perfiles se va. Casi siempre vacío, para hablar
-- con alguien están los mensajes y el foro, y era la única pieza del
-- perfil que había que moderar. La web dejó de pintarlo en la 867; esta
-- migración borra lo que quedaba en la base: la tabla, sus políticas (se
-- van con ella) y los avisos de «comentarios en tu muro», que ya no llevan
-- a ningún sitio. Se ejecuta en el SQL Editor, cada sentencia por su lado.
delete from public.user_notifications where type = 'wall_comment';

drop table if exists public.profile_comments cascade;
