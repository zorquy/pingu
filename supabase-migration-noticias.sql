-- ════════════════════════════════════════════════════════════════════
-- Noticias (tanda 269)
--
-- PokeDoc empieza a publicar noticias: revelaciones de cartas, sets,
-- torneos. En español, que es donde no hay nada.
--
-- Una noticia NO es una cosa nueva: es exactamente un artículo, con su
-- portada, su índice y su editor. Lo único que cambia es que se ordena
-- por fecha, que vive en su propia sección y que Google la tiene que
-- entender como noticia y no como guía.
--
-- Por eso no hay tabla nueva. Una columna que diga qué es cada fila, y
-- ya: así el editor, la búsqueda, los guardados, el sitemap, la vista
-- previa al compartir y los avisos funcionan desde el primer día sin
-- tocar nada.
--
-- Ejecutar en el SQL Editor de Supabase. No borra ni cambia nada de lo
-- que ya hay: todo lo publicado hasta hoy es una guía.
-- ════════════════════════════════════════════════════════════════════

-- 1. Qué es cada fila ────────────────────────────────────────────────
--
-- `default 'guide'` es lo que hace que esto no rompa nada: las guías que
-- ya existen se quedan como guías sin tener que tocarlas, y cualquier
-- inserción vieja que no mande `kind` sigue creando una guía.
alter table public.guides
  add column if not exists kind text not null default 'guide';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'guides_kind_valido'
  ) then
    alter table public.guides
      add constraint guides_kind_valido check (kind in ('guide', 'news'));
  end if;
end $$;

comment on column public.guides.kind is
  'guide = guía o curso (lo de siempre); news = noticia. Decide en qué '
  'sección sale, cómo se ordena y qué datos estructurados se le ponen.';

-- 2. El índice de la portada de noticias ─────────────────────────────
--
-- La consulta de /noticias es siempre la misma: las noticias publicadas,
-- de la más nueva a la más vieja. Sin índice, eso es recorrer la tabla
-- entera de guías y cursos para quedarse con un puñado de filas — y esa
-- es la página que más se va a pedir del sitio.
--
-- El índice es PARCIAL (`where`) a propósito: solo apunta a las filas que
-- esa consulta mira. Ocupa lo que ocupan las noticias, no la tabla.
create index if not exists guides_noticias_idx
  on public.guides (published_at desc)
  where kind = 'news' and published_at is not null;

-- Y el espejo para los listados de guías, que ahora llevan un filtro más
-- (`kind = 'guide'`) del que antes no tenían.
create index if not exists guides_guias_idx
  on public.guides (published_at desc)
  where kind = 'guide' and published_at is not null;

-- 3. Quién puede publicar una noticia ────────────────────────────────
--
-- Las guías las escribe la comunidad y pasan por revisión. Una noticia
-- firma en nombre de PokeDoc, así que **solo administración**.
--
-- Y esto va en la BASE, no en el JavaScript: un `if` en el cliente no
-- protege nada —la petición a la API llega igual— y aquí se trata de
-- quién puede hablar en nombre del sitio. Mismo patrón que
-- `is_official` de los torneos (tanda 266): un disparador devuelve la
-- fila a su sitio en vez de dar un error que nadie ve.
create or replace function public.guides_solo_admin_publica_noticias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  soy_admin boolean;
begin
  -- Nada que vigilar si no se está tocando el tipo.
  if tg_op = 'UPDATE' and new.kind is not distinct from old.kind then
    return new;
  end if;
  if new.kind = 'guide' then
    return new;
  end if;

  select coalesce(p.is_admin, false) into soy_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(soy_admin, false) then
    return new;
  end if;

  -- Quien no es del equipo no convierte nada en noticia: se queda como
  -- estaba (o como guía, si la está creando).
  new.kind := case when tg_op = 'UPDATE' then old.kind else 'guide' end;
  return new;
end $$;

drop trigger if exists guides_solo_admin_publica_noticias on public.guides;
create trigger guides_solo_admin_publica_noticias
  before insert or update on public.guides
  for each row execute function public.guides_solo_admin_publica_noticias();

-- 4. Cuándo se tocó por última vez ───────────────────────────────────
--
-- Una noticia no se publica y ya: se corrige, se amplía cuando revelan
-- dos cartas más, se arregla un nombre. `dateModified` es lo que le dice
-- a Google que lo que hay ahora no es lo de esta mañana, y sin columna
-- que lo guarde no hay forma de decirlo.
--
-- Vale para las guías igual: una guía revisada este mes debería poder
-- decirlo.
alter table public.guides
  add column if not exists updated_at timestamptz;

create or replace function public.guides_marca_actualizacion()
returns trigger
language plpgsql
as $$
begin
  -- Solo si cambia algo que se lee. Tocar `view_count` en cada visita no
  -- es «actualizar el artículo», y sin esta condición cualquier visita
  -- haría parecer que la noticia se acaba de reescribir.
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.description is not distinct from old.description
     and new.reference_blocks is not distinct from old.reference_blocks
     and new.blocks is not distinct from old.blocks
     and new.cover_image is not distinct from old.cover_image then
    return new;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guides_marca_actualizacion on public.guides;
create trigger guides_marca_actualizacion
  before insert or update on public.guides
  for each row execute function public.guides_marca_actualizacion();

-- 5. Que la API se entere de las columnas nuevas ─────────────────────
--
-- Sin esto, `kind` y `updated_at` no existen para PostgREST hasta que se
-- reinicie solo:
-- las consultas que la filtran fallan y el sitio se queda sin noticias
-- Y sin guías.
notify pgrst, 'reload schema';
