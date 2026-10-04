-- ════════════════════════════════════════════════════════════════════
-- Tanda 591 — enlaces CORTOS para todo lo que se comparte sin cuenta
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «otra cosa que tienes que solucionar son los enlaces, hacerlos
-- muchísimo más cortos».
--
-- Hasta ahora, lo que se compartía SIN una fila en la base (una repetición
-- sin cuenta, una posición del laboratorio) llevaba la partida entera
-- dentro del enlace, comprimida detrás de un `#`: 3.000–6.000 caracteres,
-- que en Discord no caben en un mensaje. Ahora se guarda AQUÍ esa misma
-- carga —ya comprimida en el navegador; la base no la abre— y el enlace
-- es `pokedoc.es/rep/<id>` o `pokedoc.es/lab/<id>`: ocho letras.
--
-- Lo puede hacer cualquiera, con cuenta o sin ella, así que lleva topes:
-- la carga con la forma que hace la web y no más de 60.000 caracteres, la
-- misma carga dos veces es el mismo enlace, 30 por hora por conexión y
-- 3.000 al día entre todos. Al llegar a un tope la web hace el enlace
-- largo de siempre, que sigue funcionando.
--
-- Nadie lee ni escribe la tabla directamente: se crea y se lee por las dos
-- funciones. Leer pide el id exacto; no se puede listar.
--
-- Se ejecuta en el SQL Editor de Supabase. Se puede repetir entera.

begin;

create table if not exists public.enlaces_cortos (
  id text primary key,
  tipo text not null check (tipo in ('repeticion', 'posicion')),
  carga text not null check (char_length(carga) between 8 and 60000),
  -- La misma carga es el mismo enlace (y no una fila más).
  huella text not null unique,
  -- De qué conexión vino, ya resumido (md5): solo para el tope por hora.
  quien text,
  creado_at timestamptz not null default now()
);
create index if not exists enlaces_cortos_quien_idx on public.enlaces_cortos (quien, creado_at);
create index if not exists enlaces_cortos_creado_idx on public.enlaces_cortos (creado_at);

alter table public.enlaces_cortos enable row level security;
revoke all on table public.enlaces_cortos from anon, authenticated;

-- La conexión de quien llama, de las cabeceras que pasa PostgREST. Sin
-- ellas (una llamada desde el SQL Editor), null: el tope por hora no se
-- aplica y queda el del día.
create or replace function public.enlaces_cortos_quien()
returns text
language plpgsql
stable
as $$
declare
  v_cab json;
  v_ip text;
begin
  begin
    v_cab := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_cab := null;
  end;
  v_ip := coalesce(nullif(trim(v_cab ->> 'cf-connecting-ip'), ''), nullif(trim(split_part(coalesce(v_cab ->> 'x-forwarded-for', ''), ',', 1)), ''));
  return case when v_ip is null then null else md5('pokedoc-enlaces:' || v_ip) end;
end;
$$;

create or replace function public.enlace_corto_crear(p_tipo text, p_carga text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_huella text;
  v_id text;
  v_quien text := public.enlaces_cortos_quien();
  v_letras constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i int;
begin
  if p_tipo is null or p_tipo not in ('repeticion', 'posicion') then
    raise exception 'Ese tipo de enlace no existe.' using errcode = '22023';
  end if;
  if p_carga is null or char_length(p_carga) < 8 or char_length(p_carga) > 60000 then
    raise exception 'Eso no cabe en un enlace corto: usa el largo.' using errcode = '22023';
  end if;
  -- La forma que hace la web, y ninguna otra: lo de detrás del `#`.
  if (p_tipo = 'repeticion' and p_carga !~ '^(p|t)=[A-Za-z0-9_-]+$')
     or (p_tipo = 'posicion' and p_carga !~ '^pos=[A-Za-z0-9_-]+$') then
    raise exception 'Eso no es un enlace de PokeDoc.' using errcode = '22023';
  end if;

  v_huella := md5(p_tipo || ':' || p_carga);
  select e.id into v_id from public.enlaces_cortos e where e.huella = v_huella;
  if v_id is not null then
    return v_id;
  end if;

  -- Sin conexión conocida (`v_quien` null), `e.quien = v_quien` no casa con
  -- nada y este tope no cuenta: queda el del día.
  if (
    select count(*) from public.enlaces_cortos e where e.quien = v_quien and e.creado_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Has hecho muchos enlaces cortos en una hora: espera un poco (el largo funciona igual).' using errcode = 'P0001';
  end if;
  if (select count(*) from public.enlaces_cortos e where e.creado_at > now() - interval '1 day') >= 3000 then
    raise exception 'Hoy ya se han hecho muchos enlaces cortos: usa el largo, que funciona igual.' using errcode = 'P0001';
  end if;

  loop
    v_id := '';
    for i in 1..8 loop
      v_id := v_id || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    end loop;
    begin
      insert into public.enlaces_cortos (id, tipo, carga, huella, quien) values (v_id, p_tipo, p_carga, v_huella, v_quien);
      return v_id;
    exception when unique_violation then
      -- O ese id ya estaba (se prueba otro), o la misma carga ha entrado a
      -- la vez por otra llamada (y entonces es esa).
      select e.id into v_id from public.enlaces_cortos e where e.huella = v_huella;
      if v_id is not null then
        return v_id;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.enlace_corto_leer(p_id text)
returns table (tipo text, carga text)
language sql
stable
security definer
set search_path = public
as $$
  select e.tipo, e.carga from public.enlaces_cortos e where e.id = p_id;
$$;

revoke all on function public.enlaces_cortos_quien() from public, anon, authenticated;
revoke all on function public.enlace_corto_crear(text, text) from public;
grant execute on function public.enlace_corto_crear(text, text) to anon, authenticated, service_role;
revoke all on function public.enlace_corto_leer(text) from public;
grant execute on function public.enlace_corto_leer(text) to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
