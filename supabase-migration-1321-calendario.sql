-- Tanda 1321 — Tu calendario de PokeDoc en el del móvil (P7 del plan).
--
-- Cada persona tiene una dirección SECRETA (`/cal/<clave>.ics`) a la que se
-- suscribe Google Calendar o el del iPhone una vez, y se actualiza sola: sus
-- torneos y las jornadas de sus ligas, los eventos a los que dijo «Voy» y,
-- si quiere, los lanzamientos. Quien tiene la dirección ve ese calendario, así
-- que la clave es larga (64 cifras al azar) y se puede cambiar.
--
-- Nadie lee la tabla desde la web: todo pasa por estas funciones. La que
-- arma el calendario (`calendario_de`) la llama la función de Netlify sin
-- cuenta, con la clave como única llave.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.calendario_claves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  clave text not null unique,
  torneos boolean not null default true,
  eventos boolean not null default true,
  lanzamientos boolean not null default false,
  creada_at timestamptz not null default now()
);

alter table public.calendario_claves enable row level security;

create or replace function public.calendario_clave_nueva()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- La tuya (la crea la primera vez).
create or replace function public.calendario_mio()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v public.calendario_claves;
begin
  if auth.uid() is null then
    raise exception 'Hay que entrar en tu cuenta.';
  end if;
  insert into public.calendario_claves (user_id, clave) values (auth.uid(), public.calendario_clave_nueva())
  on conflict (user_id) do nothing;
  select * into v from public.calendario_claves where user_id = auth.uid();
  return jsonb_build_object('clave', v.clave, 'torneos', v.torneos, 'eventos', v.eventos, 'lanzamientos', v.lanzamientos);
end $$;

-- Qué entra.
create or replace function public.calendario_poner(p_torneos boolean, p_eventos boolean, p_lanzamientos boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.calendario_mio();
  update public.calendario_claves
     set torneos = coalesce(p_torneos, torneos),
         eventos = coalesce(p_eventos, eventos),
         lanzamientos = coalesce(p_lanzamientos, lanzamientos)
   where user_id = auth.uid();
  return public.calendario_mio();
end $$;

-- Si la compartes sin querer: otra clave, y la vieja deja de valer.
create or replace function public.calendario_cambiar_clave()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.calendario_mio();
  update public.calendario_claves set clave = public.calendario_clave_nueva(), creada_at = now() where user_id = auth.uid();
  return public.calendario_mio();
end $$;

-- El calendario de una clave: lo que se pinta en el .ics.
create or replace function public.calendario_de(p_clave text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  c public.calendario_claves;
  v_torneos jsonb := '[]'::jsonb;
  v_eventos jsonb := '[]'::jsonb;
  v_lanz jsonb := '[]'::jsonb;
begin
  if p_clave is null or length(p_clave) < 32 then
    return null;
  end if;
  select * into c from public.calendario_claves where clave = p_clave;
  if not found then
    return null;
  end if;
  if c.torneos then
    -- `matchday_dates` va por to_jsonb: si una base no tiene la columna, no
    -- se rompe la función entera.
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'nombre', t.name, 'empieza', t.start_at,
             'jornadas', coalesce(to_jsonb(t) -> 'matchday_dates', '[]'::jsonb)) order by t.start_at), '[]'::jsonb)
      into v_torneos
      from public.tournaments t
      join public.tournament_registrations r on r.tournament_id = t.id
     where r.user_id = c.user_id
       and r.status <> 'dropped'
       and t.status <> 'cancelled'
       and t.start_at > now() - interval '180 days';
  end if;
  if c.eventos then
    select coalesce(jsonb_agg(jsonb_build_object(
             'slug', e.slug, 'nombre', e.nombre, 'empieza', e.empieza, 'termina', e.termina,
             'sitio', e.sitio, 'direccion', e.direccion, 'ciudad', e.ciudad,
             'horario', to_jsonb(e) -> 'horario') order by e.empieza), '[]'::jsonb)
      into v_eventos
      from public.eventos e
      join public.evento_asistentes a on a.evento_id = e.id
     where a.user_id = c.user_id
       and coalesce(e.termina, e.empieza) > now() - interval '30 days';
  end if;
  if c.lanzamientos then
    -- Los de los catálogos en los que tienes cartas (o el occidental).
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.name, 'dia', s.release_date, 'market', s.market) order by s.release_date), '[]'::jsonb)
      into v_lanz
      from public.tcg_sets s
     where s.release_date between current_date - 7 and current_date + 180
       and s.market in (
         select distinct uc.market from public.user_collection uc where uc.user_id = c.user_id
         union select 'WEST'
       );
  end if;
  return jsonb_build_object('torneos', v_torneos, 'eventos', v_eventos, 'lanzamientos', v_lanz);
end $$;

revoke all on function public.calendario_mio() from public, anon;

revoke all on function public.calendario_poner(boolean, boolean, boolean) from public, anon;

revoke all on function public.calendario_cambiar_clave() from public, anon;

grant execute on function public.calendario_mio() to authenticated;

grant execute on function public.calendario_poner(boolean, boolean, boolean) to authenticated;

grant execute on function public.calendario_cambiar_clave() to authenticated;

grant execute on function public.calendario_de(text) to anon, authenticated;
