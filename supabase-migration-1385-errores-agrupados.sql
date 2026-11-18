-- ─────────────────────────────────────────────────────────────────────
-- LOS ERRORES, AGRUPADOS (tanda 1385).
--
-- PINGU: «tenemos más de 9k errores en el panel de admin, ¿cómo los puedo
-- exportar?… necesito arreglarlos». El panel enseñaba los 50 últimos uno a
-- uno, y casi todos eran el MISMO: «CSP (informe) connect-src:
-- https://ingesteer.services-prod.nsvcs.net», que es la extensión del
-- antivirus (Norton/Avast) llamando a su servidor desde la página. No es
-- nuestro: desde la 1385 la web ya no lo apunta (js/error-log.js,
-- `cspEsNuestra`), y aquí se borra lo que ya hay.
--
--   1. `errores_agrupados(estado)`: un error por fila, con cuántas veces, a
--      cuánta gente, en qué páginas, el primero, el último y una traza. Es
--      de quien llama (security invoker): la RLS de `client_errors` deja
--      leer solo al admin, así que nadie más ve nada.
--   2. `descartar_errores(mensaje)`: «Descartar» un grupo entero de una vez
--      (los nuevos con ese mensaje). También por la RLS: solo el admin.
--   3. Un índice para agrupar sin recorrer la tabla entera cada vez.
--   4. La limpieza: fuera los informes de CSP del antivirus.
--
-- Re-ejecutable y sin tablas temporales (tanda 631).
-- ─────────────────────────────────────────────────────────────────────
begin;

create index if not exists client_errors_estado_mensaje
  on public.client_errors (status, message);

create or replace function public.errores_agrupados(p_estado text default 'new')
returns table (
  mensaje text,
  veces bigint,
  personas bigint,
  paginas text[],
  primero timestamptz,
  ultimo timestamptz,
  traza text
)
language sql
stable
set search_path to 'public'
as $$
  select
    e.message,
    count(*),
    count(distinct coalesce(e.user_id::text, e.user_agent)),
    (array_agg(distinct coalesce(e.page_url, '—')))[1:8],
    min(e.created_at),
    max(e.created_at),
    (array_agg(e.stack order by e.created_at desc) filter (where e.stack is not null))[1]
  from public.client_errors e
  where e.status = coalesce(p_estado, 'new')
  group by e.message
  order by count(*) desc, max(e.created_at) desc
  limit 500
$$;

grant execute on function public.errores_agrupados(text) to authenticated;

create or replace function public.descartar_errores(p_mensaje text)
returns integer
language sql
volatile
set search_path to 'public'
as $$
  with hecho as (
    update public.client_errors
       set status = 'dismissed'
     where status = 'new'
       and message = p_mensaje
    returning 1
  )
  select count(*)::integer from hecho
$$;

grant execute on function public.descartar_errores(text) to authenticated;

-- La limpieza: los informes de CSP de la extensión del antivirus. Solo esos
-- (el dominio exacto); lo demás se queda para mirarlo en el panel.
delete from public.client_errors
 where message like 'CSP%'
   and message like '%nsvcs.net%';

commit;
