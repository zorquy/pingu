-- ============================================================
-- Títulos de foro y moderadores
-- ============================================================
--
-- DOS COSAS:
--
--   1. Un TÍTULO por persona, que se enseña bajo su nombre en cada
--      mensaje del foro ("Miembro del equipo", "Perito de falsificaciones",
--      lo que sea). Lo escribe un admin a mano desde /admin. Es puro
--      reconocimiento: no da permisos.
--
--   2. MODERADORES de verdad. Hasta ahora, fijar, cerrar, mover y borrar
--      lo podía hacer solo un admin, y un admin además entra al panel de
--      administración entero. Se necesita una figura intermedia: alguien
--      de confianza que ordene el foro sin tener las llaves de todo.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase, DESPUÉS de
-- supabase-migration-foro.sql. Se puede ejecutar más de una vez.
-- ============================================================

begin;

alter table public.user_profiles add column if not exists forum_title text;
alter table public.user_profiles add column if not exists is_moderator boolean not null default false;

comment on column public.user_profiles.forum_title is
  'Título que se enseña bajo el nombre en el foro. Solo reconocimiento: no concede ningún permiso.';
comment on column public.user_profiles.is_moderator is
  'Puede ordenar el foro (fijar, cerrar, mover, borrar) sin entrar al panel de administración.';

-- "Equipo" = administración o moderación. Se usa en todas las políticas
-- del foro para no tener que repetir la pareja en cada una — y para que
-- el día que haya un tercer rol solo haya que tocar esto.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select is_admin or is_moderator from public.user_profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_staff() to anon, authenticated;

-- ------------------------------------------------------------
-- Las políticas del foro pasan de "solo admin" a "el equipo"
-- ------------------------------------------------------------
-- Se vuelven a declarar enteras (no se pueden "editar" en Postgres). Son
-- las mismas de supabase-migration-foro.sql cambiando is_admin() por
-- is_staff() donde toca.
--
-- Los foros ESCONDIDOS siguen siendo cosa de administración: un foro sin
-- abrir es una decisión de producto, no de moderación.

drop policy if exists "forum_threads_insert" on public.forum_threads;
create policy "forum_threads_insert" on public.forum_threads
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
    and not public.is_muted()
    and (
      public.is_staff()
      or exists (
        select 1 from public.forum_boards b
         where b.id = board_id and b.post_policy = 'todos' and not b.is_hidden
      )
    )
  );

drop policy if exists "forum_threads_update" on public.forum_threads;
create policy "forum_threads_update" on public.forum_threads
  for update using (auth.uid() = author_id or public.is_staff())
  with check (auth.uid() = author_id or public.is_staff());

drop policy if exists "forum_threads_delete" on public.forum_threads;
create policy "forum_threads_delete" on public.forum_threads
  for delete using (
    public.is_staff() or (auth.uid() = author_id and post_count <= 1)
  );

-- Mismo criterio que abajo con los títulos: lo que se escribe sin sesión
-- (SQL Editor, clave de servicio) no se toca. Si no, arreglar un tema a
-- mano desde la consola no tendría efecto y no habría forma de saberlo.
create or replace function public.forum_solo_staff_modera()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.is_pinned := old.is_pinned;
    new.is_locked := old.is_locked;
    new.board_id := old.board_id;
    if coalesce(current_setting('pokedoc.contando_visita', true), '') <> '1' then
      new.view_count := old.view_count;
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "forum_posts_insert" on public.forum_posts;
create policy "forum_posts_insert" on public.forum_posts
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
    and not public.is_muted()
    and (
      public.is_staff()
      or exists (
        select 1 from public.forum_threads t
                 join public.forum_boards b on b.id = t.board_id
         where t.id = thread_id and not t.is_locked and not b.is_hidden
      )
    )
  );

drop policy if exists "forum_posts_update" on public.forum_posts;
create policy "forum_posts_update" on public.forum_posts
  for update using (auth.uid() = author_id or public.is_staff())
  with check (auth.uid() = author_id or public.is_staff());

drop policy if exists "forum_posts_delete" on public.forum_posts;
create policy "forum_posts_delete" on public.forum_posts
  for delete using (auth.uid() = author_id or public.is_staff());

drop policy if exists "forum_post_likes_delete" on public.forum_post_likes;
create policy "forum_post_likes_delete" on public.forum_post_likes
  for delete using (auth.uid() = user_id or public.is_staff());

-- ------------------------------------------------------------
-- Editar un mensaje deja constancia
-- ------------------------------------------------------------
-- La marca la pone la base y no el navegador: si dependiera del cliente,
-- bastaría con no mandarla para editar a escondidas.
--
-- Solo se marca cuando cambia el TEXTO. Un cambio de otra columna (o
-- guardar sin tocar nada) no tiene por qué ensuciar el mensaje con un
-- "editado".
create or replace function public.forum_marcar_editado()
returns trigger
language plpgsql
as $$
begin
  if new.body_html is distinct from old.body_html then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_forum_marcar_editado on public.forum_posts;
create trigger trg_forum_marcar_editado
  before update on public.forum_posts
  for each row execute function public.forum_marcar_editado();

-- ------------------------------------------------------------
-- Cambiar el título o nombrar moderador es cosa de un admin
-- ------------------------------------------------------------
-- `user_profiles` deja que cada cual edite SU fila, así que sin esto
-- cualquiera podría ponerse "Miembro del equipo" — o nombrarse moderador,
-- que ya sería grave.
--
-- `auth.uid() is not null` no es un detalle: sin eso, el disparador
-- revertiría TAMBIÉN lo que se escribe desde el SQL Editor o con la clave
-- de servicio, donde no hay nadie identificado. Nombrar un moderador a
-- mano no habría funcionado, y encima sin dar ningún error. Los frenos son
-- para la API, no para la consola.
create or replace function public.solo_admin_da_titulos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.forum_title := old.forum_title;
    new.is_moderator := old.is_moderator;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solo_admin_da_titulos on public.user_profiles;
create trigger trg_solo_admin_da_titulos
  before update on public.user_profiles
  for each row execute function public.solo_admin_da_titulos();

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select username, forum_title, is_moderator, is_admin from user_profiles
--  where forum_title is not null or is_moderator or is_admin;
