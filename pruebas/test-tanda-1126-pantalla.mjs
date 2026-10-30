// Tanda 1126 — con un torneo en juego, la barra de arriba NO saca la
// hamburguesa vieja si está el menú lateral (PINGU: «cuando hay un torneo el
// menú lateral sale y no debería, el menú antiguo de las líneas»). La regla
// S780.29 (esconder los enlaces y sacar la hamburguesa para que quepa el
// chip) es de antes de la lateral: sin ella, de 1240 a 1399, sigue igual.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`) }
const b = await chromium.launch()
const errores = []
async function mirar(ancho, torneo = true) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: 800 }, serviceWorkers: 'block' })
  await ctx.addInitScript((t) => {
    window.__FAKE_SESSION__ = 'admin-1'
    if (t) window.__FAKE_FILAS__ = {
      tournaments: [{ id: 't1', slug: 'liga-fdn', name: 'Liga FDN [Oct-Dic]', status: 'in_progress', format: 'swiss', start_at: '2026-10-01T10:00:00Z' }],
      tournament_registrations: [{ id: 'r1', tournament_id: 't1', user_id: 'admin-1', status: 'active' }],
    }
  }, torneo)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, body: '{}' }))
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => ({ lateral: document.documentElement.classList.contains('con-lateral'), chip: Boolean(document.querySelector('.nav-torneo-vivo')), hamburguesa: getComputedStyle(document.querySelector('#navToggle')).display !== 'none' }))
  await ctx.close()
  return r
}
const ancho = await mirar(1500)
check('a 1500 con torneo en juego: menú lateral, el chip y SIN hamburguesa', ancho.lateral && ancho.chip && !ancho.hamburguesa, JSON.stringify(ancho))
const medio = await mirar(1280)
check('a 1280 (sin lateral) sigue como antes: el chip y la hamburguesa', !medio.lateral && medio.chip && medio.hamburguesa, JSON.stringify(medio))
const sin = await mirar(1500, false)
check('sin torneo, tampoco hay hamburguesa', !sin.chip && !sin.hamburguesa, JSON.stringify(sin))
check('sin errores', !errores.length, errores.join(' | '))
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
