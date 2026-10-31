// Tanda 1134 — Halloween (PINGU eligió la C: toda la web de noche).
//
//   1. Lo puro: el 31 de octubre y el 1 de noviembre sí; el 30 y el 2, no.
//   2. La cabecera: con la fecha de Halloween la web se pone de noche, con su
//      hoja, ANTES de que llegue el JS; el 2 de noviembre, no; con «Quitar la
//      decoración» apuntado, no; y un navegador automático no lo ve salvo con
//      ?temporada=halloween (para que la suite de esos días no cambie).
//   3. El pop-up «¿Truco o trato?» (1136, sustituye al bloque de la portada):
//      sale una vez, hoja en el móvil y centrado en el PC; Trato y Truco
//      llevan al fantasma; «Quitar la decoración» lo quita todo.
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

console.log('\n── 3. El pop-up «¿Truco o trato?» (1136) ──')
const popEstado = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.temporada-pop')
  const r = d?.getBoundingClientRect()
  const visible = (n) => { const x = d?.querySelector(`[data-paso="${n}"]`); return !!x && !x.hidden }
  return {
    abierto: !!d?.open, pasos: ['pregunta', 'bu', 'trato'].filter(visible),
    caja: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) } : null,
    alto: innerHeight, ancho: innerWidth,
    titulo: d?.querySelector('[data-paso="trato"] h2')?.textContent || '', chapa: d?.querySelector('[data-temporada-chapa]')?.textContent || '',
    enlace: d?.querySelector('[data-paso="trato"] a')?.getAttribute('href') || '',
    visto: localStorage.getItem('pd-halloween-visto'), hueco: !!document.getElementById('temporadaHueco'),
  }
})
{
  const { ctx, page, errores } = await abrir({ fecha: '2026-10-31', humano: true })
  const e = await popEstado(page)
  check('móvil: sale el pop-up con la pregunta y queda apuntado', e.abierto && e.pasos.join() === 'pregunta' && e.visto === '1', JSON.stringify(e))
  check('  …como hoja desde abajo', e.caja && Math.abs(e.caja.bottom - e.alto) <= 2 && e.caja.left <= 1, JSON.stringify(e.caja))
  check('la portada ya no lleva el bloque del fantasma', !e.hueco)
  await page.click('[data-temporada-elige="trato"]')
  await page.waitForTimeout(400)
  const t = await popEstado(page)
  check('«Trato»: te toca un fantasma con enlace a sus cartas', t.pasos.join() === 'trato' && /^Te ha tocado \S+/.test(t.titulo) && t.enlace.startsWith('/cartas?ver=buscar&q=') && t.chapa === '¡Trato!', JSON.stringify(t))
  await page.click('[data-temporada-cerrar]')
  await page.waitForTimeout(300)
  check('«Cerrar» lo quita', !(await page.locator('dialog.temporada-pop').count()))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  check('y no vuelve a salir', !(await page.locator('dialog.temporada-pop').count()))
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('nada se sale de lado', desborde <= 0, desborde)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ ruta: '/foro', fecha: '2026-10-31', humano: true })
  await page.click('[data-temporada-elige="truco"]')
  await page.waitForTimeout(300)
  const bu = await popEstado(page)
  check('«Truco»: primero el ¡BU!', bu.pasos.join() === 'bu', JSON.stringify(bu))
  await page.waitForTimeout(1500)
  const t = await popEstado(page)
  check('  …y luego el trato igualmente (en cualquier página, no solo la portada)', t.pasos.join() === 'trato' && /Truco/.test(t.chapa), JSON.stringify(t))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ fecha: '2026-10-31', humano: true, movil: false })
  const e = await popEstado(page)
  const cx = (e.caja.left + e.caja.right) / 2
  const cy = (e.caja.top + e.caja.bottom) / 2
  check('PC: ventana centrada', e.abierto && Math.abs(cx - e.ancho / 2) <= 2 && Math.abs(cy - e.alto / 2) <= 2, JSON.stringify(e.caja))
  await page.mouse.click(10, 10)
  await page.waitForTimeout(300)
  check('  …y tocar fuera la cierra', !(await page.locator('dialog.temporada-pop').count()))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ fecha: '2026-10-31', humano: true })
  await page.click('[data-temporada-quitar]')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1200)
  const tras = await page.evaluate(() => ({ t: document.documentElement.dataset.temporada || null, guardado: localStorage.getItem('pd-sin-halloween'), pop: !!document.querySelector('dialog.temporada-pop') }))
  check('«Quitar la decoración» desde el pop-up la quita y lo recuerda', !tras.t && tras.guardado === '1' && !tras.pop, JSON.stringify(tras))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ fecha: '2026-11-02', humano: true })
  check('el 2 de noviembre, sin pop-up', !(await page.locator('dialog.temporada-pop').count()))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
