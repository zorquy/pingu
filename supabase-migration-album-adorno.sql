-- Tanda 411 — el adorno de un álbum soñado
--
-- PINGU: «para los álbumes, lo mismo: que puedas escoger el icono o lo de
-- la Pokédex. La única diferencia es que uno es una carpeta y otro es un
-- álbum».
--
-- `user_albums` SÍ está en producción desde la tanda 366, así que esto va
-- en su propio fichero y no editando el de las carpetas —que todavía no
-- se ha lanzado—. Las cuatro columnas son opcionales: un álbum sin adorno
-- sigue siendo un álbum, y los que ya existen no cambian.
--
-- Mismas tres columnas y misma precedencia que en `collection_folders`
-- (Pokémon > emoji > icono), para que la pieza que pinta la burbuja sea
-- UNA y no dos que se parecen.

alter table public.user_albums add column if not exists icono text;
alter table public.user_albums add column if not exists dex_id int;
alter table public.user_albums add column if not exists emoji text;
alter table public.user_albums add column if not exists color text;
