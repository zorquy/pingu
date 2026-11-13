-- Tanda 1306 — el perfil público, solo con lo que se enseña (S3 del plan).
--
-- `user_profiles` la lee cualquiera, también sin cuenta (es lo que hace
-- funcionar el foro, Gente y los perfiles). Pero llevaba tres columnas que la
-- web no enseña nunca de nadie:
--
--   · `email_unsubscribe_token`: la llave del enlace «darme de baja» de los
--     correos. Con ella cualquiera podía dar de baja de los correos a quien
--     quisiera (la función `baja-correo` no pide más).
--   · `saved_guides`: lo que cada uno guarda para leer.
--   · `referred_by`: quién te invitó.
--
-- Las tres se mudan a `user_privado`, que solo lee su dueño (como la fecha de
-- nacimiento en la 1304). Lo que hace falta de otros va por funciones que
-- devuelven solo lo justo: `mis_invitados()` y `poner_padrino()`.
--
-- Y `latido_en_linea` deja de apuntar quién eres si escondes tu actividad
-- (`hide_activity`): `online_now` la lee cualquiera, con la hora y el tema que
-- lees, y hasta ahora el «esconder» solo lo respetaba la pantalla.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.user_privado (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  saved_guides uuid[] not null default '{}',
  referred_by uuid references auth.users(id) on delete set null,
  email_unsubscribe_token uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_privado_token_idx on public.user_privado (email_unsubscribe_token);

create index if not exists user_privado_referred_by_idx on public.user_privado (referred_by) where referred_by is not null;

alter table public.user_privado enable row level security;

drop policy if exists user_privado_mio on public.user_privado;

create policy user_privado_mio on public.user_privado for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_privado_mio_cambiar on public.user_privado;

create policy user_privado_mio_cambiar on public.user_privado for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Leer la fila propia y cambiar SOLO los guardados. Quién te invitó se pone
-- una vez por `poner_padrino`, y el token no lo cambia nadie desde la web.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.user_privado from authenticated;
    grant select on public.user_privado to authenticated;
    grant update (saved_guides, updated_at) on public.user_privado to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.user_privado from anon;
  end if;
end $$;

-- Lo que había, a la tabla nueva. Columna a columna: si una ya no está (la
-- segunda pasada), se usa su valor por defecto.
do $$
declare
  v_guias text := 'null::uuid[]';
  v_padrino text := 'null::uuid';
  v_token text := 'null::uuid';
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'saved_guides') then
    v_guias := 'p.saved_guides::uuid[]';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'referred_by') then
    v_padrino := 'p.referred_by';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'email_unsubscribe_token') then
    v_token := 'p.email_unsubscribe_token';
  end if;
  execute format(
    'insert into public.user_privado (user_id, saved_guides, referred_by, email_unsubscribe_token)
     select p.id, coalesce(%s, ''{}''), %s, coalesce(%s, gen_random_uuid())
     from public.user_profiles p
     on conflict (user_id) do nothing',
    v_guias, v_padrino, v_token);
end $$;

-- Cada perfil nuevo nace con su fila privada (y su token de baja).
create or replace function public.privado_al_nacer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.user_privado (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_privado_al_nacer on public.user_profiles;

create trigger trg_privado_al_nacer
  after insert on public.user_profiles
  for each row execute function public.privado_al_nacer();

-- Quién te invitó: una vez, y nunca tú mismo ni alguien que no existe.
create or replace function public.poner_padrino(p_padrino uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := auth.uid();
begin
  if v_yo is null or p_padrino is null or p_padrino = v_yo then
    return false;
  end if;
  if not exists (select 1 from public.user_profiles where id = p_padrino) then
    return false;
  end if;
  insert into public.user_privado (user_id) values (v_yo) on conflict (user_id) do nothing;
  update public.user_privado set referred_by = p_padrino, updated_at = now()
    where user_id = v_yo and referred_by is null;
  return found;
end $$;

-- A quién has invitado tú (lo público de cada uno, nada más).
create or replace function public.mis_invitados()
returns table (id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.created_at
  from public.user_privado v
  join public.user_profiles p on p.id = v.user_id
  where v.referred_by = auth.uid() and auth.uid() is not null
  order by p.created_at desc
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.poner_padrino(uuid) from public, anon;
    grant execute on function public.poner_padrino(uuid) to authenticated;
    revoke all on function public.mis_invitados() from public, anon;
    grant execute on function public.mis_invitados() to authenticated;
  end if;
end $$;

-- Las cifras del autor contaban los guardados recorriendo los perfiles.
create or replace function public.guide_author_stats(p_author uuid)
returns table (
  guide_id uuid,
  slug text,
  title text,
  published_at timestamptz,
  lecturas integer,
  lectores bigint,
  guardados bigint,
  comentarios bigint,
  agradecimientos bigint,
  valoraciones bigint,
  nota numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    g.id,
    g.slug,
    g.title,
    g.published_at,
    coalesce(g.view_count, 0),
    (select count(*) from user_progress up where up.guide_id = g.id and up.read_at is not null),
    (select count(*) from user_privado v where g.id = any (v.saved_guides)),
    (select count(*) from guide_comments c where c.guide_id = g.id),
    (select count(*) from guide_helpful h where h.guide_id = g.id),
    (select count(*) from guide_reviews r where r.guide_id = g.id),
    (select round(avg(r.rating)::numeric, 1) from guide_reviews r where r.guide_id = g.id)
  from guides g
  where g.author_id = p_author
    and (auth.uid() = p_author or public.is_admin())
  order by g.published_at desc nulls first, g.created_at desc
$$;

-- «En línea» respeta «esconder mi actividad»: quien la esconde late como
-- invitado (cuenta en el número, sin nombre ni tema).
create or replace function public.latido_en_linea(p_token text, p_thread uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_quien uuid := auth.uid();
  v_oculto boolean := false;
begin
  if p_token is null or p_token !~ '^[0-9a-f-]{36}$' then
    return;
  end if;

  if v_quien is not null then
    select coalesce(hide_activity, false) into v_oculto from public.user_profiles where id = v_quien;
    if coalesce(v_oculto, false) then
      v_quien := null;
      p_thread := null;
    end if;
  end if;

  if p_thread is not null and not exists (select 1 from public.forum_threads t where t.id = p_thread) then
    p_thread := null;
  end if;

  insert into public.online_now as o (token, user_id, thread_id, last_seen)
  values (p_token, v_quien, p_thread, now())
  on conflict (token) do update
    set last_seen = now(),
        thread_id = excluded.thread_id,
        -- Al esconderte se borra también lo de antes de esta pestaña.
        user_id = case when v_oculto then null else coalesce(v_quien, o.user_id) end;

  delete from public.online_now where last_seen < now() - interval '1 day';
end;
$$;

grant execute on function public.latido_en_linea(text, uuid) to anon, authenticated;

-- Lo que ya estaba apuntado de quien se esconde, fuera.
update public.online_now o set user_id = null, thread_id = null
  from public.user_profiles p
  where p.id = o.user_id and coalesce(p.hide_activity, false);

-- Y lo público deja de tener lo privado.
drop index if exists public.user_profiles_referred_by;

alter table public.user_profiles drop column if exists email_unsubscribe_token;

alter table public.user_profiles drop column if exists saved_guides;

alter table public.user_profiles drop column if exists referred_by;

notify pgrst, 'reload schema';
