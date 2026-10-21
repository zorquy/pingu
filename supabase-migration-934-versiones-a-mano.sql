-- ============================================================
-- Tanda 934: versiones a mano y borrar cartas desde /admin.
--
-- PINGU, con el Charizard metálico de Dex delante (cuelga del 4/102 de Base
-- Set como una versión más, con «Primera aparición: Celebrations
-- Ultra-Premium Collection»): «es la clave hacerlo así y meterlo como
-- reprint de la carta original, como una versión extra… quizá necesitamos
-- más campos». Y: «al editar cartas también deberíamos poder eliminar una
-- carta, no solo editarla».
--
--  1. Las versiones (`tcg_card_versions`, la 807) ganan lo que una versión a
--     mano necesita: su foto, su icono, dónde salió, cuándo, su clase
--     (impresión, sello o adicional) y la marca `origen = 'mano'`. Las de
--     TCGGO no las rellenan: siguen como estaban.
--  2. `catalogo_version_mano`: crear y editar una (solo el admin). Sin id de
--     TCGGO, el suyo es NEGATIVO (una secuencia propia): ninguna pasada
--     escribe ids negativos, así que ninguna la pisa. Con id de TCGGO, ese:
--     el precio llega por él. Renombrarla mueve las copias apuntadas.
--  3. `catalogo_borrar_version_mano`: solo las de a mano, y solo si nadie
--     la tiene apuntada.
--  4. `catalogo_quien_tiene_carta` y `catalogo_borrar_carta` (sustituye a la
--     de la 885, que solo borraba las de a mano sin dueño): cualquier carta;
--     lo que alguien tenga apuntado (colección, deseos, álbumes, avisos de
--     precio, vitrina) pasa ANTES a la carta que se diga. Y una carta de las
--     APIs deja una LÁPIDA en `tcg_correcciones` (`__borrada`): el
--     disparador de la 885 no deja que ninguna pasada la vuelva a crear.
--
-- Idempotente. Va después de supabase-migration-versiones.sql (807) y de
-- supabase-migration-885-catalogo-correcciones.sql.
-- ============================================================

begin;

-- ── 1. Las columnas ──
alter table public.tcg_card_versions
  add column if not exists imagen text,
  add column if not exists icono text,
  add column if not exists salio_en text,
  add column if not exists lanzamiento date,
  add column if not exists clase text,
  add column if not exists origen text;

alter table public.tcg_card_versions drop constraint if exists tcg_card_versions_clase_ok;
alter table public.tcg_card_versions add constraint tcg_card_versions_clase_ok
  check (clase is null or clase in ('impresion', 'sello', 'adicional'));

create sequence if not exists public.tcg_card_versions_mano_seq;

-- El id de una versión a partir de su nombre, como `varianteDeEtiqueta` en
-- la web (js/mi-coleccion/variantes.js): minúsculas, sin tildes, lo que no
-- sea letra o número a guiones, sin guiones en las puntas, 40 caracteres.
-- Es lo que guarda `user_collection.variante`, así que al renombrar una
-- versión se mueven las copias de un id al otro.
create or replace function public.catalogo_id_de_version(p text)
returns text
language sql
immutable
as $$
  select left(trim(both '-' from regexp_replace(public.immutable_unaccent(lower(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g')), 40)
$$;

-- ── 2. Crear y editar una versión a mano ──
--
-- `p_datos`: etiqueta (el nombre, obligatorio), icono, imagen, salio_en,
-- lanzamiento (AAAA-MM-DD), clase, numero, link_cm, cm_id_product y
-- tcggo_id (el de TCGGO, si lo tiene). `p_tcggo_id`: la versión que se
-- edita; sin él, se crea.
create or replace function public.catalogo_version_mano(
  p_card_id text,
  p_market text,
  p_datos jsonb,
  p_tcggo_id int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carta record;
  v_id int;
  v_nuevo int := nullif(trim(coalesce(p_datos->>'tcggo_id', '')), '')::int;
  v_etiqueta text := nullif(trim(coalesce(p_datos->>'etiqueta', '')), '');
  v_clase text := coalesce(nullif(p_datos->>'clase', ''), 'adicional');
  v_vieja record;
  v_fila jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select id, set_id, name into v_carta from public.tcg_cards where id = p_card_id and market = p_market;
  if not found then
    raise exception 'No existe la carta % (%).', p_card_id, p_market using errcode = 'P0002';
  end if;
  if v_etiqueta is null then
    raise exception 'La versión necesita un nombre.' using errcode = '22023';
  end if;
  if public.catalogo_id_de_version(v_etiqueta) in ('normal', 'reverse', 'holo', 'primera', 'reverse-holo', 'standard', '1st-edition', 'first-edition') then
    raise exception 'Ese nombre es el de una versión de siempre: ponle otro (p. ej. «Metálica»).' using errcode = '22023';
  end if;

  if p_tcggo_id is null then
    v_id := coalesce(v_nuevo, -nextval('public.tcg_card_versions_mano_seq')::int);
    if exists (select 1 from public.tcg_card_versions where tcggo_id = v_id) then
      raise exception 'Ya hay una versión con el id %.', v_id using errcode = '23505';
    end if;
    insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, nombre, etiqueta, icono, imagen, salio_en, lanzamiento, clase, link_cm, cm_id_product, origen, actualizado_at)
    values (v_id, p_market, v_carta.id, v_carta.set_id, nullif(trim(coalesce(p_datos->>'numero', '')), ''), v_carta.name, v_etiqueta,
      nullif(p_datos->>'icono', ''), nullif(trim(coalesce(p_datos->>'imagen', '')), ''), nullif(trim(coalesce(p_datos->>'salio_en', '')), ''),
      nullif(p_datos->>'lanzamiento', '')::date, v_clase, nullif(trim(coalesce(p_datos->>'link_cm', '')), ''),
      nullif(trim(coalesce(p_datos->>'cm_id_product', '')), '')::int, 'mano', now());
  else
    select tcggo_id, etiqueta into v_vieja from public.tcg_card_versions where tcggo_id = p_tcggo_id and card_id = p_card_id and origen = 'mano';
    if not found then
      raise exception 'Esa versión no es de esta carta o no está hecha a mano.' using errcode = 'P0002';
    end if;
    if v_nuevo is not null and v_nuevo <> p_tcggo_id and exists (select 1 from public.tcg_card_versions where tcggo_id = v_nuevo) then
      raise exception 'Ya hay una versión con el id %.', v_nuevo using errcode = '23505';
    end if;
    v_id := coalesce(v_nuevo, p_tcggo_id);
    update public.tcg_card_versions set
      tcggo_id = v_id,
      numero = nullif(trim(coalesce(p_datos->>'numero', '')), ''),
      etiqueta = v_etiqueta,
      icono = nullif(p_datos->>'icono', ''),
      imagen = nullif(trim(coalesce(p_datos->>'imagen', '')), ''),
      salio_en = nullif(trim(coalesce(p_datos->>'salio_en', '')), ''),
      lanzamiento = nullif(p_datos->>'lanzamiento', '')::date,
      clase = v_clase,
      link_cm = nullif(trim(coalesce(p_datos->>'link_cm', '')), ''),
      cm_id_product = nullif(trim(coalesce(p_datos->>'cm_id_product', '')), '')::int,
      actualizado_at = now()
    where tcggo_id = p_tcggo_id;
    -- Las copias apuntadas con el nombre de antes se van con ella.
    if public.catalogo_id_de_version(v_vieja.etiqueta) <> public.catalogo_id_de_version(v_etiqueta) then
      update public.user_collection set variante = public.catalogo_id_de_version(v_etiqueta)
       where card_id = p_card_id and variante = public.catalogo_id_de_version(v_vieja.etiqueta);
    end if;
  end if;
  select to_jsonb(v) into v_fila from public.tcg_card_versions v where tcggo_id = v_id;
  return v_fila;
end;
$$;

revoke all on function public.catalogo_version_mano(text, text, jsonb, int) from public, anon;
grant execute on function public.catalogo_version_mano(text, text, jsonb, int) to authenticated, service_role;

-- ── 3. Borrar una versión a mano ──
create or replace function public.catalogo_borrar_version_mano(p_tcggo_id int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_copias int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select card_id, etiqueta, origen into v from public.tcg_card_versions where tcggo_id = p_tcggo_id;
  if not found then
    raise exception 'Esa versión no existe.' using errcode = 'P0002';
  end if;
  if v.origen is distinct from 'mano' then
    raise exception 'Solo se borran las versiones hechas a mano; las de TCGGO las trae su pasada.' using errcode = '42501';
  end if;
  select coalesce(sum(cantidad), 0) into v_copias from public.user_collection
   where card_id = v.card_id and variante = public.catalogo_id_de_version(v.etiqueta);
  if v_copias > 0 then
    raise exception 'Hay % copias apuntadas en esa versión: no se borra.', v_copias using errcode = '23503';
  end if;
  delete from public.tcg_card_versions where tcggo_id = p_tcggo_id;
  return true;
end;
$$;

revoke all on function public.catalogo_borrar_version_mano(int) from public, anon;
grant execute on function public.catalogo_borrar_version_mano(int) to authenticated, service_role;

-- ── 4. Borrar una carta ──

-- Quién la tiene apuntada, para que /admin lo diga antes de borrar.
create or replace function public.catalogo_quien_tiene_carta(p_id text, p_market text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'personas', (select count(distinct user_id) from public.user_collection where card_id = p_id),
    'copias', (select coalesce(sum(cantidad), 0) from public.user_collection where card_id = p_id),
    'deseos', (select count(*) from public.user_wants where card_id = p_id),
    'albumes', (select count(*) from public.user_albums where cartas @> jsonb_build_array(jsonb_build_object('id', p_id))),
    'avisos', (select count(*) from public.user_price_alerts where card_id = p_id),
    'vitrina', (select count(*) from public.user_showcase where card_id = p_id)
  );
end;
$$;

revoke all on function public.catalogo_quien_tiene_carta(text, text) from public, anon;
grant execute on function public.catalogo_quien_tiene_carta(text, text) to authenticated, service_role;

-- La de la 885 tenía dos argumentos: con la de tres al lado, PostgREST no
-- sabría cuál llamar.
drop function if exists public.catalogo_borrar_carta(text, text);

create or replace function public.catalogo_borrar_carta(p_id text, p_market text, p_destino text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen text;
  v_existe boolean;
  v_quien jsonb := public.catalogo_quien_tiene_carta(p_id, p_market);
  v_apuntada boolean;
begin
  select true, origen into v_existe, v_origen from public.tcg_cards where id = p_id and market = p_market;
  if v_existe is null then
    raise exception 'Esa carta no existe.' using errcode = 'P0002';
  end if;
  v_apuntada := (v_quien->>'copias')::int > 0 or (v_quien->>'deseos')::int > 0 or (v_quien->>'albumes')::int > 0
    or (v_quien->>'avisos')::int > 0 or (v_quien->>'vitrina')::int > 0;
  if v_apuntada and p_destino is null then
    raise exception 'Alguien la tiene apuntada: elige a qué carta pasa antes de borrarla.' using errcode = '23503';
  end if;
  if p_destino is not null then
    if p_destino = p_id or not exists (select 1 from public.tcg_cards where id = p_destino and market = p_market) then
      raise exception 'La carta a la que pasan las copias no existe (o es la misma).' using errcode = 'P0002';
    end if;
    update public.user_collection set card_id = p_destino, market = p_market where card_id = p_id;
    -- Un deseo que ya estaba en la de destino se queda el de allí (el índice
    -- único de la 763 no deja dos).
    delete from public.user_wants w
     where w.card_id = p_id
       and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'));
    update public.user_wants set card_id = p_destino where card_id = p_id;
    update public.user_price_alerts set card_id = p_destino where card_id = p_id;
    update public.user_showcase set card_id = p_destino where card_id = p_id;
    update public.user_albums a set cartas = (
      select coalesce(jsonb_agg(case when e->>'id' = p_id then jsonb_set(e, '{id}', to_jsonb(p_destino)) else e end order by n), '[]'::jsonb)
        from jsonb_array_elements(a.cartas) with ordinality as x(e, n))
     where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_id));
  end if;
  delete from public.tcg_card_prices where card_id = p_id;
  delete from public.tcg_card_history where card_id = p_id;
  delete from public.tcg_card_versions where card_id = p_id;
  delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = p_id and market = p_market;
  -- La lápida: una carta de las APIs la volvería a crear su pasada. Las de a
  -- mano no las crea nadie más.
  if v_origen is distinct from 'mano' then
    insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
    values ('tcg_cards', p_id, p_market, '__borrada', 'true'::jsonb, null, auth.uid(), now())
    on conflict (tabla, id, market, columna) do update set updated_at = now();
  end if;
  delete from public.tcg_cards where id = p_id and market = p_market;
  return v_quien || jsonb_build_object('borrada', p_id, 'destino', p_destino);
end;
$$;

revoke all on function public.catalogo_borrar_carta(text, text, text) from public, anon;
grant execute on function public.catalogo_borrar_carta(text, text, text) to authenticated, service_role;

-- El disparador de la 885, con la lápida: una fila borrada a mano no se
-- vuelve a escribir (un `insert … on conflict` de una pasada se salta esa
-- fila sin error).
create or replace function public.catalogo_aplicar_correcciones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_object_agg(c.columna, c.valor) into v
    from public.tcg_correcciones c
   where c.tabla = TG_TABLE_NAME and c.id = new.id and c.market = new.market;
  if v ? '__borrada' then
    return null;
  end if;
  if v is not null then
    new := jsonb_populate_record(new, v);
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
