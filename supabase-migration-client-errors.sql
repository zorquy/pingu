-- ============================================================
-- Migración: registro de errores de JavaScript en el cliente,
-- para enterarnos de fallos en producción sin depender de que un
-- usuario nos avise. Alternativa casera a un servicio externo tipo
-- Sentry (no hay credenciales de ningún APM en este proyecto).
-- ============================================================

create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  message text not null,
  stack text,
  page_url text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table client_errors enable row level security;

-- Cualquiera puede registrar un error, incluso sin haber iniciado
-- sesión (muchos errores pueden pasar antes de que exista una sesión).
drop policy if exists "client_errors_insert_anyone" on client_errors;
create policy "client_errors_insert_anyone" on client_errors
  for insert with check (true);

-- Solo el equipo puede verlos y gestionarlos (is_admin() ya existe de
-- migraciones anteriores).
drop policy if exists "client_errors_admin_select" on client_errors;
create policy "client_errors_admin_select" on client_errors
  for select using (is_admin());

drop policy if exists "client_errors_admin_update" on client_errors;
create policy "client_errors_admin_update" on client_errors
  for update using (is_admin());
