// Tanda 1060 — en el tema oscuro, la lista de un <select> (Idioma del
// Mercado) salía blanca con letra clara: el tema se pone con data-theme y no
// se le decía al navegador, que pinta las opciones con lo suyo. `color-scheme:
// dark` en el bloque oscuro de style.css lo arregla para todos los select.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8')
const ini = css.indexOf(":root[data-theme='dark'] {\n")
const bloque = css.slice(ini, css.indexOf('}', ini))
check('el bloque oscuro de style.css declara color-scheme: dark', /color-scheme:\s*dark/.test(bloque))
const b = await chromium.launch()
for (const tema of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  await ctx.addInitScript((t) => { try { localStorage.setItem('pokedoc-theme', t) } catch {} window.__FAKE_SESSION__ = 'none' }, tema)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => ({ raiz: getComputedStyle(document.documentElement).colorScheme, select: getComputedStyle(document.getElementById('mcMercadoIdioma')).colorScheme }))
  check(`tema ${tema}: el select del Mercado va en ${tema === 'dark' ? 'oscuro' : 'claro (normal)'}`, tema === 'dark' ? r.select.includes('dark') : !r.select.includes('dark'), JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
