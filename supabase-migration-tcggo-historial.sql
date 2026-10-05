-- ─────────────────────────────────────────────────────────────────────
-- EL HISTÓRICO DE PRECIOS DE UNA CARTA (tanda 643).
--
-- Una fila por carta y día con el mínimo de Cardmarket en cada idioma y
-- TCGplayer en euros. Se llena por dos caminos:
--   · la foto diaria (`historial_foto_diaria`): al acabar la pasada de
--     precios de TCGGO, una fila de hoy para cada carta que alguien tiene
--     en su colección — cero peticiones, sale de lo que ya se ha escrito;
--   · a demanda (`tcggo-historial`): la primera vez que alguien abre la
--     ficha de una carta, su histórico de TCGGO (una petición, hasta 30
--     fechas) para que la gráfica no empiece vacía.
-- Lo lee todo el mundo: es el precio de una carta, no de una persona.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

create table if not exists public.tcg_card_history (
  card_id text not null,
  dia date not null,
  cm_low numeric(10, 2),
  cm_low_es numeric(10, 2),
  cm_low_en numeric(10, 2),
  cm_low_de numeric(10, 2),
  cm_low_fr numeric(10, 2),
  cm_low_it numeric(10, 2),
  cm_low_ja numeric(10, 2),
  tp_market_eur numeric(10, 2),
  origen text,
  primary key (card_id, dia)
);

alter table public.tcg_card_history enable row level security;
drop policy if exists tcg_card_history_ver on public.tcg_card_history;
create policy tcg_card_history_ver on public.tcg_card_history for select using (true);
grant select on public.tcg_card_history to anon, authenticated;

-- Cuándo se pidió a TCGGO el histórico de esta carta por última vez.
alter table public.tcg_card_prices add column if not exists historial_at timestamptz;

-- La foto de hoy, de las cartas que alguien tiene (las demás no tienen a
-- quién importarle, y 23.000 filas al día serían 8 millones al año).
create or replace function public.historial_foto_diaria(p_dia date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.tcg_card_history (card_id, dia, cm_low, cm_low_es, cm_low_en, cm_low_de, cm_low_fr, cm_low_it, cm_low_ja, tp_market_eur, origen)
  select p.card_id, p_dia, p.cm_low, p.cm_low_es, p.cm_low_en, p.cm_low_de, p.cm_low_fr, p.cm_low_it, p.cm_low_ja, p.tp_market_eur, 'foto'
    from public.tcg_card_prices p
   where exists (select 1 from public.user_collection c where c.card_id = p.card_id)
     and coalesce(p.cm_low, p.cm_low_es, p.cm_low_en, p.cm_low_de, p.cm_low_fr, p.cm_low_it, p.cm_low_ja, p.tp_market_eur) is not null
  on conflict (card_id, dia) do update
    set cm_low = excluded.cm_low, cm_low_es = excluded.cm_low_es, cm_low_en = excluded.cm_low_en,
        cm_low_de = excluded.cm_low_de, cm_low_fr = excluded.cm_low_fr, cm_low_it = excluded.cm_low_it,
        cm_low_ja = excluded.cm_low_ja, tp_market_eur = excluded.tp_market_eur, origen = 'foto';
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
revoke all on function public.historial_foto_diaria(date) from public, anon, authenticated;
grant execute on function public.historial_foto_diaria(date) to service_role;

commit;

notify pgrst, 'reload schema';

-- Comprobación: cuántas cartas tienen histórico y de cuántos días.
select count(distinct card_id) as cartas, count(*) as filas, min(dia) as desde, max(dia) as hasta from public.tcg_card_history;
