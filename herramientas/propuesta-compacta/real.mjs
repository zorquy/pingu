// Capturas de la web REAL (sin inyección) en el móvil, para comparar con la
// maqueta: node real.mjs <salida> <id=ruta>…  → <salida>/<id>.png + dónde empieza.
import { mkdirSync } from 'node:fs'
import { chromium, contexto, BASE } from './comun.mjs'
import { PROPUESTAS } from './propuestas.mjs'
const [OUT, ...pares] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
for (const par of pares) {
  const i = par.indexOf('=')
  const id = par.slice(0, i)
  const ruta = par.slice(i + 1)
  const sel = PROPUESTAS.find((p) => p.id === id)?.contenido
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 140)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const top = sel ? await page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 }); return el ? Math.round(el.getBoundingClientRect().top / innerHeight * 100) : null }, sel) : null
  await page.screenshot({ path: `${OUT}/${id}.png` })
  console.log(`${id.padEnd(14)} ${top == null ? '¿?' : top + ' %'}${errores.length ? ' ⚠ ' + errores.join(' | ') : ''}`)
  await ctx.close()
}
await b.close()
