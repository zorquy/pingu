-- «¿Qué carta es?» (tanda 570): la carta de cada día.
--
-- La elige la función `carta-del-dia` la primera vez que alguien la pide
-- ese día, con una semilla que sale de la fecha, y la deja aquí para que
-- TODO EL MUNDO vea la misma: el catálogo crece cada hora (Scrydex,
-- TCGdex), así que elegirla sobre la marcha en cada navegador daría una
-- carta distinta a cada uno según el momento. Un juego diario sin «la
-- misma para todos» no es un juego diario.
--
-- Solo escribe la función (clave de servicio). La lectura pública es para
-- el día que el navegador la quiera leer directo; hoy pasa por la función.
create table if not exists public.carta_del_dia (
  day date primary key,
  card_id text not null,
  market text not null default 'WEST',
  created_at timestamptz not null default now()
);

alter table public.carta_del_dia enable row level security;

drop policy if exists "carta_del_dia_lectura" on public.carta_del_dia;
create policy "carta_del_dia_lectura" on public.carta_del_dia
  for select to anon, authenticated using (true);

-- Comprobación: la tabla existe y está vacía hasta que alguien juegue.
select count(*) as dias_con_carta from public.carta_del_dia;
