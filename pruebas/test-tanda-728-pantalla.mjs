// Tanda 728 — al añadir, el «+» lo dice (V4 de la lista de propuestas,
// elegida por PINGU): rebota, se vuelve una marca verde y suelta un «+1».
//
// Lo que se mira: que tras guardar desde la hoja de añadir el «+» de esa
// carta lleve la marca y el «+1»; que se vayan solos (y NO dependan de que
// la animación termine: con «menos movimiento» no corre, y se tienen que
// ir igual); y que con «menos movimiento» no se anime nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 3, card_count_total: 3 }]
  window.__FAKE_CARTAS__ = [1, 2, 3].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = []
}
for (const quieto of [false, true]) {
  console.log(`── ${quieto ? '2. Con «menos movimiento»' : '1. Normal'} ──`)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: quieto ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('#mcAlbum .mc-mas[data-anadir="xy5-2"]').first().click()
  await page.waitForTimeout(400)
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(250)
  const ya = await page.$eval('#mcAlbum .mc-mas[data-anadir="xy5-2"]', (b) => ({ hecho: b.classList.contains('mc-mas-hecho'), uno: b.querySelector('.mc-mas-uno')?.textContent || null, anima: getComputedStyle(b).animationName, fondo: getComputedStyle(b).backgroundColor })).catch(() => null)
  check('al guardar, el «+» de esa carta lleva la marca y el «+1»', ya?.hecho && ya.uno === '+1', JSON.stringify(ya))
  check(quieto ? '  …y no se anima' : '  …y rebota', quieto ? ya?.anima === 'none' : ya?.anima === 'mc-mas-rebote', ya?.anima)
  await page.waitForTimeout(1100)
  const luego = await page.$eval('#mcAlbum .mc-mas[data-anadir="xy5-2"]', (b) => ({ hecho: b.classList.contains('mc-mas-hecho'), uno: !!b.querySelector('.mc-mas-uno') })).catch(() => null)
  check('  …y al momento se va sola (también sin animación)', luego && !luego.hecho && !luego.uno, JSON.stringify(luego))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
