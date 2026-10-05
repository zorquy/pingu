// Tanda 651 en pantalla — tres fallos y el Panel.
//
// PINGU: «las cartas que no están en tu colección no muestran precio»;
// «desde el móvil, si voy a una expansión y clico en una carta no sale el
// pop-up, te lleva a la ficha completa»; «el panel se ve demasiado texto,
// poco botón, poco visual»; «aunque añadas una carta se debería ver el
// gráfico de lo que vale tu colección».
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 0. Lo estático ──')
{
  const js = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('las tres vistas de la expansión abren el pop-up', /engancharFicha\('mcAlbum', '\.mc-bolsillo-enlace, \.mc-rejilla-celda, \.mc-album-fila'\)/.test(js))
  check('el precio de una que no tienes se pide', /async function completarPrecioDeFicha/.test(js) && /datos\.preciosGuardados\(\[id\]\)/.test(js))
  check('el icono de descargar NO entra en js/icons.js (la portada no tiene sitio)', !/download/.test(readFileSync(`${RAIZ}/js/icons.js`, 'utf8')) && /ICONO_DESCARGAR/.test(js))
}

const browser = await chromium.launch()
const semilla = ({ vista, valor }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  if (vista) localStorage.setItem('mc-album-vista', vista)
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'xy5-151', market: 'WEST', set_id: 'xy5', local_id: '151', name: 'Primal Groudon-EX', name_es: 'Groudon Primigenio EX', image_path: 'x/2', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273682 },
  ]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
  // El precio de la 151, que NO tienes.
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-151', cm_id_product: 273682, cm_low: 70, cm_low_es: 87.95, cm_low_en: 73.95, tp_market_eur: 80.5, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
  window.__FAKE_VALOR__ = valor || []
}
const cartaFalsa = () => ({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" rx="12" fill="#c9a227"/></svg>' })
async function abrir(ruta, { ancho = 1200, vista = null, valor = null } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla, { vista, valor })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill(cartaFalsa()))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

console.log('\n── 1. Una que no tienes enseña su precio ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-151"]').click()
  await page.waitForTimeout(1500)
  const bloque = page.locator('#mcEdPrecioBloque')
  check('la ficha de una carta que NO tienes dice su precio', /87,95 €/.test(limpio(await bloque.innerText())) && !/Sin precio/.test(limpio(await bloque.innerText())), limpio(await bloque.innerText()).slice(0, 120))
  check('  …con TCGplayer también', /80,50 €/.test(limpio(await bloque.innerText())))
  check('  …y sigue sin bloque de tu copia (no la tienes)', !(await page.locator('#mcEdCopiaBloque').isVisible()) && (await page.locator('#mcEdMas').isVisible()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. En el móvil, en cuadrícula y en lista, la carta abre el pop-up ──')
{
  for (const vista of ['cuadricula', 'lista']) {
    const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5', { ancho: 390, vista })
    const selector = vista === 'cuadricula' ? '#mcAlbum .mc-rejilla-celda' : '#mcAlbum .mc-album-fila'
    check(`[${vista}] la expansión se ve en ${vista}`, (await page.locator(selector).count()) === 2, String(await page.locator(selector).count()))
    await page.locator(selector).first().tap()
    await page.waitForTimeout(1200)
    check(`[${vista}] tocar una carta abre el pop-up, sin irse de la página`, (await page.locator('#mcEditor[open]').count()) === 1 && /mi-coleccion/.test(page.url()), page.url())
    check(`[${vista}] sin errores`, errores.length === 0, errores.join(' | '))
    await page.close()
  }
}

console.log('\n── 3. El Panel: losetas en vez de párrafos, y Cambios en cifras ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html')
  await page.waitForTimeout(800)
  const losetas = page.locator('.mc-acciones-rejilla .mc-accion-loseta')
  check('tres losetas: imagen, importar, exportar', (await losetas.count()) === 3 && (await page.locator('#mcImagenCrear').isVisible()) && (await page.locator('#mcImportarAbrir').isVisible()) && (await page.locator('#mcExportar').isVisible()))
  check('  …cada una con su icono y su texto, y sin párrafos', (await losetas.locator('.mc-accion-icono svg').count()) === 3 && (await page.locator('.mc-vistazo-importar p.subtext').count()) === 0)
  check('  …y miden 44 px o más', (await losetas.first().boundingBox()).height >= 44)
  const cambios = page.locator('.mc-vistazo').filter({ has: page.locator('h2', { hasText: 'Cambios' }) })
  check('Cambios dice una cifra, no un párrafo', (await cambios.locator('.mc-panel-cifra').count()) >= 1 && /0 cartas que das/.test(limpio(await cambios.innerText())) && (await cambios.locator('p.subtext, p.empty-state').count()) === 0, limpio(await cambios.innerText()))
  await cambios.locator('.mc-panel-cifra').first().click()
  await page.waitForTimeout(500)
  check('  …y la cifra lleva a Cambios', await page.locator('#mcPanelCambios').isVisible())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. La gráfica con un solo punto: lo que vale hoy ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html')
  await page.waitForTimeout(800)
  const caja = page.locator('#mcValorCaja')
  const t = limpio(await caja.innerText())
  check('sin ninguna foto todavía, la gráfica está, con un punto', (await caja.locator('.mc-valor-un-punto').count()) === 1 && (await caja.locator('.mc-valor-punto').count()) === 1)
  check('  …y dice lo que vale hoy (tu Groudon no tiene precio: 0 €)', /0,00 €/.test(t) && /hoy/.test(t), t.slice(0, 160))
  check('  …y que la primera foto es esta noche', /primera foto/.test(t))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
