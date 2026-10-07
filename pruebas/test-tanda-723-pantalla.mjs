// Tanda 723 — las pequeñas de teclado y de velocidad: el teclado adecuado
// en cada campo (X5) y precargar la página al posar el dedo (X17). La X12
// (el borrador del foro se guarda) ya existía: tema nuevo y respuesta.
//
// Lo que se mira: que TODA caja de búsqueda pida la tecla «Buscar» y todo
// campo numérico el teclado numérico (en el HTML y en lo que pinta el JS);
// la regla de qué se puede precargar; y en el navegador, los dos caminos:
// con reglas de especulación (Chrome) se declaran y no se hace nada a mano,
// y sin ellas un toque o un ratón posado meten su `<link rel="prefetch">`.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { sePuedePrecargar } = await import(`${RAIZ}/js/precarga.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. El teclado de cada campo (X5) ──')
{
  const ficheros = [
    ...readdirSync(RAIZ).filter((f) => f.endsWith('.html')),
    ...readdirSync(`${RAIZ}/js`).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(`${RAIZ}/js/mi-coleccion`).filter((f) => f.endsWith('.js')).map((f) => `js/mi-coleccion/${f}`),
    ...readdirSync(`${RAIZ}/js/torneos`).filter((f) => f.endsWith('.js')).map((f) => `js/torneos/${f}`),
  ]
  const sinBuscar = []
  const sinNumerico = []
  let busquedas = 0
  for (const f of ficheros) {
    const t = readFileSync(`${RAIZ}/${f}`, 'utf8')
    for (const m of t.matchAll(/<input[^>]*type="search"[^>]*>/g)) {
      busquedas++
      if (!/enterkeyhint="search"/.test(m[0])) sinBuscar.push(f)
    }
    for (const m of t.matchAll(/<input[^>]*type="number"[^>]*>/g)) if (!/inputmode=/.test(m[0])) sinNumerico.push(f)
  }
  check('el barrido llega a las cajas de búsqueda', busquedas > 20, String(busquedas))
  check('toda caja de búsqueda pide la tecla «Buscar»', sinBuscar.length === 0, [...new Set(sinBuscar)].join(', '))
  check('todo campo numérico, el teclado numérico', sinNumerico.length === 0, [...new Set(sinNumerico)].join(', '))
}

console.log('── 2. Qué se puede precargar ──')
const O = 'https://pokedoc.es'
const AQUI = 'https://pokedoc.es/foro.html'
check('una página del sitio, sí', sePuedePrecargar('/cartas', O, AQUI))
check('fuera del sitio, no', !sePuedePrecargar('https://cardmarket.com/x', O, AQUI))
check('/admin y /auth, no', !sePuedePrecargar('/admin/', O, AQUI) && !sePuedePrecargar('/auth.html?volver=/', O, AQUI))
check('la misma página con otra almohadilla, no', !sePuedePrecargar('/foro.html#arriba', O, AQUI))
check('un fichero (imagen, CSV), no', !sePuedePrecargar('/assets/x.png', O, AQUI) && !sePuedePrecargar('/exportar.csv', O, AQUI))

const browser = await chromium.launch()
async function abrir({ sinReglas = false, movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((sin) => {
    window.__FAKE_SESSION__ = 'none'
    if (sin) HTMLScriptElement.supports = () => false
  }, sinReglas)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const precargas = (page) => page.$$eval('link[rel="prefetch"]', (ls) => ls.map((l) => new URL(l.href).pathname))

console.log('── 3. Con reglas de especulación (Chrome) ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const reglas = await page.$eval('script[type="speculationrules"]', (s) => JSON.parse(s.textContent)).catch(() => null)
  check('se declaran: precargar al posarse, lo del sitio', reglas?.prefetch?.[0]?.eagerness === 'moderate' && JSON.stringify(reglas).includes('/admin'), JSON.stringify(reglas))
  await page.hover('footer a[href="/foro.html"]')
  await page.waitForTimeout(300)
  check('  …y no se mete nada a mano (lo hace el navegador)', (await precargas(page)).length === 0)
  await ctx.close()
}

console.log('── 4. Sin ellas (Safari): a mano ──')
{
  const { page, ctx } = await abrir({ sinReglas: true })
  check('no se declaran reglas', (await page.locator('script[type="speculationrules"]').count()) === 0)
  await page.hover('footer a[href="/foro.html"]')
  await page.waitForTimeout(300)
  check('posar el ratón en un enlace lo precarga', (await precargas(page)).includes('/foro.html'), JSON.stringify(await precargas(page)))
  await page.hover('footer a[href="/foro.html"]')
  await page.mouse.move(0, 0)
  await page.hover('footer a[href="/foro.html"]')
  await page.waitForTimeout(300)
  check('  …una vez, por mucho que se pase', (await precargas(page)).filter((p) => p === '/foro.html').length === 1)
  await ctx.close()
  const m = await abrir({ sinReglas: true, movil: true })
  const cdp = await m.ctx.newCDPSession(m.page)
  const sitio = await m.page.$eval('.bm a[href]:not([aria-current])', (a) => { const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, href: new URL(a.href).pathname } })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sitio.x, y: sitio.y }] })
  await m.page.waitForTimeout(150)
  check('en el móvil, POSAR el dedo (antes de soltar) ya lo precarga', (await precargas(m.page)).includes(sitio.href), `${sitio.href} → ${JSON.stringify(await precargas(m.page))}`)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await m.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
