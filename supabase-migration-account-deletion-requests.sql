-- ============================================================
-- Migración: solicitud de borrado de cuenta en autoservicio.
--
-- Esto NO borra nada automáticamente. Borrar de verdad una cuenta
-- implica eliminar auth.users (con la service role key, que no debe
-- exponerse nunca al cliente) y no tenemos forma de comprobar desde
-- aquí cómo se comportan las claves foráneas ya existentes en la
-- base real ante ese borrado (cascada, restricción, etc.) — así que,
-- por seguridad, esto solo registra la solicitud para que el equipo
-- la revise y la ejecute a mano, con cuidado, en vez de intentar un
-- borrado automático a ciegas que podría fallar a medias o dejar
-- datos huérfanos.
-- ============================================================

create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table account_deletion_requests enable row level security;

-- Cualquier usuario logueado puede solicitar el borrado de su propia
-- cuenta (una vez, en principio — el cliente ya evita solicitudes
-- duplicadas, pero no pasa nada si hay más de una).
drop policy if exists "account_deletion_requests_insert_own" on account_deletion_requests;
create policy "account_deletion_requests_insert_own" on account_deletion_requests
  for insert with check (auth.uid() = user_id);

-- El propio usuario puede ver sus solicitudes (para no repetir el
-- botón si ya tiene una pendiente).
drop policy if exists "account_deletion_requests_select_own" on account_deletion_requests;
create policy "account_deletion_requests_select_own" on account_deletion_requests
  for select using (auth.uid() = user_id);

-- El equipo puede ver y gestionar todas (is_admin() ya existe de
-- migraciones anteriores).
drop policy if exists "account_deletion_requests_admin_select" on account_deletion_requests;
create policy "account_deletion_requests_admin_select" on account_deletion_requests
  for select using (is_admin());

drop policy if exists "account_deletion_requests_admin_update" on account_deletion_requests;
create policy "account_deletion_requests_admin_update" on account_deletion_requests
  for update using (is_admin());

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
