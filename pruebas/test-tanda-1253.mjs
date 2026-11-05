// Tanda 1253 — el SKU en la base, contra PostgreSQL: `tienda_sku` da LO MISMO
// que `skuDe` de la web con los mismos casos (número con total, ceros, TG01,
// SVP 205, gradeadas, versiones de TCGGO, productos, acentos), y
// `tienda_sku_buscar` encuentra las líneas: la tienda, todas las suyas (ocultas
// y a cero también); los demás, solo lo que enseña el escaparate, nunca de la
// tienda de pruebas y nunca el coste. Primero lo que tiene unidades, y lo más
// barato.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const { skuDe } = await import(`${REPO}/js/tiendas-puro.js`)
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1253'
const q = (s, uid = '') => { const r = psql(['-At', '-d', BD, '-c', `${uid ? `set prueba.uid = '${uid}';` : "set prueba.uid = '';"} ${s}`]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const mig = readFileSync(`${REPO}/supabase-migration-1253-tienda-sku.sql`, 'utf8')
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
    create extension if not exists unaccent;
    create or replace function immutable_unaccent(text) returns text language sql immutable strict parallel safe as $f$ select public.unaccent('public.unaccent', $1) $f$;
    create schema if not exists auth; create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema public to anon, authenticated;
    create table tiendas (user_id uuid primary key, de_pruebas boolean not null default false);
    create table tcg_sets (id text, market text default 'WEST', name text, tcg_online_code text, primary key (id, market));
    create table tcg_cards (id text primary key, market text not null default 'WEST', set_id text, local_id text, name text, name_es text);
    create table tcg_products (id bigint primary key, name text not null);
    create table tienda_stock (id uuid primary key default gen_random_uuid(), tienda_id uuid not null, card_id text, market text not null default 'WEST', product_id bigint,
      idioma text not null default 'es', estado text not null default 'NM', variante text not null default 'normal', gradeo text, unidades int not null default 1,
      coste numeric(10,2), precio numeric(10,2), oferta_precio numeric(10,2), oferta_hasta timestamptz, visible boolean not null default true);
    ${funcion('supabase-migration-1079-tiendas-vuelta-2.sql', 'tienda_precio_de')}
    ${funcion('supabase-migration-1245-tienda-de-pruebas.sql', 'tienda_publica')}`])
  check('el andamio carga', r.status === 0, r.stderr)
  for (let i = 0; i < 2; i++) {
    r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
    check(i ? '  …y otra vez (se puede ejecutar dos veces)' : 'la migración entra', r.status === 0, r.stderr)
  }

  console.log('── 1. La misma regla que la web ──')
  const CASOS = [
    [{ set_id: 'sv10', numero: '276/217', idioma: 'es', estado: 'NM', variante: 'holo' }, 'ASC'],
    [{ set_id: 'sv10', numero: '0276', idioma: 'es', estado: 'NM', variante: 'normal' }, 'ASC'],
    [{ set_id: 'swsh12tg', numero: 'TG01', idioma: 'en', estado: 'EX', variante: 'normal' }, 'SIT'],
    [{ set_id: 'svp', numero: 'SVP 205', idioma: 'es', estado: 'LP', variante: 'reverse' }, 'PR-SV'],
    [{ set_id: 'sv3pt5', numero: '199/165', idioma: 'ja', estado: 'NM', gradeo: 'PSA 10', variante: 'holo' }, ''],
    [{ set_id: 'sv8pt5', numero: '1', idioma: 'it', estado: 'GD', variante: 'poke-ball' }, 'PRE'],
    [{ set_id: 'sv8pt5', numero: '1', idioma: 'it', estado: 'GD', variante: 'master-ball' }, 'PRE'],
    [{ set_id: 'base1', numero: '4/102', idioma: 'en', estado: 'PL', variante: 'primera' }, 'BS'],
    [{ set_id: 'base1', numero: '4', idioma: 'en', estado: 'PO', variante: 'sello-1999-2000' }, 'BS'],
    [{ set_id: 'mep', numero: '000', idioma: 'fr', estado: 'MT', variante: 'normal' }, 'MEP'],
    [{ set_id: 'x', numero: '', idioma: 'de', estado: 'NM', variante: 'normal' }, ''],
    [{ set_id: 'Pokémon Fútbol', numero: 'Ñ-12', idioma: 'zh', estado: 'NM', variante: 'Édition Spéciale' }, ''],
    [{ product_id: 123456, idioma: 'ja', estado: 'sellado' }, ''],
    [{ product_id: 99, estado: 'sellado' }, ''],
  ]
  for (const [l, codigo] of CASOS) {
    const web = skuDe(l, codigo)
    const base = q(`select public.tienda_sku(${lit(codigo)}, ${lit(l.set_id)}, ${lit(l.numero)}, ${lit(l.idioma)}, ${lit(l.estado)}, ${lit(l.gradeo)}, ${lit(l.variante)}, ${lit(l.product_id)})`)
    check(`${web}`, base.ok && base.out === web, `${base.out || base.err} ≠ ${web}`)
  }

  console.log('── 2. Buscar por SKU ──')
  const [T, P, ANE] = ['b1', 'b5', 'c1'].map((x) => `00000000-0000-0000-0000-0000000000${x}`)
  r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${P}'), ('${ANE}');
    insert into tiendas values ('${T}', false), ('${P}', true);
    insert into tcg_sets values ('sv10', 'WEST', 'Ascended Heroes', 'ASC'), ('sv10', 'JP', 'Japonés', 'ASCJ');
    insert into tcg_cards values ('sv10-276', 'WEST', 'sv10', '276', 'Mega Charizard X ex', 'Mega-Charizard X ex'), ('sv10j-276', 'JP', 'sv10', '276', 'メガリザードンXex', null);
    insert into tcg_products values (555, 'Caja de sobres');
    insert into tienda_stock (id, tienda_id, card_id, market, idioma, estado, variante, unidades, coste, precio, visible) values
      ('10000000-0000-0000-0000-000000000001', '${T}', 'sv10-276', 'WEST', 'es', 'NM', 'holo', 2, 80, 120, true),
      ('10000000-0000-0000-0000-000000000002', '${T}', 'sv10-276', 'WEST', 'es', 'NM', 'holo', 1, 70, 110, true),
      ('10000000-0000-0000-0000-000000000003', '${T}', 'sv10-276', 'WEST', 'es', 'NM', 'holo', 0, 60, 90, true),
      ('10000000-0000-0000-0000-000000000004', '${T}', 'sv10-276', 'WEST', 'es', 'NM', 'holo', 3, 60, 100, false),
      ('10000000-0000-0000-0000-000000000005', '${T}', 'sv10-276', 'WEST', 'es', 'EX', 'holo', 1, 60, 100, true),
      ('10000000-0000-0000-0000-000000000006', '${T}', 'sv10j-276', 'JP', 'ja', 'NM', 'holo', 1, 60, 100, true),
      ('10000000-0000-0000-0000-000000000007', '${P}', 'sv10-276', 'WEST', 'es', 'NM', 'holo', 1, 60, 100, true);
    insert into tienda_stock (id, tienda_id, product_id, idioma, estado, variante, unidades, precio) values
      ('10000000-0000-0000-0000-000000000008', '${T}', 555, 'es', 'sellado', 'normal', 4, 150);`])
  check('las líneas de prueba entran', r.status === 0, r.stderr)
  const ids = (s) => s.out ? JSON.parse(s.out).map((f) => f.id.slice(-1)) : []
  const anon = q(`select public.tienda_sku_buscar('${T}', 'ASC-276-ES-NM-H')`)
  check('quien no es la tienda ve solo lo del escaparate, lo que tiene unidades y lo más barato primero', anon.ok && JSON.stringify(ids(anon)) === '["2","1"]', anon.out || anon.err)
  check('  …y nunca el coste', anon.ok && !/coste/.test(anon.out))
  const tienda = q(`select public.tienda_sku_buscar(null, 'ASC-276-ES-NM-H')`, T)
  check('la tienda (sin decir cuál: la suya) ve todas, también la oculta y la que está a cero, esa al final', tienda.ok && JSON.stringify(ids(tienda)) === '["4","2","1","3"]', tienda.out || tienda.err)
  check('el estado cuenta: la EX es otro SKU', JSON.stringify(ids(q(`select public.tienda_sku_buscar('${T}', 'ASC-276-ES-EX-H')`))) === '["5"]')
  check('el catálogo cuenta: la japonesa lleva el código de SU set', JSON.stringify(ids(q(`select public.tienda_sku_buscar('${T}', 'ASCJ-276-JA-NM-H')`))) === '["6"]')
  check('lo que escribe el lector: en minúsculas o con espacios, casa igual', JSON.stringify(ids(q(`select public.tienda_sku_buscar('${T}', ' asc-276-es-nm-h\n')`))) === '["2","1"]')
  check('un producto sellado, por su SKU', JSON.stringify(ids(q(`select public.tienda_sku_buscar('${T}', 'SEL-555-ES')`))) === '["8"]')
  check('la tienda de pruebas no la encuentra nadie más', q(`select public.tienda_sku_buscar('${P}', 'ASC-276-ES-NM-H')`, ANE).out === '[]')
  check('  …pero ella sí', JSON.stringify(ids(q(`select public.tienda_sku_buscar('${P}', 'ASC-276-ES-NM-H')`, P))) === '["7"]')
  check('un SKU vacío o sin tienda no busca nada', q(`select public.tienda_sku_buscar('${T}', '')`).out === '[]' && q(`select public.tienda_sku_buscar(null, 'ASC-276-ES-NM-H')`).out === '[]')

  console.log('── 3. El SKU de una línea ──')
  check('el de una línea suya', q(`select public.tienda_sku_de('10000000-0000-0000-0000-000000000004')`, T).out === 'ASC-276-ES-NM-H')
  check('el de una oculta de otra tienda, no', q(`select public.tienda_sku_de('10000000-0000-0000-0000-000000000004')`, ANE).out === '')
  check('el de una del escaparate, sí', q(`select public.tienda_sku_de('10000000-0000-0000-0000-000000000001')`, ANE).out === 'ASC-276-ES-NM-H')
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
