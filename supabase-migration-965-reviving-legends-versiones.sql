-- ============================================================
-- Tanda 965: Reviving Legends (japonés) vuelve a sus dos versiones.
--
-- PINGU: «en el set de Reviving Legends japonés la he liado: ya hiciste una
-- corrección y ahora he ido yo manualmente y he añadido, y hay hasta cinco
-- versiones de la misma carta. Revértelo y ponlo con la lógica que hiciste».
--
-- La lógica es la de la 951: a cada carta, «1st Edition» y «Unlimited» (la
-- Unlimited con el producto de Cardmarket de la carta). Aquí, en los sets
-- japoneses visibles que se llaman Reviving Legends (よみがえる伝説):
--
--  1. Se guarda una copia de TODAS las versiones de edición y a mano de esas
--     cartas en `scrydex_estado` (clave reviving_legends_965), para poder
--     deshacerlo.
--  2. Se borran las de edición y a mano que no son «1st Edition» ni
--     «Unlimited», y las repetidas (de cada una se queda la más antigua).
--     Las de TCGGO no se tocan (no son de edición: la web no las mezcla).
--  3. A la carta que le falte alguna de las dos, se le pone, como en la 951.
--  4. Las copias de la gente que apuntaban a una versión borrada pasan a la
--     que queda: a «1st Edition» si era de 1.ª edición, a «Unlimited» si no.
--
-- Va después de la 951. Se puede ejecutar dos veces (la segunda no toca nada
-- y no pisa la copia de la primera).
-- ============================================================

begin;

do $do$
declare
  v_sets text[];
  v_copia jsonb;
  v_borradas int := 0;
  v_puestas int := 0;
  v_movidas int := 0;
  c record;
begin
  select coalesce(array_agg(id), '{}') into v_sets
  from public.tcg_sets
  where market = 'JP' and not coalesce(oculto, false)
    and (coalesce(name_en, '') ~* 'reviving legends' or coalesce(name, '') ~* 'reviving legends' or coalesce(name, '') like '%よみがえる伝説%');
  if cardinality(v_sets) = 0 then
    raise notice 'No hay ningún set japonés visible que se llame Reviving Legends: no se toca nada.';
    return;
  end if;

  -- 1. La copia de lo que hay (solo lo de edición y a mano).
  select coalesce(jsonb_agg(to_jsonb(v) order by v.card_id, v.tcggo_id desc), '[]'::jsonb) into v_copia
  from public.tcg_card_versions v
  where v.market = 'JP' and v.set_id = any (v_sets) and v.origen in ('edicion', 'mano');

  -- 2. Fuera lo que no es de la 951, y las repetidas (se queda la más
  -- antigua: los ids son negativos y van hacia abajo, la mayor es la primera).
  with sobran as (
    select v.tcggo_id
    from public.tcg_card_versions v
    where v.market = 'JP' and v.set_id = any (v_sets) and v.origen in ('edicion', 'mano')
      and (
        lower(trim(coalesce(v.etiqueta, ''))) not in ('1st edition', 'unlimited')
        or v.tcggo_id <> (
          select max(w.tcggo_id) from public.tcg_card_versions w
          where w.market = v.market and w.card_id = v.card_id and w.origen in ('edicion', 'mano')
            and lower(trim(w.etiqueta)) = lower(trim(v.etiqueta))
        )
      )
  )
  delete from public.tcg_card_versions v using sobran s
  where v.market = 'JP' and v.tcggo_id = s.tcggo_id;
  get diagnostics v_borradas = row_count;

  -- 3. Las dos de la 951 a la carta que le falte alguna.
  for c in
    select k.id, k.set_id, k.name, k.cm_id_product_propio, x.etiqueta
    from public.tcg_cards k
    cross join (values ('1st Edition', 1), ('Unlimited', 2)) as x(etiqueta, orden)
    where k.market = 'JP' and k.set_id = any (v_sets)
      and not exists (
        select 1 from public.tcg_card_versions w
        where w.market = 'JP' and w.card_id = k.id and w.origen in ('edicion', 'mano') and lower(trim(w.etiqueta)) = lower(x.etiqueta)
      )
    order by k.id, x.orden
  loop
    insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
    values (-nextval('public.tcg_card_versions_mano_seq')::int, 'JP', c.id, c.set_id, c.name, c.etiqueta, 'impresion',
            case when c.etiqueta = 'Unlimited' then c.cm_id_product_propio end, 'edicion', now());
    v_puestas := v_puestas + 1;
  end loop;

  -- 4. Las copias que apuntaban a una versión que ya no está.
  update public.user_collection u
     set variante = case when coalesce(u.variante, '') ~* '(^|-)(primera|1st|1-a|first)' then 'primera' else 'unlimited' end
   where u.market = 'JP'
     and u.card_id in (select id from public.tcg_cards where market = 'JP' and set_id = any (v_sets))
     and coalesce(u.variante, 'normal') not in ('primera', 'unlimited');
  get diagnostics v_movidas = row_count;

  -- La copia solo se guarda si esta pasada ha cambiado algo: una segunda
  -- ejecución no pisa la buena.
  if v_borradas + v_puestas + v_movidas > 0 then
    insert into public.scrydex_estado (clave, valor, updated_at)
    values ('reviving_legends_965', jsonb_build_object('at', now(), 'sets', to_jsonb(v_sets), 'borradas', v_borradas,
            'puestas', v_puestas, 'copias_movidas', v_movidas, 'antes', v_copia), now())
    on conflict (clave) do update set valor = excluded.valor, updated_at = now();
  end if;
end
$do$;

notify pgrst, 'reload schema';

commit;

-- Lo que queda: un renglón por set, con cuántas cartas tienen cada versión.
select s.id as nuestro_set, coalesce(s.name_en, s.name) as nombre,
       (select count(*) from public.tcg_cards k where k.market = 'JP' and k.set_id = s.id) as cartas,
       (select string_agg(e || ' × ' || n, ', ' order by e) from (
          select v.etiqueta as e, count(*) as n from public.tcg_card_versions v
          where v.market = 'JP' and v.set_id = s.id and v.origen in ('edicion', 'mano') group by v.etiqueta) t) as versiones,
       (select valor->>'borradas' from public.scrydex_estado where clave = 'reviving_legends_965') as borradas,
       (select valor->>'copias_movidas' from public.scrydex_estado where clave = 'reviving_legends_965') as copias_movidas
from public.tcg_sets s
where s.market = 'JP' and not coalesce(s.oculto, false)
  and (coalesce(s.name_en, '') ~* 'reviving legends' or coalesce(s.name, '') ~* 'reviving legends' or coalesce(s.name, '') like '%よみがえる伝説%');
