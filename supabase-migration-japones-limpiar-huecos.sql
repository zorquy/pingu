-- Limpiar los sets japoneses VACÍOS de TCGdex (tanda 541).
--
-- PINGU: «los nombres de los sets y de las cartas en japonés siguen en
-- japonés; tráete los de Scrydex y sustitúyelo todo».
--
-- POR QUÉ SIGUEN EN JAPONÉS: porque son sets de TCGdex y TCGdex los nombra
-- en japonés. El nombre occidental lo pone Scrydex, y solo puede ponerlo
-- en los sets que están EMPAREJADOS con uno suyo. De los 186 nuestros,
-- **68 no tienen ni una sola carta** —un agujero de TCGdex, medido en la
-- tanda 486—, y un set sin cartas no se puede emparejar: no hay ninguna
-- señal que comparar.
--
-- Esos 68 son filas vacías: sin cartas, sin logo y con el nombre en kanji.
-- Y desde la tanda 540 su equivalente de Scrydex entra solo, con su logo,
-- su símbolo y su nombre occidental. O sea que lo que queda es la fila
-- vieja estorbando al lado de la nueva.
--
-- ── ESTO BORRA. LÉELO ANTES DE EJECUTARLO ──
--
-- Se borra SOLO lo que no tiene ninguna carta, así que por construcción no
-- puede haber ninguna carta de nadie apuntando ahí. Las dos primeras
-- consultas lo DEMUESTRAN antes de borrar nada: la segunda tiene que dar
-- CERO. Si no da cero, NO ejecutes el borrado y dímelo.

-- 1. Qué se va a borrar, con nombre y todo.
select s.id, s.name, s.serie_name, s.release_date
from public.tcg_sets s
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c where c.set_id = s.id and c.market = 'JP')
order by s.id;

-- 2. LA COMPROBACIÓN QUE MANDA: ¿hay cartas de alguien en esos sets?
--    Tiene que dar 0. Si da otra cosa, para aquí.
select count(*) as cartas_de_usuarios_afectadas
from public.user_cards u
join public.tcg_cards c on c.id = u.card_id
join public.tcg_sets s on s.id = c.set_id and s.market = c.market
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c2 where c2.set_id = s.id and c2.market = 'JP');

-- 3. Y el borrado. Solo sets japoneses SIN UNA SOLA CARTA.
delete from public.tcg_sets s
where s.market = 'JP'
  and not exists (select 1 from public.tcg_cards c where c.set_id = s.id and c.market = 'JP');

-- 4. Cómo queda el catálogo japonés.
select count(*) as sets_jp,
       count(*) filter (where name_en is not null) as con_nombre_occidental,
       count(*) filter (where logo_scrydex is not null) as con_logo
from public.tcg_sets where market = 'JP';
