-- Devolverle su ERA a las galerías (tanda 433). ARREGLA UN FALLO MÍO.
--
-- `supabase-migration-trainer-gallery.sql` juntó las dos mitades de cada
-- Trainer Gallery: le pasó a la fila que tenía las cartas el código, la
-- fecha y el dibujo de su gemela vacía, y borró la gemela.
--
-- Se me olvidó `serie_id` — y la estantería agrupa POR AHÍ:
--
--     const clave = s.serie_id || ''
--
-- Así que las cuatro galerías salieron de «Espada y Escudo» y cayeron en
-- «Sin serie». Lo vio PINGU: «la Trainer Gallery de Silver Tempest
-- debería estar al lado de Silver Tempest».
--
-- Y la gemela ya no está para copiarle nada, así que la era hay que
-- sacarla de otro sitio. El mejor sitio es el NOMBRE, que es como lo dijo
-- PINGU y como lo entiende cualquiera: «Silver Tempest Trainer Gallery»
-- es de la era de «Silver Tempest». Nada de recortar identificadores
-- —`swsh12.5tg` menos `.5tg` da `swsh12`, pero eso es una regla que hay
-- que saberse y que se rompe en cuanto cambie el patrón.
--
-- Vale para «… Trainer Gallery» y «… Galarian Gallery», y es idempotente:
-- solo escribe donde falta.

begin;

update tcg_sets g
set serie_id   = coalesce(g.serie_id, padre.serie_id),
    serie_name = coalesce(g.serie_name, padre.serie_name),
    -- Y la fecha, por si quedó suelta: dentro de una era los sets van por
    -- fecha, así que sin ella la galería se iría al fondo de su era en
    -- vez de quedarse al lado de su set.
    release_date = coalesce(g.release_date, padre.release_date)
from tcg_sets padre
where g.market = 'WEST'
  and padre.market = g.market
  and g.serie_id is null
  and padre.serie_id is not null
  -- «Silver Tempest Trainer Gallery» → «Silver Tempest».
  and padre.name = regexp_replace(g.name, '\s+(Trainer|Galarian)\s+Gallery$', '')
  and g.name ~ '\s+(Trainer|Galarian)\s+Gallery$';

commit;

-- ── Para comprobar que ha ido bien ──
--
-- Las galerías tienen que salir con la misma serie que su set.
-- select g.id, g.name, g.serie_id, g.serie_name, g.release_date
-- from tcg_sets g
-- where g.market = 'WEST' and g.name ~ 'Gallery$'
-- order by g.release_date desc nulls last;
