// Esquema del DOM visible de una página (móvil o pc): clase, texto y caja.
import { chromium, contexto, BASE } from './comun.mjs'
const [ruta, modo = 'movil', tope = '1800', quien = 'user-1'] = process.argv.slice(2)
const b = await chromium.launch()
const ctx = await contexto(b, modo === 'movil', quien)
const page = await ctx.newPage()
await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)
const out = await page.evaluate((tope) => {
  const lineas = []
  const rec = (el, prof) => {
    if (prof > 9) return
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return
    const r = el.getBoundingClientRect()
    const y = r.top + scrollY
    if (r.width === 0 && r.height === 0) return
    if (y > tope) return
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 40)
    const id = el.id ? `#${el.id}` : ''
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''
    const pos = cs.position !== 'static' ? ` [${cs.position}]` : ''
    lineas.push(`${' '.repeat(prof)}${el.tagName.toLowerCase()}${id}${cls}${pos} ${Math.round(r.left)},${Math.round(y)} ${Math.round(r.width)}x${Math.round(r.height)}${texto ? ' «' + texto + '»' : ''}`)
    for (const h of el.children) rec(h, prof + 1)
  }
  rec(document.body, 0)
  return lineas.join('\n')
}, Number(tope))
console.log(out)
await b.close()
