import { chromium, contexto, BASE } from '../fixtures-app.mjs'
const b = await chromium.launch()
for (const ruta of ['/mi-coleccion', '/', '/torneo?slug=torneo-1', '/foro']) {
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.coverage.startCSSCoverage(); await page.coverage.startJSCoverage({ resetOnNavigation: false })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000)
  const css = await page.coverage.stopCSSCoverage(); const js = await page.coverage.stopJSCoverage()
  const suma = (l, f) => l.filter((e) => e.url.includes('localhost')).reduce((a, e) => { const tot = f === 'css' ? e.text.length : (e.source || '').length; const usado = f === 'css' ? e.ranges.reduce((s, r) => s + r.end - r.start, 0) : e.functions.flatMap((fn) => fn.ranges.filter((r) => r.count > 0)).reduce((s, r) => Math.max(s, 0) + 0, 0); return { tot: a.tot + tot, usado: a.usado + usado } }, { tot: 0, usado: 0 })
  const c = suma(css, 'css')
  // JS: bytes de funciones ejecutadas (aprox: rango de nivel superior cuenta todo; se usan funciones con count>0 excepto la raíz)
  let jt = 0, ju = 0
  for (const e of js.filter((e) => e.url.includes('localhost'))) { const src = (e.source || '').length; jt += src; const usados = e.functions.filter((f) => f.functionName && f.ranges[0].count > 0).reduce((s, f) => s + (f.ranges[0].endOffset - f.ranges[0].startOffset), 0); ju += Math.min(src, usados) }
  console.log(`${ruta.padEnd(24)} CSS ${(c.tot / 1024).toFixed(0)} KB, usado ${(100 * c.usado / c.tot).toFixed(0)} %   JS ${(jt / 1024).toFixed(0)} KB, funciones ejecutadas ~${(100 * ju / jt).toFixed(0)} %`)
  await ctx.close()
}
await b.close()
