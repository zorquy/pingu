-- Tanda 1192 — Eventos: la agenda de card shows, trade days y quedadas
-- (/eventos), la primera tanda de la propuesta «Eventos: dónde nos vemos»
-- que PINGU aprobó («como me propusiste, me parece bien»).
--
-- 1. `eventos`: lo que se publica. Lo da de alta el equipo desde /admin →
--    Eventos (escribe directo, con la política `eventos_equipo`); la gente
--    lee solo lo publicado.
-- 2. `evento_asistentes`: quién marca «Voy», con `oculto` para ir «sin
--    decirlo» (cuenta en el número, no sale en la lista). Nadie lee la tabla
--    entera: cada uno ve sus filas, y lo demás sale por las funciones.
-- 3. `eventos_lista`, `evento_ficha` y `evento_voy`: la agenda (con cuántos
--    van, hasta cinco caras y si vas tú), la ficha (con la lista de quién va,
--    sin los ocultos) y marcar o quitar «Voy». Las dos primeras las puede
--    llamar cualquiera; la tercera, con sesión.
-- El logo se sube al cubo `guide-images` (el del equipo), en `eventos/`.
-- Se puede ejecutar dos veces.

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  tipo text not null default 'card_show' check (tipo in ('card_show', 'trade_day', 'quedada', 'torneo')),
  empieza timestamptz not null,
  termina timestamptz,
  sitio text,
  direccion text,
  ciudad text,
  provincia text,
  entrada text,
  juegos text,
  descripcion text,
  web text,
  instagram text,
  tcgmap_url text,
  logo_url text,
  siglas text check (siglas is null or length(siglas) <= 8),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  publicado boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (termina is null or termina >= empieza)
);

create index if not exists eventos_empieza_idx on public.eventos (empieza);

alter table public.eventos enable row level security;

-- Dos políticas y no una con `or is_admin()`: Postgres evalúa todas las de
-- la tabla y `anon` no tiene por qué poder ejecutar is_admin() (la 555).
drop policy if exists eventos_ver on public.eventos;
create policy eventos_ver on public.eventos
  for select to anon, authenticated using (publicado);

drop policy if exists eventos_equipo on public.eventos;
create policy eventos_equipo on public.eventos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.eventos to anon, authenticated;
grant insert, update, delete on public.eventos to authenticated;

create table if not exists public.evento_asistentes (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  oculto boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (evento_id, user_id)
);

create index if not exists evento_asistentes_user_idx on public.evento_asistentes (user_id);

alter table public.evento_asistentes enable row level security;

drop policy if exists evento_asistentes_mias on public.evento_asistentes;
create policy evento_asistentes_mias on public.evento_asistentes
  for select to authenticated using (user_id = auth.uid());

grant select on public.evento_asistentes to authenticated;

-- Lo que se pinta de un evento: sus columnas, cuántos van (también los que
-- van sin decirlo), hasta `p_caras` caras de los que se ven y si vas tú.
create or replace function public.evento_json(e public.eventos, p_caras int default 5)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(e) - 'creado_por'
    || jsonb_build_object(
      'van', (select count(*) from evento_asistentes a where a.evento_id = e.id),
      'caras', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) order by a.created_at)
        from (select * from evento_asistentes a where a.evento_id = e.id and not a.oculto order by a.created_at limit greatest(p_caras, 0)) a
        join user_profiles p on p.id = a.user_id
      ), '[]'::jsonb),
      'voy', exists (select 1 from evento_asistentes a where a.evento_id = e.id and a.user_id = auth.uid()),
      'oculto', coalesce((select a.oculto from evento_asistentes a where a.evento_id = e.id and a.user_id = auth.uid()), false)
    )
$$;

-- La agenda: lo publicado desde `p_desde` (por defecto, cuatro meses atrás,
-- para que lo pasado salga apagado debajo), lo más cercano primero.
create or replace function public.eventos_lista(p_desde timestamptz default now() - interval '120 days')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(evento_json(e, 5) order by e.empieza), '[]'::jsonb)
  from eventos e
  where e.publicado and coalesce(e.termina, e.empieza) >= p_desde
$$;

-- La ficha de un evento por su dirección: con la lista de quién va (sin los
-- que van «sin decirlo»). El equipo ve también uno sin publicar.
create or replace function public.evento_ficha(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select evento_json(e, 500)
  from eventos e
  where e.slug = p_slug
    and (e.publicado or (auth.uid() is not null and public.is_admin()))
$$;

-- Marcar «Voy» (o quitarlo, con p_voy = false). `p_oculto` es ir «sin
-- decirlo». No se puede en un evento sin publicar ni en uno que acabó hace
-- más de un día.
create or replace function public.evento_voy(p_evento uuid, p_voy boolean default true, p_oculto boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_e eventos;
begin
  if v_yo is null then
    raise exception 'Entra en tu cuenta para marcar que vas';
  end if;
  select * into v_e from eventos where id = p_evento and publicado;
  if not found then
    raise exception 'Ese evento no existe';
  end if;
  if p_voy then
    if coalesce(v_e.termina, v_e.empieza) < now() - interval '1 day' then
      raise exception 'Ese evento ya pasó';
    end if;
    insert into evento_asistentes (evento_id, user_id, oculto) values (p_evento, v_yo, coalesce(p_oculto, false))
    on conflict (evento_id, user_id) do update set oculto = excluded.oculto;
  else
    delete from evento_asistentes where evento_id = p_evento and user_id = v_yo;
  end if;
  return jsonb_build_object(
    'voy', p_voy,
    'oculto', p_voy and coalesce(p_oculto, false),
    'van', (select count(*) from evento_asistentes where evento_id = p_evento)
  );
end;
$$;

revoke all on function public.evento_json(public.eventos, int) from public;
grant execute on function public.eventos_lista(timestamptz) to anon, authenticated;
grant execute on function public.evento_ficha(text) to anon, authenticated;
revoke all on function public.evento_voy(uuid, boolean, boolean) from public;
grant execute on function public.evento_voy(uuid, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
