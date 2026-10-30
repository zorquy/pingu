// Tanda 1115 — la caja de responder del foro crece con lo que escribes
// (PINGU, con seis citas: «tengo que scrollear para ver lo que estoy
// escribiendo… no tiene sentido que scrollees»).
//   · En el PC, sin tope: lo escrito se ve entero, con el foco y sin él.
//   · Con algo escrito, tocar fuera no la recoge (se iba a 96 px).
//   · En el móvil tampoco hay tope: con algo dentro deja de ir fija abajo.
//   · La PRIMERA cita también se ve en la caja («la primera nunca está
//     citada»), y al publicar no sale dos veces: va enlazada arriba.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const largo = 'Mi carta favorita es sin duda este Reshiram & Charizard GX por el significado que tiene para mí. Los que me seguís en redes sabéis que tengo una buena colección. '.repeat(2)
const MUNDO = {
  __FAKE_SESSION__: 'user-1',
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Dudas', slug: 'dudas' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Hilo de prueba', author_id: 'user-2', post_count: 6 }],
  __FAKE_MENSAJES__: Array.from({ length: 6 }, (_, i) => ({ id: `post-${i + 1}`, thread_id: 'tema-1', author_id: i % 2 ? 'user-3' : 'user-2', body_html: `<p>${largo}</p>`, created_at: `2026-10-20T1${i}:00:00Z` })),
}
const browser = await chromium.launch()
async function abrir(movil) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  for (let i = 1; i <= 6; i++) {
    const b = page.locator(`[data-citar="post-${i}"]`)
    await b.scrollIntoViewIfNeeded()
    if (movil) await b.tap(); else await b.click()
    await page.waitForTimeout(250)
  }
  return { ctx, page, errores }
}
const medir = (page) => page.$eval('#respuestaCuerpo', (e) => ({ alto: e.clientHeight, contenido: e.scrollHeight, ancho: e.clientWidth, abierta: e.closest('form').classList.contains('abierta') }))

console.log('── PC ──')
{
  const { ctx, page, errores } = await abrir(false)
  await page.click('#respuestaCuerpo')
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Y yo digo que la mía es otra. '.repeat(6))
  const m = await medir(page)
  check('con seis citas, lo escrito se ve entero (sin scroll dentro)', m.contenido <= m.alto + 1 && m.alto > 400, JSON.stringify(m))
  await page.mouse.click(5, 300)
  await page.waitForTimeout(300)
  const f = await medir(page)
  check('tocar fuera con algo escrito no la recoge', f.abierta && f.contenido <= f.alto + 1, JSON.stringify(f))
  const citas = await page.$$eval('#respuestaCuerpo blockquote', (qs) => qs.map((q) => q.textContent.slice(0, 40)))
  check('las seis citas están en la caja, la primera la primera', citas.length === 6 && /Mi carta favorita/.test(citas[0]), JSON.stringify(citas))
  await page.click('#btnResponder')
  await page.waitForTimeout(1500)
  const nuevo = await page.evaluate(() => window.__TABLAS__.forum_posts.find((m) => m.author_id === 'user-1'))
  check('al publicar: enlazada a la primera, y su texto no va repetido en el cuerpo', nuevo?.reply_to_id === 'post-1' && (nuevo.body_html.match(/<blockquote/g) || []).length === 5 && /Y yo digo/.test(nuevo.body_html), JSON.stringify(nuevo)?.slice(0, 300))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('#respuestaCuerpo')
  await page.mouse.click(5, 300)
  await page.waitForTimeout(300)
  check('vacía, tocar fuera sí la recoge (como antes)', !(await medir(page)).abierta)
  await ctx.close()
}

console.log('── Móvil ──')
{
  const { ctx, page, errores } = await abrir(true)
  const m = await medir(page)
  check('citar sin enfocar: las seis en la caja y a la vista enteras', (await page.locator('#respuestaCuerpo blockquote').count()) === 6 && m.contenido <= m.alto + 1, JSON.stringify(m))
  await page.locator('#respuestaCuerpo').tap()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Y la mía. '.repeat(4))
  const f = await medir(page)
  check('con el foco, tampoco hay scroll dentro', f.contenido <= f.alto + 1 && f.alto > 400, JSON.stringify(f))
  check('  …y no va fija abajo (más alta que la pantalla, no se vería entera)', (await page.$eval('#temaResponder', (e) => getComputedStyle(e).position)) === 'static')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('vacía, sigue fija abajo como un chat', (await page.$eval('#temaResponder', (e) => getComputedStyle(e).position)) === 'sticky')
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
