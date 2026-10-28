// Tanda 1073 — «Hoy» de una tienda: lo puro (el periodo y el anterior a la
// misma altura, la frase de la comparación) y `tienda_hoy` contra
// PostgreSQL: lo vendido y lo ganado en el periodo y en el anterior, la
// serie, el stock, los avisos (que tienen que contar LO MISMO que los
// filtros del stock), lo que busca la gente (sin la propia tienda, con la
// regla de idioma y versión) y las visitas al escaparate.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const P = await import(`${REPO}/js/tiendas-puro.js`)
console.log('── Lo puro ──')
{
  const ahora = new Date(2026, 9, 28, 18, 30)
  const t = (x) => +new Date(x)
  const hoy = P.periodoDeHoy('hoy', ahora)
  check('hoy: el día entero, por horas, contra ayer HASTA ESTA HORA', t(hoy.desde) === t(new Date(2026, 9, 28)) && t(hoy.hasta) === t(new Date(2026, 9, 29)) && t(hoy.antesDesde) === t(new Date(2026, 9, 27)) && t(hoy.antesHasta) === t(new Date(2026, 9, 27, 18, 30)) && hoy.paso === 'hour', JSON.stringify(hoy))
  const sem = P.periodoDeHoy('semana', ahora)
  check('la semana: siete días por días, contra los siete de antes', t(sem.desde) === t(new Date(2026, 9, 22)) && t(sem.antesDesde) === t(new Date(2026, 9, 15)) && t(sem.antesHasta) === t(new Date(2026, 9, 21, 18, 30)) && sem.paso === 'day')
  const mes = P.periodoDeHoy('mes', ahora)
  check('el mes: contra el mes pasado hasta el mismo día', t(mes.desde) === t(new Date(2026, 9, 1)) && t(mes.antesDesde) === t(new Date(2026, 8, 1)) && t(mes.antesHasta) === t(new Date(2026, 8, 28, 18, 30)))
  const fin = P.periodoDeHoy('mes', new Date(2026, 2, 31, 10))
  check('  …y el 31 de marzo contra el último de febrero', t(fin.antesHasta) === t(new Date(2026, 1, 28, 10)), new Date(fin.antesHasta).toString())
  const anio = P.periodoDeHoy('anio', ahora)
  check('el año: por meses, contra el año pasado a estas alturas', t(anio.desde) === t(new Date(2026, 0, 1)) && t(anio.antesHasta) === t(new Date(2025, 9, 28, 18, 30)) && anio.paso === 'month')
  check('la comparación: +18 % / −20 % / igual', P.comparacion(118, 100, 'que ayer a esta hora').texto === '+18 % que ayer a esta hora' && P.comparacion(80, 100, 'que ayer').texto === '−20 % que ayer' && P.comparacion(100, 100, 'que ayer').sube === null)
  check('  …sin nada antes no hay porcentaje', P.comparacion(5, 0, 'que ayer a esta hora').texto === 'Nada ayer a esta hora' && P.comparacion(0, 0, 'que ayer') === null && P.comparacion(5, null, 'que ayer') === null)
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1073'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1068-tienda-stock.sql`, 'utf8')
  const funcion = (fichero, nombre) => {
    const t = readFileSync(`${REPO}/${fichero}`, 'utf8')
    const i = t.indexOf(`create or replace function public.${nombre}(`)
    return t.slice(i, t.indexOf('$$;', t.indexOf('$$', t.indexOf('as $$', i) + 5)) + 3)
  }
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated, service_role;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function auth.role() returns text language sql as $f$ select nullif(current_setting('prueba.rol', true), '') $f$;
      create or replace function auth.email() returns text language sql as $f$ select nullif(current_setting('prueba.email', true), '') $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated, service_role;
      create table user_profiles (id uuid primary key, username text, display_name text, is_admin boolean not null default false, onboarding_completed boolean, created_at timestamptz not null default now());
      grant select, insert, update on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      create table user_collection (id uuid primary key default gen_random_uuid(), user_id uuid, card_id text, market text default 'WEST', idioma text default 'es', estado text default 'NM', variante text default 'normal', cantidad int default 1, gradeo text, valor_manual numeric(10,2), precio_compra numeric(10,2), notas text, created_at timestamptz default now(), updated_at timestamptz default now());
      create table tcg_sets (id text, market text default 'WEST', name text, primary key (id, market));
      create table tcg_cards (id text primary key, market text not null default 'WEST', set_id text, local_id text, name text, name_es text, name_search text, rarity text, rarity_en text);
      create table tcg_card_prices (card_id text primary key, cm_id_product int, cm_low numeric(10,2), cm_trend numeric(10,2), cm_avg30 numeric(10,2), cm_avg7 numeric(10,2),
        cm_trend_holo numeric(10,2), cm_avg30_holo numeric(10,2), cm_low_holo numeric(10,2),
        cm_low_es numeric(10,2), cm_low_en numeric(10,2), cm_low_de numeric(10,2), cm_low_fr numeric(10,2), cm_low_it numeric(10,2), cm_low_ja numeric(10,2),
        tp_market_eur numeric, tp_normal_market numeric, tp_normal_low numeric, tp_holo_market numeric, tp_holo_low numeric, tp_reverse_market numeric, tp_reverse_low numeric, tp_primera_market numeric, tp_primera_low numeric,
        cm_gradeadas jsonb, ebay_gradeadas jsonb);
      create table tcg_products (id bigint primary key, name text not null, cm_lowest numeric, cm_lowest_eu numeric, cm_lowest_es numeric);
      grant select on tcg_cards, tcg_card_prices, tcg_products, tcg_sets to anon, authenticated;`])
    check('el andamio carga', r.status === 0, r.stderr)
    for (const [fichero, nombre] of [['supabase-migration-precios-tcgplayer.sql', 'eur_por_usd'], ['supabase-migration-precios-tcgplayer.sql', 'tp_de_version'], ['supabase-migration-precios-tcgplayer.sql', 'emparejamiento_dudoso'], ['supabase-migration-905-gradeadas.sql', 'valor_gradeado'], ['supabase-migration-tcggo-japones.sql', 'valor_de_linea'], ['supabase-migration-1017-portada-consultas.sql', 'valor_de_copia']]) {
      r = psql(['-d', BD, '-c', funcion(fichero, nombre)])
      check(`  …con ${nombre} de verdad (${fichero})`, r.status === 0, r.stderr)
    }
    r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-1067-tiendas.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
    check('la 1067 entra', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1068 entra', r.status === 0, r.stderr)
    const m72 = readFileSync(`${REPO}/supabase-migration-1072-tienda-ventas.sql`, 'utf8')
    r = psql(['-d', BD, '-c', m72])
    check('la 1072 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', m72]).status === 0)
    r = psql(['-d', BD, '-c', 'create table user_wants (id uuid primary key default gen_random_uuid(), user_id uuid not null, card_id text not null, idioma text, variante text, created_at timestamptz not null default now()); grant select on user_wants to authenticated;'])
    const m73 = readFileSync(`${REPO}/supabase-migration-1073-tienda-hoy.sql`, 'utf8')
    r = psql(['-d', BD, '-c', m73])
    check('la 1073 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', m73]).status === 0)

    const T = '00000000-0000-0000-0000-0000000000b1'
    const OTRA = '00000000-0000-0000-0000-0000000000b2'
    const PERSONA = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${OTRA}'), ('${PERSONA}');
      insert into user_profiles (id, username, tipo, onboarding_completed) values ('${T}', 'rincon', 'tienda', true), ('${OTRA}', 'norte', 'tienda', true), ('${PERSONA}', 'ane', 'persona', true);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames'), ('sv8', 'WEST', 'Surging Sparks');
      insert into tcg_cards values
        ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv8-238', 'WEST', 'sv8', '238', 'Pikachu ex', 'Pikachu ex', 'pikachu ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Double Rare', 'Double Rare'),
        ('sv8-10', 'WEST', 'sv8', '10', 'Pidgey', 'Pidgey', 'pidgey', 'Common', 'Common');
      insert into tcg_card_prices (card_id, cm_low, cm_low_es, cm_low_en) values ('sv3-223', 80, 88.40, 90), ('sv8-238', 280, 301.50, 290), ('sv3-125', 4, 5, 4.5);
      insert into tcg_products values (501, 'Surging Sparks Elite Trainer Box', 70, 71, null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)

    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoOtra = `set prueba.uid = '${OTRA}'; set role authenticated;`
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, estado, variante, unidades, coste, precio, entro_el) values
      ('sv3-223', 'es', 'NM', 'normal', 2, 62, 80, now() - interval '5 days'),
      ('sv8-238', 'en', 'NM', 'reverse', 3, 210, 279, now() - interval '100 days'),
      ('sv3-125', 'es', 'EX', 'normal', 2, 6, 4, now() - interval '3 days'),
      ('sv8-10', 'es', 'NM', 'normal', 0, null, 1, now() - interval '1 days');
      insert into tienda_stock (product_id, estado, idioma, unidades, coste, precio, visible) values (501, 'sellado', 'en', 6, 44, 64.95, false);`)
    check('el stock de la prueba entra', r.ok, r.err)
    const id = (card) => q(`${comoT} select id from tienda_stock where card_id = '${card}'`).out
    const [cz, pk] = [id('sv3-223'), id('sv8-238')]
    const v1 = q(`${comoT} select tienda_vender('${JSON.stringify([{ stock_id: cz, unidades: 1, precio: 90 }])}'::jsonb, 'mostrador')`)
    const v2 = q(`${comoT} select tienda_vender('${JSON.stringify([{ stock_id: pk, unidades: 1, precio: 250 }])}'::jsonb, 'cardmarket')`)
    check('dos ventas', v1.ok && v2.ok, v1.err || v2.err)
    // Una de ayer y otra de hace dos meses, para el anterior y fuera de todo.
    q(`update tienda_ventas set vendida_el = date_trunc('day', now()) - interval '1 day' + interval '2 hours' where stock_id = '${pk}'`)
    q(`${comoT} select tienda_vender('${JSON.stringify([{ stock_id: cz, unidades: 1, precio: 85 }])}'::jsonb, 'otro')`)
    q(`update tienda_ventas set vendida_el = now() - interval '60 days' where precio = 85`)

    const hoy = (como, desde, hasta, ad, ah, paso = 'day') => { const x = q(`${como} select tienda_hoy(${desde}, ${hasta}, ${ad}, ${ah}, '${paso}', 'UTC')`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    let H = hoy(comoT, "date_trunc('day', now())", "date_trunc('day', now()) + interval '1 day'", "date_trunc('day', now()) - interval '1 day'", "date_trunc('day', now())", 'hour')
    check('hoy: la venta de hoy, con su beneficio', !H.error && Number(H.actual.importe) === 90 && Number(H.actual.beneficio) === 28 && H.actual.ventas === 1 && H.actual.unidades === 1, JSON.stringify(H.actual || H.error))
    check('  …y la de ayer en el anterior', Number(H.anterior?.importe) === 250 && Number(H.anterior.beneficio) === 40, JSON.stringify(H.anterior))
    check('  …la serie: 24 horas, con la venta en su hora', H.serie?.length === 24 && H.serie.reduce((n, s) => n + Number(s.importe), 0) === 90, H.serie?.length)
    const S = hoy(comoT, "date_trunc('day', now()) - interval '6 days'", "date_trunc('day', now()) + interval '1 day'", 'null', 'null')
    check('la semana: siete días, las dos ventas; sin anterior si no se pide', S.serie?.length === 7 && Number(S.actual.importe) === 340 && S.anterior === null, JSON.stringify(S.actual || S.error))
    const A = hoy(comoT, "date_trunc('year', now())", "date_trunc('year', now()) + interval '1 year'", 'null', 'null', 'month')
    check('el año: doce meses', A.serie?.length === 12)
    check('el stock (el Charizard, vendido entero): líneas, unidades y valor a tu precio', H.stock?.lineas === 5 && H.stock.unidades === 0 + 2 + 2 + 0 + 6 && Number(H.stock.valor) === 279 * 2 + 4 * 2 + 64.95 * 6, JSON.stringify(H.stock))

    console.log('── Los avisos cuentan lo mismo que los filtros del stock ──')
    const total = (f) => JSON.parse(q(`${comoT} select tienda_stock_lista('${JSON.stringify(f)}'::jsonb, 'recientes', 0, 1)`).out).total
    const pares = [['debajo', { contra: ['debajo'] }], ['pierden', { margen: ['pierdes'] }], ['viejas', { dias: ['90+'] }], ['agotadas', { unidades: ['agotadas'] }]]
    for (const [k, f] of pares) check(`${k}: ${H.avisos?.[k]} = ${total(f)}`, H.avisos?.[k] === total(f) && H.avisos[k] > 0)
    const vista = readFileSync(`${REPO}/js/tienda-hoy.js`, 'utf8')
    check('  …y cada aviso lleva al stock con ESE filtro', pares.every(([k, f]) => vista.includes(`${k}: ${JSON.stringify(f).replace(/"([a-z]+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`)))

    console.log('── Lo que busca la gente ──')
    const U = ['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3']
    r = q(`insert into user_wants (user_id, card_id, idioma, variante) values
      ('${U[0]}', 'sv8-238', null, null), ('${U[1]}', 'sv8-238', 'en', 'reverse'), ('${U[2]}', 'sv8-238', 'es', null),
      ('${U[0]}', 'sv3-223', 'es', null),
      ('${U[0]}', 'sv3-125', 'es', null), ('${U[1]}', 'sv3-125', 'es', 'holo'), ('${T}', 'sv3-125', null, null),
      ('${U[0]}', 'sv8-10', null, null)`)
    H = hoy(comoT, "date_trunc('day', now())", "date_trunc('day', now()) + interval '1 day'", 'null', 'null', 'hour')
    const dem = Object.fromEntries((H.demanda || []).map((d) => [d.card_id, d]))
    check('Pikachu: 2 (la japonesa en español no casa)', dem['sv8-238']?.quieren === 2 && dem['sv8-238'].tienes === 2, JSON.stringify(H.demanda))
    check('el otro Charizard: 1 (la Holo no es la que tienes, y la tienda no se cuenta a sí misma)', dem['sv3-125']?.quieren === 1 && dem['sv3-125'].nombre === 'Charizard ex' && dem['sv3-125'].set_id === 'sv3' && dem['sv3-125'].numero === '125', JSON.stringify(dem['sv3-125']))
    check('lo agotado no sale, aunque lo busquen', !dem['sv8-10'] && !dem['sv3-223'])
    check('  …ordenado por cuántos la quieren', H.demanda?.[0]?.card_id === 'sv8-238')
    check('  …y sin un solo nombre de quién', !JSON.stringify(H.demanda).includes('user_id') && !JSON.stringify(H.demanda).includes(U[0]))

    console.log('── Las visitas ──')
    const contar = (como, t, qr = false) => q(`${como} select tienda_contar_visita('${t}', ${qr})`)
    check('cualquiera cuenta una visita, sin cuenta también', contar(`set prueba.uid = '${PERSONA}'; set role authenticated;`, T).ok && contar(`set prueba.uid = ''; set role anon;`, T, true).ok)
    contar(comoT, T)
    contar(`set prueba.uid = '${T}'; set role authenticated;`, PERSONA)
    check('la propia tienda no se cuenta, y el perfil de una persona no cuenta', q(`select coalesce(sum(visitas), 0) from tienda_visitas where tienda_id = '${T}'`).out === '2' && q(`select count(*) from tienda_visitas where tienda_id = '${PERSONA}'`).out === '0')
    check('  …y nadie escribe en la tabla a mano', !q(`${comoT} insert into tienda_visitas values ('${T}', current_date, 99, 99)`).ok)
    q(`insert into tienda_visitas values ('${T}', (now() at time zone 'UTC')::date - 1, 5, 1)`)
    H = hoy(comoT, "date_trunc('day', now())", "date_trunc('day', now()) + interval '1 day'", "date_trunc('day', now()) - interval '1 day'", "date_trunc('day', now()) - interval '1 day' + interval '10 hours'", 'hour')
    check('hoy: 2 visitas, 1 desde el QR; ayer (el día entero), 5', H.visitas?.actual === 2 && H.visitas.qr === 1 && H.visitas.anterior === 5, JSON.stringify(H.visitas))
    check('otra tienda no ve tus visitas', q(`${comoOtra} select count(*) from tienda_visitas`).out === '0')
    check('ni tu Hoy: el suyo sale vacío', Number(hoy(comoOtra, "date_trunc('day', now())", "date_trunc('day', now()) + interval '1 day'", 'null', 'null', 'hour').actual?.importe) === 0)
    check('una persona no tiene Hoy', Boolean(hoy(`set prueba.uid = '${PERSONA}'; set role authenticated;`, 'now()', 'now()', 'null', 'null').error))
    check('un paso que no existe, no', Boolean(hoy(comoT, 'now()', 'now()', 'null', 'null', 'week').error))
    psql(['-c', `drop database if exists ${BD}`])
  } else {
    check('PostgreSQL en /var/tmp:5433', false, hay.stderr)
  }
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
