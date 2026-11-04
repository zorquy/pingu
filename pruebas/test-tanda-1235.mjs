// Tanda 1235 — fotos frontal y trasera de las cartas del stock, contra
// PostgreSQL: solo cartas (no productos), solo las tuyas, las rutas dentro de
// tu carpeta, quién las ve (lo del escaparate: visible y con unidades; lo
// tuyo siempre; nada de otra tienda oculto), que se borran con su línea, y el
// cubo: subir y borrar solo en tu carpeta, y que la migración aguanta dos veces.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1235'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1235-tienda-fotos.sql`, 'utf8')
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
    const T = '00000000-0000-0000-0000-0000000000b1'
    const T2 = '00000000-0000-0000-0000-0000000000b2'
    const ANE = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${ANE}');
      insert into user_profiles (id, username, display_name, tipo, onboarding_completed) values
        ('${T}', 'rincon', 'El Rincón', 'tienda', true), ('${T2}', 'norte', 'Norte Cartas', 'tienda', true), ('${ANE}', 'ane', 'Ane', 'persona', true);
      insert into tiendas (user_id) values ('${T}'), ('${T2}');
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
      insert into tcg_cards (id, market, set_id, local_id, name) values ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex');
      insert into tcg_products (id, name) values (501, 'ETB Obsidian Flames');`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)
    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoT2 = `set prueba.uid = '${T2}'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set role authenticated;`
    const comoAnon = `set prueba.uid = ''; set role anon;`
    r = q(`${comoT} insert into tienda_stock (id, card_id, idioma, estado, unidades, precio, visible) values
      ('00000000-0000-0000-0000-00000000a001', 'sv3-223', 'es', 'NM', 2, 80, true),
      ('00000000-0000-0000-0000-00000000a002', 'sv3-223', 'en', 'EX', 1, 60, false),
      ('00000000-0000-0000-0000-00000000a003', 'sv3-223', 'es', 'NM', 0, 70, true);
      insert into tienda_stock (id, product_id, estado, unidades, precio) values ('00000000-0000-0000-0000-00000000a004', 501, 'sellado', 3, 50);`)
    check('el stock entra', r.ok, r.err)
    r = q(`${comoT2} insert into tienda_stock (id, card_id, idioma, estado, unidades, precio, visible) values ('00000000-0000-0000-0000-00000000b001', 'sv3-223', 'es', 'NM', 1, 90, true)`)
    check('  …y el de la otra tienda', r.ok, r.err)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1235 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    // Y cada sentencia en su conexión, como el SQL Editor (631): se parte por
    // «;» al final de línea fuera de los cuerpos $$.
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
    const A1 = '00000000-0000-0000-0000-00000000a001', A2 = '00000000-0000-0000-0000-00000000a002', A3 = '00000000-0000-0000-0000-00000000a003', A4 = '00000000-0000-0000-0000-00000000a004', B1 = '00000000-0000-0000-0000-00000000b001'

    console.log('── Poner ──')
    r = q(`${comoT} insert into tienda_stock_fotos (stock_id, frente, dorso) values ('${A1}', '${T}/${A1}-frente-1.webp', '${T}/${A1}-dorso-1.webp')`)
    check('la tienda pone frente y dorso a su carta', r.ok, r.err)
    r = q(`${comoT} insert into tienda_stock_fotos (stock_id, frente) values ('${A2}', '${T}/${A2}-frente-1.webp'), ('${A3}', '${T}/${A3}-frente-1.webp')`)
    check('  …y a la oculta y a la agotada (solo se ven ellas)', r.ok, r.err)
    check('  …la tienda_id sale sola de quien la pone', q(`select tienda_id from tienda_stock_fotos where stock_id = '${A1}'`).out === T)
    r = q(`${comoT} insert into tienda_stock_fotos (stock_id, frente) values ('${A4}', '${T}/${A4}-frente-1.webp')`)
    check('a un producto, no', !r.ok)
    r = q(`${comoT} insert into tienda_stock_fotos (stock_id, frente) values ('${B1}', '${T}/${B1}-frente-1.webp')`)
    check('a una línea de otra tienda, no', !r.ok)
    r = q(`${comoT2} insert into tienda_stock_fotos (stock_id, frente) values ('${B1}', '${T}/robada.webp')`)
    check('una ruta fuera de tu carpeta, no', !r.ok && /suya/.test(r.err), r.err)
    r = q(`${comoAne} insert into tienda_stock_fotos (stock_id, frente) values ('${B1}', '${ANE}/x.webp')`)
    check('una persona, no', !r.ok)
    r = q(`${comoT2} insert into tienda_stock_fotos (stock_id, frente) values ('${B1}', '${T2}/${B1}-frente-1.webp')`)
    check('la otra tienda a la suya, sí', r.ok, r.err)

    console.log('── Cambiar y quitar ──')
    r = q(`${comoT} update tienda_stock_fotos set dorso = null where stock_id = '${A2}' returning stock_id`)
    check('la tienda cambia la suya', r.ok && r.out === A2, r.err)
    r = q(`${comoT} update tienda_stock_fotos set frente = '${T}/x.webp' where stock_id = '${B1}' returning stock_id`)
    check('  …la de otra no (no la toca)', r.ok && r.out === '', r.out || r.err)
    r = q(`${comoT} update tienda_stock_fotos set stock_id = '${A4}' where stock_id = '${A3}'`)
    check('  …ni la pasa a un producto', !r.ok)
    r = q(`${comoT2} delete from tienda_stock_fotos where stock_id = '${A1}' returning stock_id`)
    check('borrar la de otra tienda no hace nada', r.ok && r.out === '' && q(`select count(*) from tienda_stock_fotos where stock_id = '${A1}'`).out === '1')

    console.log('── Quién las ve ──')
    const ver = (como) => q(`${como} select coalesce(string_agg(stock_id::text, ',' order by stock_id), '') from tienda_stock_fotos`).out.split(',').filter(Boolean)
    let v = ver(comoAnon)
    check('sin cuenta: las del escaparate (la visible con unidades de cada tienda)', v.length === 2 && v.includes(A1) && v.includes(B1), v.join())
    v = ver(comoAne)
    check('  …una persona, igual', v.length === 2 && v.includes(A1) && v.includes(B1), v.join())
    v = ver(comoT)
    check('la tienda: las suyas todas y la de la otra que se ve', v.length === 4 && v.includes(A2) && v.includes(A3) && v.includes(B1), v.join())
    q(`${comoT2} update tienda_stock set visible = false where id = '${B1}'`)
    check('  …y si la otra la oculta, deja de verla', !ver(comoT).includes(B1) && !ver(comoAnon).includes(B1))

    console.log('── Se van con su línea ──')
    q(`${comoT} delete from tienda_stock where id = '${A3}'`)
    check('borrar la línea borra sus fotos', q(`select count(*) from tienda_stock_fotos where stock_id = '${A3}'`).out === '0')

    console.log('── El cubo ──')
    const b = q(`select public, file_size_limit, array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'tienda-fotos'`).out
    check('público, 3 MB y solo imágenes', b === 't|3145728|image/webp,image/jpeg,image/png', b)
    r = q(`${comoT} insert into storage.objects (bucket_id, name) values ('tienda-fotos', '${T}/${A1}-frente-2.webp')`)
    check('la tienda sube a su carpeta', r.ok, r.err)
    r = q(`${comoT} insert into storage.objects (bucket_id, name) values ('tienda-fotos', '${T2}/intruso.webp')`)
    check('  …a la de otra, no', !r.ok)
    r = q(`${comoAne} insert into storage.objects (bucket_id, name) values ('tienda-fotos', '${ANE}/x.webp')`)
    check('una persona no sube, ni a su carpeta', !r.ok)
    r = q(`${comoAnon} insert into storage.objects (bucket_id, name) values ('tienda-fotos', 'x/y.webp')`)
    check('sin cuenta, tampoco', !r.ok)
    check('la otra tienda no lista la carpeta de esta', q(`${comoT2} select count(*) from storage.objects where bucket_id = 'tienda-fotos'`).out === '0')
    check('  …y la dueña ve lo suyo (Storage lo pide para borrar)', q(`${comoT} select count(*) from storage.objects where bucket_id = 'tienda-fotos'`).out === '1')
    r = q(`${comoT2} delete from storage.objects where bucket_id = 'tienda-fotos' returning id`)
    check('la otra no le borra nada', r.ok && r.out === '' && q(`select count(*) from storage.objects`).out === '1')
    r = q(`${comoT} delete from storage.objects where bucket_id = 'tienda-fotos' returning id`)
    check('la dueña borra lo suyo', r.ok && r.out !== '' && q(`select count(*) from storage.objects`).out === '0', r.err)
    check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  }
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
