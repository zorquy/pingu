// Tanda 1184 — el desplegable de Conversaciones se salía por abajo (PINGU, con
// captura del PC). La 1168 le quitó el scroll a la caja común de la campana y
// del sobre (`.nav-bell-dropdown`, ahora columna flexible) y se lo dio solo a
// la lista de la campana: la de los mensajes, con ocho conversaciones, pasaba
// del tope de la caja y se pintaba encima de la página, sin fondo. Las DOS
// listas se deslizan dentro de su caja y el pie se queda a la vista.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Ocho conversaciones, como la de PINGU: más de lo que cabe en 420 px.
const muchas = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const quien = window.__FAKE_SESSION__
  const otros = ['user-2', 'extra-3', 'extra-4', 'extra-5', 'extra-6', 'extra-7', 'extra-8', 'extra-9']
  window.__FAKE_FILAS__.conversations = otros.map((o, i) => ({ id: `conv-${i + 1}`, participants: [quien, o], updated_at: hace(i * 30 + 2), last_message: `Mensaje ${i + 1}` }))
  window.__FAKE_FILAS__.conversation_participants = otros.flatMap((o, i) => [{ conversation_id: `conv-${i + 1}`, user_id: quien, last_read_at: hace(i * 30 + 1) }, { conversation_id: `conv-${i + 1}`, user_id: o }])
  window.__FAKE_FILAS__.private_messages = otros.map((o, i) => ({ id: `pm-${i + 1}`, conversation_id: `conv-${i + 1}`, sender_id: o, body: `Mensaje ${i + 1}: ¿te sigue interesando el cambio que hablamos ayer por la tarde?`, created_at: hace(i * 30 + 2) }))
  // Y avisos de sobra para la campana.
  window.__FAKE_NOTIFICACIONES__ = Array.from({ length: 12 }, (_, i) => ({ recipient_id: quien, type: 'guide_comment', title: `Comentario ${i + 1} en tu guía`, link: `/guia/g${i}`, created_at: hace(i * 7 + 1) }))
}

const medir = (page, caja, lista) => page.evaluate(([caja, lista]) => {
  const d = document.getElementById(caja).getBoundingClientRect()
  const l = document.getElementById(lista)
  const filas = [...l.querySelectorAll('.nav-bell-item')]
  const ultima = filas.at(-1)?.getBoundingClientRect()
  const pie = document.getElementById(caja).lastElementChild.getBoundingClientRect()
  const fondo = getComputedStyle(document.getElementById(caja)).backgroundColor
  return {
    filas: filas.length,
    altoCaja: Math.round(d.height),
    seDesliza: getComputedStyle(l).overflowY === 'auto' && l.scrollHeight > l.clientHeight,
    // Lo que no cabe se queda DENTRO de la lista (recortado), no por debajo de la caja.
    listaDentro: l.getBoundingClientRect().bottom <= d.bottom + 1,
    ultimaFuera: ultima ? ultima.top >= l.getBoundingClientRect().bottom - 1 : null,
    pieDentro: pie.bottom <= d.bottom + 1 && pie.top >= d.top,
    fondo,
  }
}, [caja, lista])

const b = await chromium.launch()
for (const movil of [false, true]) {
  console.log(`── ${movil ? 'Móvil' : 'PC'} ──`)
  const ctx = await contexto(b, movil, 'user-1', muchas)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#navMsgBtn', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  if (await page.locator('#navMsgBtn').isVisible()) {
    await page.click('#navMsgBtn')
    await page.waitForSelector('#navMsgList .nav-bell-item', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(300)
    const m = await medir(page, 'navMsgDropdown', 'navMsgList')
    check('Conversaciones: ocho filas', m.filas === 8, JSON.stringify(m))
    check('  …la lista se desliza dentro de su caja (420 como mucho)', m.seDesliza && m.listaDentro && m.altoCaja <= 420, JSON.stringify(m))
    check('  …y «Iniciar una nueva conversación» se queda a la vista, dentro', m.pieDentro, JSON.stringify(m))
    if (!movil) await page.screenshot({ path: '/tmp/1184-mensajes-pc.png' })
    await page.keyboard.press('Escape')
  } else check('(en el móvil el sobre va en la hoja «Tú»)', true)
  if (await page.locator('#navBellBtn').isVisible()) {
    await page.click('#navBellBtn')
    await page.waitForSelector('#navBellList .nav-bell-item', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(300)
    const c = await medir(page, 'navBellDropdown', 'navBellList')
    check('la campana sigue igual: se desliza y el pie se ve', c.seDesliza && c.listaDentro && c.pieDentro, JSON.stringify(c))
  }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
