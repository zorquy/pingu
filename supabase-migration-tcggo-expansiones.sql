-- ============================================================
-- Tanda 646: lo que vale cada expansión, día a día.
--
-- TCGGO da por expansión la suma de los mínimos de sus cartas en Cardmarket
-- y en TCGplayer (prices.cardmarket.total / prices.tcgplayer.total). Una
-- fila por set y día: con la de hoy y la de hace una semana sale el
-- «semanal» de la tarjeta de /cartas y de la estantería.
--
-- Es idempotente: se puede ejecutar más de una vez. Después de
-- supabase-migration-tcggo-catalogo.sql (vuelve a escribir
-- tcggo_guardar_sets, que aquella ya reescribía).
-- ============================================================

begin;

create table if not exists public.tcg_set_valor (
  set_id text not null,
  market text not null default 'WEST',
  dia date not null,
  valor_cm numeric,
  valor_tp numeric,
  origen text not null default 'tcggo',
  primary key (set_id, market, dia)
);

-- La lee el navegador (la política de SELECT va en la misma migración:
-- sin ella la RLS no da error, devuelve cero filas — tanda 510).
alter table public.tcg_set_valor enable row level security;
drop policy if exists tcg_set_valor_ver on public.tcg_set_valor;
create policy tcg_set_valor_ver on public.tcg_set_valor for select using (true);
grant select on public.tcg_set_valor to anon, authenticated;

-- ── Los sets que ya tenemos: logo, fecha, totales… y el valor de hoy ──
-- Misma regla que antes para lo que es del set (solo rellena lo vacío); el
-- valor es de HOY y va a su tabla, pisando la fila del día si ya estaba.
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
         tcggo_id = coalesce(p.tcggo_id, s.tcggo_id),
         release_date = coalesce(s.release_date, p.fecha),
         card_count_total = coalesce(s.card_count_total, nullif(p.cartas, 0)),
         card_count_official = coalesce(s.card_count_official, nullif(p.impresas, 0))
    from jsonb_to_recordset(p_sets) as p(id text, tcggo_id int, logo text, fecha date, cartas int, impresas int)
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

commit;

notify pgrst, 'reload schema';

-- Comprobación: cuántos sets tienen valor hoy.
select market, count(*) as sets_con_valor, round(sum(valor_cm)) as suma_cm
  from public.tcg_set_valor
 where dia = current_date
 group by market;
