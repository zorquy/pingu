-- ─────────────────────────────────────────────────────────────────────
-- «¿MÁS CARO O MÁS BARATO?» (tanda 583): las seis cartas de cada día.
--
-- Las elige la primera petición del día (netlify/functions/mas-caro.mjs)
-- y se dejan aquí para que todo el mundo juegue con las mismas: la lista
-- de cartas con precio cambia cada diez minutos (precios-coleccion), así
-- que una semilla sobre «cuántas hay» daría cartas distintas según la
-- hora. Es la misma razón y la misma forma que `carta_del_dia` (570).
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

create table if not exists public.mas_caro_del_dia (
  day date primary key,
  card_ids text[] not null,
  created_at timestamptz not null default now()
);

alter table public.mas_caro_del_dia enable row level security;

-- Pública: es un juego. Escribe solo la función, con la clave de servicio.
drop policy if exists mas_caro_del_dia_ver on public.mas_caro_del_dia;
create policy mas_caro_del_dia_ver on public.mas_caro_del_dia for select using (true);
grant select on public.mas_caro_del_dia to anon, authenticated;

commit;

notify pgrst, 'reload schema';
