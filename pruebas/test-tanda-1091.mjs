// Tanda 1091 — comprar a un cliente, contra PostgreSQL: cada línea comprada
// entra al stock como línea NUEVA con su coste, la compra queda apuntada con
// lo que valía en Cardmarket y a quién, todo o nada, la lista con sus sumas,
// deshacer (y que no deshace si ya se vendió alguna), que el beneficio de una
// venta sale del coste de la compra, y que solo una tienda compra y ve lo suyo.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1091'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1091-tienda-compras.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
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
      create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, is_admin boolean not null default false, is_moderator boolean default false, is_banned boolean default false, onboarding_completed boolean, notification_prefs_disabled text[] not null default '{}', created_at timestamptz not null default now());
      grant select, insert, update on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      create table user_collection (id uuid primary key default gen_random_uuid(), user_id uuid, card_id text, market text default 'WEST', idioma text default 'es', estado text default 'NM', variante text default 'normal', cantidad int default 1, cambio int not null default 0, gradeo text, valor_manual numeric(10,2), precio_compra numeric(10,2), notas text, created_at timestamptz default now(), updated_at timestamptz default now());
      create table user_wants (id uuid primary key default gen_random_uuid(), user_id uuid not null, card_id text not null, idioma text, variante text, prioridad int default 1);
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
      if (r.status !== 0) check(`  …${nombre}`, false, r.stderr)
    }
    for (const m of ['1067-tiendas', '1068-tienda-stock', '1069-tiendas-escaparate', '1072-tienda-ventas', '1073-tienda-hoy', '1079-tiendas-vuelta-2']) {
      r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
      check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
    }
    const T = '00000000-0000-0000-0000-0000000000b1'
    const T2 = '00000000-0000-0000-0000-0000000000b2'
    const ANE = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${ANE}');
      insert into user_profiles (id, username, display_name, tipo, onboarding_completed) values
        ('${T}', 'rincon', 'El Rincón', 'tienda', true), ('${T2}', 'norte', 'Norte', 'tienda', true), ('${ANE}', 'ane', 'Ane', 'persona', true);
      insert into tiendas (user_id, precio_visible) values ('${T}', true), ('${T2}', true);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames'), ('SV1a', 'JP', 'Triplet Beat');
      insert into tcg_cards values
        ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Double Rare', 'Double Rare'),
        ('SV1a-001', 'JP', 'SV1a', '001', 'ピカチュウ', null, 'pikachu', 'C', 'Common');
      insert into tcg_products values (501, 'Surging Sparks Elite Trainer Box', 70, 71, null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
    check('la 1091 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')]).status === 0)
    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoT2 = `set prueba.uid = '${T2}'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set role authenticated;`
    const json = (como, sql) => { const x = q(`${como} ${sql}`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    const comprar = (como, lineas, cliente = null) => json(como, `select tienda_comprar('${JSON.stringify(lineas)}'::jsonb, ${cliente ? `'${cliente}'` : 'null'})`)

    console.log('── Comprar ──')
    let C = comprar(comoT, [
      { card_id: 'sv3-223', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 40, cm: 80.4 },
      { card_id: 'sv3-125', market: 'WEST', idioma: 'en', estado: 'EX', variante: 'normal', unidades: 3, coste: 1.5, cm: 3, precio: 4.95 },
      { product_id: 501, idioma: 'en', unidades: 2, coste: 45 },
      { card_id: 'SV1a-001', market: 'JP', unidades: 1, coste: 0.2 },
    ], '@ane_tcg')
    check('compra cuatro líneas, 7 unidades, 134,70 €', C.lineas === 4 && C.unidades === 7 && Number(C.total) === 134.7 && C.ticket, JSON.stringify(C))
    const st = JSON.parse(q(`select json_agg(s order by s.coste desc) from tienda_stock s where tienda_id = '${T}'`).out || '[]')
    check('cuatro líneas NUEVAS en el stock, cada una con su coste', st.length === 4 && st.map((s) => Number(s.coste)).join() === '45,40,1.5,0.2', st.map((s) => s.coste).join())
    check('  …el producto sellado, la japonesa en japonés, y lo que no dice estado, NM', st[0].estado === 'sellado' && st[0].product_id === 501 && st[3].idioma === 'ja' && st[3].estado === 'NM' && st[3].market === 'JP')
    check('  …con tu precio si lo pusiste, y sin él si no', Number(st[2].precio) === 4.95 && st[1].precio === null)
    check('  …a la vista y entradas hoy', st.every((s) => s.visible && Date.now() - new Date(s.entro_el).getTime() < 6e4))
    const cp = JSON.parse(q(`select json_agg(c) from tienda_compras c`).out || '[]')
    check('la compra, apuntada: el ticket, a quién, lo que valía y la línea', cp.length === 4 && cp.every((c) => c.ticket === C.ticket && c.cliente === '@ane_tcg' && c.stock_id) && cp.some((c) => Number(c.cm) === 80.4))

    console.log('── Todo o nada ──')
    const antes = q(`select count(*) from tienda_stock`).out
    check('una carta que no está en el catálogo: error', /no está en el catálogo/.test(comprar(comoT, [{ card_id: 'sv3-223', unidades: 1, coste: 1 }, { card_id: 'nada-1', unidades: 1, coste: 1 }]).error || ''))
    check('  …y la buena de la misma compra no entra', q(`select count(*) from tienda_stock`).out === antes)
    check('sin lo que pagas: error', /lo que pagas/.test(comprar(comoT, [{ card_id: 'sv3-223', unidades: 1 }]).error || ''))
    check('un estado que no existe: error', !!comprar(comoT, [{ card_id: 'sv3-223', unidades: 1, coste: 1, estado: 'XX' }]).error)
    check('cero unidades: error', !!comprar(comoT, [{ card_id: 'sv3-223', unidades: 0, coste: 1 }]).error)
    check('una persona no compra', !!comprar(comoAne, [{ card_id: 'sv3-223', unidades: 1, coste: 1 }]).error)
    check('  …ni ve las compras de nadie', q(`${comoAne} select count(*) from tienda_compras`).out === '0')
    check('otra tienda no ve las de esta', q(`${comoT2} select count(*) from tienda_compras`).out === '0')

    console.log('── La lista ──')
    let L = json(comoT, `select tienda_compras_lista('{}'::jsonb, 0, 50)`)
    check('una compra, cuatro líneas, lo pagado y lo que valía en Cardmarket', L.total === 4 && L.tickets === 1 && Number(L.sumas.importe) === 134.7 && Number(L.sumas.unidades) === 7 && Number(L.sumas.cm) === 89.4 && Number(L.sumas.importe_con_cm) === 44.5, JSON.stringify(L.sumas))
    check('  …cada fila con su nombre, su colección y su número', L.filas.some((f) => f.nombre === 'Charizard ex' && f.set_id === 'sv3' && f.numero === '223') && L.filas.some((f) => f.nombre === 'Surging Sparks Elite Trainer Box'))
    check('buscar por el cliente', json(comoT, `select tienda_compras_lista('{"q":"ane"}'::jsonb, 0, 50)`).total === 4 && json(comoT, `select tienda_compras_lista('{"q":"pepe"}'::jsonb, 0, 50)`).total === 0)
    check('por fechas', json(comoT, `select tienda_compras_lista('{"desde":"2000-01-01","hasta":"2000-02-01"}'::jsonb, 0, 50)`).total === 0)

    console.log('── Vender lo comprado ──')
    const linea = q(`select id from tienda_stock where tienda_id = '${T}' and card_id = 'sv3-125'`).out
    const V = json(comoT, `select tienda_vender('[{"stock_id":"${linea}","unidades":1,"precio":4.95}]'::jsonb, 'mostrador')`)
    check('el beneficio sale del coste de la compra: 4,95 − 1,50', Number(V.beneficio) === 3.45, JSON.stringify(V))

    console.log('── Deshacer ──')
    r = q(`${comoT} select tienda_deshacer_compra('${C.ticket}')`)
    check('con una ya vendida, no deshace y lo dice', !r.ok && /Ya has vendido alguna/.test(r.err), r.err)
    check('  …y no toca nada', q(`select count(*) from tienda_stock where tienda_id = '${T}'`).out === '4' && q(`select count(*) from tienda_compras`).out === '4')
    json(comoT, `select tienda_deshacer_venta('${V.ticket}')`)
    const C2 = comprar(comoT, [{ card_id: 'sv3-223', unidades: 2, coste: 30 }])
    const l2 = q(`select stock_id from tienda_compras where ticket = '${C2.ticket}'`).out
    q(`update tienda_stock set unidades = 5 where id = '${l2}'`)
    const D = json(comoT, `select tienda_deshacer_compra('${C.ticket}')`)
    check('deshecha (devuelta la venta): las cuatro líneas fuera del stock', D.lineas === 4 && D.borradas === 4 && q(`select count(*) from tienda_compras where ticket = '${C.ticket}'`).out === '0', JSON.stringify(D))
    const D2 = json(comoT, `select tienda_deshacer_compra('${C2.ticket}')`)
    check('si a la línea se le sumaron más a mano, solo quita las de la compra', D2.borradas === 0 && q(`select unidades from tienda_stock where id = '${l2}'`).out === '3', JSON.stringify(D2))
    check('una compra que no existe: error', !q(`${comoT} select tienda_deshacer_compra('${C.ticket}')`).ok)
    check('otra tienda no deshace la tuya', (() => { const C3 = comprar(comoT, [{ card_id: 'sv3-223', unidades: 1, coste: 1 }]); return !q(`${comoT2} select tienda_deshacer_compra('${C3.ticket}')`).ok })())
  }
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
