// Tanda 1130 — el tema del foro en el móvil (PINGU con captura del iPhone: «el
// mensaje de respuesta se queda pillado aunque subas hacia arriba y la
// cabecera se ve duplicada»).
//   · Con una cita puesta, la caja de responder deja de ir fija abajo: se
//     queda al final del tema y al subir no tapa los mensajes. Sin nada, sigue
//     fija (como antes).
//   · En una ficha (`data-detalle`) la barra pegada no sale DEBAJO de la
//     cabecera de la app: solo cuando esa cabecera se aparta al bajar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const largo = 'Buenas tardes, al querer añadir cartas que busco solo deja elegir una opción de idioma. '.repeat(4)
const MUNDO = {
  __FAKE_SESSION__: 'user-1',
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Colección', slug: 'coleccion' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Cartas que faltan, variantes y errores', author_id: 'user-2', post_count: 8 }],
  __FAKE_MENSAJES__: Array.from({ length: 8 }, (_, i) => ({ id: `post-${i + 1}`, thread_id: 'tema-1', author_id: i % 2 ? 'user-3' : 'user-2', body_html: `<p>${largo}</p>`, created_at: `2026-10-20T1${i}:00:00Z` })),
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2600)

const caja = () => page.$eval('#temaResponder', (e) => { const r = e.getBoundingClientRect(); return { pos: getComputedStyle(e).position, arriba: Math.round(r.top), abajo: Math.round(r.bottom), visor: innerHeight } })
await page.evaluate(() => scrollTo(0, 400))
await page.waitForTimeout(300)
let c = await caja()
check('sin nada, la caja va fija abajo (como antes)', c.pos === 'sticky' && c.abajo <= c.visor + 1 && c.abajo > c.visor - 200, JSON.stringify(c))

const b = page.locator('[data-citar="post-3"]')
await b.scrollIntoViewIfNeeded()
await b.tap()
await page.waitForTimeout(400)
check('al citar, sale «Citando a…»', await page.isVisible('#respondiendoA'))
c = await caja()
check('  …y la caja deja de ir fija', c.pos === 'static', JSON.stringify(c))
await page.evaluate(() => scrollTo(0, 200))
await page.waitForTimeout(300)
c = await caja()
check('  …al subir no tapa los mensajes: se queda al final del tema', c.arriba >= c.visor, JSON.stringify(c))
// Lo de la captura: «Citando a…» arriba y la caja vacía (la cita recuperada de
// un borrador, o quitada del cuadro a mano). También deja de ir fija.
await page.evaluate(() => { const c = document.getElementById('respuestaCuerpo'); c.innerHTML = ''; c.dispatchEvent(new Event('input', { bubbles: true })) })
await page.waitForTimeout(300)
c = await caja()
check('con «Citando a…» y el cuadro vacío, tampoco va fija', (await page.$eval('#respuestaCuerpo', (e) => e.classList.contains('rte-vacia'))) && (await page.isVisible('#respondiendoA')) && c.pos === 'static', JSON.stringify(c))
await page.click('#btnQuitarCita').catch(() => {})
await page.waitForTimeout(300)
const vacia = await page.$eval('#respuestaCuerpo', (e) => e.classList.contains('rte-vacia'))
if (vacia) {
  c = await caja()
  check('quitada la cita y sin nada escrito, vuelve a ir fija', c.pos === 'sticky', JSON.stringify(c))
}

// La barra pegada: el tema es una ficha (`data-detalle`).
await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2))
await page.waitForTimeout(500)
const barra = () => page.evaluate(() => {
  const b = document.getElementById('barraPegada')
  if (!b || b.classList.contains('hidden')) return null
  const r = b.getBoundingClientRect()
  return { visible: getComputedStyle(b).visibility === 'visible' && r.bottom > 0, top: Math.round(r.top) }
})
await page.evaluate(() => document.documentElement.classList.remove('bm-escondidas'))
await page.waitForTimeout(500)
let br = await barra()
check('con la cabecera de la app a la vista, la barra pegada NO sale debajo (no se duplica)', br && !br.visible, JSON.stringify(br))
await page.evaluate(() => document.documentElement.classList.add('bm-escondidas'))
await page.waitForTimeout(500)
br = await barra()
check('  …y cuando la cabecera se aparta al bajar, sale arriba del todo', br?.visible && br.top <= 1, JSON.stringify(br))
check('es una ficha (data-detalle)', await page.evaluate(() => document.documentElement.hasAttribute('data-detalle')))
check('sin errores', errores.length === 0, errores.join(' | '))
await page.screenshot({ path: '/tmp/1130-movil.png' })
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
