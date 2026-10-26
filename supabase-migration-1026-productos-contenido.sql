-- Tanda 1026 — Qué lleva dentro un producto sellado, y su PVP.
--
-- TCGGO (anuncio del 25 de octubre de 2026) da ahora, con
-- `include_contained_items=1`, lo que CONTIENE cada producto (sobres, cartas
-- promo, accesorios con precio) y en qué packs VIENE; y el PVP oficial por
-- región (`msrp`: eu en euros, us y uk). Viene en el mismo listado por
-- expansión que `tcggo-productos` ya pide, así que no cuesta una petición más.
--
-- Dos cosas:
--   · `tcg_products.pvp_eur`: el PVP de Europa, en euros. La ficha lo enseña
--     como chapa y dice cuánto se ha ido el precio de hoy de ahí.
--   · `tcg_product_contenido`: una fila por cosa que lleva dentro un producto
--     (de QUIÉN cuelga → QUÉ es, cuántos, y su nombre, foto y precio tal como
--     TCGGO los da, para pintarlo sin cruzar nada). «Viene en» es la misma
--     tabla leída al revés: los productos que contienen a este.
--     `contenido_id` es el id de TCGGO de lo contenido: si es un producto,
--     el de `tcg_products` (con el desplazamiento del japonés, 808); si es
--     una carta, su id de TCGGO (sin clave ajena: puede que no la tengamos).
--
-- Se ejecuta en el SQL Editor de Supabase. Cada sentencia va por su lado (631).
-- La función `tcggo-productos` mira primero, gratis, si existen la columna y
-- la tabla: sin ellas no manda ni la una ni la otra.

alter table public.tcg_products add column if not exists pvp_eur numeric;

create table if not exists public.tcg_product_contenido (
  product_id bigint not null references public.tcg_products (id) on delete cascade,
  contenido_tipo text not null check (contenido_tipo in ('product', 'card')),
  contenido_id bigint not null,
  cantidad int not null default 1 check (cantidad between 1 and 10000),
  nombre text not null,
  image text,
  cm_lowest numeric,
  tp_market numeric,
  updated_at timestamptz not null default now(),
  primary key (product_id, contenido_tipo, contenido_id)
);

create index if not exists tcg_product_contenido_dentro on public.tcg_product_contenido (contenido_tipo, contenido_id);

alter table public.tcg_product_contenido enable row level security;

drop policy if exists tcg_product_contenido_ver on public.tcg_product_contenido;

create policy tcg_product_contenido_ver on public.tcg_product_contenido for select to anon, authenticated using (true);
