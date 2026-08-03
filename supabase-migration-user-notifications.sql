-- ============================================================
-- Migración: notificaciones dentro de la app (campanita en la barra de
-- navegación) — distinta de la tabla `notifications` ya existente, que
-- es para avisos push masivos desde /admin y no está conectada a nada.
-- Ejecutar en el SQL Editor de Supabase.
--
-- Es idempotente: se puede ejecutar más de una vez. Antes no lo era —
-- `create policy` a secas falla con 42710 ("policy already exists") si
-- ya se ejecutó, y ese error hace pensar que algo va mal cuando en
-- realidad está todo bien.
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
drop policy if exists "user_notifications_select" on user_notifications;
create policy "user_notifications_select" on user_notifications
  for select using (auth.uid() = recipient_id);

-- Cualquier usuario logueado puede crear una notificación para OTRA
-- persona (se dispara como efecto de acciones normales: comentar,
-- seguir, etc. — igual que ya pasa con content_reports). No puede
-- crearse notificaciones a sí mismo.
drop policy if exists "user_notifications_insert" on user_notifications;
create policy "user_notifications_insert" on user_notifications
  for insert with check (auth.uid() is not null and recipient_id <> auth.uid());

-- Solo el destinatario puede marcarlas como leídas.
drop policy if exists "user_notifications_update" on user_notifications;
create policy "user_notifications_update" on user_notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Tiene que devolver una fila por columna.
select column_name, data_type
from information_schema.columns
where table_name = 'user_notifications'
order by ordinal_position;

-- Y las tres políticas.
select policyname, cmd from pg_policies
where tablename = 'user_notifications' order by policyname;
