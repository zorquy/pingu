-- ════════════════════════════════════════════════════════════════════
-- «Otros sets»: un grupo de eras al fondo de la estantería, y el arreglo
-- de e-Card y Play! Pokémon Prize Pack (tanda 904)
--
-- PINGU, desde /admin, metió sin querer los nueve Play! Pokémon Prize Pack
-- en la era de Skyridge, Aquapolis, Best of Game y Expedition y la rebautizó
-- «Play! Pokémon Prize Pack». Lo que quiere: esos cuatro sets vuelven a ser
-- la era «e-Card» (2002–2003, donde estaban), y los Prize Pack (serie 1 a
-- 9) son su propia era, «Play! Pokémon Prize Pack», debajo de Base, dentro
-- de un grupo nuevo, «Otros sets», donde irán cayendo las líneas que no son
-- una era de verdad.
--
-- Ejecutar en el SQL Editor. No borra sets ni cartas. Cada sentencia va
-- por su lado (631): nada depende de una temporal. La era de e-Card no se
-- nombra por su identificador —no se sabe seguro cuál es— sino por SUS
-- SETS: es la serie en la que están Expedition, Aquapolis y Skyridge, que
-- es la que se rebautizó y conserva su orden.
-- ════════════════════════════════════════════════════════════════════

-- 1. El grupo de una era ─────────────────────────────────────────────
--
-- `grupo` es NULL para las eras de verdad y 'otros' para las que cuelgan
-- de «Otros sets». La estantería pinta las de 'otros' al fondo, después de
-- todas las demás, bajo un rótulo común; dentro, su orden de siempre.
alter table public.tcg_eras add column if not exists grupo text;
alter table public.tcg_eras drop constraint if exists tcg_eras_grupo;
alter table public.tcg_eras add constraint tcg_eras_grupo check (grupo is null or grupo in ('otros'));
comment on column public.tcg_eras.grupo is 'NULL = era de verdad; ''otros'' = cuelga del grupo «Otros sets», al fondo (904).';

-- 2. e-Card vuelve a llamarse e-Card ─────────────────────────────────
--
-- La fila de esa era (la que tiene a Expedition, Aquapolis y Skyridge) se
-- renombra y conserva su `orden`; si no tuviera fila, se crea con el orden
-- de la era de Base menos uno, que la deja justo encima.
--
-- Y si la serie que sale fuera 'prize-pack' (PINGU los habría metido todos
-- en una era con ese identificador), no vale —esa es la de los Prize
-- Pack— y e-Card se crea como 'ecard'.
insert into public.tcg_eras (market, id, nombre, orden)
select 'WEST',
       coalesce((select x.serie_id from public.tcg_sets x
                  where x.market = 'WEST' and x.serie_id is not null and x.serie_id <> 'prize-pack'
                    and (x.id in ('ecard1', 'ecard2', 'ecard3')
                         or lower(coalesce(x.name_en, x.name)) in ('skyridge', 'aquapolis', 'expedition base set', 'expedition'))
                  group by x.serie_id order by count(*) desc limit 1), 'ecard'),
       'e-Card',
       greatest(coalesce((select b.orden from public.tcg_eras b
                            join public.tcg_sets bs on bs.market = b.market and bs.serie_id = b.id
                           where b.market = 'WEST' and (bs.id = 'base1' or lower(coalesce(bs.name_en, bs.name)) = 'base set')
                           limit 1), 0) - 1, 0)
on conflict (market, id) do update set nombre = 'e-Card', grupo = null;

-- Best of Game (y cualquiera de los cuatro que se hubiera ido a otra serie)
-- vuelve a esa era, como CORRECCIÓN (885): un update a secas duraría hasta
-- la siguiente pasada del catálogo.
insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, updated_at)
select 'tcg_sets', s.id, 'WEST', 'serie_id',
       to_jsonb(coalesce((select x.serie_id from public.tcg_sets x
                  where x.market = 'WEST' and x.serie_id is not null and x.serie_id <> 'prize-pack'
                    and (x.id in ('ecard1', 'ecard2', 'ecard3')
                         or lower(coalesce(x.name_en, x.name)) in ('skyridge', 'aquapolis', 'expedition base set', 'expedition'))
                  group by x.serie_id order by count(*) desc limit 1), 'ecard')),
       to_jsonb(s.serie_id), now()
  from public.tcg_sets s
 where s.market = 'WEST'
   and (s.id in ('ecard1', 'ecard2', 'ecard3', 'bp')
        or lower(coalesce(s.name_en, s.name)) in ('skyridge', 'aquapolis', 'best of game', 'expedition base set', 'expedition'))
on conflict (tabla, id, market, columna) do update set valor = excluded.valor, updated_at = now();

update public.tcg_sets s
   set serie_id = coalesce((select x.serie_id from public.tcg_sets x
                  where x.market = 'WEST' and x.serie_id is not null and x.serie_id <> 'prize-pack'
                    and (x.id in ('ecard1', 'ecard2', 'ecard3')
                         or lower(coalesce(x.name_en, x.name)) in ('skyridge', 'aquapolis', 'expedition base set', 'expedition'))
                  group by x.serie_id order by count(*) desc limit 1), 'ecard')
 where s.market = 'WEST'
   and (s.id in ('ecard1', 'ecard2', 'ecard3', 'bp')
        or lower(coalesce(s.name_en, s.name)) in ('skyridge', 'aquapolis', 'best of game', 'expedition base set', 'expedition'));

-- 3. Play! Pokémon Prize Pack, su propia era, en «Otros sets» ────────
insert into public.tcg_eras (market, id, nombre, orden, grupo)
values ('WEST', 'prize-pack', 'Play! Pokémon Prize Pack', 0, 'otros')
on conflict (market, id) do update set nombre = 'Play! Pokémon Prize Pack', grupo = 'otros';

-- Las nueve series (y las que vengan: casan por el nombre). El «_» es el
-- comodín de un carácter: cubre «Pokémon» y «Pokemon».
insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, updated_at)
select 'tcg_sets', s.id, 'WEST', 'serie_id', to_jsonb('prize-pack'::text), to_jsonb(s.serie_id), now()
  from public.tcg_sets s
 where s.market = 'WEST'
   and (s.name ilike 'Play! Pok_mon Prize Pack%' or s.name_en ilike 'Play! Pok_mon Prize Pack%')
on conflict (tabla, id, market, columna) do update set valor = excluded.valor, updated_at = now();

update public.tcg_sets s
   set serie_id = 'prize-pack'
 where s.market = 'WEST'
   and (s.name ilike 'Play! Pok_mon Prize Pack%' or s.name_en ilike 'Play! Pok_mon Prize Pack%');

-- 4. Si quedó otra era llamada así, sin sets, fuera ──────────────────
--
-- Solo guarda nombre y orden, y confundiría en el editor de eras.
delete from public.tcg_eras
 where market = 'WEST'
   and id <> 'prize-pack'
   and nombre ilike 'Play! Pok_mon Prize Pack';

notify pgrst, 'reload schema';

-- ── Comprobación ───────────────────────────────────────────────────
-- e-Card tiene que listar 4 sets y prize-pack 9, y ninguna otra fila.
select e.id, e.nombre, e.grupo, e.orden, count(s.id) as sets,
       string_agg(coalesce(s.name_en, s.name), ' · ' order by s.release_date) as cuales
  from public.tcg_eras e
  left join public.tcg_sets s on s.market = e.market and s.serie_id = e.id
 where e.market = 'WEST' and (e.id = 'prize-pack' or e.nombre in ('e-Card', 'Play! Pokémon Prize Pack'))
 group by e.id, e.nombre, e.grupo, e.orden
 order by e.id;
