// Tanda 692 — el «+» de una casilla de versión añade ESA versión, y la
// Pokédex de un Pokémon tiene «variantes separadas» como una expansión.
//
// PINGU, con dos capturas: «añadiendo las variantes de reverse y así, no
// se añade cada variante. Debería añadirse. Y en la Dex también solo sale
// la carta única y no salen las variantes; deberías meter el filtro de
// las variantes también en la Dex». Lo primero era el «+» de la casilla
// reverse abriendo el diálogo con «normal» puesta (y, con la normal ya en
// la colección, por la cara de «ya la tienes → añadir más»): la reverse
// entraba como una normal más, «×2», sin error.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = ({ split }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  localStorage.setItem('mc-split', split ? '1' : '0')
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', dex_ids: [13], variants: { normal: true, reverse: true } },
    { id: 'xy5-2', market: 'WEST', set_id: 'xy5', local_id: '2', name: 'Kakuna', name_es: 'Kakuna', image_path: 'x/3', rarity: 'Uncommon', category: 'Pokemon', dex_ids: [14], variants: { normal: true, reverse: true } },
  ]
  // El Weedle NORMAL ya está en la colección; la reverse no.
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
}
async function abrir(ruta, { split = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla, { split })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await page.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com/, (r) => r.abort())
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const dialogo = (page) => page.locator('#mcAnadirDialogo')

console.log('── 1. En una expansión con las variantes separadas, el «+» de la reverse añade una reverse ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const masReverse = page.locator('[data-anadir="xy5-1"][data-variante="reverse"]')
  check('la casilla de la reverse lleva su «+» con la versión, y su rótulo la nombra', (await masReverse.count()) === 1 && /Weedle \(Reverse holo\)/.test(await masReverse.getAttribute('aria-label')), await masReverse.getAttribute('aria-label'))
  await masReverse.click()
  await page.waitForTimeout(600)
  check('se abre el diálogo DIRECTO en el formulario (no en «ya la tienes»), aunque la normal esté en la colección', (await dialogo(page).evaluate((d) => d.open)) && (await page.locator('#mcAdForm').isVisible()) && !(await page.locator('#mcAdYa').isVisible()))
  check('  …con la versión REVERSE puesta', (await page.inputValue('#mcAdVariante')) === 'reverse', await page.inputValue('#mcAdVariante'))
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('al guardar, la casilla de la reverse pasa a «la tengo» y la normal sigue con UNA', (await page.locator('#mcAlbum .mc-bolsillo.tengo').count()) === 2 && (await page.locator('#mcAlbum .mc-cantidad').count()) === 0, String(await page.locator('#mcAlbum .mc-bolsillo.tengo').count()))
  // El «+» de la NORMAL, que ya tienes: también directo al formulario, con normal.
  await page.locator('[data-anadir="xy5-2"][data-variante="normal"]').click()
  await page.waitForTimeout(600)
  check('el «+» de una normal abre con «normal» puesta', (await page.locator('#mcAdForm').isVisible()) && (await page.inputValue('#mcAdVariante')) === 'normal')
  await page.keyboard.press('Escape')
  await page.close()
}

console.log('── 2. Con las variantes JUNTAS, el «+» va como antes: sin versión, y «ya la tienes» si la tienes ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album&set=xy5', { split: false })
  const mas = page.locator('[data-anadir="xy5-1"]')
  check('el «+» no lleva versión', (await mas.count()) === 1 && (await mas.getAttribute('data-variante')) === null)
  await mas.click()
  await page.waitForTimeout(600)
  check('y como la tienes, abre en «ya en tu colección»', (await page.locator('#mcAdYa').isVisible()) && !(await page.locator('#mcAdForm').isVisible()))
  await page.keyboard.press('Escape')
  await page.close()
}

console.log('── 3. La Pokédex de un Pokémon, con las variantes separadas ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=pokedex')
  await page.evaluate(() => document.querySelector('button[data-dex="13"]')?.scrollIntoView())
  await page.locator('button[data-dex="13"]').first().click({ force: true })
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('hay chip de variantes, encendido y rotulado «separadas» (la misma memoria que la expansión)', (await page.locator('#pdxVariantes').count()) === 1 && (await page.getAttribute('#pdxVariantes', 'aria-pressed')) === 'true' && limpio(await page.locator('#pdxVariantes').innerText()) === 'Variantes separadas')
  const casillas = await page.$$eval('.pdx-carta', (es) => es.map((e) => `${e.dataset.carta}:${e.dataset.version}:${e.classList.contains('tengo') ? 'tengo' : 'falta'}`))
  check('el Weedle sale DOS veces: la normal (tuya) y la reverse (te falta)', casillas.join(',') === 'xy5-1:normal:tengo,xy5-1:reverse:falta', casillas.join(','))
  check('  …cada una con su chapa de versión y la reverse con su velo', (await page.locator('.pdx-carta .mc-chapa-variante').count()) === 2 && limpio(await page.locator('.pdx-carta[data-version="reverse"] .mc-chapa-variante').innerText()) === 'RH Reverse holo' && (await page.locator('.pdx-carta[data-version="reverse"] .mc-velo-reverse').count()) === 1)
  check('  …y con su «+» de esa versión', (await page.locator('.pdx-carta[data-version="reverse"] [data-anadir="xy5-1"][data-variante="reverse"]').count()) === 1)
  await page.locator('#pdxSoloFaltan').click({ force: true })
  await page.waitForTimeout(800)
  const faltan = await page.$$eval('.pdx-carta', (es) => es.map((e) => `${e.dataset.carta}:${e.dataset.version}`))
  check('«solo las que me faltan» deja la reverse', faltan.join(',') === 'xy5-1:reverse', faltan.join(','))
  await page.locator('.pdx-carta [data-anadir="xy5-1"][data-variante="reverse"]').click()
  await page.waitForTimeout(600)
  check('el «+» de la Pokédex abre el diálogo con la reverse puesta, y no la ficha', (await dialogo(page).evaluate((d) => d.open)) && (await page.inputValue('#mcAdVariante')) === 'reverse' && /ver=pokedex/.test(page.url()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.locator('#pdxSoloFaltan').click({ force: true })
  await page.waitForTimeout(500)
  await page.locator('#pdxVariantes').click({ force: true })
  await page.waitForTimeout(800)
  check('pulsar el chip las junta: una casilla, rótulo «juntas», y la memoria cambia', (await page.locator('.pdx-carta').count()) === 1 && limpio(await page.locator('#pdxVariantes').innerText()) === 'Variantes juntas' && (await page.evaluate(() => localStorage.getItem('mc-split'))) === '0')
  check('  …y la casilla junta también lleva su «+», sin versión', (await page.locator('.pdx-carta [data-anadir="xy5-1"]').count()) === 1 && (await page.locator('.pdx-carta [data-anadir="xy5-1"]').getAttribute('data-variante')) === null)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
