-- ════════════════════════════════════════════════════════════════════
-- Tanda 345 — los códigos de TCG LIVE, que TCGdex ya no da
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «el TCG Online es lo antiguo, ahora es el TCG Live». Y ahí está
-- la explicación de por qué la 343 no arregló lo que yo dije que iba a
-- arreglar.
--
-- ── Lo que pasó ──
--
-- La 343 hizo que la tarea visitara los ~220 sets para curarles el
-- código. Los visitó (216 de 220 en un rato) y el resultado fue: 98
-- siguen sin código, **y TODOS los modernos entre ellos**. Pitch Black,
-- Surging Sparks, Twilight Masquerade: null.
--
-- El motivo no es nuestro. `codigoLiveDeSet` lee `set.tcgOnline`, que es
-- el código de **Pokémon TCG Online** — la plataforma vieja, que cerró en
-- 2023. TCGdex dejó de rellenar ese campo entonces, así que para todo lo
-- posterior **el dato no existe arriba** y ninguna pasada lo va a traer.
-- Visitar los sets estaba bien y sigue haciendo falta (la serie, la
-- fecha), pero para esto no sirve.
--
-- ── De dónde sale entonces ──
--
-- De una lista curada a mano, que es lo que hay, y que en esta casa ya
-- existía: `SETS_LIVE` en `js/torneos/comun.js`, que el lector de
-- decklists usa desde la tanda 232 precisamente porque TCGdex nunca dio
-- estos códigos. Lo de aquí son los mismos datos puestos en la columna
-- que lee /cartas, sacados del listado público de Limitless.
--
-- Y una lista curada se queda vieja (la 323), así que lo que importa no
-- es esta tabla sino **que se note cuando le falta algo**: /admin →
-- Cartas dice cuántos de los 20 sets más nuevos no tienen código, y deja
-- asignarlo a mano. Un set nuevo se arregla ahí, sin desplegar.
--
-- Solo se escribe donde está VACÍO: lo que TCGdex sí dio en su día no se
-- toca.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

update public.tcg_sets s
set tcg_online_code = v.codigo
from (values
  -- Mega (2025-2026)
  ('30th',    '30C'),
  ('me05',    'PBL'),
  ('me04',    'CRI'),
  ('me03',    'POR'),
  ('me02.5',  'ASC'),
  ('me02',    'PFL'),
  ('me01',    'MEG'),
  ('mee',     'MEE'),
  ('mep',     'MEP'),
  -- Escarlata y Púrpura (2023-2025)
  ('sv10.5b', 'BLK'),
  ('sv10.5w', 'WHT'),
  ('sv10',    'DRI'),
  ('sv09',    'JTG'),
  ('sv08.5',  'PRE'),
  ('sv08',    'SSP'),
  ('sv07',    'SCR'),
  ('sv06.5',  'SFA'),
  ('sv06',    'TWM'),
  ('sv05',    'TEF'),
  ('sv04.5',  'PAF'),
  ('sv04',    'PAR'),
  ('sv03.5',  'MEW'),
  ('sv03',    'OBF'),
  ('sv02',    'PAL'),
  ('sv01',    'SVI')
) as v(id, codigo)
where s.id = v.id and s.market = 'WEST' and s.tcg_online_code is null;

-- ── Para ver qué queda ──
--
-- De los 20 más nuevos, los que siguen sin código. Esos son los que hay
-- que poner a mano en /admin → Cartas → Códigos de set de TCG Live.
--
-- select id, name, release_date from public.tcg_sets
-- where market = 'WEST' and tcg_online_code is null
-- order by release_date desc nulls last limit 20;
