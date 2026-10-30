-- ============================================================
-- Tanda 1121 — Silenciar y banear con motivo y duración
--
-- Hasta ahora, en /admin → Usuarios, «Silenciar» y «Banear» ponían
-- is_muted / is_banned a pelo: sin motivo, sin fecha de fin y sin rastro de
-- quién lo hizo. Lo que se COMPRUEBA sigue siendo lo mismo (esas dos
-- columnas, que miran las políticas del foro y app.js), así que nada de lo
-- que ya funciona cambia; lo nuevo es el registro y que se levante solo:
--
--   · `moderaciones`: una fila por silencio o baneo (qué, motivo, hasta,
--     quién), con `quitada_at` cuando se levanta. La lee el equipo.
--   · `admin_moderar(usuario, 'silencio'|'baneo', motivo, días)` y
--     `admin_moderar_quitar(usuario, qué)`: solo admin, y a uno mismo no.
--   · `moderacion_al_dia()`: levanta lo caducado. La llama cada hora la
--     función `moderacion-al-dia` (y /admin al abrir Usuarios). Solo toca a
--     quien tiene una fila caducada: un silencio puesto a mano antes de esta
--     tanda no tiene fila y no se levanta solo.
--
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.moderaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  que text not null check (que in ('silencio', 'baneo')),
  motivo text,
  hasta timestamptz,
  por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  quitada_at timestamptz,
  quitada_por uuid references auth.users(id) on delete set null
);

create index if not exists moderaciones_usuario_idx on public.moderaciones (user_id, created_at desc);
create index if not exists moderaciones_abiertas_idx on public.moderaciones (hasta) where quitada_at is null;

alter table public.moderaciones enable row level security;
drop policy if exists "moderaciones_lectura" on public.moderaciones;
create policy "moderaciones_lectura" on public.moderaciones
  for select to authenticated using (public.is_admin());
grant select on public.moderaciones to authenticated;

create or replace function public.admin_moderar(p_usuario uuid, p_que text, p_motivo text default null, p_dias int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hasta timestamptz := case when p_dias is null or p_dias <= 0 then null else now() + make_interval(days => p_dias) end;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede moderar';
  end if;
  if p_que not in ('silencio', 'baneo') then
    raise exception 'qué: silencio o baneo';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'a ti no';
  end if;
  if not exists (select 1 from user_profiles where id = p_usuario) then
    raise exception 'esa persona no existe';
  end if;
  -- La anterior del mismo tipo se cierra: manda la última.
  update moderaciones set quitada_at = now(), quitada_por = auth.uid()
   where user_id = p_usuario and que = p_que and quitada_at is null;
  insert into moderaciones (user_id, que, motivo, hasta, por)
  values (p_usuario, p_que, nullif(left(trim(coalesce(p_motivo, '')), 300), ''), v_hasta, auth.uid());
  if p_que = 'silencio' then
    update user_profiles set is_muted = true where id = p_usuario;
  else
    update user_profiles set is_banned = true where id = p_usuario;
  end if;
  return jsonb_build_object('ok', true, 'hasta', v_hasta);
end;
$$;

create or replace function public.admin_moderar_quitar(p_usuario uuid, p_que text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede moderar';
  end if;
  if p_que not in ('silencio', 'baneo') then
    raise exception 'qué: silencio o baneo';
  end if;
  update moderaciones set quitada_at = now(), quitada_por = auth.uid()
   where user_id = p_usuario and que = p_que and quitada_at is null;
  if p_que = 'silencio' then
    update user_profiles set is_muted = false where id = p_usuario;
  else
    update user_profiles set is_banned = false where id = p_usuario;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Lo caducado se levanta. Solo quien tiene una fila abierta y vencida;
-- devuelve cuántas filas ha cerrado. Llamarla dos veces no hace nada más.
create or replace function public.moderacion_al_dia()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_silencios uuid[];
  v_baneos uuid[];
  v_n int;
begin
  -- En dos pasos a propósito: las sentencias de un mismo `with` ven la
  -- base de ANTES, y el «¿le queda otra abierta?» vería abierta la que se
  -- acaba de cerrar (y no levantaría nada).
  with vencidas as (
    update moderaciones set quitada_at = now()
     where quitada_at is null and hasta is not null and hasta <= now()
    returning user_id, que
  )
  select array_agg(distinct user_id) filter (where que = 'silencio'),
         array_agg(distinct user_id) filter (where que = 'baneo'),
         count(*)
    into v_silencios, v_baneos, v_n
    from vencidas;
  if v_n = 0 then
    return 0;
  end if;
  update user_profiles p set is_muted = false
   where p.id = any (coalesce(v_silencios, '{}')) and p.is_muted
     and not exists (select 1 from moderaciones m where m.user_id = p.id and m.que = 'silencio' and m.quitada_at is null);
  update user_profiles p set is_banned = false
   where p.id = any (coalesce(v_baneos, '{}')) and p.is_banned
     and not exists (select 1 from moderaciones m where m.user_id = p.id and m.que = 'baneo' and m.quitada_at is null);
  return v_n;
end;
$$;

revoke all on function public.admin_moderar(uuid, text, text, int) from public, anon;
revoke all on function public.admin_moderar_quitar(uuid, text) from public, anon;
grant execute on function public.admin_moderar(uuid, text, text, int) to authenticated;
grant execute on function public.admin_moderar_quitar(uuid, text) to authenticated;
-- Levantar lo vencido no le da nada a nadie: la puede llamar el panel con
-- la sesión del admin y la función programada con la clave de servicio.
revoke all on function public.moderacion_al_dia() from public, anon;
grant execute on function public.moderacion_al_dia() to authenticated, service_role;

notify pgrst, 'reload schema';
