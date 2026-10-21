// Escribe supabase-migration-948-ediciones-japonesas.sql con las ediciones
// de las japonesas de tcgdex/cards-database (leer.mjs) metidas dentro.
import { writeFileSync } from 'node:fs'
import { sets } from './leer.mjs'

const datos = sets().map((s) => ({ s: s.s, nombre: s.nombre, fecha: s.fecha, oficial: s.oficial, cartas: s.cartas.map((c) => c.n) }))
const json = JSON.stringify(datos).replace(/'/g, "''")
const destino = process.argv[2] || '/home/user/pingu/supabase-migration-948-ediciones-japonesas.sql'
const cartas = datos.reduce((n, s) => n + s.cartas.length, 0)

const sql = `-- ============================================================
-- Tanda 948: la 1.ª edición y la Unlimited de las japonesas antiguas.
--
-- En el foro: «Wind from the Sea, existe 1.ª Edición y Unlimited, no me deja
-- añadir 1.ª edición» (y Flight of Legends, Rocket Gang Strikes Back, Golden
-- Sky Silvery Ocean…). Y PINGU: «yo creo que es porque las variantes las
-- cogemos de TCGdex o de otro sitio y al añadir solo coge de TCGGO».
--
-- Es eso. Desde la 806 el catálogo japonés es ENTERO de TCGGO, que da cada
-- carta una vez y sin decir si tuvo 1.ª edición; su fila «Standard» (937)
-- dice «la he mirado», así que la web ofrecía una sola versión, la normal.
-- Los ficheros de tcgdex/cards-database (data-asia) sí lo dicen: ${cartas}
-- cartas de ${datos.length} sets (e-Card E1–E5, PCG1–PCG9, VS1 y web1) con
-- su 1.ª edición y su Unlimited. Van aquí dentro, generadas por
-- herramientas/ediciones-japonesas/generar-sql.mjs (rama \`pruebas\`).
--
-- Es lo mismo que la 935 hizo con Wizards: cada edición, una fila de
-- \`tcg_card_versions\` con \`origen = 'edicion'\` colgada de NUESTRA carta
-- japonesa, y la web ofrece esas dos y ninguna más. La Unlimited lleva el
-- producto de Cardmarket de la carta (el precio de la carta es el suyo); la
-- 1.ª edición va sin él, sin cifra, como en la 935.
--
-- CASAR LOS SETS. Los nuestros son los de TCGGO, con otros ids. Por orden:
--  1. el id o el código del set igual al de TCGdex («PCG4»);
--  2. si no, el mismo día de salida; si ese día salió más de uno (en Japón
--     una expansión y sus barajas salen juntas), el que tenga la cuenta de
--     cartas de TCGdex.
-- Un empate o ninguno no elige: el set se salta y el informe lo dice. Y
-- elegido, al menos la mitad de las cartas tienen que casar por número, o se
-- salta. El NOMBRE no se usa: en estos sets TCGdex los tiene mal («奇妙な»,
-- «vileplume» en el 003 de 海からの風), y la 1.ª edición es un dato del set.
-- Las cartas casan por número («003» con «3» o «003/106»).
--
-- Las copias apuntadas como «Normal» u «Holo» de esas cartas pasan a
-- «Unlimited» (lo recomendado, como en la 935); las de «1.ª edición» se
-- quedan. Sin eso, una «Normal» que ya no se ofrece se leería como la
-- primera versión de la lista, que es la 1.ª edición.
--
-- Va DESPUÉS de la 935. Idempotente: una edición que ya está no se repite.
-- Lo que ha hecho queda en \`scrydex_estado\` (clave ediciones_jp_948) y se
-- enseña al final, un renglón por set de TCGdex.
-- ============================================================

begin;

do $do$
declare
  d jsonb := '${json}'::jsonb;
  r record;
  k record;
  v_ids text[];
  v_set text;
  v_por text;
  v_cartas int;
  v_casan int;
  v_nuevas int;
  v_copias int;
  v_n int;
  informe jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tcg_card_versions_origen_ok' and pg_get_constraintdef(oid) like '%edicion%'
  ) then
    raise exception 'Falta ejecutar antes supabase-migration-935-ediciones-wizards.sql.';
  end if;

  for r in
    select x->>'s' as s, x->>'nombre' as nombre, nullif(x->>'fecha', '')::date as fecha, nullif(x->>'oficial', '')::int as oficial, x->'cartas' as cartas
      from jsonb_array_elements(d) as x
  loop
    v_cartas := jsonb_array_length(r.cartas);
    v_set := null; v_por := null; v_nuevas := 0; v_copias := 0;

    -- 1. El id o el código.
    select array_agg(id) into v_ids from public.tcg_sets
     where market = 'JP' and not coalesce(oculto, false)
       and (lower(id) = lower(r.s) or lower(coalesce(tcg_online_code, '')) = lower(r.s));
    if coalesce(array_length(v_ids, 1), 0) = 1 then
      v_set := v_ids[1]; v_por := 'id o código';
    end if;

    -- 2. El día de salida.
    if v_set is null and r.fecha is not null then
      select array_agg(id) into v_ids from public.tcg_sets
       where market = 'JP' and not coalesce(oculto, false) and release_date = r.fecha;
      if coalesce(array_length(v_ids, 1), 0) = 1 then
        v_set := v_ids[1]; v_por := 'día de salida';
      elsif coalesce(array_length(v_ids, 1), 0) > 1 then
        select array_agg(id) into v_ids from public.tcg_sets
         where market = 'JP' and id = any(v_ids) and r.oficial is not null
           and r.oficial in (card_count_official, card_count_total);
        if coalesce(array_length(v_ids, 1), 0) = 1 then
          v_set := v_ids[1]; v_por := 'día de salida y cuenta';
        else
          v_por := 'empate el mismo día';
        end if;
      else
        v_por := 'ningún set nuestro de ese día';
      end if;
    elsif v_set is null then
      v_por := 'TCGdex no sabe su día';
    end if;

    if v_set is null then
      informe := informe || jsonb_build_array(jsonb_build_object('tcgdex', r.s, 'nombre', r.nombre, 'cartas', v_cartas, 'set', null, 'por', v_por));
      continue;
    end if;

    select count(*) into v_casan
      from jsonb_array_elements_text(r.cartas) as s(n)
      join public.tcg_cards c on c.market = 'JP' and c.set_id = v_set
       and nullif(ltrim(lower(split_part(c.local_id, '/', 1)), '0'), '') = nullif(ltrim(lower(s.n), '0'), '');
    if v_casan * 2 < v_cartas then
      informe := informe || jsonb_build_array(jsonb_build_object('tcgdex', r.s, 'nombre', r.nombre, 'cartas', v_cartas, 'set', v_set, 'por', v_por || ', pero solo casan ' || v_casan || ': saltado'));
      continue;
    end if;

    for k in
      select distinct on (c.id) c.id, c.set_id, c.name, c.cm_id_product_propio
        from jsonb_array_elements_text(r.cartas) as s(n)
        join public.tcg_cards c on c.market = 'JP' and c.set_id = v_set
         and nullif(ltrim(lower(split_part(c.local_id, '/', 1)), '0'), '') = nullif(ltrim(lower(s.n), '0'), '')
    loop
      -- En este orden: la web ordena las ediciones por su id, y van hacia abajo.
      if not exists (select 1 from public.tcg_card_versions where card_id = k.id and market = 'JP' and origen = 'edicion' and etiqueta = '1st Edition') then
        insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
        values (-nextval('public.tcg_card_versions_mano_seq')::int, 'JP', k.id, k.set_id, k.name, '1st Edition', 'impresion', null, 'edicion', now());
        v_nuevas := v_nuevas + 1;
      end if;
      if not exists (select 1 from public.tcg_card_versions where card_id = k.id and market = 'JP' and origen = 'edicion' and etiqueta = 'Unlimited') then
        insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
        values (-nextval('public.tcg_card_versions_mano_seq')::int, 'JP', k.id, k.set_id, k.name, 'Unlimited', 'impresion', k.cm_id_product_propio, 'edicion', now());
        v_nuevas := v_nuevas + 1;
      end if;
      update public.user_collection set variante = 'unlimited'
       where card_id = k.id and market = 'JP' and coalesce(variante, 'normal') in ('holo', 'normal');
      get diagnostics v_n = row_count;
      v_copias := v_copias + v_n;
    end loop;

    informe := informe || jsonb_build_array(jsonb_build_object('tcgdex', r.s, 'nombre', r.nombre, 'cartas', v_cartas, 'set', v_set, 'por', v_por, 'casan', v_casan, 'ediciones_nuevas', v_nuevas, 'copias_a_unlimited', v_copias));
  end loop;

  insert into public.scrydex_estado (clave, valor, updated_at)
  values ('ediciones_jp_948', jsonb_build_object('sets', informe, 'at', now()), now())
  on conflict (clave) do update set valor = excluded.valor, updated_at = now();
end
$do$;

notify pgrst, 'reload schema';

commit;

-- Lo que ha hecho, un renglón por set de TCGdex (el SQL Editor enseña esta tabla).
select x->>'tcgdex' as tcgdex, x->>'nombre' as nombre, (x->>'cartas')::int as cartas,
       x->>'set' as nuestro_set, t.name as se_llama, x->>'por' as casado_por,
       (x->>'casan')::int as casan, (x->>'ediciones_nuevas')::int as ediciones_nuevas,
       (x->>'copias_a_unlimited')::int as copias_a_unlimited
  from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') as x
  left join public.tcg_sets t on t.id = x->>'set' and t.market = 'JP'
 where e.clave = 'ediciones_jp_948';
`
writeFileSync(destino, sql)
console.log('escrito', destino, (sql.length / 1024).toFixed(0), 'KB', datos.length, 'sets', cartas, 'cartas')
