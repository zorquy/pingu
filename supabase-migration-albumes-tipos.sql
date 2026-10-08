-- Tanda 759 — Mis álbumes: álbum de un SET o BINDER personalizado (AL1–AL3).
--
-- PINGU, viendo Holonook: «el álbum puede ser de un set o personalizado;
-- el del set se rellena solo; el personalizado, con un pop-up del tamaño».
-- Lo que se añade a `user_albums`:
--   · tipo      'set' (lleno y ordenado desde una expansión) o 'binder';
--   · set_id + set_market + set_modo ('entero' con secretas, 'oficial' solo
--     la numeración impresa): de qué expansión es un álbum de set;
--   · rejilla   bolsillos por hoja: '2x2', '3x3', '3x4' o '4x4';
--   · paginas   las hojas del binder (10, 20 o 40), aunque estén vacías;
--   · tapa      el color de la tapa, que hasta ahora era uno para todos y
--               vivía en el navegador (tanda 371).
--
-- La web lee los álbumes con `select('*')` y, si estas columnas no están,
-- crea los álbumes sin ellas: no hay que ejecutar esto ANTES de empujar (la
-- norma de la 624), pero sin ello un álbum de set se ve como un binder y
-- los bolsillos son siempre nueve.
--
-- Sin tablas temporales y sentencia a sentencia (la 631): cada una vale
-- sola en el SQL Editor.

alter table public.user_albums add column if not exists tipo text not null default 'binder';
alter table public.user_albums add column if not exists set_id text;
alter table public.user_albums add column if not exists set_market text;
alter table public.user_albums add column if not exists set_modo text;
alter table public.user_albums add column if not exists rejilla text not null default '3x3';
alter table public.user_albums add column if not exists paginas int;
alter table public.user_albums add column if not exists tapa text;

alter table public.user_albums drop constraint if exists user_albums_tipo;
alter table public.user_albums add constraint user_albums_tipo check (tipo in ('set', 'binder'));

alter table public.user_albums drop constraint if exists user_albums_set_modo;
alter table public.user_albums add constraint user_albums_set_modo check (set_modo is null or set_modo in ('entero', 'oficial'));

alter table public.user_albums drop constraint if exists user_albums_rejilla;
alter table public.user_albums add constraint user_albums_rejilla check (rejilla in ('2x2', '3x3', '3x4', '4x4'));

alter table public.user_albums drop constraint if exists user_albums_paginas;
alter table public.user_albums add constraint user_albums_paginas check (paginas is null or paginas between 1 and 120);

-- Un álbum de set sabe de qué set es: sin `set_id` sería un binder con
-- otro nombre.
alter table public.user_albums drop constraint if exists user_albums_set_con_set;
alter table public.user_albums add constraint user_albums_set_con_set check (tipo <> 'set' or set_id is not null);
