-- Tanda 1118 — el panel de Logros de /admin.
--
-- PINGU eligió en la propuesta «Panel de admin nuevo»: dar y quitar un logro
-- a mano, con motivo (un sorteo, un premio, un error), y que «cómo se
-- consigue» salga solo de la regla pero se pueda escribir a mano.
--
-- 1. `achievement_definitions.objetivo`: el «cómo se consigue» escrito a
--    mano. Vacío, la web lo dice sola con la condición (js/logro-objetivo.js).
-- 2. `logros_a_mano`: quién dio o quitó qué logro a quién, cuándo y por qué.
--    Solo la lee el equipo.
-- 3. `admin_logro_dar` / `admin_logro_quitar`: lo hacen como si se ganara o se
--    perdiera (la XP del logro sube o baja con él, como en `checkAchievements`)
--    y avisan a la persona al dárselo. Solo un admin.
-- Se puede ejecutar dos veces.

alter table public.achievement_definitions add column if not exists objetivo text;

create table if not exists public.logros_a_mano (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  logro_id text not null,
  accion text not null check (accion in ('dar', 'quitar')),
  motivo text,
  por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists logros_a_mano_logro_idx on public.logros_a_mano (logro_id, created_at desc);

alter table public.logros_a_mano enable row level security;

drop policy if exists logros_a_mano_equipo on public.logros_a_mano;
create policy logros_a_mano_equipo on public.logros_a_mano
  for select to authenticated using (public.is_admin());

grant select on public.logros_a_mano to authenticated;

create or replace function public.admin_logro_dar(p_usuario uuid, p_logro text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_xp int;
  v_tenia boolean;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede dar logros';
  end if;
  select title, greatest(coalesce(xp_reward, 0), 0) into v_titulo, v_xp
    from achievement_definitions where id = p_logro;
  if v_titulo is null then
    raise exception 'ese logro no existe';
  end if;
  select coalesce(p_logro = any(achievements), false) into v_tenia
    from user_profiles where id = p_usuario;
  if v_tenia is null then
    raise exception 'esa persona no existe';
  end if;
  if v_tenia then
    return jsonb_build_object('ok', true, 'ya', true);
  end if;

  update user_profiles
     set achievements = array_append(coalesce(achievements, '{}'::text[]), p_logro),
         total_xp = coalesce(total_xp, 0) + v_xp,
         level = public.nivel_de_xp(coalesce(total_xp, 0) + v_xp)
   where id = p_usuario;

  insert into logros_a_mano (user_id, logro_id, accion, motivo, por)
  values (p_usuario, p_logro, 'dar', v_motivo, auth.uid());

  insert into user_notifications (recipient_id, type, title, body, link)
  values (p_usuario, 'logro', 'Tienes un logro nuevo: ' || v_titulo, v_motivo, '/perfil?ver=logros');

  return jsonb_build_object('ok', true, 'xp', v_xp);
end;
$$;

create or replace function public.admin_logro_quitar(p_usuario uuid, p_logro text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp int;
  v_tenia boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede quitar logros';
  end if;
  select coalesce(p_logro = any(achievements), false) into v_tenia
    from user_profiles where id = p_usuario;
  if v_tenia is null then
    raise exception 'esa persona no existe';
  end if;
  if not v_tenia then
    return jsonb_build_object('ok', true, 'ya', true);
  end if;
  select greatest(coalesce(xp_reward, 0), 0) into v_xp from achievement_definitions where id = p_logro;
  v_xp := coalesce(v_xp, 0);

  -- Sin bajar de cero, y si era el destacado, deja de serlo.
  update user_profiles
     set achievements = array_remove(achievements, p_logro),
         total_xp = greatest(coalesce(total_xp, 0) - v_xp, 0),
         level = public.nivel_de_xp(greatest(coalesce(total_xp, 0) - v_xp, 0)),
         showcase_achievement = case when showcase_achievement = p_logro then null else showcase_achievement end
   where id = p_usuario;

  insert into logros_a_mano (user_id, logro_id, accion, motivo, por)
  values (p_usuario, p_logro, 'quitar', nullif(trim(coalesce(p_motivo, '')), ''), auth.uid());

  return jsonb_build_object('ok', true, 'xp', v_xp);
end;
$$;

revoke all on function public.admin_logro_dar(uuid, text, text) from public, anon;
revoke all on function public.admin_logro_quitar(uuid, text, text) from public, anon;
grant execute on function public.admin_logro_dar(uuid, text, text) to authenticated;
grant execute on function public.admin_logro_quitar(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
