-- Limpiar los sets japoneses VACÍOS de TCGdex (tanda 541, corregida en la 543).
--
-- PINGU: «los nombres de los sets y de las cartas en japonés siguen en
-- japonés; tráete los de Scrydex y sustitúyelo todo».
--
-- POR QUÉ SIGUEN EN JAPONÉS: porque son sets de TCGdex y TCGdex los nombra
-- en japonés. El nombre occidental lo pone Scrydex, y solo puede ponerlo
-- en los sets EMPAREJADOS con uno suyo. De los 186 nuestros, **68 no
-- tienen ni una sola carta** —un agujero de TCGdex, medido en la 486—, y un
-- set sin cartas no se puede emparejar: no hay ninguna señal que comparar.
--
-- Esos 68 son filas vacías: sin cartas, sin logo y en kanji. Y desde la 540
-- su equivalente de Scrydex entra solo, con su logo, su símbolo y su nombre
-- occidental. Lo que queda es la fila vieja estorbando al lado de la nueva.
--
-- ── LA PRIMERA VERSIÓN DE ESTO ESTABA MAL, Y CONVIENE QUE SE LEA ──
--
-- Escribí `user_cards`, que NO EXISTE: las tablas son `user_collection` y
-- `user_wants`. Me inventé el nombre en vez de mirarlo, que es exactamente
-- lo que la casa tiene escrito que no se hace. Postgres lo cantó con un
-- 42P01 — pero si el nombre inventado hubiera existido con otro contenido,
-- la comprobación habría dado cero por el motivo equivocado.
--
-- ── ESTO BORRA. LÉELO ANTES DE EJECUTARLO ──
--
-- Se borra SOLO lo que no tiene ninguna carta, así que por construcción no
-- puede haber nada de nadie apuntando ahí. Las consultas 2 y 3 lo
-- DEMUESTRAN antes de borrar: las dos tienen que dar CERO.

-- 1. Qué se va a borrar, con nombre y todo.
select s.id, s.name, s.serie_name, s.release_date
from public.tcg_sets s
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c where c.set_id = s.id and c.market = s.market)
order by s.id;

-- 2. ¿Hay cartas de alguien en esos sets? Tiene que dar 0.
select count(*) as en_colecciones
from public.user_collection u
join public.tcg_cards c on c.id = u.card_id and c.market = u.market
join public.tcg_sets s on s.id = c.set_id and s.market = c.market
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c2 where c2.set_id = s.id and c2.market = s.market);

-- 3. ¿Y buscadas? También tiene que dar 0.
select count(*) as en_buscadas
from public.user_wants w
join public.tcg_cards c on c.id = w.card_id
join public.tcg_sets s on s.id = c.set_id and s.market = c.market
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c2 where c2.set_id = s.id and c2.market = s.market);

-- 4. Y el borrado. Solo sets japoneses SIN UNA SOLA CARTA.
delete from public.tcg_sets s
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c where c.set_id = s.id and c.market = s.market);

-- 5. Cómo queda el catálogo japonés.
select count(*) as sets_jp,
       count(*) filter (where name_en is not null) as con_nombre_occidental,
       count(*) filter (where logo_scrydex is not null) as con_logo,
       count(*) filter (where scrydex_id is not null) as emparejados
from public.tcg_sets where market = 'JP';
