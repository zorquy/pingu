-- ============================================================
-- Búsqueda que no distingue acentos
-- ============================================================
--
-- EL PROBLEMA
--
-- El buscador usa `ilike`, que ignora mayúsculas pero NO acentos: en
-- Postgres 'falsificacion' no encuentra 'falsificación'. En español eso
-- es medio buscador roto — nadie escribe los acentos en un buscador.
--
-- Hasta ahora se esquivaba a mano: en `guides.search_content` el texto se
-- escribía sin acentos ("nucleo negro") para que el ilike lo pillara. Eso
-- funciona mientras las guías las escriba quien conoce el truco; en
-- cuanto las escribe la comunidad, deja de funcionar. Y además obliga a
-- que ese campo esté mal escrito, así que no vale para enseñarlo.
--
-- LA SOLUCIÓN
--
-- Una columna generada por Postgres con el texto plegado (sin acentos y
-- en minúsculas). El cliente pliega igual lo que escribe la persona y
-- busca ahí. Las columnas originales no se tocan: se siguen enseñando
-- con sus acentos.
--
-- POR QUÉ NO BÚSQUEDA DE TEXTO COMPLETO (to_tsvector): cambiaría lo que
-- significa buscar. Hoy "falsi" encuentra "falsificación" porque busca un
-- trozo dentro de la palabra; el texto completo busca palabras enteras y
-- raíces, y dejaría de encontrarlo. Esto arregla los acentos sin cambiar
-- nada más.
--
-- CÓMO EJECUTARLO: pégalo entero en el SQL Editor de Supabase. Se puede
-- ejecutar más de una vez sin romper nada.
-- ============================================================

-- `extensions` es el esquema donde Supabase guarda las extensiones. Si ya
-- estuvieran instaladas en `public` (proyectos antiguos), el `if not
-- exists` las deja donde están y todo lo de abajo sigue valiendo, porque
-- se llaman sin nombrar el esquema.
create schema if not exists extensions;
set search_path = public, extensions;

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ------------------------------------------------------------
-- 1. Plegar texto (quitar acentos + minúsculas)
-- ------------------------------------------------------------
--
-- Postgres exige que una columna generada use una función IMMUTABLE, y
-- `unaccent()` a secas es STABLE: depende del diccionario, que en teoría
-- se puede cambiar. Se envuelve nombrando el diccionario explícitamente,
-- que es la forma habitual de dejarla inmutable de verdad.
--
-- Consecuencia a tener presente: si algún día se cambiara el diccionario
-- `unaccent`, las columnas ya calculadas NO se recalculan solas; habría
-- que forzarlo. No es algo que vaya a pasar en este proyecto.
create or replace function public.plegar_texto(txt text)
returns text
language sql
immutable
parallel safe
strict
set search_path = extensions, public, pg_catalog
as $$
  select lower(unaccent('unaccent'::regdictionary, txt))
$$;

comment on function public.plegar_texto(text) is
  'Texto sin acentos y en minúsculas, para buscar. El equivalente en el navegador es plegarTexto() de js/texto.js: los dos tienen que dar lo mismo.';

-- ------------------------------------------------------------
-- 2. Guías: título + descripción + texto del buscador
-- ------------------------------------------------------------
alter table public.guides
  add column if not exists search_norm text
  generated always as (
    public.plegar_texto(
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(search_content, '')
    )
  ) stored;

comment on column public.guides.search_norm is
  'Columna GENERADA: no la escribas nunca desde el cliente. Es title+description+search_content plegado para que el buscador encuentre "falsificacion" cuando la guía dice "falsificación".';

-- Índice trigram para que `ilike '%algo%'` no acabe leyendo la tabla
-- entera. Con las guías que hay hoy daría igual, pero el índice no
-- estorba y el día que haya cientos ya está puesto.
create index if not exists guides_search_norm_trgm_idx
  on public.guides using gin (search_norm gin_trgm_ops);

-- ------------------------------------------------------------
-- 3. Perfiles: nombre visible + nombre de usuario
-- ------------------------------------------------------------
-- Buscar "jesus" tiene que encontrar a "Jesús" tanto en el directorio de
-- la comunidad como al empezar un mensaje privado.
alter table public.user_profiles
  add column if not exists search_norm text
  generated always as (
    public.plegar_texto(coalesce(display_name, '') || ' ' || coalesce(username, ''))
  ) stored;

comment on column public.user_profiles.search_norm is
  'Columna GENERADA: no la escribas nunca desde el cliente. display_name+username plegado, para buscar personas sin escribir los acentos.';

create index if not exists user_profiles_search_norm_trgm_idx
  on public.user_profiles using gin (search_norm gin_trgm_ops);

-- ------------------------------------------------------------
-- 4. Que PostgREST se entere de las columnas nuevas
-- ------------------------------------------------------------
-- Supabase lo suele hacer solo, pero si el buscador siguiera sin ver la
-- columna, esto lo arregla sin reiniciar nada.
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Comprobación rápida (opcional): las dos deben devolver la guía.
-- ------------------------------------------------------------
-- select title from public.guides where search_norm ilike '%falsificacion%';
-- select title from public.guides where search_norm ilike '%falsificación%';
--   ^ la segunda NO la encuentra, y es correcto: el cliente pliega
--     también lo que escribe la persona antes de consultar, así que a la
--     base nunca le llega un acento. Ver js/search.js.
