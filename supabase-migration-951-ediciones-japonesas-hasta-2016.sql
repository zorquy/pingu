-- ============================================================
-- Tanda 951: la 1.ª edición y la Unlimited de TODOS los sets japoneses de
-- 2001 a septiembre de 2016.
--
-- PINGU: «todas las cartas japonesas hasta septiembre de 2016 —acaba con XY
-- Evoluciones y CP6, el Expansion Pack 20th Anniversary—; a partir de Sol y
-- Luna ya no existe la primera edición. Sé que me has montado en el admin
-- para ponerlo set a set, pero ¿por qué no lo haces tú automáticamente para
-- todos los sets previos? Si no, tengo que ir de uno en uno».
--
-- El tramo empieza en julio de 2001 y no antes: el japonés de Base, Jungle,
-- Fossil, Rocket, Gym y neo NO tuvo 1.ª edición; la primera fue la de VS y
-- web (2001), y desde ahí e-Card, ADV, PCG, DP, Platino, LEGEND, BW y XY.
--
-- A cada carta de esos sets, «1st Edition» y «Unlimited» como filas de
-- edición (las de la 935, la 948 y la 949): la Unlimited con el producto de
-- Cardmarket de la carta, la 1.ª edición sin él. Las copias «Normal»/«Holo»
-- pasan a «Unlimited»; las demás se quedan.
--
-- NO se tocan: los sets escondidos, los de promos (las promos no llevan
-- edición) y los que ya tienen alguna edición (los de la 948, o lo que se
-- haya puesto a mano con «Versiones de todas»). Un set que solo tuvo 1.ª
-- edición (BW8a, según TCGdex) se queda con una Unlimited de más: se quita en
-- /admin → «Versiones de todas» → «Quitar estas versiones».
--
-- Va DESPUÉS de la 935. Idempotente: una segunda vez no toca nada (todos
-- tienen ya ediciones). Lo hecho queda en `scrydex_estado` (clave
-- ediciones_jp_951) y se enseña al final, un renglón por set.
-- ============================================================

begin;

do $do$
declare
  s record;
  c record;
  v_cartas int;
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

  for s in
    select t.id, t.name, t.name_en, t.release_date
      from public.tcg_sets t
     where t.market = 'JP' and not coalesce(t.oculto, false)
       and t.release_date >= date '2001-07-01' and t.release_date <= date '2016-09-30'
       and coalesce(t.name_en, '') !~* 'promo' and coalesce(t.name, '') !~* 'promo'
       and exists (select 1 from public.tcg_cards k where k.market = 'JP' and k.set_id = t.id)
       and not exists (
         select 1 from public.tcg_card_versions v
          where v.market = 'JP' and v.set_id = t.id and v.origen = 'edicion'
       )
     order by t.release_date, t.id
  loop
    v_cartas := 0; v_nuevas := 0; v_copias := 0;
    for c in select id, set_id, name, cm_id_product_propio from public.tcg_cards where market = 'JP' and set_id = s.id order by id loop
      v_cartas := v_cartas + 1;
      -- En este orden: la web ordena las de edición por su id (van hacia abajo).
      insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
      values (-nextval('public.tcg_card_versions_mano_seq')::int, 'JP', c.id, c.set_id, c.name, '1st Edition', 'impresion', null, 'edicion', now()),
             (-nextval('public.tcg_card_versions_mano_seq')::int, 'JP', c.id, c.set_id, c.name, 'Unlimited', 'impresion', c.cm_id_product_propio, 'edicion', now());
      v_nuevas := v_nuevas + 2;
    end loop;
    update public.user_collection u set variante = 'unlimited'
     where u.market = 'JP' and coalesce(u.variante, 'normal') in ('normal', 'holo')
       and u.card_id in (select id from public.tcg_cards where market = 'JP' and set_id = s.id);
    get diagnostics v_n = row_count;
    v_copias := v_n;
    informe := informe || jsonb_build_array(jsonb_build_object('set', s.id, 'nombre', coalesce(s.name_en, s.name), 'salio', s.release_date, 'cartas', v_cartas, 'ediciones_nuevas', v_nuevas, 'copias_a_unlimited', v_copias));
  end loop;

  insert into public.scrydex_estado (clave, valor, updated_at)
  values ('ediciones_jp_951', jsonb_build_object('sets', informe, 'at', now()), now())
  on conflict (clave) do update set valor = case when jsonb_array_length(excluded.valor->'sets') > 0 then excluded.valor else public.scrydex_estado.valor end, updated_at = now();
end
$do$;

notify pgrst, 'reload schema';

commit;

-- Lo que ha hecho, un renglón por set (el SQL Editor enseña esta tabla).
select x->>'set' as nuestro_set, x->>'nombre' as nombre, x->>'salio' as salio,
       (x->>'cartas')::int as cartas, (x->>'ediciones_nuevas')::int as ediciones_nuevas,
       (x->>'copias_a_unlimited')::int as copias_a_unlimited
  from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') as x
 where e.clave = 'ediciones_jp_951'
 order by x->>'salio', x->>'set';
