-- ── Volver al orden del catálogo (tanda 552) ──
--
-- PINGU: «recolócame todas las eras por orden de Scrydex, porque no sé qué
-- he hecho aquí, he hecho un lío».
--
-- ── QUÉ ES «EL ORDEN DE SCRYDEX», Y QUÉ NO ──
--
-- Su catálogo no publica un número de orden de las ERAS: publica el nombre
-- de la serie de cada expansión y su fecha de salida. El orden que se veía
-- antes de tocar nada salía de ahí y es el que vuelve con esto: cada era
-- vale lo que su set MÁS NUEVO, y dentro de cada era mandan las fechas, lo
-- más nuevo arriba. Para el catálogo japonés eso da Mega Evolution,
-- Scarlet & Violet, Sword & Shield, Sun & Moon, XY… que es justo lo que
-- había en la captura.
--
-- O sea: esto no inventa un orden, QUITA el de a mano para que vuelva a
-- mandar el del catálogo.
--
-- ── LO QUE NO SE PIERDE ──
--
-- Los NOMBRES que les hayas puesto a las eras se quedan, y los sets que
-- hayas movido de era se quedan donde los pusiste: eso son decisiones, no
-- el lío. Lo único que se borra es el orden manual.

-- ═══ 1. Lo que hay ahora (solo lee) ═══
select market,
       count(*) filter (where orden is not null) as sets_colocados_a_mano,
       count(*) as sets
from public.tcg_sets group by market order by market;

select market, id, nombre, orden from public.tcg_eras order by market, orden, id;

-- ═══ 2. Fuera el orden manual de las colecciones ═══
--
-- Las dos consultas van por mercado por si algún día quieres deshacer solo
-- uno. Tal cual están, deshacen los dos.
update public.tcg_sets set orden = null where market = 'JP'   and orden is not null;
update public.tcg_sets set orden = null where market = 'WEST' and orden is not null;

-- ═══ 3. Y el de las eras ═══
--
-- `orden` vuelve a 0 en TODAS: con todas iguales, el desempate es el de
-- siempre —la era vale lo que su set más nuevo—, que es exactamente lo que
-- pasa cuando ninguna está colocada.
--
-- Las filas NO se borran: ahí viven los nombres que les hayas puesto.
update public.tcg_eras set orden = 0 where orden <> 0;

-- Si además quieres perder los nombres y volver a los del catálogo,
-- descomenta esta línea. Por defecto NO se tocan.
-- delete from public.tcg_eras;

-- ═══ 4. Cómo queda (solo lee) ═══
select (select count(*) from public.tcg_sets where orden is not null) as sets_colocados_a_mano,
       (select count(*) from public.tcg_eras where orden <> 0) as eras_colocadas_a_mano,
       (select count(*) from public.tcg_eras) as eras_con_nombre_propio;
