// Tanda 730 — mientras carga Mi colección, la FORMA de lo que llega (V5 de
// la lista de propuestas, elegida por PINGU): la cifra del valor, las tres
// fichas y una fila de cartas con la proporción de una carta, con el brillo
// suave de siempre (que «menos movimiento» ya apaga, la 313).
//
// Lo que se mira, con la colección tardando a propósito: que mientras
// carga se vean esas formas y no una frase; que la lectura en voz alta diga
// que carga; y que al llegar se vayan.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
await ctx.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_RETRASO__ = { user_collection: 2500 }
  window.__FAKE_COLECCION__ = []
})
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
const c = await page.evaluate(() => {
  const caja = document.getElementById('mcCargando')
  const r = (e) => e.getBoundingClientRect()
  return caja ? {
    ve: !caja.classList.contains('hidden') && r(caja).height > 100,
    voz: caja.getAttribute('role') === 'status' && /Cargando la colección/.test(caja.querySelector('.sr-only')?.textContent || ''),
    valor: Math.round(r(caja.querySelector('.mc-esq-valor')).height),
    fichas: caja.querySelectorAll('.mc-esq-fichas .skeleton').length,
    carta: (() => { const b = r(caja.querySelector('.mc-esq-cartas .skeleton')); return Math.round((b.height / b.width) * 100) / 100 })(),
    brillo: getComputedStyle(caja.querySelector('.skeleton')).animationName,
  } : null
})
check('mientras carga: la cifra, tres fichas y cartas con su forma', c?.ve && c.valor === 96 && c.fichas === 3 && Math.abs(c.carta - 88 / 63) < 0.05, JSON.stringify(c))
check('  …con el brillo de los esqueletos', c?.brillo === 'shimmer', c?.brillo)
check('  …y en voz alta dice que carga', c?.voz)
await page.waitForTimeout(3200)
check('al llegar la colección, se va', await page.evaluate(() => document.getElementById('mcCargando').classList.contains('hidden')))
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
