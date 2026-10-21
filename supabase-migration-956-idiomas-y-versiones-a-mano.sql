-- ============================================================
-- Tanda 956: los IDIOMAS de un set y las VERSIONES de cada idioma, a mano.
--
-- Sergio.M en el foro: «Undaunted, quitar portugués, no salió en ese idioma»;
-- «Dark Explorers no salió en español en ninguna versión, y la Reverse de
-- portugués tampoco»; «Stormfront nunca salió en Reverse español»; «Jungle,
-- falta añadir el neerlandés». Los idiomas de un set los calcula
-- `idiomas_de_set` (911) de los anuncios de Cardmarket y la ficha de TCGdex,
-- y las versiones son de la carta, no del idioma: no había dónde escribir
-- nada de eso. PINGU eligió la opción B de la propuesta: que se corrija desde
-- /admin y no pasando por mí.
--
--  1. El neerlandés (`nl`), admitido en la colección y en «La quiero». La web
--     solo lo ofrece en los sets que lo tienen puesto a mano.
--  2. `tcg_set_idiomas_mano`: un idioma puesto (`hay = true`) o quitado
--     (`hay = false`) a mano. Manda sobre lo calculado.
--  3. `tcg_version_idioma`: una versión que NO salió en un idioma de un set
--     (`hay = false`; `true` se guarda por si un día hace falta afirmarlo).
--  4. `idiomas_de_set` = lo calculado de siempre (ahora
--     `idiomas_de_set_calculados`) + lo puesto − lo quitado.
--  5. Dos funciones para el admin, que es quien escribe (como la 934).
--  6. Lo de Sergio.
--
-- Va después de la 911. Se puede ejecutar dos veces.
-- ============================================================

begin;

-- ── 1. El neerlandés ──
alter table public.user_collection drop constraint if exists user_collection_idioma;
alter table public.user_collection add constraint user_collection_idioma
  check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'));
alter table public.user_wants drop constraint if exists user_wants_idioma;
alter table public.user_wants add constraint user_wants_idioma
  check (idioma is null or idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'));

-- ── 2 y 3. Las dos tablas ──
create table if not exists public.tcg_set_idiomas_mano (
  set_id text not null,
  market text not null default 'WEST',
  idioma text not null check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh')),
  hay boolean not null,
  autor uuid,
  updated_at timestamptz not null default now(),
  primary key (set_id, market, idioma)
);
create table if not exists public.tcg_version_idioma (
  set_id text not null,
  market text not null default 'WEST',
  variante text not null,
  idioma text not null check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh')),
  hay boolean not null default false,
  autor uuid,
  updated_at timestamptz not null default now(),
  primary key (set_id, market, variante, idioma)
);
-- Las lee todo el mundo (la hoja de añadir) y no las escribe nadie a pelo:
-- solo las funciones de abajo. Sin la política de lectura la web leería
-- CERO filas sin error (la 510).
alter table public.tcg_set_idiomas_mano enable row level security;
alter table public.tcg_version_idioma enable row level security;
drop policy if exists tcg_set_idiomas_mano_leer on public.tcg_set_idiomas_mano;
create policy tcg_set_idiomas_mano_leer on public.tcg_set_idiomas_mano for select using (true);
drop policy if exists tcg_version_idioma_leer on public.tcg_version_idioma;
create policy tcg_version_idioma_leer on public.tcg_version_idioma for select using (true);
grant select on public.tcg_set_idiomas_mano, public.tcg_version_idioma to anon, authenticated;

-- ── 4. Los idiomas de un set ──
-- Lo de la 911, tal cual, con otro nombre: /admin lo enseña aparte («lo que
-- dice Cardmarket o TCGdex») de lo puesto a mano.
create or replace function public.idiomas_de_set_calculados(p_set text, p_market text default 'WEST')
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with precios as (
    select
      bool_or(p.cm_low_es > 0) as es, bool_or(p.cm_low_en > 0) as en,
      bool_or(p.cm_low_de > 0) as de, bool_or(p.cm_low_fr > 0) as fr,
      bool_or(p.cm_low_it > 0) as it, bool_or(p.cm_low_ja > 0) as ja,
      bool_or(p.cm_low_ko > 0) as ko, bool_or(p.cm_low_zh > 0) as zh
    from public.tcg_cards c
    join public.tcg_card_prices p on p.card_id = c.id
    where c.set_id = p_set and c.market = p_market
  ),
  ficha as (
    select idiomas from public.tcg_set_idiomas where set_id = p_set and market = p_market
  )
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(array[
      case when es then 'es' end, case when en then 'en' end, case when de then 'de' end,
      case when fr then 'fr' end, case when it then 'it' end, case when ja then 'ja' end,
      case when ko then 'ko' end, case when zh then 'zh' end
    ]) as x
    from precios
    union all
    select unnest(idiomas) from ficha
    union all
    select 'pt' where p_market = 'WEST'
      and not exists (select 1 from ficha)
      and exists (select 1 from precios where es or en or de or fr or it)
  ) t
  where x is not null
$$;

-- Y la de siempre, con lo de a mano encima: lo puesto se suma, lo quitado se
-- quita aunque Cardmarket lo anuncie (un anuncio mal catalogado no hace que
-- un set saliera en ese idioma).
create or replace function public.idiomas_de_set(p_set text, p_market text default 'WEST')
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(public.idiomas_de_set_calculados(p_set, p_market)) as x
    union all
    select idioma from public.tcg_set_idiomas_mano where set_id = p_set and market = p_market and hay
  ) t
  where x not in (select idioma from public.tcg_set_idiomas_mano where set_id = p_set and market = p_market and not hay)
$$;

grant execute on function public.idiomas_de_set_calculados(text, text) to anon, authenticated;
grant execute on function public.idiomas_de_set(text, text) to anon, authenticated;

-- ── 5. Lo que escribe el admin ──
-- `p_hay` a null QUITA lo puesto a mano y vuelve a mandar lo calculado.
create or replace function public.catalogo_idioma_de_set(p_set text, p_market text, p_idioma text, p_hay boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tcg_sets where id = p_set and market = p_market) then
    raise exception 'No existe el set % (%).', p_set, p_market using errcode = 'P0002';
  end if;
  if p_hay is null then
    delete from public.tcg_set_idiomas_mano where set_id = p_set and market = p_market and idioma = p_idioma;
  else
    insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, autor, updated_at)
    values (p_set, p_market, p_idioma, p_hay, auth.uid(), now())
    on conflict (set_id, market, idioma) do update set hay = excluded.hay, autor = excluded.autor, updated_at = now();
  end if;
  return jsonb_build_object('idiomas', to_jsonb(public.idiomas_de_set(p_set, p_market)));
end;
$$;

create or replace function public.catalogo_version_de_idioma(p_set text, p_market text, p_variante text, p_idioma text, p_hay boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tcg_sets where id = p_set and market = p_market) then
    raise exception 'No existe el set % (%).', p_set, p_market using errcode = 'P0002';
  end if;
  if coalesce(trim(p_variante), '') = '' then
    raise exception 'Falta la versión.' using errcode = '22023';
  end if;
  if p_hay is null or p_hay then
    -- «Sí salió» es lo de por defecto: no hace falta guardarlo.
    delete from public.tcg_version_idioma where set_id = p_set and market = p_market and variante = p_variante and idioma = p_idioma;
  else
    insert into public.tcg_version_idioma (set_id, market, variante, idioma, hay, autor, updated_at)
    values (p_set, p_market, p_variante, p_idioma, false, auth.uid(), now())
    on conflict (set_id, market, variante, idioma) do update set hay = false, autor = excluded.autor, updated_at = now();
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.catalogo_idioma_de_set(text, text, text, boolean) from public, anon;
revoke all on function public.catalogo_version_de_idioma(text, text, text, text, boolean) from public, anon;
grant execute on function public.catalogo_idioma_de_set(text, text, text, boolean) to authenticated;
grant execute on function public.catalogo_version_de_idioma(text, text, text, text, boolean) to authenticated;

-- ── 6. Lo de Sergio.M (foro, 2026-10-22) ──
-- Solo en los sets que existen: un id que no esté no se inventa.
insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, updated_at)
select v.set_id, 'WEST', v.idioma, v.hay, now()
from (values
  ('base2', 'nl', true),    -- Jungle: también salió en neerlandés
  ('hgss3', 'pt', false),   -- Undaunted: no salió en portugués
  ('bw5', 'es', false)      -- Dark Explorers: no salió en español
) as v(set_id, idioma, hay)
where exists (select 1 from public.tcg_sets s where s.id = v.set_id and s.market = 'WEST')
on conflict (set_id, market, idioma) do update set hay = excluded.hay, updated_at = now();

insert into public.tcg_version_idioma (set_id, market, variante, idioma, hay, updated_at)
select v.set_id, 'WEST', 'reverse', v.idioma, false, now()
from (values
  ('dp7', 'es'),   -- Stormfront: sin Reverse en español
  ('bw5', 'pt'),   -- Dark Explorers: sin Reverse en portugués (la normal sí)
  ('bw7', 'pt')    -- Boundaries Crossed: igual
) as v(set_id, idioma)
where exists (select 1 from public.tcg_sets s where s.id = v.set_id and s.market = 'WEST')
on conflict (set_id, market, variante, idioma) do update set hay = false, updated_at = now();

notify pgrst, 'reload schema';

commit;

-- ── Comprobación (el SQL Editor enseña la última) ──
select s.id, s.name, public.idiomas_de_set_calculados(s.id, 'WEST') as calculados, public.idiomas_de_set(s.id, 'WEST') as con_lo_de_a_mano,
       (select string_agg(v.variante || ' ✕ ' || v.idioma, ', ') from public.tcg_version_idioma v where v.set_id = s.id and v.market = 'WEST') as versiones_que_no_salieron
from public.tcg_sets s
where s.market = 'WEST' and s.id in ('base2', 'hgss3', 'bw5', 'dp7', 'bw7')
order by s.id;
