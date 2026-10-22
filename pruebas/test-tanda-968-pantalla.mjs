// Tanda 968 — en pantalla: los productos especiales, el buscador de la
// pestaña Productos, abrir un producto desde la dirección, y el buscador de
// arriba (productos, y el camino directo a Cartas › Buscar).
//
// Sergio.M: «faltan las latas de Mega Charizard X y Mega Charizard Y»; «el
// tema del buscador es horroroso… para buscar cartas: Ver todo en Buscar,
// luego Cartas, luego Verlas en Cartas, y llegas al mismo lado» y «tampoco
// busca sellado».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcggo_id: 300, logo_tcggo: 'https://images.tcggo.com/logo-sv3.png' },
]
const LATA = (id, nombre, extra = {}) => ({ id, episode_id: 226, market: 'WEST', lang: 'en', name: nombre, tipo: 'lata', image: 'https://images.tcggo.com/lata.png', cardmarket_id: id + 800000, cm_lowest: 30, cm_lowest_eu: 30, cm_lowest_es: 28, release_date: null, ...extra })
const PRODUCTOS = [
  LATA(31415, 'Mega Charizard X ex Tin'),
  LATA(31416, 'Mega Charizard Y ex Tin'),
  LATA(31417, 'Pokémon Mini Tin Collection', { tipo: 'coleccion', cm_lowest_es: null }),
  LATA(31418, 'Charizard ex Premium Collection', { tipo: 'coleccion', cm_lowest_es: 40 }),
  LATA(31419, 'Charizard ex Super-Premium Collection', { tipo: 'coleccion', cm_lowest_es: 90 }),
  { id: 9001, episode_id: 300, market: 'WEST', lang: 'en', name: 'Obsidian Flames Booster', tipo: 'sobre', image: null, cardmarket_id: 700001, cm_lowest: 5, cm_lowest_eu: 5, cm_lowest_es: 5.5, release_date: '2023-08-11' },
  { id: 9002, episode_id: 300, market: 'WEST', lang: 'en', name: 'Obsidian Flames Charizard ex Tin', tipo: 'lata', image: null, cardmarket_id: 700002, cm_lowest: 20, cm_lowest_es: 21, release_date: '2023-08-11' },
]
const CARTAS = Array.from({ length: 7 }, (_, i) => ({ id: `sv3-${100 + i}`, set_id: 'sv3', local_id: String(100 + i), name: 'Charizard ex', market: 'WEST', category: 'Pokemon' }))

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'none', misProductos = [], ancho = 1280 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, PRODUCTOS, CARTAS, sesion, misProductos }) => {
    window.__FAKE_SESSION__ = sesion
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = misProductos
  }, { SETS, PRODUCTOS, CARTAS, sesion, misProductos })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="12" fill="#f2b632"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const baldosas = (page) => page.$$eval('#mcProdSets [data-prod-set]', (bs) => bs.map((b) => `${b.dataset.prodSet}:${b.querySelector('.mc-prod-baldosa-texto b').textContent}`))
const tarjetas = (page, sel) => page.$$eval(`${sel} .mc-prod .mc-prod-nombre`, (bs) => bs.map((b) => b.textContent))

console.log('── 1. /cartas › Productos, sin cuenta ──')
{
  const { ctx, page, errores } = await abrir('/cartas?ver=productos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('/cartas tiene su pestaña Productos, abierta', (await page.isVisible('#mcPanelProductos')) && (await page.getAttribute('#mcMenu [data-pestania="productos"]', 'aria-selected')) === 'true')
  const bs = await baldosas(page)
  check('«Productos especiales» va la primera, y luego las expansiones', bs.join() === 'especiales:Productos especiales,300:Obsidiana en Llamas', JSON.stringify(bs))
  check('  …diciendo cuántos son', /5 productos/.test(await page.textContent('#mcProdSets [data-prod-set="especiales"]')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/968-estante.png` })
  await page.click('#mcProdSets [data-prod-set="especiales"]')
  await page.waitForTimeout(900)
  const lista = await tarjetas(page, '#mcProdRejilla')
  check('dentro, las latas de Mega Charizard X e Y (y lo demás sin expansión)', lista.includes('Mega Charizard X ex Tin') && lista.includes('Mega Charizard Y ex Tin') && lista.length === 5, JSON.stringify(lista))
  check('  …con su cabecera', /Productos especiales/.test(await page.textContent('#mcProdSetCabeza')) && (await page.isVisible('#mcProdSetCabeza')))
  check('  …y el precio en español', /28,00 €/.test(await page.textContent('#mcProdRejilla [data-prod="31415"]')))
  await page.click('#mcProdRejilla [data-prod="31415"] [data-prod-anadir]')
  await page.waitForTimeout(300)
  check('sin cuenta, «+ Añadir» pide entrar (no hace como que lo guarda)', /Entra con tu cuenta/.test(await page.$$eval('.toast', (ts) => ts.map((t) => t.textContent).join(' | '))), await page.$$eval('.toast', (ts) => ts.map((t) => t.textContent).join(' | ')))
  await page.click('#mcProdVolver')
  await page.waitForTimeout(400)

  console.log('── 2. El buscador de la pestaña ──')
  await page.fill('#mcProdBuscar', 'lata charizard')
  await page.waitForTimeout(1200)
  const r = await tarjetas(page, '#mcProdResultados')
  check('«lata charizard» encuentra las tres latas de Charizard (en inglés, «Tin»)', r.length === 3 && r.every((n) => /Charizard.*Tin/.test(n)), JSON.stringify(r))
  check('  …las de fecha primero, las sin fecha detrás', r[0] === 'Obsidian Flames Charizard ex Tin', JSON.stringify(r))
  check('  …y la estantería se aparta mientras', !(await page.isVisible('#mcProdSets')) && /3 productos con «lata charizard»/.test(await page.textContent('#mcProdBusquedaCuenta')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/968-buscar-pestana.png` })
  await page.click('#mcProdResultados [data-prod="31416"] .mc-prod-abrir')
  await page.waitForTimeout(700)
  check('tocar un resultado abre su ficha', (await page.isVisible('#mcProdFicha')) && /Mega Charizard Y ex Tin/.test(await page.textContent('#mcProdFichaTitulo')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.fill('#mcProdBuscar', 'zzzz')
  await page.waitForTimeout(1000)
  check('sin nada, lo dice y da una pista', /Ningún producto con «zzzz»/.test(await page.textContent('#mcProdResultados')))
  await page.fill('#mcProdBuscar', '')
  await page.waitForTimeout(800)
  check('vaciarlo devuelve la estantería', (await page.isVisible('#mcProdSets')) && !(await page.isVisible('#mcProdBusqueda')))
  await ctx.close()
}

console.log('── 3. Un producto desde la dirección ──')
{
  const { ctx, page, errores } = await abrir('/cartas?ver=productos&producto=31415')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('?producto= abre su ficha', (await page.isVisible('#mcProdFicha')) && /Mega Charizard X ex Tin/.test(await page.textContent('#mcProdFichaTitulo')), await page.textContent('#mcProdFichaTitulo').catch(() => ''))
  check('  …con su precio en español', /28,00 €/.test(await page.textContent('#mcProdFichaCuerpo')))
  await ctx.close()
  const b = await abrir('/cartas?ver=productos&q=mega%20tin')
  check('?q= deja la búsqueda puesta', (await b.page.inputValue('#mcProdBuscar')) === 'mega tin' && (await tarjetas(b.page, '#mcProdResultados')).length === 2)
  await b.ctx.close()
}

console.log('── 4. En Mi colección, con cuenta: lo tuyo especial, en su grupo ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos', { sesion: 'admin-1', misProductos: [{ product_id: 31415, cantidad: 2 }, { product_id: 9001, cantidad: 1 }] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const grupos = await page.$$eval('#mcProdTuyos .mc-prod-set', (hs) => hs.map((h) => h.textContent.replace(/\s+/g, ' ').trim()))
  check('tus productos: la expansión y, detrás, «Productos especiales»', grupos.length === 2 && /Obsidiana en Llamas/.test(grupos[0]) && /Productos especiales/.test(grupos[1]), JSON.stringify(grupos))
  check('  …y la lata cuenta en el valor: inglesa, la de antes (969), 2 × 30 + 5', /65,00 €/.test(await page.textContent('#mcProdTuyos')), await page.textContent('#mcProdTuyos .mc-prod-valor').catch(() => ''))
  check('la baldosa de especiales dice que tienes 2', /Tienes 2/.test(await page.textContent('#mcProdSets [data-prod-set="especiales"]')))
  await ctx.close()
}

console.log('── 5. /buscar: productos, y el camino corto a Cartas ──')
{
  const { ctx, page, errores } = await abrir('/buscar.html?q=charizard')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const titulos = await page.$$eval('#searchResults .bs-grupo > .bs-seccion', (hs) => hs.map((h) => h.textContent.trim()))
  check('salen las cartas y, debajo, los productos', titulos[0] === 'Cartas' && titulos[1] === 'Productos', JSON.stringify(titulos))
  const prods = await page.$$eval('#searchResults .bs-fila.bs-productos', (as) => as.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]))
  check('  …cuatro de los cinco productos con Charizard, que llevan a su ficha en /cartas', prods.length === 4 && prods.every(([h]) => /^\/cartas\?ver=productos&producto=\d+$/.test(h)), JSON.stringify(prods))
  check('  …con su precio', prods.some(([, t]) => /28,00 €/.test(t)))
  const mas = await page.getAttribute('#searchResults a.bs-mas[href*="ver=buscar"]', 'href').catch(() => null)
  check('«Ver las 7 cartas» lleva DIRECTO a Cartas › Buscar (antes eran tres pasos)', mas === '/cartas?ver=buscar&q=charizard', mas)
  check('  …y «Ver más productos» a la pestaña Productos con lo escrito', (await page.getAttribute('#searchResults a.bs-mas[href*="ver=productos"]', 'href').catch(() => null)) === '/cartas?ver=productos&q=charizard')
  if (CAPS) await page.screenshot({ path: `${CAPS}/968-buscar.png`, fullPage: true })
  await page.click('#bsChips [data-grupo="productos"]')
  await page.waitForTimeout(900)
  check('la chapa «Productos» los enseña todos', (await page.locator('#searchResults .bs-fila.bs-productos').count()) === 5)
  await page.click('#searchResults .bs-fila.bs-productos[href$="31415"]')
  await page.waitForTimeout(2400)
  check('y tocar uno abre su ficha en /cartas', /\/cartas\?ver=productos&producto=31415/.test(page.url()) && (await page.isVisible('#mcProdFicha')), page.url())
  await ctx.close()
}

console.log('── 6. La paleta (Ctrl+K) ──')
{
  const { ctx, page, errores } = await abrir('/')
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(400)
  await page.fill('#paletaInput', 'charizard')
  await page.waitForTimeout(1500)
  const filas = await page.$$eval('#paletaLista [data-i]', (fs) => fs.map((f) => [f.textContent.replace(/\s+/g, ' ').trim(), f.getAttribute('href')]))
  const i = filas.findIndex(([t]) => /^Ver las 7 cartas/.test(t))
  check('debajo de las tres cartas, «Ver las 7 cartas», a Cartas › Buscar', i === 3 && filas[i][1] === '/cartas?ver=buscar&q=charizard', JSON.stringify(filas.slice(0, 6)))
  check('  …y salen productos, con su «Ver más productos»', filas.some(([, h]) => /producto=\d+/.test(h || '')) && filas.some(([t, h]) => /^Ver más productos/.test(t) && h === '/cartas?ver=productos&q=charizard'))
  if (CAPS) await page.screenshot({ path: `${CAPS}/968-paleta.png` })
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2600)
  check('con el teclado: tres abajo e Intro, en Cartas › Buscar con la búsqueda puesta', /\/cartas\?ver=buscar&q=charizard/.test(page.url()) && (await page.inputValue('#mcBuscarTodo')) === 'charizard', page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
