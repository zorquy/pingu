// Tanda 709 — al bajar, las barras se apartan (N3); tocar la sección en la
// que estás sube arriba (X1); y volver atrás deja la página donde estaba
// (X2). PINGU las eligió de la lista de propuestas («escojo todas»).
//
// Lo que se mira: la regla pura (cerca del principio nunca se esconde, un
// temblor no las hace bailar, subir un poco las devuelve), que en un iPhone
// la barra de arriba sube, la de abajo baja y la burbuja ocupa su sitio,
// que con el teclado fuera no se mueve nada, que tocar «Inicio» en la
// portada no recarga sino que sube, y que al volver de otra página la
// posición vuelve aunque la página tarde en crecer.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { decidirBarras, ESCONDER } from '/home/user/pingu/js/barra-movil.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La regla, sin navegador ──')
{
  const pasos = (ys, e = { escondidas: false, ancla: 0 }) => ys.reduce((est, y) => decidirBarras(est, y), e)
  check('bajando cerca del principio no se esconden nunca', !pasos([20, 60, 100, ESCONDER.desde]).escondidas)
  check('pasado el umbral y bajando un recorrido, se esconden', pasos([100, 200, 260]).escondidas)
  check('un temblor de 5 px arriba y abajo no las cambia', !pasos([205, 200, 205, 200], { escondidas: false, ancla: 200 }).escondidas && pasos([300, 296, 300, 295], { escondidas: true, ancla: 300 }).escondidas)
  const abajo = pasos([200, 400, 900])
  check('subir un poco desde el punto más bajo las devuelve', !decidirBarras(abajo, 900 - ESCONDER.recorrido - 2).escondidas)
  check('…pero bajar más mueve el ancla: subir 10 desde 1200 no basta, 20 sí', decidirBarras(decidirBarras(abajo, 1200), 1190).escondidas && !decidirBarras(decidirBarras(abajo, 1200), 1180).escondidas)
  check('volver arriba del todo las enseña siempre', !decidirBarras(abajo, 30).escondidas)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  // La portada del doble es corta; la alargamos TARDE, como cuando la
  // rejilla llega de la base después de que el navegador haya intentado
  // devolver la posición.
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const r = document.createElement('div')
      r.id = 'relleno709'
      r.style.height = '4000px'
      document.querySelector('main, .page-content, body').appendChild(r)
    }, 700)
  })
}
async function abrir(ctx, ruta) {
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores }
}
async function contexto(extra = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', ...extra })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  return ctx
}
const bajarA = async (page, y) => {
  const desde = await page.evaluate(() => window.scrollY)
  const n = 8
  for (let i = 1; i <= n; i++) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), desde + (y - desde) * i / n); await page.waitForTimeout(40) }
  await page.waitForTimeout(350)
}
const cajas = (page) => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } }
  return { esc: document.documentElement.classList.contains('bm-escondidas'), nav: r('.navbar'), bm: r('.bm'), bu: r('.bm-burbuja'), vh: window.innerHeight }
})

console.log('── 2. En un iPhone: bajar aparta, subir devuelve ──')
{
  const ctx = await contexto({ reducedMotion: 'reduce' })
  const { page, errores } = await abrir(ctx, '/index.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await bajarA(page, 900)
  const c = await cajas(page)
  check('bajando: la barra de arriba sale por arriba y la de abajo por abajo', c.esc && c.nav.bottom <= 0 && c.bm.top >= c.vh, JSON.stringify(c))
  check('  …y la burbuja baja a ocupar el sitio de la barra, sin salirse', c.bu && c.bu.bottom <= c.vh && c.bu.bottom >= c.vh - 40, JSON.stringify(c.bu))
  await bajarA(page, 860)
  const d = await cajas(page)
  check('subiendo un poco: las dos vuelven', !d.esc && d.nav.top >= 0 && d.bm.bottom === d.vh, JSON.stringify(d))
  const ent = await page.evaluate(() => { const i = document.createElement('input'); i.id = 'campo709'; i.style.position = 'fixed'; i.style.top = '200px'; document.body.appendChild(i); i.focus(); return document.activeElement === i })
  await bajarA(page, 1600)
  check('con el teclado fuera (un campo con el foco), bajar no mueve nada', ent && !(await cajas(page)).esc)
  await ctx.close()
}

console.log('── 3. Tocar la sección en la que estás sube arriba ──')
{
  const ctx = await contexto({ reducedMotion: 'reduce' })
  const { page } = await abrir(ctx, '/index.html')
  await bajarA(page, 1200)
  await bajarA(page, 1100)
  const antes = page.url()
  let recargo = false
  page.on('framenavigated', () => { recargo = true })
  await page.click('.bm a[aria-current="page"]')
  await page.waitForTimeout(400)
  check('tocar «Inicio» en la portada no recarga y deja la página arriba del todo', !recargo && page.url() === antes && (await page.evaluate(() => window.scrollY)) === 0)
  const destino = await page.$eval('.bm a:nth-child(2)', (a) => a.getAttribute('href'))
  await page.click('.bm a:nth-child(2)')
  await page.waitForTimeout(800)
  check('tocar otra sección sí navega', page.url().includes(destino.replace(/^\//, '')), page.url())
  await ctx.close()
}

console.log('── 4. Volver atrás deja la página donde estaba ──')
{
  const ctx = await contexto()
  const { page } = await abrir(ctx, '/index.html')
  await page.evaluate(() => window.scrollTo({ top: 2100, behavior: 'instant' }))
  await page.waitForTimeout(200)
  await page.evaluate(() => { location.href = '/noticias.html' })
  await page.waitForTimeout(1500)
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const y = await page.evaluate(() => window.scrollY)
  check('de vuelta en la portada, a la altura de antes aunque la página creció después', Math.abs(y - 2100) < 60, `scrollY=${y}`)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
