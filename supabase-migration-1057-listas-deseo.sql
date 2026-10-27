-- Tanda 1057 — las listas de «La quiero» (carpetas de deseos).
--
-- Un usuario pidió carpetas para sus deseos: lo que le falta de un master set,
-- cartas a vigilar, la lista de una feria. Son listas DENTRO de «La quiero»:
-- una carta puede estar en varias, y la lista solo la ve su dueño (lo que
-- buscas sigue siendo público como siempre; cómo lo tienes repartido, no).
--
-- · user_want_lists: la lista (nombre y color).
-- · user_want_list_items: qué carta va en cada lista (carta y catálogo; la
--   versión y el idioma siguen en `user_wants`). Quitar una carta de «La
--   quiero» no borra sus filas aquí: la web solo enseña las que sigues
--   queriendo, y si la vuelves a querer vuelve a su lista.
--
-- Sentencias sueltas, sin tablas temporales (la 631).

create table if not exists public.user_want_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  color text,
  created_at timestamptz not null default now()
);

create index if not exists user_want_lists_user on public.user_want_lists (user_id);

create table if not exists public.user_want_list_items (
  list_id uuid not null references public.user_want_lists (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null,
  market text not null default 'WEST',
  created_at timestamptz not null default now(),
  primary key (list_id, card_id, market)
);

create index if not exists user_want_list_items_user on public.user_want_list_items (user_id);

alter table public.user_want_lists enable row level security;
alter table public.user_want_list_items enable row level security;

drop policy if exists "listas: las mias" on public.user_want_lists;
create policy "listas: las mias" on public.user_want_lists
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Una carta solo entra en una lista TUYA.
drop policy if exists "listas: lo mio" on public.user_want_list_items;
create policy "listas: lo mio" on public.user_want_list_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.user_want_lists l where l.id = list_id and l.user_id = auth.uid()));

grant select, insert, update, delete on public.user_want_lists to authenticated;
grant select, insert, update, delete on public.user_want_list_items to authenticated;

notify pgrst, 'reload schema';
