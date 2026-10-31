// Tanda 1146 — de la ronda W de mejoras: Buscar con caras (W2) y la barra del
// trato en Mensajes (W3).
//   W2: en «Todo» las cartas van en rejilla de fotos con su precio y su marca,
//       guías/noticias/temas con su icono de color, la gente con el punto verde,
//       los filtros en una fila que se desliza y, en el PC, dos columnas.
//   W3: «Proponer un cambio» y «Ya nos cambiamos» en una fila fina; la
//       explicación sale al tocar; con un trato en marcha, su tira arriba.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()
const enLinea = () => {
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
  const F = (window.__FAKE_FILAS__ ||= {})
  F.online_now = [{ token: 't1', user_id: 'user-2', last_seen: hace(0.05) }]
}

console.log('── 1. Buscar en el móvil ──')
{
  const ctx = await contexto(b, true, 'user-1', enLinea)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 150)))
  await page.goto(`${BASE}/buscar?q=pi`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bs-rejilla .bs-baldosa', { timeout: 8000 }).catch(() => {})
  const baldosas = await page.$$eval('.bs-rejilla .bs-baldosa', (as) => as.map((a) => ({ href: a.getAttribute('href'), foto: !!a.querySelector('.bs-baldosa-foto[data-marca-carta] img.bs-foto'), w: a.getBoundingClientRect().width })))
  check('en «Todo», las cartas en rejilla de fotos', baldosas.length >= 2 && baldosas.every((x) => x.foto), JSON.stringify(baldosas))
  check('  …tres por fila en el móvil', baldosas.length && baldosas[0].w < 130, baldosas[0]?.w)
  check('  …cada una abre su pop-up (enlace a /cartas?ver=buscar)', baldosas.every((x) => x.href?.includes('ver=buscar') && x.href.includes('carta=')))
  await page.waitForTimeout(800)
  check('  …con su marca de «la tienes» o «la quiero»', (await page.$$eval('.bs-baldosa-foto', (fs) => fs.filter((f) => f.querySelector('.mc-tengo, [class*="marca"], [class*="quiero"]')).length)) >= 1, await page.$eval('.bs-rejilla', (r) => r.innerHTML.slice(0, 300)))
  const chips = await page.$eval('#bsChips', (c) => ({ wrap: getComputedStyle(c).flexWrap, alto: c.getBoundingClientRect().height, desliza: c.scrollWidth > c.clientWidth }))
  check('los filtros, en UNA fila que se desliza', chips.wrap === 'nowrap' && chips.alto < 60 && chips.desliza, JSON.stringify(chips))
  // La gente, con el punto verde.
  await page.goto(`${BASE}/buscar?q=misty`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bs-avatar[data-en-linea="user-2"]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  check('Misty sale con su punto verde', await page.$eval('.bs-avatar[data-en-linea="user-2"]', (a) => a.classList.contains('avatar-conectado')).catch(() => false))
  // Guías y temas con su icono de color.
  await page.goto(`${BASE}/buscar?q=charizard`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bs-icono-guia', { timeout: 8000 }).catch(() => {})
  const iconos = await page.$$eval('.bs-icono-guia, .bs-icono-tema', (is) => is.map((i) => [i.className, getComputedStyle(i).backgroundColor, getComputedStyle(i).color]))
  check('la guía y el tema, cada uno con su color (y distinto entre ellos)', iconos.length >= 2 && new Set(iconos.map((i) => i[2])).size >= 2 && iconos.every((i) => i[1] !== 'rgba(0, 0, 0, 0)'), JSON.stringify(iconos))
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  check('sin desbordar de lado', ancho)
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── 2. Buscar en el PC ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/buscar?q=charizard`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bs-todo .bs-col', { timeout: 8000 }).catch(() => {})
  const cols = await page.$$eval('.bs-todo > .bs-col', (cs) => cs.map((c) => ({ x: Math.round(c.getBoundingClientRect().left), cartas: !!c.querySelector('.bs-rejilla'), guias: !!c.querySelector('.bs-icono-guia') })))
  check('«Todo» a dos columnas: cartas a la izquierda, lo demás a la derecha', cols.length === 2 && cols[0].cartas && cols[1].guias && cols[1].x > cols[0].x + 300, JSON.stringify(cols))
  const w = await page.$eval('.bs-pagina', (m) => m.getBoundingClientRect().width)
  check('  …con la página más ancha que antes (720)', w > 900, w)
  // Con un filtro, una sola columna (la lista de siempre).
  await page.click('#bsChips [data-grupo="guias"], #bsChips button:has-text("Guías")')
  await page.waitForTimeout(800)
  check('con un filtro puesto, la lista de siempre (sin columnas)', (await page.locator('.bs-todo').count()) === 0)
  await ctx.close()
}

console.log('── 3. La barra del trato en Mensajes ──')
const conConversacion = () => () => {
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
  const F = (window.__FAKE_FILAS__ ||= {})
  F.conversation_participants = [{ conversation_id: 'conv-1', user_id: 'user-1', last_read_at: hace(1) }, { conversation_id: 'conv-1', user_id: 'user-2', last_read_at: hace(1) }]
  if (window.__VIVO__ || location.search.includes('vivo=1')) {
    F.trade_offers = [{ id: 'of-1', de: 'user-2', para: 'user-1', estado: 'enviada', tipo: 'cambio', dinero: 0, envio: 'mano', conversacion: 'conv-1', created_at: hace(1) }]
    F.trade_offer_items = []
  }
}
for (const movil of [true, false]) {
  const ctx = await contexto(b, movil, 'user-1', conConversacion())
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 150)))
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.msg-trato [data-cambio="preguntar"]', { timeout: 8000 }).catch(() => {})
  const fila = await page.$$eval('.msg-trato button', (bs) => bs.map((x) => ({ t: x.innerText.trim(), y: Math.round(x.getBoundingClientRect().top) })))
  const t = fila.map((x) => x.t)
  check(`${movil ? 'móvil' : 'PC'}: «Proponer un cambio» y «Ya nos cambiamos» en la MISMA fila`, t.includes('Proponer un cambio') && t.includes('Ya nos cambiamos') && new Set(fila.map((x) => x.y)).size === 1, JSON.stringify(fila))
  check('  …sin el párrafo de explicación de entrada', (await page.locator('.msg-trato').innerText()).includes('¿Os habéis') === false)
  await page.click('[data-cambio="preguntar"]')
  check('  …al tocar «Ya nos cambiamos», la explicación con «Marcar el cambio»', (await page.locator('.msg-cambio').innerText()).includes('¿Os habéis cambiado cartas?') && (await page.locator('[data-cambio="marcar"]').count()) === 1)
  await page.click('[data-cambio="cancelar"]')
  check('  …y «Ahora no» lo deja como estaba', (await page.locator('[data-cambio="preguntar"]').count()) === 1 && !(await page.locator('.msg-cambio').innerText()).includes('¿Os habéis'))
  const alto = await page.$eval('.msg-trato', (x) => x.getBoundingClientRect().height)
  check('  …la barra es fina (una fila)', alto < 72, alto)
  check('  …sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'user-1', conConversacion())
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mensajes.html?c=conv-1&vivo=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.msg-trato .cp-tira', { timeout: 8000 }).catch(() => {})
  check('con un trato en marcha: su tira en la barra, sin «Proponer un cambio»', (await page.locator('.msg-trato .cp-tira').count()) === 1 && (await page.locator('.msg-trato [data-cp-nueva]').count()) === 0)
  check('  …y la barra se queda arriba al bajar', await page.$eval('.msg-trato', (x) => getComputedStyle(x).position === 'sticky'))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo verde')
process.exit(fails ? 1 : 0)
