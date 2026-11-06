// Tanda 1254 — el Mostrador, en la base: `tienda_vender` con la forma de pago
// (efectivo, tarjeta, Bizum, PayPal; lo demás no) y el precio que la tienda
// tenía puesto al vender (`precio_lista`, el de la oferta mientras dura), que
// es lo que dice cuánto se rebajó al regatear. Una sola `tienda_vender`: la
// de dos parámetros se borra para que una llamada no sea ambigua.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const MIGRACIONES = ['1254-tienda-mostrador']
console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1254'
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
    const comoP = `set prueba.uid = '${PERSONA}'; set role authenticated;`
    const [A, B, C] = ['a1', 'a2', 'a3'].map((x) => `10000000-0000-0000-0000-0000000000${x}`)
    r = q(`${comoT} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, coste, precio) values
      ('${A}', 'sv3-223', 'es', 'NM', 'normal', 3, 62, 95),
      ('${B}', 'sv8-238', 'en', 'NM', 'reverse', 2, 210, 279),
      ('${C}', 'sv3-125', 'es', 'EX', 'normal', 2, null, 4);
      update tienda_stock set oferta_precio = 80, oferta_hasta = now() + interval '3 days', precio = 100 where id = '${B}';`)
    check('el stock de la prueba entra', r.ok, r.err)

    console.log('── 1. Una sola tienda_vender, con el pago ──')
    check('la de dos parámetros ya no está (una llamada no sería ambigua)', q(`select count(*) from pg_proc where proname = 'tienda_vender'`).out === '1' && q(`select pronargs from pg_proc where proname = 'tienda_vender'`).out === '3')
    let v = q(`${comoT} select tienda_vender('[{"stock_id":"${A}","unidades":1,"precio":90}]'::jsonb, 'evento')`)
    const v1 = v.ok ? JSON.parse(v.out) : {}
    check('con (lineas, donde) sigue vendiendo, sin pago', v.ok && v1.pago === null && v1.total === 90, v.out || v.err)
    check('  …apunta el precio que tenía (95) y la rebaja (5)', q(`select precio_lista || '|' || coalesce(pago, '-') from tienda_ventas where stock_id = '${A}'`).out === '95.00|-' && v1.rebaja === 5, v.out)
    v = q(`${comoT} select tienda_vender('[{"stock_id":"${B}","unidades":1,"precio":75}]'::jsonb, 'evento', 'bizum')`)
    const v2 = v.ok ? JSON.parse(v.out) : {}
    check('con el pago: «bizum» en la venta', v.ok && v2.pago === 'bizum' && q(`select pago from tienda_ventas where stock_id = '${B}'`).out === 'bizum', v.out || v.err)
    check('  …y el precio de lista es el de la OFERTA mientras dura (80, no 100)', q(`select precio_lista from tienda_ventas where stock_id = '${B}'`).out === '80.00' && v2.rebaja === 5, v.out)
    v = q(`${comoT} select tienda_vender('[{"stock_id":"${A}","unidades":1,"precio":120}]'::jsonb, 'mostrador', 'tarjeta')`)
    check('vender por encima de su precio no es una rebaja negativa', v.ok && JSON.parse(v.out).rebaja === 0, v.out || v.err)
    v = q(`${comoT} select tienda_vender('[{"stock_id":"${A}","unidades":1,"precio":90}]'::jsonb, 'mostrador', 'cheque')`)
    check('una forma de pago que no existe: no vende nada', !v.ok && /forma de pago/.test(v.err) && q(`select unidades from tienda_stock where id = '${A}'`).out === '1', v.err)
    check('  …y la tabla tampoco la deja escribir a mano', !q(`insert into tienda_ventas (tienda_id, ticket, card_id, idioma, estado, unidades, precio, pago) values ('${T}', gen_random_uuid(), 'sv3-223', 'es', 'NM', 1, 1, 'cheque')`).ok)
    for (const p of ['efectivo', 'tarjeta', 'bizum', 'paypal']) {
      v = q(`${comoT} select tienda_vender('[{"stock_id":"${C}","unidades":1,"precio":3}]'::jsonb, 'evento', '${p}')`)
      if (p === 'efectivo' || p === 'tarjeta') check(`«${p}» vale`, v.ok, v.err)
      else check(`«${p}» vale (sin unidades ya no: «no quedan tantas»)`, !v.ok && /No quedan tantas/.test(v.err), v.err)
    }
    check('una persona no vende', !q(`${comoP} select tienda_vender('[{"stock_id":"${A}","unidades":1,"precio":1}]'::jsonb, 'evento', 'efectivo')`).ok)
    const tk = JSON.parse(q(`${comoT} select tienda_vender('[{"stock_id":"${A}","unidades":1,"precio":95}]'::jsonb, 'evento', 'paypal')`).out || '{}').ticket
    v = q(`${comoT} select tienda_deshacer_venta('${tk}')`)
    check('deshacer sigue devolviendo las unidades', v.ok && q(`select unidades from tienda_stock where id = '${A}'`).out === '1', v.err)
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
