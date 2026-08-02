-- ============================================================
-- Migración: icono personalizado (dibujo) por categoría, en vez del
-- emoji de toda la vida. Se guarda en una columna aparte de
-- cover_image (que ya existe y se usa para la foto de portada grande
-- de la categoría) porque es un uso distinto: un icono pequeño en el
-- cuadradito de la tarjeta, no una foto de fondo.
-- ============================================================

alter table categories add column if not exists icon_image text;
