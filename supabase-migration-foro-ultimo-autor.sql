-- ============================================================
-- Quién escribió el último mensaje de un tema
-- ============================================================
--
-- EL PROBLEMA
--
-- En la lista de temas de un foro, la columna de la derecha decía:
--
--     Ir al último
--     hace 13 h · Alguien
--
-- "Alguien" es el texto de respaldo de `nombreDe()` para cuando no se
-- sabe de quién es un perfil. Y no se sabía porque `forum_threads`
-- guarda CUÁNDO fue el último mensaje (`last_post_at`) pero no DE QUIÉN,
-- así que la lista pasaba `perfil: null` y se pintaba el respaldo.
--
-- Sale hasta en los temas sin respuestas, donde el último mensaje es el
-- primero y su autor es justo quien abrió el tema. Ahí quedaba
-- especialmente raro: el nombre estaba a dos centímetros, en la misma
-- fila.
--
-- QUÉ HACE ESTO
--
-- Añade `forum_threads.last_post_author_id` y lo mantiene el MISMO
-- disparador que ya mantenía `post_count` y `last_post_at`. Es la
-- solución barata: la alternativa era, al pintar la lista, pedir el
-- último mensaje de cada uno de los veinte temas de la página.
--
-- `forum_boards_resumen` ya resolvía esto para los foros (tiene su
-- `last_post_author_id`); esto es lo mismo un nivel más abajo.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada. Requiere haber ejecutado
-- antes supabase-migration-foro.sql.
-- ============================================================

begin;

alter table public.forum_threads
  add column if not exists last_post_author_id uuid references auth.users (id) on delete set null;

comment on column public.forum_threads.last_post_author_id is
  'Autor del último mensaje. Desnormalizado y mantenido por forum_recontar_tema(), igual que post_count y last_post_at.';

-- El disparador de siempre, ahora también con el autor. Se reescribe
-- entero (create or replace) en vez de tocarlo por partes: así esta
-- migración deja la función en un estado conocido aunque se ejecute
-- sobre una base donde ya estuviera a medias.
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
         ),
         -- El autor del más reciente. Si no queda ninguno (se borraron
         -- todos), se cae al autor del tema, que es lo que hay.
         last_post_author_id = coalesce(
           (select p.author_id from forum_posts p
             where p.thread_id = v_thread
             order by p.created_at desc
             limit 1),
           t.author_id
         )
   where t.id = v_thread;
  return null;
end;
$$;

drop trigger if exists trg_forum_recontar_tema on public.forum_posts;
create trigger trg_forum_recontar_tema
  after insert or delete on public.forum_posts
  for each row execute function public.forum_recontar_tema();

-- Los temas que ya existen: el disparador solo se dispara al escribir,
-- así que hay que rellenarlos a mano una vez.
update public.forum_threads t
   set last_post_author_id = coalesce(
         (select p.author_id from public.forum_posts p
           where p.thread_id = t.id
           order by p.created_at desc
           limit 1),
         t.author_id
       )
 where t.last_post_author_id is null;

commit;

-- ============================================================
-- Comprobación (opcional): ningún tema con mensajes debería quedarse sin
-- autor del último.
-- ============================================================
-- select count(*) as temas_sin_autor_del_ultimo
--   from public.forum_threads
--  where last_post_author_id is null and post_count > 0;

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
