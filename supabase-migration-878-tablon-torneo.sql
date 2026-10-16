-- ════════════════════════════════════════════════════════════════════
-- Tanda 878: el tablón del torneo.
--
-- PINGU: «hay gente que cuando hay torneo y no lo retransmito en twitch,
-- pierden un poco el hilo de cuando se cierra ronda, de qué está pasando...
-- un chat para que los organizadores pongan updates?». No es un chat: una
-- lista de avisos cortos del organizador y de sus jueces, con hora, que ve
-- todo el mundo (sin cuenta también), y en la misma lista los sucesos que
-- la web apunta sola (ronda en marcha, ronda cerrada, top cut, final). La
-- barra de estado (877) enseña el último aviso humano.
--
-- Escribir pasa SIEMPRE por la función `torneos_tablon_escribir`: la RLS
-- de la tabla no deja insertar a nadie a pelo, y así la misma función es
-- la que avisa a los inscritos (user_notifications, que `enviar-push`
-- empuja sola) respetando sus preferencias (`notification_prefs_disabled`,
-- tipo `torneo_aviso`).
--
-- Ejecutar en el SQL Editor de Supabase. Cada sentencia se sostiene sola
-- (la 631). No borra ni cambia nada de lo que hay.
-- ════════════════════════════════════════════════════════════════════

-- 1. La tabla ────────────────────────────────────────────────────────
create table if not exists public.tournament_updates (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- Null en los sucesos automáticos (los apunta la web al hacer el
  -- organizador algo) y en los avisos de quien borró su cuenta.
  author_id uuid references auth.users (id) on delete set null,
  -- 'aviso' lo escribe una persona; 'auto' lo apunta la web.
  kind text not null default 'aviso' check (kind in ('aviso', 'auto')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists tournament_updates_torneo_idx
  on public.tournament_updates (tournament_id, created_at desc);

comment on table public.tournament_updates is
  'El tablón de un torneo (878): avisos del organizador y sus jueces, y los sucesos que la web apunta sola. Se escribe solo por torneos_tablon_escribir.';

-- 2. Leer, todo el mundo; escribir, nadie a pelo ──────────────────────
alter table public.tournament_updates enable row level security;

drop policy if exists tablon_leer on public.tournament_updates;
create policy tablon_leer on public.tournament_updates
  for select to anon, authenticated using (true);

-- Borrar su propio aviso, quien lo escribió o quien lleva el torneo (un
-- aviso con una errata o uno que ya no vale). Los automáticos no se borran.
drop policy if exists tablon_borrar on public.tournament_updates;
create policy tablon_borrar on public.tournament_updates
  for delete to authenticated
  using (kind = 'aviso' and (author_id = auth.uid() or public.torneos_mando(tournament_id)));

grant select on public.tournament_updates to anon, authenticated;
grant delete on public.tournament_updates to authenticated;

-- 3. Escribir ────────────────────────────────────────────────────────
--
-- Quién: quien lleva el torneo (`torneos_mando`, el criterio de siempre) o
-- un juez aprobado de ESE torneo (`repeticiones_juez_de`, la 555).
-- `p_auto` = true apunta un suceso de la web (sin autor y sin avisar).
-- `p_avisar` = true deja una notificación a cada inscrito activo que no
-- tenga apagado el tipo `torneo_aviso`; `enviar-push` las empuja sola.
create or replace function public.torneos_tablon_escribir(
  p_torneo uuid,
  p_texto text,
  p_avisar boolean default true,
  p_auto boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id uuid;
  v_nombre text;
  v_slug text;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not (public.torneos_mando(p_torneo) or public.repeticiones_juez_de(p_torneo)) then
    raise exception 'Solo quien lleva el torneo y sus jueces escriben en el tablón.' using errcode = '42501';
  end if;
  if char_length(v_texto) < 1 or char_length(v_texto) > 500 then
    raise exception 'Un aviso tiene entre 1 y 500 letras.' using errcode = '22023';
  end if;
  select t.name, t.slug into v_nombre, v_slug from public.tournaments t where t.id = p_torneo;
  if v_nombre is null then
    raise exception 'Ese torneo no existe.' using errcode = 'P0002';
  end if;

  insert into public.tournament_updates (tournament_id, author_id, kind, body)
  values (p_torneo, case when p_auto then null else v_yo end, case when p_auto then 'auto' else 'aviso' end, v_texto)
  returning id into v_id;

  -- El aviso a los inscritos: solo los avisos humanos, y solo a quien no
  -- lo tenga apagado. Quien escribe no se avisa a sí mismo.
  if p_avisar and not p_auto then
    insert into public.user_notifications (recipient_id, type, title, body, link)
    select r.user_id, 'torneo_aviso', 'Aviso del torneo — ' || v_nombre, v_texto, '/torneo?slug=' || v_slug
      from public.tournament_registrations r
      join public.user_profiles p on p.id = r.user_id
     where r.tournament_id = p_torneo
       and r.status = 'active'
       and r.user_id <> v_yo
       and not (coalesce(p.notification_prefs_disabled, '{}'::text[]) @> array['torneo_aviso']);
  end if;

  return v_id;
end;
$$;

revoke all on function public.torneos_tablon_escribir(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.torneos_tablon_escribir(uuid, text, boolean, boolean) to authenticated, service_role;

comment on function public.torneos_tablon_escribir(uuid, text, boolean, boolean) is
  'Escribe en el tablón del torneo (878): organizador o juez aprobado. p_auto apunta un suceso de la web; p_avisar deja notificación (torneo_aviso) a los inscritos.';

-- 4. En tiempo real: la ficha escucha la tabla (como las mesas y el chat)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_updates'
  ) then
    alter publication supabase_realtime add table public.tournament_updates;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Comprobación: la tabla con sus dos políticas y la función.
select policyname, cmd from pg_policies where tablename = 'tournament_updates';
select proname from pg_proc where proname = 'torneos_tablon_escribir';
