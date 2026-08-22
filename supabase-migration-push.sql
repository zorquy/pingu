-- ═══════════════════════════════════════════════════════════════════
-- NOTIFICACIONES PUSH — suscripciones y marca de enviado
-- Ejecutar A MANO en Supabase → SQL Editor. Se puede repetir sin miedo.
--
-- Qué monta:
--   1. push_subscriptions: a qué navegadores hay que empujar los avisos
--      de cada cual. Una fila por dispositivo/navegador suscrito.
--   2. user_notifications.pushed_at: la marca de "este aviso ya se
--      empujó" que usa la función programada de Netlify (enviar-push)
--      para no reenviar. La función marca TODOS los avisos revisados,
--      tengan o no suscripciones, para no re-escanearlos.
--
-- Después de ejecutar esto:
--   · en /admin, botón "Generar claves push" (guarda la clave pública
--     en site_settings y te enseña la privada UNA vez);
--   · la clave privada va a Netlify → Environment variables como
--     PUSH_VAPID_PRIVATE (nunca en el repositorio ni en el chat);
--   · la función netlify/functions/enviar-push.mjs hace el resto.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  -- El endpoint es único por navegador+web: sirve de clave.
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Las dos claves que trae la suscripción del navegador; sin ellas no
  -- se puede cifrar el aviso (RFC 8291).
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada cual gestiona SOLO sus suscripciones. La función de Netlify usa
-- la clave de servicio, que se salta la RLS.
drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- La marca de "ya empujado" de cada aviso.
alter table public.user_notifications
  add column if not exists pushed_at timestamptz;

-- La función escanea "lo no empujado y reciente": índice parcial para
-- que esa consulta no recorra el histórico entero.
create index if not exists user_notifications_sin_push
  on public.user_notifications (created_at)
  where pushed_at is null;

-- Que PostgREST recargue el esquema sin esperar.
notify pgrst, 'reload schema';
