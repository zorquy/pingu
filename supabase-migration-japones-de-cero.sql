-- ── BORRÓN Y CUENTA NUEVA: el catálogo japonés se calca de Scrydex ──
--
-- PINGU, el 2026-10-04: «no hay nadie con colecciones… el único que está
-- probándolo soy yo. Podríamos hacer un borrón y cuenta nueva y así no pasa
-- nada. Entonces todo el catálogo japonés lo traemos directamente de
-- Scrydex. Lo montamos así y ya está».
--
-- POR QUÉ, en una línea: lo de ahora es «el catálogo de TCGdex con Scrydex
-- retocándolo por encima», y eso llega a medias POR CONSTRUCCIÓN. Cada set
-- hay que EMPAREJARLO —adivinar cuál suyo es cuál nuestro— y cada
-- emparejamiento es una apuesta: de 118 sets japoneses, 36 salían mal y se
-- quedaban en kanji y sin cartas. Calcar su catálogo quita el
-- emparejamiento entero.
--
-- ══ ESTO BORRA DATOS. LÉELO ANTES DE EJECUTARLO ══
--
-- Va en cinco pasos y los dos primeros SOLO LEEN. El paso 2 enseña
-- exactamente lo que se va a borrar: si los números no son los que esperas,
-- para ahí y no sigas.
--
-- Lo que NO toca: el catálogo OCCIDENTAL (ni un set, ni una carta), los
-- torneos, el foro, los perfiles, las guías y los mazos. «Jugar» se
-- alimenta del occidental y de TCGdex, y ahí no se cambia nada — que es lo
-- que pediste.

-- ═══ 1. Cómo está el catálogo japonés ahora (solo lee) ═══
select coalesce(scrydex_por, '— sin emparejar —') as procedencia,
       count(*) as sets,
       count(*) filter (where name_en is null) as en_kanji,
       count(*) filter (where logo_scrydex is null) as sin_logo,
       sum((select count(*) from public.tcg_cards c
            where c.set_id = s.id and c.market = s.market)) as cartas
from public.tcg_sets s
where s.market = 'JP'
group by 1 order by 2 desc;

-- ═══ 2. QUÉ SE VA A BORRAR (solo lee) ═══
select 'sets japoneses' as que, count(*) as filas from public.tcg_sets where market = 'JP'
union all select 'cartas japonesas', count(*) from public.tcg_cards where market = 'JP'
union all select 'líneas de colección (TODAS, de todo el mundo)', count(*) from public.user_collection
union all select 'cartas buscadas (TODAS)', count(*) from public.user_wants
union all select 'álbumes soñados (TODOS)', count(*) from public.user_albums
union all select 'días de histórico de valor (TODOS)', count(*) from public.user_collection_value
union all select 'personas con algo en su colección', count(distinct user_id) from public.user_collection;

-- ═══ 3. El borrón: las cartas de la gente ═══
--
-- Las cuatro tablas van juntas porque hablan de lo mismo: el histórico de
-- valor es la suma de la colección día a día, y un álbum soñado es una
-- lista de identificadores de carta. Vaciar la colección y dejar las otras
-- dos dejaría una gráfica que cuenta un pasado que ya no existe y álbumes
-- apuntando a cartas borradas.
--
-- Si prefieres conservar TU colección occidental, ejecuta solo las dos
-- primeras líneas de este bloque cambiando el `where` por
-- `where market = 'JP'` (en `user_wants` hay que cruzar con `tcg_cards`,
-- porque esa tabla no guarda el mercado).
delete from public.user_collection_value;
delete from public.user_albums;
delete from public.user_wants;
delete from public.user_collection;

-- ═══ 4. Y el catálogo japonés entero ═══
--
-- Los precios primero: `tcg_card_prices` tiene el identificador de carta
-- como clave y NO el mercado, así que se limpian a mano antes de que las
-- cartas desaparezcan y dejen filas huérfanas que nadie volvería a mirar.
delete from public.tcg_card_prices p
where exists (select 1 from public.tcg_cards c
              where c.id = p.card_id and c.market = 'JP');

delete from public.tcg_cards where market = 'JP';
delete from public.tcg_sets where market = 'JP';

-- ═══ 5. Que las pasadas de Scrydex empiecen por el principio ═══
--
-- ESTE PASO NO ES UN DETALLE. El barrido de cartas guarda por qué página va
-- y se reanuda ahí: iba por la 57 de ~190, así que sin esto las 56 primeras
-- páginas de su catálogo no se insertarían hasta el barrido SIGUIENTE, y el
-- panel diría que va avanzando. Es la familia del freno que no frena: un
-- progreso guardado que ya no significa lo que significaba.
delete from public.scrydex_estado
where clave in ('cartas-jp', 'sets-jp', 'importar-jp');

-- ═══ Cómo queda (solo lee) ═══
--
-- Los sets japoneses tienen que salir a CERO: los trae `scrydex-importar-jp`
-- en su primera pasada (van cada diez minutos, 231 expansiones, 3 créditos)
-- y las cartas las va insertando `scrydex-relleno-jp` cada cinco minutos.
select (select count(*) from public.tcg_sets where market = 'JP') as sets_jp,
       (select count(*) from public.tcg_cards where market = 'JP') as cartas_jp,
       (select count(*) from public.tcg_sets where market = 'WEST') as sets_west_intactos,
       (select count(*) from public.tcg_cards where market = 'WEST') as cartas_west_intactas;
