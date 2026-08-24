-- ═══════════════════════════════════════════════════════════════════
-- TOP DEL MES — la foto del XP al empezar cada mes
-- Ejecutar A MANO en Supabase → SQL Editor. Se puede repetir sin miedo.
--
-- La clasificación por XP total premia siempre a los veteranos. Para que
-- un recién llegado tenga una liga que pueda ganar, el "top del mes" es
-- (XP total de ahora) − (XP que tenías al empezar el mes). Esa foto
-- inicial la toma la función programada de Netlify (top-del-mes.mjs),
-- una fila por persona y mes, con la clave de servicio.
--
-- La tabla se LEE desde la web (cualquiera puede ver el top), pero no
-- tiene ninguna política de escritura: solo escribe la función.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.xp_mes (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Siempre el día 1 del mes: '2026-09-01'.
  mes date not null,
  xp_inicio int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, mes)
);

alter table public.xp_mes enable row level security;

drop policy if exists xp_mes_select on public.xp_mes;
create policy xp_mes_select on public.xp_mes
  for select using (true);

-- Consultar "el mes actual" entero es lo único que hace la web.
create index if not exists xp_mes_por_mes on public.xp_mes (mes);

notify pgrst, 'reload schema';
