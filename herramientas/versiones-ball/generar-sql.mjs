// Escribe supabase-migration-945-versiones-ball.sql con las versiones de
// tcgdex/cards-database (leer.mjs) metidas dentro, como jsonb.
import { writeFileSync } from 'node:fs'
import { versiones, SETS } from './leer.mjs'

const json = JSON.stringify(versiones()).replace(/'/g, "''")
const destino = process.argv[2] || '/home/user/pingu/supabase-migration-945-versiones-ball.sql'
const sets = Object.keys(SETS).map((s) => `'${s}'`).join(', ')

const sql = `-- ============================================================
-- Tanda 945: las versiones Poké Ball, Master Ball (y las demás Ball y el
-- patrón de energía) de Black Bolt, White Flare, Prismatic Evolutions y
-- Ascended Heroes, sacadas de TCGdex.
--
-- Cosadfrikiis, en el foro: «en Black Bolt no se puede añadir Poké Ball o
-- Master Ball… el Pansage 004 no sale… no son todas, pero hay varias».
--
-- Por qué pasaba: esas versiones son PRODUCTOS APARTE en Cardmarket (el
-- Pansage normal es el 835910, su Poké Ball el 836261 y su Master Ball el
-- 836271). TCGGO a veces las da dentro de la carta (\`variants\`, la 929) y
-- a veces como OTRA carta con su producto; la pasada de precios busca
-- nuestras cartas por producto, así que esas otras no casaban con ninguna y
-- la versión no llegaba nunca. TCGdex sí las tiene todas, en los ficheros de
-- tcgdex/cards-database (\`variants\` con \`foil\` y su producto de
-- Cardmarket), y de ahí sale la lista de abajo, generada por
-- herramientas/versiones-ball/generar-sql.mjs (rama \`pruebas\`, sobre un
-- clon de tcgdex/cards-database en /tmp/tcgdex-db).
--
--  1. Cada versión es una fila de \`tcg_card_versions\` con \`origen =
--     'tcgdex'\`, clase \`impresion\` y su producto de Cardmarket, colgada de
--     NUESTRA carta (la del mismo set, número y nombre). La etiqueta es la
--     que TCGGO le da a la misma versión («Poké Ball», «Master Ball»…): si
--     la carta ya la tiene de TCGGO, no se repite.
--  2. El precio lo pone la pasada de precios por el producto, como el de
--     las ediciones de la 935 (\`origen in (edicion, tcgdex)\`).
--  3. Una «tcggo-…» del mismo set cuyo producto es el de una de esas
--     versiones es esa versión colada como carta: se funde en la nuestra
--     (sus copias pasan a esa versión, lo demás a la carta) y se borra con
--     lápida, como en la 935.
--
-- Va DESPUÉS de las migraciones 934 y 935. Idempotente: una versión que ya
-- está no se repite y una carta ya fundida ya no existe.
-- ============================================================

begin;

alter table public.tcg_card_versions drop constraint if exists tcg_card_versions_origen_ok;
alter table public.tcg_card_versions add constraint tcg_card_versions_origen_ok
  check (origen is null or origen in ('mano', 'edicion', 'foto', 'tcgdex'));

create index if not exists tcg_card_versions_producto_tcgdex on public.tcg_card_versions (cm_id_product) where origen = 'tcgdex';

do $do$
declare
  d jsonb := '${json}';
  r record;
  e record;
  c record;
  dup record;
  t_id int;
  t_etiqueta text;
  v_comp text;
  n_versiones int := 0;
  n_ya int := 0;
  n_sin_carta int := 0;
  n_fundidas int := 0;
  n_copias int := 0;
  n_pasadas int := 0;
begin
  if not exists (select 1 from pg_proc where proname = 'catalogo_id_de_version') then
    raise exception 'Falta ejecutar antes supabase-migration-935-ediciones-wizards.sql.';
  end if;

  for r in select x->>'s' as s, x->>'n' as n, x->>'en' as en, x->'v' as v from jsonb_array_elements(d) as x loop
    v_comp := regexp_replace(public.immutable_unaccent(lower(coalesce(r.en, ''))), '[^a-z0-9]+', '', 'g');
    -- La nuestra: del set (o de uno que comparte su expansión de TCGGO), del
    -- mismo número y con el mismo nombre inglés. Ni las «tcggo-…» repetidas
    -- (se funden abajo) ni las de otro nombre con el mismo número.
    for c in
      select x.id, x.set_id, x.name, x.cm_id_product_propio
        from public.tcg_cards x
       where x.market = 'WEST'
         and x.set_id in (
           select s.id from public.tcg_sets s
            where s.market = 'WEST'
              and (s.id = r.s or (s.tcggo_id is not null and s.tcggo_id = (select t.tcggo_id from public.tcg_sets t where t.id = r.s and t.market = 'WEST'))))
         and nullif(ltrim(lower(x.local_id), '0'), '') = nullif(ltrim(lower(r.n), '0'), '')
         and v_comp <> ''
         and regexp_replace(public.immutable_unaccent(lower(coalesce(x.name_en, x.name, ''))), '[^a-z0-9]+', '', 'g') like v_comp || '%'
         and not (x.cm_id_product_propio is not null and x.cm_id_product_propio in (
           select nullif(y->>1, '')::int from jsonb_array_elements(r.v) as y))
       order by (x.id like 'tcggo-%'), x.id
       limit 1
    loop
      for e in select y->>0 as etiqueta, nullif(y->>1, '')::int as cm from jsonb_array_elements(r.v) as y loop
        if exists (
          select 1 from public.tcg_card_versions v
           where v.card_id = c.id and v.market = 'WEST'
             and public.catalogo_id_de_version(v.etiqueta) = public.catalogo_id_de_version(e.etiqueta)
        ) then
          -- La de TCGGO no lleva producto: se le pone, que es el de esa versión.
          update public.tcg_card_versions v set cm_id_product = e.cm
           where v.card_id = c.id and v.market = 'WEST' and v.cm_id_product is null and e.cm is not null
             and public.catalogo_id_de_version(v.etiqueta) = public.catalogo_id_de_version(e.etiqueta);
          n_ya := n_ya + 1;
        else
          insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
          values (-nextval('public.tcg_card_versions_mano_seq')::int, 'WEST', c.id, c.set_id, c.name, e.etiqueta, 'impresion', e.cm, 'tcgdex', now());
          n_versiones := n_versiones + 1;
        end if;
      end loop;

      -- Las «tcggo-…» que son una de estas versiones colada como carta.
      for dup in
        select x.id, x.cm_id_product_propio, x.image_tcggo
          from public.tcg_cards x
         where x.market = 'WEST' and x.set_id = c.set_id and x.id <> c.id
           and (x.origen = 'tcggo' or x.id like 'tcggo-%')
           and x.cm_id_product_propio in (select nullif(y->>1, '')::int from jsonb_array_elements(r.v) as y)
      loop
        select y->>0 into t_etiqueta from jsonb_array_elements(r.v) as y where nullif(y->>1, '')::int = dup.cm_id_product_propio limit 1;
        select tcggo_id into t_id from public.tcg_card_versions
         where card_id = c.id and market = 'WEST' and public.catalogo_id_de_version(etiqueta) = public.catalogo_id_de_version(t_etiqueta)
         order by (origen = 'tcgdex') desc limit 1;
        update public.user_collection
           set card_id = c.id, market = 'WEST', variante = public.catalogo_id_de_version(t_etiqueta)
         where card_id = dup.id;
        get diagnostics n_pasadas = row_count;
        n_copias := n_copias + n_pasadas;
        -- Su precio de TCGGO es el de la versión: sus filas de versión, a la carta.
        update public.tcg_card_versions set card_id = c.id, set_id = c.set_id where card_id = dup.id;
        if dup.image_tcggo is not null and t_id is not null then
          update public.tcg_card_versions set imagen = dup.image_tcggo where tcggo_id = t_id and imagen is null;
        end if;
        delete from public.user_wants w
         where w.card_id = dup.id
           and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = c.id and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'));
        update public.user_wants set card_id = c.id where card_id = dup.id;
        update public.user_price_alerts set card_id = c.id where card_id = dup.id;
        update public.user_showcase set card_id = c.id where card_id = dup.id;
        update public.user_albums a set cartas = (
          select coalesce(jsonb_agg(case when x->>'id' = dup.id then jsonb_set(x, '{id}', to_jsonb(c.id)) else x end order by k), '[]'::jsonb)
            from jsonb_array_elements(a.cartas) with ordinality as z(x, k))
         where a.cartas @> jsonb_build_array(jsonb_build_object('id', dup.id));
        delete from public.tcg_card_prices where card_id = dup.id;
        delete from public.tcg_card_history where card_id = dup.id;
        delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = dup.id and market = 'WEST';
        insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
        values ('tcg_cards', dup.id, 'WEST', '__borrada', 'true'::jsonb, null, null, now())
        on conflict (tabla, id, market, columna) do update set updated_at = now();
        delete from public.tcg_cards where id = dup.id and market = 'WEST';
        n_fundidas := n_fundidas + 1;
      end loop;
    end loop;
    if not found then
      n_sin_carta := n_sin_carta + 1;
    end if;
  end loop;

  raise notice 'Versiones nuevas: %, que ya estaban: %, cartas de TCGdex sin la nuestra: %, coladas fundidas: %, copias movidas: %', n_versiones, n_ya, n_sin_carta, n_fundidas, n_copias;
end
$do$;

notify pgrst, 'reload schema';

commit;

-- Lo que ha quedado (el SQL Editor enseña esta tabla):
select s.id as set, s.name,
  (select count(distinct v.card_id) from public.tcg_card_versions v join public.tcg_cards x on x.id = v.card_id and x.market = 'WEST'
     where x.set_id = s.id and public.catalogo_id_de_version(v.etiqueta) = 'poke-ball') as con_poke_ball,
  (select count(distinct v.card_id) from public.tcg_card_versions v join public.tcg_cards x on x.id = v.card_id and x.market = 'WEST'
     where x.set_id = s.id and public.catalogo_id_de_version(v.etiqueta) = 'master-ball') as con_master_ball,
  (select count(*) from public.tcg_card_versions v join public.tcg_cards x on x.id = v.card_id and x.market = 'WEST'
     where x.set_id = s.id and v.origen = 'tcgdex') as de_tcgdex
  from public.tcg_sets s
 where s.market = 'WEST' and s.id in (${sets})
 order by s.id;
`
writeFileSync(destino, sql)
console.log('escrito', destino, (sql.length / 1024).toFixed(0), 'KB')
