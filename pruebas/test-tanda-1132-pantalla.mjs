// Tanda 1132 — la web como una app en el móvil (PINGU: «la web a veces
// zoomea, sobre todo al escribir en el foro», y «si escribes algo de
// respuesta y después sales y vas arriba, la caja sube con el scroll; se
// debería empequeñecer y mantenerse abajo»).
//   · Ningún sitio donde se escribe mide menos de 16 px en el móvil (el iPhone
//     hace zoom al enfocar uno más pequeño), tampoco el cuadro del foro, y el
//     doble toque no hace zoom (`touch-action: manipulation`).
//   · La caja de responder: escribes (abierta, al final del tema), tocas
//     fuera o subes por el hilo y se RECOGE abajo, fija, con el principio de
//     lo escrito y sin scroll dentro; tocarla la abre con todo.
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

console.log('── El zoom ──')
const tam = await page.$eval('#respuestaCuerpo', (e) => parseFloat(getComputedStyle(e).fontSize))
check('el cuadro de escribir del foro mide 16 px o más (sin zoom al enfocarlo)', tam >= 16, tam)
check('el doble toque no hace zoom', (await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)) === 'manipulation')
const pequenos = await page.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), textarea, select, [contenteditable="true"]')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id || e.className || e.tagName))
check('ningún campo de la página por debajo de 16 px', !pequenos.length, pequenos.join(', '))

console.log('── La caja de responder ──')
const caja = () => page.evaluate(() => {
  const e = document.getElementById('temaResponder')
  const r = e.getBoundingClientRect()
  const c = document.getElementById('respuestaCuerpo')
  return { pos: getComputedStyle(e).position, arriba: Math.round(r.top), abajo: Math.round(r.bottom), visor: innerHeight, alto: c.clientHeight, dentro: c.scrollHeight, overflow: getComputedStyle(c).overflowY, abierta: e.querySelector('form').classList.contains('abierta') }
})
await page.locator('#respuestaCuerpo').tap()
await page.keyboard.type('Mi carta favorita es este Reshiram y Charizard GX. '.repeat(6))
await page.waitForTimeout(300)
let c = await caja()
check('escribiendo, abierta y entera (sin scroll dentro)', c.abierta && c.dentro <= c.alto + 1, JSON.stringify(c))
// Salir: tocar fuera de la caja, en el hilo.
await page.evaluate(() => document.activeElement?.blur())
await page.locator('#temaMensajes p, .foro-mensaje-texto').first().tap({ force: true }).catch(() => {})
await page.waitForTimeout(400)
c = await caja()
check('al tocar fuera se recoge (con lo escrito dentro)', !c.abierta && c.alto <= 64 && c.overflow === 'hidden', JSON.stringify(c))
check('  …y se queda fija abajo', c.pos === 'sticky' && c.abajo <= c.visor + 1 && c.abajo > c.visor - 260, JSON.stringify(c))
await page.evaluate(() => scrollTo(0, 300))
await page.waitForTimeout(400)
c = await caja()
check('al subir por el hilo sigue abajo y pequeña', c.pos === 'sticky' && c.abajo <= c.visor + 1 && c.abajo - c.arriba <= 260, JSON.stringify(c))
check('  …y lo escrito sigue ahí', /Reshiram/.test(await page.textContent('#respuestaCuerpo')))
// Abierta otra vez y subir: también se recoge (y se va el teclado).
await page.locator('#respuestaCuerpo').tap()
await page.waitForTimeout(1500)
c = await caja()
check('tocarla la abre con todo, y la vista va con ella', c.abierta && c.dentro <= c.alto + 1 && c.alto > 80 && c.arriba < c.visor && c.abajo > 0, JSON.stringify(c))
await page.evaluate(() => scrollTo(0, Math.max(0, scrollY - 600)))
await page.waitForTimeout(400)
c = await caja()
check('subir con ella abierta la recoge y la deja abajo', !c.abierta && c.pos === 'sticky' && c.abajo <= c.visor + 1, JSON.stringify(c))
check('  …sin el foco (el teclado se va)', !(await page.evaluate(() => document.getElementById('respuestaForm').contains(document.activeElement))))
check('sin errores', errores.length === 0, errores.join(' | '))
await page.screenshot({ path: '/tmp/1132-movil.png' })

console.log('── El PC no cambia ──')
{
  const pc = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await pc.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  const p = await pc.newPage()
  await p.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  await p.click('#respuestaCuerpo')
  await p.keyboard.type('Algo escrito en el PC.')
  await p.mouse.click(5, 300)
  await p.waitForTimeout(300)
  check('en el PC, tocar fuera con algo escrito no la recoge (1115)', await p.$eval('#respuestaForm', (f) => f.classList.contains('abierta')))
  await pc.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
