-- ════════════════════════════════════════════════════════════════════
-- Tanda 885: el editor del catálogo en /admin, y lo corregido a mano GANA.
--
-- PINGU: «meteme el catálogo de cartas y expansiones en el admin para
-- poder editar todos los datos por si alguna está mal. Debería ser
-- reemplazable lo que meto a mano sobre lo que está automático». El
-- problema no es editar —el admin ya puede escribir en tcg_sets y
-- tcg_cards (políticas tcg_*_write)—, sino que las pasadas automáticas
-- (el calco japonés, tcggo_guardar_cartas, cartas-detalle, los
-- reemplazos) reescriben la fila y se llevan la corrección por delante.
--
-- La solución: cada corrección se APUNTA aparte (`tcg_correcciones`:
-- tabla, fila, columna, valor y lo que había antes) y un disparador
-- `before insert or update` en las dos tablas vuelve a poner lo corregido
-- encima de lo que escriba cualquiera. Así una corrección sobrevive a
-- cualquier pasada, y quitarla (`catalogo_descorregir`) devuelve el valor
-- de antes. Se escribe por `catalogo_corregir`, que exige ser admin y solo
-- admite las columnas de la lista.
--
-- Ejecutar en el SQL Editor de Supabase. Cada sentencia se sostiene sola
-- (la 631). No borra ni cambia nada de lo que hay.
-- ════════════════════════════════════════════════════════════════════

-- 1. Las correcciones ───────────────────────────────────────────────
create table if not exists public.tcg_correcciones (
  tabla text not null check (tabla in ('tcg_sets', 'tcg_cards')),
  id text not null,
  market text not null default 'WEST',
  columna text not null,
  valor jsonb,
  -- Lo que valía la columna antes de la primera corrección: es a lo que se
  -- vuelve al quitarla.
  anterior jsonb,
  autor uuid,
  updated_at timestamptz not null default now(),
  primary key (tabla, id, market, columna)
);

comment on table public.tcg_correcciones is
  'Lo corregido a mano en el catálogo (885). El disparador catalogo_aplicar_correcciones lo vuelve a poner encima de cualquier escritura automática.';

alter table public.tcg_correcciones enable row level security;

-- Las lee el admin (el editor enseña qué campos están corregidos); las
-- escriben solo las funciones de abajo.
drop policy if exists correcciones_leer on public.tcg_correcciones;
create policy correcciones_leer on public.tcg_correcciones
  for select to authenticated using (is_admin());

grant select on public.tcg_correcciones to authenticated, service_role;

-- 2. El disparador: lo corregido, encima de lo que escriba cualquiera ──
-- `security definer`: corre con el rol de QUIEN ESCRIBE la fila (una
-- pasada con la clave de servicio, el admin desde el editor), y ese rol
-- no tiene por qué poder leer las correcciones; la lectura va con el
-- dueño de la función.
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
  if v is not null then
    new := jsonb_populate_record(new, v);
  end if;
  return new;
end;
$$;

drop trigger if exists catalogo_correcciones_sets on public.tcg_sets;
create trigger catalogo_correcciones_sets
  before insert or update on public.tcg_sets
  for each row execute function public.catalogo_aplicar_correcciones();

drop trigger if exists catalogo_correcciones_cards on public.tcg_cards;
create trigger catalogo_correcciones_cards
  before insert or update on public.tcg_cards
  for each row execute function public.catalogo_aplicar_correcciones();

-- 3. Qué columnas se pueden corregir ──────────────────────────────────
-- Una lista a propósito: nada de ids, claves de emparejamiento
-- (tcggo_id, scrydex_id, cm_por…) ni fechas de las pasadas.
create or replace function public.catalogo_columnas_corregibles(p_tabla text)
returns text[]
language sql
immutable
as $$
  select case p_tabla
    when 'tcg_cards' then array['name', 'name_en', 'name_es', 'local_id', 'set_id', 'rarity', 'rarity_en', 'category', 'hp', 'types', 'stage', 'evolve_from', 'retreat', 'attacks', 'abilities', 'weaknesses', 'resistances', 'trainer_type', 'energy_type', 'illustrator', 'description', 'dex_ids', 'regulation_mark', 'variants', 'suffix', 'image_path', 'image_tcggo', 'image_scrydex', 'cm_id_product_propio', 'tp_id_product_propio', 'origen']
    when 'tcg_sets' then array['name', 'name_en', 'serie_id', 'serie_name', 'serie_name_en', 'release_date', 'card_count_official', 'card_count_total', 'tcg_online_code', 'logo_tcggo', 'logo_scrydex', 'logo_path', 'symbol_scrydex', 'oculto', 'orden', 'origen']
    else array[]::text[]
  end
$$;

-- 4. Corregir ───────────────────────────────────────────────────────
--
-- `p_cambios` es un objeto {columna: valor}. Cada columna queda apuntada
-- como corrección (con lo que había antes, la primera vez) y la fila se
-- escribe. Con `p_crear`, si la fila no existe se crea (una carta o un
-- set a mano): entonces nace con `origen = 'mano'` y sin correcciones, que
-- no hacen falta (nadie automático la va a pisar: no la conoce).
create or replace function public.catalogo_corregir(
  p_tabla text,
  p_id text,
  p_market text,
  p_cambios jsonb,
  p_crear boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_permitidas text[] := public.catalogo_columnas_corregibles(p_tabla);
  v_col text;
  v_existe boolean;
  v_fila jsonb;
  v_cols text;
  v_cambios jsonb := coalesce(p_cambios, '{}'::jsonb);
begin
  if v_yo is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_tabla not in ('tcg_sets', 'tcg_cards') then
    raise exception 'Tabla desconocida: %', p_tabla using errcode = '22023';
  end if;
  if p_market not in ('WEST', 'JP', 'TW', 'CN') then
    raise exception 'Mercado desconocido: %', p_market using errcode = '22023';
  end if;
  if jsonb_typeof(v_cambios) <> 'object' or v_cambios = '{}'::jsonb then
    raise exception 'No hay nada que cambiar.' using errcode = '22023';
  end if;
  for v_col in select jsonb_object_keys(v_cambios) loop
    if not (v_col = any (v_permitidas)) then
      raise exception 'La columna % no se puede corregir desde aquí.', v_col using errcode = '22023';
    end if;
  end loop;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
    into v_fila using p_id, p_market;
  v_existe := v_fila is not null;

  if not v_existe then
    if not p_crear then
      raise exception 'No existe % en % (%).', p_id, p_tabla, p_market using errcode = 'P0002';
    end if;
    v_cambios := v_cambios || jsonb_build_object('id', p_id, 'market', p_market);
    if not (v_cambios ? 'origen') then v_cambios := v_cambios || '{"origen": "mano"}'::jsonb; end if;
    if p_tabla = 'tcg_cards' and (coalesce(v_cambios->>'set_id', '') = '' or coalesce(v_cambios->>'local_id', '') = '' or coalesce(v_cambios->>'name', '') = '') then
      raise exception 'Una carta nueva necesita set_id, local_id y name.' using errcode = '22023';
    end if;
    if p_tabla = 'tcg_sets' and coalesce(v_cambios->>'name', '') = '' then
      raise exception 'Un set nuevo necesita name.' using errcode = '22023';
    end if;
    select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(v_cambios) k;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r', p_tabla, v_cols,
      (select string_agg(format('r.%I', k), ', ') from jsonb_object_keys(v_cambios) k), p_tabla)
      using v_cambios;
    execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
      into v_fila using p_id, p_market;
    return v_fila;
  end if;

  -- Las correcciones, con lo que había antes la primera vez.
  for v_col in select jsonb_object_keys(v_cambios) loop
    insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
    values (p_tabla, p_id, p_market, v_col, v_cambios->v_col, v_fila->v_col, v_yo, now())
    on conflict (tabla, id, market, columna) do update
      set valor = excluded.valor, autor = excluded.autor, updated_at = now();
  end loop;

  -- Y la fila: el disparador aplica las correcciones recién apuntadas, así
  -- que basta con tocarla; se escriben igual las columnas para no depender
  -- del orden.
  select string_agg(format('%I = r.%I', k, k), ', ') into v_cols from jsonb_object_keys(v_cambios) k;
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.market = $3', p_tabla, v_cols, p_tabla)
    using v_cambios, p_id, p_market;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
    into v_fila using p_id, p_market;
  return v_fila;
end;
$$;

revoke all on function public.catalogo_corregir(text, text, text, jsonb, boolean) from public, anon;
grant execute on function public.catalogo_corregir(text, text, text, jsonb, boolean) to authenticated, service_role;

-- 5. Quitar una corrección: vuelve lo que había antes ────────────────
create or replace function public.catalogo_descorregir(
  p_tabla text,
  p_id text,
  p_market text,
  p_columna text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior jsonb;
  v_habia boolean;
  v_fila jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_tabla not in ('tcg_sets', 'tcg_cards') then
    raise exception 'Tabla desconocida: %', p_tabla using errcode = '22023';
  end if;
  delete from public.tcg_correcciones
   where tabla = p_tabla and id = p_id and market = p_market and columna = p_columna
  returning anterior into v_anterior;
  v_habia := found;
  if not v_habia then
    raise exception 'Esa columna no estaba corregida.' using errcode = 'P0002';
  end if;
  execute format('update public.%I t set %I = r.%I from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.market = $3', p_tabla, p_columna, p_columna, p_tabla)
    using jsonb_build_object(p_columna, v_anterior), p_id, p_market;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
    into v_fila using p_id, p_market;
  return v_fila;
end;
$$;

revoke all on function public.catalogo_descorregir(text, text, text, text) from public, anon;
grant execute on function public.catalogo_descorregir(text, text, text, text) to authenticated, service_role;

-- 6. Borrar una carta hecha a mano ───────────────────────────────────
-- Solo las de `origen = 'mano'` (las de las APIs las trae y quita su
-- pasada) y solo si nadie la tiene apuntada: una línea de colección sin
-- su carta se queda huérfana sin dar error (la 654).
create or replace function public.catalogo_borrar_carta(p_id text, p_market text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select origen into v_origen from public.tcg_cards where id = p_id and market = p_market;
  if v_origen is null then
    raise exception 'Esa carta no existe.' using errcode = 'P0002';
  end if;
  if v_origen <> 'mano' then
    raise exception 'Solo se borran las cartas hechas a mano; las demás las trae y quita su pasada.' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_collection where card_id = p_id) then
    raise exception 'Alguien tiene esa carta apuntada: no se borra.' using errcode = '23503';
  end if;
  delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = p_id and market = p_market;
  delete from public.tcg_cards where id = p_id and market = p_market;
  return true;
end;
$$;

revoke all on function public.catalogo_borrar_carta(text, text) from public, anon;
grant execute on function public.catalogo_borrar_carta(text, text) to authenticated, service_role;

-- 7. La foto subida a mano va al cubo de las guías (público, ya existe):
-- no hace falta otro. Y PostgREST se entera de las funciones nuevas:
notify pgrst, 'reload schema';

-- Comprobación: la tabla, los dos disparadores y las tres funciones.
select tgname from pg_trigger where tgname like 'catalogo_correcciones_%';
select proname from pg_proc where proname like 'catalogo_%';
