-- Tanda 1364 — Lo nuevo de la API de TCGGO, la C (aprobada por PINGU el
-- 2026-11-15): las últimas ventas de una carta gradeada, y la media de 30
-- días en el histórico.
--
-- 1. `tcg_card_ventas_gradeadas`: lo que contestó `/ebay-sold-offers` de
--    TCGGO para una carta (hasta 30 ventas: casa, nota, precio en euros,
--    fecha, título y anuncio) y cuándo se pidió. Lo escribe y lo lee SOLO la
--    función `tcggo-ventas-gradeadas` con la clave de servicio (que se salta
--    la RLS), y la web pide a la función: por eso RLS sin políticas, y nadie
--    más la toca. Una fila con la lista vacía también vale: «no hay ventas»
--    es una respuesta, y sin guardarla se pagaría en cada visita.
--
-- 2. `tcg_card_history.cm_avg30`: la media de 30 días de Cardmarket, día a
--    día (el `avg30` del histórico de TCGGO). La pinta la gráfica como «Media
--    de 30 días». La función del histórico la pide y la guarda con respaldo:
--    sin esta columna sigue como antes.
--
-- Re-ejecutable. Sin tablas temporales (la 631).

create table if not exists public.tcg_card_ventas_gradeadas (
  card_id text not null,
  market text not null default 'WEST',
  ventas jsonb not null default '[]'::jsonb,
  pedido_at timestamptz not null default now(),
  primary key (card_id, market),
  constraint tcg_card_ventas_gradeadas_lista check (jsonb_typeof(ventas) = 'array')
);

alter table public.tcg_card_ventas_gradeadas enable row level security;
revoke all on table public.tcg_card_ventas_gradeadas from anon, authenticated;

alter table public.tcg_card_history add column if not exists cm_avg30 numeric(10,2);
