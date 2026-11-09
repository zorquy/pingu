// Tanda 1277 — EL LOTE SIN DESGLOSAR y el tanto por ciento libre.
//
// PINGU eligió la opción A: en un evento, lo que te da el cliente (o lo que le
// compras) es UN LOTE: lo que vale en total, tu tanto por ciento y una foto.
// La venta, la caja y el coste quedan bien al momento; las cartas se apuntan
// luego («Desglosar»), con el coste del lote repartido según lo que vale cada
// una. Y el tanto por ciento es libre: «−» y «+» de 5 en 5, o escrito.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const MIGRACIONES = ['1254-tienda-mostrador', '1255-tienda-comprar-rapido', '1266-tienda-cambio', '1277-tienda-lotes']
const P = await import(`${REPO}/js/tiendas-puro.js`)
console.log('── Lo puro: el tanto por ciento libre ──')
{
  const { pctConPaso, pctDeCampo, PASO_PCT, PCT_CAMBIO } = P
  check('de 5 en 5, y el 80 de partida del cambio', PASO_PCT === 5 && PCT_CAMBIO === 80)
  check('80 → +5 es 85 y −5 es 75', pctConPaso(80, 5) === 85 && pctConPaso(80, -5) === 75)
  check('83 → al siguiente múltiplo: 85 subiendo, 80 bajando', pctConPaso(83, 5) === 85 && pctConPaso(83, -5) === 80)
  check('no baja de 0 ni pasa de 200', pctConPaso(0, -5) === 0 && pctConPaso(2, -5) === 0 && pctConPaso(198, 5) === 200 && pctConPaso(200, 5) === 200)
  check('escrito: «85», «85 %» y «0» valen', pctDeCampo('85') === 85 && pctDeCampo('85 %') === 85 && pctDeCampo('0') === 0 && pctDeCampo(' 120 ') === 120)
  check('  …y «201», «abc», «» y «7,5» no (se queda el de antes)', [pctDeCampo('201'), pctDeCampo('abc'), pctDeCampo(''), pctDeCampo('7,5'), pctDeCampo('-5')].every((x) => x === null))
}
console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1277'
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
    // De la 1079, las ofertas y la regla del precio que cuenta.
    r = psql(['-d', BD, '-c', `alter table tienda_stock add column if not exists oferta_precio numeric(10, 2); alter table tienda_stock add column if not exists oferta_hasta timestamptz; ${funcion('supabase-migration-1079-tiendas-vuelta-2.sql', 'tienda_precio_de')}`])
    check('las ofertas de la 1079', r.status === 0, r.stderr)
    const m91 = readFileSync(`${REPO}/supabase-migration-1091-tienda-compras.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', m91])
    check('la 1091 entra', r.status === 0, r.stderr)
    for (const m of MIGRACIONES) {
      const sql = readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8')
      check(`la ${m.slice(0, 4)} no usa tablas temporales`, !/create\s+temp(orary)?\s+table/i.test(sql))
      r = psql(['-d', BD, '-c', sql.replace(/notify pgrst[^;]*;/, '')])
      check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
      check('  …y otra vez encima', psql(['-d', BD, '-c', sql.replace(/notify pgrst[^;]*;/, '')]).status === 0)
    }

    const T = '00000000-0000-0000-0000-0000000000b1'
    const OTRA = '00000000-0000-0000-0000-0000000000b2'
    const PERSONA = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${OTRA}'), ('${PERSONA}');
      insert into user_profiles (id, username, tipo, onboarding_completed) values ('${T}', 'rincon', 'tienda', true), ('${OTRA}', 'norte', 'tienda', true), ('${PERSONA}', 'ane', 'persona', true);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames'), ('sv8', 'WEST', 'Surging Sparks');
      insert into tcg_cards values
        ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Double Rare', 'Double Rare'),
        ('sv8-111', 'WEST', 'sv8', '111', 'Groudon', 'Groudon', 'groudon', 'Rare', 'Rare'),
        ('sv8-10', 'WEST', 'sv8', '10', 'Pidgey', 'Pidgey', 'pidgey', 'Common', 'Common');
      insert into tcg_products values (501, 'Surging Sparks Elite Trainer Box', 70, 71, null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)

    console.log('── 1. El reparto: el de la base es el de la web ──')
    const casos = [
      [80, [{ unidades: 1, cm: 16 }, { unidades: 1, cm: 25 }, { unidades: 2, cm: 0.1 }, { unidades: 1, cm: null }]],
      [100, [{ unidades: 3, cm: 10 }, { unidades: 3, cm: 20 }]],
      [33.33, [{ unidades: 2, cm: 5 }, { unidades: 4, cm: null }, { unidades: 1, cm: 0 }]],
      [0, [{ unidades: 1, cm: 50 }]],
      [12.5, [{ unidades: 1, cm: null }, { unidades: 1, cm: null }, { unidades: 1, cm: null }]],
      [7, [{ unidades: 0, cm: 5 }, { unidades: 2, cm: 5 }]],
    ]
    for (const [total, ls] of casos) {
      const web = P.repartirTotal(ls, total)
      const b = q(`select array_to_json(tienda_repartir(${total}, '${JSON.stringify(ls)}'::jsonb))`)
      const base = b.ok ? JSON.parse(b.out).map((x) => (x == null ? null : Number(x))) : null
      const suma = (web || []).reduce((s, c, i) => s + (c || 0) * ls[i].unidades, 0)
      // Suma justo lo que costó si hay una línea de una unidad (ahí van los
      // céntimos que sobran); si todas llevan varias, puede quedar alguno.
      const justo = ls.some((l) => l.unidades === 1) ? Math.round(suma * 100) === Math.round(total * 100) : Math.abs(suma - total) < 0.01 * Math.max(...ls.map((l) => l.unidades))
      check(`  ${total} € entre ${ls.length}: ${JSON.stringify(web)}`, b.ok && JSON.stringify(base) === JSON.stringify(web) && justo, b.out || b.err)
    }

    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoO = `set prueba.uid = '${OTRA}'; set role authenticated;`
    const comoP = `set prueba.uid = '${PERSONA}'; set role authenticated;`
    const A = '10000000-0000-0000-0000-0000000000a1'
    r = q(`${comoT} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, coste, precio) values ('${A}', 'sv3-223', 'es', 'NM', 'normal', 3, 120, 200)`)
    check('una carta tuya a la venta (la que se lleva)', r.ok, r.err)
    const loteDe = (extra = '') => `{"lote":true,"coste":80,"valorado":100,"cartas":10,"pct":80${extra}}`

    console.log('── 2. Comprar un lote ──')
    let c = q(`${comoT} select tienda_comprar('[${loteDe(`,"foto":"${T}/lotes/a.webp"`)},{"card_id":"sv3-125","unidades":1,"coste":3,"cm":4}]'::jsonb, 'Ane', 'efectivo')`)
    const k1 = c.ok ? JSON.parse(c.out) : {}
    check('la compra sale: 80 del lote + 3 de la carta, 11 cartas, un lote', c.ok && Number(k1.total) === 83 && k1.unidades === 11 && k1.lotes === 1, c.out || c.err)
    check('  …el lote queda por desglosar, con su foto, su % y su cliente', q(`select estado || ':' || coste || ':' || vale || ':' || cartas || ':' || pct || ':' || foto || ':' || cliente from tienda_lotes where compra_ticket = '${k1.ticket}'`).out === `por_desglosar:80.00:100.00:10:80:${T}/lotes/a.webp:Ane`)
    check('  …es UNA línea de la compra (la caja la cuenta: 80 en efectivo)', q(`select count(*) || ':' || sum(coste * unidades) || ':' || string_agg(distinct pago, ',') from tienda_compras where ticket = '${k1.ticket}' and lote_id is not null`).out === '1:80.00:efectivo')
    check('  …y no entra al stock (solo la carta suelta)', q(`select count(*) from tienda_stock where tienda_id = '${T}' and por_poner`).out === '1')
    const antes = q(`select count(*) from tienda_lotes`).out
    check('una foto fuera de tu carpeta no vale, y no se apunta nada', !q(`${comoT} select tienda_comprar('[${loteDe(`,"foto":"${OTRA}/lotes/a.webp"`)}]'::jsonb)`).ok && !q(`${comoT} select tienda_comprar('[${loteDe(`,"foto":"${T}/../x.webp"`)}]'::jsonb)`).ok && q(`select count(*) from tienda_lotes`).out === antes)
    check('un lote sin lo que pagas, no', !q(`${comoT} select tienda_comprar('[{"lote":true,"valorado":100}]'::jsonb)`).ok)
    check('  …ni con 0 cartas', !q(`${comoT} select tienda_comprar('[{"lote":true,"coste":5,"cartas":0}]'::jsonb)`).ok)
    check('sin «cartas» ni foto, sí (son opcionales)', q(`${comoT} select tienda_comprar('[{"lote":true,"coste":5}]'::jsonb)`).ok)
    const lc = q(`${comoT} select tienda_compras_lista('{"q":"lote"}'::jsonb)`)
    const filas = lc.ok ? JSON.parse(lc.out).filas : []
    check('Compras: «Lote sin desglosar», con sus cartas, y se busca por «lote»', lc.ok && filas.length === 2 && filas.every((f) => f.nombre === 'Lote sin desglosar' && f.lote_id) && filas.some((f) => f.cartas === 10), lc.out || lc.err)
    check('otra tienda no ve tus lotes; una persona tampoco', q(`${comoO} select count(*) from tienda_lotes`).out === '0' && q(`${comoP} select count(*) from tienda_lotes`).out === '0' && q(`${comoT} select count(*) from tienda_lotes`).out === '2')

    console.log('── 3. Un cambio con un lote ──')
    c = q(`${comoT} select tienda_cambio('[${loteDe()}]'::jsonb, '[{"stock_id":"${A}","unidades":1,"precio":200}]'::jsonb, 'efectivo', 'Iker', 'evento', 80)`)
    const cb = c.ok ? JSON.parse(c.out) : {}
    check('tu carta de 200 por un lote que vale 100 al 80 %: te paga 120', c.ok && cb.entregado === 200 && cb.recibido === 80 && cb.diferencia === 120, c.out || c.err)
    const lote = q(`select id from tienda_lotes where compra_ticket = '${cb.compra_ticket}'`).out
    check('  …el lote espera, y su línea lleva el pago «cambio»', lote && q(`select pago from tienda_compras where lote_id = '${lote}'`).out === 'cambio')

    console.log('── 4. Desglosar ──')
    const cartas = [
      { card_id: 'sv8-111', idioma: 'es', estado: 'NM', unidades: 1, valorado: 16, cm: 15 },
      { card_id: 'sv3-125', idioma: 'en', estado: 'EX', unidades: 1, valorado: null, cm: 25 },
      { card_id: 'sv8-10', idioma: 'es', estado: 'NM', unidades: 2, valorado: 0.1, cm: 0.1 },
      { product_id: 501, idioma: 'en', unidades: 1, valorado: null, cm: null },
    ]
    const esperado = P.repartirTotal(cartas.map((l) => ({ unidades: l.unidades, cm: l.valorado ?? l.cm })), 80)
    check('otra tienda no desglosa tu lote', !q(`${comoO} select tienda_lote_desglosar('${lote}', '${JSON.stringify(cartas)}'::jsonb)`).ok)
    check('sin cartas, no', !q(`${comoT} select tienda_lote_desglosar('${lote}', '[]'::jsonb)`).ok)
    check('una carta que no está en el catálogo: no se hace nada', !q(`${comoT} select tienda_lote_desglosar('${lote}', '[{"card_id":"no-existe","unidades":1}]'::jsonb)`).ok && q(`select estado from tienda_lotes where id = '${lote}'`).out === 'por_desglosar' && q(`select count(*) from tienda_compras where lote_id = '${lote}'`).out === '1')
    const comprada = q(`select comprada_el from tienda_compras where lote_id = '${lote}'`).out
    const d = q(`${comoT} select tienda_lote_desglosar('${lote}', '${JSON.stringify(cartas)}'::jsonb)`)
    const dd = d.ok ? JSON.parse(d.out) : {}
    check('desglosado: 4 líneas, 5 unidades, 80 € justos', d.ok && dd.lineas === 4 && dd.unidades === 5 && Number(dd.total) === 80, d.out || d.err)
    const costes = q(`select string_agg(coalesce(card_id, product_id::text) || '=' || coste, ',' order by coalesce(card_id, product_id::text)) from tienda_compras where de_lote = '${lote}'`).out
    const quiero = cartas.map((l, i) => `${l.card_id || l.product_id}=${esperado[i].toFixed(2)}`).sort().join()
    check(`  …con el coste repartido como en la web (${quiero})`, costes === quiero, costes)
    check('  …en la MISMA compra: ticket, día, pago y cliente (la caja de aquel día no se mueve)', q(`select count(distinct ticket) || ':' || bool_and(ticket = '${cb.compra_ticket}') || ':' || bool_and(comprada_el = '${comprada}') || ':' || string_agg(distinct pago, ',') || ':' || string_agg(distinct cliente, ',') from tienda_compras where de_lote = '${lote}'`).out === '1:true:true:cambio:Iker')
    check('  …la línea del lote se fue y la compra suma lo mismo (80)', q(`select count(*) from tienda_compras where lote_id = '${lote}'`).out === '0' && q(`select sum(coste * unidades) from tienda_compras where ticket = '${cb.compra_ticket}'`).out === '80.00')
    check('  …las cartas entran ocultas y por poner a la venta, con su coste y su valor', q(`select count(*) from tienda_stock s join tienda_compras c on c.stock_id = s.id where c.de_lote = '${lote}' and s.por_poner and not s.visible and s.coste = c.coste and s.valorado is not distinct from c.valorado`).out === '4')
    check('  …y el lote, desglosado con sus unidades', q(`select estado || ':' || desglosadas || ':' || (desglosado_el is not null) from tienda_lotes where id = '${lote}'`).out === 'desglosado:5:true')
    check('dos veces, no', !q(`${comoT} select tienda_lote_desglosar('${lote}', '${JSON.stringify(cartas)}'::jsonb)`).ok)

    console.log('── 5. Deshacer ──')
    let u = q(`${comoT} select tienda_deshacer_cambio('${cb.id}')`)
    check('deshacer el cambio ya desglosado: tu carta vuelve, sus cartas salen y el lote se va', u.ok && q(`select unidades from tienda_stock where id = '${A}'`).out === '3' && q(`select count(*) from tienda_compras where ticket = '${cb.compra_ticket}'`).out === '0' && q(`select count(*) from tienda_lotes where id = '${lote}'`).out === '0' && q(`select count(*) from tienda_stock where card_id = 'sv8-111'`).out === '0', u.out || u.err)
    u = q(`${comoT} select tienda_deshacer_compra('${k1.ticket}')`)
    check('deshacer una compra con un lote sin desglosar se lleva el lote', u.ok && q(`select count(*) from tienda_lotes where compra_ticket = '${k1.ticket}'`).out === '0' && q(`select count(*) from tienda_compras where ticket = '${k1.ticket}'`).out === '0', u.out || u.err)
    check('una compra normal sigue igual (sin lote)', q(`${comoT} select (tienda_comprar('[{"card_id":"sv8-10","unidades":2,"coste":0.05}]'::jsonb, null, 'bizum')->>'lotes')::int`).out === '0')
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
