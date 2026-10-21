-- ============================================================
-- Tanda 929: el símbolo de cada expansión, de TCGGO.
--
-- TCGGO anunció que sus expansiones traen `symbol` al lado de `logo` (una
-- dirección entera de images.tcggo.com, null si no hay). La pasada de
-- precios ya manda `simbolo` en cada set a `tcggo_guardar_sets`; esta
-- migración le da su columna y hace que la función la escriba.
--
-- La web pide `symbol_tcggo` con respaldo: mientras esto no se ejecute, la
-- estantería repite la consulta sin ella y no se rompe nada.
--
-- Es idempotente: se puede ejecutar más de una vez. Va después de
-- supabase-migration-tcggo-expansiones.sql (reescribe la misma función, con
-- todo lo que aquella hacía).
-- ============================================================

begin;

alter table public.tcg_sets add column if not exists symbol_tcggo text;

create or replace function public.tcggo_guardar_sets(p_sets jsonb, p_market text default 'WEST')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  update public.tcg_sets s
     set logo_tcggo = coalesce(nullif(p.logo, ''), s.logo_tcggo),
         -- El símbolo, como el logo: el de TCGGO cuando lo da.
         symbol_tcggo = coalesce(nullif(p.simbolo, ''), s.symbol_tcggo),
         tcggo_id = coalesce(p.tcggo_id, s.tcggo_id),
         release_date = coalesce(s.release_date, p.fecha),
         card_count_total = coalesce(s.card_count_total, nullif(p.cartas, 0)),
         card_count_official = coalesce(s.card_count_official, nullif(p.impresas, 0))
    from jsonb_to_recordset(p_sets) as p(id text, tcggo_id int, logo text, simbolo text, fecha date, cartas int, impresas int)
   where s.id = p.id and s.market = p_market;
  get diagnostics v_filas = row_count;

  insert into public.tcg_set_valor (set_id, market, dia, valor_cm, valor_tp)
  select p.id, p_market, current_date, nullif(p.valor_cm, 0), nullif(p.valor_tp, 0)
    from jsonb_to_recordset(p_sets) as p(id text, valor_cm numeric, valor_tp numeric)
   where (p.valor_cm is not null or p.valor_tp is not null)
     and exists (select 1 from public.tcg_sets s where s.id = p.id and s.market = p_market)
  on conflict (set_id, market, dia) do update
    set valor_cm = excluded.valor_cm,
        valor_tp = excluded.valor_tp;

  return v_filas;
end;
$$;
revoke all on function public.tcggo_guardar_sets(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_guardar_sets(jsonb, text) to service_role;

notify pgrst, 'reload schema';

commit;
