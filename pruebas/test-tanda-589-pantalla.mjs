// Tanda 589 — los precios por idioma en pantalla: la ficha emergente de
// /mi-coleccion y «Precio y colección» de /carta, con una fila de TCGGO.
//
// Fixture: el Groudon-EX con su fila de TCGGO (140 € en español, 194 en
// inglés, 150 en francés, sin alemán; TCGplayer 171,08 € ; gradeadas de
// Cardmarket y eBay) y los dos ids de producto. Dos copias: una en
// español y una en alemán (que cae al mínimo general, 39 €).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, card_count_total: 164, logo_path: null, logo_tcggo: 'https://images.tcggo.com/prc.png', tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681, tp_id_product_propio: 96048 },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'de', estado: 'GD', variante: 'holo', created_at: '2026-10-02T10:00:00Z' },
  ]
  window.__FAKE_PRECIOS__ = [{
    card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_trend: 196.68, cm_avg30: 131.56, cm_avg7: 144.25,
    cm_low_en: 194, cm_low_fr: 150, cm_low_es: 140, cm_disponibles: 12, tp_market_eur: 171.08, tp_mid_eur: 180,
    cm_gradeadas: { psa: { psa10: 2621, psa9: 184 } },
    ebay_gradeadas: { bgs: { 10: { median_price: 3500, sample_size: 3 } }, tag: { 10: { median_price: 999, sample_size: 1 } } },
    tcggo_updated: '2026-10-05T12:00:00Z', cm_updated: '2026-10-05T00:00:00Z', origen: 'tcggo',
  }]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())
await page.route('**images.tcggo.com/**', (r) => r.abort())

console.log('── 1. La cabecera suma cada copia por SU idioma: 140 + 39 ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const valor = limpio(await page.locator('#mcResumen .mc-cifra-valor dd').textContent())
  check('el valor es 179,00 € (español 140 + alemán al general 39), no 2 × 196 de tendencia', valor.includes('179,00'), valor)
}

console.log('── 2. La ficha de la copia en español ──')
{
  await page.locator('.mc-carta-foto').filter({ hasText: 'Groudon' }).first().click()
  await page.waitForTimeout(900)
  const bloque = page.locator('#mcEdPrecioBloque')
  check('la cifra es el mínimo en español, 140 €', limpio(await bloque.locator('.pv-cifra').innerText()) === '140,00 €', limpio(await bloque.locator('.pv-cifra').innerText()))
  check('  …y el renglón dice de qué es, en pocas palabras', /^mínimo en español en Cardmarket · NM · 5 oct$/.test(limpio(await bloque.locator('.pv-burbuja-principal .pv-de').innerText())), limpio(await bloque.locator('.pv-burbuja-principal .pv-de').innerText()))
  // Desde la 645: una fila por idioma en la tabla de Cardmarket, y TCGplayer en su burbuja.
  const filas = await bloque.locator('.pv-cardmarket .pv-fila').allInnerTexts()
  check('las filas: español, inglés y francés (sin alemán ni italiano, que no tienen)', filas.map(limpio).join(' | ') === 'Español tu copia 140,00 € | Inglés 194,00 € | Francés 150,00 €', filas.map(limpio).join(' | '))
  check('  …con la española marcada', limpio(await bloque.locator('.pv-fila.pv-activa').innerText()) === 'Español tu copia 140,00 €')
  check('  …y TCGplayer en su burbuja, en euros', /TCGplayer 171,08 €/i.test(limpio(await bloque.locator('.pv-burbujas').innerText())), limpio(await bloque.locator('.pv-burbujas').innerText()))
  const cm = bloque.locator('.btn-cardmarket')
  check('el botón de Cardmarket va al producto 273681 en español y NM', /idProduct=273681/.test(await cm.getAttribute('href')) && /language=4/.test(await cm.getAttribute('href')) && /minCondition=2/.test(await cm.getAttribute('href')), await cm.getAttribute('href'))
  const tp = bloque.locator('.btn-tcgplayer')
  check('y el de TCGplayer al producto 96048', (await tp.count()) === 1 && (await tp.getAttribute('href')) === 'https://www.tcgplayer.com/product/96048')
  // Desde la 673 las gradeadas van plegadas y POR CASA: el resumen enseña la
  // mejor y, al abrir, una fila por casa con sus notas.
  check('las gradeadas, plegadas, resumen la mejor', /PSA 10 2621,00 €/.test(limpio(await bloque.locator('.pv-gradeadas-resumen').innerText())), limpio(await bloque.locator('.pv-gradeadas-resumen').innerText()))
  await bloque.locator('.pv-gradeadas-cab').click()
  const gradeadas = await bloque.locator('.pv-casas .pv-casa-fila').allInnerTexts()
  check('  …y abiertas, por casa: PSA 10 y 9 (Cardmarket, €), BGS 10 y TAG 10 (eBay, $)', gradeadas.map(limpio).join(' | ') === 'PSA 10 2621,00 € 9 184,00 € | BGS 10 3500,00 US$ | TAG 10 999,00 US$', gradeadas.map(limpio).join(' | '))
  check('  …cada una con su casa, y el color de la casa', (await bloque.locator('.pv-gradeada[data-casa="PSA"]').count()) === 2 && (await bloque.locator('.pv-gradeada[data-casa="TAG"]').evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(224, 51, 140)')
  check('  …y se dice que los dólares son eBay', /Los dólares son ventas en eBay/.test(await bloque.innerText()))
  check('el texto viejo (desde, tendencia, «en cualquier idioma») ya no está', !/tendencia|cualquier idioma|Ver en Cardmarket/.test(await page.locator('#mcEditor').innerText()))
  check('el enlace a la ficha completa sigue', /Ficha completa/.test(await page.locator('#mcEdFicha').innerText()))
  // Los dos botones miden 44.
  const alto = await cm.evaluate((el) => el.getBoundingClientRect().height)
  check('los botones miden 44 px de alto', alto >= 44, String(alto))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

console.log('── 3. La ficha de la copia en alemán: sin mínimo alemán, el general ──')
{
  // La segunda tarjeta es la alemana (misma carta, otra línea).
  await page.locator('.mc-carta-foto').filter({ hasText: 'Groudon' }).nth(1).click()
  await page.waitForTimeout(900)
  const bloque = page.locator('#mcEdPrecioBloque')
  check('la cifra es 39 € (mínimo general), y el renglón lo dice', limpio(await bloque.locator('.pv-cifra').innerText()) === '39,00 €' && /cualquier idioma/.test(await bloque.locator('.pv-burbuja-principal .pv-de').innerText()), limpio(await bloque.locator('.pv-burbuja-principal .pv-de').innerText()))
  check('  …ninguna fila marcada (el alemán no tiene precio)', (await bloque.locator('.pv-fila.pv-activa').count()) === 0)
  check('  …y Cardmarket va con el alemán (language=3) y Good (minCondition=4)', /language=3/.test(await bloque.locator('.btn-cardmarket').getAttribute('href')) && /minCondition=4/.test(await bloque.locator('.btn-cardmarket').getAttribute('href')))
  await page.keyboard.press('Escape')
}

console.log('── 4. La página de la carta: el mismo bloque, y cambia con el idioma ──')
{
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const caja = page.locator('#cmPrecios')
  check('en español, 140 €', limpio(await caja.locator('.pv-cifra').innerText()) === '140,00 €', limpio(await caja.innerText()).slice(0, 200))
  check('  …con los dos botones', (await caja.locator('.btn-cardmarket').count()) === 1 && (await caja.locator('.btn-tcgplayer').count()) === 1)
  await page.selectOption('#cmIdioma', 'en')
  await page.waitForTimeout(300)
  check('en inglés, 194 € y la fila del inglés marcada', limpio(await caja.locator('.pv-cifra').innerText()) === '194,00 €' && limpio(await caja.locator('.pv-fila.pv-activa').innerText()) === 'Inglés elegido 194,00 €', limpio(await caja.locator('.pv-fila.pv-activa').innerText()))
  await page.selectOption('#cmIdioma', 'it')
  await page.waitForTimeout(300)
  check('en italiano (sin precio), el general: 39 €', limpio(await caja.locator('.pv-cifra').innerText()) === '39,00 €')
  check('las notas largas de antes no están', !/Precio general de la carta|lo ves en Cardmarket con el botón/.test(await page.locator('#cartaMercado').innerText()))
}

console.log('── 5. El logo de TCGGO, en el álbum de colecciones ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // La <img> se quita sola al no cargar (aquí se corta la red a TCGGO), así
  // que lo que se mira es el arte de fondo, que lleva la misma URL.
  const arte = page.locator('.mc-set-arte[style*="images.tcggo.com/prc.png"]')
  check('sin logo de Scrydex ni de TCGdex, se pinta el de TCGGO', (await arte.count()) >= 1)
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
