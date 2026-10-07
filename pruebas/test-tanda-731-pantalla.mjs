// Tanda 731 — pellizcar la rejilla cambia las columnas entre 2, 3 y 4, y
// se recuerda (X3 de la lista de propuestas, elegida por PINGU).
//
// Lo que se mira: la regla (abrir es una columna menos, cerrar una más,
// sin salirse de 2 a 4, y un pellizco corto no cambia nada); que con dos
// dedos de verdad (CDP) la rejilla pase de verdad a esas columnas; que se
// recuerde al volver; y que en el escritorio no se toque nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { columnasTrasPellizco } = await import(`${RAIZ}/js/mi-coleccion/pellizco.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La regla ──')
check('abrir: una columna menos', columnasTrasPellizco(3, 1.5) === 2)
check('cerrar: una más', columnasTrasPellizco(3, 0.6) === 4)
check('sin salirse: ni menos de 2 ni más de 4', columnasTrasPellizco(2, 2) === 2 && columnasTrasPellizco(4, 0.3) === 4)
check('un pellizco corto no cambia nada', columnasTrasPellizco(3, 1.1) === 3 && columnasTrasPellizco(3, 0.9) === 3)

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 12, card_count_total: 12 }]
  window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, image_path: `x/${i + 1}`, variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = []
}
async function abrir(movil = true, ctx = null) {
  ctx = ctx || await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx }
}
const columnas = (page) => page.$eval('#mcAlbum .mc-album-cuadricula, #mcAlbum .mc-album-rejilla', (r) => getComputedStyle(r).gridTemplateColumns.split(' ').length)
async function pellizcar(cdp, page, de, a) {
  // En medio de la REJILLA, y con ella a la vista: si el toque cae fuera,
  // no hay pellizco que medir.
  const c = await page.$eval('#mcAlbum .mc-album-cuadricula, #mcAlbum .mc-album-rejilla', (r) => { r.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: Math.max(b.top + 40, Math.min(b.bottom - 40, innerHeight / 2)) } })
  const dedos = (d) => [{ x: c.x - d / 2, y: c.y, id: 1 }, { x: c.x + d / 2, y: c.y, id: 2 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedos(de) })
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedos(de + ((a - de) * i) / 6) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
}

console.log('── 2. En un iPhone, con dos dedos ──')
{
  const { page, ctx } = await abrir()
  const cdp = await ctx.newCDPSession(page)
  const antes = await columnas(page)
  await pellizcar(cdp, page, 80, 200)
  const abierto = await columnas(page)
  check('abrir los dedos: una columna menos', abierto === Math.max(2, antes - 1), `${antes} → ${abierto}`)
  await pellizcar(cdp, page, 200, 60)
  const cerrado = await columnas(page)
  check('cerrarlos: una más', cerrado === Math.min(4, abierto + 1), `${abierto} → ${cerrado}`)
  await pellizcar(cdp, page, 200, 50)
  const n = await columnas(page)
  check('  …y no pasa de cuatro', n <= 4, String(n))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('al volver, se acuerda', (await columnas(page)) === n, `${n} / ${await columnas(page)}`)
  await ctx.close()
}

console.log('── 3. En el escritorio, como siempre ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => { try { localStorage.setItem('mc-columnas', '2') } catch {} })
  const { page } = await abrir(false, ctx)
  check('lo elegido en el móvil no aprieta la rejilla del escritorio', (await columnas(page)) > 4 && !(await page.$eval('#mcAlbum', (r) => r.dataset.columnas)))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
