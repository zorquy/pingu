-- ============================================================
-- LA VITRINA DEL PERFIL (tanda 743, J4 de la lista de propuestas)
-- ============================================================
--
-- Seis cartas que eliges tú y que se ven en tu perfil, el tuyo y el que ven
-- los demás. Una fila por hueco (1 a 6). En su PROPIA tabla y no en una
-- columna de `user_profiles`: el cliente la lee aparte y, si esta migración
-- no está puesta, la vitrina no sale y lo demás del perfil sigue igual (la
-- 624: un `select` que nombra una columna que no existe falla ENTERO).
--
-- Se ve sin cuenta —el perfil es público— y cada persona escribe solo la
-- suya. La política de lectura va AQUÍ, en la misma migración (la 510: la
-- RLS sin política no da error, devuelve una lista vacía).
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable, y cada sentencia
-- se sostiene sola (la 631: nada de tablas temporales entre sentencias).

begin;

create table if not exists public.user_showcase (
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  posicion smallint not null check (posicion between 1 and 6),
  card_id text not null,
  market text not null default 'WEST',
  created_at timestamptz not null default now(),
  primary key (user_id, posicion)
);

alter table public.user_showcase enable row level security;

drop policy if exists "user_showcase_se_ve" on public.user_showcase;
create policy "user_showcase_se_ve" on public.user_showcase
  for select to anon, authenticated
  using (true);

drop policy if exists "user_showcase_propia" on public.user_showcase;
create policy "user_showcase_propia" on public.user_showcase
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.user_showcase to anon, authenticated;
grant insert, update, delete on public.user_showcase to authenticated;

commit;

notify pgrst, 'reload schema';

-- Comprobación
select count(*) as huecos, count(distinct user_id) as vitrinas from public.user_showcase;
