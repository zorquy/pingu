// Tanda 1236 — las tiendas en el Mercado, contra PostgreSQL:
//   · `tiendas_con_la_carta`: cada línea visible con unidades, con su stock_id,
//     la más barata primero (con la oferta), sin coste, sin lo oculto, lo
//     agotado ni las tiendas baneadas, sin precio si la tienda no lo enseña, y
//     «de tu lista» por idioma y versión;
//   · `tiendas_agenda`: todas las tiendas con lo que enseñan (cartas y
//     productos), las de tu lista primero, filtros por texto, ciudad, local y
//     «de tu lista», páginas, y las ciudades de todas para el desplegable;
//   · que anon puede llamar a las dos, y que la migración aguanta dos veces y
//     sentencia a sentencia.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1236'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1236-tiendas-mercado.sql`, 'utf8')
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
      create table user_profiles (id uuid primary key, banner_url text, username text, display_name text, avatar_url text, is_admin boolean not null default false, is_moderator boolean default false, is_banned boolean default false, onboarding_completed boolean, notification_prefs_disabled text[] not null default '{}', created_at timestamptz not null default now());
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
      grant select on tcg_cards, tcg_card_prices, tcg_products, tcg_sets to anon, authenticated;
      create schema storage; grant usage on schema storage to anon, authenticated, service_role;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid());
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      create function storage.foldername(name text) returns text[] language sql immutable as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;`])
    check('el andamio carga', r.status === 0, r.stderr)
    for (const [fichero, nombre] of [['supabase-migration-precios-tcgplayer.sql', 'eur_por_usd'], ['supabase-migration-precios-tcgplayer.sql', 'tp_de_version'], ['supabase-migration-precios-tcgplayer.sql', 'emparejamiento_dudoso'], ['supabase-migration-905-gradeadas.sql', 'valor_gradeado'], ['supabase-migration-tcggo-japones.sql', 'valor_de_linea'], ['supabase-migration-1017-portada-consultas.sql', 'valor_de_copia']]) {
      r = psql(['-d', BD, '-c', funcion(fichero, nombre)])
      if (r.status !== 0) check(`  …${nombre}`, false, r.stderr)
    }
    for (const m of ['1067-tiendas', '1068-tienda-stock', '1069-tiendas-escaparate', '1072-tienda-ventas', '1073-tienda-hoy', '1079-tiendas-vuelta-2']) {
      r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
      check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
    }
    const [T, T2, T3, T4] = ['b1', 'b2', 'b3', 'b4'].map((x) => `00000000-0000-0000-0000-0000000000${x}`)
    const ANE = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${T3}'), ('${T4}'), ('${ANE}');
      insert into user_profiles (id, username, display_name, tipo, onboarding_completed, banner_url) values
        ('${T}', 'ryu', 'RyuCards', 'tienda', true, 'https://x/b.webp'), ('${T2}', 'norte', 'Norte Cartas', 'tienda', true, null),
        ('${T3}', 'kanto', 'Kanto Store', 'tienda', true, null), ('${T4}', 'mala', 'Tienda Baneada', 'tienda', true, null),
        ('${ANE}', 'ane', 'Ane', 'persona', true, null);
      update user_profiles set is_banned = true where id = '${T4}';
      insert into tiendas (user_id, ciudad, direccion, precio_visible) values ('${T}', 'Madrid', null, true), ('${T2}', 'Bilbao', 'Calle Mayor 3', true), ('${T3}', 'Bilbao', '  ', false), ('${T4}', 'Madrid', null, true);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
      insert into tcg_cards (id, market, set_id, local_id, name) values ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex'), ('sv3-1', 'WEST', 'sv3', '1', 'Pineco');
      insert into tcg_products (id, name) values (501, 'ETB');
      insert into user_wants (user_id, card_id, idioma, variante) values ('${ANE}', 'sv3-223', 'en', null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)
    const como = (u) => `set prueba.uid = '${u}'; set role authenticated;`
    const comoAnon = `set prueba.uid = ''; set role anon;`
    r = q(`${como(T)} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, coste, precio, oferta_precio, oferta_hasta, visible) values
      ('00000000-0000-0000-0000-00000000a001', 'sv3-223', 'en', 'NM', 'normal', 1, 200, 320, 300, now() + interval '2 days', true),
      ('00000000-0000-0000-0000-00000000a002', 'sv3-223', 'es', 'NM', 'normal', 0, 100, 150, null, null, true),
      ('00000000-0000-0000-0000-00000000a003', 'sv3-223', 'es', 'EX', 'normal', 1, 100, 99, null, null, false),
      ('00000000-0000-0000-0000-00000000a004', 'sv3-1', 'es', 'NM', 'normal', 5, 0.1, 0.5, null, null, true);
      insert into tienda_stock (product_id, estado, unidades, precio) values (501, 'sellado', 2, 60);`)
    check('el stock de RyuCards entra', r.ok, r.err)
    r = q(`${como(T2)} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, precio) values ('00000000-0000-0000-0000-00000000b001', 'sv3-223', 'en', 'NM', 'normal', 1, 290)`)
    check('  …el de Norte', r.ok, r.err)
    r = q(`${como(T3)} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, precio) values ('00000000-0000-0000-0000-00000000c001', 'sv3-223', 'es', 'NM', 'normal', 1, 250)`)
    check('  …el de Kanto (que no enseña precios)', r.ok, r.err)
    r = q(`${como(T4)} insert into tienda_stock (card_id, idioma, estado, variante, unidades, precio) values ('sv3-223', 'en', 'NM', 'normal', 1, 10)`)
    check('  …y el de la baneada', r.ok, r.err)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1236 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    {
      const trozos = []; let buf = '', dentro = false
      for (const linea of sinNotify.split('\n')) {
        buf += linea + '\n'
        if ((linea.match(/\$\$/g) || []).length % 2) dentro = !dentro
        if (!dentro && /;\s*$/.test(linea) && !/^\s*--/.test(linea)) { trozos.push(buf); buf = '' }
      }
      const malos = trozos.filter((s) => psql(['-d', BD, '-c', s]).status !== 0)
      check('  …y sentencia a sentencia, cada una en su conexión', malos.length === 0, malos[0]?.slice(0, 200))
    }

    console.log('── tiendas_con_la_carta ──')
    const conLa = (c, card) => { const x = q(`${c} select coalesce(json_agg(t), '[]') from tiendas_con_la_carta('${card}') t`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    let L = conLa(como(ANE), 'sv3-223')
    check('tres líneas: Norte 290, RyuCards 300 (la oferta) y Kanto sin precio, en ese orden', Array.isArray(L) && L.map((x) => x.username).join() === 'norte,ryu,kanto' && Number(L[0].precio) === 290 && Number(L[1].precio) === 300 && L[2].precio === null, JSON.stringify(L))
    check('  …con su línea del stock', L[1]?.stock_id === '00000000-0000-0000-0000-00000000a001' && L[0]?.stock_id === '00000000-0000-0000-0000-00000000b001')
    check('  …la de oferta trae el precio de antes', Number(L[1]?.precio_antes) === 320 && L[0]?.precio_antes === null)
    check('  …sin la agotada, la oculta ni la baneada', !L.some((x) => ['00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a003'].includes(x.stock_id)) && !L.some((x) => x.username === 'mala'))
    check('  …nunca el coste', !JSON.stringify(L).includes('coste') && !JSON.stringify(L).includes('200'))
    check('  …con local solo Norte (una dirección en blanco no es local)', L.find((x) => x.username === 'norte')?.con_local === true && L.find((x) => x.username === 'kanto')?.con_local === false && L.find((x) => x.username === 'ryu')?.con_local === false)
    check('  …«de tu lista» por idioma: las inglesas sí, la española no', L.find((x) => x.username === 'norte')?.de_tu_lista === true && L.find((x) => x.username === 'kanto')?.de_tu_lista === false)
    const LA = conLa(comoAnon, 'sv3-223')
    check('sin cuenta también, y sin «de tu lista»', Array.isArray(LA) && LA.length === 3 && LA.every((x) => x.de_tu_lista === false), JSON.stringify(LA).slice(0, 200))

    console.log('── tiendas_agenda ──')
    const ag = (c, args = '') => { const x = q(`${c} select tiendas_agenda(${args})`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    let A = ag(como(ANE))
    const nombres = (A) => (A.tiendas || []).map((t) => t.username).join()
    check('tres tiendas (no la baneada), las de tu lista primero', A.total === 3 && A.tiendas?.length === 3 && !nombres(A).includes('mala') && ['norte', 'ryu'].includes(A.tiendas[0].username) && A.tiendas[2].username === 'kanto', JSON.stringify(A).slice(0, 300))
    const ryu = A.tiendas?.find((t) => t.username === 'ryu') || {}
    check('RyuCards: 2 cartas a la vista (sin la agotada ni la oculta), 1 producto y 1 de tu lista', ryu.cartas === 2 && ryu.productos === 1 && ryu.de_tu_lista === 1, JSON.stringify(ryu))
    check('  …con su portada y su ciudad, sin coste', ryu.banner_url === 'https://x/b.webp' && ryu.ciudad === 'Madrid' && !JSON.stringify(A).includes('coste'))
    check('las ciudades de todas (sin la baneada): Bilbao 2, Madrid 1', A.ciudades?.Bilbao === 2 && A.ciudades?.Madrid === 1, JSON.stringify(A.ciudades))
    check('buscar «norte»', nombres(ag(como(ANE), `p_texto => 'norte'`)) === 'norte')
    check('  …o por ciudad escrita («bilb»)', ag(como(ANE), `p_texto => 'bilb'`).total === 2)
    A = ag(como(ANE), `p_ciudad => 'bilbao'`)
    check('la ciudad del desplegable (sin distinguir mayúsculas), y las ciudades siguen siendo todas', A.total === 2 && A.ciudades?.Madrid === 1)
    check('con local: solo Norte', nombres(ag(como(ANE), 'p_con_local => true')) === 'norte')
    check('de tu lista: Norte y RyuCards', ag(como(ANE), 'p_de_mi_lista => true').total === 2)
    A = ag(como(ANE), 'p_desde => 2, p_cuantas => 2')
    check('páginas: la tercera sola, con el total de siempre', A.total === 3 && A.tiendas.length === 1 && A.tiendas[0].username === 'kanto')
    A = ag(comoAnon)
    check('sin cuenta: las tres, ninguna «de tu lista»', A.total === 3 && A.tiendas.every((t) => t.de_tu_lista === 0), JSON.stringify(A).slice(0, 200))
    check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  }
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
