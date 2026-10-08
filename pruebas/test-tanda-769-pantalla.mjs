// Tanda 769 — Productos como Expansiones, y la ficha de un producto.
//
// PINGU: «productos debería ser lo mismo que cuando buscas una expansión:
// que se te abran los productos por set, diferenciando entre occidental y
// japonés; y cuando clicas en un producto, que te abra igual que una carta,
// en un lateral en el PC y el pop-up en el móvil, con toda la info que
// traemos desde la API: el precio, el gráfico, el link directo a Cardmarket
// y TCGplayer».
//
// Lo que se mira: lo puro (precios por sitio, enlaces), las dos funciones
// de servidor con sus dobles (las columnas por país solo si existen; el
// histórico a demanda, con su frescura, su tope y su «sin migración»), la
// estantería con los dos catálogos, una expansión, y la ficha: al lado en
// un PC ancho y en ventana si no, con lo que vale en cada sitio, las
// medias, los dos botones, su gráfica y el «+».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { preciosPorSitio, enlaceCardmarketDeProducto, enlaceTcgplayerDeProducto, filaDeProducto, COLUMNAS_POR_PAIS } from '/home/user/pingu/js/productos.js'
import { procesar as procesarHistorial, filasDeProducto, TOPE_DIARIO } from '/home/user/pingu/netlify/functions/tcggo-historial-producto.mjs'
import { procesar as procesarProductos } from '/home/user/pingu/netlify/functions/tcggo-productos.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''
const REAL = JSON.parse(readFileSync(new URL('./fixtures/tcggo-productos-30c.json', import.meta.url), 'utf8'))

console.log('── 1. Lo puro ──')
{
  const f = filaDeProducto(REAL.lista.data[0])
  check('la fila guarda el mínimo de Alemania, Francia e Italia', f.cm_lowest_de === 9.99 && f.cm_lowest_fr === 12.89 && f.cm_lowest_it === 8.15, JSON.stringify(f))
  const sitios = preciosPorSitio(f).map((s) => `${s.nombre}:${s.valor}`)
  check('los precios por sitio, de lo cercano a lo lejano', sitios.join() === 'España:8.78,Europa:10.99,Alemania:9.99,Francia:12.89,Italia:8.15,Todo Cardmarket:10.99', JSON.stringify(sitios))
  check('  …y lo que no tiene cifra no sale', preciosPorSitio({ cm_lowest: 400, cm_lowest_eu: 400 }).map((s) => s.id).join() === 'eu,todo')
  check('Cardmarket por su id de producto, sin filtro de idioma', enlaceCardmarketDeProducto(f) === 'https://www.cardmarket.com/es/Pokemon/Products?idProduct=890360')
  check('TCGplayer por el suyo', enlaceTcgplayerDeProducto(f) === 'https://www.tcgplayer.com/product/696613')
  check('  …y sin id, sin enlace', enlaceCardmarketDeProducto({}) === null && enlaceTcgplayerDeProducto({ tcgplayer_id: null }) === null)
  const filas = filasDeProducto(48447, { data: { '2026-09-20': { cm_low: 12, cm_low_es: 9, tcg_player_market: 11 }, '2026-09-21': { cm_low: 11.5 }, '2026-09-22': {} } })
  check('el histórico de TCGGO, como filas del producto: Cardmarket y TCGplayer, sin países', JSON.stringify(filas) === JSON.stringify([{ product_id: 48447, dia: '2026-09-20', cm_low: 12, cm_low_en: 12, tp_market_eur: 11, origen: 'tcggo' }, { product_id: 48447, dia: '2026-09-21', cm_low: 11.5, cm_low_en: 11.5, tp_market_eur: null, origen: 'tcggo' }]), JSON.stringify(filas))
}

console.log('── 2. La migración ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-productos-ficha.sql`, 'utf8')
  check('las tres columnas por país y la del histórico', COLUMNAS_POR_PAIS.every((c) => new RegExp(`add column if not exists ${c} numeric`).test(sql)) && /add column if not exists historial_at timestamptz/.test(sql))
  check('  …la tabla del histórico, con su SELECT en la misma migración (la 510)', /create table if not exists public\.tcg_product_history/.test(sql) && /create policy tcg_product_history_ver on public\.tcg_product_history for select to anon, authenticated/.test(sql))
  check('  …sin tablas temporales (la 631)', !/temp(orary)? table/i.test(sql))
}

console.log('── 3. tcggo-productos: las columnas por país, solo si existen ──')
for (const existen of [true, false]) {
  const escritas = []
  const restImpl = async (ruta, o) => {
    if (ruta.startsWith('tcg_products?select=id')) return []
    if (ruta.startsWith(`tcg_products?select=${COLUMNAS_POR_PAIS.join(',')}`)) { if (!existen) throw new Error('Supabase 400: column tcg_products.cm_lowest_de does not exist'); return [] }
    if (ruta.startsWith('scrydex_estado?select')) return [{ valor: { ruta: '/episodes/{id}/products?page={pagina}' } }]
    if (ruta === 'scrydex_estado') return null
    if (ruta.startsWith('tcg_sets?')) return [{ id: '30c', market: 'WEST', tcggo_id: 431, release_date: '2026-09-16' }]
    if (ruta === 'tcg_products') { escritas.push(...JSON.parse(o.body)); return null }
    throw new Error(`ruta inesperada ${ruta}`)
  }
  const fetchImpl = async () => new Response(JSON.stringify({ data: REAL.lista.data.slice(0, 3), paging: { current: 1, total: 1 } }), { status: 200 })
  await procesarProductos({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' }, ahora: new Date('2026-10-08T10:00:00Z'), restImpl, fetchImpl })
  const conPais = escritas.filter((f) => 'cm_lowest_de' in f).length
  check(existen ? 'con la migración, se escriben' : 'sin ella, no se mandan (la fila entera se rechazaría)', escritas.length === 3 && conPais === (existen ? 3 : 0), `${escritas.length} filas, ${conPais} con país`)
}

console.log('── 4. tcggo-historial-producto ──')
{
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' }
  const ahora = new Date('2026-10-08T10:00:00Z')
  const montar = ({ historialAt = null, cardmarketId = 890360, sinMigracion = false, estado = {} } = {}) => {
    const m = { llamadas: [], guardadas: [], parches: [], estado }
    m.restImpl = async (ruta, o) => {
      if (ruta.startsWith('tcg_product_history?')) { if (sinMigracion) throw new Error('Supabase 404: relation "tcg_product_history" does not exist'); return [{ dia: '2026-09-01', cm_low: 15 }] }
      if (ruta.startsWith('tcg_products?select=')) return [{ id: 48447, cardmarket_id: cardmarketId, historial_at: historialAt }]
      if (ruta.startsWith('tcg_products?id=eq.')) { m.parches.push(JSON.parse(o.body)); return null }
      throw new Error(`ruta inesperada ${ruta}`)
    }
    m.guardarImpl = async (filas) => { m.guardadas.push(...filas) }
    m.estadoImpl = async () => m.estado
    m.guardarEstadoImpl = async (v) => { m.estado = v }
    m.fetchImpl = async (url) => { m.llamadas.push(url); return new Response(JSON.stringify({ data: { '2026-09-20': { cm_low: 12, tcg_player_market: 11 } } }), { status: 200 }) }
    return m
  }
  {
    const m = montar()
    const r = await procesarHistorial({ env, ahora, productId: '48447', ...m })
    check('la primera vez se pide a TCGGO, por el id de Cardmarket', m.llamadas.length === 1 && /history-prices\?cardmarket_id=890360/.test(m.llamadas[0]), JSON.stringify(m.llamadas))
    check('  …se guarda y se apunta cuándo', m.guardadas.length === 1 && m.guardadas[0].product_id === 48447 && m.parches[0]?.historial_at === ahora.toISOString())
    check('  …y devuelve lo de la base y lo nuevo, por día', r.cuerpo.filas.map((f) => f.dia).join() === '2026-09-01,2026-09-20', JSON.stringify(r.cuerpo))
  }
  {
    const m = montar({ historialAt: '2026-10-05T10:00:00Z' })
    const r = await procesarHistorial({ env, ahora, productId: '48447', ...m })
    check('pedido hace menos de una semana: no se gasta nada', m.llamadas.length === 0 && r.cuerpo.filas.length === 1 && /semana/.test(r.cuerpo.porque))
  }
  {
    const m = montar({ estado: { dia: '2026-10-08', peticiones: TOPE_DIARIO } })
    const r = await procesarHistorial({ env, ahora, productId: '48447', ...m })
    check('con el tope del día gastado, se sirve lo que hay', m.llamadas.length === 0 && /tope/.test(r.cuerpo.porque))
  }
  {
    const m = montar({ sinMigracion: true })
    const r = await procesarHistorial({ env, ahora, productId: '48447', ...m })
    check('sin la migración, lista vacía y lo dice, sin gastar', m.llamadas.length === 0 && r.cuerpo.filas.length === 0 && /productos-ficha/.test(r.cuerpo.nota))
  }
  {
    const m = montar({ cardmarketId: null })
    await procesarHistorial({ env, ahora, productId: '48447', ...m })
    check('sin id de Cardmarket no hay a quién preguntar', m.llamadas.length === 0)
  }
}

console.log('── 5. La pestaña ──')
const browser = await chromium.launch()
const SETS = [
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcggo_id: 300, logo_tcggo: 'https://images.tcggo.com/logo-sv3.png' },
  { id: 'me30', name: '30 aniversario', serie_id: 'me', market: 'WEST', release_date: '2026-09-16', card_count_official: 128, card_count_total: 128, tcggo_id: 431, logo_tcggo: 'https://images.tcggo.com/logo-30.png' },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165, card_count_total: 210, tcggo_id: 900 },
]
const PRODUCTOS = [
  { ...filaDeProducto(REAL.lista.data[0]), id: 48447, episode_id: 431 },
  { id: 9001, episode_id: 300, lang: 'en', name: 'Obsidian Flames Booster', tipo: 'sobre', image: null, cardmarket_id: 700001, tcgplayer_id: 500001, cm_lowest: 5, cm_lowest_eu: 5, cm_lowest_es: 5.5, cm_lowest_de: 4.9, cm_avg30: 4.8, cm_avg7: 5.1, cm_disponibles: 812, release_date: '2023-08-11' },
  { id: 9900, episode_id: 900, lang: 'ja', name: 'Pokémon Card 151 Booster Box (JP)', tipo: 'caja', image: null, cardmarket_id: 700900, cm_lowest: 120, cm_lowest_eu: 125, release_date: '2023-06-16' },
]
async function abrir(ruta, { ancho = 1280, movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, PRODUCTOS }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = []
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = [{ product_id: 9001, cantidad: 1 }]
  }, { SETS, PRODUCTOS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const pedidas = []
  await ctx.route(/tcggo-historial-producto/, (r) => {
    pedidas.push(r.request().url())
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas: Array.from({ length: 40 }, (_, i) => ({ dia: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10), cm_low: 10 + (i % 7), cm_low_en: 10 + (i % 7), tp_market_eur: 12 + (i % 5) })) }) })
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores, pedidas }
}
const baldosas = (page) => page.$$eval('#mcProdSets [data-prod-set]', (bs) => bs.map((b) => `${b.dataset.prodSet}:${b.querySelector('.mc-prod-baldosa-texto b').textContent}${b.querySelector('img') ? '+logo' : ''}${b.querySelector('.mc-prod-baldosa-tuyos') ? `+${b.querySelector('.mc-prod-baldosa-tuyos').textContent}` : ''}`))
{
  const { ctx, page, errores, pedidas } = await abrir('/mi-coleccion.html?ver=productos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la estantería: una baldosa por expansión, la más nueva primero, con su logo y lo tuyo', (await baldosas(page)).join() === '431:30 aniversario+logo,300:Obsidiana en Llamas+logo+Tienes 1', JSON.stringify(await baldosas(page)))
  check('  …y arriba, tus productos', /Obsidian Flames Booster/.test(await page.textContent('#mcProdTuyos')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/769-estante.png` })
  await page.click('[data-prod-mercado="JP"]')
  await page.waitForTimeout(1000)
  check('Pokémon Japón: solo las japonesas (con su nombre inglés, como en Expansiones)', (await baldosas(page)).join() === '900:Pokémon Card 151', JSON.stringify(await baldosas(page)))
  check('  …sin tocar el catálogo de la página', (await page.locator('.mc-mercado').first().evaluate((n) => n.value)) === 'es')
  await page.click('[data-prod-mercado="WEST"]')
  await page.waitForTimeout(1000)
  await page.click('#mcProdSets [data-prod-set="300"]')
  await page.waitForTimeout(900)
  check('abrir una expansión: su cabecera y sus productos, sin la estantería', (await page.isVisible('#mcProdSetVista')) && !(await page.isVisible('#mcProdEstante')) && /Obsidiana en Llamas/.test(await page.textContent('#mcProdSetCabeza')) && (await page.locator('#mcProdRejilla .mc-prod').count()) === 1)

  console.log('── 6. La ficha, en ventana ──')
  await page.click('#mcProdRejilla [data-prod-ficha="9001"] .mc-prod-nombre')
  await page.waitForTimeout(1200)
  const ficha = await page.evaluate(() => {
    const d = document.getElementById('mcProdFicha')
    return {
      abierta: d.open, modal: d.matches(':modal'), titulo: document.getElementById('mcProdFichaTitulo').textContent,
      precio: document.querySelector('.mc-prodf-precio').textContent.replace(/\s+/g, ' ').trim(),
      filas: [...d.querySelectorAll('.pv-tabla tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' ')),
      cm: d.querySelector('.btn-cardmarket')?.href, tp: d.querySelector('.btn-tcgplayer')?.href,
      grafica: !!d.querySelector('#mcProdHistorial svg') && !document.getElementById('mcProdHistorial').classList.contains('hidden'),
      leyenda: [...d.querySelectorAll('.carta-historial-leyenda-item')].map((i) => i.textContent.trim()),
      tienes: d.querySelector('.mc-prodf-tienes')?.textContent,
    }
  })
  check('tocar el nombre abre su ficha, en ventana', ficha.abierta && ficha.modal && ficha.titulo === 'Obsidian Flames Booster', JSON.stringify(ficha))
  check('  …con el precio de España arriba', /5,50 € mínimo en España/.test(ficha.precio), ficha.precio)
  check('  …lo que vale en cada sitio y las medias', ficha.filas.join('|') === 'España 5,50 €|Europa 5,00 €|Alemania 4,90 €|Todo Cardmarket 5,00 €|Media de 7 días 5,10 €|Media de 30 días 4,80 €|A la venta ahora 812', JSON.stringify(ficha.filas))
  check('  …los dos botones, directos al producto', ficha.cm === 'https://www.cardmarket.com/es/Pokemon/Products?idProduct=700001' && ficha.tp === 'https://www.tcgplayer.com/product/500001', `${ficha.cm} ${ficha.tp}`)
  check('  …su gráfica, la de las cartas, con Cardmarket y TCGplayer', ficha.grafica && ficha.leyenda.join() === 'Cardmarket,TCGplayer' && pedidas.some((u) => /product=9001/.test(u)), JSON.stringify(ficha.leyenda))
  check('  …y dice que lo tienes', ficha.tienes === 'Lo tienes', ficha.tienes)
  if (CAPS) await page.screenshot({ path: `${CAPS}/769-ficha.png` })
  await page.click('#mcProdFicha [data-prod-mas="9001"]')
  await page.waitForTimeout(800)
  check('el «+» de la ficha suma, y lo dice ahí y en la tarjeta', (await page.textContent('#mcProdFicha .mc-prodf-tienes')) === 'Tienes 2' && /×2/.test(await page.textContent('#mcProdRejilla [data-prod="9001"]')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Escape la cierra', !(await page.evaluate(() => document.getElementById('mcProdFicha').open)))
  await page.click('#mcProdVolver')
  await page.waitForTimeout(400)
  check('«Todas las expansiones» vuelve a la estantería', (await page.isVisible('#mcProdEstante')) && !(await page.isVisible('#mcProdSetVista')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. La ficha, al lado en un PC ancho ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos', { ancho: 1600 })
  await page.click('#mcProdSets [data-prod-set="431"]')
  await page.waitForTimeout(900)
  await page.click('#mcProdRejilla [data-prod-ficha="48447"] .mc-prod-foto')
  await page.waitForTimeout(1000)
  const v = await page.evaluate(() => { const d = document.getElementById('mcProdFicha'); const r = d.getBoundingClientRect(); return { abierta: d.open, modal: d.matches(':modal'), derecha: Math.round(window.innerWidth - r.right), ancho: Math.round(r.width) } })
  check('tocar la foto la abre AL LADO, sin tapar la rejilla', v.abierta && !v.modal && v.derecha <= 24 && v.ancho <= 460, JSON.stringify(v))
  if (CAPS) await page.screenshot({ path: `${CAPS}/769-al-lado.png` })
  await page.click('#mcProdRejilla [data-prod-ficha="48447"] .mc-prod-nombre')
  await page.waitForTimeout(300)
  check('  …y la rejilla se sigue pudiendo tocar', await page.evaluate(() => document.getElementById('mcProdFicha').open))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('  …Escape también la cierra', !(await page.evaluate(() => document.getElementById('mcProdFicha').open)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 8. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos', { movil: true })
  await page.click('#mcProdSets [data-prod-set="300"]')
  await page.waitForTimeout(900)
  await page.click('#mcProdRejilla [data-prod-ficha="9001"] .mc-prod-nombre')
  await page.waitForTimeout(1000)
  const v = await page.evaluate(() => { const d = document.getElementById('mcProdFicha'); const r = d.getBoundingClientRect(); return { modal: d.matches(':modal'), ancho: Math.round(r.width), cabe: r.left >= 0 && r.right <= window.innerWidth, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth } })
  check('la ficha, en ventana y sin salirse', v.modal && v.cabe && v.scroll <= 1, JSON.stringify(v))
  const altos = await page.$$eval('#mcProdFicha button, #mcProdFicha a.pv-boton', (bs) => bs.filter((b) => b.getBoundingClientRect().height).map((b) => Math.round(b.getBoundingClientRect().height)))
  check('  …lo que se toca, 44', altos.every((h) => h >= 44), JSON.stringify(altos))
  if (CAPS) await page.screenshot({ path: `${CAPS}/769-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
