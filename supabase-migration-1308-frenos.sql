-- Tanda 1308 — frenos contra el spam (S4 del plan).
--
-- Hasta hoy una cuenta recién creada podía abrir cien temas, mandar cien
-- mensajes privados o seguir a todo el mundo en un minuto: no había ningún
-- límite en la base. Tres frenos, todos en la base (la web solo enseña lo que
-- la base contesta):
--
--  1. Por persona y por minuto/hora, en temas, respuestas, mensajes privados,
--     seguir y denuncias. Generosos: alguien normal no los toca. Al pasarse, un
--     error con código `PD429` y la frase que la web enseña tal cual.
--  2. Cuentas de menos de 24 horas: sin enlaces a otras webs en el foro ni en
--     los mensajes, como mucho 3 temas y 5 conversaciones nuevas (`PD403`).
--  3. Un mensaje del foro con 3 denuncias de cuentas de más de una semana se
--     esconde solo (`forum_posts.oculto_spam_at`) hasta que lo mire el equipo
--     (`foro_spam_revisar`). El autor no se lo puede quitar.
--
-- El equipo (admin y moderación) y las funciones del servidor no tienen freno.
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

-- ¿Quién no lleva freno? El equipo y lo que no viene de una persona.
create or replace function public.sin_freno()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select auth.uid() is null
      or coalesce(public.is_admin(), false)
      or exists (select 1 from public.user_profiles p where p.id = auth.uid() and coalesce(p.is_moderator, false))
$$;

-- ¿Cuenta de menos de 24 horas?
create or replace function public.cuenta_nueva(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (select 1 from auth.users u where u.id = p_uid and u.created_at > now() - interval '24 hours')
$$;

-- ¿Lleva un enlace a otra web? (los de pokedoc.es no cuentan)
create or replace function public.enlace_de_fuera(p_texto text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_texto, '') ~* '(https?://|www\.)'
     and regexp_replace(coalesce(p_texto, ''), '(https?://)?(www\.)?pokedoc\.es[^\s"''<>]*', '', 'gi') ~* '(https?://|www\.)'
$$;

-- El freno de ritmo: argumentos = columna del autor, por minuto, por hora.
create or replace function public.freno_de_ritmo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_col text := tg_argv[0];
  v_min int := tg_argv[1]::int;
  v_hora int := tg_argv[2]::int;
  v_quien uuid;
  v_n_min int;
  v_n_hora int;
begin
  if public.sin_freno() then
    return new;
  end if;
  execute format('select ($1).%I', v_col) into v_quien using new;
  if v_quien is null or v_quien <> auth.uid() then
    return new;
  end if;
  execute format('select count(*) filter (where created_at > now() - interval ''1 minute''), count(*) from %I.%I where %I = $1 and created_at > now() - interval ''1 hour''',
                 tg_table_schema, tg_table_name, v_col)
    into v_n_min, v_n_hora using v_quien;
  if v_n_min >= v_min or v_n_hora >= v_hora then
    raise exception 'Vas muy rápido. Espera un poco y vuelve a probar.' using errcode = 'PD429';
  end if;
  return new;
end $$;

-- Las cuentas nuevas: enlaces, temas y conversaciones.
create or replace function public.freno_de_cuenta_nueva()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_quien uuid := auth.uid();
begin
  if public.sin_freno() or not public.cuenta_nueva(v_quien) then
    return new;
  end if;
  if tg_table_name = 'forum_threads' then
    if (select count(*) from public.forum_threads t where t.author_id = v_quien and t.created_at > now() - interval '24 hours') >= 3 then
      raise exception 'Las cuentas nuevas pueden abrir 3 temas el primer día. Mañana, todos los que quieras.' using errcode = 'PD403';
    end if;
  elsif tg_table_name = 'forum_posts' then
    if public.enlace_de_fuera(new.body_html) then
      raise exception 'Las cuentas nuevas no pueden poner enlaces a otras webs el primer día.' using errcode = 'PD403';
    end if;
  elsif tg_table_name = 'private_messages' then
    if public.enlace_de_fuera(new.body) then
      raise exception 'Las cuentas nuevas no pueden mandar enlaces a otras webs el primer día.' using errcode = 'PD403';
    end if;
    if not exists (select 1 from public.private_messages m where m.sender_id = v_quien and m.conversation_id = new.conversation_id)
       and (select count(distinct m.conversation_id) from public.private_messages m where m.sender_id = v_quien and m.created_at > now() - interval '24 hours') >= 5 then
      raise exception 'Las cuentas nuevas pueden empezar 5 conversaciones el primer día.' using errcode = 'PD403';
    end if;
  end if;
  return new;
end $$;

-- Los disparadores, tabla a tabla (solo donde la tabla existe).
do $$
declare
  r record;
begin
  for r in select * from (values
      ('forum_threads', 'author_id', 3, 15),
      ('forum_posts', 'author_id', 6, 60),
      ('private_messages', 'sender_id', 20, 300),
      ('user_follows', 'follower_id', 20, 200),
      ('content_reports', 'reporter_id', 5, 30)
    ) as t(tabla, col, por_min, por_hora)
  loop
    if to_regclass('public.' || r.tabla) is not null then
      execute format('drop trigger if exists trg_freno_de_ritmo on public.%I', r.tabla);
      execute format('create trigger trg_freno_de_ritmo before insert on public.%I for each row execute function public.freno_de_ritmo(%L, %L, %L)',
                     r.tabla, r.col, r.por_min, r.por_hora);
    end if;
  end loop;
  for r in select * from (values ('forum_threads'), ('forum_posts'), ('private_messages')) as t(tabla) loop
    if to_regclass('public.' || r.tabla) is not null then
      execute format('drop trigger if exists trg_freno_de_cuenta_nueva on public.%I', r.tabla);
      execute format('create trigger trg_freno_de_cuenta_nueva before insert on public.%I for each row execute function public.freno_de_cuenta_nueva()', r.tabla);
    end if;
  end loop;
end $$;

-- 3. Esconder lo que denuncian tres.
alter table public.forum_posts add column if not exists oculto_spam_at timestamptz;

create or replace function public.esconder_si_denuncian()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.content_type <> 'forum_post' then
    return new;
  end if;
  -- Tres personas distintas y con cuenta de más de una semana: tres cuentas
  -- recién hechas no pueden esconder a nadie.
  if (select count(distinct r.reporter_id)
        from public.content_reports r join auth.users u on u.id = r.reporter_id
       where r.content_type = 'forum_post' and r.content_id = new.content_id and r.status = 'pending'
         and u.created_at < now() - interval '7 days') >= 3 then
    -- Lo hace la base, no quien denuncia: la guarda de abajo lo deja pasar.
    perform set_config('pokedoc.esconder_spam', 'si', true);
    update public.forum_posts set oculto_spam_at = now() where id = new.content_id and oculto_spam_at is null;
    perform set_config('pokedoc.esconder_spam', '', true);
  end if;
  return new;
end $$;

drop trigger if exists trg_esconder_si_denuncian on public.content_reports;

create trigger trg_esconder_si_denuncian
  after insert on public.content_reports
  for each row execute function public.esconder_si_denuncian();

-- El autor edita su mensaje, pero no se quita la marca.
create or replace function public.guarda_oculto_spam()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.oculto_spam_at is distinct from old.oculto_spam_at and not public.sin_freno()
     and coalesce(current_setting('pokedoc.esconder_spam', true), '') <> 'si' then
    new.oculto_spam_at := old.oculto_spam_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_guarda_oculto_spam on public.forum_posts;

create trigger trg_guarda_oculto_spam
  before update on public.forum_posts
  for each row execute function public.guarda_oculto_spam();

-- El equipo decide: devolverlo (y cerrar sus denuncias) o borrarlo.
create or replace function public.foro_spam_revisar(p_post uuid, p_borrar boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or not public.sin_freno() then
    raise exception 'Solo el equipo puede revisar esto.' using errcode = '42501';
  end if;
  update public.content_reports set status = 'reviewed'
   where content_type = 'forum_post' and content_id = p_post and status = 'pending';
  if p_borrar then
    delete from public.forum_posts where id = p_post;
  else
    update public.forum_posts set oculto_spam_at = null where id = p_post;
  end if;
  return found;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.foro_spam_revisar(uuid, boolean) from public, anon;
    grant execute on function public.foro_spam_revisar(uuid, boolean) to authenticated;
    grant execute on function public.sin_freno() to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
