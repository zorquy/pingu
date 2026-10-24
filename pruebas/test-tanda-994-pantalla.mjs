// Tanda 994 — la invitación a los avisos en el móvil.
//
// PINGU: «¿se puede poner en móvil activado automáticamente? o al menos un
// pop up». Activarlos solo no se puede (el permiso lo pide un toque), así que
// una tarjeta con «Activar». Lo que se mira: lo puro (cuándo toca), que sale
// en el móvil con cuenta y no en el PC ni sin claves ni con el permiso
// denegado; que «Activar» pide el permiso, guarda la suscripción y lo dice; y
// que «Ahora no» la calla.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo puro ──')
{
  const { tocaInvitar } = await import(`${RAIZ}/js/invitar-push.js`)
  const base = { soportado: true, permiso: 'default', suscrito: false, hayClave: true }
  const ahora = Date.parse('2026-10-24T12:00:00Z')
  check('con todo en orden, toca', tocaInvitar({ ...base, ahora }))
  check('sin push en el navegador (Safari del iPhone sin instalar), no', !tocaInvitar({ ...base, soportado: false, ahora }))
  check('ya activados, no', !tocaInvitar({ ...base, suscrito: true, ahora }))
  check('con el permiso denegado o ya dado, no', !tocaInvitar({ ...base, permiso: 'denied', ahora }) && !tocaInvitar({ ...base, permiso: 'granted', ahora }))
  check('sin las claves del sitio, no', !tocaInvitar({ ...base, hayClave: false, ahora }))
  check('ya salió en esta sesión, no', !tocaInvitar({ ...base, yaEnSesion: true, ahora }))
  check('«Ahora no» hace una semana, no', !tocaInvitar({ ...base, callada: { en: ahora - 7 * 86400000, veces: 1 }, ahora }))
  check('«Ahora no» hace dos meses, vuelve a tocar', tocaInvitar({ ...base, callada: { en: ahora - 60 * 86400000, veces: 1 }, ahora }))
  check('a la segunda «Ahora no», nunca más', !tocaInvitar({ ...base, callada: { en: ahora - 400 * 86400000, veces: 2 }, ahora }))
}

const browser = await chromium.launch()
const semilla = ({ clave, permiso, callada }) => {
  window.__FAKE_SESSION__ = 'user-1'
  if (clave) window.__FAKE_FILAS__ = { site_settings: [{ key: 'push_vapid_public', value: { clave: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' } }] }
  try {
    localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
    if (callada) localStorage.setItem('pokedoc-push-no', JSON.stringify(callada))
  } catch {}
  // El push del navegador, de mentira: el permiso, el registro y la suscripción.
  let actual = permiso || 'default'
  window.__PEDIDOS__ = 0
  try {
    Object.defineProperty(Notification, 'permission', { get: () => actual, configurable: true })
    Notification.requestPermission = async () => { window.__PEDIDOS__++; actual = 'granted'; return 'granted' }
  } catch {}
  let sub = null
  const reg = {
    addEventListener() {}, update: async () => {}, active: null, installing: null, waiting: null,
    pushManager: {
      getSubscription: async () => sub,
      subscribe: async () => (sub = { endpoint: 'https://push.example/abc', options: {}, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p', auth: 'a' } } }, unsubscribe: async () => true }),
    },
  }
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = async () => reg
    navigator.serviceWorker.getRegistration = async () => reg
  }
}
async function abrir(ruta, { movil = true, ...op } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { clave: true, ...op })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  return { page, ctx, errores }
}
const tarjeta = (page) => page.evaluate(() => {
  const t = document.querySelector('.bm-push')
  if (!t) return null
  const r = t.getBoundingClientRect()
  const barra = document.querySelector('nav.bm')?.getBoundingClientRect()
  return { texto: t.innerText.replace(/\s+/g, ' ').trim(), alto: r.height, abajo: r.bottom, ancho: r.width, barraArriba: barra?.top ?? null, dentro: r.left >= 0 && r.right <= innerWidth }
})

console.log('── 1. Sale en el móvil, con cuenta ──')
{
  const { page, ctx, errores } = await abrir('/')
  const t = await tarjeta(page)
  check('en la portada del móvil sale la tarjeta', !!t && /¿Te avisamos en el móvil\?/.test(t.texto) && /Activar/.test(t.texto), JSON.stringify(t))
  check('…entera en la pantalla y por encima de la barra de abajo', t && t.dentro && t.barraArriba !== null && t.abajo <= t.barraArriba, JSON.stringify(t))
  check("…y cabe en una tarjeta (no tapa media pantalla)", t && t.alto < 180, JSON.stringify(t))
  await page.screenshot({ path: '/tmp/994-tarjeta.png' })
  await page.click('.bm-push [data-push="si"]')
  await page.waitForTimeout(800)
  const tras = await tarjeta(page)
  check('«Activar» pide el permiso del sistema (una vez)', (await page.evaluate(() => window.__PEDIDOS__)) === 1)
  const subs = await page.evaluate(() => (window.__TABLAS__ || {}).push_subscriptions || [])
  check('…y guarda la suscripción de este dispositivo', subs.some((s) => s.endpoint === 'https://push.example/abc' && s.user_id === 'user-1'), JSON.stringify(subs))
  check('…y lo dice', tras && /Avisos activados/.test(tras.texto) && !/Activar los avisos/.test(tras.texto), JSON.stringify(tras))
  await page.screenshot({ path: '/tmp/994-activados.png' })
  await page.waitForTimeout(3000)
  check('…y se va sola', !(await tarjeta(page)))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. «Ahora no» ──')
{
  const { page, ctx } = await abrir('/foro')
  check('en una página de lista (el foro) también sale', !!(await tarjeta(page)))
  await page.click('.bm-push [data-push="no"]')
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('pokedoc-push-no') || 'null'))
  check('«Ahora no» la quita y lo apunta (una vez)', !(await tarjeta(page)) && guardado?.veces === 1 && guardado?.en > 0, JSON.stringify(guardado))
  check('no se ha pedido el permiso', (await page.evaluate(() => window.__PEDIDOS__)) === 0)
  await ctx.close()
  const otra = await abrir('/', { callada: { en: Date.now() - 86400000, veces: 1 } })
  check('al día siguiente, otra sesión: no vuelve', !(await tarjeta(otra.page)))
  await otra.ctx.close()
}

console.log('── 3. Cuándo no sale ──')
for (const [nombre, ruta, op] of [
  ['en el PC', '/', { movil: false }],
  ['sin las claves del sitio', '/', { clave: false }],
  ['con el permiso denegado', '/', { permiso: 'denied' }],
  ['con el permiso ya dado (activados en otro momento)', '/', { permiso: 'granted' }],
]) {
  const { page, ctx } = await abrir(ruta, op)
  check(`${nombre}, no sale`, !(await tarjeta(page)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
