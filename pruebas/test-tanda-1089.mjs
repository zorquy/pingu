// Tanda 1089 — «Avisar a los que la buscan», contra PostgreSQL: a quién le
// llega (la regla de un deseo: idioma y versión, y solo lo que se ve con
// unidades), que nadie lo recibe dos veces de la misma tienda y carta, que
// quien lo apagó no cuenta, que la tienda solo ve cifras (la tabla no se
// lee), el texto y el enlace del aviso, y que solo una tienda puede avisar.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1089'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1089-tienda-avisar.sql`, 'utf8')
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
    const T2 = '00000000-0000-0000-0000-0000000000b2' // sin precios a la vista
    const [ANE, JON, MIK, LEO, NEREA] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((x) => `00000000-0000-0000-0000-0000000000${x}`)
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${ANE}'), ('${JON}'), ('${MIK}'), ('${LEO}'), ('${NEREA}');
      insert into user_profiles (id, username, display_name, tipo, onboarding_completed, notification_prefs_disabled) values
        ('${T}', 'rincon', 'El Rincón', 'tienda', true, '{}'), ('${T2}', 'norte', 'Norte Cartas', 'tienda', true, '{}'),
        ('${ANE}', 'ane', 'Ane', 'persona', true, '{}'), ('${JON}', 'jon', 'Jon', 'persona', true, '{}'),
        ('${MIK}', 'mik', 'Mik', 'persona', true, '{tienda_la_tiene}'), ('${LEO}', 'leo', 'Leo', 'persona', true, '{trade_match}'),
        ('${NEREA}', 'nerea', 'Nerea', 'persona', true, '{}');
      insert into tiendas (user_id, precio_visible) values ('${T}', true), ('${T2}', false);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
      insert into tcg_cards values
        ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Double Rare', 'Double Rare');
      -- Ane: cualquiera; Jon: en español; Mik: lo apagó; Leo: apagó OTRO aviso;
      -- Nerea: la quiere en inglés (la tienda la tiene en español).
      insert into user_wants (user_id, card_id, idioma, variante) values
        ('${ANE}', 'sv3-223', null, null), ('${ANE}', 'sv3-223', 'es', null), ('${JON}', 'sv3-223', 'es', 'normal'),
        ('${MIK}', 'sv3-223', null, null), ('${LEO}', 'sv3-223', null, null), ('${NEREA}', 'sv3-223', 'en', null),
        ('${ANE}', 'sv3-125', null, null), ('${T}', 'sv3-125', null, null), ('${T2}', 'sv3-223', null, null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)
    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoT2 = `set prueba.uid = '${T2}'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set role authenticated;`
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, estado, variante, unidades, coste, precio, oferta_precio, oferta_hasta) values
      ('sv3-223', 'es', 'NM', 'normal', 2, 62, 80, 72.5, now() + interval '3 days'),
      ('sv3-125', 'es', 'EX', 'normal', 0, 3, 6, null, null);`)
    check('el stock entra', r.ok, r.err)
    r = q(`${comoT2} insert into tienda_stock (card_id, idioma, estado, variante, unidades, precio) values ('sv3-223', 'es', 'NM', 'normal', 1, 90)`)
    check('  …y el de la otra tienda', r.ok, r.err)
    r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
    check('la 1089 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')]).status === 0)

    const de = (como, cartas) => { const x = q(`${como} select tienda_avisos_de('${JSON.stringify(cartas)}'::jsonb)`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    const avisar = (como, card, market = 'WEST') => { const x = q(`${como} select tienda_avisar('${card}', '${market}')`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    const avisos = (quien) => q(`select coalesce(json_agg(n order by n.created_at), '[]') from user_notifications n where type = 'tienda_la_tiene'${quien ? ` and recipient_id = '${quien}'` : ''}`)

    console.log('── Cuántos ──')
    let D = de(comoT, [{ card_id: 'sv3-223', market: 'WEST' }, { card_id: 'sv3-125' }])
    const de223 = (D) => D.find?.((x) => x.card_id === 'sv3-223')
    check('por avisar: Ane, Jon y Leo (Mik lo apagó; Nerea la quiere en inglés; la otra tienda no cuenta)', Number(de223(D)?.pendientes) === 3 && Number(de223(D).avisadas) === 0 && de223(D).ultimo === null, JSON.stringify(D))
    check('  …la agotada no tiene a nadie por avisar (y la propia tienda no cuenta)', Number(D.find?.((x) => x.card_id === 'sv3-125')?.pendientes) === 0, JSON.stringify(D))
    check('  …una persona no puede preguntarlo', !!de(comoAne, [{ card_id: 'sv3-223' }]).error)

    console.log('── Avisar ──')
    let A = avisar(comoT, 'sv3-223')
    check('avisa a tres', A.avisadas === 3 && A.antes === 0, JSON.stringify(A))
    const lista = JSON.parse(avisos().out)
    check('  …tres avisos a la campanita, a Ane, Jon y Leo', lista.length === 3 && new Set(lista.map((n) => n.recipient_id)).size === 3 && !lista.some((n) => [MIK, NEREA, T].includes(n.recipient_id)), lista.map((n) => n.recipient_id).join())
    const n = lista[0] || {}
    check('  …«El Rincón tiene Charizard ex», con el precio de la oferta', n.title === 'El Rincón tiene Charizard ex' && /Desde 72,50 €/.test(n.body) && /La quiero/.test(n.body), `${n.title} / ${n.body}`)
    check('  …y abre su escaparate con esa carta', n.link === '/usuario/rincon?carta=sv3-223', n.link)
    A = avisar(comoT, 'sv3-223')
    check('otra vez: nadie recibe dos', A.avisadas === 0 && A.antes === 3 && JSON.parse(avisos().out).length === 3, JSON.stringify(A))
    D = de(comoT, [{ card_id: 'sv3-223' }])
    check('  …y el Panel lo sabe: 0 por avisar, 3 avisadas, con fecha', Number(de223(D)?.pendientes) === 0 && Number(de223(D).avisadas) === 3 && !!de223(D).ultimo, JSON.stringify(D))
    q(`insert into auth.users values ('00000000-0000-0000-0000-0000000000c6'); insert into user_profiles (id, username, tipo) values ('00000000-0000-0000-0000-0000000000c6', 'iker', 'persona');
       insert into user_wants (user_id, card_id) values ('00000000-0000-0000-0000-0000000000c6', 'sv3-223')`)
    check('quien la pide DESPUÉS sí cuenta', Number(de223(de(comoT, [{ card_id: 'sv3-223' }]))?.pendientes) === 1)
    A = avisar(comoT, 'sv3-223')
    check('  …y le llega solo a él', A.avisadas === 1 && A.antes === 3 && JSON.parse(avisos().out).length === 4, JSON.stringify(A))

    console.log('── Otra tienda, la misma carta ──')
    A = avisar(comoT2, 'sv3-223')
    const deT2 = JSON.parse(avisos().out).filter((x) => /Norte/.test(x.title))
    check('cada tienda avisa por su cuenta: cuatro', A.avisadas === 4 && deT2.length === 4, JSON.stringify(A))
    check('  …sin precio si no lo enseña', deT2.every((x) => !/€/.test(x.body)), deT2[0]?.body)

    console.log('── Lo que no se puede ──')
    check('avisar de una agotada, no', !!avisar(comoT, 'sv3-125').error)
    check('avisar de una que no tiene, no', !!avisar(comoT, 'sv9-1').error)
    q(`${comoT2} update tienda_stock set visible = false`)
    check('ni de una oculta', /no está a la vista/.test(avisar(comoT2, 'sv3-223').error || ''))
    check('una persona no puede avisar', !!avisar(comoAne, 'sv3-223').error)
    check('nadie lee la tabla de a quién se avisó: ni la tienda', !q(`${comoT} select count(*) from tienda_avisos`).ok)
    check('  …ni llama a la función de a quién', !q(`${comoT} select count(*) from tienda_por_avisar('${T}', 'sv3-223', 'WEST')`).ok)
    check('la respuesta no lleva ningún id de persona', !/c[1-6]"/.test(JSON.stringify(de(comoT, [{ card_id: 'sv3-223' }]))))
    check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  }
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
