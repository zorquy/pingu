-- ============================================================
-- Migración (tanda 821, VE6): lo que tarda DE VERDAD cada página en los
-- móviles de la gente. Una fila por visita medida (una de cada cuatro):
-- la página, LCP e INP en milisegundos, CLS por mil y si era un móvil. Sin
-- cookies, sin terceros y sin quién: no lleva user_id.
-- Cada sentencia va por su lado (la 631): nada de tablas temporales.
-- ============================================================

create table if not exists page_vitals (
  id uuid primary key default gen_random_uuid(),
  path text not null check (char_length(path) <= 200),
  lcp_ms integer check (lcp_ms between 0 and 120000),
  inp_ms integer check (inp_ms between 0 and 60000),
  cls_mil integer check (cls_mil between 0 and 100000),
  movil boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists page_vitals_created_at_idx on page_vitals (created_at);

alter table page_vitals enable row level security;

-- Como page_views: cualquiera apunta, solo el equipo lee.
drop policy if exists "page_vitals_insert_anyone" on page_vitals;
create policy "page_vitals_insert_anyone" on page_vitals
  for insert to anon, authenticated with check (true);

drop policy if exists "page_vitals_admin_select" on page_vitals;
create policy "page_vitals_admin_select" on page_vitals
  for select to authenticated using (is_admin());

grant insert on page_vitals to anon, authenticated;
grant select on page_vitals to authenticated;

-- El resumen para /admin: el percentil 75 por página (lo que mira Google) en
-- los últimos N días. Lo hace la base: contar a mano en el navegador se
-- quedaría en las 1.000 primeras filas (la 808). Va con los permisos de
-- quien llama, así que solo contesta al equipo.
create or replace function vitales_resumen(p_dias integer default 7)
returns table (path text, visitas bigint, lcp_p75 integer, inp_p75 integer, cls_p75 numeric, movil_pct integer)
language sql stable security invoker
set search_path = public
as $$
  select
    v.path,
    count(*) as visitas,
    (percentile_cont(0.75) within group (order by v.lcp_ms))::integer as lcp_p75,
    (percentile_cont(0.75) within group (order by v.inp_ms))::integer as inp_p75,
    round((percentile_cont(0.75) within group (order by v.cls_mil))::numeric / 1000, 3) as cls_p75,
    (100 * avg(case when v.movil then 1 else 0 end))::integer as movil_pct
  from page_vitals v
  where v.created_at > now() - make_interval(days => greatest(1, least(p_dias, 90)))
  group by v.path
  order by count(*) desc
  limit 50
$$;

grant execute on function vitales_resumen(integer) to authenticated;

notify pgrst, 'reload schema';
