-- ============================================================
-- Tanda 1260 — Los avisos del equipo, de verdad
--
-- Hasta la 1260 el aviso era UNO, guardado como JSON en site_settings
-- (`aviso_global`), y solo podía ser la franja de arriba. PINGU quiere
-- anunciar el concurso de los Funko Pop de los iniciales de Kanto con
-- imagen, cuenta atrás, «Me apunto» y un sorteo, así que ahora:
--
--   · `avisos`: varios a la vez, cada uno con dónde sale (`sitios`: pop-up,
--     franja, tarjeta de Inicio y campanita), su imagen, su botón, desde y
--     hasta. La gente solo LEE los que están en marcha (la política lo
--     decide, no la web).
--   · `aviso_cifras`: cuántos lo vieron, pulsaron el botón o lo cerraron,
--     por día y SIN guardar quién (como la analítica, 1065).
--   · `aviso_participantes` + `aviso_apuntarme`: «Me apunto» con la cuenta.
--     El equipo ve la lista y sortea (`admin_aviso_participantes`,
--     `admin_aviso_sortear`).
--   · La campanita: `admin_aviso_avisar` al publicar y `avisos_al_dia()`, que
--     llama cada hora la función programada `avisos-recordatorio`, para los
--     programados y el «se acaba pronto». Se marca ANTES de avisar (la 665).
--   · El cubo público `avisos`, para la imagen (solo el equipo sube).
--
-- El aviso de antes (site_settings.aviso_global) se copia dentro como franja.
-- Sin tablas temporales: cada sentencia vale sola (la 631).
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'novedad',
  titulo text not null,
  texto text,
  imagen text,
  boton_texto text,
  boton_enlace text,
  participar boolean not null default false,
  enlace_texto text,
  enlace text,
  sitios text[] not null default '{franja}',
  cuenta_atras boolean not null default false,
  recordar boolean not null default false,
  publico text not null default 'todos',
  desde timestamptz,
  hasta timestamptz,
  publicado boolean not null default false,
  publicado_at timestamptz,
  avisado_at timestamptz,
  recordado_at timestamptz,
  ganador_id uuid references auth.users(id) on delete set null,
  sorteado_at timestamptz,
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.avisos drop constraint if exists avisos_tipo_ok;
alter table public.avisos add constraint avisos_tipo_ok check (tipo in ('concurso', 'novedad', 'evento', 'aviso', 'mantenimiento'));
alter table public.avisos drop constraint if exists avisos_titulo_ok;
alter table public.avisos add constraint avisos_titulo_ok check (char_length(btrim(titulo)) between 1 and 160);
alter table public.avisos drop constraint if exists avisos_texto_ok;
alter table public.avisos add constraint avisos_texto_ok check (texto is null or char_length(texto) <= 500);
alter table public.avisos drop constraint if exists avisos_sitios_ok;
alter table public.avisos add constraint avisos_sitios_ok check (cardinality(sitios) >= 1 and sitios <@ array['popup', 'franja', 'inicio', 'campanita']::text[]);
alter table public.avisos drop constraint if exists avisos_publico_ok;
alter table public.avisos add constraint avisos_publico_ok check (publico in ('todos', 'cuenta', 'sin_cuenta', 'movil'));
alter table public.avisos drop constraint if exists avisos_fechas_ok;
alter table public.avisos add constraint avisos_fechas_ok check (desde is null or hasta is null or hasta > desde);
-- Un enlace de la casa (/algo) o de fuera con https; lo demás no (la 1120).
alter table public.avisos drop constraint if exists avisos_enlaces_ok;
alter table public.avisos add constraint avisos_enlaces_ok check (
  (boton_enlace is null or boton_enlace ~ '^(/[^/]|/$|https://)')
  and (enlace is null or enlace ~ '^(/[^/]|/$|https://)')
  and (imagen is null or imagen ~ '^https://'));

alter table public.avisos add column if not exists avisado_at timestamptz;

create index if not exists avisos_en_marcha on public.avisos (publicado, hasta);

alter table public.avisos enable row level security;

-- La gente ve los que están en marcha; el equipo, todos.
drop policy if exists "avisos_en_marcha" on public.avisos;
create policy "avisos_en_marcha" on public.avisos for select to anon, authenticated
  using (publicado and (desde is null or desde <= now()) and (hasta is null or hasta > now()));
drop policy if exists "avisos_equipo_lee" on public.avisos;
create policy "avisos_equipo_lee" on public.avisos for select to authenticated using (public.is_admin());
drop policy if exists "avisos_equipo_crea" on public.avisos;
create policy "avisos_equipo_crea" on public.avisos for insert to authenticated with check (public.is_admin());
drop policy if exists "avisos_equipo_cambia" on public.avisos;
create policy "avisos_equipo_cambia" on public.avisos for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "avisos_equipo_borra" on public.avisos;
create policy "avisos_equipo_borra" on public.avisos for delete to authenticated using (public.is_admin());
grant select on public.avisos to anon, authenticated;
grant insert, update, delete on public.avisos to authenticated;

-- ── Las cifras, sin quién ──
create table if not exists public.aviso_cifras (
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  dia date not null,
  vistos int not null default 0,
  clics int not null default 0,
  cerrados int not null default 0,
  primary key (aviso_id, dia)
);
alter table public.aviso_cifras enable row level security;
drop policy if exists "aviso_cifras_equipo" on public.aviso_cifras;
create policy "aviso_cifras_equipo" on public.aviso_cifras for select to authenticated using (public.is_admin());
grant select on public.aviso_cifras to authenticated;

-- El navegador avisa UNA vez por aviso y cosa (lo recuerda él); aquí solo se
-- suma, y solo a un aviso que está en marcha, para que no se pueda inflar
-- uno terminado ni inventar ids.
create or replace function public.aviso_contar(p_aviso uuid, p_que text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia date := (now() at time zone 'Europe/Madrid')::date;
begin
  if p_que not in ('visto', 'clic', 'cerrado') then return; end if;
  if not exists (
    select 1 from avisos a
     where a.id = p_aviso and a.publicado
       and (a.desde is null or a.desde <= now()) and (a.hasta is null or a.hasta > now())
  ) then return; end if;
  insert into aviso_cifras (aviso_id, dia, vistos, clics, cerrados)
  values (p_aviso, v_dia, (p_que = 'visto')::int, (p_que = 'clic')::int, (p_que = 'cerrado')::int)
  on conflict (aviso_id, dia) do update set
    vistos = aviso_cifras.vistos + excluded.vistos,
    clics = aviso_cifras.clics + excluded.clics,
    cerrados = aviso_cifras.cerrados + excluded.cerrados;
end;
$$;
revoke all on function public.aviso_contar(uuid, text) from public;
grant execute on function public.aviso_contar(uuid, text) to anon, authenticated;

-- ── «Me apunto» ──
create table if not exists public.aviso_participantes (
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (aviso_id, user_id)
);
alter table public.aviso_participantes enable row level security;
drop policy if exists "aviso_participantes_mia" on public.aviso_participantes;
create policy "aviso_participantes_mia" on public.aviso_participantes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select on public.aviso_participantes to authenticated;

create or replace function public.aviso_apuntarme(p_aviso uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_n int;
  v_total int;
begin
  if v_yo is null then raise exception 'para apuntarte hace falta una cuenta'; end if;
  if not exists (select 1 from avisos a where a.id = p_aviso and a.participar) then
    raise exception 'en ese aviso no hay que apuntarse';
  end if;
  if not exists (
    select 1 from avisos a
     where a.id = p_aviso and a.publicado
       and (a.desde is null or a.desde <= now()) and (a.hasta is null or a.hasta > now())
  ) then raise exception 'ese aviso ya ha terminado'; end if;
  if exists (select 1 from user_profiles p where p.id = v_yo and p.tipo = 'tienda') then
    raise exception 'las cuentas de tienda no participan';
  end if;
  insert into aviso_participantes (aviso_id, user_id) values (p_aviso, v_yo) on conflict do nothing;
  get diagnostics v_n = row_count;
  select count(*) into v_total from aviso_participantes where aviso_id = p_aviso;
  return jsonb_build_object('ok', true, 'ya', v_n = 0, 'total', v_total);
end;
$$;
revoke all on function public.aviso_apuntarme(uuid) from public, anon;
grant execute on function public.aviso_apuntarme(uuid) to authenticated;

-- Cuántos van y si tú estás (sin cuenta, `yo` es false).
create or replace function public.aviso_participacion(p_aviso uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from aviso_participantes where aviso_id = p_aviso),
    'yo', auth.uid() is not null and exists (select 1 from aviso_participantes where aviso_id = p_aviso and user_id = auth.uid()))
  where exists (select 1 from avisos a where a.id = p_aviso and a.participar and a.publicado)
$$;
revoke all on function public.aviso_participacion(uuid) from public;
grant execute on function public.aviso_participacion(uuid) to anon, authenticated;

create or replace function public.admin_aviso_participantes(p_aviso uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'solo el equipo'; end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_url, ap.created_at
      from aviso_participantes ap join user_profiles p on p.id = ap.user_id
     where ap.aviso_id = p_aviso
     order by ap.created_at;
end;
$$;
revoke all on function public.admin_aviso_participantes(uuid) from public, anon;
grant execute on function public.admin_aviso_participantes(uuid) to authenticated;

-- Al azar entre los apuntados. Sortear otra vez (si el ganador no contesta)
-- deja fuera al de antes.
create or replace function public.admin_aviso_sortear(p_aviso uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes uuid;
  v_g uuid;
  v_total int;
  v_p record;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'solo el equipo'; end if;
  select ganador_id into v_antes from avisos where id = p_aviso;
  if not found then raise exception 'ese aviso no existe'; end if;
  select count(*) into v_total from aviso_participantes where aviso_id = p_aviso;
  if v_total = 0 then raise exception 'todavía no se ha apuntado nadie'; end if;
  select ap.user_id into v_g from aviso_participantes ap
   where ap.aviso_id = p_aviso and (v_antes is null or ap.user_id <> v_antes or v_total = 1)
   order by random() limit 1;
  update avisos set ganador_id = v_g, sorteado_at = now(), updated_at = now() where id = p_aviso;
  select id, username, display_name, avatar_url into v_p from user_profiles where id = v_g;
  return jsonb_build_object('total', v_total, 'ganador', jsonb_build_object(
    'id', v_g, 'username', v_p.username, 'display_name', v_p.display_name, 'avatar_url', v_p.avatar_url));
end;
$$;
revoke all on function public.admin_aviso_sortear(uuid) from public, anon;
grant execute on function public.admin_aviso_sortear(uuid) to authenticated;

-- ── La campanita: al salir y el recordatorio del final ──
-- A quién: todas las cuentas que no apagaron «Novedades y avisos del equipo»
-- (`aviso_equipo`, como la 1120). Una tienda solo recibe el de mantenimiento
-- (1071: solo tiene su panel), y un aviso «sin cuenta» no va a la campanita
-- de nadie. El de «se acaba pronto» se salta a quien ya se apuntó.
-- Interna: la llaman `admin_aviso_avisar` y `avisos_al_dia`.
create or replace function public.aviso_mandar(p_aviso uuid, p_recordatorio boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_titulo text;
  v_cuerpo text;
  v_n int;
begin
  select * into v from avisos where id = p_aviso;
  if not found or v.publico = 'sin_cuenta' then return 0; end if;
  v_titulo := left(case when p_recordatorio then 'Se acaba pronto: ' || v.titulo else v.titulo end, 200);
  v_cuerpo := case when p_recordatorio then (case when v.participar then 'Aún estás a tiempo de apuntarte.' else 'Aún estás a tiempo.' end)
                   else nullif(left(btrim(coalesce(v.texto, '')), 500), '') end;
  insert into user_notifications (recipient_id, type, title, body, link)
  select p.id, 'aviso_equipo', v_titulo, v_cuerpo, '/?aviso=' || v.id
    from user_profiles p
   where not ('aviso_equipo' = any (coalesce(p.notification_prefs_disabled, '{}'::text[])))
     and (coalesce(p.tipo, '') <> 'tienda' or v.tipo = 'mantenimiento')
     and exists (select 1 from auth.users u where u.id = p.id)
     and not (p_recordatorio and exists (select 1 from aviso_participantes ap where ap.aviso_id = v.id and ap.user_id = p.id));
  get diagnostics v_n = row_count;
  insert into avisos_enviados (titulo, cuerpo, enlace, personas, por)
  values (v_titulo, case when p_recordatorio then 'Recordatorio automático' else v_cuerpo end, '/?aviso=' || v.id, v_n, auth.uid());
  return v_n;
end;
$$;
revoke all on function public.aviso_mandar(uuid, boolean) from public, anon, authenticated;

-- Al publicar uno que ya está en marcha, desde el panel. Una sola vez.
create or replace function public.admin_aviso_avisar(p_aviso uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'solo el equipo puede avisar a todo el mundo'; end if;
  -- Se marca ANTES de avisar: si lo de después falla, se pierde un aviso; al
  -- revés, saldría dos veces (la 665).
  update avisos set avisado_at = now()
   where id = p_aviso and avisado_at is null and publicado and 'campanita' = any (sitios)
     and (desde is null or desde <= now()) and (hasta is null or hasta > now());
  if not found then return jsonb_build_object('ok', true, 'ya', true, 'personas', 0); end if;
  v_n := public.aviso_mandar(p_aviso, false);
  return jsonb_build_object('ok', true, 'personas', v_n);
end;
$$;
revoke all on function public.admin_aviso_avisar(uuid) from public, anon;
grant execute on function public.admin_aviso_avisar(uuid) to authenticated;

-- La pasada de cada hora (netlify/functions/avisos-recordatorio.mjs): manda
-- los programados que ya han salido y, a menos de 30 horas del final, el
-- recordatorio. Solo entre las 10 y las 22 de Madrid: nadie quiere un aviso
-- a las 3 de la mañana. `p_ahora` es para la prueba: solo la llama la clave
-- de servicio.
create or replace function public.avisos_al_dia(p_ahora timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_total int := 0;
  v_hora int := extract(hour from p_ahora at time zone 'Europe/Madrid');
begin
  if v_hora < 10 or v_hora >= 22 then return 0; end if;
  for v in
    select id from avisos a
     where a.publicado and 'campanita' = any (a.sitios) and a.avisado_at is null
       and (a.desde is null or a.desde <= p_ahora) and (a.hasta is null or a.hasta > p_ahora)
     for update skip locked
  loop
    update avisos set avisado_at = p_ahora where id = v.id;
    v_total := v_total + public.aviso_mandar(v.id, false);
  end loop;
  for v in
    select id from avisos a
     where a.publicado and a.recordar and 'campanita' = any (a.sitios) and a.recordado_at is null
       and a.hasta is not null and a.hasta > p_ahora and a.hasta <= p_ahora + interval '30 hours'
       and (a.desde is null or a.desde <= p_ahora)
       -- Si acaba de salir, el aviso de salida ya hace de recordatorio.
       and (a.avisado_at is null or a.avisado_at < p_ahora - interval '12 hours')
     for update skip locked
  loop
    update avisos set recordado_at = p_ahora where id = v.id;
    v_total := v_total + public.aviso_mandar(v.id, true);
  end loop;
  return v_total;
end;
$$;
revoke all on function public.avisos_al_dia(timestamptz) from public, anon, authenticated;
grant execute on function public.avisos_al_dia(timestamptz) to service_role;

-- ── La imagen: un cubo público que solo escribe el equipo ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avisos', 'avisos', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avisos_imagen_lee" on storage.objects;
create policy "avisos_imagen_lee" on storage.objects for select to authenticated
  using (bucket_id = 'avisos' and public.is_admin());
drop policy if exists "avisos_imagen_sube" on storage.objects;
create policy "avisos_imagen_sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'avisos' and public.is_admin());
drop policy if exists "avisos_imagen_cambia" on storage.objects;
create policy "avisos_imagen_cambia" on storage.objects for update to authenticated
  using (bucket_id = 'avisos' and public.is_admin());
drop policy if exists "avisos_imagen_borra" on storage.objects;
create policy "avisos_imagen_borra" on storage.objects for delete to authenticated
  using (bucket_id = 'avisos' and public.is_admin());

-- ── El aviso de antes, dentro (una vez: solo si la tabla está vacía) ──
insert into public.avisos (tipo, titulo, boton_texto, boton_enlace, sitios, publico, desde, hasta, publicado, publicado_at)
select
  case when s.value->>'tipo' in ('novedad', 'aviso', 'mantenimiento') then s.value->>'tipo'
       when s.value->>'tono' = 'aviso' then 'aviso' else 'novedad' end,
  left(btrim(s.value->>'texto'), 160),
  nullif(btrim(coalesce(s.value->>'texto_enlace', '')), ''),
  case when coalesce(s.value->>'enlace', '') ~ '^(/[^/]|/$|https://)' then s.value->>'enlace' end,
  '{franja}',
  case when s.value->>'publico' in ('cuenta', 'movil') then s.value->>'publico' else 'todos' end,
  nullif(s.value->>'desde', '')::timestamptz,
  nullif(s.value->>'hasta', '')::timestamptz,
  coalesce((s.value->>'activo')::boolean, false),
  now()
from public.site_settings s
where s.key = 'aviso_global'
  and btrim(coalesce(s.value->>'texto', '')) <> ''
  and (nullif(s.value->>'desde', '') is null or nullif(s.value->>'hasta', '') is null
       or (s.value->>'hasta')::timestamptz > (s.value->>'desde')::timestamptz)
  and not exists (select 1 from public.avisos);

notify pgrst, 'reload schema';
