-- ============================================================
-- AVISOS DE LANZAMIENTOS (tanda 753, P2)
-- ============================================================
--
-- «Avísame» en cada set de /lanzamientos: una semana antes, el día que
-- sale y, si se sabe, cuando abre la preventa. Una fila por persona y
-- set; la función programada `avisos-lanzamientos` (una vez al día, por
-- la mañana) mira las fechas —del catálogo, o de la lista a mano de
-- /admin para los anunciados— y deja la notificación (campanita, y de
-- ahí el push). Cada aviso sale UNA vez: se apunta en `enviados` antes
-- de avisar.
--
-- `clave` es el id del set en `tcg_sets`, o «manual:<nombre>» para uno de
-- la lista a mano que el catálogo todavía no tiene. La fecha NO se copia
-- aquí: se lee cada día, así que si el set se retrasa, el aviso también.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

begin;

create table if not exists public.user_release_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.user_profiles (id) on delete cascade,
  clave text not null check (length(clave) between 1 and 200),
  market text not null default 'WEST',
  nombre text not null check (length(nombre) between 1 and 200),
  semana boolean not null default true,
  dia boolean not null default true,
  preventa boolean not null default false,
  enviados text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, clave, market)
);

create index if not exists user_release_alerts_clave_idx
  on public.user_release_alerts (clave, market);

alter table public.user_release_alerts enable row level security;

-- Cada persona ve y maneja SOLO los suyos (la función escribe con la clave
-- de servicio, que se salta la RLS).
drop policy if exists "user_release_alerts_propios" on public.user_release_alerts;
create policy "user_release_alerts_propios" on public.user_release_alerts
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;

notify pgrst, 'reload schema';

-- Comprobación
select count(*) as avisos_de_lanzamiento from public.user_release_alerts;
