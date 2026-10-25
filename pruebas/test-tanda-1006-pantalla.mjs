// Tanda 1006 — la versión manda y el idioma se acota a ella.
//
// PINGU, con la baraja de Treecko (キモリデッキ) en coreano solo en 1.ª
// edición: «ese aviso me da igual, estoy eligiendo la primera edición, que sí
// existe en coreano… cuando eliges la Unlimited, que no te dé el idioma
// coreano, simplemente que no te deje elegir». La hoja de añadir enseña las
// versiones de todos los idiomas del set, sin aviso, y apaga los idiomas en que
// la elegida no salió.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [{ id: 'adv-treecko_ja', name: 'キモリデッキ', name_en: 'Treecko Constructed Starter Deck', serie_id: 'ADV', market: 'JP', release_date: '2003-01-31', card_count_official: 19, card_count_total: 19 }]
const CARTAS = [{ id: 'adv-treecko_ja-002', market: 'JP', set_id: 'adv-treecko_ja', local_id: '002', name: 'キモリ', name_en: 'Treecko', image_path: 'x/t', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }]
const VERSIONES = [
  { tcggo_id: -10, market: 'JP', card_id: 'adv-treecko_ja-002', set_id: 'adv-treecko_ja', etiqueta: '1st Edition', origen: 'edicion', clase: 'impresion' },
  { tcggo_id: -11, market: 'JP', card_id: 'adv-treecko_ja-002', set_id: 'adv-treecko_ja', etiqueta: 'Unlimited', origen: 'edicion', clase: 'impresion' },
]
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'user-1'
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_COLECCION__: [], __FAKE_ERAS__: [] })
  window.__FAKE_IDIOMAS_SET__ = {}
  window.__FAKE_IDIOMAS_MANO__ = [{ set_id: 'adv-treecko_ja', market: 'JP', idioma: 'ja', hay: true }, { set_id: 'adv-treecko_ja', market: 'JP', idioma: 'ko', hay: true }]
  window.__FAKE_VERSION_IDIOMA__ = [{ set_id: 'adv-treecko_ja', market: 'JP', card_id: '', variante: 'unlimited', idioma: 'ko', hay: false }]
}, { SETS, CARTAS, VERSIONES })
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"/>' }))
await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
await page.goto(`${BASE}/mi-coleccion?ver=album&set=adv-treecko_ja&catalogo=JP`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.click('#mcAlbum .mc-mas[data-anadir="adv-treecko_ja-002"]')
await page.waitForTimeout(1200)
const versiones = () => page.$$eval('#mcAdVariante option', (os) => os.map((o) => o.value))
const chips = () => page.$$eval('#mcAdIdiomas .mc-idioma-chip', (cs) => cs.map((c) => `${c.dataset.idioma}${c.disabled ? ':no' : ''}${c.classList.contains('activo') ? ':puesto' : ''}`).join())
const vs = await versiones()
check('las dos ediciones a la vista', vs.length === 2 && vs.includes('unlimited'), vs.join())
check('  …y ningún aviso', (await page.locator('#mcAdAvisoIdioma').count()) === 0)
const elegir = async (v) => {
  if (await page.locator('#mcAdElegir').isHidden()) await page.click('#mcAdVersionFija [data-vp-cambiar]')
  await page.click(`#mcAdElegir [data-vp-version="${v}"]`)
  await page.waitForTimeout(250)
}
const primera = vs.find((v) => v !== 'unlimited')
await elegir(primera)
check('con la 1.ª edición, japonés y coreano', (await chips()).replace(':puesto', '') === 'ja,ko', await chips())
await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="ko"]')
await page.waitForTimeout(200)
check('  …se elige el coreano', (await chips()) === 'ja,ko:puesto', await chips())
await elegir('unlimited')
check('con la Unlimited, el coreano apagado y el idioma pasa al japonés', (await chips()) === 'ja:puesto,ko:no', await chips())
check('  …y el coreano dice por qué', /no salió en Unlimited/.test(await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="ko"]').getAttribute('title')))
await elegir(primera)
await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="ko"]')
await page.waitForTimeout(200)
await page.click('#mcAdGuardar')
await page.waitForTimeout(900)
const linea = await page.evaluate(() => window.__TABLAS__.user_collection.find((l) => l.card_id === 'adv-treecko_ja-002'))
check('se guarda la coreana en 1.ª edición', linea?.idioma === 'ko' && linea?.variante === primera, JSON.stringify(linea))
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
