-- ============================================================
-- Migración: analítica básica y propia (sin servicio externo, sin
-- cookies) — un recuento simple de qué páginas se visitan, para
-- tener una idea de qué se usa sin depender de Plausible/Umami ni
-- nada que requiera credenciales de un tercero.
-- ============================================================

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on page_views (created_at);

alter table page_views enable row level security;

-- Cualquiera puede registrar una visita, incluso sin sesión — igual que
-- client_errors, es la única otra tabla con un insert tan abierto, porque
-- aquí tampoco hay contenido de usuario, solo qué página se cargó.
drop policy if exists "page_views_insert_anyone" on page_views;
create policy "page_views_insert_anyone" on page_views
  for insert with check (true);

-- Solo el equipo puede ver el recuento (is_admin() ya existe de
-- migraciones anteriores).
drop policy if exists "page_views_admin_select" on page_views;
create policy "page_views_admin_select" on page_views
  for select using (is_admin());

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
