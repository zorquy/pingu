-- Las VERSIONES de una carta, de TCGGO (tanda 807).
--
-- PINGU, con el Snorlax de Plasma Storm: en la web de TCGGO salen «Standard
-- 24,95 €» y «Reverse Holo 90,24 €», y en PokeDoc solo la normal. La API da
-- cada versión como OTRA carta (la Reverse es la 43552; la normal, la
-- 12774), con el mismo número, el mismo `cardmarket_id` y su propio precio,
-- pero NO sale en el listado del set ni en la búsqueda, y ningún campo dice
-- qué versión es. Lo que sí se vio (PINGU pidió la 43551 y la 43553): las
-- versiones van en un BLOQUE de ids seguidos en el orden del set (Dodrio 100,
-- Snorlax 101, Togepi 102). La pasada `tcggo-versiones` recorre los ids que
-- no son cartas nuestras, casa cada versión con su carta y la guarda aquí.
--
-- Una fila por versión. `card_id` es NUESTRA carta (la principal, la del
-- listado). `etiqueta` queda vacía: el nombre de la versión no lo da la API,
-- y se decide al pintarla (y si no se puede saber, se dice «otra versión»).
--
-- Se lee desde la web (es el precio de una carta, no de nadie) y solo la
-- escribe la función, con la clave de servicio. Se puede repetir entera.

create table if not exists public.tcg_card_versions (
  tcggo_id int primary key,
  market text not null default 'WEST',
  card_id text not null,
  set_id text,
  numero text,
  nombre text,
  etiqueta text,
  cm_id_product int,
  link_cm text,
  cm_low numeric,
  cm_low_en numeric,
  cm_low_de numeric,
  cm_low_fr numeric,
  cm_low_es numeric,
  cm_low_it numeric,
  cm_low_ja numeric,
  cm_avg7 numeric,
  cm_avg30 numeric,
  cm_disponibles int,
  tp_market_eur numeric,
  tp_mid_eur numeric,
  actualizado_at timestamptz not null default now(),
  creado_at timestamptz not null default now()
);

create index if not exists tcg_card_versions_carta on public.tcg_card_versions (card_id, market);
create index if not exists tcg_card_versions_set on public.tcg_card_versions (set_id, market);
create index if not exists tcg_card_versions_vieja on public.tcg_card_versions (actualizado_at);

-- La lectura, en la misma migración que la tabla (la 510: con RLS y sin
-- política, la web leería CERO filas y diría «no tiene versiones»).
alter table public.tcg_card_versions enable row level security;
drop policy if exists tcg_card_versions_leer on public.tcg_card_versions;
create policy tcg_card_versions_leer on public.tcg_card_versions for select to anon, authenticated using (true);
grant select on public.tcg_card_versions to anon, authenticated;

notify pgrst, 'reload schema';
