-- ============================================================
-- Tanda 948b: la 1.ª edición y la Unlimited de las japonesas antiguas, con
-- los tres sets que la 948 no casó (E4, VS1 y PCG3).
--
-- La tabla de la 948 casó 13 de 16 y enseñó por qué faltaban: muchos sets
-- japoneses nuestros se llaman «pcg4_ja» (el «_ja» de cuando venían de
-- TCGdex), así que el id no casaba y todo fue por el día; y E4 y VS1 tienen
-- en TCGGO otro día. Esta es LA MISMA migración con dos pasos más al casar:
-- el id con «_ja» y el nombre inglés OFICIAL de cada set (escrito a mano, el
-- que TCGGO usa: la tabla de la 948 los enseñó). Es idempotente: en los trece
-- ya hechos no crea nada (sus «ediciones_nuevas» salen a 0).
--
-- Lo de la 948, tal cual:
-- En el foro: «Wind from the Sea, existe 1.ª Edición y Unlimited, no me deja
-- añadir 1.ª edición» (y Flight of Legends, Rocket Gang Strikes Back, Golden
-- Sky Silvery Ocean…). Y PINGU: «yo creo que es porque las variantes las
-- cogemos de TCGdex o de otro sitio y al añadir solo coge de TCGGO».
--
-- Es eso. Desde la 806 el catálogo japonés es ENTERO de TCGGO, que da cada
-- carta una vez y sin decir si tuvo 1.ª edición; su fila «Standard» (937)
-- dice «la he mirado», así que la web ofrecía una sola versión, la normal.
-- Los ficheros de tcgdex/cards-database (data-asia) sí lo dicen: 1370
-- cartas de 16 sets (e-Card E1–E5, PCG1–PCG9, VS1 y web1) con
-- su 1.ª edición y su Unlimited. Van aquí dentro, generadas por
-- herramientas/ediciones-japonesas/generar-sql.mjs (rama `pruebas`).
--
-- Es lo mismo que la 935 hizo con Wizards: cada edición, una fila de
-- `tcg_card_versions` con `origen = 'edicion'` colgada de NUESTRA carta
-- japonesa, y la web ofrece esas dos y ninguna más. La Unlimited lleva el
-- producto de Cardmarket de la carta (el precio de la carta es el suyo); la
-- 1.ª edición va sin él, sin cifra, como en la 935.
--
-- CASAR LOS SETS. Los nuestros son los de TCGGO, con otros ids. Por orden:
--  1. el id o el código del set igual al de TCGdex («PCG4» o «pcg4_ja»);
--  1b. si no, su nombre inglés oficial (sin acentos ni signos);
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
-- Lo que ha hecho queda en `scrydex_estado` (clave ediciones_jp_948) y se
-- enseña al final, un renglón por set de TCGdex.
-- ============================================================

begin;

do $do$
declare
  d jsonb := '[{"s":"PCG1","nombre":"伝説の飛翔","en":["flightoflegends"],"fecha":"2004-04-09","oficial":82,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082"]},{"s":"PCG2","nombre":"蒼空の激突","en":["clashofthebluesky"],"fecha":"2004-07-01","oficial":82,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082"]},{"s":"PCG3","nombre":"ロケット団の逆襲","en":["rocketgangstrikesback"],"fecha":"2004-10-15","oficial":84,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085"]},{"s":"PCG4","nombre":"金の空、銀の海","en":["goldenskysilveryocean"],"fecha":"2005-04-08","oficial":106,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089","090","091","092","093","094","095","096","097","098","099","100","101","102","103","104","105","106"]},{"s":"PCG5","nombre":"まぼろしの森","en":["mirageforest"],"fecha":"2005-06-30","oficial":86,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086"]},{"s":"PCG6","nombre":"ホロンの研究塔","en":["holonresearchtower"],"fecha":"2005-10-28","oficial":86,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086"]},{"s":"PCG7","nombre":"ホロンの幻影","en":["holonphantom"],"fecha":"2006-01-27","oficial":52,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052"]},{"s":"PCG8","nombre":"きせきの結晶","en":["miraclecrystal"],"fecha":"2006-03-10","oficial":75,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075"]},{"s":"PCG9","nombre":"さいはての攻防","en":["offenseanddefenseofthefurthestends"],"fecha":"2006-06-29","oficial":68,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068"]},{"s":"VS1","nombre":"ポケモンカード★VS","en":["pokemonvs","pokemoncardvs","pokemoncardvs"],"fecha":"2001-07-19","oficial":141,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","078","079","080","081","082","083","084","085","086","087","088","089","090","091","092","093","094","095","096","097","098","099","100","101","102","103","104","105","106","107","108","109","110","111","112","113","114","115","116","117","118","119","120","121","122","123","124","125","126","127","128","129","130","131","132","133","134","135","136","137","138","139","140","141","143","144","151"]},{"s":"E1","nombre":"基本拡張パック","en":["baseexpansionpack"],"fecha":"2001-12-01","oficial":128,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089","090","091","092","093","094","095","096","097","098","099","100","101","102","103","104","105","106","107","108","109","110","111","112","113","114","115","116","117","118","119","120","121","122","123","124","125","126","127","128"]},{"s":"E2","nombre":"地図にない町","en":["thetownonnomap"],"fecha":"2002-03-08","oficial":92,"cartas":["001","002","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","021","022","023","024","025","026","029","030","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089"]},{"s":"E3","nombre":"海からの風","en":["windfromthesea"],"fecha":"2002-05-24","oficial":87,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","021","022","024","025","028","029","030","031","033","034","035","036","037","038","039","040","041","043","044","047","048","049","050","051","054","055","056","058","059","060","061","062","063","064","065","067","068","069","073","077","078","079","080","081","082","083","084","085","087"]},{"s":"E4","nombre":"裂けた大地","en":["splitearth","thesplitearth"],"fecha":"2002-08-23","oficial":88,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089","090","091"]},{"s":"E5","nombre":"神秘なる山","en":["mysteriousmountains"],"fecha":"2002-10-04","oficial":88,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089","090","091"]},{"s":"web1","nombre":"ポケモンカード★web","en":["pokemonweb","pokemoncardweb","pokemoncardweb"],"fecha":"2001-10-20","oficial":48,"cartas":["001","002","003","004","005","006","007","008","009","010","011","012","013","014","015","016","017","018","019","020","021","022","023","024","025","026","027","028","029","030","031","032","033","034","035","036","037","038","040","041","042","043","044","045","046","047","048"]}]'::jsonb;
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
    select x->>'s' as s, x->>'nombre' as nombre, coalesce(x->'en', '[]'::jsonb) as en, nullif(x->>'fecha', '')::date as fecha, nullif(x->>'oficial', '')::int as oficial, x->'cartas' as cartas
      from jsonb_array_elements(d) as x
  loop
    v_cartas := jsonb_array_length(r.cartas);
    v_set := null; v_por := null; v_nuevas := 0; v_copias := 0;

    -- 1. El id o el código.
    select array_agg(id) into v_ids from public.tcg_sets
     where market = 'JP' and not coalesce(oculto, false)
       and (lower(id) in (lower(r.s), lower(r.s) || '_ja') or lower(coalesce(tcg_online_code, '')) = lower(r.s));
    if coalesce(array_length(v_ids, 1), 0) = 1 then
      v_set := v_ids[1]; v_por := 'id o código';
    end if;

    -- 1b. El nombre inglés oficial.
    if v_set is null and jsonb_array_length(r.en) > 0 then
      select array_agg(id) into v_ids from public.tcg_sets
       where market = 'JP' and not coalesce(oculto, false)
         and regexp_replace(lower(public.immutable_unaccent(coalesce(name_en, name, ''))), '[^a-z0-9]+', '', 'g')
             in (select jsonb_array_elements_text(r.en));
      if coalesce(array_length(v_ids, 1), 0) = 1 then
        v_set := v_ids[1]; v_por := 'nombre inglés';
      end if;
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
