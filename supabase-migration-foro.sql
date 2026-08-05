-- ============================================================
-- El foro
-- ============================================================
--
-- POR QUÉ: las guías son un motivo para entrar UNA vez. El foro es un
-- motivo para entrar todos los días aunque no haya nada nuevo publicado.
-- Es lo único que hace que una comunidad pequeña siga viva entre guía y
-- guía.
--
-- LA FORMA es la de un foro clásico: secciones > foros > (subforos) >
-- temas > mensajes. Se ha copiado a propósito, porque es una estructura
-- que la gente ya sabe leer sin que nadie se la explique.
--
-- LO QUE NO SE HA COPIADO es el TAMAÑO. Un foro con veinte cajas vacías
-- comunica "aquí no hay nadie" mucho más fuerte de lo que comunicaría no
-- tener foro. Por eso la estructura vive en la BASE DE DATOS y no en el
-- HTML: se arranca con pocos foros y se abren más desde /admin, sin
-- desplegar nada, el día que un tema ya no quepa en los que hay.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. La estructura: secciones y foros
-- ------------------------------------------------------------

create table if not exists public.forum_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Un subforo es un foro con `parent_id`. Se hace así, y no con una tabla
-- aparte, porque un subforo es exactamente lo mismo que un foro: tiene
-- temas, tiene permisos y puede acabar teniendo hijos. Una tabla
-- `forum_subboards` duplicaría todo esto para no ganar nada.
create table if not exists public.forum_boards (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.forum_sections (id) on delete cascade,
  parent_id uuid references public.forum_boards (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  position integer not null default 0,
  -- Quién puede abrir temas. 'staff' es para Anuncios: todo el mundo lo
  -- lee, solo el equipo escribe.
  post_policy text not null default 'todos' check (post_policy in ('todos', 'staff')),
  -- Un foro preparado pero todavía sin enseñar. Sirve para tenerlo listo
  -- y abrirlo el día que haga falta (Intercambios, sin ir más lejos).
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists forum_boards_section_idx on public.forum_boards (section_id, position);
create index if not exists forum_boards_parent_idx on public.forum_boards (parent_id);

-- ------------------------------------------------------------
-- 2. Temas y mensajes
-- ------------------------------------------------------------

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.forum_boards (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  title text not null,
  -- La etiqueta que va delante del título ([Duda], [Oficial]...). Ordena
  -- una lista larga con muy poco esfuerzo.
  prefix text,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  view_count integer not null default 0,
  -- Desnormalizados y mantenidos por disparador: sin esto, pintar la
  -- lista de temas serían dos consultas por tema.
  post_count integer not null default 0,
  last_post_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists forum_threads_board_idx on public.forum_threads (board_id, is_pinned desc, last_post_at desc);
create index if not exists forum_threads_author_idx on public.forum_threads (author_id);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body_html text not null,
  -- A quién se cita. `on delete set null`: si se borra el mensaje citado,
  -- la respuesta sigue teniendo sentido.
  reply_to_id uuid references public.forum_posts (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists forum_posts_thread_idx on public.forum_posts (thread_id, created_at);
create index if not exists forum_posts_author_idx on public.forum_posts (author_id, created_at desc);

-- "Me gusta". La clave primaria es (mensaje, persona): uno por cabeza.
create table if not exists public.forum_post_likes (
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists forum_post_likes_post_idx on public.forum_post_likes (post_id);

-- ------------------------------------------------------------
-- 3. Contadores
-- ------------------------------------------------------------
-- Se recalculan enteros en vez de sumar y restar. Con este volumen la
-- diferencia de coste no existe, y a cambio un borrado, un movimiento de
-- tema o una fila que entre por otro camino no pueden dejar el contador
-- mintiendo para siempre.
create or replace function public.forum_recontar_tema()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_thread uuid := coalesce(new.thread_id, old.thread_id);
begin
  update forum_threads t
     set post_count = (select count(*) from forum_posts p where p.thread_id = v_thread),
         last_post_at = coalesce(
           (select max(p.created_at) from forum_posts p where p.thread_id = v_thread),
           t.created_at
         )
   where t.id = v_thread;
  return null;
end;
$$;

drop trigger if exists trg_forum_recontar_tema on public.forum_posts;
create trigger trg_forum_recontar_tema
  after insert or delete on public.forum_posts
  for each row execute function public.forum_recontar_tema();

-- Vista para el índice: cada foro con sus números y su último mensaje ya
-- resueltos. Los números INCLUYEN los de sus subforos — si no, un foro
-- que solo sirve de contenedor saldría con 0 temas y parecería muerto.
--
-- `security_invoker = true` NO es opcional: por defecto una vista se
-- consulta con los permisos de QUIEN LA CREÓ, así que sin esto la vista
-- se saltaría las políticas de las tablas de debajo y enseñaría los foros
-- escondidos a cualquiera. Es la trampa clásica de mezclar vistas y RLS.
create or replace view public.forum_boards_resumen
with (security_invoker = true) as
with recursive descendientes as (
  select b.id as board_id, b.id as hijo_id from public.forum_boards b
  union all
  select d.board_id, h.id
    from descendientes d
    join public.forum_boards h on h.parent_id = d.hijo_id
)
select
  b.*,
  coalesce(n.temas, 0) as thread_count,
  coalesce(n.mensajes, 0) as post_count,
  u.last_thread_id,
  u.last_thread_title,
  u.last_post_at,
  u.last_post_author_id
from public.forum_boards b
left join lateral (
  select count(distinct t.id) as temas, count(p.id) as mensajes
    from descendientes d
    join public.forum_threads t on t.board_id = d.hijo_id
    left join public.forum_posts p on p.thread_id = t.id
   where d.board_id = b.id
) n on true
left join lateral (
  select t.id as last_thread_id, t.title as last_thread_title,
         p.created_at as last_post_at, p.author_id as last_post_author_id
    from descendientes d
    join public.forum_threads t on t.board_id = d.hijo_id
    join public.forum_posts p on p.thread_id = t.id
   where d.board_id = b.id
   order by p.created_at desc
   limit 1
) u on true;

-- ------------------------------------------------------------
-- 4. XP por participar
-- ------------------------------------------------------------
-- Abrir un tema da 5, responder da 2.
--
-- Va en un disparador y no en el navegador por lo mismo que el resto del
-- XP: desde el navegador, cualquiera puede escribirse el XP que quiera.
--
-- Y lleva dos frenos, porque aquí NO hay tope natural (a diferencia de
-- "me ha servido", que lo topa una clave primaria):
--
--   1. Un mensaje de menos de 80 caracteres de texto no da nada. Un
--      "gracias" o un "+1" no es participar, y si diera XP el foro se
--      llenaría de eso en una semana.
--   2. Como mucho 10 mensajes al día cuentan. Alguien que escribe de
--      verdad no llega ahí casi nunca; alguien que quiera farmear, sí.
create or replace function public.xp_por_mensaje_de_foro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_texto text;
  v_hoy integer;
  v_abre_tema boolean;
begin
  if new.author_id is null then
    return new;
  end if;

  -- El cuerpo viene en HTML; lo que cuenta es el texto que se lee.
  v_texto := btrim(regexp_replace(coalesce(new.body_html, ''), '<[^>]*>', ' ', 'g'));
  if length(v_texto) < 80 then
    return new;
  end if;

  select count(*) into v_hoy
    from forum_posts p
   where p.author_id = new.author_id
     and p.created_at >= date_trunc('day', now())
     and p.id <> new.id;
  if v_hoy >= 10 then
    return new;
  end if;

  -- El primer mensaje de un tema es el tema. No hace falta guardar quién
  -- lo abrió: es el único mensaje sin otro anterior.
  select not exists (
    select 1 from forum_posts p where p.thread_id = new.thread_id and p.id <> new.id
  ) into v_abre_tema;

  update user_profiles
     set total_xp = coalesce(total_xp, 0) + case when v_abre_tema then 5 else 2 end
   where id = new.author_id;

  return new;
end;
$$;

drop trigger if exists trg_xp_por_mensaje_de_foro on public.forum_posts;
create trigger trg_xp_por_mensaje_de_foro
  after insert on public.forum_posts
  for each row execute function public.xp_por_mensaje_de_foro();

-- Ver un tema suma una visita. Va en una función porque `forum_threads`
-- no deja escribir a quien no es el autor — y menos a quien no ha
-- entrado, que también cuenta como visita.
--
-- La marca de sesión es para que el disparador de moderación de más abajo
-- deje pasar ESTA escritura y solo esta. Sin ella, la regla de "no te
-- infles las visitas" también frenaba a la única función que las cuenta,
-- y el contador se quedaba clavado en cero para siempre. Nadie puede
-- ponerse la marca desde fuera: por la API solo se llega a las funciones
-- publicadas, no a `set_config`.
create or replace function public.forum_ver_tema(p_thread uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform set_config('pokedoc.contando_visita', '1', true);
  update forum_threads set view_count = coalesce(view_count, 0) + 1 where id = p_thread;
  perform set_config('pokedoc.contando_visita', '', true);
end;
$$;

grant execute on function public.forum_ver_tema(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Permisos
-- ------------------------------------------------------------

alter table public.forum_sections enable row level security;
alter table public.forum_boards enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_post_likes enable row level security;

-- La estructura la lee todo el mundo (también quien no ha entrado: el
-- foro tiene que ser visible desde Google). La escribe solo el equipo.
drop policy if exists "forum_sections_select" on public.forum_sections;
create policy "forum_sections_select" on public.forum_sections for select using (true);

drop policy if exists "forum_sections_write" on public.forum_sections;
create policy "forum_sections_write" on public.forum_sections for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "forum_boards_select" on public.forum_boards;
create policy "forum_boards_select" on public.forum_boards
  for select using (not is_hidden or public.is_admin());

drop policy if exists "forum_boards_write" on public.forum_boards;
create policy "forum_boards_write" on public.forum_boards for all
  using (public.is_admin()) with check (public.is_admin());

-- Los temas se leen siempre; se abren en foros que lo permitan, y no si
-- estás baneado o silenciado.
drop policy if exists "forum_threads_select" on public.forum_threads;
create policy "forum_threads_select" on public.forum_threads for select using (true);

drop policy if exists "forum_threads_insert" on public.forum_threads;
create policy "forum_threads_insert" on public.forum_threads
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
    and not public.is_muted()
    and (
      public.is_admin()
      or exists (
        select 1 from public.forum_boards b
         where b.id = board_id and b.post_policy = 'todos' and not b.is_hidden
      )
    )
  );

drop policy if exists "forum_threads_update" on public.forum_threads;
create policy "forum_threads_update" on public.forum_threads
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

-- Borrar un tema con respuestas es borrar los mensajes de otros. El autor
-- solo puede retirar el suyo mientras no haya contestado nadie.
drop policy if exists "forum_threads_delete" on public.forum_threads;
create policy "forum_threads_delete" on public.forum_threads
  for delete using (
    public.is_admin() or (auth.uid() = author_id and post_count <= 1)
  );

-- Fijar, cerrar y mover es cosa del equipo. La política de arriba deja al
-- autor editar SU tema (el título, la etiqueta), así que hace falta esto
-- para que no se fije él solo en lo alto del foro.
create or replace function public.forum_solo_staff_modera()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_admin() then
    new.is_pinned := old.is_pinned;
    new.is_locked := old.is_locked;
    new.board_id := old.board_id;
    -- Las visitas solo las toca forum_ver_tema(), que se anuncia con esta
    -- marca. Si no se hiciera la excepción, la regla frenaría también a
    -- la función y el contador no subiría nunca.
    if coalesce(current_setting('pokedoc.contando_visita', true), '') <> '1' then
      new.view_count := old.view_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_forum_solo_staff_modera on public.forum_threads;
create trigger trg_forum_solo_staff_modera
  before update on public.forum_threads
  for each row execute function public.forum_solo_staff_modera();

drop policy if exists "forum_posts_select" on public.forum_posts;
create policy "forum_posts_select" on public.forum_posts for select using (true);

drop policy if exists "forum_posts_insert" on public.forum_posts;
create policy "forum_posts_insert" on public.forum_posts
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
    and not public.is_muted()
    and (
      public.is_admin()
      or exists (
        select 1 from public.forum_threads t
                 join public.forum_boards b on b.id = t.board_id
         where t.id = thread_id and not t.is_locked and not b.is_hidden
      )
    )
  );

drop policy if exists "forum_posts_update" on public.forum_posts;
create policy "forum_posts_update" on public.forum_posts
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "forum_posts_delete" on public.forum_posts;
create policy "forum_posts_delete" on public.forum_posts
  for delete using (auth.uid() = author_id or public.is_admin());

-- El recuento de "me gusta" es público: sale debajo de cada mensaje.
drop policy if exists "forum_post_likes_select" on public.forum_post_likes;
create policy "forum_post_likes_select" on public.forum_post_likes for select using (true);

-- En tu nombre, y no a ti mismo.
drop policy if exists "forum_post_likes_insert" on public.forum_post_likes;
create policy "forum_post_likes_insert" on public.forum_post_likes
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned()
    and auth.uid() is distinct from (select p.author_id from public.forum_posts p where p.id = post_id)
  );

drop policy if exists "forum_post_likes_delete" on public.forum_post_likes;
create policy "forum_post_likes_delete" on public.forum_post_likes
  for delete using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------
-- 6. Reportar un mensaje del foro
-- ------------------------------------------------------------
-- La lista de tipos que se pueden reportar es una restricción de la
-- tabla, así que hay que ampliarla. Se busca por definición y no por
-- nombre porque la restricción original la puso Postgres con el nombre
-- que le pareció.
do $$
declare cname text;
begin
  if to_regclass('public.content_reports') is null then
    return;
  end if;

  select conname into cname
    from pg_constraint
   where conrelid = 'public.content_reports'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%content_type%';
  if cname is not null then
    execute format('alter table public.content_reports drop constraint %I', cname);
  end if;

  alter table public.content_reports add constraint content_reports_content_type_check
    check (content_type in ('guide', 'profile_comment', 'guide_comment', 'profile_review', 'private_message', 'forum_post'));
end $$;

-- ------------------------------------------------------------
-- 7. La estructura de arranque
-- ------------------------------------------------------------
-- Pocos foros a propósito (ver la cabecera). Se puede cambiar entera
-- desde /admin sin tocar esto.
insert into public.forum_sections (name, position)
select v.name, v.position
  from (values ('Comunidad', 1), ('Colección', 2), ('Café', 3)) as v(name, position)
 where not exists (select 1 from public.forum_sections s where s.name = v.name);

insert into public.forum_boards (section_id, parent_id, name, slug, description, position, post_policy, is_hidden)
select s.id, null, v.name, v.slug, v.description, v.position, v.post_policy, v.is_hidden
  from (values
    ('Comunidad', 'Anuncios', 'anuncios',
     'Novedades de PokeDoc: guías nuevas, cambios y todo lo que hay que saber.', 1, 'staff', false),
    ('Comunidad', 'Presentaciones', 'presentaciones',
     '¿Acabas de llegar? Cuéntanos quién eres y qué coleccionas.', 2, 'todos', false),
    ('Comunidad', 'Sugerencias y fallos', 'sugerencias-y-fallos',
     '¿Se te ocurre algo para la web? ¿Algo no funciona? Por aquí.', 3, 'todos', false),
    ('Colección', '¿Es falsa? ¿Cuánto vale?', 'es-falsa-cuanto-vale',
     'Sube fotos de tu carta y te decimos qué opinamos. La duda más repetida del mundillo.', 1, 'todos', false),
    ('Colección', 'Muestra tu colección', 'muestra-tu-coleccion',
     'Enseña lo que tienes: carpetas, cartas sueltas, la última que has cazado.', 2, 'todos', false),
    ('Colección', 'Intercambios', 'intercambios',
     'Cambios entre coleccionistas.', 3, 'todos', true),
    ('Café', 'General', 'general',
     'Todo lo que no encaja en otro sitio.', 1, 'todos', false)
  ) as v(seccion, name, slug, description, position, post_policy, is_hidden)
  join public.forum_sections s on s.name = v.seccion
 where not exists (select 1 from public.forum_boards b where b.slug = v.slug);

insert into public.forum_boards (section_id, parent_id, name, slug, description, position)
select p.section_id, p.id, v.name, v.slug, null, v.position
  from (values
    ('sugerencias-y-fallos', 'Web', 'web', 1),
    ('sugerencias-y-fallos', 'Contenido', 'contenido', 2),
    ('muestra-tu-coleccion', 'Cartas del mes', 'cartas-del-mes', 1)
  ) as v(padre, name, slug, position)
  join public.forum_boards p on p.slug = v.padre
 where not exists (select 1 from public.forum_boards b where b.slug = v.slug);

comment on table public.forum_boards is
  'Foros y subforos (un subforo es un foro con parent_id). La estructura vive aquí y no en el HTML para poder abrir foros nuevos desde /admin, sin desplegar.';
comment on table public.forum_threads is
  'Temas. post_count y last_post_at los mantiene un disparador que recuenta, para que la lista de temas se pinte con una sola consulta.';

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select s.name, b.name, b.thread_count, b.post_count
--   from forum_boards_resumen b join forum_sections s on s.id = b.section_id
--  order by s.position, b.position;
-- select policyname, cmd from pg_policies where tablename like 'forum_%';
