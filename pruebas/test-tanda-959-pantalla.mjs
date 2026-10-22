// Tanda 959, en pantalla: el Bulbasaur de Dark Explorers (que no salió en
// español) no enseña precio en español, ni en la ficha de Mi colección ni en
// /carta, aunque Cardmarket tenga un anuncio «en español». La de tu copia en
// español sí se enseña (la tienes en la mano).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [{ id: 'bw5', name: 'Dark Explorers', serie_id: 'bw', market: 'WEST', release_date: '2012-05-09', card_count_official: 108 }]
const carta = (id, n, nombre) => ({ id, market: 'WEST', set_id: 'bw5', local_id: String(n), name: nombre, name_es: nombre, name_en: nombre, image_path: `x/${id}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true }, tcg_sets: { id: 'bw5', name: 'Dark Explorers', serie_id: 'bw', release_date: '2012-05-09' } })
const CARTAS = [carta('bw5-1', 1, 'Bulbasaur'), carta('bw5-2', 2, 'Ivysaur')]
const PRECIOS = ['bw5-1', 'bw5-2'].map((card_id) => ({ card_id, cm_id_product: 600, cm_low: 0.02, cm_low_es: 0.02, cm_low_en: 1.1, cm_low_de: 1.99, cm_low_fr: 2.7, cm_low_it: 0.1, checked_at: '2026-10-19T10:00:00Z' }))

const browser = await chromium.launch()
async function abrir({ coleccion = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'u-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.coleccion
    window.__FAKE_PERFILES__ = [{ id: 'u-1', username: 'pingu' }]
    window.__FAKE_PRECIOS__ = d.PRECIOS
    window.__FAKE_VERSIONES__ = []
    window.__FAKE_ERAS__ = []
    window.__FAKE_IDIOMAS_SET__ = { bw5: ['de', 'en', 'fr', 'it', 'pt'] }
    window.__FAKE_IDIOMAS_MANO__ = []
    window.__FAKE_VERSION_IDIOMA__ = []
    try { localStorage.setItem('mcTocarIdioma-es', 'es') } catch {}
  }, { SETS, CARTAS, PRECIOS, coleccion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const idiomasDe = (page, sel) => page.$$eval(`${sel} .pv-tarjeta:not(.pv-tarjeta-tcg) .pv-t-cab b`, (bs) => bs.map((b) => b.textContent.trim()).join())
const textoDe = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' '))

console.log('── Mi colección: la ficha de una que no tienes ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=bw5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('#mcAlbum [data-carta="bw5-1"]').first().click()
  await page.waitForTimeout(1500)
  const ids = await idiomasDe(page, '#mcEdPrecioBloque')
  check('sin tarjeta en español', !ids.split(',').includes('ES'), ids)
  check('  …la primera es la inglesa, con su precio', ids.startsWith('EN') && /1,10/.test(await textoDe(page, '#mcEdPrecioBloque .pv-tarjeta-tuya')), await textoDe(page, '#mcEdPrecioBloque .pv-tarjeta-tuya').catch(() => ''))
  check('  …y no dice «tu idioma» de un idioma que no es el tuyo', !/tu idioma/.test(await textoDe(page, '#mcEdPrecioBloque')))
  check('  …ni sale 0,02 € en ninguna parte', !/0,02/.test(await textoDe(page, '#mcEdPrecioBloque')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ coleccion: [{ id: 'l1', user_id: 'u-1', card_id: 'bw5-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }] })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=bw5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('#mcAlbum [data-carta="bw5-2"]').first().click()
  await page.waitForTimeout(1500)
  const ids = await idiomasDe(page, '#mcEdPrecioBloque')
  check('una copia tuya en español sí enseña su precio (la tienes en la mano)', ids.startsWith('ES') && /tu copia/.test(await textoDe(page, '#mcEdPrecioBloque .pv-tarjeta-tuya')), ids)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── /carta ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/carta.html?id=bw5-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  const ids = await idiomasDe(page, '#cmPrecios')
  check('sin tarjeta en español', !ids.split(',').includes('ES'), ids)
  check('  …la primera es la inglesa', ids.startsWith('EN'), ids)
  check('  …y el idioma de la página pasa al inglés (gráfica y aviso)', (await page.locator('#cmIdioma').inputValue()) === 'en')
  check('  …sin recordarlo como tuyo', (await page.evaluate(() => localStorage.getItem('mcTocarIdioma-es'))) === 'es')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
