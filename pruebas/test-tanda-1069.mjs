// Tanda 1069 — lo que ve la gente de una tienda: lo puro (el mapa, el texto
// de quién la da) y la migración contra PostgreSQL de verdad: el escaparate
// (sin coste, sin lo oculto ni lo agotado, «de tu lista» con la regla de
// idioma y versión de la 1047), las tiendas que tienen una carta, la franja
// del Mercado y el Mercado con las tiendas mezcladas, «Personas / Tiendas».
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  check('enlaceAMapa: la dirección con la ciudad', P.enlaceAMapa('Calle de ejemplo, 12', 'Bilbao') === 'https://www.google.com/maps/search/?api=1&query=Calle%20de%20ejemplo%2C%2012%2C%20Bilbao')
  check('  …sin dirección, no hay botón (la ciudad sola no es la tienda)', P.enlaceAMapa('', 'Bilbao') === null && P.enlaceAMapa(null, null) === null)
  // textoDeQuien vive en mercado.js, que importa media colección: el trozo puro.
  const fuente = readFileSync(`${REPO}/js/mi-coleccion/mercado.js`, 'utf8')
  const trozo = fuente.slice(fuente.indexOf('export const textoDeGente'), fuente.indexOf('// `cruces`: los user_id'))
  const dir = mkdtempSync(join(tmpdir(), 'merc1069-'))
  writeFileSync(join(dir, 't.mjs'), trozo)
  const M = await import(join(dir, 't.mjs'))
  check('textoDeQuien: solo personas, como siempre', M.textoDeQuien(2, 0) === 'La dan 2' && M.textoDeQuien(1, 0) === 'La da 1')
  check('  …solo tiendas', M.textoDeQuien(0, 1) === 'En 1 tienda' && M.textoDeQuien(0, 3) === 'En 3 tiendas')
  check('  …las dos', M.textoDeQuien(2, 1) === 'La dan 2 · 1 tienda')
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1069'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1069-tiendas-escaparate.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  check('  …ni toca intercambios_mercado (sin ella la web la sigue usando)', !/function public\.intercambios_mercado/.test(mig))
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
      create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, is_admin boolean not null default false, is_moderator boolean default false, is_banned boolean default false, onboarding_completed boolean, created_at timestamptz not null default now());
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
    for (const m of ['1067-tiendas', '1068-tienda-stock']) {
      r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
      check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
    }
    // La de la 1047 (el Mercado de siempre), para ver que sigue.
    r = psql(['-d', BD, '-c', funcion('supabase-migration-1047-deseos-con-version.sql', 'intercambios_mercado')])
    check('el Mercado de siempre (1047) está', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1069 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)

    const T = '00000000-0000-0000-0000-0000000000b1' // la tienda
    const T2 = '00000000-0000-0000-0000-0000000000b2' // otra tienda, sin precios a la vista
    const ANE = '00000000-0000-0000-0000-0000000000c1' // una persona que quiere cartas
    const JON = '00000000-0000-0000-0000-0000000000c2' // una persona que da cartas
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${ANE}'), ('${JON}');
      insert into user_profiles (id, username, display_name, tipo, onboarding_completed) values
        ('${T}', 'rincon', 'El Rincón', 'tienda', true), ('${T2}', 'norte', 'Mazo Norte', 'tienda', true),
        ('${ANE}', 'ane', 'Ane', 'persona', true), ('${JON}', 'jon', 'Jon', 'persona', true);
      insert into tiendas (user_id, ciudad, precio_visible) values ('${T}', 'Bilbao', true), ('${T2}', 'Getxo', false);
      insert into tcg_cards values
        ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', null, null),
        ('sv8-238', 'WEST', 'sv8', '238', 'Pikachu ex', 'Pikachu ex', 'pikachu ex', null, null),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', null, null);
      insert into tcg_products values (501, 'Surging Sparks Elite Trainer Box', 70, 71, null);
      insert into tienda_stock (tienda_id, card_id, idioma, estado, variante, unidades, coste, precio, visible, entro_el) values
        ('${T}', 'sv3-223', 'es', 'NM', 'normal', 1, 62, 95, true, now() - interval '1 day'),
        ('${T}', 'sv8-238', 'en', 'NM', 'normal', 2, 210, 279, true, now() - interval '2 days'),
        ('${T}', 'sv3-125', 'es', 'NM', 'normal', 0, 4, 6, true, now()),
        ('${T}', 'sv3-125', 'es', 'EX', 'reverse', 1, 3, 5, false, now()),
        ('${T2}', 'sv3-223', 'es', 'LP', 'normal', 1, 40, 70, true, now());
      insert into tienda_stock (tienda_id, product_id, estado, idioma, unidades, coste, precio) values ('${T}', 501, 'sellado', 'en', 6, 44, 64.95);
      insert into user_wants (user_id, card_id, idioma, variante) values ('${ANE}', 'sv3-223', 'es', null), ('${ANE}', 'sv8-238', 'es', null);
      insert into user_collection (user_id, card_id, idioma, cambio) values ('${JON}', 'sv3-223', 'es', 1), ('${T}', 'sv8-238', 'en', 1);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)

    const esc = (quien, filtros = {}, orden = 'recientes') => {
      const pre = quien ? `set prueba.uid = '${quien}'; set role authenticated;` : 'set role anon;'
      const x = q(`${pre} select tienda_escaparate('${T}', '${JSON.stringify(filtros)}'::jsonb, '${orden}')`)
      return x.ok ? JSON.parse(x.out || 'null') : { error: x.err }
    }
    const sin = esc(null)
    check('escaparate sin cuenta: lo visible y con unidades (3: dos cartas y el sellado)', sin.total === 3 && sin.en_escaparate === 3, JSON.stringify(sin).slice(0, 300))
    check('  …nunca el coste', !JSON.stringify(sin).includes('"coste"') && sin.filas.every((f) => !('coste' in f)))
    check('  …con su precio', sin.filas.find((f) => f.card_id === 'sv3-223').precio === 95 && sin.precios === true)
    check('  …lo sellado, con su nombre', sin.filas.find((f) => f.product_id === 501)?.nombre === 'Surging Sparks Elite Trainer Box')
    check('  …sin cuenta no hay «de tu lista»', sin.de_tu_lista === 0)
    const ane = esc(ANE)
    check('con la cuenta de Ane: 1 de su lista (la Charizard en español; la Pikachu la quiere en español y es inglesa)', ane.de_tu_lista === 1 && ane.filas.filter((f) => f.de_tu_lista).map((f) => f.card_id).join() === 'sv3-223', JSON.stringify(ane.filas.map((f) => [f.card_id, f.de_tu_lista])))
    check('  …y lo de su lista sale primero', ane.filas[0].card_id === 'sv3-223')
    check('  …filtro «De tu lista»', esc(ANE, { de_tu_lista: true }).total === 1)
    check('  …filtro sellado', esc(null, { catalogo: ['sellado'] }).filas.map((f) => f.product_id).join() === '501')
    check('  …idioma', esc(null, { idioma: ['en'] }).total === 2)
    check('  …texto', esc(null, { q: 'pika' }).total === 1 && esc(null, { q: 'elite' }).total === 1)
    check('  …una carta concreta (desde «En tiendas»)', esc(null, { carta: 'sv8-238' }).filas.map((f) => f.card_id).join() === 'sv8-238')
    check('  …más baratas primero', esc(null, {}, 'precio_asc').filas.map((f) => f.precio).join() === '64.95,95,279')
    check('  …facetas de idioma y catálogo', sin.facetas.idioma.es === 1 && sin.facetas.idioma.en === 2 && sin.facetas.catalogo.sellado === 1)
    const norte = JSON.parse(q(`set role anon; select tienda_escaparate('${T2}')`).out)
    check('una tienda sin precios a la vista: sin precio y lo dice', norte.precios === false && norte.filas[0].precio === null)
    check('el escaparate de una persona no existe (null)', q(`set role anon; select tienda_escaparate('${JON}') is null`).out === 't')
    q(`update user_profiles set is_banned = true where id = '${T2}'`)
    check('ni el de una tienda castigada', q(`set role anon; select tienda_escaparate('${T2}') is null`).out === 't')
    q(`update user_profiles set is_banned = false where id = '${T2}'`)

    const quien = q(`set prueba.uid = '${ANE}'; set role authenticated; select json_agg(json_build_object('u', username, 'p', precio, 'tuya', de_tu_lista, 'c', ciudad)) from tiendas_que_tienen('sv3-223')`)
    const qj = quien.ok ? JSON.parse(quien.out) : []
    check('tiendas_que_tienen: las dos, la más barata primero; la que no enseña precios, sin precio y al final', qj.length === 2 && qj[0].u === 'rincon' && Number(qj[0].p) === 95 && qj[0].tuya === true && qj[0].c === 'Bilbao' && qj[1].u === 'norte' && qj[1].p === null, quien.out || quien.err)
    check('  …sin las agotadas ni las ocultas', q(`set role anon; select count(*) from tiendas_que_tienen('sv3-125')`).out === '0')
    check('  …sin cuenta también (es un escaparate)', q(`set role anon; select count(*) from tiendas_que_tienen('sv3-223')`).out === '2')

    const franja = q(`set prueba.uid = '${ANE}'; set role authenticated; select json_agg(json_build_object('u', username, 'n', cartas)) from tiendas_con_mis_deseos()`)
    check('la franja: las tiendas con algo de la lista de Ane, con cuántas', franja.out === '[{"u" : "norte", "n" : 1}, {"u" : "rincon", "n" : 1}]' || franja.out === '[{"u" : "rincon", "n" : 1}, {"u" : "norte", "n" : 1}]', franja.out || franja.err)
    check('  …anon, nada', !q(`set role anon; select * from tiendas_con_mis_deseos()`).ok)
    q(`insert into user_wants (user_id, card_id) values ('${T}', 'sv3-223')`)
    const propia = q(`set prueba.uid = '${T}'; set role authenticated; select count(*) from tiendas_con_mis_deseos() where username = 'rincon'`)
    check('  …una tienda no se ve a sí misma', propia.ok && propia.out.endsWith('0'), propia.err)

    const merc = (quien, extra = '') => {
      const x = q(`set prueba.uid = '${ANE}'; set role authenticated; select json_agg(row_to_json(m) order by card_id) from mercado_con_tiendas(p_quien => '${quien}'${extra}) m`)
      return x.ok ? JSON.parse(x.out || '[]') || [] : { error: x.err }
    }
    const todos = merc('todos')
    const cha = todos.find((f) => f.card_id === 'sv3-223')
    check('Mercado, todos: la Charizard la da Jon y la tienen dos tiendas', cha?.personas === 1 && cha?.tiendas === 2 && Number(cha?.desde) === 95, JSON.stringify(cha))
    check('  …en «gente», primero la persona y luego las tiendas, con su precio', cha.gente.map((g) => `${g.username}${g.tienda ? `:${g.precio}` : ''}`).join() === 'jon,rincon:95,norte:null', JSON.stringify(cha.gente))
    check('  …«dan» son solo las personas', cha.dan.length === 1)
    const pika = todos.find((f) => f.card_id === 'sv8-238')
    check('  …la Pikachu solo en la tienda (lo que la tienda tiene en su colección a cambio no cuenta)', pika?.personas === 0 && pika?.tiendas === 1, JSON.stringify(pika))
    check('  …nada oculto ni agotado', !todos.some((f) => f.card_id === 'sv3-125'))
    check('  …ni lo sellado (el Mercado es de cartas)', todos.every((f) => f.card_id))
    check('personas: solo lo de la gente', merc('personas').map((f) => `${f.card_id}:${f.tiendas}`).join() === 'sv3-223:0')
    check('tiendas: solo las tiendas', merc('tiendas').map((f) => `${f.card_id}:${f.personas}`).join() === 'sv3-223:0,sv8-238:0')
    check('«Solo las que busco» vale para las tiendas (idioma de su deseo)', merc('tiendas', ', p_solo_mias => true').map((f) => f.card_id).join() === 'sv3-223')
    check('una tienda no se ve a sí misma en el Mercado', q(`set prueba.uid = '${T}'; set role authenticated; select count(*) from mercado_con_tiendas(p_quien => 'tiendas') where 'rincon' in (select g->>'username' from jsonb_array_elements(gente) g)`).out.endsWith('0'))
    check('el Mercado de siempre sigue respondiendo', q(`set role anon; select count(*) from intercambios_mercado()`).ok)
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
