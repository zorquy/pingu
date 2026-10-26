// Lo de arriba de una página en el móvil, sin svg: etiqueta.clase caja «texto».
import { chromium, contexto, BASE } from './comun.mjs'
const [tope = '520', ...rutas] = process.argv.slice(2)
const b = await chromium.launch()
for (const ruta of rutas) {
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  const out = await page.evaluate((tope) => {
    const L = []
    const rec = (el, p) => {
      if (/^(svg|path|circle|line|rect|polyline|i|b|br|option)$/i.test(el.tagName) || el.matches('nav#navbar, .barra-movil, .bm, .burbuja-movil, .bm-burbuja, footer, script, style')) return
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return
      const r = el.getBoundingClientRect()
      if (r.top + scrollY > tope) return
      if (r.width < 2 && r.height < 2 && !el.children.length) return
      const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 30)
      const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
      L.push(`${' '.repeat(p)}${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}${t ? ' «' + t + '»' : ''}`)
      if (p < 9) for (const h of el.children) rec(h, p + 1)
    }
    rec(document.querySelector('main') || document.body, 0)
    return L.join('\n')
  }, Number(tope))
  console.log(`\n===== ${ruta}\n${out}`)
  await ctx.close()
}
await b.close()
