// Tanda 920 — El pop-up de la carta, como Dex (PINGU, con el Dex delante):
//   1. En el móvil, sin mando arriba: ni cerrar ni «‹ 1 de 3 ›» — con los
//      gestos basta. Un tirador dice «arrástrala» y abajo la cierra.
//   2. La carta, un poco más pequeña.
//   3. El corazón y compartir flotan DENTRO de la hoja, sobre la esquina de
//      la carta (antes se cortaban por arriba).
//   4. En el PC, el pop-up sigue con su X.
//   5. Sin botón de Cardmarket: las tarjetas ya llevan a Cardmarket y a
//      TCGplayer (y TCGplayer sin cifra también es tarjeta).
//   6. En el PC, las tarjetas de precio en rejilla, sin barra de desplazar.
//   7. En el móvil, el dedo de lado sobre los precios mueve los precios, no
//      cambia de carta.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

console.log('── 0. Lo estático y lo puro ──')
{
  const pv = leer('js/precio-vista.js')
  check('las tarjetas ya no pintan botones debajo', !/pv-boton-cm/.test(pv) && !/<div class="pv-botones">\$\{botones\}/.test(pv))
  const cm = leer('css/cardmarket.css')
  check('en el ordenador, rejilla y sin desplazar', /@media \(min-width: 761px\) \{\s*\.pv-tarjetas \{\s*display: grid;[^}]*overflow: visible;/.test(cm))
  const { tarjetasDePrecio } = await import(join(RAIZ, 'js/precio-vista.js'))
  const conId = tarjetasDePrecio({ idProduct: 5, porIdioma: { es: 3 } }, { idioma: 'es', tcgplayerId: 96048 })
  check('TCGplayer sin cifra pero con su enlace: tarjeta «ver precio»', /<a class="pv-tarjeta pv-tarjeta-tcg btn-tcgplayer pv-tarjeta-sin" href="https:\/\/www\.tcgplayer\.com\/product\/96048"[^>]*><span class="pv-t-cab"><b>TCGplayer<\/b><\/span><span class="pv-t-cifra">ver precio<\/span>/.test(conId), conId.slice(-400))
  const sinNada = tarjetasDePrecio({ idProduct: 5, porIdioma: { es: 3 } }, { idioma: 'es' })
  check('  …y sin enlace ni cifra, ninguna', !/TCGplayer/.test(sinNada))
  const g = leer('js/mi-coleccion/gestos-ficha.js')
  check('el gesto de lado mira si el dedo empezó en algo que se desplaza de lado', /export function seDesplazaDeLado/.test(g) && /inicio\.deLado && \(gesto === 'anterior' \|\| gesto === 'siguiente'\)/.test(g))
}

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `sv/sv8/${n}`, rarity: 'Special Illustration Rare', category: 'Pokemon', types: ['Lightning'], dex_ids: [25], illustrator: 'Mitsuhiro Arita', variants: { normal: true, reverse: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191 } })
const CARTAS = [carta(238, 'Pikachu ex'), carta(239, 'Raichu'), carta(240, 'Zapdos')]
const PRECIOS = [{ card_id: 'sv8-238', cm_id_product: 777, cm_low: 20, cm_low_es: 28.8, cm_low_en: 24.5, cm_low_it: 27.4, cm_low_fr: 26, cm_low_de: 25, tp_market_eur: 31.2, checked_at: '2026-10-19T10:00:00Z' }]
const COLECCION = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2, created_at: '2026-10-01T10:00:00Z' }]
const browser = await chromium.launch()
async function abrir({ movil = true } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }], __FAKE_DESEOS__: [], __FAKE_IDIOMAS_SET__: { sv8: ['de', 'en', 'es', 'fr', 'it'] } })
  }, { SETS, CARTAS, PRECIOS, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#f59e0b"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('#mcAlbum [data-carta="sv8-238"]').first().click()
  await page.waitForTimeout(1500)
  return { ctx, page, errores, cdp: movil ? await ctx.newCDPSession(page) : null }
}
async function arrastrar(cdp, desde, hasta, pasos = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: desde.x, y: desde.y }] })
  for (let i = 1; i <= pasos; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: desde.x + ((hasta.x - desde.x) * i) / pasos, y: desde.y + ((hasta.y - desde.y) * i) / pasos }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
const sitio = (page) => page.textContent('#mcEdSitio')

console.log('── 1–3, 5, 7. En un iPhone ──')
{
  const { ctx, page, errores, cdp } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const dlg = document.getElementById('mcEditor').getBoundingClientRect()
    const vis = (id) => { const e = document.getElementById(id); return Boolean(e && e.getBoundingClientRect().height && getComputedStyle(e).display !== 'none') }
    const quiero = document.getElementById('mcEdCompartir').getBoundingClientRect()
    const foto = document.getElementById('mcEdFoto').getBoundingClientRect()
    const asa = getComputedStyle(document.querySelector('#mcEditor .mc-ficha-mando'), '::before')
    return { cerrar: vis('mcEdCerrar'), pasos: vis('mcEdPasos'), dlgTop: Math.round(dlg.top), dlgRight: Math.round(dlg.right), icono: { top: Math.round(quiero.top), right: Math.round(quiero.right), alto: Math.round(quiero.height) }, foto: { top: Math.round(foto.top), ancho: Math.round(foto.width) }, asa: { ancho: asa.width, alto: asa.height } }
  })
  check('sin mando arriba: ni cerrar ni «‹ 1 de 3 ›»', !r.cerrar && !r.pasos, JSON.stringify(r))
  check('  …y un tirador que dice «arrástrala»', r.asa.ancho === '36px' && r.asa.alto === '4px', JSON.stringify(r.asa))
  check('la carta, un poco más pequeña (antes 285 px en un iPhone 13)', r.foto.ancho <= 264 && r.foto.ancho >= 220, String(r.foto.ancho))
  check('el corazón y compartir, dentro de la hoja y a la altura de la carta (no cortados arriba)', r.icono.top >= r.dlgTop + 16 && r.icono.top >= r.foto.top - 4 && r.icono.right <= r.dlgRight && r.icono.alto >= 44, JSON.stringify(r))
  check('sin botón de Cardmarket bajo los precios', (await page.locator('#mcEdPrecioBloque .btn-cardmarket, #mcEdPrecioBloque .pv-botones').count()) === 0)

  // El dedo de lado sobre los precios: mueve los precios.
  await page.locator('#mcEdPrecioBloque .pv-tarjetas').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const t = await page.$eval('#mcEdPrecioBloque .pv-tarjetas', (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.7), y: Math.round(b.top + b.height / 2), desborda: e.scrollWidth > e.clientWidth } })
  check('en el móvil los precios se deslizan (no caben)', t.desborda)
  const antes = await sitio(page)
  await arrastrar(cdp, t, { x: t.x - 180, y: t.y + 4 })
  await page.waitForTimeout(800)
  const lejos = await page.$eval('#mcEdPrecioBloque .pv-tarjetas', (e) => e.scrollLeft)
  check('deslizar de lado sobre los precios NO cambia de carta', (await sitio(page)) === antes && antes === '1 de 3', `${antes} → ${await sitio(page)}`)
  check('  …y mueve los precios', lejos > 40, String(lejos))

  // Sobre la carta sigue pasando de carta.
  await page.evaluate(() => { document.getElementById('mcEditor').scrollTop = 0 })
  await page.waitForTimeout(300)
  const c = await page.$eval('#mcEdFoto', (f) => { const b = f.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + Math.min(b.height / 2, 120)) } })
  await arrastrar(cdp, c, { x: c.x - 150, y: c.y + 6 })
  await page.waitForTimeout(900)
  check('sobre la carta, de lado: la siguiente', (await sitio(page)) === '2 de 3', await sitio(page))
  // Y abajo, desde arriba, la cierra: es la salida sin la X.
  await page.evaluate(() => { document.getElementById('mcEditor').scrollTop = 0 })
  await page.waitForTimeout(200)
  const c2 = await page.$eval('#mcEdFoto', (f) => { const b = f.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + 40) } })
  await arrastrar(cdp, c2, { x: c2.x, y: c2.y + 200 })
  await page.waitForTimeout(800)
  check('arrastrar hacia abajo la cierra', !(await page.evaluate(() => document.getElementById('mcEditor').open)))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4 y 6. En el ordenador ──')
{
  const { ctx, page, errores } = await abrir({ movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el pop-up tiene su X', await page.locator('#mcEdCerrar').isVisible())
  check('  …y las flechas para pasar de carta', await page.locator('#mcEdSiguiente').isVisible())
  const r = await page.$eval('#mcEdPrecioBloque .pv-tarjetas', (e) => {
    const caja = e.getBoundingClientRect()
    const ts = [...e.querySelectorAll('.pv-tarjeta')].map((t) => t.getBoundingClientRect())
    return { barra: e.scrollWidth > e.clientWidth + 1, desborda: getComputedStyle(e).overflowX, todas: ts.every((t) => t.right <= caja.right + 1 && t.left >= caja.left - 1), filas: new Set(ts.map((t) => Math.round(t.top))).size, n: ts.length }
  })
  check('las tarjetas de precio caben todas, sin barra de desplazar', !r.barra && r.desborda === 'visible' && r.todas && r.n === 6, JSON.stringify(r))
  check('  …en rejilla (más de una fila)', r.filas >= 2, JSON.stringify(r))
  check('  …y sin botón de Cardmarket debajo', (await page.locator('#mcEdPrecioBloque .btn-cardmarket, #mcEdPrecioBloque .pv-botones').count()) === 0)
  await page.click('#mcEdCerrar')
  await page.waitForTimeout(500)
  check('la X cierra', !(await page.evaluate(() => document.getElementById('mcEditor').open)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
