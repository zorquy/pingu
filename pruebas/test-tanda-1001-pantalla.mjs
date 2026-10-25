// Tanda 1001 — la racha de otra persona, solo si es racha y está viva.
//
// PINGU, con /usuarios delante: «parece que si no tienen racha sale 1 fuego,
// pero debería no salir nada». Un día suelto no es una racha, y una racha de
// quien no ha vuelto desde hace semanas ya no lo es (`current_streak` no
// vuelve a cero hasta que la persona vuelve).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Lo puro ──')
const { rachaVisible } = await import(`${RAIZ}/js/racha-visible.js`)
{
  const hoy = new Date('2026-10-25T10:00:00Z')
  check('un día suelto no sale', rachaVisible({ current_streak: 1, last_active_date: '2026-10-25' }, hoy) === 0)
  check('dos o más, viva (hoy o ayer), sí', rachaVisible({ current_streak: 2, last_active_date: '2026-10-25' }, hoy) === 2 && rachaVisible({ current_streak: 85, last_active_date: '2026-10-24' }, hoy) === 85)
  check('la de quien no vuelve desde hace días, no', rachaVisible({ current_streak: 20, last_active_date: '2026-10-22' }, hoy) === 0 && rachaVisible({ current_streak: 20 }, hoy) === 0)
}

console.log('── 2. /usuarios ──')
{
  const HOY = new Date().toISOString().slice(0, 10)
  const PERFILES = [
    { id: 'u1', username: 'Larga', display_name: 'Larga', total_xp: 900, current_streak: 41, last_active_date: HOY },
    { id: 'u2', username: 'UnDia', display_name: 'UnDia', total_xp: 800, current_streak: 1, last_active_date: HOY },
    { id: 'u3', username: 'SeFue', display_name: 'SeFue', total_xp: 700, current_streak: 12, last_active_date: '2026-01-01' },
  ]
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((g) => { window.__FAKE_SESSION__ = 'none'; window.__FAKE_PERFILES__ = g }, PERFILES)
  await page.goto(`${BASE}/usuarios.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.com-persona')].map((c) => [c.querySelector('.com-persona-nombre')?.textContent.trim(), c.querySelector('.com-persona-racha')?.textContent.trim() || ''])))
  check('la de 41 días sale', r.Larga === '41', JSON.stringify(r))
  check('  …la de un día y la de quien se fue, no', r.UnDia === '' && r.SeFue === '', JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
