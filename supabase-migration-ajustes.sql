-- ─────────────────────────────────────────────────────────────
-- Ajustes del sitio (el aviso global del admin, para empezar)
-- ─────────────────────────────────────────────────────────────
-- Ejecutar en el editor SQL de Supabase.
--
-- Una tabla clave→valor para los pocos ajustes que el admin cambia desde
-- /admin y toda la web tiene que poder leer. El primero: el AVISO GLOBAL
-- (la franja de "el sábado hay torneo" / "mantenimiento a las 22h").
-- Cabrán más ajustes sin volver a migrar: cada uno es una fila.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Leer puede todo el mundo (el aviso es público por definición);
-- escribir, solo los administradores.
drop policy if exists "site_settings_lectura" on public.site_settings;
create policy "site_settings_lectura" on public.site_settings
  for select using (true);

drop policy if exists "site_settings_escritura" on public.site_settings;
create policy "site_settings_escritura" on public.site_settings
  for all
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin));

notify pgrst, 'reload schema';
