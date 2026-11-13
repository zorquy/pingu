// Tanda 732 — instalar PokeDoc en la pantalla de inicio (A1) y, ya
// instalada, tirar hacia abajo para refrescar (X4), de la lista de
// propuestas, elegidas por PINGU.
//
// Lo que se mira: las dos reglas (cuándo se ofrece instalar; cuándo un
// tirón recarga); que a la primera visita no salga, a la segunda sí, con
// los dos pasos de Safari detrás de «Cómo», y que «Ahora no» la calle; que
// instalada no se ofrezca; y que el tirón solo exista instalada (en el
// navegador ya lo pone el navegador) y recargue de verdad.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { tocaTrasExito } = await import(`${RAIZ}/js/instalar.js`).catch(() => ({}))
const { tocaRefrescar } = await import(`${RAIZ}/js/tirar-refrescar.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Las reglas ──')
// Desde la 1317 (A3) se ofrece tras un buen momento, una vez a la semana como mucho.
if (tocaTrasExito) {
  const ahora = Date.now()
  check('la primera vez, sí', tocaTrasExito({ instalada: false, ahora }))
  check('instalada, nunca', !tocaTrasExito({ instalada: true }))
  check('ofrecida hace tres días: no', !tocaTrasExito({ instalada: false, ultimaEn: ahora - 3 * 864e5, ahora }))
  check('  …hace ocho: otra vez sí', tocaTrasExito({ instalada: false, ultimaEn: ahora - 8 * 864e5, ahora }))
  check('«Ahora no» hace dos semanas: no', !tocaTrasExito({ instalada: false, calladaEn: ahora - 14 * 864e5, ahora }))
  check('  …hace dos meses: otra vez sí', tocaTrasExito({ instalada: false, calladaEn: ahora - 60 * 864e5, ahora }))
} else check('instalar.js se puede importar sin navegador', false)
check('el tirón: desde arriba y 80 px hacia abajo', tocaRefrescar({ arriba: true, dy: 90, dx: 5 }) && !tocaRefrescar({ arriba: true, dy: 50, dx: 0 }) && !tocaRefrescar({ arriba: false, dy: 120, dx: 0 }) && !tocaRefrescar({ arriba: true, dy: 90, dx: 80 }))

const browser = await chromium.launch()
const iPhone = { ...devices['iPhone 13'] }
const abrir = async (ctx) => {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return page
}
// Desde la 753, en el iPhone es una HOJA desde abajo con los tres pasos a
// la vista (la maqueta A1), con «Ahora no» y «Entendido».
const banda = (page) => page.evaluate(() => { const b = document.querySelector('.bm-instalar'); return b ? { texto: b.textContent.replace(/\s+/g, ' ').trim(), botones: [...b.querySelectorAll('[data-instalar]')].map((x) => x.textContent.trim()) } : null })

console.log('── 2. En el navegador del iPhone (desde la 1317, tras un buen momento) ──')
{
  const ctx = await browser.newContext(iPhone)
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-visitas', '6') } catch {} })
  let page = await abrir(ctx)
  check('al llegar no sale nada, aunque sea la sexta visita', (await page.locator('.bm-instalar, .bm-instalar-banda').count()) === 0)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('pd-exito', { detail: { motivo: 'reto' } })))
  await page.waitForTimeout(300)
  const t = await page.evaluate(() => { const c = document.querySelector('.bm-instalar-tarjeta'); return c && c.textContent.replace(/\s+/g, ' ').trim() })
  check('tras un buen momento, la tarjeta con lo que ha salido bien', /¡Reto hecho!/.test(t || '') && /como una app/.test(t || ''), t)
  await page.click('.bm-instalar-tarjeta [data-instalar="si"]')
  await page.waitForTimeout(300)
  const b = await banda(page)
  check('  …«Instalar» abre la hoja: qué es y por qué', /Ten PokeDoc como una app/.test(b?.texto || '') && /pantalla completa/.test(b?.texto || ''), JSON.stringify(b))
  check('  …con los tres pasos de Safari a la vista', await page.evaluate(() => { const o = document.querySelector('.bm-instalar-pasos'); const li = [...(o?.querySelectorAll('li') || [])]; return li.length === 3 && /Compartir/.test(li[0].textContent) && /Añadir a pantalla de inicio/.test(li[1].textContent) && /Añadir/.test(li[2].textContent) && li.every((x) => x.querySelector('svg') && x.getBoundingClientRect().height > 0) }))
  check('  …y «Ahora no» / «Entendido»', JSON.stringify(b?.botones) === JSON.stringify(['Ahora no', 'Entendido']), JSON.stringify(b?.botones))
  check('  …desde abajo y sin salirse', await page.evaluate(() => { const r = document.querySelector('.bm-instalar').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) <= 1 && r.right <= innerWidth + 1 && r.left >= -1 }))
  await page.click('.bm-instalar [data-instalar="no"]')
  check('«Ahora no» la quita (con su velo)', (await banda(page)) === null && (await page.locator('.bm-instalar-velo').count()) === 0)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('pd-exito', { detail: { motivo: 'torneo' } })))
  await page.waitForTimeout(300)
  check('  …y otro buen momento ya no la trae', (await banda(page)) === null)
  await page.close()
  // Un buen momento justo antes de cambiar de página (inscribirse recarga).
  const ctx2 = await browser.newContext(iPhone)
  await ctx2.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p2 = await ctx2.newPage()
  await p2.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await p2.evaluate(() => sessionStorage.setItem('pd-exito-pendiente', 'torneo'))
  await p2.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(1800)
  check('lo que salió bien justo antes de cambiar de página sale en la siguiente', /¡Ya estás dentro!/.test((await p2.locator('.bm-instalar-tarjeta').textContent().catch(() => '')) || ''))
  await p2.reload({ waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(1500)
  check('  …una vez (y la semana que viene, otra)', (await p2.locator('.bm-instalar').count()) === 0)
  await ctx2.close()
  page = await abrir(ctx)
  check('en el navegador no se monta el tirón (ya lo hace él)', (await page.locator('.bm-refrescar').count()) === 0)
  await ctx.close()
}

console.log('── 3. Instalada ──')
{
  const ctx = await browser.newContext(iPhone)
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    try { localStorage.setItem('pokedoc-visitas', '5') } catch {}
    const original = window.matchMedia.bind(window)
    window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : original(q))
  })
  const page = await abrir(ctx)
  check('no se ofrece instalar', (await banda(page)) === null)
  check('y sí está el tirón', (await page.locator('.bm-refrescar').count()) === 1)
  await page.evaluate(() => { window.__antes = true; window.scrollTo(0, 0) })
  const cdp = await ctx.newCDPSession(page)
  const x = 200
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 200 }] })
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 200 + i * 20 }] })
  const lista = await page.$eval('.bm-refrescar', (m) => m.classList.contains('lista'))
  check('  …al tirar 120 px la flecha dice que ya vale', lista)
  await Promise.all([page.waitForNavigation({ timeout: 4000 }).catch(() => null), cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })])
  await page.waitForTimeout(1500)
  check('  …y al soltar, recarga la página', await page.evaluate(() => window.__antes !== true))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
