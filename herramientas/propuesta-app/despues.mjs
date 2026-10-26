// Capturas «antes / después» por propuesta: la misma página y el mismo punto,
// con y sin la inyección (CSS + un poco de DOM) que dibuja la propuesta.
//   node despues.mjs [id…]            → prop/<id>-<antes|despues>-<movil|pc>.png
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './comun.mjs'
import { PROPUESTAS, SHELL } from './propuestas.mjs'
const AQUI = new URL('.', import.meta.url).pathname
mkdirSync(`${AQUI}prop`, { recursive: true })
const solo = process.argv.slice(2)
const b = await chromium.launch()
for (const p of PROPUESTAS) {
  if (solo.length && !solo.includes(p.id)) continue
  for (const movil of process.env.SOLO_MOVIL ? [true] : [true, false]) {
    if (p.solo && p.solo !== (movil ? 'movil' : 'pc')) continue
    for (const fase of ['antes', 'despues']) {
      const ctx = await contexto(b, movil, p.quien || 'user-1', p.extra || null)
      const page = await ctx.newPage()
      const errores = []
      page.on('pageerror', (e) => errores.push(String(e).slice(0, 120)))
      try {
        await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(p.espera || 3000)
        if (fase === 'despues') {
          // El esqueleto común de la app (la burbuja fuera, pestañas arriba…) y
          // lo de la propuesta, en ese orden.
          if (movil && p.shell !== false) { await page.addStyleTag({ content: SHELL.css }); await page.evaluate(SHELL.js) }
          if (p.fuentes) { await page.addStyleTag({ content: readFileSync(`${AQUI}fuentes/${p.fuentes.split(':')[0]}.inline.css`, 'utf8') }); await page.evaluate(() => document.fonts.ready) }
          if (p.cssPc && !movil) await page.addStyleTag({ content: p.cssPc })
          if (p.css) await page.addStyleTag({ content: p.css })
          if (p.js) await page.evaluate(p.js, movil)
          await page.waitForTimeout(p.tras || 600)
        }
        const y = (p.scroll || {})[movil ? 'movil' : 'pc'] || 0
        if (y) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(900) }
        await page.screenshot({ path: `${AQUI}prop/${p.id}-${fase}-${movil ? 'movil' : 'pc'}.png`, fullPage: Boolean(p.entera) })
        console.log(`${p.id} ${fase} ${movil ? 'movil' : 'pc'}${errores.length ? ` ⚠ ${errores.join(' | ')}` : ''}`)
      } catch (e) {
        console.log(`${p.id} ${fase} ${movil ? 'movil' : 'pc'}: ERROR ${String(e).slice(0, 140)}`)
      }
      await ctx.close()
    }
  }
}
await b.close()
