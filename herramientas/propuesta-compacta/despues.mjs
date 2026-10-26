// Capturas «antes / después» de la propuesta compacta: la misma página con y
// sin la inyección. node despues.mjs [id…] → prop/<id>-<antes|despues>-<movil|pc>.png
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { chromium, contexto, BASE } from './comun.mjs'
import { PROPUESTAS, COMUN } from './propuestas.mjs'
const AQUI = new URL('.', import.meta.url).pathname
mkdirSync(`${AQUI}prop`, { recursive: true })
const solo = process.argv.slice(2)
const b = await chromium.launch()
const MED = `${AQUI}medidas.json`
const medidas = existsSync(MED) ? JSON.parse(readFileSync(MED, 'utf8')) : {}
const PILDORAS = () => { document.querySelectorAll('.seg.con-pildora').forEach((s) => { const a = s.querySelector('.seg-btn[aria-pressed="true"], .seg-btn.activa, .seg-btn.active'); const p = s.querySelector('.pildora'); if (a && p) { p.style.left = a.offsetLeft + 'px'; p.style.width = a.offsetWidth + 'px'; p.style.top = a.offsetTop + 'px'; p.style.height = a.offsetHeight + 'px' } }) }
for (const p of PROPUESTAS) {
  if (solo.length && !solo.includes(p.id)) continue
  for (const movil of p.pc ? [true, false] : [true]) {
    for (const fase of ['antes', 'despues']) {
      const ctx = await contexto(b, movil, 'user-1')
      const page = await ctx.newPage()
      const errores = []
      page.on('pageerror', (e) => errores.push(String(e).slice(0, 120)))
      try {
        await page.goto(`${BASE}${p.ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(3500)
        if (fase === 'despues') {
          await page.addStyleTag({ content: COMUN })
          if (p.css) await page.addStyleTag({ content: p.css })
          if (p.js) await page.evaluate(`(${p.js})(${movil})`)
          await page.waitForTimeout(300)
          await page.waitForTimeout(500)
        }
        if (p.contenido) { const top = await page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 }); return el ? Math.round(el.getBoundingClientRect().top / innerHeight * 100) : null }, p.contenido); (medidas[p.id] ||= {})[`${fase}-${movil ? 'movil' : 'pc'}`] = top }
        await page.screenshot({ path: `${AQUI}prop/${p.id}-${fase}-${movil ? 'movil' : 'pc'}.png` })
        console.log(`${p.id} ${fase} ${movil ? 'movil' : 'pc'}${errores.length ? ` ⚠ ${errores.join(' | ')}` : ''}`)
      } catch (e) {
        console.log(`${p.id} ${fase} ${movil ? 'movil' : 'pc'}: ERROR ${String(e).slice(0, 140)}`)
      }
      await ctx.close()
    }
  }
}
await b.close()
writeFileSync(MED, JSON.stringify(medidas, null, 1))
