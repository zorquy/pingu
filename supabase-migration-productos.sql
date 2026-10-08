-- Tanda 762 — Los productos sellados (PR1, PR2 y Z1 de la ronda 3).
--
-- PINGU: «una nueva pestaña en Mi colección que sea productos… la API se
-- trae productos por expansiones». Dos tablas:
--   · tcg_products   el catálogo de productos de TCGGO (sobres, cajas, ETB,
--                    latas…), con su precio. La escribe la función
--                    programada `tcggo-productos` con la clave de servicio;
--                    la lee todo el mundo (es un catálogo, como tcg_cards).
--   · user_products  los que tiene cada uno, con cuántos y lo que pagó. Cada
--                    cual ve y toca solo los suyos.
--
-- Sin tablas temporales y sentencia a sentencia (la 631).

create table if not exists public.tcg_products (
  id bigint primary key,                 -- el id del producto en TCGGO
  episode_id bigint,                     -- su expansión en TCGGO (= tcg_sets.tcggo_id)
  lang text not null default 'en',
  name text not null,
  slug text,
  tipo text not null default 'otro',     -- etb, caja, bundle, blister, lata, mazo, coleccion, sobre, otro
  image text,
  cardmarket_id bigint,
  tcgplayer_id bigint,
  tcggo_url text,
  cm_lowest numeric,                     -- el mínimo en Cardmarket
  cm_lowest_eu numeric,                  -- el mínimo de vendedores de la UE
  cm_lowest_es numeric,                  -- el mínimo en España (el que se enseña)
  cm_avg30 numeric,
  cm_avg7 numeric,
  cm_disponibles int,
  release_date date,                     -- la de su expansión: después de hoy, preventa
  updated_at timestamptz not null default now()
);

create index if not exists tcg_products_episodio on public.tcg_products (episode_id);

alter table public.tcg_products enable row level security;

-- La política de SELECT va en la MISMA migración que la tabla (la 510): sin
-- ella la web leería una lista vacía y diría «no hay productos».
drop policy if exists tcg_products_ver on public.tcg_products;
create policy tcg_products_ver on public.tcg_products for select to anon, authenticated using (true);

create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id bigint not null references public.tcg_products (id) on delete cascade,
  cantidad int not null default 1,
  pagado numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_products_cantidad check (cantidad between 1 and 999),
  constraint user_products_uno unique (user_id, product_id)
);

create index if not exists user_products_mios on public.user_products (user_id);

alter table public.user_products enable row level security;

drop policy if exists user_products_mios on public.user_products;
create policy user_products_mios on public.user_products for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
