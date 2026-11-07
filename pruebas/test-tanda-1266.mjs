// Tanda 1266 — EL CAMBIO, en la base: `tienda_cambio` vende lo que das y
// compra lo que te dan (que entra por poner a la venta), marca las dos mitades
// con el pago «cambio» y apunta la diferencia: te paga, le pagas o en paz,
// cada una con las formas de pago que le tocan. Todo o nada. Deshacer va por
// el cambio entero, y la venta o la compra de un cambio no se deshacen solas.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const MIGRACIONES = ['1254-tienda-mostrador', '1255-tienda-comprar-rapido', '1266-tienda-cambio']
console.log('── Lo puro: la cuenta del cambio y la caja ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  const { cuentaDeCambio, textoDeCambio, cuentaDeCaja, PAGOS_VENTA, PAGOS_COMPRA, NOMBRE_DE_PAGO, PCTS_CAMBIO, PCT_CAMBIO, pagasPorPct } = P
  check('el tanto por ciento de cambio: 60–90 y 80 de partida', PCTS_CAMBIO.join() === '60,70,80,90' && PCT_CAMBIO === 80)
  check('  …y Cardmarket 100 valorada en 90, al 80 %, cuenta 72', pagasPorPct(90, 80) === 72)
  let c = cuentaDeCambio([{ unidades: 1, pagas: 72 }], [{ vender: 1, lista: 100, cobrar: null }])
  check('te paga: lo suyo 72, lo tuyo a tu precio 100 → 28', c.recibido === 72 && c.entregado === 100 && c.diferencia === 28 && c.quien === 'te-paga' && c.listo, JSON.stringify(c))
  c = cuentaDeCambio([{ unidades: 2, pagas: 40 }], [{ vender: 1, lista: 100, cobrar: 70 }])
  check('le pagas: 2 × 40 contra 70 que la dejas → −10', c.diferencia === -10 && c.quien === 'le-pagas', JSON.stringify(c))
  c = cuentaDeCambio([{ unidades: 1, pagas: 50 }], [{ vender: 1, lista: 60, cobrar: 50 }])
  check('en paz', c.diferencia === 0 && c.quien === 'en-paz' && c.listo)
  c = cuentaDeCambio([{ unidades: 1, pagas: null }], [{ vender: 1, lista: 60 }])
  check('una línea sin cifra: falta y no se puede (no cuenta como cero)', c.falta && !c.listo)
  check('sin uno de los dos lados no se puede', !cuentaDeCambio([], [{ vender: 1, lista: 5 }]).listo && !cuentaDeCambio([{ unidades: 1, pagas: 5 }], []).listo)
  const eu = (n) => `${n.toFixed(2)} €`
  check('la frase: te paga / le pagas / en paz', textoDeCambio(28, eu) === 'Te paga 28.00 €' && textoDeCambio(-10, eu) === 'Le pagas 10.00 €' && textoDeCambio(0, eu) === 'Quedáis en paz')
  check('«cambio» se nombra («En cartas») pero no se elige a mano', NOMBRE_DE_PAGO.cambio === 'En cartas' && !PAGOS_VENTA.some(([v]) => v === 'cambio') && !PAGOS_COMPRA.some(([v]) => v === 'cambio'))
  // Una venta normal de 30 en efectivo y un cambio: tu carta 100 por la suya
  // que cuenta 72, y te paga 28 con tarjeta.
  const k = cuentaDeCaja(
    [{ ticket: 'v', unidades: 1, precio: 30, coste: 10, pago: 'efectivo' }, { ticket: 'cv', unidades: 1, precio: 100, coste: 60, pago: 'cambio' }],
    [{ ticket: 'cc', unidades: 1, coste: 72, pago: 'cambio' }],
    [{ diferencia: 28, pago: 'tarjeta' }],
  )
  check('la caja: vendido y comprado enteros (130 y 72)', k.vendido === 130 && k.comprado === 72 && k.ventas === 2 && k.compras === 1, JSON.stringify(k))
  check('  …«En cartas» entra y sale 72, y la tarjeta 28', k.metodos.cambio.entra === 72 && k.metodos.cambio.sale === 72 && k.metodos.tarjeta.entra === 28, JSON.stringify(k.metodos))
  check('  …el efectivo no se entera del cambio (30) y dice cuántos y cuánto en dinero', k.efectivo === 30 && k.cambios === 1 && k.enCambios === 28)
  const k2 = cuentaDeCaja([{ ticket: 'cv', unidades: 1, precio: 50, coste: 20, pago: 'cambio' }], [{ ticket: 'cc', unidades: 2, coste: 40, pago: 'cambio' }], [{ diferencia: -30, pago: 'efectivo' }])
  check('le pagas 30 en efectivo: salen 30 de la caja y «En cartas» cuadra a 50', k2.efectivo === -30 && k2.metodos.cambio.entra === 50 && k2.metodos.cambio.sale === 50, JSON.stringify(k2.metodos))
  check('sin cambios, la caja de siempre', cuentaDeCaja([{ ticket: 'a', unidades: 1, precio: 10, pago: 'efectivo' }], []).cambios === 0)
  const sql = readFileSync(`${REPO}/supabase-migration-1266-tienda-cambio.sql`, 'utf8')
  const enCheck = (tabla) => (new RegExp(`${tabla}_pago\\s+check \\(pago is null or pago in \\(([^)]*)\\)\\)`).exec(sql)?.[1] || '').replace(/'|\s/g, '').split(',')
  check('la base deja «cambio» en ventas y compras, con las de la web', enCheck('tienda_ventas').join() === [...PAGOS_VENTA.map(([v]) => v), 'cambio'].join() && enCheck('tienda_compras').join() === [...PAGOS_COMPRA.map(([v]) => v), 'cambio'].join(), enCheck('tienda_ventas').join() + ' / ' + enCheck('tienda_compras').join())
}
console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1266'
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
        ('sv8-238', 'WEST', 'sv8', '238', 'Pikachu ex', 'Pikachu ex', 'pikachu ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Double Rare', 'Double Rare'),
        ('sv8-10', 'WEST', 'sv8', '10', 'Pidgey', 'Pidgey', 'pidgey', 'Common', 'Common');
      insert into tcg_card_prices (card_id, cm_low, cm_low_es, cm_low_en) values ('sv3-223', 80, 88.40, 90), ('sv8-238', 280, 301.50, 290), ('sv3-125', 4, 5, 4.5);
      insert into tcg_products values (501, 'Surging Sparks Elite Trainer Box', 70, 71, null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)


    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoO = `set prueba.uid = '${OTRA}'; set role authenticated;`
    const comoP = `set prueba.uid = '${PERSONA}'; set role authenticated;`
    const A = '10000000-0000-0000-0000-0000000000a1'
    r = q(`${comoT} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, coste, precio) values ('${A}', 'sv3-223', 'es', 'NM', 'normal', 1, 62, 95)`)
    check('una línea a la venta de antes', r.ok, r.err)

    const ventaDe = (precio, n = 1, id = A) => `{"stock_id":"${id}","unidades":${n},"precio":${precio}}`
    const B = '10000000-0000-0000-0000-0000000000a2'
    r = q(`${comoT} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, coste, precio) values ('${B}', 'sv8-238', 'en', 'NM', 'normal', 3, 200, 300)`)
    check('otra línea a la venta, con tres', r.ok, r.err)

    console.log('── 1. Te paga: 100 de lo tuyo por 80 de lo suyo ──')
    let c = q(`${comoT} select tienda_cambio('[{"card_id":"sv3-125","idioma":"es","estado":"NM","unidades":1,"coste":80,"valorado":100,"cm":100}]'::jsonb, '[${ventaDe(100)}]'::jsonb, 'efectivo', 'Ane', 'evento', 80)`)
    const c1 = c.ok ? JSON.parse(c.out) : {}
    check('el cambio sale: entregado 100, recibido 80, te paga 20 en efectivo', c.ok && c1.entregado === 100 && c1.recibido === 80 && c1.diferencia === 20 && c1.pago === 'efectivo', c.out || c.err)
    check('  …la venta sale del stock y lleva el pago «cambio» y el sitio', q(`select unidades from tienda_stock where id = '${A}'`).out === '0' && q(`select pago || ':' || donde || ':' || precio from tienda_ventas where ticket = '${c1.venta_ticket}'`).out === 'cambio:evento:100.00')
    check('  …lo recibido entra OCULTO y por poner, con lo que contó de coste', q(`select visible || ':' || por_poner || ':' || coste || ':' || valorado from tienda_stock where card_id = 'sv3-125'`).out === 'false:true:80.00:100.00')
    check('  …y la compra lleva «cambio» y el cliente', q(`select pago || ':' || cliente from tienda_compras where ticket = '${c1.compra_ticket}'`).out === 'cambio:Ane')
    check('  …y el cambio queda apuntado con su %', q(`select diferencia || ':' || pago || ':' || pct || ':' || cliente from tienda_cambios where id = '${c1.id}'`).out === '20.00:efectivo:80:Ane')

    console.log('── 2. Le pagas, en paz y lo que no ──')
    c = q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","idioma":"es","unidades":1,"coste":350}]'::jsonb, '[${ventaDe(300, 1, B)}]'::jsonb, 'bizum')`)
    const c2 = c.ok ? JSON.parse(c.out) : {}
    check('le pagas 50 por Bizum (un pago de compra)', c.ok && c2.diferencia === -50 && c2.pago === 'bizum', c.out || c.err)
    check('«tarjeta» no vale para lo que le pagas (y no se hace nada)', !q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":350}]'::jsonb, '[${ventaDe(300, 1, B)}]'::jsonb, 'tarjeta')`).ok && q(`select unidades from tienda_stock where id = '${B}'`).out === '2')
    check('«otro» no vale para lo que te paga', !q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":10}]'::jsonb, '[${ventaDe(300, 1, B)}]'::jsonb, 'otro')`).ok)
    check('con diferencia y sin decir cómo, no', !q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":10}]'::jsonb, '[${ventaDe(300, 1, B)}]'::jsonb)`).ok)
    c = q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":300}]'::jsonb, '[${ventaDe(300, 1, B)}]'::jsonb, 'efectivo')`)
    const c3 = c.ok ? JSON.parse(c.out) : {}
    check('en paz: sin forma de pago aunque se diga una', c.ok && c3.diferencia === 0 && c3.pago === null, c.out || c.err)
    check('sin lo que te da, no (es una venta)', !q(`${comoT} select tienda_cambio('[]'::jsonb, '[${ventaDe(300, 1, B)}]'::jsonb, 'efectivo')`).ok)
    check('sin lo que le das, no (es una compra)', !q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":3}]'::jsonb, '[]'::jsonb, 'efectivo')`).ok)
    const antes = q(`select count(*) from tienda_compras`).out
    check('más unidades de las que hay: no se hace NADA (tampoco la compra)', !q(`${comoT} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":3}]'::jsonb, '[${ventaDe(300, 9, B)}]'::jsonb, 'efectivo')`).ok && q(`select count(*) from tienda_compras`).out === antes)
    check('una persona no hace cambios', !q(`${comoP} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":3}]'::jsonb, '[${ventaDe(3, 1, B)}]'::jsonb, 'efectivo')`).ok)
    check('otra tienda no vende lo tuyo en un cambio', !q(`${comoO} select tienda_cambio('[{"card_id":"sv3-223","unidades":1,"coste":3}]'::jsonb, '[${ventaDe(3, 1, B)}]'::jsonb, 'efectivo')`).ok)
    check('otra tienda no ve tus cambios', q(`${comoO} select count(*) from tienda_cambios`).out === '0' && q(`${comoT} select count(*) from tienda_cambios`).out === '3')

    console.log('── 3. Las listas traen el pago ──')
    const lv = q(`${comoT} select tienda_ventas_lista('{}'::jsonb)`)
    check('Ventas: cada fila con su pago', lv.ok && JSON.parse(lv.out).filas.every((f) => f.pago === 'cambio'), lv.out || lv.err)
    const lc = q(`${comoT} select tienda_compras_lista('{}'::jsonb)`)
    check('Compras: cada fila con su pago', lc.ok && JSON.parse(lc.out).filas.some((f) => f.pago === 'cambio'), lc.out || lc.err)

    console.log('── 4. Deshacer ──')
    check('la venta de un cambio no se deshace sola', !q(`${comoT} select tienda_deshacer_venta('${c1.venta_ticket}')`).ok && q(`select count(*) from tienda_ventas where ticket = '${c1.venta_ticket}'`).out === '1')
    check('  …ni la compra', !q(`${comoT} select tienda_deshacer_compra('${c1.compra_ticket}')`).ok)
    check('otra tienda no deshace tu cambio', !q(`${comoO} select tienda_deshacer_cambio('${c1.id}')`).ok)
    let d = q(`${comoT} select tienda_deshacer_cambio('${c1.compra_ticket}')`)
    check('deshacer por el ticket de la compra deshace el cambio entero', d.ok && q(`select count(*) from tienda_cambios where id = '${c1.id}'`).out === '0' && q(`select unidades from tienda_stock where id = '${A}'`).out === '1' && q(`select count(*) from tienda_stock where card_id = 'sv3-125'`).out === '0', d.out || d.err)
    // Si de lo recibido ya se vendió algo, no se deshace nada.
    const recibida = q(`select s.id from tienda_stock s join tienda_compras c on c.stock_id = s.id where c.ticket = '${c2.compra_ticket}'`).out
    q(`update tienda_stock set por_poner = false, visible = true, precio = 400 where id = '${recibida}'`)
    check('se vende lo recibido en el segundo cambio', q(`${comoT} select tienda_vender('[${ventaDe(400, 1, recibida)}]'::jsonb, 'mostrador', 'tarjeta')`).ok)
    d = q(`${comoT} select tienda_deshacer_cambio('${c2.id}')`)
    check('  …y ese cambio ya no se deshace, sin tocar nada', !d.ok && q(`select count(*) from tienda_cambios where id = '${c2.id}'`).out === '1' && q(`select count(*) from tienda_ventas where ticket = '${c2.venta_ticket}'`).out === '1', d.out || d.err)
    check('una venta normal se sigue deshaciendo', q(`${comoT} select tienda_deshacer_venta((select ticket from tienda_ventas where pago = 'tarjeta' limit 1))`).ok)
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
