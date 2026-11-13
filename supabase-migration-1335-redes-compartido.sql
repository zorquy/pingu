-- Tanda 1335 — /admin → Redes: lo que el equipo YA ha compartido en las redes
-- oficiales de PokeDoc. PINGU comparte a mano (en X con «Compartir en X», en
-- Instagram descargando la imagen y pegando el texto); esta tabla solo apunta
-- QUÉ pieza se sacó, en qué red, cuándo y quién, para que el filtro «Sin
-- compartir» del panel sea el mismo para todo el equipo y no lo de un
-- navegador. Nada se publica solo.
--
-- `clave` es la de la pieza que arma el panel (js/redes-textos.js):
-- «noticia:<slug>», «guia:<slug>», «torneo:<id>:anuncio»,
-- «torneo:<id>:resultados»… Así no hace falta una columna por tipo y las
-- piezas de las tandas siguientes (eventos, lanzamientos, el meta) entran sin
-- tocar la tabla.
--
-- Re-ejecutable.

create table if not exists public.redes_compartido (
  clave text not null check (char_length(clave) between 3 and 160),
  red text not null check (red in ('x', 'instagram')),
  hecho_at timestamptz not null default now(),
  hecho_por uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (clave, red)
);

alter table public.redes_compartido enable row level security;

-- Solo el equipo (is_admin, con su doble factor si lo pide la 1307) la lee y
-- la escribe: a la gente no le dice nada y no tiene por qué ver quién publica.
drop policy if exists redes_compartido_equipo on public.redes_compartido;
create policy redes_compartido_equipo on public.redes_compartido
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.redes_compartido to authenticated;

notify pgrst, 'reload schema';
