// Tanda 1251 — «Pedir fotos», contra PostgreSQL: pedirlas de una copia sin
// fotos (una pendiente por persona y copia; la tienda, a sí misma no; una
// copia oculta o de la tienda de pruebas, no; con las dos fotos ya puestas,
// «ya las tiene»), la tienda las ve en su lista y en la conversación, las da
// por vistas, y al SUBIR las fotos (escribiendo `tienda_stock_fotos` como lo
// hace el navegador) el disparador las atiende y avisa a quien las pidió.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1251'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const MIG = `${REPO}/supabase-migration-1251-tienda-fotos-pedidas.sql`
const mig = readFileSync(MIG, 'utf8')
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
    create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now());
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
    grant select on tcg_cards, tcg_card_prices, tcg_products, tcg_sets to anon, authenticated;
    create table conversations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
    create table conversation_participants (conversation_id uuid references conversations (id) on delete cascade, user_id uuid references auth.users (id), last_read_at timestamptz, primary key (conversation_id, user_id));
    create schema if not exists storage; grant usage on schema storage to anon, authenticated, service_role;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid());
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    create function storage.foldername(name text) returns text[] language sql immutable as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
    create table private_messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations (id), sender_id uuid not null references auth.users (id), body text not null, adjuntos jsonb not null default '[]', deleted_at timestamptz, created_at timestamptz not null default now());`])
  check('el andamio carga', r.status === 0, r.stderr)
  for (const [fichero, nombre] of [['supabase-migration-precios-tcgplayer.sql', 'eur_por_usd'], ['supabase-migration-precios-tcgplayer.sql', 'tp_de_version'], ['supabase-migration-precios-tcgplayer.sql', 'emparejamiento_dudoso'], ['supabase-migration-905-gradeadas.sql', 'valor_gradeado'], ['supabase-migration-tcggo-japones.sql', 'valor_de_linea'], ['supabase-migration-1017-portada-consultas.sql', 'valor_de_copia'], ['supabase-migration-942-propuestas-cambio.sql', 'cambio_conversacion'], ['supabase-migration-1108-cambio-envio-automatico.sql', 'cambio_envio_tarifa']]) {
    r = psql(['-d', BD, '-c', funcion(fichero, nombre)])
    if (r.status !== 0) check(`  …${nombre}`, false, r.stderr)
  }
  for (const m of ['1067-tiendas', '1068-tienda-stock', '1069-tiendas-escaparate', '1072-tienda-ventas', '1073-tienda-hoy', '1074-tienda-sin-local', '1079-tiendas-vuelta-2', '1092-tienda-reservas', '1235-tienda-fotos']) {
    r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
    check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
  }
  // De la 1245 solo hace falta su columna y `tienda_publica`.
  r = psql(['-d', BD, '-c', `alter table tiendas add column if not exists de_pruebas boolean not null default false; ${funcion('supabase-migration-1245-tienda-de-pruebas.sql', 'tienda_publica')}`])
  check('`tienda_publica` de la 1245', r.status === 0, r.stderr)
  const [T, P, ANE, BEA] = ['b1', 'b5', 'c1', 'c2'].map((x) => `00000000-0000-0000-0000-0000000000${x}`)
  r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${P}'), ('${ANE}'), ('${BEA}');
    insert into user_profiles (id, username, display_name, tipo, onboarding_completed) values
      ('${T}', 'ryu', 'RyuCards', 'tienda', true), ('${P}', 'prueba', 'Tienda de Prueba', 'tienda', true),
      ('${ANE}', 'ane', 'Ane', 'persona', true), ('${BEA}', 'bea', 'Bea', 'persona', true);
    insert into tiendas (user_id, precio_visible) values ('${T}', true), ('${P}', true);
    update tiendas set de_pruebas = true where user_id = '${P}';
    insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
    insert into tcg_cards (id, market, set_id, local_id, name, name_es, name_search) values ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex');`])
  check('los datos de la prueba entran', r.status === 0, r.stderr)
  const como = (u) => `set prueba.uid = '${u}'; set role authenticated;`
  const comoAnon = `set prueba.uid = ''; set role anon;`
  const L = '00000000-0000-0000-0000-00000000a001'
  const LP = '00000000-0000-0000-0000-00000000e001'
  r = q(`${como(T)} insert into tienda_stock (id, card_id, idioma, estado, unidades, coste, precio, visible) values ('${L}', 'sv3-223', 'es', 'NM', 2, 25, 40, true)`)
  check('el stock entra (2 a 40 €, coste 25)', r.ok, r.err)
  r = q(`${como(P)} insert into tienda_stock (id, card_id, idioma, estado, unidades, precio) values ('${LP}', 'sv3-223', 'es', 'NM', 1, 1)`)
  check('  …y el de la tienda de pruebas', r.ok, r.err)
  r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
  check('la 1251 entra', r.status === 0, r.stderr)
  check('  …y otra vez encima', psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')]).status === 0)
  const json = (u, sql) => { const x = q(`${u} select ${sql}`); return x.ok ? JSON.parse(x.out || 'null') : { error: x.err } }
  const LO = '00000000-0000-0000-0000-00000000a002'
  r = q(`${como(T)} insert into tienda_stock (id, card_id, idioma, estado, unidades, precio, visible) values ('${LO}', 'sv3-223', 'en', 'EX', 1, 30, false)`)
  check('una copia oculta entra', r.ok, r.err)
  const avisos = (u, tipo) => Number(q(`select count(*) from user_notifications where recipient_id = '${u}' and type = '${tipo}'`).out)

  console.log('── Pedir ──')
  check('sin cuenta, no', !q(`${comoAnon} select tienda_pedir_fotos('${L}')`).ok)
  check('la tienda a sí misma, no', /ya no está/.test(json(como(T), `tienda_pedir_fotos('${L}')`).error || ''))
  check('una copia oculta, no', /ya no está/.test(json(como(ANE), `tienda_pedir_fotos('${LO}')`).error || ''))
  check('la tienda de pruebas, no', /ya no está/.test(json(como(ANE), `tienda_pedir_fotos('${LP}')`).error || ''))
  const p1 = json(como(ANE), `tienda_pedir_fotos('${L}')`)
  check('Ane las pide', p1.id && !p1.ya_pedidas, JSON.stringify(p1))
  check('  …otra vez: «ya pedidas», la misma', json(como(ANE), `tienda_pedir_fotos('${L}')`).ya_pedidas === true && q(`select count(*) from tienda_fotos_pedidas`).out === '1')
  check('  …a la tienda le llega el aviso, a su pestaña, y una línea en la conversación con la copia', avisos(T, 'tienda_fotos') === 1 && q(`select link from user_notifications where type = 'tienda_fotos'`).out === `/tienda?ver=ofertas#fotos-${p1.id}` && q(`select count(*) from private_messages where adjuntos @> '[{"tipo":"fotos_tienda","evento":"fotos_pedidas"}]'`).out === '1' && /Charizard ex \(ES · NM\)/.test(q(`select body from private_messages`).out))
  const p2 = json(como(BEA), `tienda_pedir_fotos('${L}')`)
  check('Bea también', p2.id && p2.id !== p1.id)
  const lista = json(como(T), `tienda_fotos_pedidas_lista()`)
  check('la lista de la tienda: las dos, con quién y la carta', lista.length === 2 && lista.some((x) => x.comprador.username === 'ane') && lista[0].nombre === 'Charizard ex' && Number(lista[0].precio) === 40, JSON.stringify(lista).slice(0, 200))
  check('  …una persona no la pide', /tienda/.test(json(como(ANE), `tienda_fotos_pedidas_lista()`).error || ''))
  check('  …cada uno ve las suyas por la tabla (RLS)', q(`${como(ANE)} select count(*) from tienda_fotos_pedidas`).out === '1' && q(`${como(T)} select count(*) from tienda_fotos_pedidas`).out === '2')

  console.log('── Quitar y subir ──')
  check('Ane no la quita (es de la tienda)', /ya no está/.test(json(como(ANE), `tienda_fotos_quitar('${p2.id}')`).error || ''))
  r = q(`${como(T)} select tienda_fotos_quitar('${p2.id}')`)
  check('la tienda da por vista la de Bea', r.ok && q(`select como from tienda_fotos_pedidas where id = '${p2.id}'`).out === 'quitada', r.err)
  r = q(`${como(T)} insert into tienda_stock_fotos (stock_id, tienda_id, frente) values ('${L}', '${T}', '${T}/a.webp')`)
  check('la tienda sube el frente (como el navegador)', r.ok, r.err)
  check('  …y el disparador atiende la de Ane y le avisa', q(`select como from tienda_fotos_pedidas where id = '${p1.id}'`).out === 'subidas' && avisos(ANE, 'tienda_fotos') === 1 && avisos(BEA, 'tienda_fotos') === 0 && q(`select count(*) from private_messages where adjuntos @> '[{"tipo":"fotos_tienda","evento":"fotos_subidas"}]' and sender_id = '${T}'`).out === '1')
  check('  …la lista se queda vacía', json(como(T), `tienda_fotos_pedidas_lista()`).length === 0)
  r = q(`${como(T)} update tienda_stock_fotos set dorso = '${T}/b.webp' where stock_id = '${L}'`)
  check('subir el dorso no vuelve a avisar', r.ok && avisos(ANE, 'tienda_fotos') === 1)
  check('con las dos fotos puestas, pedir dice que ya las tiene', json(como(BEA), `tienda_pedir_fotos('${L}')`).ya_tiene === true)
  check('ninguna función de dentro se llama desde fuera', !q(`${como(ANE)} select tienda_fotos_avisar('${L}', '${ANE}', '${T}', 'x', 'x', 'x', null)`).ok)
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
