-- ── Las eras, con su nombre de verdad (tanda 553) ──
--
-- PINGU: «las eras están mal. La era de Megaevolución se llama ME, Scarlet
-- and Violet sale SV, Sword and Shield sale SWSH. Revisa el nombre de las
-- eras, ponmelo bonito, porque luego en el filtro se ve eso».
--
-- ── POR QUÉ SALÍA EL IDENTIFICADOR ──
--
-- El rótulo de una era sale de `serie_name` (o de `serie_name_en` si aquel
-- lleva kanji), y si no hay ninguno de los dos cae al `serie_id`, que es
-- «me», «sv», «swsh». Y los sets occidentales **no tienen `serie_name`**:
-- la tanda 329 ya lo midió —«los 210 sets tienen serie_id y serie_name a
-- NULL»— porque el LISTADO de TCGdex es un resumen y la serie solo viene en
-- el set completo. O sea que el catálogo occidental nunca ha tenido nombres
-- de era: lo que se veía antes era el identificador, y en cuanto el filtro
-- los puso en una lista se notó.
--
-- Esto no toca `serie_name`: le pone nombre a la ERA, que es justo para lo
-- que nació `tcg_eras` en la 550. Y como son filas, **se pueden cambiar
-- desde /admin → Colecciones** sin pedir otra migración: si alguno no te
-- convence, lo renombras ahí.

insert into public.tcg_eras (market, id, nombre, orden) values
  -- ── Occidental (identificadores de TCGdex) ──
  ('WEST', 'me',    'Megaevolución',            0),
  ('WEST', 'sv',    'Escarlata y Púrpura',      0),
  ('WEST', 'swsh',  'Espada y Escudo',          0),
  ('WEST', 'sm',    'Sol y Luna',               0),
  ('WEST', 'xy',    'XY',                       0),
  ('WEST', 'bw',    'Negro y Blanco',           0),
  ('WEST', 'col',   'Call of Legends',          0),
  ('WEST', 'hgss',  'HeartGold y SoulSilver',   0),
  ('WEST', 'pl',    'Platino',                  0),
  ('WEST', 'dp',    'Diamante y Perla',         0),
  ('WEST', 'ex',    'EX',                       0),
  ('WEST', 'ecard', 'e-Card',                   0),
  ('WEST', 'neo',   'Neo',                      0),
  ('WEST', 'gym',   'Gym',                      0),
  ('WEST', 'base',  'Base',                     0),
  ('WEST', 'pop',   'POP Series',               0),
  -- ── Japonés (identificadores sacados del nombre de serie de Scrydex) ──
  ('JP', 'mega-evolution', 'Megaevolución',       0),
  ('JP', 'scarlet-violet', 'Escarlata y Púrpura', 0),
  ('JP', 'sword-shield',   'Espada y Escudo',     0),
  ('JP', 'sun-moon',       'Sol y Luna',          0),
  ('JP', 'xy',             'XY',                  0),
  ('JP', 'black-white',    'Negro y Blanco',      0),
  ('JP', 'legend',         'LEGEND',              0),
  ('JP', 'platinum',       'Platino',             0),
  ('JP', 'diamond-pearl',  'Diamante y Perla',    0),
  ('JP', 'pcg',            'Pokémon Card Game',   0),
  ('JP', 'adv',            'ADV',                 0),
  ('JP', 'e-card',         'e-Card',              0),
  ('JP', 'web',            'Web',                 0),
  ('JP', 'vs',             'VS',                  0),
  ('JP', 'neo',            'Neo',                 0),
  ('JP', 'gym',            'Gym',                 0),
  ('JP', 'vending',        'Vending',             0),
  ('JP', 'original',       'Original',            0),
  ('JP', 'other',          'Otras',               0)
on conflict (market, id) do update set nombre = excluded.nombre;

-- ── Y LAS QUE ME HE DEJADO (solo lee) ──
--
-- Esta lista la he escrito a mano, así que lo honesto es decir qué queda
-- fuera en vez de dar por hecho que están todas. Lo que salga aquí sigue
-- rotulándose con su identificador, y se arregla desde /admin → Colecciones
-- en diez segundos: «Renombrar».
select s.market, s.serie_id, count(*) as colecciones,
       min(s.name) as ejemplo
from public.tcg_sets s
where s.serie_id is not null
  and not exists (select 1 from public.tcg_eras e where e.market = s.market and e.id = s.serie_id)
group by s.market, s.serie_id
order by s.market, 3 desc;
