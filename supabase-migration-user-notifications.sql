-- ============================================================
-- Migración: notificaciones dentro de la app (campanita en la barra de
-- navegación) — distinta de la tabla `notifications` ya existente, que
-- es para avisos push masivos desde /admin y no está conectada a nada.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_recipient_idx
  on user_notifications (recipient_id, created_at desc);

alter table user_notifications enable row level security;

-- Cada persona solo ve/gestiona sus propias notificaciones.
create policy "user_notifications_select" on user_notifications
  for select using (auth.uid() = recipient_id);

-- Cualquier usuario logueado puede crear una notificación para OTRA
-- persona (se dispara como efecto de acciones normales: comentar,
-- seguir, etc. — igual que ya pasa con content_reports). No puede
-- crearse notificaciones a sí mismo.
create policy "user_notifications_insert" on user_notifications
  for insert with check (auth.uid() is not null and recipient_id <> auth.uid());

-- Solo el destinatario puede marcarlas como leídas.
create policy "user_notifications_update" on user_notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
