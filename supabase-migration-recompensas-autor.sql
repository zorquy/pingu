-- ============================================================
-- Recompensar a quien escribe guías
-- ============================================================
--
-- EL PROBLEMA
--
-- Escribir una guía era tirarla a un pozo. `guides.view_count` se
-- incrementaba en cada visita y NO se enseñaba en ningún sitio: el autor
-- no sabía si su guía la habían leído 3 personas o 300. Tampoco veía
-- cuánta gente la había guardado, ni si alguien la había comentado. Se
-- ganaba XP una vez, al aprobarla, y a partir de ahí silencio.
--
-- Eso es lo que hace que nadie escriba la segunda.
--
-- QUÉ AÑADE ESTO
--
--   1. `guide_helpful` — el botón "me ha servido". Un clic, sin escribir
--      y sin juzgar. Es distinto de las estrellas a propósito: las
--      estrellas son un juicio ("te pongo un 4") y cuestan pensar; esto
--      es un agradecimiento.
--
--   2. `guide_author_stats()` — los números de TUS guías, de una sola
--      consulta: lecturas, guardados, comentarios, valoración y
--      agradecimientos.
--
--   3. XP al autor cada vez que alguien lee su guía o se lo agradece.
--      Antes el XP se cobraba una vez y ya; ahora una guía buena sigue
--      dando durante meses, que es lo que premia escribir bien en vez de
--      escribir mucho.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. "Me ha servido"
-- ------------------------------------------------------------
-- La clave primaria es (guide_id, user_id): una persona agradece una
-- guía UNA vez. Eso también es lo que hace que el XP de abajo no se
-- pueda inflar dando clics.
create table if not exists public.guide_helpful (
  guide_id uuid not null references public.guides (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guide_id, user_id)
);

create index if not exists guide_helpful_guide_idx on public.guide_helpful (guide_id);
create index if not exists guide_helpful_user_idx on public.guide_helpful (user_id);

alter table public.guide_helpful enable row level security;

-- El recuento es público: sale en la guía, al lado del botón.
drop policy if exists "guide_helpful_select" on public.guide_helpful;
create policy "guide_helpful_select" on public.guide_helpful
  for select using (true);

-- Solo puedes agradecer en tu nombre, y no tu propia guía: aplaudirse a
-- uno mismo no es una señal de nada.
drop policy if exists "guide_helpful_insert" on public.guide_helpful;
create policy "guide_helpful_insert" on public.guide_helpful
  for insert with check (
    auth.uid() = user_id
    and auth.uid() is distinct from (select g.author_id from public.guides g where g.id = guide_id)
  );

drop policy if exists "guide_helpful_delete" on public.guide_helpful;
create policy "guide_helpful_delete" on public.guide_helpful
  for delete using (auth.uid() = user_id);

comment on table public.guide_helpful is
  'Agradecimientos a una guía ("me ha servido"). Uno por persona y guía. Distinto de guide_reviews, que es una valoración con nota.';

-- ------------------------------------------------------------
-- 2. Los números de mis guías
-- ------------------------------------------------------------
-- Una sola consulta en vez de cinco desde el navegador.
--
-- Va como SECURITY DEFINER por una razón concreta: los guardados viven
-- en `user_profiles.saved_guides` (un array por persona), así que
-- contarlos obliga a recorrer la tabla de perfiles entera. Con los
-- permisos de quien llama eso sería, además de lento, una forma rara de
-- pasearse por los datos de los demás. Aquí dentro se cuenta y se
-- devuelve solo el número.
--
-- Y como es SECURITY DEFINER, lo primero que hace es comprobar que quien
-- pregunta es el autor (o un admin). Sin esa comprobación, cualquiera
-- podría pedir las estadísticas de cualquiera.
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
    (select count(*) from user_profiles p where g.id = any (p.saved_guides)),
    (select count(*) from guide_comments c where c.guide_id = g.id),
    (select count(*) from guide_helpful h where h.guide_id = g.id),
    (select count(*) from guide_reviews r where r.guide_id = g.id),
    (select round(avg(r.rating)::numeric, 1) from guide_reviews r where r.guide_id = g.id)
  from guides g
  where g.author_id = p_author
    and (auth.uid() = p_author or public.is_admin())
  order by g.published_at desc nulls first, g.created_at desc
$$;

comment on function public.guide_author_stats(uuid) is
  'Números de las guías de un autor. Solo se los puede pedir él mismo (o un admin).';

-- ------------------------------------------------------------
-- 3. XP al autor por ser leído y por ser útil
-- ------------------------------------------------------------
-- POR QUÉ EN LA BASE Y NO EN EL NAVEGADOR: el XP del resto de la web lo
-- suma el cliente (lee total_xp y escribe total_xp + n). Para el XP
-- propio eso ya es flojo, pero para el XP que te dan OTROS sería
-- regalado: bastaría con llamar a la API a mano. Aquí lo suma Postgres
-- cuando ocurre el hecho, y el cliente no interviene.
--
-- NO HACE FALTA UN TOPE DIARIO: el tope es más fuerte que eso. Una
-- persona solo puede marcar una guía como leída una vez (índice único de
-- user_progress) y solo puede agradecerla una vez (clave primaria de
-- guide_helpful). Para inflar el contador harían falta cuentas nuevas,
-- no clics.
create or replace function public.dar_xp_al_autor(p_guia uuid, p_quien uuid, p_xp integer)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_autor uuid;
begin
  select author_id into v_autor from guides where id = p_guia;
  -- Sin autor (guía oficial) no hay a quién dárselo; y nadie se da XP a
  -- sí mismo leyendo lo suyo.
  if v_autor is null or v_autor = p_quien then
    return;
  end if;
  update user_profiles set total_xp = coalesce(total_xp, 0) + p_xp where id = v_autor;
end;
$$;

-- Lectura: +2 XP. Salta cuando `read_at` pasa de vacío a puesto, no en
-- cada actualización de la fila (que se toca también al hacer el curso).
create or replace function public.xp_autor_por_lectura()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.read_at is not null and (tg_op = 'INSERT' or old.read_at is null) then
    perform public.dar_xp_al_autor(new.guide_id, new.user_id, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_xp_autor_por_lectura on public.user_progress;
create trigger trg_xp_autor_por_lectura
  after insert or update of read_at on public.user_progress
  for each row execute function public.xp_autor_por_lectura();

-- Agradecimiento: +5 XP. Vale más que una lectura porque cuesta un acto
-- deliberado.
create or replace function public.xp_autor_por_agradecimiento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.dar_xp_al_autor(new.guide_id, new.user_id, 5);
  return new;
end;
$$;

drop trigger if exists trg_xp_autor_por_agradecimiento on public.guide_helpful;
create trigger trg_xp_autor_por_agradecimiento
  after insert on public.guide_helpful
  for each row execute function public.xp_autor_por_agradecimiento();

-- El XP quitado al retirar un agradecimiento NO se devuelve a propósito:
-- restar XP a alguien por algo que hizo otro se vive como un castigo, y
-- el saldo importa mucho menos que la sensación.

commit;

-- ------------------------------------------------------------
-- 4. Que PostgREST se entere de la tabla y la función nuevas
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional)
-- ------------------------------------------------------------
-- select * from public.guide_author_stats(auth.uid());
-- select tablename, policyname, cmd from pg_policies where tablename = 'guide_helpful';
