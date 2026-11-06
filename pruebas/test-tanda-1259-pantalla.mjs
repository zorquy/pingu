// Tanda 1259 — en la app instalada, subir por una conversación recargaba la
// página (PINGU: «intento ir para arriba y se recarga… aparece la bolita de
// cuando intentas recargar»). El tirón de refrescar solo miraba si la PÁGINA
// estaba arriba, y en una conversación la página está siempre arriba: los
// mensajes se deslizan en su propia caja. Ahora (1) en una conversación no hay
// tirón (se actualiza sola, en tiempo real) y (2) en cualquier página, si el
// dedo empieza en una caja que se desliza por dentro y no está arriba del
// todo, el gesto es de la caja. En otras páginas el tirón sigue recargando.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const instalada = () => {
  const original = window.matchMedia.bind(window)
  window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : original(q))
}
const larga = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const q = window.__FAKE_SESSION__
  window.__FAKE_FILAS__.conversations = [{ id: 'conv-1', participants: [q, 'user-2'], updated_at: hace(1), last_message: 'Hola' }]
  window.__FAKE_FILAS__.conversation_participants = [{ conversation_id: 'conv-1', user_id: q, last_read_at: hace(0) }, { conversation_id: 'conv-1', user_id: 'user-2' }]
  window.__FAKE_FILAS__.private_messages = Array.from({ length: 40 }, (_, i) => ({ id: `pm-${i}`, conversation_id: 'conv-1', sender_id: i % 2 ? q : 'user-2', body: `Mensaje número ${i} con algo de texto para que ocupe una línea o dos`, created_at: hace(80 - i) }))
}

// Tirar hacia abajo con el dedo: de y=250 a y=250+dy, en pasos de 20.
async function tirar(page, cdp, dy, x = 200, y = 250) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= dy / 20; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + i * 20 }] })
  const marca = await page.evaluate(() => { const m = document.querySelector('.bm-refrescar'); return m ? { lista: m.classList.contains('lista'), tirado: m.style.getPropertyValue('--tirado') } : null })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  return marca
}

const b = await chromium.launch()
console.log('── 1. Una conversación, en la app instalada ──')
{
  const ctx = await contexto(b, true, 'user-1', larga)
  await ctx.addInitScript(instalada)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#msgBody', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(2000)
  check('está el tirón de refrescar (la app instalada)', (await page.locator('.bm-refrescar').count()) === 1)
  await page.evaluate(() => { window.__antes = true })
  const cdp = await ctx.newCDPSession(page)
  const m = await tirar(page, cdp, 140)
  await page.waitForTimeout(1500)
  check('tirar hacia abajo en los mensajes no enseña la bola', !m?.lista && !m?.tirado, JSON.stringify(m))
  check('  …ni recarga la página', await page.evaluate(() => window.__antes === true))
  check('  …y el navegador tampoco recarga con su gesto (overscroll)', (await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)) === 'none')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Una caja que se desliza por dentro, en otra página ──')
{
  const { dentroDeCajaQueSube } = await import(`${RAIZ}/js/tirar-refrescar.js`)
  const ctx = await contexto(b, true, 'user-1', null)
  await ctx.addInitScript(instalada)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const c = document.createElement('div')
    c.id = 'cajaPrueba'
    c.style.cssText = 'position:fixed;top:120px;left:0;right:0;height:300px;overflow-y:auto;z-index:50;background:#fff'
    c.innerHTML = '<div style="height:2000px">lista larga</div>'
    document.body.appendChild(c)
    c.scrollTop = 600
    window.scrollTo(0, 0)
    window.__antes = true
  })
  const cdp = await ctx.newCDPSession(page)
  const m = await tirar(page, cdp, 140)
  await page.waitForTimeout(1200)
  check('subiendo por una caja que no está arriba: ni bola ni recarga', !m?.lista && (await page.evaluate(() => window.__antes === true)), JSON.stringify(m))
  // Y fuera de la caja, desde arriba de la página, el tirón sigue recargando.
  await page.evaluate(() => document.getElementById('cajaPrueba').remove())
  const r = await Promise.all([page.waitForNavigation({ timeout: 4000 }).catch(() => null), tirar(page, cdp, 140)])
  await page.waitForTimeout(1500)
  check('en la página, desde arriba, el tirón sigue recargando', r[1]?.lista && (await page.evaluate(() => window.__antes !== true)), JSON.stringify(r[1]))
  check('la regla: una caja con scroll por dentro y no arriba', typeof dentroDeCajaQueSube === 'function')
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
