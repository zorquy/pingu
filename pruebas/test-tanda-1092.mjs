// Tanda 1092 — «Apártamela», contra PostgreSQL: apartar saca las unidades
// del stock (y con ellas del escaparate), no deja apartar más de las que hay
// ni sin para quién ni un día pasado, quitar las devuelve, recoger apunta la
// venta con el coste de la línea (y deshacerla las devuelve al stock), las
// caducadas vuelven solas al llamar `tienda_reservas_al_dia` (también sin
// cuenta), y solo una tienda aparta y ve lo suyo.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1092'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1092-tienda-reservas.sql`, 'utf8')
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
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
      insert into tcg_cards values ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Special Illustration Rare', 'Special Illustration Rare');`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
    check('la 1092 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')]).status === 0)
    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoT2 = `set prueba.uid = '${T2}'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set role authenticated;`
    const comoNadie = `set prueba.uid = ''; set role anon;`
    const json = (como, sql) => { const x = q(`${como} ${sql}`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    q(`${comoT} insert into tienda_stock (card_id, idioma, estado, unidades, coste, precio, oferta_precio, oferta_hasta) values ('sv3-223', 'es', 'NM', 3, 62, 180, 170, now() + interval '3 days')`)
    const linea = q(`select id from tienda_stock where tienda_id = '${T}'`).out
    const uds = () => Number(q(`select unidades from tienda_stock where id = '${linea}'`).out)
    const apartar = (como, n, para = '@ane_tcg', hasta = "now() + interval '2 days'", precio = 'null', usuario = 'null') => json(como, `select tienda_apartar('${linea}', ${n}, ${para === null ? 'null' : `'${para}'`}, ${hasta}, ${precio}, 'Viene el sábado', ${usuario})`)
    const escaparate = () => json(comoAne, `select tienda_escaparate('${T}', '{}'::jsonb)`)

    console.log('── Apartar ──')
    check('en el escaparate, 3 unidades', escaparate().filas?.[0]?.unidades === 3, JSON.stringify(escaparate().filas?.[0]))
    let A = apartar(comoT, 2, '@ane_tcg', "now() + interval '2 days'", 'null', `'${ANE}'`)
    check('aparta dos: quedan una', A.id && A.quedan === 1, JSON.stringify(A))
    check('  …el stock baja a 1, y el escaparate también', uds() === 1 && escaparate().filas?.[0]?.unidades === 1)
    const R = JSON.parse(q(`select row_to_json(r) from tienda_reservas r where id = '${A.id}'`).out)
    check('  …con el precio que cuenta (la oferta, 170), para quién, su cuenta y la nota', Number(R.precio) === 170 && R.para === '@ane_tcg' && R.para_usuario === ANE && R.nota === 'Viene el sábado')
    check('más de las que quedan: no', /No quedan tantas/.test(apartar(comoT, 2).error || '') && uds() === 1)
    check('sin para quién: no', /para quién/.test(apartar(comoT, 1, '  ').error || ''))
    check('un día pasado: no', /de aquí en adelante/.test(apartar(comoT, 1, 'Jon', "now() - interval '1 hour'").error || ''))
    check('a más de dos meses: no', /dos meses/.test(apartar(comoT, 1, 'Jon', "now() + interval '90 days'").error || ''))
    check('una persona no aparta', !!apartar(comoAne, 1).error && uds() === 1)
    check('otra tienda no aparta lo tuyo', /ya no está en tu stock/.test(apartar(comoT2, 1).error || ''))
    check('nadie más ve lo apartado', q(`${comoT2} select count(*) from tienda_reservas`).out === '0' && q(`${comoAne} select count(*) from tienda_reservas`).out === '0')
    const L = json(comoT, `select tienda_reservas_lista()`)
    check('la lista: con el nombre de la carta, su número y la cuenta de quien la quiere', L.length === 1 && L[0].nombre === 'Charizard ex' && L[0].numero === '223' && L[0].para_username === 'ane' && L[0].unidades === 2, JSON.stringify(L))

    console.log('── Quitar y recoger ──')
    let Q = json(comoT, `select tienda_reserva_quitar('${A.id}')`)
    check('quitar: vuelven las dos', Q.devueltas === 2 && uds() === 3 && q(`select count(*) from tienda_reservas`).out === '0')
    check('  …y otra vez, ya no está', !!json(comoT, `select tienda_reserva_quitar('${A.id}')`).error)
    A = apartar(comoT, 1)
    const V = json(comoT, `select tienda_reserva_recoger('${A.id}', null, 'mostrador')`)
    check('recoger: la venta, al precio apartado (170), con el coste de la línea', V.ticket && Number(V.total) === 170 && Number(V.beneficio) === 108, JSON.stringify(V))
    const venta = JSON.parse(q(`select row_to_json(v) from tienda_ventas v where ticket = '${V.ticket}'`).out)
    check('  …apuntada como cualquier venta, y sin tocar el stock otra vez (2)', venta.stock_id === linea && Number(venta.coste) === 62 && venta.unidades === 1 && uds() === 2 && q(`select count(*) from tienda_reservas`).out === '0')
    json(comoT, `select tienda_deshacer_venta('${V.ticket}')`)
    check('deshacer esa venta: vuelve al stock (3)', uds() === 3)
    A = apartar(comoT, 1, 'Jon', "now() + interval '1 day'", '150')
    const V2 = json(comoT, `select tienda_reserva_recoger('${A.id}', 140, 'evento')`)
    check('recoger con otro precio y otro sitio', Number(V2.total) === 140 && q(`select donde from tienda_ventas where ticket = '${V2.ticket}'`).out === 'evento')
    check('un sitio que no existe: no', (() => { const B = apartar(comoT, 1, 'Leo'); const x = json(comoT, `select tienda_reserva_recoger('${B.id}', null, 'marte')`); json(comoT, `select tienda_reserva_quitar('${B.id}')`); return !!x.error })())

    console.log('── Caducar ──')
    A = apartar(comoT, 1, 'Iker', "now() + interval '1 day'")
    q(`update tienda_reservas set hasta = now() - interval '1 minute' where id = '${A.id}'`)
    const antes = uds()
    check('sin cuenta (el escaparate al abrirse), las caducadas vuelven', q(`${comoNadie} select tienda_reservas_al_dia('${T}')`).out === '1' && uds() === antes + 1 && q(`select count(*) from tienda_reservas`).out === '0')
    const B = apartar(comoT, 1, 'Mik')
    check('  …y las que no han caducado, no', q(`${comoNadie} select tienda_reservas_al_dia('${T}')`).out === '0' && q(`select count(*) from tienda_reservas`).out === '1')
    check('la tienda, sin decir cuál: la suya', q(`${comoT} select tienda_reservas_al_dia()`).out === '0')
    q(`${comoT} delete from tienda_stock where id = '${linea}'`)
    check('si se borra la línea, lo apartado se va con ella', q(`select count(*) from tienda_reservas where id = '${B.id}'`).out === '0')
  }
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
