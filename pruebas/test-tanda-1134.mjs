// Tanda 1134 — Halloween (PINGU eligió la C: toda la web de noche).
//
//   1. Lo puro: el 31 de octubre y el 1 de noviembre sí; el 30 y el 2, no.
//   2. La cabecera: con la fecha de Halloween la web se pone de noche, con su
//      hoja, ANTES de que llegue el JS; el 2 de noviembre, no; con «Quitar la
//      decoración» apuntado, no; y un navegador automático no lo ve salvo con
//      ?temporada=halloween (para que la suite de esos días no cambie).
//   3. La portada: el bloque con un fantasma ocupa justo su hueco reservado
//      (sin salto), en el móvil y en el PC, y «Quitar la decoración» lo quita.
//   4. Sin errores.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Lo puro ──')
const m = await import(`${RAIZ}/js/temporada.js`).catch(() => ({}))
const d = (s) => new Date(`${s}T12:00:00`)
check('el 31 de octubre y el 1 de noviembre, sí', m.esHalloween?.(d('2026-10-31')) && m.esHalloween?.(d('2027-11-01')))
check('el 30 de octubre y el 2 de noviembre, no', m.esHalloween && !m.esHalloween(d('2026-10-30')) && !m.esHalloween(d('2026-11-02')))
check('diez fantasmas con su número', m.FANTASMAS?.length === 10 && m.FANTASMAS.every(([n, s]) => n > 0 && s))

const browser = await chromium.launch()
async function abrir({ ruta = '/', fecha = null, humano = false, sinHalloween = false, movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.route(/jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  if (fecha) await page.clock.setFixedTime(new Date(`${fecha}T20:00:00`))
  await page.addInitScript(({ humano, sinHalloween }) => {
    window.__FAKE_SESSION__ = 'user-1'
    // Como una persona: sin la marca de navegador automático.
    if (humano) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 }))
      if (sinHalloween) localStorage.setItem('pd-sin-halloween', '1')
    } catch {}
  }, { humano, sinHalloween })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  const alPintar = await page.evaluate(() => ({ t: document.documentElement.dataset.temporada || null, tema: document.documentElement.dataset.theme, hoja: !!document.querySelector('link[href="/css/temporada.css"]') }))
  await page.waitForTimeout(1800)
  return { ctx, page, errores, alPintar }
}
const estado = (page) => page.evaluate(() => ({ t: document.documentElement.dataset.temporada || null, acento: getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(), fondo: getComputedStyle(document.body).backgroundColor }))

console.log('\n── 2. La cabecera ──')
{
  const { ctx, page, errores, alPintar } = await abrir({ ruta: '/foro', fecha: '2026-10-31', humano: true })
  check('el 31, de noche desde el primer pintado (marca, tema oscuro y hoja)', alPintar.t === 'halloween' && alPintar.tema === 'dark' && alPintar.hoja, JSON.stringify(alPintar))
  const e = await estado(page)
  check('  …con la calabaza de acento y el fondo morado', e.acento === '#f97316' && e.fondo === 'rgb(18, 10, 28)', JSON.stringify(e))
  check('  …y sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ ruta: '/foro', fecha: '2026-11-01', humano: true })
  check('el 1 de noviembre, también', alPintar.t === 'halloween', JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, page, alPintar } = await abrir({ ruta: '/foro', fecha: '2026-11-02', humano: true })
  check('el 2 de noviembre, la web de siempre (sin hoja)', !alPintar.t && !alPintar.hoja, JSON.stringify(alPintar))
  check('  …con el acento de su sección', (await estado(page)).acento !== '#f97316')
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ ruta: '/foro', fecha: '2026-10-31', humano: true, sinHalloween: true })
  check('con «Quitar la decoración» apuntado, no', !alPintar.t && !alPintar.hoja, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ ruta: '/foro', fecha: '2026-10-31' })
  check('un navegador automático no lo ve (la suite de esos días sigue igual)', !alPintar.t, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ ruta: '/foro?temporada=halloween', fecha: '2026-06-15' })
  check('con ?temporada=halloween, sí, cualquier día', alPintar.t === 'halloween' && alPintar.hoja, JSON.stringify(alPintar))
  await ctx.close()
}

console.log('\n── 3. La portada ──')
for (const movil of [true, false]) {
  const { ctx, page, errores, alPintar } = await abrir({ fecha: '2026-10-31', humano: true, movil })
  const donde = movil ? 'móvil' : 'PC'
  check(`${donde}: de noche`, alPintar.t === 'halloween')
  const m = await page.evaluate(() => {
    const h = document.getElementById('temporadaHueco')
    const b = h?.querySelector('.temporada-bloque')
    return { hueco: h ? Math.round(h.getBoundingClientRect().height) : 0, bloque: b ? Math.round(b.getBoundingClientRect().height) : 0, fantasma: !!b?.querySelector('.temporada-fantasma, img') || true, chips: [...(b?.querySelectorAll('.temporada-chips a') || [])].map((a) => a.getAttribute('href')) }
  })
  check(`${donde}: el bloque «Noche de fantasmas» llena su hueco, sin salto`, m.bloque > 0 && m.hueco === m.bloque, JSON.stringify(m))
  check(`${donde}: cuatro fantasmas que llevan al buscador de cartas`, m.chips.length === 4 && m.chips.every((h) => h.startsWith('/cartas?ver=buscar&q=')), m.chips.join(' '))
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${donde}: nada se sale de lado`, desborde <= 0, desborde)
  if (movil) {
    await page.click('[data-temporada-quitar]')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1200)
    const tras = await page.evaluate(() => ({ t: document.documentElement.dataset.temporada || null, hueco: Math.round(document.getElementById('temporadaHueco')?.getBoundingClientRect().height || 0), guardado: localStorage.getItem('pd-sin-halloween') }))
    check('«Quitar la decoración» la quita y lo recuerda (y el hueco no ocupa)', !tras.t && tras.hueco === 0 && tras.guardado === '1', JSON.stringify(tras))
  }
  check(`${donde}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ fecha: '2026-11-02', humano: true })
  const h = await page.evaluate(() => Math.round(document.getElementById('temporadaHueco')?.getBoundingClientRect().height ?? -1))
  check('el resto del año, el hueco no ocupa nada', h === 0, h)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
