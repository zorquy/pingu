// Tanda 1072 — vender y las ventas de una tienda: lo puro (la cuenta de una
// venta, los periodos, el CSV) y la migración contra PostgreSQL: vender resta
// del stock todo o nada y apunta lo que costó EN ESE MOMENTO, nadie más ve
// ni escribe ventas, deshacer devuelve las unidades y la lista suma en la
// base con sus filtros.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const P = await import(`${REPO}/js/tiendas-puro.js`)
console.log('── Lo puro ──')
{
  const c = P.cuentaDeVenta([{ unidades: 1, precio: 179, coste: 125 }, { unidades: 2, precio: 10, coste: 4 }, { unidades: 1, precio: 5, coste: null }])
  check('la cuenta: total de todo, beneficio de lo que tiene coste', c.importe === 204 && c.beneficio === 66 && c.unidades === 4 && c.sinCoste === 1, JSON.stringify(c))
  check('  …y el margen sobre lo pagado (66 / 133)', c.margen === 50, c.margen)
  const s = P.cuentaDeVenta([{ unidades: 1, precio: 5, coste: null }])
  check('sin ninguna con coste no hay beneficio (null, no un cero)', s.beneficio === null && s.margen === null && s.importe === 5)
  check('una línea sin precio no suma', P.cuentaDeVenta([{ unidades: 1, precio: null, coste: 2 }, { unidades: 1, precio: '', coste: 2 }]).unidades === 0)
  check('perder dinero da un beneficio negativo', P.cuentaDeVenta([{ unidades: 1, precio: 4, coste: 6 }]).beneficio === -2)
  const ahora = new Date(2026, 9, 28, 18, 30)
  const hoy = P.rangoDePeriodo('hoy', ahora)
  check('hoy: de las 0:00 a las 0:00 de mañana', +new Date(hoy.desde) === +new Date(2026, 9, 28) && +new Date(hoy.hasta) === +new Date(2026, 9, 29), JSON.stringify(hoy))
  check('7 días: hoy y los seis de antes', +new Date(P.rangoDePeriodo('semana', ahora).desde) === +new Date(2026, 9, 22))
  check('el mes y el año: del día 1 al día 1 del siguiente', +new Date(P.rangoDePeriodo('mes', ahora).hasta) === +new Date(2026, 10, 1) && +new Date(P.rangoDePeriodo('anio', ahora).desde) === +new Date(2026, 0, 1) && +new Date(P.rangoDePeriodo('anio', ahora).hasta) === +new Date(2027, 0, 1))
  check('todo: sin límites', P.rangoDePeriodo('todo', ahora).desde === null)
  check('los periodos y los sitios que se ofrecen', P.PERIODOS.map((p) => p[0]).join() === 'hoy,semana,mes,anio,todo' && P.DONDE_VENTA.map((p) => p[0]).join() === 'mostrador,cardmarket,evento,otro')
  const csv = P.csvDeVentas([{ vendida_el: '2026-10-28T16:30:00Z', ticket: 't1', card_id: 'sv3-223', nombre: 'Charizard ex', set_id: 'sv3', numero: '223', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, precio: '95.50', coste: '62', donde: 'cardmarket' }, { vendida_el: '2026-10-28T17:00:00Z', ticket: 't2', product_id: 501, nombre: 'ETB; grande', idioma: 'en', estado: 'sellado', variante: 'normal', unidades: 1, precio: 64.95, coste: null, donde: 'mostrador' }], (id) => (id === 'sv3' ? 'Obsidian Flames' : id))
  const l = csv.split('\n')
  check('el CSV: cabecera, coma decimal, beneficio de la línea y dónde con su nombre', l[0] === P.CABECERA_VENTAS.join(';') && /;95,5;62;67;Cardmarket$/.test(l[1]) && /Obsidian Flames;223;es;NM/.test(l[1]), l[1])
  check('  …y lo sellado sin estado ni versión, sin beneficio sin coste y con el nombre entre comillas', /;501;"ETB; grande";;;en;;;;1;64,95;;;Mostrador$/.test(l[2]), l[2])
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1072'
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
    check('  …y otra vez encima', psql(['-d', BD, '-c', m72]).status === 0)

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
    const comoOtra = `set prueba.uid = '${OTRA}'; set role authenticated;`
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, estado, variante, unidades, coste, precio) values
      ('sv3-223', 'es', 'NM', 'normal', 1, 62, 95),
      ('sv8-238', 'en', 'NM', 'reverse', 3, 210, 279),
      ('sv3-125', 'es', 'EX', 'normal', 2, null, 4);
      insert into tienda_stock (product_id, estado, idioma, unidades, coste, precio) values (501, 'sellado', 'en', 6, 44, 64.95);`)
    check('el stock de la prueba entra', r.ok, r.err)
    const id = (card) => q(`${comoT} select id from tienda_stock where ${card === 501 ? 'product_id = 501' : `card_id = '${card}'`}`).out
    const [cz, pk, cz2, etb] = [id('sv3-223'), id('sv8-238'), id('sv3-125'), id(501)]
    const vender = (como, lineas, donde = 'mostrador') => q(`${como} select tienda_vender('${JSON.stringify(lineas)}'::jsonb, '${donde}')`)

    check('nadie escribe ventas a mano (solo la función)', !q(`${comoT} insert into tienda_ventas (ticket, card_id, idioma, estado, unidades, precio) values (gen_random_uuid(), 'sv3-223', 'es', 'NM', 1, 1)`).ok)
    let v = vender(comoT, [{ stock_id: pk, unidades: 2, precio: 270 }, { stock_id: etb, unidades: 1, precio: 64.95 }], 'cardmarket')
    check('vender dos líneas a la vez', v.ok, v.err)
    const res = v.ok ? JSON.parse(v.out) : {}
    check('  …y la respuesta trae el total y el beneficio', res.lineas === 2 && Number(res.total) === 604.95 && Number(res.beneficio) === 140.95 && res.sin_coste === 0, v.out)
    check('  …resta las unidades del stock', q(`${comoT} select unidades from tienda_stock where id = '${pk}'`).out === '1' && q(`${comoT} select unidades from tienda_stock where id = '${etb}'`).out === '5')
    check('  …y apunta lo que era, con dónde y lo que costó', q(`${comoT} select string_agg(card_id || ':' || idioma || ':' || variante || ':' || unidades || ':' || precio || ':' || coste || ':' || donde, ',' order by precio desc) from tienda_ventas where card_id is not null`).out === 'sv8-238:en:reverse:2:270.00:210.00:cardmarket')
    q(`${comoT} update tienda_stock set coste = 999 where id = '${pk}'`)
    check('cambiar el coste de la línea después NO cambia lo vendido', q(`${comoT} select coste from tienda_ventas where stock_id = '${pk}'`).out === '210.00')
    check('vender más de lo que hay: no, y no se vende ninguna (todo o nada)', !vender(comoT, [{ stock_id: cz, unidades: 1, precio: 95 }, { stock_id: pk, unidades: 5, precio: 270 }]).ok && q(`${comoT} select unidades from tienda_stock where id = '${cz}'`).out === '1')
    check('sin precio, no', !vender(comoT, [{ stock_id: cz, unidades: 1 }]).ok)
    check('cero unidades, no', !vender(comoT, [{ stock_id: cz, unidades: 0, precio: 1 }]).ok)
    check('un sitio que no existe, no', !vender(comoT, [{ stock_id: cz, unidades: 1, precio: 1 }], 'wallapop').ok)
    check('nada que vender, no', !q(`${comoT} select tienda_vender('[]'::jsonb, 'mostrador')`).ok)
    check('otra tienda no vende tu stock', !vender(comoOtra, [{ stock_id: cz, unidades: 1, precio: 1 }]).ok && q(`${comoT} select unidades from tienda_stock where id = '${cz}'`).out === '1')
    check('una persona no vende', !vender(`set prueba.uid = '${PERSONA}'; set role authenticated;`, [{ stock_id: cz, unidades: 1, precio: 1 }]).ok)
    v = vender(comoT, [{ stock_id: cz2, unidades: 1, precio: 3.5 }])
    check('vender una sin coste: se apunta, sin beneficio', v.ok && JSON.parse(v.out).sin_coste === 1 && Number(JSON.parse(v.out).beneficio) === 0, v.out || v.err)
    v = vender(comoT, [{ stock_id: cz, unidades: 1, precio: 100 }])
    const ticketCz = v.ok ? JSON.parse(v.out).ticket : null
    check('la última copia: queda a cero (y el escaparate ya no la enseña)', v.ok && q(`${comoT} select unidades from tienda_stock where id = '${cz}'`).out === '0')
    check('otra tienda no ve tus ventas', q(`${comoOtra} select count(*) from tienda_ventas`).out === '0')
    check('anon, nada', !q(`set role anon; select count(*) from tienda_ventas`).ok)

    console.log('── La lista ──')
    const lista = (como, f = {}, desde = 0, cuantas = 100) => { const x = q(`${como} select tienda_ventas_lista('${JSON.stringify(f)}'::jsonb, ${desde}, ${cuantas})`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    const L = lista(comoT)
    check('todas: 4 líneas en 3 ventas', L.total === 4 && L.tickets === 3, JSON.stringify(L).slice(0, 200))
    check('  …las sumas: vendido, unidades y beneficio solo de lo que tiene coste', Number(L.sumas?.importe) === 708.45 && L.sumas.unidades === 5 && Number(L.sumas.beneficio) === 178.95 && L.sumas.sin_coste === 1 && Number(L.sumas.coste) === 526, JSON.stringify(L.sumas))
    check('  …y por dónde', Number(L.por_donde?.cardmarket) === 604.95 && Number(L.por_donde?.mostrador) === 103.5, JSON.stringify(L.por_donde))
    check('  …con el nombre, el set y el número', L.filas?.some((f) => f.nombre === 'Pikachu ex' && f.set_id === 'sv8' && f.numero === '238') && L.filas.some((f) => f.nombre === 'Surging Sparks Elite Trainer Box'))
    check('  …lo último primero', new Date(L.filas?.[0]?.vendida_el) >= new Date(L.filas?.at(-1)?.vendida_el))
    check('por dónde', lista(comoT, { donde: ['mostrador'] }).total === 2)
    check('por texto', lista(comoT, { q: 'pika' }).total === 1 && lista(comoT, { q: '223' }).total === 1)
    q(`update tienda_ventas set vendida_el = now() - interval '40 days' where stock_id = '${cz2}'`)
    check('por fechas (la de hace 40 días, fuera)', lista(comoT, { desde: new Date(Date.now() - 7 * 864e5).toISOString() }).total === 3 && lista(comoT, { hasta: new Date(Date.now() - 30 * 864e5).toISOString() }).total === 1)
    check('por páginas', lista(comoT, {}, 0, 2).filas?.length === 2 && lista(comoT, {}, 2, 2).filas?.length === 2)
    check('una persona no tiene lista', Boolean(lista(`set prueba.uid = '${PERSONA}'; set role authenticated;`).error))

    console.log('── Deshacer ──')
    let d = q(`${comoT} select tienda_deshacer_venta('${ticketCz}')`)
    check('deshacer devuelve la unidad al stock y borra la venta', d.ok && JSON.parse(d.out).devueltas === 1 && q(`${comoT} select unidades from tienda_stock where id = '${cz}'`).out === '1' && lista(comoT).total === 3, d.out || d.err)
    check('  …y dos veces, no', !q(`${comoT} select tienda_deshacer_venta('${ticketCz}')`).ok)
    const tPk = q(`${comoT} select ticket from tienda_ventas where stock_id = '${pk}'`).out
    check('otra tienda no deshace tus ventas', !q(`${comoOtra} select tienda_deshacer_venta('${tPk}')`).ok && lista(comoT).total === 3)
    q(`${comoT} delete from tienda_stock where id = '${pk}'`)
    check('borrar la línea del stock deja la venta (sin línea)', q(`${comoT} select count(*) from tienda_ventas where ticket = '${tPk}' and stock_id is null`).out === '1')
    d = q(`${comoT} select tienda_deshacer_venta('${tPk}')`)
    check('  …y deshacerla entonces la borra, y devuelve solo lo que tiene línea', d.ok && JSON.parse(d.out).devueltas === 1 && JSON.parse(d.out).borradas === 2, d.out || d.err)
    psql(['-c', `drop database if exists ${BD}`])
  } else {
    check('PostgreSQL en /var/tmp:5433', false, hay.stderr)
  }
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
