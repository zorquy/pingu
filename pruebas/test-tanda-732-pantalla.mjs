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
const { tocaOfrecer } = await import(`${RAIZ}/js/instalar.js`).catch(() => ({}))
const { tocaRefrescar } = await import(`${RAIZ}/js/tirar-refrescar.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Las reglas ──')
if (tocaOfrecer) {
  const ahora = Date.now()
  check('a la primera visita, no', !tocaOfrecer({ instalada: false, visitas: 1 }))
  check('a la segunda, sí', tocaOfrecer({ instalada: false, visitas: 2 }))
  // Desde la 753 también a la tercera página vista de la primera visita.
  check('  …o a la tercera página vista, aunque sea la primera visita', tocaOfrecer({ instalada: false, visitas: 1, vistas: 3 }) && !tocaOfrecer({ instalada: false, visitas: 1, vistas: 2 }))
  check('instalada, nunca', !tocaOfrecer({ instalada: true, visitas: 9 }))
  check('«Ahora no» hace dos semanas: no', !tocaOfrecer({ instalada: false, visitas: 5, calladaEn: ahora - 14 * 864e5, ahora }))
  check('  …hace dos meses: otra vez sí', tocaOfrecer({ instalada: false, visitas: 5, calladaEn: ahora - 60 * 864e5, ahora }))
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

console.log('── 2. En el navegador del iPhone ──')
{
  const ctx = await browser.newContext(iPhone)
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  let page = await abrir(ctx)
  check('a la primera visita no sale', (await banda(page)) === null)
  await page.close()
  // Otra visita es otra pestaña (la cuenta va por sesión del navegador).
  page = await abrir(ctx)
  const b = await banda(page)
  check('a la segunda sale: qué es y por qué', /Ten PokeDoc como una app/.test(b?.texto || '') && /pantalla completa/.test(b?.texto || ''), JSON.stringify(b))
  check('  …con los tres pasos de Safari a la vista', await page.evaluate(() => { const o = document.querySelector('.bm-instalar-pasos'); const li = [...(o?.querySelectorAll('li') || [])]; return li.length === 3 && /Compartir/.test(li[0].textContent) && /Añadir a pantalla de inicio/.test(li[1].textContent) && /Añadir/.test(li[2].textContent) && li.every((x) => x.querySelector('svg') && x.getBoundingClientRect().height > 0) }))
  check('  …y «Ahora no» / «Entendido»', JSON.stringify(b?.botones) === JSON.stringify(['Ahora no', 'Entendido']), JSON.stringify(b?.botones))
  check('  …desde abajo y sin salirse', await page.evaluate(() => { const r = document.querySelector('.bm-instalar').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) <= 1 && r.right <= innerWidth + 1 && r.left >= -1 }))
  await page.click('.bm-instalar [data-instalar="no"]')
  check('«Ahora no» la quita (con su velo)', (await banda(page)) === null && (await page.locator('.bm-instalar-velo').count()) === 0)
  await page.close()
  page = await abrir(ctx)
  check('  …y en la visita siguiente no vuelve', (await banda(page)) === null)
  await page.close()
  const ctx2 = await browser.newContext(iPhone)
  await ctx2.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-visitas', '4') } catch {} })
  // Desde la 753 sale en las páginas de la lista de cada sección (el foro
  // sí); en una ficha o en un hilo, no: estás haciendo otra cosa.
  const foro = await ctx2.newPage()
  await foro.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await foro.waitForTimeout(1800)
  check('en la lista del foro sí sale', (await foro.locator('.bm-instalar').count()) === 1)
  await foro.goto(`${BASE}/tema.html?id=1`, { waitUntil: 'domcontentloaded' })
  await foro.waitForTimeout(1800)
  check('  …y en un hilo, no', (await foro.locator('.bm-instalar').count()) === 0)
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
