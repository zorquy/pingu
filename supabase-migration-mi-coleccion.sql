-- ─────────────────────────────────────────────────────────────────────
-- MI COLECCIÓN (tanda 365): /mi-coleccion y el precio de Cardmarket.
--
-- Lo pidió PINGU: un sitio donde meter tus cartas, ver lo que valen,
-- ir a Cardmarket y verlas en un álbum. Y que el enlace del precio lleve
-- a Cardmarket con el idioma y el estado de TU carta ya filtrados.
--
-- ── LAS CARTAS DE CADA UNO: `user_collection` ──
--
-- Una línea es «tantas copias de esta carta, en este idioma, este estado
-- y esta versión». La misma carta en dos estados son dos líneas (valen
-- distinto y en Cardmarket se buscan distinto). La carta se guarda por su
-- identificador del espejo (`tcg_cards`), NO con su nombre ni su imagen:
-- si el catálogo traduce o corrige una carta, la colección se entera sola
-- (misma regla que los mazos del constructor, tanda 354).
--
-- Privada por defecto. Quien quiera enseñarla marca «colección pública»
-- en su perfil (`user_profiles.coleccion_publica`) y entonces cualquiera
-- la ve en /mi-coleccion?u=<usuario>. Verla no es tocarla.
--
-- ── LOS PRECIOS: `tcg_card_prices` ──
--
-- De TCGdex (`pricing.cardmarket`), que copia la guía de precios de
-- Cardmarket una vez al día. Una petición por carta, así que NO se
-- guarda el catálogo entero (serían 23.000 peticiones al día, y la casa
-- ya aprendió que eso no se hace — tandas 233 y 322): solo las cartas
-- que alguien TIENE en su colección, refrescadas una vez al día por la
-- función programada `precios-coleccion`. La ficha de una carta pide su
-- precio en el momento (una petición, la de la carta que se mira).
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- ── La colección ──
create table if not exists public.user_collection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null,
  market text not null default 'WEST',
  idioma text not null default 'es',
  estado text not null default 'NM',
  variante text not null default 'normal',
  cantidad int not null default 1,
  -- «CGC 10», «PSA 9»… Texto corto y libre: hay muchas empresas y notas
  -- con decimales, y aquí solo sirve para enseñarlo y separar líneas.
  gradeo text,
  -- El valor que le pone su dueño. Manda sobre Cardmarket al sumar: para
  -- una gradeada o una firmada, el precio general no dice nada.
  valor_manual numeric(10, 2),
  precio_compra numeric(10, 2),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_collection_idioma check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja')),
  constraint user_collection_estado check (estado in ('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO')),
  constraint user_collection_variante check (variante in ('normal', 'reverse', 'holo', 'primera')),
  constraint user_collection_cantidad check (cantidad between 1 and 999),
  constraint user_collection_gradeo check (gradeo is null or char_length(gradeo) between 1 and 20),
  constraint user_collection_valor check (valor_manual is null or valor_manual >= 0),
  constraint user_collection_compra check (precio_compra is null or precio_compra >= 0),
  constraint user_collection_notas check (notas is null or char_length(notas) <= 280)
);

create index if not exists user_collection_dueno_idx on public.user_collection (user_id, created_at desc);
create index if not exists user_collection_carta_idx on public.user_collection (card_id);

create or replace function public.user_collection_tocar()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- El dueño no se cambia: una actualización que intente pasarle la
  -- línea a otra cuenta se queda con el de siempre.
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists user_collection_tocar on public.user_collection;
create trigger user_collection_tocar
  before update on public.user_collection
  for each row execute function public.user_collection_tocar();

-- Un tope por persona, porque la API está abierta a cualquiera con
-- cuenta. 20.000 líneas es una colección enorme y nada para la base.
create or replace function public.user_collection_tope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.user_collection where user_id = new.user_id) >= 20000 then
    raise exception 'Has llegado al máximo de 20.000 líneas en tu colección.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_collection_tope on public.user_collection;
create trigger user_collection_tope
  before insert on public.user_collection
  for each row execute function public.user_collection_tope();

-- Colección pública o privada: un interruptor en el perfil.
alter table public.user_profiles add column if not exists coleccion_publica boolean not null default false;

-- ¿Deja esta persona ver su colección? Con `security definer` para que la
-- política de abajo no dependa de lo que la RLS de `user_profiles` deje
-- leer a cada cual.
create or replace function public.coleccion_es_publica(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select coleccion_publica from public.user_profiles where id = p_user), false);
$$;

alter table public.user_collection enable row level security;

drop policy if exists user_collection_ver on public.user_collection;
create policy user_collection_ver on public.user_collection
  for select using (auth.uid() = user_id or public.coleccion_es_publica(user_id));

drop policy if exists user_collection_crear on public.user_collection;
create policy user_collection_crear on public.user_collection
  for insert with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists user_collection_editar on public.user_collection;
create policy user_collection_editar on public.user_collection
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_collection_borrar on public.user_collection;
create policy user_collection_borrar on public.user_collection
  for delete using (auth.uid() = user_id);

grant select on public.user_collection to anon;
grant select, insert, update, delete on public.user_collection to authenticated;
grant execute on function public.coleccion_es_publica(uuid) to anon, authenticated;

-- ── Los precios ──
create table if not exists public.tcg_card_prices (
  card_id text primary key,
  cm_id_product int,
  cm_low numeric(10, 2),
  cm_trend numeric(10, 2),
  cm_avg30 numeric(10, 2),
  cm_avg7 numeric(10, 2),
  cm_low_holo numeric(10, 2),
  cm_trend_holo numeric(10, 2),
  cm_avg30_holo numeric(10, 2),
  cm_updated timestamptz,             -- cuándo lo actualizó Cardmarket/TCGdex
  checked_at timestamptz not null default now()  -- cuándo lo miramos nosotros
);
create index if not exists tcg_card_prices_revisado_idx on public.tcg_card_prices (checked_at);

alter table public.tcg_card_prices enable row level security;
drop policy if exists tcg_card_prices_leer on public.tcg_card_prices;
create policy tcg_card_prices_leer on public.tcg_card_prices for select using (true);
grant select on public.tcg_card_prices to anon, authenticated;
-- Escribir, solo la clave de servicio (se salta la RLS): no hay política.

-- Qué precios hay que refrescar: cartas de la colección de ALGUIEN (del
-- mercado occidental: TCGdex solo da precio de esas) sin precio o con uno
-- de hace más de `p_horas`. Primero las que nunca se han mirado.
create or replace function public.precios_pendientes(p_limite int default 40, p_horas int default 20)
returns table (card_id text)
language sql
stable
security definer
set search_path = public
as $$
  select c.card_id
  from (select distinct card_id from public.user_collection where market = 'WEST') c
  left join public.tcg_card_prices p on p.card_id = c.card_id
  where p.card_id is null or p.checked_at < now() - make_interval(hours => greatest(1, coalesce(p_horas, 20)))
  order by p.checked_at asc nulls first, c.card_id
  limit greatest(1, least(coalesce(p_limite, 40), 200));
$$;

-- Solo la función programada: la lista de cartas de TODAS las colecciones
-- no es cosa de nadie más, aunque no diga de quién son.
revoke all on function public.precios_pendientes(int, int) from public, anon, authenticated;
grant execute on function public.precios_pendientes(int, int) to service_role;

commit;

-- Comprobación: la tabla con sus cuatro políticas.
select policyname, cmd from pg_policies where tablename = 'user_collection' order by policyname;

notify pgrst, 'reload schema';
