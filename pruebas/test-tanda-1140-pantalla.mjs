// Tanda 1140 — mensajes sin migración (de la propuesta «Comunidad, guías y
// menú»): el punto verde de quien está en línea (mensajes, Gente, perfil),
// «escribiendo…» por un canal de difusión que no toca la base, y «Una
// carta» en el clip (de tu colección primero, con su idioma, estado y precio).
//
// El tiempo real de las pruebas (herramientas/stub-vivo.js) difunde entre
// pestañas con BroadcastChannel: así dos personas (Ash y Misty) se ven escribir.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const P = await import(`${RAIZ}/js/mensajes-puro.js`)
  const m = { adjuntos: [{ tipo: 'carta', de: 'coleccion', card_id: 'a' }, { tipo: 'carta', stock_id: 's1', card_id: 'b' }, { tipo: 'carta', card_id: 'c' }, { tipo: 'carta', de: 'otro', card_id: 'd' }] }
  check('una carta del clip cuenta como carta (con «de»), una sin nada no', P.cartasDe(m).map((a) => a.card_id).join() === 'a,b', P.cartasDe(m).map((a) => a.card_id).join())
}

const conConversaciones = () => {
  const ahora = Date.now()
  const hace = (h) => new Date(ahora - h * 3600e3).toISOString()
  const F = (window.__FAKE_FILAS__ ||= {})
  F.conversation_participants = [
    { conversation_id: 'conv-1', user_id: 'user-1', last_read_at: hace(1) }, { conversation_id: 'conv-1', user_id: 'user-2', last_read_at: hace(1) },
    { conversation_id: 'conv-2', user_id: 'user-1', last_read_at: hace(1) }, { conversation_id: 'conv-2', user_id: 'extra-3', last_read_at: hace(60) },
  ]
  // Misty (user-2) en línea; Lance (extra-3) también, pero esconde su actividad.
  F.online_now = [{ token: 't1', user_id: 'user-2', last_seen: hace(0.05) }, { token: 't2', user_id: 'extra-3', last_seen: hace(0.05) }, { token: 't3', user_id: null, last_seen: hace(0.05) }]
  for (const p of window.__FAKE_PERFILES__ || []) if (p.id === 'extra-3') p.hide_activity = true
}
async function abrir(b, movil, quien = 'user-1') {
  return contexto(b, movil, 'user-1', conConversaciones)
}
const nueva = async (ctx, quien) => {
  const page = await ctx.newPage()
  if (quien !== 'user-1') await page.addInitScript((q) => { window.__FAKE_SESSION__ = q }, quien)
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  page.errores = errores
  return page
}

const b = await chromium.launch()
console.log('── 2. El punto verde ──')
{
  const ctx = await abrir(b, true)
  const page = await nueva(ctx, 'user-1')
  await page.goto(`${BASE}/mensajes.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const filas = await page.$$eval('.msg-fila-avatar', (as) => as.map((a) => [a.dataset.enLinea, a.classList.contains('avatar-conectado')]))
  check('la bandeja: Misty con el punto; Lance (esconde su actividad) sin él', filas.some(([id, on]) => id === 'user-2' && on) && filas.some(([id, on]) => id === 'extra-3' && !on), JSON.stringify(filas))
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('en la conversación: el punto en su avatar y «En línea» bajo el nombre', (await page.$eval('.msg-cabecera-avatar', (a) => a.classList.contains('avatar-conectado'))) && (await page.textContent('#msgEstado')) === 'En línea', await page.textContent('#msgEstado'))
  await page.goto(`${BASE}/usuarios.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const gente = await page.$$eval('.com-persona-cara[data-en-linea]', (as) => as.filter((a) => a.classList.contains('avatar-conectado')).map((a) => a.dataset.enLinea))
  check('Gente: solo Misty lleva el punto', gente.join() === 'user-2', gente.join())
  await page.goto(`${BASE}/usuario/Misty`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const perfil = await page.$eval('#heroAvatar', (a) => ({ on: a.classList.contains('avatar-conectado'), punto: getComputedStyle(a, '::after').backgroundColor }))
  check('su perfil: el punto verde en el avatar', perfil.on && /34, 197, 94/.test(perfil.punto), JSON.stringify(perfil))
  await page.screenshot({ path: '/tmp/1140-perfil.png' })
  check('sin errores', !page.errores.length, page.errores.join(' | '))
  await ctx.close()
}

console.log('── 3. «Escribiendo…» ──')
{
  const ctx = await abrir(b, true)
  const ash = await nueva(ctx, 'user-1')
  const misty = await nueva(ctx, 'user-2')
  await ash.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await misty.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await ash.waitForTimeout(2500)
  await misty.waitForTimeout(500)
  await misty.click('#msgBody')
  await misty.keyboard.type('Hola Ash', { delay: 40 })
  await ash.waitForTimeout(600)
  const estado = await ash.textContent('#msgEstado')
  check('Misty escribe y Ash ve «escribiendo…»', estado === 'escribiendo…', estado)
  check('  …en verde', await ash.$eval('#msgEstado', (e) => e.classList.contains('escribiendo')))
  await ash.screenshot({ path: '/tmp/1140-escribiendo.png' })
  await ash.waitForTimeout(5600)
  check('  …y se apaga solo a los cinco segundos sin señal (vuelve «En línea»)', (await ash.textContent('#msgEstado')) === 'En línea', await ash.textContent('#msgEstado'))
  const propio = await misty.textContent('#msgEstado')
  check('quien escribe no se ve a sí mismo escribiendo', propio !== 'escribiendo…', propio)
  check('sin errores', !ash.errores.length && !misty.errores.length, [...ash.errores, ...misty.errores].join(' | '))
  await ctx.close()
}

console.log('── 4. «Una carta» en el clip ──')
for (const movil of [false, true]) {
  const ctx = await abrir(b, movil)
  const page = await nueva(ctx, 'user-1')
  await page.goto(`${BASE}/mensajes.html?c=conv-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.click('#msgClip')
  await page.waitForTimeout(300)
  const opciones = await page.$$eval('#msgHoja .msg-hoja-opcion', (bs) => bs.filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.hoja))
  check(`${movil ? 'móvil' : 'PC'}: el clip ofrece ${movil ? 'carta, foto y cámara' : 'carta y foto (sin cámara con ratón)'}`, opciones.join() === (movil ? 'carta,galeria,camara' : 'carta,galeria'), opciones.join())
  await page.click('#msgHoja [data-hoja="carta"]')
  await page.waitForSelector('.msg-elegir[open]', { timeout: 5000 }).catch(() => {})
  await page.fill('#msgElegirBuscar', 'charizard')
  await page.waitForTimeout(1500)
  const grupos = await page.$$eval('.msg-elegir-grupo', (gs) => gs.map((g) => g.textContent))
  const primera = await page.$eval('.msg-elegir-fila', (f) => f.innerText.replace(/\s+/g, ' ')).catch(() => '')
  check('  …busca y lo tuyo sale primero, con idioma, estado y precio', grupos[0] === 'En tu colección' && /Charizard ex/.test(primera) && /ES · NM/.test(primera) && /€/.test(primera), `${grupos.join('|')} · ${primera}`)
  if (!movil) await page.screenshot({ path: '/tmp/1140-elegir.png' })
  else await page.screenshot({ path: '/tmp/1140-elegir-movil.png' })
  await page.click('.msg-elegir-fila')
  await page.waitForTimeout(500)
  const pendiente = await page.$eval('#msgCartaPendiente', (e) => (e.hidden ? '' : e.innerText.replace(/\s+/g, ' '))).catch(() => '')
  check('  …elegirla la deja en el cuadro, lista para mandar', /Vas a mandar una de tus cartas/i.test(pendiente) && /Charizard ex/.test(pendiente), pendiente)
  await page.click('#btnSendMsg')
  await page.waitForTimeout(1200)
  const enviado = await page.evaluate(() => (window.__TABLAS__.private_messages || []).filter((m) => m.sender_id === 'user-1' && Array.isArray(m.adjuntos) && m.adjuntos.length).map((m) => m.adjuntos[0]).pop())
  check('  …se manda como adjunto «carta» de tu colección, sin nada de tienda', enviado?.tipo === 'carta' && enviado.de === 'coleccion' && enviado.card_id === 'sv08-1' && enviado.idioma === 'es' && !enviado.stock_id && Number.isFinite(enviado.precio), JSON.stringify(enviado))
  const enHilo = await page.$$eval('#threadMessages .msg-carta', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' '))).catch(() => [])
  check('  …y en el hilo sale «De tu colección» con la carta', enHilo.some((t) => /De tu colección/i.test(t) && /Charizard ex/.test(t)), enHilo.join(' | '))
  if (!movil) await page.screenshot({ path: '/tmp/1140-hilo.png' })
  check('sin errores', !page.errores.length, page.errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
