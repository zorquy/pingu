-- ============================================================
-- Tanda 1005: las versiones «Trick or Trade 2023» y «Trick or Trade 2024».
--
-- PINGU, con las dos listas de Bulbapedia delante: «métele una variante que
-- se llame Trick or Trade y el año… salieron en Trick or Trade BOOster
-- Bundle». La de 2022 ya la metió él desde /admin, carta a carta; estas dos
-- son 30 + 30 cartas de catorce colecciones.
--
-- Cada una es una versión A MANO (la 934, `origen = 'mano'`, id negativo de
-- su secuencia: ninguna pasada la pisa) colgada de la carta original de su
-- colección, casada por colección y NÚMERO —lo que va impreso—, no por nombre:
-- el nombre de una fila puede estar en español (la 505). Si el nombre no casa,
-- se crea igual y se avisa (NOTICE) para mirarla.
--
-- La clase y el icono, los de la Trick or Trade 2022 que ya existe (así las
-- tres van igual); si no hay ninguna, «sello» (es el sello de la calabaza).
--
-- Idempotente: una carta que ya tiene la versión no se repite. Un solo `do`:
-- en el SQL Editor cada sentencia va por su lado (la 631).
-- Va después de supabase-migration-934-versiones-a-mano.sql.
-- ============================================================

do $$
declare
  r record;
  v_set text;
  v_carta record;
  v_clase text;
  v_icono text;
  v_creadas int := 0;
  v_ya int := 0;
  v_faltan int := 0;
begin
  select clase, icono into v_clase, v_icono
    from public.tcg_card_versions
   where origen = 'mano' and public.catalogo_id_de_version(etiqueta) = 'trick-or-trade-2022'
   order by tcggo_id desc limit 1;
  v_clase := coalesce(v_clase, 'sello');

  for r in
    select * from (values
      -- Trick or Trade 2023 (1 de septiembre de 2023)
      ('Trick or Trade 2023', 'swsh1',  'SSH', 202, '089', 'Sinistea'),
      ('Trick or Trade 2023', 'swsh1',  'SSH', 202, '090', 'Polteageist'),
      ('Trick or Trade 2023', 'swsh2',  'RCL', 192, '102', 'Runerigus'),
      ('Trick or Trade 2023', 'swsh4',  'VIV', 185, '019', 'Dhelmise'),
      ('Trick or Trade 2023', 'swsh4',  'VIV', 185, '069', 'Duskull'),
      ('Trick or Trade 2023', 'swsh4',  'VIV', 185, '070', 'Dusclops'),
      ('Trick or Trade 2023', 'swsh4',  'VIV', 185, '071', 'Dusknoir'),
      ('Trick or Trade 2023', 'swsh4',  'VIV', 185, '095', 'Lycanroc'),
      ('Trick or Trade 2023', 'swsh7',  'EVS', 203, '080', 'Marshadow'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '016', 'Phantump'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '017', 'Trevenant'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '024', 'Litwick'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '025', 'Lampent'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '026', 'Chandelure'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '064', 'Gastly'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '065', 'Haunter'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '066', 'Gengar'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '073', 'Banette'),
      ('Trick or Trade 2023', 'swsh11', 'LOR', 196, '081', 'Spectrier'),
      ('Trick or Trade 2023', 'swsh12', 'SIT', 195, '103', 'Zubat'),
      ('Trick or Trade 2023', 'sv01',   'SVI', 198, '034', 'Houndoom'),
      ('Trick or Trade 2023', 'sv01',   'SVI', 198, '087', 'Shuppet'),
      ('Trick or Trade 2023', 'sv01',   'SVI', 198, '089', 'Drifloon'),
      ('Trick or Trade 2023', 'sv01',   'SVI', 198, '090', 'Drifblim'),
      ('Trick or Trade 2023', 'sv01',   'SVI', 198, '104', 'Greavard'),
      ('Trick or Trade 2023', 'sv01',   'SVI', 198, '106', 'Houndstone'),
      ('Trick or Trade 2023', 'sv02',   'PAL', 193, '062', 'Pikachu'),
      ('Trick or Trade 2023', 'sv02',   'PAL', 193, '088', 'Mismagius'),
      ('Trick or Trade 2023', 'sv02',   'PAL', 193, '097', 'Mimikyu'),
      ('Trick or Trade 2023', 'sv02',   'PAL', 193, '131', 'Murkrow'),
      -- Trick or Trade 2024 (30 de agosto de 2024)
      ('Trick or Trade 2024', 'sv02',   'PAL', 193, '012', 'Sprigatito'),
      ('Trick or Trade 2024', 'sv02',   'PAL', 193, '050', 'Quaxly'),
      ('Trick or Trade 2024', 'sv03',   'OBF', 197, '130', 'Umbreon'),
      ('Trick or Trade 2024', 'sv03',   'OBF', 197, '131', 'Houndour'),
      ('Trick or Trade 2024', 'sv03',   'OBF', 197, '133', 'Houndoom'),
      ('Trick or Trade 2024', 'sv03',   'OBF', 197, '136', 'Darkrai'),
      ('Trick or Trade 2024', 'sv04',   'PAR', 182, '023', 'Fuecoco'),
      ('Trick or Trade 2024', 'sv04',   'PAR', 182, '077', 'Pumpkaboo'),
      ('Trick or Trade 2024', 'sv04',   'PAR', 182, '078', 'Gourgeist'),
      ('Trick or Trade 2024', 'sv04.5', 'PAF',  91, '018', 'Pikachu'),
      ('Trick or Trade 2024', 'sv04.5', 'PAF',  91, '037', 'Mimikyu'),
      ('Trick or Trade 2024', 'sv04.5', 'PAF',  91, '042', 'Greavard'),
      ('Trick or Trade 2024', 'sv04.5', 'PAF',  91, '043', 'Houndstone'),
      ('Trick or Trade 2024', 'sv04.5', 'PAF',  91, '057', 'Gengar'),
      ('Trick or Trade 2024', 'sv05',   'TEF', 162, '077', 'Scream Tail'),
      ('Trick or Trade 2024', 'sv05',   'TEF', 162, '078', 'Flutter Mane'),
      ('Trick or Trade 2024', 'sv05',   'TEF', 162, '102', 'Gastly'),
      ('Trick or Trade 2024', 'sv05',   'TEF', 162, '103', 'Haunter'),
      ('Trick or Trade 2024', 'sv05',   'TEF', 162, '139', 'Iron Jugulis'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '012', 'Phantump'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '013', 'Trevenant'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '021', 'Poltchageist'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '022', 'Sinistcha'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '024', 'Ogerpon'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '036', 'Litwick'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '037', 'Lampent'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '038', 'Chandelure'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '095', 'Munkidori'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '096', 'Fezandipiti'),
      ('Trick or Trade 2024', 'sv06',   'TWM', 167, '111', 'Okidogi')
    ) as t(etiqueta, set_id, codigo, total, numero, nombre)
  loop
    -- La colección: por su id y, si no, por su código de TCG Live y su cuenta.
    select s.id into v_set from public.tcg_sets s
     where s.market = 'WEST'
       and (s.id = r.set_id or (upper(s.tcg_online_code) = r.codigo and s.card_count_official = r.total))
     order by (s.id = r.set_id) desc
     limit 1;
    if not found then
      v_faltan := v_faltan + 1;
      raise notice 'SIN COLECCIÓN: % · %/% % (% / %)', r.etiqueta, r.numero, r.total, r.nombre, r.set_id, r.codigo;
      continue;
    end if;
    -- La carta: por su número (sin ceros delante); si hay dos —una «tcggo-…»
    -- que repite el número—, la que casa de nombre y la que no es de TCGGO.
    select c.id, c.name, c.name_es into v_carta from public.tcg_cards c
     where c.market = 'WEST' and c.set_id = v_set
       and ltrim(split_part(c.local_id, '/', 1), '0') = ltrim(r.numero, '0')
     order by (c.name ilike '%' || r.nombre || '%') desc, (c.id like 'tcggo-%') asc, c.id
     limit 1;
    if not found then
      v_faltan := v_faltan + 1;
      raise notice 'NO ENCONTRADA: % · %/% % (set %)', r.etiqueta, r.numero, r.total, r.nombre, v_set;
      continue;
    end if;
    if exists (select 1 from public.tcg_card_versions v
                where v.card_id = v_carta.id and v.market = 'WEST'
                  and public.catalogo_id_de_version(v.etiqueta) = public.catalogo_id_de_version(r.etiqueta)) then
      v_ya := v_ya + 1;
      continue;
    end if;
    if v_carta.name not ilike '%' || r.nombre || '%' then
      raise notice 'MIRAR EL NOMBRE: % · %/% esperaba «%» y es «%» (%)', r.etiqueta, r.numero, r.total, r.nombre, v_carta.name, v_carta.id;
    end if;
    insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, icono, salio_en, lanzamiento, clase, origen, actualizado_at)
    values (-nextval('public.tcg_card_versions_mano_seq')::int, 'WEST', v_carta.id, v_set, v_carta.name, r.etiqueta, v_icono,
      'Trick or Trade BOOster Bundle ' || right(r.etiqueta, 4),
      case right(r.etiqueta, 4) when '2023' then date '2023-09-01' else date '2024-08-30' end,
      v_clase, 'mano', now());
    v_creadas := v_creadas + 1;
  end loop;
  raise notice 'Trick or Trade 2023 y 2024: % creadas, % ya estaban, % sin encontrar.', v_creadas, v_ya, v_faltan;
end
$$;

-- Lo que ha quedado (el SQL Editor no siempre enseña los NOTICE): tiene que
-- decir 30 y 30. Si sale menos, falta alguna carta en el catálogo.
select etiqueta as version, count(*) as cartas, min(salio_en) as salio_en, min(lanzamiento) as lanzamiento
  from public.tcg_card_versions
 where origen = 'mano' and etiqueta in ('Trick or Trade 2023', 'Trick or Trade 2024')
 group by etiqueta
 order by etiqueta;
