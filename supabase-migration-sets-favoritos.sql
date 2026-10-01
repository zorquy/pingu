-- Tanda 409 — las expansiones favoritas
--
-- PINGU, mirando la estantería: «arriba que estén tus colecciones porque
-- tienen una carta, yo lo quitaría. Arriba solo si la pones como
-- favorito. Es decir, cuando tú entras a una expansión, que haya un
-- botón para añadir a favoritos y que ahí se vaya arriba. Si no, no,
-- porque se van a agrupar arriba y no tiene sentido».
--
-- ── POR QUÉ UNA TABLA Y NO EL NAVEGADOR ──
--
-- Esto cabría en `localStorage` y sería gratis. Pero un favorito es una
-- DECISIÓN de la persona, no una comodidad de esta pantalla: quien marca
-- diez expansiones y entra desde el móvil espera encontrarlas. Lo que
-- vive en el navegador se queda en ese navegador, y además se va con un
-- «borrar datos de navegación» sin avisar.
--
-- Tabla y no una columna `text[]` en el perfil por lo de siempre: marcar
-- y desmarcar un favorito es una fila que entra y otra que sale, no leer
-- un array entero, cambiarlo y escribirlo —que es la carrera que ya
-- costó el XP de los torneos en la tanda 388—.

create table if not exists public.collection_favorite_sets (
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  -- `set_id` es texto y SIN clave foránea a `tcg_sets` a propósito: el
  -- catálogo se reimporta entero cada cierto tiempo y una foránea haría
  -- que una reimportación se llevara por delante los favoritos de la
  -- gente. Un favorito de un set que ya no existe no molesta a nadie: no
  -- casa con ninguna fila y no se pinta.
  set_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, set_id)
);

alter table public.collection_favorite_sets enable row level security;

-- Cada uno ve y toca los suyos. No hay lectura pública: una colección
-- pública enseña CARTAS, y qué expansiones te gustan es otra cosa que
-- nadie ha pedido enseñar.
drop policy if exists "favoritos propios" on public.collection_favorite_sets;
create policy "favoritos propios"
  on public.collection_favorite_sets
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.collection_favorite_sets to authenticated;
