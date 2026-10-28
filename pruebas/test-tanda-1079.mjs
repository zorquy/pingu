// Tandas 1079–1083 — la segunda vuelta de las tiendas, contra PostgreSQL:
// las destacadas (ocho como mucho), el precio que cuenta con una oferta (y
// el de siempre tachado, solo mientras dure), el escaparate por secciones y
// por una línea suelta, la estrella y la oferta en la lista del stock, el
// precio de oferta en «En tiendas» y en el Mercado, la foto diaria del valor
// y las cifras (lo más vendido, por carta y por expansión, y lo que no rota).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1079'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1079-tiendas-vuelta-2.sql`, 'utf8')
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
    for (const m of ['1067-tiendas', '1068-tienda-stock', '1069-tiendas-escaparate', '1072-tienda-ventas', '1073-tienda-hoy']) {
      r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
      check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
    }
    const T = '00000000-0000-0000-0000-0000000000b1'
    const T2 = '00000000-0000-0000-0000-0000000000b2' // sin precios a la vista
    const ANE = '00000000-0000-0000-0000-0000000000c1'
    r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${T2}'), ('${ANE}');
      insert into user_profiles (id, username, tipo, onboarding_completed) values ('${T}', 'rincon', 'tienda', true), ('${T2}', 'norte', 'tienda', true), ('${ANE}', 'ane', 'persona', true);
      insert into tiendas (user_id, precio_visible) values ('${T}', true), ('${T2}', false);
      insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames'), ('sv8', 'WEST', 'Surging Sparks');
      insert into tcg_cards values
        ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv8-238', 'WEST', 'sv8', '238', 'Pikachu ex', 'Pikachu ex', 'pikachu ex', 'Special Illustration Rare', 'Special Illustration Rare'),
        ('sv3-125', 'WEST', 'sv3', '125', 'Charizard ex', 'Charizard ex', 'charizard ex', 'Double Rare', 'Double Rare'),
        ('sv8-10', 'WEST', 'sv8', '10', 'Pidgey', 'Pidgey', 'pidgey', 'Common', 'Common');
      insert into tcg_card_prices (card_id, cm_low, cm_low_es, cm_low_en) values ('sv3-223', 80, 88.40, 90), ('sv8-238', 280, 301.50, 290), ('sv3-125', 4, 5, 4.5);
      insert into tcg_products values (501, 'Surging Sparks Elite Trainer Box', 70, 71, null);`])
    check('los datos de la prueba entran', r.status === 0, r.stderr)
    // Stock de antes de la migración: tiene que seguir igual.
    const comoT = `set prueba.uid = '${T}'; set role authenticated;`
    const comoT2 = `set prueba.uid = '${T2}'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set role authenticated;`
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, estado, variante, unidades, coste, precio, entro_el) values
      ('sv3-223', 'es', 'NM', 'normal', 2, 62, 80, now() - interval '3 days'),
      ('sv8-238', 'en', 'NM', 'reverse', 3, 210, 279, now() - interval '120 days'),
      ('sv3-125', 'es', 'EX', 'normal', 4, 3, 6, now() - interval '100 days'),
      ('sv8-10', 'es', 'NM', 'normal', 10, null, 0.5, now() - interval '30 days');
      insert into tienda_stock (product_id, estado, idioma, unidades, coste, precio) values (501, 'sellado', 'en', 6, 44, 64.95);`)
    check('el stock de antes entra', r.ok, r.err)
    r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
    check('la 1079 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')]).status === 0)
    check('  …sin tocar lo de antes: nada destacado, sin ofertas', q(`select count(*) from tienda_stock where destacada or oferta_precio is not null`).out === '0')
    const id = (card) => q(`${comoT} select id from tienda_stock where card_id = '${card}'`).out
    const [cz, pk, cz2, pd] = [id('sv3-223'), id('sv8-238'), id('sv3-125'), id('sv8-10')]

    console.log('── Destacadas: ocho como mucho ──')
    check('la tienda marca la suya', q(`${comoT} update tienda_stock set destacada = true where id = '${cz}'`).ok)
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, unidades, precio, destacada) select 'sv8-10', 'en', 1, 1, true from generate_series(1, 7)`)
    check('  …hasta ocho', r.ok && q(`select count(*) from tienda_stock where tienda_id = '${T}' and destacada`).out === '8', r.err)
    r = q(`${comoT} update tienda_stock set destacada = true where id = '${pk}'`)
    check('  …la novena, no (con el motivo)', !r.ok && /Como mucho 8/.test(r.err), r.err)
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, unidades, destacada) values ('sv8-10', 'de', 1, true)`)
    check('  …ni al meterla nueva', !r.ok)
    check('  …volver a guardar una que ya lo es, sí', q(`${comoT} update tienda_stock set destacada = true, precio = 81 where id = '${cz}'`).ok)
    q(`${comoT} delete from tienda_stock where card_id = 'sv8-10' and idioma = 'en'`)
    check('  …y la cuenta es de cada tienda', q(`${comoT2} insert into tienda_stock (card_id, idioma, unidades, precio, destacada) values ('sv3-223', 'es', 1, 90, true)`).ok)

    console.log('── El precio que cuenta ──')
    check('sin oferta, el de siempre; con oferta sin fecha, la oferta; caducada, el de siempre',
      q(`select tienda_precio_de(10, null, null)`).out === '10' && q(`select tienda_precio_de(10, 7, null)`).out === '7' && q(`select tienda_precio_de(10, 7, now() + interval '1 day')`).out === '7' && q(`select tienda_precio_de(10, 7, now() - interval '1 minute')`).out === '10')
    check('una oferta no puede ser negativa', !q(`${comoT} update tienda_stock set oferta_precio = -1 where id = '${pk}'`).ok)
    q(`${comoT} update tienda_stock set oferta_precio = 249, oferta_hasta = now() + interval '5 days' where id = '${pk}';
       update tienda_stock set oferta_precio = 5, oferta_hasta = now() - interval '1 day' where id = '${cz2}'`)
    q(`${comoT2} update tienda_stock set oferta_precio = 70`)

    console.log('── El escaparate ──')
    const esc = (t, f = {}, como = comoAne) => { const x = q(`${como} select tienda_escaparate('${t}', '${JSON.stringify(f)}'::jsonb)`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    let E = esc(T)
    const fila = (E, card) => E.filas?.find((f) => f.card_id === card)
    check('cuentas: 1 destacada, 2 nuevas (7 días: el Charizard y la caja), 1 oferta (la caducada no)', E.destacadas === 1 && E.nuevas === 2 && E.ofertas === 1, JSON.stringify({ d: E.destacadas, n: E.nuevas, o: E.ofertas, e: E.error }))
    check('el Pikachu en oferta: 249, y 279 tachado con su fecha', Number(fila(E, 'sv8-238')?.precio) === 249 && Number(fila(E, 'sv8-238').precio_antes) === 279 && fila(E, 'sv8-238').oferta_hasta, JSON.stringify(fila(E, 'sv8-238')))
    check('  …la oferta caducada no se ve: 6, sin tachado', Number(fila(E, 'sv3-125')?.precio) === 6 && fila(E, 'sv3-125').precio_antes === null)
    check('  …la destacada y la nueva lo dicen', fila(E, 'sv3-223')?.destacada === true && fila(E, 'sv3-223').nueva === true && fila(E, 'sv8-238').nueva === false)
    check('por secciones: destacadas, nuevas, ofertas', esc(T, { seccion: 'destacadas' }).filas?.map((f) => f.card_id).join() === 'sv3-223' && esc(T, { seccion: 'nuevas' }).total === 2 && esc(T, { seccion: 'ofertas' }).filas?.map((f) => f.card_id).join() === 'sv8-238')
    E = esc(T, { id: pk })
    check('una línea suelta por su id (la de «Me interesa»)', E.total === 1 && E.filas[0].id === pk)
    check('  …y una oculta o agotada, no', (q(`${comoT} update tienda_stock set visible = false where id = '${pd}'`), esc(T, { id: pd }).total === 0))
    E = esc(T2)
    check('una tienda sin precios a la vista: ni precio, ni tachado, ni ofertas', E.ofertas === 0 && E.filas?.[0]?.precio === null && E.filas[0].precio_antes === null, JSON.stringify(E.filas?.[0]))

    console.log('── La lista del stock ──')
    const L = JSON.parse(q(`${comoT} select tienda_stock_lista('{}'::jsonb, 'recientes', 0, 50)`).out)
    const lf = (card) => L.filas.find((f) => f.card_id === card)
    check('dice cuántas destacadas lleva', L.destacadas === 1)
    check('  …y cada línea su estrella y su oferta (la caducada, apuntada pero sin estar en oferta)', lf('sv3-223').destacada === true && lf('sv8-238').en_oferta === true && Number(lf('sv8-238').oferta_precio) === 249 && lf('sv3-125').en_oferta === false && Number(lf('sv3-125').oferta_precio) === 5)
    check('  …el precio de la lista es el de siempre', Number(lf('sv8-238').precio) === 279)

    console.log('── «En tiendas» y el Mercado ──')
    r = q(`${comoAne} select json_agg(t) from tiendas_que_tienen('sv8-238') t`)
    const tq = JSON.parse(r.out || 'null') || []
    check('«En tiendas»: el precio de oferta y el de antes', Number(tq[0]?.precio) === 249 && Number(tq[0]?.precio_antes) === 279, r.err || r.out)
    r = q(`${comoAne} select json_agg(t) from tiendas_que_tienen('sv3-223') t`)
    const tc = JSON.parse(r.out || 'null') || []
    check('  …ordenadas por el que cuenta, y la que no enseña precios sin él', tc.length === 2 && Number(tc[0].precio) === 81 && tc[1].precio === null && tc[1].precio_antes === null, r.out)
    r = q(`${comoAne} select json_agg(m) from mercado_con_tiendas('WEST', null, null, null, false, 'nuevo', 60, 0, 'tiendas') m`)
    const merc = JSON.parse(r.out || 'null') || []
    const mp = merc.find((m) => m.card_id === 'sv8-238')
    check('el Mercado: «desde» y la tienda con el precio de oferta', Number(mp?.desde) === 249 && Number(mp.gente[0].precio) === 249, r.err || JSON.stringify(mp))

    console.log('── Cifras ──')
    // Ventas: dos del Pikachu, una del Charizard y la caja; una vieja que no cuenta.
    const vender = (lineas) => q(`${comoT} select tienda_vender('${JSON.stringify(lineas)}'::jsonb, 'mostrador')`)
    const prod = q(`${comoT} select id from tienda_stock where product_id = 501`).out
    check('las ventas entran', vender([{ stock_id: pk, unidades: 2, precio: 249 }]).ok && vender([{ stock_id: cz, unidades: 1, precio: 81 }, { stock_id: prod, unidades: 1, precio: 64.95 }]).ok)
    vender([{ stock_id: cz2, unidades: 1, precio: 6 }])
    q(`update tienda_ventas set vendida_el = now() - interval '200 days' where stock_id = '${cz2}'`)
    const cif = (como) => { const x = q(`${como} select tienda_cifras(now() - interval '30 days', now() + interval '1 minute')`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    let C = cif(comoT)
    check('lo más vendido por carta: el Pikachu (2), luego el Charizard y la caja', C.cartas?.[0]?.card_id === 'sv8-238' && C.cartas[0].unidades === 2 && Number(C.cartas[0].importe) === 498 && Number(C.cartas[0].beneficio) === 78 && C.cartas.length === 3, JSON.stringify(C.cartas || C.error))
    check('  …la caja va con su nombre', C.cartas.some((c) => c.product_id === 501 && c.nombre === 'Surging Sparks Elite Trainer Box'))
    check('por expansión: Surging Sparks (498 €) antes que Obsidian Flames (81 €), con su nombre', C.sets?.[0]?.set_id === 'sv8' && C.sets[0].nombre === 'Surging Sparks' && Number(C.sets[1].importe) === 81 && C.sets.length === 2, JSON.stringify(C.sets))
    // Lo que no rota: el Charizard EX (100 días, su venta fue hace 200) sí;
    // el Pikachu (120 días) se vendió hoy; el Pidgey es de hace 30.
    check('lo que no rota: el Charizard de hace 100 días (vendido hace 200), y no el Pikachu (vendido hoy)', C.quietas?.lineas === 1 && C.quietas.filas[0].card_id === 'sv3-125' && C.quietas.unidades === 3 && Number(C.quietas.valor) === 18, JSON.stringify(C.quietas))
    check('sin foto del valor, la serie va vacía', Array.isArray(C.valor) && C.valor.length === 0)
    r = q(`${comoT} select tienda_apuntar_valor('UTC')`)
    const V = JSON.parse(r.out || '{}')
    // Charizard 1×81, Pikachu 1×249 (oferta), Charizard EX 3×6, Pidgey oculto 10×0,5, la caja 5×64,95.
    check('la foto del día: el valor al precio que cuenta', r.ok && V.unidades === 1 + 1 + 3 + 10 + 5 && Number(V.valor) === 81 + 249 + 18 + 5 + 324.75, r.err || r.out)
    check('  …otra vez el mismo día, una sola fila', q(`${comoT} select tienda_apuntar_valor('UTC')`).ok && q(`select count(*) from tienda_valor_diario where tienda_id = '${T}'`).out === '1')
    q(`insert into tienda_valor_diario (tienda_id, dia, valor) values ('${T}', (now() at time zone 'UTC')::date - 3, 500), ('${T}', (now() at time zone 'UTC')::date - 400, 9)`)
    C = cif(comoT)
    check('  …y la serie, en orden y de los últimos 180 días', C.valor?.length === 2 && Number(C.valor[0].valor) === 500, JSON.stringify(C.valor))
    check('otra tienda no ve tu foto ni tus cifras', q(`${comoT2} select count(*) from tienda_valor_diario`).out === '0' && cif(comoT2).cartas?.length === 0)
    check('  …nadie escribe la foto a mano', !q(`${comoT} insert into tienda_valor_diario (tienda_id, dia) values ('${T}', current_date + 5)`).ok)
    check('una persona no tiene cifras ni foto', Boolean(cif(comoAne).error) && !q(`${comoAne} select tienda_apuntar_valor()`).ok)
    psql(['-c', `drop database if exists ${BD}`])
  } else {
    check('PostgreSQL en /var/tmp:5433', false, hay.stderr)
  }
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
