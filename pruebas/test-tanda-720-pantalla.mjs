// Tanda 720 — la ficha con el dedo (N5) y la carta que crece desde su
// hueco (N6), de la lista de propuestas, elegidas por PINGU.
//
// Lo que se mira: la regla del gesto (de lado cambia de carta solo si es
// claramente de lado; abajo cierra solo desde arriba); que en un iPhone,
// con un dedo DE VERDAD (eventos táctiles por CDP), deslizar pase a la
// carta de al lado y se pare en la última, que un temblor no haga nada,
// que arrastrar abajo cierre y arriba abra la hoja entera; y que abrir
// desde la rejilla use una transición de vista —y no con «menos
// movimiento»— sin dejar nombres puestos al acabar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { decidirGesto } = await import(`${RAIZ}/js/mi-coleccion/gestos-ficha.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La regla del gesto ──')
check('a la izquierda: la siguiente', decidirGesto({ dx: -90, dy: 10 }) === 'siguiente')
check('a la derecha: la anterior', decidirGesto({ dx: 90, dy: -12 }) === 'anterior')
check('un temblor no es nada', decidirGesto({ dx: -30, dy: 8 }) === null)
check('en diagonal (leyendo) no cambia de carta', decidirGesto({ dx: -80, dy: 60 }) === null)
check('abajo desde arriba: cerrar', decidirGesto({ dx: 4, dy: 140 }) === 'cerrar')
check('  …pero abajo a media hoja es leer', decidirGesto({ dx: 4, dy: 140 }, { arriba: false }) === null)
check('arriba: la hoja entera', decidirGesto({ dx: 0, dy: -80 }) === 'subir')

const browser = await chromium.launch()
const semilla = ({ quieto }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 3, card_count_total: 3 }]
  window.__FAKE_CARTAS__ = [1, 2, 3].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
  // Se cuentan las transiciones de vista que se piden.
  window.__TRANSICIONES__ = 0
  if (document.startViewTransition) {
    const original = document.startViewTransition.bind(document)
    document.startViewTransition = (fn) => { window.__TRANSICIONES__++; return original(fn) }
  }
}
async function abrir({ quieto = false } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', reducedMotion: quieto ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(semilla, { quieto })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const cdp = await ctx.newCDPSession(page)
  return { page, ctx, errores, cdp }
}
// Un dedo de verdad: tocar, moverse en pasos y soltar.
async function arrastrar(cdp, desde, hasta, pasos = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: desde.x, y: desde.y }] })
  for (let i = 1; i <= pasos; i++) {
    const x = desde.x + ((hasta.x - desde.x) * i) / pasos
    const y = desde.y + ((hasta.y - desde.y) * i) / pasos
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
const sitio = (page) => page.textContent('#mcEdSitio')
const centroDeLaFoto = (page) => page.$eval('#mcEdFoto', (f) => { const r = f.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 120)) } })
const abrirLaSegunda = async (page) => {
  await page.locator('#mcAlbum [data-carta="xy5-2"]').first().click()
  await page.waitForTimeout(900)
}

console.log('── 2. En un iPhone, con el dedo ──')
{
  const { page, ctx, errores, cdp } = await abrir()
  await abrirLaSegunda(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la ficha se abre en la segunda: «2 de 3»', (await page.evaluate(() => document.getElementById('mcEditor').open)) && (await sitio(page)) === '2 de 3', await sitio(page))
  check('se abrió con una transición de vista (la carta crece)', (await page.evaluate(() => window.__TRANSICIONES__)) === 1)
  await page.waitForTimeout(600)
  check('  …y al acabar no queda ningún nombre de transición puesto', await page.evaluate(() => [...document.querySelectorAll('img')].every((i) => !i.style.viewTransitionName)))
  let c = await centroDeLaFoto(page)
  await arrastrar(cdp, c, { x: c.x - 150, y: c.y + 6 })
  await page.waitForTimeout(800)
  check('deslizar a la izquierda: la tercera', (await sitio(page)) === '3 de 3', await sitio(page))
  c = await centroDeLaFoto(page)
  await arrastrar(cdp, c, { x: c.x - 150, y: c.y })
  await page.waitForTimeout(600)
  check('  …y en la última, deslizar más no hace nada', (await sitio(page)) === '3 de 3', await sitio(page))
  await arrastrar(cdp, c, { x: c.x + 150, y: c.y - 6 })
  await page.waitForTimeout(800)
  check('a la derecha: vuelve a la segunda', (await sitio(page)) === '2 de 3', await sitio(page))
  await arrastrar(cdp, c, { x: c.x - 30, y: c.y + 4 })
  await page.waitForTimeout(500)
  check('un temblor no cambia de carta', (await sitio(page)) === '2 de 3', await sitio(page))
  await arrastrar(cdp, c, { x: c.x, y: c.y - 120 })
  await page.waitForTimeout(400)
  const entera = await page.evaluate(() => document.getElementById('mcEditor').classList.contains('mc-editor-entera'))
  check('arrastrar hacia arriba abre la hoja entera', entera)
  await page.evaluate(() => { document.getElementById('mcEditor').scrollTop = 0 })
  c = await centroDeLaFoto(page)
  await arrastrar(cdp, c, { x: c.x, y: c.y + 220 })
  await page.waitForTimeout(600)
  const cerrada = await page.evaluate(() => ({ open: document.getElementById('mcEditor').open, entera: document.getElementById('mcEditor').classList.contains('mc-editor-entera'), transform: document.getElementById('mcEditor').style.transform }))
  check('arrastrar hacia abajo la cierra (y la deja como estaba)', !cerrada.open && !cerrada.entera && !cerrada.transform, JSON.stringify(cerrada))
  await ctx.close()
}

console.log('── 3. Con «menos movimiento», sin transición ──')
{
  const { page, ctx, errores } = await abrir({ quieto: true })
  await abrirLaSegunda(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la ficha se abre igual, sin transición de vista', (await page.evaluate(() => document.getElementById('mcEditor').open)) && (await page.evaluate(() => window.__TRANSICIONES__)) === 0)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
