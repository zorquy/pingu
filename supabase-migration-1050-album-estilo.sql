-- Tanda 1050 — el aspecto de un álbum (Personalizar → Aspecto).
--
-- Un objeto con cuatro claves, todas opcionales:
--   · acabado  'lona' | 'piel' | 'mate' | 'holo'
--   · hojas    'grises' | 'negras' | 'blancas'
--   · cierre   'cremallera' | 'ninguno' | 'goma'
--   · ventana  'si' | 'no'   (la ventana de la tapa con la carta de portada)
-- Lo que falte o no se reconozca se pinta con lo de por defecto (lona, hojas
-- grises, cremallera y ventana): `estiloDe` en js/mi-coleccion/archivador.js.
-- Sin restricción a propósito: un valor nuevo de la web no tiene que esperar
-- a otra migración, y uno raro no rompe nada.
--
-- La web lee los álbumes con `select('*')` (la 759): sin esta columna, la
-- hoja de Personalizar enseña el color y los bolsillos y esconde lo demás.
-- Las políticas de `user_albums` ya cubren la columna nueva (son por fila).
-- Una sentencia (la 631).

alter table public.user_albums add column if not exists estilo jsonb;

notify pgrst, 'reload schema';
