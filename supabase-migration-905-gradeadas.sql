-- ════════════════════════════════════════════════════════════════════
-- Una gradeada vale lo que vale su nota (tanda 905)
--
-- TCGbycharlie, en el foro: «cuando añado mis cartas gradeadas a mi
-- colección me siguen saliendo los precios de las cartas en formato RAW».
-- TCGGO ya da las gradeadas por casa y nota (`cm_gradeadas` en euros,
-- `ebay_gradeadas` en dólares) y la línea ya guarda «PSA 10»: la web las
-- junta desde la 905 (`valorDeLinea` en js/cardmarket.js). Esto hace que
-- la FOTO DIARIA del valor sume lo mismo que la cabecera (la 377): si no,
-- la gráfica diría 140 € de una PSA 10 que arriba vale 2.621 €.
--
-- El orden es el de la web: «Tu valor» → el precio de su nota (Cardmarket
-- primero; si no, la mediana de eBay pasada a euros) → la carta sin
-- gradear. Solo casa una nota NUMÉRICA: «BGS 10 Black Label» o «CGC
-- Perfect 10» no son el 10 de su casa, y un gradeo escrito a mano
-- tampoco.
--
-- Ejecutar en el SQL Editor. Re-ejecutable. Cada sentencia va sola (631).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.valor_gradeado(p_gradeo text, p_cm jsonb, p_ebay jsonb)
returns numeric
language sql
immutable
as $$
  with g as (
    select lower(split_part(btrim(p_gradeo), ' ', 1)) as casa,
           btrim(substr(btrim(p_gradeo), strpos(btrim(p_gradeo), ' ') + 1)) as nota
     where strpos(btrim(coalesce(p_gradeo, '')), ' ') > 1
  ),
  n as (
    select casa, nota, nota::numeric as num from g where nota ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  -- Las claves de Cardmarket llevan la casa delante («psa10») y las de
  -- eBay van peladas («10»): se comparan sin la casa y por su valor.
  cm as (
    select case when jsonb_typeof(e.value) = 'number' then (e.value)::text::numeric end as v, e.key
      from n, jsonb_each(case when jsonb_typeof(p_cm) = 'object' and jsonb_typeof(p_cm -> n.casa) = 'object' then p_cm -> n.casa else '{}'::jsonb end) e
     where case when regexp_replace(lower(e.key), '^' || n.casa, '') ~ '^[0-9]+(\.[0-9]+)?$'
                then regexp_replace(lower(e.key), '^' || n.casa, '')::numeric = n.num
                else regexp_replace(lower(e.key), '^' || n.casa, '') = n.nota end
  ),
  eb as (
    select case when jsonb_typeof(e.value -> 'median_price') = 'number' then (e.value ->> 'median_price')::numeric end as v, e.key
      from n, jsonb_each(case when jsonb_typeof(p_ebay) = 'object' and jsonb_typeof(p_ebay -> n.casa) = 'object' then p_ebay -> n.casa else '{}'::jsonb end) e
     where case when regexp_replace(lower(e.key), '^' || n.casa, '') ~ '^[0-9]+(\.[0-9]+)?$'
                then regexp_replace(lower(e.key), '^' || n.casa, '')::numeric = n.num
                else regexp_replace(lower(e.key), '^' || n.casa, '') = n.nota end
  )
  select coalesce(
    (select v from cm where v > 0 order by key limit 1),
    (select round(v * public.eur_por_usd(), 2) from eb where v > 0 order by key limit 1)
  );
$$;

comment on function public.valor_gradeado(text, jsonb, jsonb) is
  'El precio en euros de UNA gradeada («PSA 10») según cm_gradeadas (EUR) o ebay_gradeadas (USD, convertido). Null si no hay esa nota. Igual que valorGradeado en js/cardmarket.js (905).';

create or replace function public.coleccion_foto_diaria(p_dia date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.user_collection_value (user_id, dia, valor, copias, distintas, sin_precio)
  select c.user_id,
         p_dia,
         sum(case
               when coalesce(c.valor_manual, 0) = 0
                and public.valor_gradeado(c.gradeo, pr.cm_gradeadas, pr.ebay_gradeadas) is not null
               then public.valor_gradeado(c.gradeo, pr.cm_gradeadas, pr.ebay_gradeadas) * greatest(coalesce(c.cantidad, 1), 0)
               else public.valor_de_linea(
                 c.valor_manual, c.cantidad, c.variante, c.idioma,
                 pr.cm_low_es, pr.cm_low_en, pr.cm_low_de, pr.cm_low_fr, pr.cm_low_it, pr.cm_low_ja,
                 pr.cm_trend, pr.cm_avg30, pr.cm_low,
                 pr.cm_trend_holo, pr.cm_avg30_holo, pr.cm_low_holo,
                 pr.tp_market_eur,
                 pr.tp_normal_market, pr.tp_normal_low, pr.tp_holo_market, pr.tp_holo_low,
                 pr.tp_reverse_market, pr.tp_reverse_low, pr.tp_primera_market, pr.tp_primera_low)
             end),
         sum(c.cantidad),
         count(distinct c.card_id),
         coalesce(sum(c.cantidad) filter (
           where coalesce(c.valor_manual, 0) = 0
             and public.valor_gradeado(c.gradeo, pr.cm_gradeadas, pr.ebay_gradeadas) is null
             and coalesce(pr.cm_low_es, pr.cm_low_en, pr.cm_low_de, pr.cm_low_fr, pr.cm_low_it, pr.cm_low_ja, 0) = 0
             and coalesce(pr.cm_trend, pr.cm_avg30, pr.cm_low, 0) = 0
             and coalesce(pr.tp_market_eur, 0) = 0
             and coalesce(pr.tp_normal_market, pr.tp_normal_low, pr.tp_holo_market, pr.tp_holo_low, pr.tp_reverse_market, pr.tp_reverse_low, pr.tp_primera_market, pr.tp_primera_low, 0) = 0
         ), 0)
    from public.user_collection c
    left join public.tcg_card_prices pr on pr.card_id = c.card_id
   group by c.user_id
  on conflict (user_id, dia) do update
    set valor = excluded.valor,
        copias = excluded.copias,
        distintas = excluded.distintas,
        sin_precio = excluded.sin_precio;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke all on function public.coleccion_foto_diaria(date) from public, anon, authenticated;
grant execute on function public.coleccion_foto_diaria(date) to service_role;

-- ── Comprobación ───────────────────────────────────────────────────
-- 2621 (PSA 10 de Cardmarket), 86 (BGS 9.5 de eBay: 100 $ × 0,86) y
-- tres nulos (una nota que no hay, una Black Label y un gradeo a mano).
select public.valor_gradeado('PSA 10', '{"psa":{"psa10":2621,"psa9":184}}', null) as psa_10,
       public.valor_gradeado('BGS 9.5', null, '{"bgs":{"9.5":{"median_price":100,"sample_size":3}}}') as bgs_95_ebay,
       public.valor_gradeado('PSA 8', '{"psa":{"psa10":2621}}', null) as psa_8_no_hay,
       public.valor_gradeado('BGS 10 Black Label', '{"bgs":{"bgs10":3000}}', null) as black_label_no,
       public.valor_gradeado('grado 9 propio', '{"psa":{"psa9":184}}', null) as a_mano_no;
