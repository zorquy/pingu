// Barrido de la 1035 (PINGU: «hay botones que se apilan, que podrían ir en
// fila, en un montón de pantallas», y títulos que repiten lo que ya dice el
// menú). Por página, en el iPhone: los grupos de 2+ botones que ocupan más de
// una fila y los títulos de lo alto, con cuánto se come lo de arriba antes del
// contenido. Escribe un JSON y una captura de la primera pantalla.
import { contexto, BASE, chromium } from '../pruebas/fixtures-app.mjs'
import { writeFileSync } from 'node:fs'
const OUT = process.argv[2] || '/tmp/barrido'
const PAGINAS = (process.argv[3] || '').split(',').filter(Boolean)
const b = await chromium.launch()
const ctx = await contexto(b, true)
const informe = []
for (const ruta of PAGINAS) {
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2800)
    const r = await page.evaluate(() => {
      const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.top < innerHeight * 1.6 }
      const pulsable = (el) => el.matches('button, a.btn-primary, a.btn-secondary, a.btn-outline, a.link-btn, a[class*="chip"], a[class*="boton"], label.mc-interruptor')
      const grupos = []
      for (const caja of document.querySelectorAll('main *, .page-content *')) {
        const hijos = [...caja.children].filter((h) => visible(h) && (pulsable(h) || (h.children.length === 1 && pulsable(h.children[0]))))
        if (hijos.length < 2 || caja.closest('nav, .barra-movil, .burbuja-movil, dialog:not([open]), .seg, [role="tablist"], [role="radiogroup"]')) continue
        if (hijos.length !== [...caja.children].filter(visible).length) continue
        const tops = [...new Set(hijos.map((h) => Math.round(h.getBoundingClientRect().top / 8)))]
        if (tops.length < 2) continue
        const ancho = hijos.reduce((a, h) => a + h.getBoundingClientRect().width, 0)
        grupos.push({ caja: `${caja.tagName.toLowerCase()}#${caja.id || ''}.${[...caja.classList].join('.')}`, filas: tops.length, n: hijos.length, textos: hijos.map((h) => h.innerText.trim().replace(/\s+/g, ' ').slice(0, 30)), top: Math.round(hijos[0].getBoundingClientRect().top), sumaAnchos: Math.round(ancho), anchoCaja: Math.round(caja.getBoundingClientRect().width) })
      }
      const titulos = [...document.querySelectorAll('main h1, main h2, .page-content h1, .page-content h2')].filter(visible).filter((h) => h.getBoundingClientRect().top < 500).map((h) => ({ tag: h.tagName, texto: h.innerText.trim().slice(0, 40), top: Math.round(h.getBoundingClientRect().top), alto: Math.round(h.getBoundingClientRect().height), clase: h.className }))
      return { grupos, titulos }
    })
    const nombre = ruta.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'portada'
    await page.screenshot({ path: `${OUT}/${nombre}.png` })
    informe.push({ ruta, nombre, ...r })
  } catch (err) {
    informe.push({ ruta, error: String(err).slice(0, 120) })
  }
  await page.close()
}
await b.close()
writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 1))
for (const p of informe) {
  console.log(`\n${p.ruta}${p.error ? ' ERROR ' + p.error : ''}`)
  for (const t of p.titulos || []) console.log(`  título ${t.tag} «${t.texto}» y=${t.top} h=${t.alto} .${t.clase}`)
  for (const g of p.grupos || []) console.log(`  APILADO ${g.filas} filas · ${g.n} botones · y=${g.top} · ${g.sumaAnchos}/${g.anchoCaja}px · ${g.caja} · ${g.textos.join(' | ')}`)
}
