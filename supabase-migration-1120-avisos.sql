-- ============================================================
-- Tanda 1120 — Los avisos del equipo
--
-- El aviso global (la franja de arriba de toda la web) sigue viviendo en
-- site_settings, clave `aviso_global`: lo nuevo (tipo, desde, hasta, a
-- quién, enlace) son campos del mismo JSON y no piden nada a la base.
--
-- Lo que sí la pide es «mandarlo también a la campanita» (PINGU, en la
-- propuesta del admin): un aviso en la campanita de TODAS las cuentas, para
-- que llegue a quien no entra esos días. La política de user_notifications
-- no deja escribirlo (nadie puede avisar a todo el mundo), así que va por
-- una función solo del equipo, y queda apuntado en `avisos_enviados`.
--
-- Quien tenga apagado el tipo `aviso_equipo` en /ajustes no lo recibe.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.avisos_enviados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text,
  enlace text,
  personas int not null default 0,
  por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.avisos_enviados enable row level security;

-- Lo lee el equipo (el panel enseña cuándo se mandó el último); lo escribe
-- solo la función.
drop policy if exists "avisos_enviados_lectura" on public.avisos_enviados;
create policy "avisos_enviados_lectura" on public.avisos_enviados
  for select to authenticated using (public.is_admin());
grant select on public.avisos_enviados to authenticated;

create or replace function public.admin_aviso_campanita(p_titulo text, p_cuerpo text default null, p_enlace text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text := left(trim(coalesce(p_titulo, '')), 200);
  v_cuerpo text := nullif(left(trim(coalesce(p_cuerpo, '')), 500), '');
  v_enlace text := nullif(trim(coalesce(p_enlace, '')), '');
  v_n int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede avisar a todo el mundo';
  end if;
  if v_titulo = '' then
    raise exception 'el aviso necesita un texto';
  end if;
  -- Un enlace de la casa (/algo) o de fuera (https://…); otra cosa, no.
  if v_enlace is not null and v_enlace !~ '^(/[^/]|/$|https://)' then
    raise exception 'el enlace tiene que empezar por / o por https://';
  end if;
  -- Dos veces el mismo aviso en una hora es un doble clic, no un aviso.
  if exists (
    select 1 from avisos_enviados
     where titulo = v_titulo and coalesce(enlace, '') = coalesce(v_enlace, '')
       and created_at > now() - interval '1 hour'
  ) then
    return jsonb_build_object('ok', true, 'ya', true, 'personas', 0);
  end if;

  insert into user_notifications (recipient_id, type, title, body, link)
  select p.id, 'aviso_equipo', v_titulo, v_cuerpo, v_enlace
    from user_profiles p
   where not ('aviso_equipo' = any (coalesce(p.notification_prefs_disabled, '{}'::text[])))
     and exists (select 1 from auth.users u where u.id = p.id);
  get diagnostics v_n = row_count;

  insert into avisos_enviados (titulo, cuerpo, enlace, personas, por)
  values (v_titulo, v_cuerpo, v_enlace, v_n, auth.uid());

  return jsonb_build_object('ok', true, 'personas', v_n);
end;
$$;

revoke all on function public.admin_aviso_campanita(text, text, text) from public, anon;
grant execute on function public.admin_aviso_campanita(text, text, text) to authenticated;

notify pgrst, 'reload schema';
