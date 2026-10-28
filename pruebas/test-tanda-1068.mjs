// Tanda 1068 — el stock de una tienda: lo puro (margen, redondeo, chapas,
// el CSV que se exporta y se vuelve a importar) y la migración contra
// PostgreSQL de verdad, con `valor_de_copia` y sus funciones de verdad
// cargadas de sus migraciones: solo la tienda ve y cambia su stock, la lista
// filtra, ordena, suma y cuenta en la base, y el precio en bloque redondea
// como el navegador.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const P = await import(`${REPO}/js/tiendas-puro.js`)
console.log('── Lo puro ──')
{
  check('margenDe: 95 sobre 62 es +33 € y 53 %', JSON.stringify(P.margenDe(95, 62)) === '{"euros":33,"pct":53}')
  check('  …perder dinero sale en negativo', P.margenDe(16, 18).euros === -2 && P.margenDe(16, 18).pct === -11)
  check('  …sin coste (o coste 0) o sin precio, no hay margen', P.margenDe(10, null) === null && P.margenDe(10, 0) === null && P.margenDe(null, 5) === null)
  check('redondearPrecio a ,95: 12,40 → 12,95; 12,97 → 13,95; 12,95 se queda; 0,30 → 0,95', [P.redondearPrecio(12.4, '95'), P.redondearPrecio(12.97, '95'), P.redondearPrecio(12.95, '95'), P.redondearPrecio(0.3, '95')].join() === '12.95,13.95,12.95,0.95')
  check('  …a ,99 y al euro', P.redondearPrecio(10.995, '99') === 11.99 && P.redondearPrecio(12.01, 'entero') === 13 && P.redondearPrecio(12, 'entero') === 12)
  check('precioSugerido: Cardmarket 10 € +10 % a ,99 es 11,99; sin Cardmarket, nada', P.precioSugerido(10, 10, '99') === 11.99 && P.precioSugerido(null, 10) === null && P.precioSugerido(0, 10) === null)
  let f = P.alternarFiltro({}, 'idioma', 'es')
  f = P.alternarFiltro(f, 'idioma', 'en')
  check('alternarFiltro pone y quita', JSON.stringify(P.alternarFiltro(f, 'idioma', 'es')) === '{"idioma":["en"]}' && JSON.stringify(P.alternarFiltro({ idioma: ['es'] }, 'idioma', 'es')) === '{}')
  const chapas = P.chapasDeFiltros({ q: 'pikachu', idioma: ['es'], precio_min: 20, precio_max: 150, cm_max: 5 }, (g, v) => (g === 'idioma' ? 'Español' : v))
  check('chapasDeFiltros: el texto, cada opción y los rangos', chapas.map((c) => c.texto).join(' | ') === '«pikachu» | Español | Tu precio: 20 €–150 € | Cardmarket: hasta 5 €', chapas.map((c) => c.texto).join(' | '))
  check('  …y quitar una chapa de rango quita los dos extremos', JSON.stringify(P.quitarChapa({ precio_min: 20, precio_max: 150, idioma: ['es'] }, chapas[2])) === '{"idioma":["es"]}')
  check('  …una de lista, solo esa opción', JSON.stringify(P.quitarChapa({ idioma: ['es', 'en'] }, { grupo: 'idioma', valor: 'es' })) === '{"idioma":["en"]}')
}

console.log('── El CSV: lo exportado se vuelve a importar ──')
{
  const csv = P.csvDeStock([
    { card_id: 'sv3-223', nombre: 'Charizard ex', set_id: 'sv3', numero: '223', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 2, coste: 62, precio: 95.5, cm: 88.4, ubicacion: 'Vitrina; arriba', visible: true, notas: 'dice "hola"' },
    { product_id: 501, nombre: 'ETB', idioma: 'en', estado: 'sellado', unidades: 6, coste: 44, precio: 64.95, visible: false },
  ], (id) => (id === 'sv3' ? 'Obsidian Flames' : id))
  const lineas = csv.split('\n')
  check('cabecera y una línea por fila', lineas.length === 3 && lineas[0] === P.CABECERA_STOCK.join(';'))
  check('  …decimales con coma, y lo que lleva «;» o comillas, entre comillas', lineas[1].includes(';95,5;') && lineas[1].includes('"Vitrina; arriba"') && lineas[1].includes('"dice ""hola"""'), lineas[1])
  check('  …lo sellado sin estado ni versión, y «no» si está oculto', /^;501;ETB;;;en;;;;6;44;64,95;;;no;$/.test(lineas[2]), lineas[2])
  const I = await import(`${REPO}/js/mi-coleccion/importar-csv.js`)
  const C = await import(`${REPO}/js/tienda-csv.js`)
  const filas = I.leerCsv(csv)
  const { columnas } = I.reconocerColumnas(filas[0])
  check('el importador reconoce todas las columnas que importan', ['id', 'nombre', 'set', 'numero', 'idioma', 'estado', 'variante', 'gradeo', 'cantidad', 'precioCompra', 'precioVenta', 'ubicacion', 'visible', 'notas'].every((c) => columnas[c] !== undefined), JSON.stringify(columnas))
  const entradas = I.entradasDe(filas.slice(1), columnas)
  const extras = C.extrasDeFila(filas.slice(1), columnas)
  check('  …unidades, coste y estado vuelven igual', entradas[0].cantidad === 2 && entradas[0].precio_compra === 62 && entradas[0].estado === 'NM' && entradas[0].id === 'sv3-223')
  check('  …y el PVP, dónde está y si se ve, por la línea', extras.get(2).precio === 95.5 && extras.get(2).ubicacion === 'Vitrina; arriba' && extras.get(2).visible === true && extras.get(3).visible === false)
  const stock = C.filasDeStock([{ entrada: entradas[0], linea: { card_id: 'sv3-223', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2, gradeo: null, precio_compra: 62, notas: 'x' } }], extras, 'tienda-1')
  check('filasDeStock: la fila de la tabla, con su tienda', JSON.stringify(stock[0]) === JSON.stringify({ tienda_id: 'tienda-1', card_id: 'sv3-223', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 2, coste: 62, precio: 95.5, ubicacion: 'Vitrina; arriba', visible: true, notas: 'x' }), JSON.stringify(stock[0]))
  const col = I.reconocerColumnas(['Expansion', 'Number', 'Quantity', 'Price paid'])
  check('un CSV de Mi colección sigue leyéndose igual (sin PVP)', col.columnas.precioCompra === 3 && col.columnas.precioVenta === undefined && col.columnas.cantidad === 2)
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1068'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1068-tienda-stock.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  // Las funciones de precio DE VERDAD, sacadas de sus migraciones.
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
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)

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
    r = q(`${comoT} insert into tienda_stock (card_id, idioma, estado, unidades, coste, precio, ubicacion, entro_el) values
      ('sv3-223', 'es', 'NM', 1, 62, 95, 'Vitrina', now() - interval '12 days'),
      ('sv8-238', 'en', 'NM', 2, 210, 279, 'Vitrina', now() - interval '34 days'),
      ('sv3-125', 'es', 'EX', 1, 6, 4, null, now() - interval '128 days'),
      ('sv8-10', 'es', 'NM', 0, null, null, 'Caja comunes', now() - interval '2 days');
      insert into tienda_stock (product_id, estado, idioma, unidades, coste, precio, visible) values (501, 'sellado', 'en', 6, 44, 64.95, false);`)
    check('una tienda mete su stock (cartas y sellado)', r.ok, r.err)
    check('  …nace con su tienda (default auth.uid())', q(`select count(*) from tienda_stock where tienda_id = '${T}'`).out === '5')
    check('una persona (no tienda) no puede tener stock', !q(`set prueba.uid = '${PERSONA}'; set role authenticated; insert into tienda_stock (card_id) values ('sv3-223')`).ok)
    check('otra tienda no ve el stock ajeno (0 filas)', q(`set prueba.uid = '${OTRA}'; set role authenticated; select count(*) from tienda_stock`).out === '0')
    check('  …ni lo cambia', q(`set prueba.uid = '${OTRA}'; set role authenticated; update tienda_stock set precio = 1 returning id`).out === '')
    check('  …ni se lo apunta a ella', !q(`set prueba.uid = '${OTRA}'; set role authenticated; insert into tienda_stock (tienda_id, card_id) values ('${T}', 'sv3-223')`).ok)
    check('anon, nada', !q(`set role anon; select count(*) from tienda_stock`).ok)
    check('carta Y producto a la vez no', !q(`${comoT} insert into tienda_stock (card_id, product_id) values ('sv3-223', 501)`).ok)
    check('un estado que no existe, no', !q(`${comoT} insert into tienda_stock (card_id, estado) values ('sv3-223', 'XX')`).ok)

    const lista = (filtros = {}, orden = 'recientes', desde = 0, cuantas = 50) => {
      const x = q(`${comoT} select tienda_stock_lista('${JSON.stringify(filtros)}'::jsonb, '${orden}', ${desde}, ${cuantas})`)
      return x.ok ? JSON.parse(x.out) : { error: x.err }
    }
    const todo = lista()
    check('la lista: las 5, lo último que entró primero (el sellado, recién metido)', todo.total === 5 && todo.en_stock === 5 && todo.filas?.[0]?.product_id === 501 && todo.filas?.[1]?.card_id === 'sv8-10', JSON.stringify(todo).slice(0, 300))
    const cha = todo.filas.find((f) => f.card_id === 'sv3-223')
    check('  …con su nombre, su set, su número y su rareza', cha.nombre === 'Charizard ex' && cha.set_id === 'sv3' && cha.numero === '223' && cha.rareza === 'Special Illustration Rare')
    const ref = q(`select valor_de_copia(jsonb_populate_record(null::user_collection, '{"cantidad":1,"variante":"normal","idioma":"es"}'::jsonb), pr) from tcg_card_prices pr where card_id = 'sv3-223'`).out
    check('  …Cardmarket es valor_de_copia de su idioma: la española a 88,40', Number(cha.cm) === 88.4 && Number(ref) === 88.4, `${cha.cm} / ${ref}`)
    check('  …la inglesa, con su precio inglés', Number(todo.filas.find((f) => f.card_id === 'sv8-238').cm) === 290)
    check('  …lo sellado, con el suyo (el de la UE sin el de España)', Number(todo.filas.find((f) => f.product_id === 501).cm) === 71 && todo.filas.find((f) => f.product_id === 501).nombre === 'Surging Sparks Elite Trainer Box')
    check('sumas: unidades, lo que costó, a tu precio y en Cardmarket (por unidades)', todo.sumas.unidades === 10 && Number(todo.sumas.coste) === 62 + 420 + 6 + 264 && Number(todo.sumas.precio) === 95 + 558 + 4 + 389.7 && Math.abs(Number(todo.sumas.cm) - (88.4 + 580 + 5 + 426)) < 0.01, JSON.stringify(todo.sumas))
    check('  …y cuántas sin coste y sin precio', todo.sumas.sin_coste === 1 && todo.sumas.sin_precio === 1)
    check('facetas: idioma, estado, sets, catálogo', todo.facetas.idioma.es === 3 && todo.facetas.idioma.en === 2 && todo.facetas.estado.sellado === 1 && todo.facetas.sets.sv3 === 2 && todo.facetas.catalogo.sellado === 1 && todo.facetas.catalogo.WEST === 4, JSON.stringify(todo.facetas))
    check('  …y dónde está', todo.facetas.ubicacion.Vitrina === 2 && todo.facetas.ubicacion['Caja comunes'] === 1)

    const es = lista({ idioma: ['es'] })
    check('filtro de idioma: 3', es.total === 3)
    check('  …y el grupo de idiomas sigue contando los demás (sin mirarse a sí mismo)', es.facetas.idioma.en === 2 && es.facetas.estado.sellado === undefined, JSON.stringify(es.facetas.idioma))
    check('texto: «chari» da las dos Charizard', lista({ q: 'chari' }).total === 2)
    check('  …«charizard 223» la de ese número', lista({ q: 'charizard 223' }).total === 1)
    check('  …el nombre de un producto también', lista({ q: 'elite' }).total === 1)
    check('rango de tu precio: 20–150 €', lista({ precio_min: 20, precio_max: 150 }).total === 2)
    check('margen: pierdes (la Charizard de 6 € a 4 €)', lista({ margen: ['pierdes'] }).filas.map((f) => f.card_id).join() === 'sv3-125')
    check('  …20–50 % (Pikachu 33 %, ETB 48 %) y +50 % (Charizard 53 %)', lista({ margen: ['20-50'] }).total === 2 && lista({ margen: ['50+'] }).filas[0]?.card_id === 'sv3-223')
    check('  …sin coste', lista({ margen: ['sin_coste'] }).filas[0]?.card_id === 'sv8-10')
    check('contra Cardmarket: por debajo (Charizard 4 contra 5, ETB 64,95 contra 71)', lista({ contra: ['debajo'] }).total === 2)
    check('  …igual, dentro del ±5 % (Pikachu 279 contra 290)', lista({ contra: ['igual'] }).filas.map((f) => f.card_id).join() === 'sv8-238')
    check('  …por encima (Charizard 95 contra 88,40)', lista({ contra: ['encima'] }).filas.map((f) => f.card_id).join() === 'sv3-223')
    check('días en stock: más de 90', lista({ dias: ['90+'] }).filas.map((f) => f.card_id).join() === 'sv3-125')
    check('unidades: agotadas', lista({ unidades: ['agotadas'] }).filas.map((f) => f.card_id).join() === 'sv8-10')
    check('escaparate: ocultas', lista({ visible: ['no'] }).filas.map((f) => f.product_id).join() === '501')
    check('rareza', lista({ rareza: ['Special Illustration Rare'] }).total === 2)
    check('dos grupos a la vez se suman (y)', lista({ idioma: ['es'], ubicacion: ['Vitrina'] }).total === 1)
    check('orden: tu precio de más a menos', lista({}, 'precio_desc').filas.map((f) => Number(f.precio)).filter((x) => x).join() === '279,95,64.95,4')
    check('  …más margen primero', lista({}, 'margen_desc').filas[0].card_id === 'sv3-223')
    check('páginas: de 2 en 2', lista({}, 'nombre', 0, 2).filas.length === 2 && lista({}, 'nombre', 4, 2).filas.length === 1 && lista({}, 'nombre', 0, 2).total === 5)
    check('una persona no tiene lista', /Solo una cuenta de tienda/.test(q(`set prueba.uid = '${PERSONA}'; set role authenticated; select tienda_stock_lista()`).err))

    // Precio en bloque: Cardmarket + 10 %, a ,95.
    const ids = q(`${comoT} select string_agg(id::text, ',') from tienda_stock where card_id in ('sv3-223', 'sv8-238', 'sv8-10')`).out.split(',')
    const pb = q(`${comoT} select tienda_stock_precio_bloque(array['${ids.join("','")}']::uuid[], 10, '95')`)
    const pbj = pb.ok ? JSON.parse(pb.out) : {}
    check('precio en bloque: dos con Cardmarket, una sin (se queda)', pbj.cambiadas === 2 && pbj.sin_cardmarket === 1, pb.err || pb.out)
    const nuevos = q(`select card_id, precio from tienda_stock where card_id in ('sv3-223', 'sv8-238', 'sv8-10') order by card_id`).out
    check('  …88,40 + 10 % = 97,24 → 97,95; 290 + 10 % = 319 → 319,95; la de sin precio, igual', nuevos === 'sv3-223|97.95\nsv8-10|\nsv8-238|319.95', nuevos)
    check('  …y redondea igual que el navegador', P.precioSugerido(88.4, 10, '95') === 97.95 && P.precioSugerido(290, 10, '95') === 319.95)
    const redondeos = q(`select tienda_redondear(12.40, '95'), tienda_redondear(12.97, '95'), tienda_redondear(12.95, '95'), tienda_redondear(0.30, '95'), tienda_redondear(10.995, '99'), tienda_redondear(12.01, 'entero'), tienda_redondear(12, 'entero')`).out
    check('tienda_redondear = redondearPrecio en los mismos casos', redondeos === '12.95|13.95|12.95|0.95|11.99|13|12', redondeos)
    check('  …un porcentaje loco, no', /entre −90 y 1000/.test(q(`${comoT} select tienda_stock_precio_bloque(array['${ids[0]}']::uuid[], 5000, '95')`).err))
    check('  …y no toca el stock de otra tienda', q(`set prueba.uid = '${OTRA}'; set role authenticated; select tienda_stock_precio_bloque(array['${ids[0]}']::uuid[], 10, '95') ->> 'cambiadas'`).out === '0')

    // Las vistas guardadas.
    check('vistas: la tienda guarda una', q(`${comoT} insert into tienda_vistas (nombre, filtros) values ('Vitrina', '{"ubicacion":["Vitrina"]}') returning nombre`).out.endsWith('Vitrina'))
    check('  …otra tienda no la ve', q(`set prueba.uid = '${OTRA}'; set role authenticated; select count(*) from tienda_vistas`).out === '0')
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
