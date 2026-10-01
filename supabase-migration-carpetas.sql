-- Tanda 402 — carpetas para ordenar tu colección
--
-- PINGU, enseñando Dex: «carpetas, que puedes crear carpetas y dentro de
-- las carpetas otras subcarpetas para ordenar tu colección por carpetas
-- o lo que quieras hacer, listas distintas o lo que sea».
--
-- ── POR QUÉ UNA TABLA Y NO UNA ETIQUETA ──
--
-- Lo barato habría sido un `text[]` de etiquetas en `user_collection`.
-- Pero una carpeta tiene nombre propio, color, emoji, orden y PADRE, y
-- todo eso en un array de cadenas acaba siendo un nombre con separadores
-- dentro. Y lo que mata la idea es la carpeta VACÍA: con etiquetas no
-- existe hasta que metes algo, así que no se puede crear primero y
-- llenar después, que es justo como se ordena una colección.
--
-- ── EL ÁRBOL ──
--
-- `parent_id` apunta a otra carpeta del mismo dueño. Sin más reglas que
-- esa: el ciclo (una carpeta dentro de sí misma) lo impide el disparador
-- de abajo, porque una restricción no puede mirar hacia arriba.

create table if not exists public.collection_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  parent_id uuid references public.collection_folders (id) on delete cascade,
  nombre text not null,
  -- EL ADORNO (tanda 411). Es UNA de tres cosas: un icono del sitio
  -- (`icono`, el nombre que usa js/icons.js), un Pokémon (`dex_id`) o un
  -- emoji. Tres columnas y no una con prefijos porque una columna que
  -- hace dos trabajos se separa en silencio (la lección de la 335), y
  -- aquí habría que partir la cadena en cada sitio que la pinte.
  -- Precedencia al pintar: Pokémon > emoji > icono.
  -- El color es opcional: sin él se saca del propio adorno, siempre el
  -- mismo para el mismo adorno.
  icono text,
  dex_id int,
  emoji text,
  color text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- Por si la tabla se creó con una versión anterior de este mismo fichero
-- (la 402 no tenía `icono` ni `dex_id`): añadirlas no duele si ya están.
alter table public.collection_folders add column if not exists icono text;
alter table public.collection_folders add column if not exists dex_id int;

create index if not exists collection_folders_mias on public.collection_folders (user_id, parent_id, orden);

-- Qué carta va en qué carpeta. Es una tabla aparte y no una columna en
-- `user_collection` porque una carta puede estar en VARIAS: «Mis
-- Charizards» y «Para cambiar» no se excluyen.
create table if not exists public.collection_folder_cards (
  folder_id uuid not null references public.collection_folders (id) on delete cascade,
  line_id uuid not null references public.user_collection (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (folder_id, line_id)
);

-- ── Que una carpeta no pueda estar dentro de sí misma ──
--
-- Ni directa ni a tres saltos. Una restricción `check` no sirve: solo ve
-- la fila que se está escribiendo y esto hay que mirarlo subiendo por el
-- árbol. Sin esto, un ciclo deja la pantalla dando vueltas para siempre
-- y la consulta recursiva no termina.
create or replace function public.carpetas_sin_ciclos()
returns trigger
language plpgsql
as $$
declare
  v_padre uuid := new.parent_id;
  v_vueltas int := 0;
begin
  while v_padre is not null loop
    if v_padre = new.id then
      raise exception 'una carpeta no puede estar dentro de sí misma';
    end if;
    -- Tope de seguridad: si ya hubiera un ciclo de antes, este bucle no
    -- terminaría nunca y se llevaría la conexión por delante.
    v_vueltas := v_vueltas + 1;
    if v_vueltas > 50 then
      raise exception 'las carpetas están anidadas demasiado hondo';
    end if;
    select parent_id into v_padre from public.collection_folders where id = v_padre;
  end loop;
  return new;
end;
$$;

drop trigger if exists collection_folders_sin_ciclos on public.collection_folders;
create trigger collection_folders_sin_ciclos
  before insert or update of parent_id on public.collection_folders
  for each row execute function public.carpetas_sin_ciclos();

-- ── Quién ve qué ──
--
-- Las carpetas son TUYAS y solo tuyas, de momento: enseñarlas a los demás
-- querría decidir antes qué pasa con una carpeta de una colección que
-- está en privado. Eso se abre cuando haga falta, no antes.
alter table public.collection_folders enable row level security;
alter table public.collection_folder_cards enable row level security;

drop policy if exists collection_folders_mias on public.collection_folders;
create policy collection_folders_mias on public.collection_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Para el contenido, el dueño se mira a través de la carpeta: así no hay
-- una segunda copia del user_id que se pueda quedar diciendo otra cosa.
drop policy if exists collection_folder_cards_mias on public.collection_folder_cards;
create policy collection_folder_cards_mias on public.collection_folder_cards
  for all using (
    exists (select 1 from public.collection_folders f where f.id = folder_id and f.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.collection_folders f where f.id = folder_id and f.user_id = auth.uid())
  );

-- ── Cuántas cartas hay en cada carpeta ──
--
-- Contando también las de las SUBcarpetas, que es lo que se espera al
-- mirar una carpeta madre: «Vintage» con 4 subcarpetas y 0 cartas
-- propias no enseña un 0.
--
-- Va en una función y no en un `count` del cliente porque el cliente
-- tendría que bajarse el árbol entero para sumarlo.
create or replace function public.carpetas_resumen()
returns table (folder_id uuid, cartas bigint, copias bigint)
language sql
stable
security definer
set search_path = public
as $$
  with recursive arbol as (
    -- Cada carpeta, como raíz de sí misma.
    select f.id as raiz, f.id
      from public.collection_folders f
     where f.user_id = auth.uid()
    union all
    select a.raiz, h.id
      from arbol a
      join public.collection_folders h on h.parent_id = a.id
  )
  select a.raiz,
         count(distinct c.line_id),
         coalesce(sum(u.cantidad), 0)
    from arbol a
    left join public.collection_folder_cards c on c.folder_id = a.id
    left join public.user_collection u on u.id = c.line_id
   group by a.raiz;
$$;

revoke all on function public.carpetas_resumen() from public, anon;
grant execute on function public.carpetas_resumen() to authenticated, service_role;
