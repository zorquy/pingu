// Tanda 1189 — en el móvil, una conversación corta abría con el cuadro de
// escribir pegado a los mensajes y un hueco hasta la barra de abajo (PINGU,
// con captura de la app instalada). El hilo se mide con la ventana VISUAL, y
// con la app instalada iOS la deja encogida con el alto del teclado después de
// cerrarlo. Desde la 1189 la ventana visual solo cuenta cuando se está
// escribiendo. Aquí se simula esa ventana encogida sin teclado.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const una = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const q = window.__FAKE_SESSION__
  window.__FAKE_FILAS__.conversations = [{ id: 'conv-1', participants: [q, 'user-2'], updated_at: hace(2), last_message: 'Hola' }]
  window.__FAKE_FILAS__.conversation_participants = [{ conversation_id: 'conv-1', user_id: q, last_read_at: hace(1) }, { conversation_id: 'conv-1', user_id: 'user-2' }]
  window.__FAKE_FILAS__.private_messages = [{ id: 'pm-1', conversation_id: 'conv-1', sender_id: 'user-2', body: '¿Te sigue interesando el cambio?', created_at: hace(2) }]
}
// La ventana visual que deja iOS después de cerrar el teclado: 330 px menos.
const encogida = () => {
  const vv = window.visualViewport
  if (!vv) return
  Object.defineProperty(vv, 'height', { get: () => window.innerHeight - 330, configurable: true })
}
const medir = (page) => page.evaluate(() => {
  const r = (s) => document.querySelector(s)?.getBoundingClientRect()
  const comp = r('.msg-compositor'), bm = r('body > .bm')
  return { compAbajo: Math.round(comp.bottom), barra: Math.round(bm.top), hueco: Math.round(bm.top - comp.bottom) }
})

const b = await chromium.launch()
for (const [nombre, extra] of [['con la ventana de siempre', null], ['con la ventana visual encogida (iOS tras cerrar el teclado)', encogida]]) {
  console.log(`── ${nombre} ──`)
  const ctx = await contexto(b, true, 'user-1', una)
  if (extra) await ctx.addInitScript(extra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#msgBody', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const m = await medir(page)
  check('el cuadro de escribir, abajo del todo, pegado a la barra', m.hueco >= 0 && m.hueco <= 16, JSON.stringify(m))
  if (extra) {
    // Con el teclado abierto SÍ manda la ventana visual: el cuadro sube.
    await page.focus('#msgBody')
    await page.evaluate(() => window.visualViewport.dispatchEvent(new Event('resize')))
    await page.waitForTimeout(300)
    const t = await medir(page)
    check('  …y escribiendo (teclado abierto), el cuadro sube con la ventana visual', t.compAbajo < m.compAbajo - 200, JSON.stringify(t))
    // Al cerrar el teclado, vuelve abajo aunque la ventana visual siga encogida.
    await page.evaluate(() => document.activeElement.blur())
    await page.waitForTimeout(600)
    const c = await medir(page)
    check('  …y al cerrarlo, vuelve abajo', c.hueco >= 0 && c.hueco <= 16, JSON.stringify(c))
  }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
