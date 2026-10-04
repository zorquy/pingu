-- ── Las colecciones, editables a mano desde /admin (tanda 550) ──
--
-- PINGU: «me gustaría que los sets en el panel de admin fuesen editables.
-- Ya sea para ordenar yo manualmente los sets por eras, añadir una era
-- nueva… imagínate, los sets especiales en Occidental están todos
-- mezclados: pues en vez de pedírtelo todo a ti, que yo pudiese crear una
-- era, por ejemplo McDonald's, y ahí incluir todas las expansiones del
-- McDonald's. Lo mismo para Pop Series. Los sets que sobren los borro, y
-- los que estén mal los puedo corregir yo. También para meterle el logo o
-- no, y para mover el orden».
--
-- No añade nada que la web no supiera hacer: la era de un set YA es su
-- `serie_id` y el nombre que se enseña YA sale de `serie_name`. Lo que
-- faltaba era poder DECIDIRLO, que hasta ahora lo decidía el catálogo de
-- origen y lo demás se deducía (las eras se ordenaban por su set más
-- nuevo, que es un apaño razonable y no es una decisión).
--
-- No borra ni reescribe nada: tres columnas nuevas con su valor por
-- defecto y una tabla nueva vacía. Mientras nadie toque /admin, la web se
-- comporta exactamente igual que hoy.

-- ── Las tres columnas de un set ──
alter table public.tcg_sets add column if not exists orden int;
alter table public.tcg_sets add column if not exists oculto boolean not null default false;
-- Para un set del catálogo occidental cuyo contenido es mejor pedírselo a
-- Scrydex. Nació con el «30th Classic Collection», que TCGdex publica sin
-- logo y con las 30 cartas sin imagen.
alter table public.tcg_sets add column if not exists scrydex_manda boolean not null default false;

comment on column public.tcg_sets.orden is
  'Orden MANUAL dentro de su era, de menor a mayor. A null, manda la fecha (tanda 550).';
comment on column public.tcg_sets.oculto is
  'Fuera de la biblioteca sin borrarlo. Un borrado se lleva las cartas por delante; esto no.';
comment on column public.tcg_sets.scrydex_manda is
  'Este set se rellena desde Scrydex aunque sea occidental (tanda 550).';

-- ── Las eras ──
--
-- Una era NO es una tabla de la que cuelguen los sets: la era de un set es
-- su `serie_id`, y así lleva siendo desde el principio. Esta tabla es solo
-- lo que se quiere DECIR de una era: cómo se llama y en qué orden va. Una
-- era sin fila aquí sigue funcionando igual que siempre.
--
-- Por eso no hay clave ajena de `tcg_sets.serie_id` a esto: obligaría a
-- crear la fila antes de poder usar la era, y los ~40 `serie_id` que ya
-- vienen de los catálogos no tienen ninguna.
create table if not exists public.tcg_eras (
  market text not null,
  id text not null,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  primary key (market, id),
  constraint tcg_eras_id check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 60),
  constraint tcg_eras_nombre check (char_length(nombre) between 1 and 80)
);

alter table public.tcg_eras enable row level security;

-- Las lee TODO el mundo: sin eso, la biblioteca de quien no ha entrado se
-- quedaría con los nombres de era sin tocar y los de dentro con los suyos
-- —la misma pantalla diciendo dos cosas según quién mire—. Y la RLS no da
-- error: devuelve una lista VACÍA (la lección de la 510).
drop policy if exists "tcg_eras_read" on public.tcg_eras;
create policy "tcg_eras_read" on public.tcg_eras for select using (true);

-- Y las escribe el admin del sitio, con la misma función con la que se
-- escriben los sets desde la 2.ª tanda de cartas (`tcg_sets_write`).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    drop policy if exists "tcg_eras_write" on public.tcg_eras;
    create policy "tcg_eras_write" on public.tcg_eras for all
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create index if not exists tcg_eras_orden_idx on public.tcg_eras (market, orden);
-- El orden manual se lee junto con los sets de un mercado.
create index if not exists tcg_sets_orden_idx on public.tcg_sets (market, orden);

-- ── Cómo queda (solo lee) ──
select (select count(*) from public.tcg_eras) as eras_a_mano,
       (select count(*) from public.tcg_sets where orden is not null) as sets_con_orden_manual,
       (select count(*) from public.tcg_sets where oculto) as sets_ocultos,
       (select count(distinct serie_id) from public.tcg_sets where market = 'WEST') as eras_occidentales,
       (select count(distinct serie_id) from public.tcg_sets where market = 'JP') as eras_japonesas;
