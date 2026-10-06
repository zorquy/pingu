-- ============================================================
-- AVISOS DE PRECIO (tanda 665)
-- ============================================================
--
-- «Avísame si esta carta baja de 20 €» (o sube de). Una fila por aviso;
-- la función programada `avisos-precio` (cada hora) compara con
-- `tcg_card_prices` en el idioma del aviso, y al dispararse lo apaga,
-- apunta el precio y le deja a la persona una notificación (campanita,
-- y de ahí el push) y un correo en la cola.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

begin;

create table if not exists public.user_price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  card_id text not null,
  market text not null default 'WEST',
  idioma text not null default 'es',
  -- «baja»: avisa cuando el mínimo esté EN O POR DEBAJO del umbral;
  -- «sube»: en o por encima.
  tipo text not null check (tipo in ('baja', 'sube')),
  umbral numeric(10, 2) not null check (umbral > 0),
  activo boolean not null default true,
  disparado_at timestamptz,
  precio_disparo numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists user_price_alerts_activos_idx
  on public.user_price_alerts (card_id) where activo;
create index if not exists user_price_alerts_user_idx
  on public.user_price_alerts (user_id, created_at desc);

alter table public.user_price_alerts enable row level security;

-- Cada persona ve y maneja SOLO los suyos. La función programada escribe
-- con la clave de servicio, que se salta la RLS.
drop policy if exists "user_price_alerts_propios" on public.user_price_alerts;
create policy "user_price_alerts_propios" on public.user_price_alerts
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;

notify pgrst, 'reload schema';

-- Comprobación
select count(*) as avisos, count(*) filter (where activo) as activos from public.user_price_alerts;
