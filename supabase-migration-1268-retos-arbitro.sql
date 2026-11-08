-- Tanda 1268 — los retos sin trampas: la base es el ÁRBITRO.
--
-- PINGU: «revisa todos los minijuegos… para que ningún listillo haga
-- trampa». Hasta aquí la respuesta de cada reto viajaba al navegador (la
-- carta del día entera, los precios, la expansión buena, el Pokémon de la
-- silueta salía de la fecha) y la XP la daba `retos_guardar` creyéndose lo
-- que le mandaran: con F12 se veía la respuesta y con una línea en la
-- consola se cobraban 50 XP sin jugar. Desde aquí:
--
--   · Lo que hace falta para corregir vive en `retos_arbitro`, que NO lee
--     nadie: lo escriben las funciones de Netlify (con la clave de servicio)
--     al elegir el reto del día. Las tablas del día de antes dejan de ser
--     públicas por lo mismo (con su id se sacaba la carta, y con la carta su
--     precio).
--   · Cada jugada pasa por `retos_jugar`, que corrige y devuelve SOLO lo que
--     esa jugada destapa. Con cuenta, la partida vive aquí (`retos_partidas`)
--     y al acabar la XP la apunta esta misma función: `retos_guardar` deja de
--     poder llamarse desde fuera. Sin cuenta (o en una partida libre), la
--     partida viaja CIFRADA en una ficha que solo esta base sabe abrir.
--
-- Lo que no se puede evitar, y conviene tenerlo escrito: el reto es el mismo
-- para todo el mundo, así que quien lo juega antes en una ventana privada (o
-- con otra cuenta, o se lo chiva un amigo) se sabe la respuesta. Pasa en
-- todos los juegos diarios. Lo que se cierra es que la respuesta esté en la
-- página y que la XP se pueda pedir sin jugar.
--
-- Cada sentencia se puede ejecutar por su lado (tanda 631) y la migración
-- entera se puede volver a ejecutar. Necesita las de los retos
-- (supabase-migration-retos-xp.sql, 989 y 991).
-- ─────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── La llave de las fichas (solo la lee la base) ──
create table if not exists public.retos_llave (
  id int primary key default 1 check (id = 1),
  llave text not null
);
alter table public.retos_llave enable row level security;
revoke all on public.retos_llave from public, anon, authenticated;
insert into public.retos_llave (id, llave)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- ── Lo que sabe el árbitro de cada reto y día (también los días de las
-- partidas libres, que son de 1900: js/retos-libre.js) ──
create table if not exists public.retos_arbitro (
  juego text not null,
  day date not null,
  datos jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (juego, day)
);
alter table public.retos_arbitro enable row level security;
revoke all on public.retos_arbitro from public, anon, authenticated;
grant all on public.retos_arbitro to service_role;

-- ── Las partidas con cuenta: una por reto y día ──
create table if not exists public.retos_partidas (
  user_id uuid not null references auth.users (id) on delete cascade,
  juego text not null,
  day date not null,
  estado jsonb not null,
  guardado jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, juego, day)
);
alter table public.retos_partidas enable row level security;
revoke all on public.retos_partidas from public, anon, authenticated;

-- ── Las tablas del día dejan de ser públicas ──
do $$
begin
  if to_regclass('public.carta_del_dia') is not null then
    execute 'drop policy if exists "carta_del_dia_lectura" on public.carta_del_dia';
    execute 'revoke select on public.carta_del_dia from anon, authenticated';
  end if;
  if to_regclass('public.mas_caro_del_dia') is not null then
    execute 'drop policy if exists mas_caro_del_dia_ver on public.mas_caro_del_dia';
    execute 'revoke select on public.mas_caro_del_dia from anon, authenticated';
  end if;
  if to_regclass('public.retos_reto_del_dia') is not null then
    execute 'drop policy if exists retos_reto_del_dia_ver on public.retos_reto_del_dia';
    execute 'revoke select on public.retos_reto_del_dia from anon, authenticated';
  end if;
end $$;

-- ── `retos_guardar` ya no se llama desde fuera: la llama `retos_jugar` ──
revoke execute on function public.retos_guardar(text, date, int, int, int, boolean, boolean[], jsonb) from public, anon, authenticated;

-- ── Lo de comparar cartas, igual que js/carta-del-dia.js ──
-- (test-tanda-1268 compara las dos con las mismas cartas.)
create or replace function public.retos_clave_nombre(p text)
returns text language sql immutable set search_path = public as $$
  select trim(regexp_replace(lower(public.immutable_unaccent(coalesce(p, ''))), '\s+', ' ', 'g'))
$$;

create or replace function public.retos_numero_limpio(p text)
returns text language sql immutable as $$
  select regexp_replace(lower(trim(coalesce(p, ''))), '^0+(?=[0-9])', '')
$$;

-- `rangoDeRareza`: de común (1) a la más rara (8), por su nombre en inglés.
create or replace function public.retos_rango_rareza(p text)
returns int language sql immutable as $$
  select case
    when r = '' then null
    when r ~ 'mega hyper' then 8
    when r ~ '(special illustration|hyper|rainbow|secret|shining|star|legend|gold)' then 7
    when r ~ '(ultra|illustration|shiny|radiant|amazing|full art|character|trainer gallery)' then 6
    when r ~ '(double|\yex\y|\ygx\y|\yv\y|vmax|vstar|prime|lv\.?x|break|ace)' then 5
    when r ~ 'holo' then 4
    when r ~ 'uncommon' then 2
    when r ~ 'common' then 1
    when r ~ '(rare|promo)' then 3
    else null
  end
  from (select lower(coalesce(p, '')) as r) x
$$;

-- Las cuatro casillas de un intento (`compararDetallado`): la carta que
-- dices sale del catálogo, nunca de lo que mande el navegador.
create or replace function public.retos_carta_det(p_id text, p_r jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  g record;
  v_misma boolean;
  v_mismo_nombre boolean;
  v_familia boolean;
  v_nombre text;
  v_ei text;
  v_er text;
  v_fi date;
  v_fr date;
  v_misma_era boolean;
  v_ti text;
  v_tr text;
  v_zi text;
  v_zr text;
  v_ri int;
  v_rr int;
  v_misma_rareza boolean;
begin
  select c.id, c.set_id, c.local_id, c.name, c.dex_ids, c.types, c.rarity, c.rarity_en, s.serie_id, s.release_date
    into g
    from public.tcg_cards c
    left join public.tcg_sets s on s.id = c.set_id and s.market = c.market
   where c.id = p_id and c.market = 'WEST';
  if not found then raise exception 'reto: esa carta no está en el catálogo'; end if;

  v_mismo_nombre := public.retos_clave_nombre(g.name) = public.retos_clave_nombre(p_r->>'name');
  v_misma := g.id = p_r->>'id'
    or (coalesce(g.set_id, '') <> '' and g.set_id = p_r->>'set_id'
        and public.retos_numero_limpio(g.local_id) = public.retos_numero_limpio(p_r->>'local_id')
        and v_mismo_nombre);
  v_familia := coalesce(g.dex_ids && array(select jsonb_array_elements_text(coalesce(p_r->'familia', '[]'::jsonb))::int), false);
  v_nombre := case when v_misma then 'si' when v_mismo_nombre or v_familia then 'casi' else 'no' end;

  v_ei := lower(coalesce(g.serie_id, ''));
  v_er := lower(coalesce(p_r->>'serie_id', ''));
  v_misma_era := v_ei <> '' and v_ei = v_er;
  v_fi := g.release_date;
  v_fr := nullif(left(coalesce(p_r->>'release_date', ''), 10), '')::date;

  v_ti := lower(coalesce(g.types[1], ''));
  v_tr := lower(coalesce(p_r->'types'->>0, ''));

  v_zi := lower(coalesce(nullif(g.rarity_en, ''), nullif(g.rarity, ''), ''));
  v_zr := lower(coalesce(nullif(p_r->>'rarity_en', ''), nullif(p_r->>'rarity', ''), ''));
  v_ri := public.retos_rango_rareza(v_zi);
  v_rr := public.retos_rango_rareza(v_zr);
  v_misma_rareza := v_zi <> '' and v_zi = v_zr;

  return jsonb_build_object(
    'nombre', jsonb_build_object('estado', v_nombre, 'flecha', null)
              || case when v_nombre = 'casi' and v_mismo_nombre then jsonb_build_object('motivo', 'impresion') else '{}'::jsonb end,
    'era', jsonb_build_object(
      'estado', case when v_misma_era then 'si' when v_fi is not null and v_fr is not null and abs(v_fi - v_fr) <= 365 then 'casi' else 'no' end,
      'flecha', case when not v_misma_era and v_fi is not null and v_fr is not null and v_fi <> v_fr then case when v_fr > v_fi then 'nueva' else 'antigua' end end),
    'tipo', jsonb_build_object('estado', case when v_ti <> '' and v_ti = v_tr then 'si' else 'no' end, 'flecha', null),
    'rareza', jsonb_build_object(
      'estado', case when v_misma_rareza then 'si' when v_ri is not null and v_rr is not null and abs(v_ri - v_rr) = 1 then 'casi' else 'no' end,
      'flecha', case when not v_misma_rareza and v_ri is not null and v_rr is not null and v_ri <> v_rr then case when v_rr > v_ri then 'rara' else 'comun' end end)
  );
end;
$$;

-- ── Las piezas del árbitro, una por reto ──
create or replace function public.retos_estado_inicial(p_juego text, p_dia date)
returns jsonb language sql volatile as $$
  select jsonb_build_object('dia', p_dia::text) || case p_juego
    when 'carta' then jsonb_build_object('intentos', '[]'::jsonb, 'acertada', false)
    when 'caro' then jsonb_build_object('respuestas', '[]'::jsonb)
    when 'silueta' then jsonb_build_object('elegidos', '[]'::jsonb, 'acertada', false)
    when 'ordena' then jsonb_build_object('intentos', '[]'::jsonb, 'acertada', false)
    when 'expansion' then jsonb_build_object('elegidas', '[]'::jsonb, 'tira', '[]'::jsonb)
    -- La mesa de Parejas se baraja POR PARTIDA, aquí: si saliera de la fecha
    -- (como hasta la 1267) estaría en el código de la página.
    when 'parejas' then jsonb_build_object('movimientos', 0, 'hechas', '[]'::jsonb, 'tira', '[]'::jsonb, 'abierta', null,
      'mesa', (select jsonb_agg(x order by random()) from (select g % 6 as x from generate_series(0, 11) g) t))
    else '{}'::jsonb
  end
$$;

create or replace function public.retos_terminada(p_juego text, p_datos jsonb, e jsonb)
returns boolean language sql immutable as $$
  select coalesce((e->>'cerrada')::boolean, false) or case p_juego
    when 'carta' then coalesce((e->>'acertada')::boolean, false) or jsonb_array_length(coalesce(e->'intentos', '[]')) >= 6
    when 'caro' then jsonb_array_length(coalesce(e->'respuestas', '[]')) >= 5
    when 'silueta' then coalesce((e->>'acertada')::boolean, false)
      or jsonb_array_length(coalesce(e->'elegidos', '[]')) - case when coalesce((e->>'acertada')::boolean, false) then 1 else 0 end >= 3
    when 'ordena' then coalesce((e->>'acertada')::boolean, false) or jsonb_array_length(coalesce(e->'intentos', '[]')) >= 3
    when 'expansion' then jsonb_array_length(coalesce(e->'elegidas', '[]')) >= 5
    when 'parejas' then jsonb_array_length(coalesce(e->'hechas', '[]')) >= 6
    else false
  end
$$;

-- Cuáles están en su sitio en un orden de «Ordena por precio».
create or replace function public.retos_ordena_bien(p_precios jsonb, p_orden jsonb)
returns jsonb language sql immutable as $$
  with bueno as (
    select x.k, (row_number() over (order by (p_precios->>x.k)::numeric, x.k) - 1)::int as i
      from jsonb_object_keys(p_precios) as x(k)
  )
  select coalesce(jsonb_agg(coalesce(o.v = b.k, false) order by o.n), '[]'::jsonb)
    from jsonb_array_elements_text(p_orden) with ordinality as o(v, n)
    left join bueno b on b.i = o.n - 1
$$;

-- Una jugada: devuelve { estado, eco } o se niega. Lo que valida está aquí
-- y no en la página: la página solo pinta.
create or replace function public.retos_mover(p_juego text, p_datos jsonb, e jsonb, j jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_n int;
  v_det jsonb;
  v_bien boolean;
  v_a numeric;
  v_b numeric;
  v_txt text;
  v_dex int;
  v_hueco int;
  v_carta int;
  v_otro int;
  v_pareja boolean;
  v_orden jsonb;
  v_bienes jsonb;
begin
  if public.retos_terminada(p_juego, p_datos, e) then raise exception 'reto: esta partida ya está acabada'; end if;
  if p_juego = 'carta' then
    v_txt := j->>'carta';
    if coalesce(v_txt, '') = '' then raise exception 'reto: falta la carta'; end if;
    v_det := public.retos_carta_det(v_txt, p_datos->'respuesta');
    e := jsonb_set(e, '{intentos}', coalesce(e->'intentos', '[]') || jsonb_build_array(jsonb_build_object('id', v_txt, 'det', v_det)));
    if v_det->'nombre'->>'estado' = 'si' then e := jsonb_set(e, '{acertada}', 'true'); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('det', v_det));
  elsif p_juego = 'caro' then
    v_txt := j->>'respuesta';
    if v_txt not in ('mas', 'menos') then raise exception 'reto: respuesta desconocida'; end if;
    v_n := jsonb_array_length(coalesce(e->'respuestas', '[]'));
    v_a := (p_datos->'precios'->>v_n)::numeric;
    v_b := (p_datos->'precios'->>(v_n + 1))::numeric;
    if v_a is null or v_b is null then raise exception 'reto: no hay más rondas'; end if;
    v_bien := (v_txt = 'mas' and v_b > v_a) or (v_txt = 'menos' and v_b < v_a);
    e := jsonb_set(e, '{respuestas}', coalesce(e->'respuestas', '[]') || to_jsonb(v_bien));
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bien, 'precio', v_b));
  elsif p_juego = 'silueta' then
    v_dex := (j->>'dex')::int;
    if v_dex is null or not (p_datos->'opciones' @> to_jsonb(v_dex)) then raise exception 'reto: esa opción no está'; end if;
    if coalesce(e->'elegidos', '[]') @> to_jsonb(v_dex) then raise exception 'reto: esa ya la has dicho'; end if;
    v_bien := v_dex = (p_datos->>'buena')::int;
    e := jsonb_set(e, '{elegidos}', coalesce(e->'elegidos', '[]') || to_jsonb(v_dex));
    if v_bien then e := jsonb_set(e, '{acertada}', 'true'); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bien));
  elsif p_juego = 'ordena' then
    v_orden := j->'orden';
    if jsonb_typeof(v_orden) <> 'array' or jsonb_array_length(v_orden) <> (select count(*) from jsonb_object_keys(p_datos->'precios'))
       or (select count(distinct x.v) from jsonb_array_elements_text(v_orden) as x(v) where p_datos->'precios' ? x.v) <> jsonb_array_length(v_orden) then
      raise exception 'reto: ese orden no vale';
    end if;
    v_bienes := public.retos_ordena_bien(p_datos->'precios', v_orden);
    e := jsonb_set(e, '{intentos}', coalesce(e->'intentos', '[]') || jsonb_build_array(v_orden));
    if not (v_bienes @> '[false]') then e := jsonb_set(e, '{acertada}', 'true'); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bienes));
  elsif p_juego = 'expansion' then
    v_txt := j->>'set';
    v_n := jsonb_array_length(coalesce(e->'elegidas', '[]'));
    if coalesce(v_txt, '') = '' or (p_datos->'opciones'->v_n is not null and not (p_datos->'opciones'->v_n @> to_jsonb(v_txt))) then
      raise exception 'reto: esa expansión no está entre las de esta carta';
    end if;
    v_bien := v_txt = p_datos->'buenas'->>v_n;
    e := jsonb_set(jsonb_set(e, '{elegidas}', coalesce(e->'elegidas', '[]') || to_jsonb(v_txt)), '{tira}', coalesce(e->'tira', '[]') || to_jsonb(v_bien));
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bien, 'buena', p_datos->'buenas'->>v_n));
  elsif p_juego = 'parejas' then
    v_hueco := (j->>'hueco')::int;
    if v_hueco is null or v_hueco < 0 or v_hueco > 11 then raise exception 'reto: ese hueco no existe'; end if;
    v_carta := (e->'mesa'->>v_hueco)::int;
    if coalesce(e->'hechas', '[]') @> to_jsonb(v_carta) then raise exception 'reto: esa pareja ya está hecha'; end if;
    v_otro := (e->>'abierta')::int;
    if v_otro is null then
      e := jsonb_set(e, '{abierta}', to_jsonb(v_hueco));
      return jsonb_build_object('estado', e, 'eco', jsonb_build_object('hueco', v_hueco, 'carta', v_carta));
    end if;
    if v_otro = v_hueco then raise exception 'reto: esa ya está vuelta'; end if;
    v_pareja := (e->'mesa'->>v_otro)::int = v_carta;
    e := jsonb_set(e, '{abierta}', 'null');
    e := jsonb_set(e, '{movimientos}', to_jsonb(coalesce((e->>'movimientos')::int, 0) + 1));
    e := jsonb_set(e, '{tira}', coalesce(e->'tira', '[]') || to_jsonb(v_pareja));
    if v_pareja then e := jsonb_set(e, '{hechas}', coalesce(e->'hechas', '[]') || to_jsonb(v_carta)); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('hueco', v_hueco, 'carta', v_carta, 'otro', v_otro, 'otraCarta', (e->'mesa'->>v_otro)::int, 'pareja', v_pareja));
  end if;
  raise exception 'reto: juego desconocido';
end;
$$;

-- Lo que la página puede ver de una partida: lo jugado y lo que ha
-- destapado, NUNCA lo que falta (ni la mesa de Parejas).
create or replace function public.retos_vista(p_juego text, p_datos jsonb, e jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_fin boolean := public.retos_terminada(p_juego, p_datos, e);
  v_n int;
  v_pub jsonb := e - 'mesa' - 'abierta' - 'cerrada';
  v_pistas jsonb := '{}'::jsonb;
  v_k text;
  v_i int := 0;
begin
  if p_juego = 'carta' then
    v_n := jsonb_array_length(coalesce(e->'intentos', '[]'));
    foreach v_k in array array['era', 'tipo', 'rareza', 'ilustrador', 'inicial'] loop
      exit when not v_fin and v_i >= v_n;
      v_pistas := v_pistas || jsonb_build_object(v_k, p_datos->'pistas'->v_k);
      v_i := v_i + 1;
    end loop;
    return v_pub || jsonb_build_object('terminada', v_fin, 'pistas', v_pistas,
      'foto', case when v_fin then null else p_datos->'fotos'->>least(v_n, 5) end,
      'respuesta', case when v_fin then p_datos->'respuesta'->>'id' end);
  elsif p_juego = 'caro' then
    v_n := jsonb_array_length(coalesce(e->'respuestas', '[]'));
    return v_pub || jsonb_build_object('terminada', v_fin,
      'precios', (select coalesce(jsonb_agg(p order by i), '[]'::jsonb) from jsonb_array_elements(p_datos->'precios') with ordinality as x(p, i) where i <= v_n + 1));
  elsif p_juego = 'silueta' then
    v_n := jsonb_array_length(coalesce(e->'elegidos', '[]')) - case when coalesce((e->>'acertada')::boolean, false) then 1 else 0 end;
    return v_pub || jsonb_build_object('terminada', v_fin,
      'foto', case when v_fin then null else p_datos->'fotos'->>least(v_n, 2) end,
      'buena', case when v_fin then (p_datos->>'buena')::int end);
  elsif p_juego = 'ordena' then
    return v_pub || jsonb_build_object('terminada', v_fin,
      'bien', (select coalesce(jsonb_agg(public.retos_ordena_bien(p_datos->'precios', o) order by i), '[]'::jsonb) from jsonb_array_elements(coalesce(e->'intentos', '[]')) with ordinality as x(o, i)),
      'precios', case when v_fin then p_datos->'precios' end);
  elsif p_juego = 'expansion' then
    v_n := jsonb_array_length(coalesce(e->'elegidas', '[]'));
    return v_pub || jsonb_build_object('terminada', v_fin,
      'buenas', (select coalesce(jsonb_agg(b order by i), '[]'::jsonb) from jsonb_array_elements(coalesce(p_datos->'buenas', '[]')) with ordinality as x(b, i) where i <= v_n));
  elsif p_juego = 'parejas' then
    return v_pub || jsonb_build_object('terminada', v_fin,
      -- Las que ya están hechas, en su hueco (para volver a la mesa a medias).
      'descubiertas', (select coalesce(jsonb_object_agg(h - 1, c), '{}'::jsonb) from jsonb_array_elements(coalesce(e->'mesa', '[]')) with ordinality as x(c, h) where coalesce(e->'hechas', '[]') @> c),
      'abierta', case when e->>'abierta' is not null then jsonb_build_object('hueco', (e->>'abierta')::int, 'carta', (e->'mesa'->>((e->>'abierta')::int))::int) end);
  end if;
  return v_pub || jsonb_build_object('terminada', v_fin);
end;
$$;

-- El resultado que se apunta (lo que `retos_xp` necesita), sacado de la
-- partida y nunca de lo que diga la página.
create or replace function public.retos_resultado(p_juego text, e jsonb)
returns jsonb language sql immutable as $$
  select case p_juego
    when 'carta' then jsonb_build_object('aciertos', case when (e->>'acertada')::boolean then 1 else 0 end, 'total', 1,
      'intentos', jsonb_array_length(coalesce(e->'intentos', '[]')), 'acertada', coalesce((e->>'acertada')::boolean, false))
    when 'caro' then jsonb_build_object('aciertos', (select count(*) from jsonb_array_elements(coalesce(e->'respuestas', '[]')) as x(b) where x.b = 'true'::jsonb),
      'total', 5, 'acertada', false, 'tira', coalesce(e->'respuestas', '[]'))
    when 'silueta' then jsonb_build_object('aciertos', case when (e->>'acertada')::boolean then 1 else 0 end, 'total', 1,
      'intentos', jsonb_array_length(coalesce(e->'elegidos', '[]')), 'acertada', coalesce((e->>'acertada')::boolean, false))
    when 'ordena' then jsonb_build_object('aciertos', case when (e->>'acertada')::boolean then 1 else 0 end, 'total', 1,
      'intentos', jsonb_array_length(coalesce(e->'intentos', '[]')), 'acertada', coalesce((e->>'acertada')::boolean, false))
    when 'expansion' then jsonb_build_object('aciertos', (select count(*) from jsonb_array_elements(coalesce(e->'tira', '[]')) as x(b) where x.b = 'true'::jsonb),
      'total', 5, 'acertada', false, 'tira', coalesce(e->'tira', '[]'))
    when 'parejas' then jsonb_build_object('aciertos', 6, 'total', 6, 'intentos', coalesce((e->>'movimientos')::int, 0), 'acertada', true, 'tira', coalesce(e->'tira', '[]'))
  end
$$;

-- ── La puerta: una jugada (o ninguna, para abrir la partida) ──
--
-- Con cuenta y en el reto del día, la partida es la de `retos_partidas` y
-- `p_ficha` solo sirve para TRAERSE la que empezaste sin cuenta (salvo en
-- Parejas: ahí la ficha se puede repetir desde un punto para ver huecos sin
-- que cuenten, y una partida así no se apunta). Sin cuenta o en una libre,
-- la partida viaja en `ficha`, cifrada.
create or replace function public.retos_jugar(p_juego text, p_dia date, p_libre int default null, p_jugada jsonb default null, p_ficha text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_cuenta boolean;
  v_llave text;
  v_datos jsonb;
  v_estado jsonb;
  v_de_ficha jsonb;
  v_r jsonb;
  v_eco jsonb;
  v_guardado jsonb;
  v_fin jsonb;
  v_ficha text;
  v_xp int;
  v_hay boolean;
begin
  if p_juego is null or p_juego not in ('carta', 'caro', 'silueta', 'ordena', 'expansion', 'parejas') then
    raise exception 'reto: juego desconocido';
  end if;
  if p_libre is not null then
    if p_libre < 1 or p_libre > 1000 then raise exception 'reto: esa partida libre no existe'; end if;
    if p_dia is distinct from date '1900-01-01' + p_libre then raise exception 'reto: ese día no es el de la partida libre'; end if;
  elsif p_dia is null or p_dia < current_date - 1 or p_dia > current_date + 1 then
    raise exception 'reto: ese día no es el de hoy';
  end if;
  if p_jugada is not null and octet_length(p_jugada::text) > 2000 then raise exception 'reto: jugada demasiado larga'; end if;
  if p_ficha is not null and octet_length(p_ficha) > 12000 then raise exception 'reto: ficha demasiado larga'; end if;

  select a.datos into v_datos from public.retos_arbitro a where a.juego = p_juego and a.day = p_dia;
  if v_datos is null and p_juego <> 'parejas' then raise exception 'reto: todavía no hay reto para ese día'; end if;
  select l.llave into v_llave from public.retos_llave l where l.id = 1;

  -- La ficha, si viene y es de esta partida.
  if p_ficha is not null and p_ficha <> '' then
    begin
      v_de_ficha := pgp_sym_decrypt(decode(p_ficha, 'base64'), v_llave)::jsonb;
    exception when others then
      v_de_ficha := null;
    end;
    if v_de_ficha is not null and (v_de_ficha->>'j' is distinct from p_juego or v_de_ficha->>'d' is distinct from p_dia::text
       or (v_de_ficha->>'l')::int is distinct from p_libre) then
      v_de_ficha := null;
    end if;
  end if;

  v_cuenta := v_uid is not null and p_libre is null;
  if v_cuenta then
    select p.estado, p.guardado into v_estado, v_guardado from public.retos_partidas p
     where p.user_id = v_uid and p.juego = p_juego and p.day = p_dia for update;
    v_hay := found;
    if not v_hay then
      -- Lo que ya apuntaste hoy antes de la 1268: hecho, y no se vuelve a jugar.
      select r.xp, r.estado into v_xp, v_r from public.retos_resultados r where r.user_id = v_uid and r.juego = p_juego and r.day = p_dia;
      if found then
        v_estado := public.retos_estado_inicial(p_juego, p_dia) || coalesce(v_r, '{}'::jsonb) || '{"cerrada": true}'::jsonb;
        v_guardado := jsonb_build_object('nuevo', false, 'xp', v_xp);
      elsif v_de_ficha is not null and p_juego <> 'parejas' then
        v_estado := v_de_ficha->'e';
      else
        v_estado := public.retos_estado_inicial(p_juego, p_dia);
      end if;
      insert into public.retos_partidas (user_id, juego, day, estado, guardado) values (v_uid, p_juego, p_dia, v_estado, v_guardado);
    end if;
  else
    v_estado := coalesce(v_de_ficha->'e', public.retos_estado_inicial(p_juego, p_dia));
  end if;

  if p_jugada is not null then
    v_r := public.retos_mover(p_juego, v_datos, v_estado, p_jugada);
    v_estado := v_r->'estado';
    v_eco := v_r->'eco';
  end if;

  if v_cuenta then
    -- Acabada y sin apuntar: se apunta aquí, con lo que dice la partida.
    if public.retos_terminada(p_juego, v_datos, v_estado) and v_guardado is null then
      v_fin := public.retos_resultado(p_juego, v_estado);
      begin
        v_guardado := public.retos_guardar(
          p_juego, p_dia, (v_fin->>'aciertos')::int, (v_fin->>'total')::int, (v_fin->>'intentos')::int,
          coalesce((v_fin->>'acertada')::boolean, false),
          case when v_fin ? 'tira' then array(select x.b::boolean from jsonb_array_elements_text(v_fin->'tira') as x(b)) end,
          v_estado - 'mesa' - 'abierta' - 'cerrada');
      exception when others then
        -- Si no se puede apuntar (sin perfil, por ejemplo), la partida
        -- sigue y se volverá a intentar al abrirla.
        v_guardado := null;
        v_eco := coalesce(v_eco, '{}'::jsonb) || jsonb_build_object('sinGuardar', sqlerrm);
      end;
    end if;
    update public.retos_partidas p set estado = v_estado, guardado = v_guardado, updated_at = now()
     where p.user_id = v_uid and p.juego = p_juego and p.day = p_dia;
  else
    v_ficha := translate(encode(pgp_sym_encrypt(jsonb_build_object('j', p_juego, 'd', p_dia::text, 'l', p_libre, 'e', v_estado)::text, v_llave), 'base64'), E'\n', '');
  end if;

  return jsonb_build_object(
    'juego', p_juego,
    'dia', p_dia::text,
    'cuenta', v_cuenta,
    'estado', public.retos_vista(p_juego, v_datos, v_estado),
    'eco', v_eco,
    'ficha', v_ficha,
    'guardado', v_guardado
  );
end;
$$;

-- Las piezas no se llaman desde fuera; la puerta, sí (con o sin cuenta).
revoke all on function public.retos_carta_det(text, jsonb) from public, anon, authenticated;
revoke all on function public.retos_estado_inicial(text, date) from public, anon, authenticated;
revoke all on function public.retos_terminada(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.retos_ordena_bien(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.retos_mover(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.retos_vista(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.retos_resultado(text, jsonb) from public, anon, authenticated;
revoke all on function public.retos_jugar(text, date, int, jsonb, text) from public;
grant execute on function public.retos_jugar(text, date, int, jsonb, text) to anon, authenticated;

notify pgrst, 'reload schema';
