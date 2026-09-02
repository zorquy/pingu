-- ============================================================
-- Migración: icono personalizado (dibujo) por categoría, en vez del
-- emoji de toda la vida. Se guarda en una columna aparte de
-- cover_image (que ya existe y se usa para la foto de portada grande
-- de la categoría) porque es un uso distinto: un icono pequeño en el
-- cuadradito de la tarjeta, no una foto de fondo.
-- ============================================================

alter table categories add column if not exists icon_image text;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
