-- Diagnóstico de las imágenes que faltan (tandas 431 y 432).
--
-- ESTO NO CAMBIA NADA: son SELECT.
--
-- ── LO QUE YA SE SABE ──
--
-- 21.721 cartas, 1.231 sin `image_path` (5,7 %):
--
--   · 619 están en sets CON código de TCG Live, y esas YA SE VEN: la
--     cadena de escaneo monta la dirección de Limitless con el código, sin
--     necesitar la columna. Rellenarla no cambiaría nada en pantalla.
--   · 612 están en sets SIN código. De esas, 120 son las cuatro Trainer
--     Gallery, que tienen arreglo (ver supabase-migration-trainer-gallery
--     .sql) y las otras ~492 son trainer kits, McDonald's y promos sueltas
--     de las que TCGdex NO TIENE escaneo: `image_path` sale de `card.image`
--     del listado del set, así que un null ahí significa que no lo hay, y
--     reimportar daría null otra vez.
--
-- Y de los 41 sets sin logo ni símbolo, 37 ya los ha visitado `curarSet`.
-- Las dos columnas del cerrojo existen, así que la hipótesis de «la
-- migración sin ejecutar» queda descartada.
--
-- ── LA PREGUNTA QUE QUEDA ──
--
-- `faltaVisitar` usa DOS llaves:
--
--     if ('curado_v' in fila && (fila.curado_v ?? 0) < VERSION_CURADO) return true
--     if ('curado_at' in fila) return !fila.curado_at
--
-- Con `VERSION_CURADO = 1`, un set con `curado_v` a NULL vuelve a
-- visitarse; uno con `curado_v = 1` ya no. Y eso cambia el diagnóstico
-- por completo:
--
--   · si los 37 tienen `curado_v = 1` → el curador que SÍ sabe de logos
--     ya pasó por ellos y volvió con las manos vacías: TCGdex no tiene
--     logo de esos sets, y no hay nada que arreglar en nuestro código;
--   · si tienen `curado_v` a NULL → es que la función programada todavía
--     no ha llegado; van por fecha de más nuevo a más viejo y casi todos
--     son viejos. Entonces se arregla SOLO, con paciencia.

select
  count(*) as sets_sin_dibujo,
  count(*) filter (where curado_v is null) as sin_version_volveran,
  count(*) filter (where curado_v is not null) as ya_con_version,
  min(curado_at) as visita_mas_vieja,
  max(curado_at) as visita_mas_nueva
from tcg_sets
where market = 'WEST' and logo_path is null and symbol_url is null;

-- Y los diez primeros, con su estado, por si hay que mirar alguno a mano.
select id, name, tcg_online_code, release_date, curado_at, curado_v
from tcg_sets
where market = 'WEST' and logo_path is null and symbol_url is null
order by release_date desc nulls last
limit 10;
