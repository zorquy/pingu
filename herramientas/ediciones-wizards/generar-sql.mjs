// Escribe supabase-migration-935-ediciones-wizards.sql con las ediciones de
// tcgdex/cards-database (ediciones.mjs) metidas dentro, como jsonb.
import { writeFileSync } from 'node:fs'
import { todas } from './ediciones.mjs'

const datos = todas().map((c) => ({ s: c.s, n: c.n, e: c.e.map((e) => [e.etiqueta, e.clase, e.cm, e.tp]) }))
const json = JSON.stringify(datos).replace(/'/g, "''")
const destino = process.argv[2] || '/home/user/pingu/supabase-migration-935-ediciones-wizards.sql'

const sql = `-- ============================================================
-- Tanda 935: en la era de Wizards, cada carta UNA vez y sus ediciones como
-- versiones (1.ª edición, Shadowless, Unlimited…).
--
-- PINGU: «Arcanine en TCGGO tiene dos versiones, la First Edition y la
-- Unlimited… el Charizard de Base Set tiene tres… yo no pondría las cartas
-- repetidas, sino la carta una sola vez, y esas versiones como variantes de
-- la misma carta». Y Chansey ofrecía una «Normal» que no existe.
--
-- Por qué pasaba: TCGGO da un producto de Cardmarket por carta, y en Base
-- Set la Shadowless es OTRO producto (el Charizard Unlimited es el 273699 y
-- el Shadowless el 660224), así que el catálogo de TCGGO creaba una
-- «tcggo-…» al lado de la nuestra. Y TCGdex, en su API, solo dice «holo» y
-- «1.ª edición».
--
-- La lista de ediciones de cada carta sale de los ficheros de
-- tcgdex/cards-database (\`variants\` con subtipo, sellos y el id de
-- Cardmarket), no de una regla nuestra: va aquí dentro, generada por
-- herramientas/ediciones-wizards/generar-sql.mjs (rama \`pruebas\`, sobre un clon de tcgdex/cards-database en /tmp/tcgdex-db).
--
--  1. \`catalogo_id_de_version\` dice lo mismo que \`varianteDeEtiqueta\` de la
--     web también para las de siempre («1st Edition» → primera, «Reverse
--     Holo» → reverse), que es lo que guarda \`user_collection.variante\`.
--  2. Cada edición es una fila de \`tcg_card_versions\` con \`origen =
--     'edicion'\`, su clase (impresión, sello o adicional, la de la 934) y su
--     producto de Cardmarket, colgada de NUESTRA carta (la de TCGdex).
--  3. Las «tcggo-…» repetidas se funden en ella: por su producto de
--     Cardmarket (o, si no lo tiene ninguna edición, por número y nombre)
--     se sabe qué edición son; sus copias pasan a esa versión, sus deseos,
--     álbumes, avisos y vitrina a la carta, su foto a la edición y la carta
--     se borra con LÁPIDA (la 934): el catálogo de TCGGO no la vuelve a
--     crear.
--  4. Las copias apuntadas como «Holo» o «Normal» pasan a «Unlimited» (lo
--     recomendado); las de «1.ª edición» se quedan.
--  5. \`catalogo_version_foto\`: el admin le pone foto a cualquier versión de
--     una carta, de TCGGO, de edición o de siempre (para esta última crea una
--     fila \`origen = 'foto'\`). Ninguna pasada escribe \`imagen\`: se queda.
--
-- Va DESPUÉS de supabase-migration-934-versiones-a-mano.sql. Idempotente:
-- una edición que ya está no se repite y una carta ya fundida ya no existe.
-- ============================================================

begin;

-- ── 1. El id de una versión, el mismo que en la web ──
create or replace function public.catalogo_id_de_version(p text)
returns text
language sql
immutable
as $$
  with t as (select trim(regexp_replace(public.immutable_unaccent(lower(coalesce(p, ''))), '\\s+', ' ', 'g')) as t)
  select case
    when t = '' then 'reverse'
    when t in ('reverse holo', 'reverse', 'reverse holofoil') then 'reverse'
    when t in ('holo', 'holofoil') then 'holo'
    when t in ('standard', 'normal') then 'normal'
    when t in ('1st edition', 'first edition') then 'primera'
    else coalesce(nullif(left(trim(both '-' from regexp_replace(t, '[^a-z0-9]+', '-', 'g')), 40), ''), 'reverse')
  end
  from t
$$;

-- ── 5. La foto de una versión ──
create or replace function public.catalogo_version_foto(p_card_id text, p_market text, p_variante text, p_imagen text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carta record;
  v_id int;
  v_imagen text := nullif(trim(coalesce(p_imagen, '')), '');
  v_fila jsonb;
  v_etiqueta text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select id, set_id, name into v_carta from public.tcg_cards where id = p_card_id and market = p_market;
  if not found then
    raise exception 'No existe la carta % (%).', p_card_id, p_market using errcode = 'P0002';
  end if;
  -- La fila de esa versión: la que tenga una foto ya, si hay dos (una de
  -- TCGGO y una de edición con el mismo nombre), y si no la primera.
  select tcggo_id into v_id from public.tcg_card_versions
   where card_id = p_card_id and market = p_market and public.catalogo_id_de_version(etiqueta) = p_variante
   order by (imagen is not null) desc, (origen = 'edicion') desc, tcggo_id
   limit 1;
  if v_id is null then
    if v_imagen is null then
      return null;
    end if;
    v_etiqueta := case p_variante when 'normal' then 'Normal' when 'holo' then 'Holo' when 'reverse' then 'Reverse Holo' when 'primera' then '1st Edition' else initcap(replace(p_variante, '-', ' ')) end;
    v_id := -nextval('public.tcg_card_versions_mano_seq')::int;
    insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, imagen, origen, actualizado_at)
    values (v_id, p_market, p_card_id, v_carta.set_id, v_carta.name, v_etiqueta, v_imagen, 'foto', now());
  elsif v_imagen is null and exists (select 1 from public.tcg_card_versions where tcggo_id = v_id and origen = 'foto') then
    -- Quitar la foto de una versión de siempre es quitar la fila que solo
    -- estaba para llevarla.
    delete from public.tcg_card_versions where tcggo_id = v_id;
    return null;
  else
    update public.tcg_card_versions set imagen = v_imagen, actualizado_at = now() where tcggo_id = v_id;
  end if;
  select to_jsonb(v) into v_fila from public.tcg_card_versions v where tcggo_id = v_id;
  return v_fila;
end;
$$;

revoke all on function public.catalogo_version_foto(text, text, text, text) from public, anon;
grant execute on function public.catalogo_version_foto(text, text, text, text) to authenticated, service_role;

alter table public.tcg_card_versions drop constraint if exists tcg_card_versions_origen_ok;
alter table public.tcg_card_versions add constraint tcg_card_versions_origen_ok
  check (origen is null or origen in ('mano', 'edicion', 'foto'));

create index if not exists tcg_card_versions_producto on public.tcg_card_versions (cm_id_product) where origen = 'edicion';

-- ── 2, 3 y 4. Las ediciones, y fundir las repetidas ──
do $do$
declare
  d jsonb := '${json}'::jsonb;
  r record;
  e record;
  c record;
  dup record;
  t_id int;
  t_etiqueta text;
  t_cm int;
  v_id text;
  v_comp text;
  v_tiene_primera boolean;
  v_tiene_ilimitada boolean;
  n_ediciones int := 0;
  n_fundidas int := 0;
  n_copias int := 0;
  n_sin int := 0;
  n_pasadas int := 0;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tcg_card_versions' and column_name = 'origen') then
    raise exception 'Falta ejecutar antes supabase-migration-934-versiones-a-mano.sql.';
  end if;

  for r in select x->>'s' as s, x->>'n' as n, x->'e' as e from jsonb_array_elements(d) as x loop
    select id, set_id, name, name_en, local_id, cm_id_product_propio into c
      from public.tcg_cards where id = r.s || '-' || r.n and market = 'WEST';
    if not found then
      continue;
    end if;

    -- Las ediciones, en el orden de la lista (1.ª edición, Shadowless,
    -- Unlimited, y lo demás detrás): la web las ordena por su id.
    for e in select y->>0 as etiqueta, y->>1 as clase, nullif(y->>2, '')::int as cm from jsonb_array_elements(r.e) as y loop
      if not exists (select 1 from public.tcg_card_versions where card_id = c.id and market = 'WEST' and origen = 'edicion' and etiqueta = e.etiqueta) then
        insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
        values (-nextval('public.tcg_card_versions_mano_seq')::int, 'WEST', c.id, c.set_id, c.name, e.etiqueta, e.clase, e.cm, 'edicion', now());
        n_ediciones := n_ediciones + 1;
      end if;
    end loop;

    -- La Unlimited sin producto toma el de nuestra carta, si no es el de
    -- otra edición (Gym Challenge: TCGdex solo sabe el de la 1.ª edición).
    if c.cm_id_product_propio is not null and not exists (
      select 1 from public.tcg_card_versions where card_id = c.id and origen = 'edicion' and cm_id_product = c.cm_id_product_propio
    ) then
      update public.tcg_card_versions set cm_id_product = c.cm_id_product_propio
       where card_id = c.id and origen = 'edicion' and etiqueta = 'Unlimited' and cm_id_product is null;
    end if;

    v_tiene_primera := exists (select 1 from public.tcg_card_versions where card_id = c.id and origen = 'edicion' and etiqueta = '1st Edition');
    v_tiene_ilimitada := exists (select 1 from public.tcg_card_versions where card_id = c.id and origen = 'edicion' and etiqueta = 'Unlimited');
    v_comp := regexp_replace(public.immutable_unaccent(lower(coalesce(c.name_en, c.name, ''))), '[^a-z0-9]+', '', 'g');

    -- Las repetidas: las de TCGGO del mismo set con el producto de una de
    -- sus ediciones, o con su número y su nombre.
    for dup in
      select x.id, x.local_id, x.name, x.name_en, x.cm_id_product_propio, x.image_tcggo
        from public.tcg_cards x
       where x.market = 'WEST' and x.set_id = c.set_id and x.id <> c.id
         and (x.origen = 'tcggo' or x.id like 'tcggo-%')
         and (
           x.cm_id_product_propio in (select cm_id_product from public.tcg_card_versions where card_id = c.id and origen = 'edicion' and cm_id_product is not null)
           or (nullif(ltrim(lower(x.local_id), '0'), '') = nullif(ltrim(lower(c.local_id), '0'), '')
               and v_comp <> ''
               and regexp_replace(public.immutable_unaccent(lower(coalesce(x.name_en, x.name, ''))), '[^a-z0-9]+', '', 'g') like v_comp || '%')
         )
    loop
      t_id := null; t_etiqueta := null; t_cm := null;
      -- Lo que diga su nombre, primero («… 1st Edition», «… Shadowless»).
      if lower(coalesce(dup.name_en, dup.name, '')) ~ '1st edition|first edition' then
        select tcggo_id, etiqueta, cm_id_product into t_id, t_etiqueta, t_cm from public.tcg_card_versions where card_id = c.id and origen = 'edicion' and etiqueta = '1st Edition';
      elsif lower(coalesce(dup.name_en, dup.name, '')) ~ 'shadowless' then
        select tcggo_id, etiqueta, cm_id_product into t_id, t_etiqueta, t_cm from public.tcg_card_versions where card_id = c.id and origen = 'edicion' and etiqueta = 'Shadowless';
      end if;
      -- Si no, su producto: la edición sin sello antes que la 1.ª edición
      -- (en Base Set la 1.ª edición y la Shadowless son el mismo producto).
      if t_id is null and dup.cm_id_product_propio is not null then
        select tcggo_id, etiqueta, cm_id_product into t_id, t_etiqueta, t_cm from public.tcg_card_versions
         where card_id = c.id and origen = 'edicion' and cm_id_product = dup.cm_id_product_propio
         order by (etiqueta = '1st Edition'), (clase = 'impresion') desc, tcggo_id desc
         limit 1;
      end if;
      -- Y si su producto no lo tiene ninguna edición, la Unlimited que no lo
      -- sabe (se queda con el suyo).
      if t_id is null then
        select tcggo_id, etiqueta, cm_id_product into t_id, t_etiqueta, t_cm from public.tcg_card_versions
         where card_id = c.id and origen = 'edicion' and etiqueta = 'Unlimited' and cm_id_product is null;
        if t_id is not null and dup.cm_id_product_propio is not null then
          update public.tcg_card_versions set cm_id_product = dup.cm_id_product_propio where tcggo_id = t_id;
          t_cm := dup.cm_id_product_propio;
        end if;
      end if;
      if t_id is null then
        n_sin := n_sin + 1;
        continue;
      end if;
      v_id := public.catalogo_id_de_version(t_etiqueta);

      -- Sus copias, a la edición (las de «1.ª edición» siguen siéndolo).
      update public.user_collection
         set card_id = c.id, market = 'WEST',
             variante = case when variante = 'primera' and v_tiene_primera then 'primera' else v_id end
       where card_id = dup.id;
      get diagnostics n_pasadas = row_count;
      n_copias := n_copias + n_pasadas;
      -- Sus versiones de TCGGO (la «1st Edition» con su precio), a la carta.
      update public.tcg_card_versions set card_id = c.id, set_id = c.set_id where card_id = dup.id;
      -- Su foto, a la edición y a las que comparten su producto.
      if dup.image_tcggo is not null then
        update public.tcg_card_versions set imagen = dup.image_tcggo
         where card_id = c.id and origen = 'edicion' and imagen is null
           and (tcggo_id = t_id or (cm_id_product is not null and cm_id_product = t_cm));
      end if;
      -- Lo demás que la apunta, como el borrado de la 934.
      delete from public.user_wants w
       where w.card_id = dup.id
         and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = c.id and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'));
      update public.user_wants set card_id = c.id where card_id = dup.id;
      update public.user_price_alerts set card_id = c.id where card_id = dup.id;
      update public.user_showcase set card_id = c.id where card_id = dup.id;
      update public.user_albums a set cartas = (
        select coalesce(jsonb_agg(case when x->>'id' = dup.id then jsonb_set(x, '{id}', to_jsonb(c.id)) else x end order by k), '[]'::jsonb)
          from jsonb_array_elements(a.cartas) with ordinality as z(x, k))
       where a.cartas @> jsonb_build_array(jsonb_build_object('id', dup.id));
      delete from public.tcg_card_prices where card_id = dup.id;
      delete from public.tcg_card_history where card_id = dup.id;
      delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = dup.id and market = 'WEST';
      insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
      values ('tcg_cards', dup.id, 'WEST', '__borrada', 'true'::jsonb, null, null, now())
      on conflict (tabla, id, market, columna) do update set updated_at = now();
      delete from public.tcg_cards where id = dup.id and market = 'WEST';
      n_fundidas := n_fundidas + 1;
    end loop;

    -- «Holo» y «Normal» no son ediciones: a Unlimited (lo recomendado).
    if v_tiene_ilimitada then
      update public.user_collection set variante = 'unlimited'
       where card_id = c.id and coalesce(variante, 'normal') in ('holo', 'normal');
      get diagnostics n_pasadas = row_count;
      n_copias := n_copias + n_pasadas;
    end if;
  end loop;

  raise notice 'Ediciones nuevas: %, cartas repetidas fundidas: %, copias movidas: %, repetidas sin edición: %', n_ediciones, n_fundidas, n_copias, n_sin;
end
$do$;

notify pgrst, 'reload schema';

commit;

-- Lo que ha quedado (el SQL Editor enseña esta tabla):
select
  (select count(*) from public.tcg_card_versions where origen = 'edicion') as ediciones,
  (select count(*) from public.tcg_correcciones where columna = '__borrada' and id like 'tcggo-%') as lapidas_de_tcggo,
  (select count(*) from public.tcg_cards x
     where x.market = 'WEST' and (x.origen = 'tcggo' or x.id like 'tcggo-%')
       and x.set_id in ('base1', 'base2', 'base3', 'base4', 'base5', 'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4', 'si1')) as de_tcggo_que_quedan;
`
writeFileSync(destino, sql)
console.log('escrito', destino, (sql.length / 1024).toFixed(0), 'KB', datos.length, 'cartas')
