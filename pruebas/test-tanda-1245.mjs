// Tanda 1245 — Una tienda DE PRUEBAS es un fantasma (PINGU: «que sea un perfil
// como fantasma de pruebas»), contra PostgreSQL:
//   · marcada (`tiendas.de_pruebas`), no sale para nadie más —ni sin cuenta, ni
//     una persona, ni el equipo, ni otra tienda— en la agenda, «Recién llegado»,
//     su escaparate, «En tiendas» de una carta, `tiendas_que_tienen`,
//     `tiendas_con_mis_deseos` ni las fotos de una copia;
//   · ELLA sí se ve (para probar su escaparate);
//   · «Avisar a los que la buscan» desde ella no avisa a nadie;
//   · `admin_tienda_de_pruebas`: solo el equipo, y desmarcar la devuelve;
//   · sin marcar, todo como antes; la migración aguanta dos veces y sentencia
//     a sentencia.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1245'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1245-tienda-de-pruebas.sql`, 'utf8')
  const mig1244 = readFileSync(`${REPO}/supabase-migration-1244-tiendas-pagina.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')
  const mig1236 = readFileSync(`${REPO}/supabase-migration-1236-tiendas-mercado.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')
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
      create or replace function public.immutable_unaccent(text) returns text language sql immutable as $f$ select translate($1, 'áéíóúüñ', 'aeiouun') $f$;
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
    for (const m of ['1067-tiendas', '1068-tienda-stock', '1069-tiendas-escaparate', '1072-tienda-ventas', '1073-tienda-hoy', '1074-tienda-sin-local', '1079-tiendas-vuelta-2']) {
      r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
      check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
    }
    const [T, T2, T3, T4, T5] = ['b1', 'b2', 'b3', 'b4', 'b5'].map((x) => `00000000-0000-0000-0000-0000000000${x}`)
    const ANE = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${T3}'), ('${T4}'), ('${T5}'), ('${ANE}');
      insert into user_profiles (id, username, display_name, tipo, onboarding_completed, banner_url) values
        ('${T}', 'ryu', 'RyuCards', 'tienda', true, 'https://x/b.webp'), ('${T2}', 'norte', 'Norte Cartas', 'tienda', true, null),
        ('${T3}', 'kanto', 'Kanto Store', 'tienda', true, null), ('${T4}', 'mala', 'Tienda Baneada', 'tienda', true, null),
        ('${T5}', 'prueba', 'Tienda de Prueba', 'tienda', true, null),
        ('${ANE}', 'ane', 'Ane', 'persona', true, null);
      update user_profiles set is_banned = true where id = '${T4}';
      insert into tiendas (user_id, ciudad, direccion, precio_visible, horario, web, instagram) values ('${T}', 'Madrid', null, true, 'L–S · 10:30–20:30', 'ryucards.es', 'ryucards'), ('${T2}', 'Bilbao', 'Calle Mayor 3', true, null, null, null), ('${T3}', 'Bilbao', '  ', false, null, null, null), ('${T4}', 'Madrid', null, true, null, null, null), ('${T5}', 'Madrid', null, true, null, null, null);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
      insert into tcg_cards (id, market, set_id, local_id, name, name_search) values ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'charizard ex'), ('sv3-1', 'WEST', 'sv3', '1', 'Pineco', 'pineco');
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
    // Lo que el Mercado (1109) necesita de los cambios, en pequeño: lo libre
    // de una línea es lo que tiene para cambio (sin propuestas en esta base).
    r = psql(['-d', BD, '-c', `create or replace function public.cambio_libres_de(p_linea uuid, p_cambio int, p_cantidad int) returns int language sql stable as $f$ select greatest(least(coalesce(p_cambio, 0), coalesce(p_cantidad, 0)), 0) $f$`])
    check('el Mercado tiene su cambio_libres_de de prueba', r.status === 0, r.stderr)
    r = q(`${como(T5)} insert into tienda_stock (id, card_id, idioma, estado, variante, unidades, precio) values ('00000000-0000-0000-0000-00000000e001', 'sv3-223', 'en', 'NM', 'normal', 1, 1)`)
    check('  …y el de la de pruebas (la más barata: saldría la primera)', r.ok, r.err)
    r = psql(['-d', BD, '-c', mig1236])
    check('la 1236 entra antes', r.status === 0, r.stderr)
    // Una destacada de RyuCards: el Pineco (1079), con su estrella.
    r = q(`${como(T)} update tienda_stock set destacada = true where id = '00000000-0000-0000-0000-00000000a004'`)
    check('la destacada entra', r.ok, r.err)
    for (const [m, texto] of [['1244', mig1244], ['1089', readFileSync(`${REPO}/supabase-migration-1089-tienda-avisar.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')], ['1235', readFileSync(`${REPO}/supabase-migration-1235-tienda-fotos.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')]]) {
      r = psql(['-d', BD, '-c', texto])
      check(`la ${m} entra antes`, r.status === 0, r.stderr)
    }
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1245 entra', r.status === 0, r.stderr)
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


    // Sin cuenta, auth.uid() es NULL: la respuesta tiene que ser «no», no NULL
    // (un NULL en el `if` del escaparate la dejaba ver).
    check('tienda_publica sin cuenta: false, nunca NULL', q(`${comoAnon} select coalesce(tienda_publica('${T5}')::text, 'NULL')`).out === 'false')
    const comoAdmin = `set prueba.uid = '${ANE}'; set prueba.admin = 'si'; set role authenticated;`
    const sinAdmin = `set prueba.admin = '';`
    check('la migración marca la que se llama «Tienda de Prueba» (y solo esa)', q(`select string_agg(user_id::text, ',') from tiendas where de_pruebas`).out === T5)

    // Lo que ve cada uno, de golpe: la agenda, lo nuevo, el escaparate, «En
    // tiendas», las de la 1069, el Mercado y la foto de una copia.
    const mira = (c) => {
      const x = (sql) => { const y = q(`${c} ${sql}`); return y.ok ? y.out : `ERROR ${y.err}` }
      return {
        agenda: x(`select tiendas_agenda()`),
        recien: x(`select tiendas_recien(24)`),
        escaparate: x(`select tienda_escaparate('${T5}')`),
        conLaCarta: x(`select count(*) from tiendas_con_la_carta('sv3-223') where tienda_id = '${T5}'`),
        queTienen: x(`select count(*) from tiendas_que_tienen('sv3-223') where tienda_id = '${T5}'`),
        deseos: x(`select count(*) from tiendas_con_mis_deseos() where tienda_id = '${T5}'`),
        mercado: x(`select coalesce(sum(tiendas), 0) from mercado_con_tiendas() where card_id = 'sv3-223'`),
        foto: x(`select tienda_foto_se_ve('00000000-0000-0000-0000-00000000e001')`),
      }
    }
    const fantasma = (v) => !v.agenda.includes('"prueba"') && !v.recien.includes('"prueba"') && !/"filas":\s*\[\s*\{/.test(v.escaparate) && v.conLaCarta === '0' && v.queTienen === '0' && (v.deseos === '0' || /permission denied/.test(v.deseos)) && v.foto === 'f'
    for (const [quien, c] of [['sin cuenta', comoAnon], ['una persona (que la busca)', como(ANE)], ['el equipo', comoAdmin], ['otra tienda', `${sinAdmin} ${como(T)}`]]) {
      const v = mira(c)
      check(`${quien}: no la ve en ningún sitio`, fantasma(v), JSON.stringify({ ...v, agenda: v.agenda.slice(0, 40), recien: v.recien.includes('"prueba"'), escaparate: v.escaparate.slice(0, 80) }))
    }
    const ane = mira(`${sinAdmin} ${como(ANE)}`)
    check('  …el Mercado cuenta tres tiendas con el Charizard, no cuatro', ane.mercado === '3', ane.mercado)
    check('  …y la agenda dice 3 tiendas', JSON.parse(ane.agenda).total === 3 && JSON.parse(ane.agenda).cifras?.tiendas === 3, ane.agenda.slice(0, 200))
    const ella = mira(como(T5))
    check('ELLA se ve: en la agenda, en lo nuevo, su escaparate y sus fotos', ella.agenda.includes('"prueba"') && ella.recien.includes('"prueba"') && /"filas":\s*\[\s*\{/.test(ella.escaparate) && ella.foto === 't', JSON.stringify(ella).slice(0, 400))

    console.log('── Avisar a los que la buscan ──')
    let x = q(`${como(T5)} select tienda_avisar('sv3-223')`)
    check('desde la de pruebas: no avisa a nadie', x.ok && JSON.parse(x.out).avisadas === 0 && q(`select count(*) from user_notifications`).out === '0', x.out || x.err)
    x = q(`${como(T)} select tienda_avisar('sv3-223')`)
    check('desde una de verdad, Ane sí recibe su aviso', x.ok && JSON.parse(x.out).avisadas === 1 && q(`select count(*) from user_notifications where recipient_id = '${ANE}'`).out === '1', x.out || x.err)

    console.log('── admin_tienda_de_pruebas ──')
    x = q(`${sinAdmin} ${como(ANE)} select admin_tienda_de_pruebas('${T5}', false)`)
    check('una persona no puede tocarla', !x.ok && /Solo el equipo/.test(x.err), x.err)
    x = q(`${como(T5)} select admin_tienda_de_pruebas('${T5}', false)`)
    check('ni la propia tienda', !x.ok, x.err)
    x = q(`${comoAdmin} select admin_tienda_de_pruebas('${ANE}', true)`)
    check('una persona no se marca (no es una tienda)', !x.ok && /no es una tienda/.test(x.err), x.err)
    x = q(`${comoAdmin} select admin_tienda_de_pruebas('${T5}', false)`)
    check('el equipo la desmarca…', x.ok, x.err)
    const vuelta = mira(`${sinAdmin} ${como(ANE)}`)
    check('  …y vuelve a verse en todo', vuelta.agenda.includes('"prueba"') && vuelta.recien.includes('"prueba"') && vuelta.conLaCarta === '1' && vuelta.queTienen === '1' && vuelta.deseos === '1' && vuelta.mercado === '4' && vuelta.foto === 't', JSON.stringify(vuelta).slice(0, 400))
    x = q(`${comoAdmin} select admin_tienda_de_pruebas('${T2}', true)`)
    check('el equipo marca otra (Norte)…', x.ok, x.err)
    check('  …y Norte desaparece de la agenda', !q(`${sinAdmin} ${comoAnon} select tiendas_agenda()`).out.includes('"norte"'))
    check('anon no puede llamar a la del equipo', !q(`${comoAnon} select admin_tienda_de_pruebas('${T2}', false)`).ok)
  }
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
