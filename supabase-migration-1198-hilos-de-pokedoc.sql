-- Tanda 1198 — Los hilos de los eventos los firma PokeDoc (PINGU: «el hilo
-- que se cree en el foro… que esté creado por PokeDoc, como las noticias…
-- para que no salga creado por mí»), y el hilo índice de «Eventos y
-- quedadas» para que la gente cuente los eventos que conoce.
--
-- Cómo se firma «PokeDoc»: igual que una noticia sin autor, el hilo y su
-- PRIMER mensaje van sin `author_id`, y el hilo lleva `de_pokedoc`. La web
-- pinta «PokeDoc» (con el logo y sin enlace a un perfil) en el primer mensaje
-- sin autor de un hilo `de_pokedoc`; lo demás sin autor sigue siendo una
-- cuenta borrada («Alguien»).
--
-- Nadie se puede poner la marca a sí mismo: `de_pokedoc` exige un hilo SIN
-- autor (la restricción de abajo), y un hilo sin autor solo lo crea la base
-- (las políticas piden `auth.uid() = author_id`). Por eso lo abre y lo pone
-- al día `evento_hilo`, que es `security definer` y solo para el admin.
--
-- Se puede ejecutar dos veces; cada sentencia vale por sí sola (la 631).

alter table public.forum_threads add column if not exists de_pokedoc boolean not null default false;

-- La restricción, una sola vez (un `add constraint` repetido falla).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'forum_threads_de_pokedoc_sin_autor') then
    alter table public.forum_threads
      add constraint forum_threads_de_pokedoc_sin_autor check (not de_pokedoc or author_id is null);
  end if;
end;
$$;

-- Abre (o pone al día) el hilo de un evento, firmado por PokeDoc. Devuelve
-- el id del hilo. Si el evento ya tenía un hilo abierto a mano (los de la
-- 1197 los abría la cuenta de quien guardaba), lo pasa a PokeDoc: el hilo y
-- su primer mensaje se quedan sin autor.
create or replace function public.evento_hilo(p_evento uuid, p_titulo text, p_cuerpo text, p_prefijo text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hilo uuid;
  v_foro uuid;
  v_primero uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo abre los hilos de los eventos' using errcode = '42501';
  end if;
  if coalesce(btrim(p_titulo), '') = '' or coalesce(btrim(p_cuerpo), '') = '' then
    raise exception 'Falta el título o el mensaje del hilo' using errcode = '22023';
  end if;

  select e.hilo_id into v_hilo from eventos e where e.id = p_evento;
  if not found then
    raise exception 'Ese evento no existe' using errcode = 'P0002';
  end if;
  if v_hilo is not null and not exists (select 1 from forum_threads t where t.id = v_hilo) then
    v_hilo := null;
  end if;

  if v_hilo is not null then
    select p.id into v_primero from forum_posts p where p.thread_id = v_hilo order by p.created_at, p.id limit 1;
    update forum_posts set author_id = null, body_html = p_cuerpo where id = v_primero;
    update forum_threads t
       set title = left(p_titulo, 150),
           prefix = coalesce(p_prefijo, t.prefix),
           author_id = null,
           de_pokedoc = true,
           last_post_author_id = case when t.post_count <= 1 then null else t.last_post_author_id end
     where t.id = v_hilo;
    return v_hilo;
  end if;

  select b.id into v_foro from forum_boards b where b.slug = 'eventos';
  if v_foro is null then
    raise exception 'Falta el foro «Eventos y quedadas» (supabase-migration-1197-eventos-foro.sql)' using errcode = 'P0002';
  end if;
  insert into forum_threads (board_id, author_id, title, prefix, de_pokedoc)
  values (v_foro, null, left(p_titulo, 150), p_prefijo, true)
  returning id into v_hilo;
  insert into forum_posts (thread_id, author_id, body_html) values (v_hilo, null, p_cuerpo);
  update eventos set hilo_id = v_hilo where id = p_evento;
  return v_hilo;
end;
$$;

revoke all on function public.evento_hilo(uuid, text, text, text) from public;
grant execute on function public.evento_hilo(uuid, text, text, text) to authenticated;

-- Los hilos que ya abrió la 1197 con la cuenta de quien guardaba: a PokeDoc.
-- Primero el mensaje (sin autor) y después el hilo, que es donde está la
-- restricción.
update public.forum_posts p
   set author_id = null
 where p.id in (
   select distinct on (x.thread_id) x.id
     from public.forum_posts x
    where x.thread_id in (select e.hilo_id from public.eventos e where e.hilo_id is not null)
    order by x.thread_id, x.created_at, x.id
 );

update public.forum_threads t
   set author_id = null,
       de_pokedoc = true,
       last_post_author_id = case when t.post_count <= 1 then null else t.last_post_author_id end
 where t.id in (select e.hilo_id from public.eventos e where e.hilo_id is not null)
   and not t.de_pokedoc;

-- El hilo índice de «Eventos y quedadas», fijado y firmado por PokeDoc: aquí
-- la gente cuenta los eventos que conoce y el equipo los da de alta en
-- /eventos. Se busca por su título para no abrirlo dos veces.
insert into public.forum_threads (board_id, author_id, title, prefix, is_pinned, de_pokedoc)
select b.id, null, 'Índice de eventos: cuéntanos los que conozcas', 'Agenda', true, true
  from public.forum_boards b
 where b.slug = 'eventos'
   and not exists (
     select 1 from public.forum_threads t
      where t.board_id = b.id and t.title = 'Índice de eventos: cuéntanos los que conozcas'
   );

insert into public.forum_posts (thread_id, author_id, body_html)
select t.id, null,
       '<p>¡Hola! Estamos montando la agenda de Pokémon TCG en España: card shows, quedadas, trade nights, torneos de tienda… Todo lo que nos contéis en este hilo lo añadimos a <a href="https://pokedoc.es/eventos">pokedoc.es/eventos</a>, con su ficha, su «Voy» para que se vea quién va y su propio hilo en este foro.</p>'
       || '<p><strong>Si organizas un evento o sabes de uno, deja un mensaje con:</strong></p>'
       || '<ul><li>El nombre y qué es: card show, quedada, trade night, torneo…</li>'
       || '<li>Los días y el horario.</li>'
       || '<li>Dónde: el sitio, la dirección y la ciudad.</li>'
       || '<li>Las entradas y su precio (y si es gratis, dilo).</li>'
       || '<li>La web o el Instagram, y el logo o el cartel si lo tienes.</li></ul>'
       || '<p>Lo revisamos, lo damos de alta y te contestamos aquí cuando esté publicado. Si un evento cambia de fecha o se cancela, avísanos también en este hilo.</p>'
       || '<p><a href="https://pokedoc.es/eventos">https://pokedoc.es/eventos</a></p>'
  from public.forum_threads t
  join public.forum_boards b on b.id = t.board_id
 where b.slug = 'eventos'
   and t.title = 'Índice de eventos: cuéntanos los que conozcas'
   and not exists (select 1 from public.forum_posts p where p.thread_id = t.id);

-- El índice del foro: la misma `foro_resumen()` de la 1017 con UNA clave más,
-- `pokedoc`: los foros cuyo último mensaje es el primero de un hilo de
-- PokeDoc (sin autor). Sin ella, el recuadro de «Eventos y quedadas» diría
-- «Alguien» al lado del hilo recién abierto.
create or replace function public.foro_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hasta timestamptz := (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid);
  v jsonb;
begin
  with foros as (
    select f.* from public.forum_boards_resumen f where not coalesce(f.is_hidden, false)
  ),
  sin_leer as (
    select t.board_id, count(*)::int as n
      from public.forum_threads t
      left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
     where v_uid is not null and t.last_post_at is not null
       and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
       and t.last_post_at > coalesce(greatest(r.last_read_at, v_hasta), '-infinity'::timestamptz)
     group by t.board_id
  ),
  perfiles as (
    select u.id, u.username, u.display_name, u.avatar_url, u.level, u.total_xp, u.hide_activity, u.is_admin, u.is_moderator
      from public.user_profiles u
     where u.id in (select f.last_post_author_id from foros f where f.last_post_author_id is not null)
  )
  select jsonb_build_object(
    'secciones', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.forum_sections s), '[]'::jsonb),
    'foros', coalesce((select jsonb_agg(to_jsonb(f) order by f.position) from foros f), '[]'::jsonb),
    'nuevos', coalesce((select jsonb_object_agg(x.board_id::text, x.n) from sin_leer x), '{}'::jsonb),
    'perfiles', coalesce((select jsonb_object_agg(p.id::text, to_jsonb(p)) from perfiles p), '{}'::jsonb),
    'pokedoc', coalesce((select jsonb_agg(f.id) from foros f join public.forum_threads t on t.id = f.last_thread_id
                          where f.last_post_author_id is null and t.de_pokedoc and t.post_count <= 1), '[]'::jsonb),
    'rol', (select jsonb_build_object('staff', coalesce(u.is_admin, false) or coalesce(u.is_moderator, false), 'admin', coalesce(u.is_admin, false))
              from public.user_profiles u where u.id = v_uid),
    'marcas', v_uid is not null
  ) into v;
  return v;
end;
$$;

revoke all on function public.foro_resumen() from public;

grant execute on function public.foro_resumen() to anon, authenticated;

notify pgrst, 'reload schema';
