-- ─────────────────────────────────────────────────────────────────────
-- Los mazos del constructor (/constructor y /mazos).
--
-- Un mazo es de UNA persona y se guarda como la lista de cartas que
-- lleva: [{ "id": "sv06-130", "n": 3 }, …]. Solo el identificador y
-- las copias, NO el nombre ni la imagen de cada carta: esas cosas las
-- tiene `tcg_cards` y se piden al abrir el mazo. Si el catálogo corrige
-- un nombre o traduce una carta al español (el engorde de la tanda 330
-- lo está haciendo ahora mismo), el mazo guardado se entera solo en
-- vez de quedarse con la foto del día en que se guardó.
--
-- Quién ve qué:
--   · El dueño ve y toca los suyos.
--   · Un mazo PÚBLICO lo puede ver cualquiera (con o sin cuenta) — es lo
--     que hace que el enlace «compartir» funcione. Verlo no es tocarlo:
--     quien no es el dueño solo puede hacer una copia en su cuenta.
--   · Privado es el valor por defecto: guardar un mazo no lo enseña.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede ejecutar dos veces
-- sin romper nada (todo va con if not exists / drop … if exists).
-- ─────────────────────────────────────────────────────────────────────
begin;

create table if not exists public.user_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Mazo sin nombre',
  -- 'standard' | 'expanded' | 'libre'. Decide contra qué reglas se
  -- juzga el mazo al pintarlo; no bloquea guardar (como en las listas
  -- de torneo, señalar es AVISAR).
  format text not null default 'standard',
  cards jsonb not null default '[]'::jsonb,
  -- La carta que hace de portada en /mazos. Un id de tcg_cards; si no
  -- está, la pantalla coge la primera carta del mazo.
  cover_card text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_decks_nombre check (char_length(name) between 1 and 80),
  constraint user_decks_formato check (format in ('standard', 'expanded', 'libre')),
  -- La lista es un array, y corto: 60 cartas caben en 60 entradas como
  -- mucho. El tope está en la base y no solo en la pantalla porque la
  -- API se puede llamar a mano, y un jsonb sin tope es un sitio donde
  -- alguien puede guardar lo que quiera.
  constraint user_decks_cartas check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) <= 60)
);

create index if not exists user_decks_dueno_idx on public.user_decks (user_id, updated_at desc);
create index if not exists user_decks_publicos_idx on public.user_decks (updated_at desc) where is_public;

-- updated_at lo pone la base: si lo pusiera la pantalla, dos pestañas
-- con relojes distintos ordenarían «Mis mazos» al revés.
create or replace function public.user_decks_tocar()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- El dueño no se cambia nunca: una actualización que intente
  -- pasarle el mazo a otra cuenta se queda con el dueño de siempre.
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists user_decks_tocar on public.user_decks;
create trigger user_decks_tocar
  before update on public.user_decks
  for each row execute function public.user_decks_tocar();

-- Un tope por persona, por el mismo motivo que el de las 60 entradas:
-- la API está abierta a cualquiera con cuenta. 300 es muchísimo para
-- una persona y nada para la base.
create or replace function public.user_decks_tope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.user_decks where user_id = new.user_id) >= 300 then
    raise exception 'Has llegado al máximo de 300 mazos guardados. Borra alguno para guardar más.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_decks_tope on public.user_decks;
create trigger user_decks_tope
  before insert on public.user_decks
  for each row execute function public.user_decks_tope();

alter table public.user_decks enable row level security;

drop policy if exists user_decks_ver on public.user_decks;
create policy user_decks_ver on public.user_decks
  for select using (is_public or auth.uid() = user_id);

drop policy if exists user_decks_crear on public.user_decks;
create policy user_decks_crear on public.user_decks
  for insert with check (auth.uid() = user_id);

drop policy if exists user_decks_editar on public.user_decks;
create policy user_decks_editar on public.user_decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_decks_borrar on public.user_decks;
create policy user_decks_borrar on public.user_decks
  for delete using (auth.uid() = user_id);

grant select on public.user_decks to anon;
grant select, insert, update, delete on public.user_decks to authenticated;

commit;

-- Comprobación: tiene que salir la tabla con sus cuatro políticas.
select policyname, cmd from pg_policies where tablename = 'user_decks' order by policyname;

notify pgrst, 'reload schema';
