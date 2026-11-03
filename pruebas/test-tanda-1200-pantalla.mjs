// Tanda 1200 — la portada del PC no se recoloca al cargar (PINGU: «carga así…
// y después se pone en su forma real y trae los datos de comunidad, y lo de
// las guías se empequeñece… debería escribirse todo a la vez»). «Comunidad»
// empezaba escondida: las guías se pintaban a lo ancho (9 columnas, cuatro
// portadas) y al llegar sus datos se encogían a 6. Ahora, con sesión, su
// hueco va reservado desde el primer pintado con su esqueleto; sin sesión o
// sin nada que enseñar, se recoge y las guías toman el ancho.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const sembrar = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const s = (tipo, m, n, datos) => ({ tipo, fecha: hace(m), username: n.toLowerCase(), display_name: n, datos })
  window.__FAKE_COMUNIDAD_SUCESOS__ = [s('perfecto', 6, 'Asierasti', { dia: '2026-11-02' }), s('perfecto', 14, 'Sylphid', { dia: '2026-11-02' }), s('mazo', 56, 'Dra Valdis', { id: 'm1', nombre: 'Dragapult ex' })]
}
// Apunta cada ancho que toma el bloque de guías y si «Comunidad» ocupa sitio,
// desde el primer pintado (antes de que llegue ningún dato).
const vigilar = () => {
  window.__anchos = []
  window.__comunidadAlPrincipio = null
  const mirar = () => {
    const g = document.getElementById('recientesSeccion')
    const c = document.getElementById('homeActivity')
    if (!g) return requestAnimationFrame(mirar)
    if (window.__comunidadAlPrincipio === null && c) window.__comunidadAlPrincipio = c.getBoundingClientRect().width
    new ResizeObserver(() => { const w = Math.round(g.getBoundingClientRect().width); if (w && window.__anchos.at(-1) !== w) window.__anchos.push(w) }).observe(g)
  }
  document.addEventListener('DOMContentLoaded', mirar)
}
const b = await chromium.launch()

for (const [nombre, quien, extra, conComunidad] of [['con sesión', 'user-1', sembrar, true], ['sin sesión', 'none', () => {}, false]]) {
  console.log(`── PC, ${nombre} ──`)
  const ctx = await contexto(b, false, quien, extra)
  await ctx.addInitScript(vigilar)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => ({ anchos: window.__anchos, alPrincipio: window.__comunidadAlPrincipio, comunidad: (() => { const c = document.getElementById('homeActivity'); return c && getComputedStyle(c).display !== 'none' ? Math.round(c.getBoundingClientRect().width) : 0 })(), texto: document.getElementById('homeActivityFeed')?.textContent || '' }))
  check('las guías tienen UN solo ancho de principio a fin', r.anchos.length === 1, JSON.stringify(r.anchos))
  if (conComunidad) {
    check('  …y «Comunidad» ocupa su sitio desde el primer pintado', r.alPrincipio > 100, r.alPrincipio)
    check('  …y acaba con sus datos', r.comunidad > 100 && /Comunidad/.test(r.texto), JSON.stringify({ c: r.comunidad }))
  } else {
    check('  …y sin sesión no hay «Comunidad» (ni su hueco)', !r.alPrincipio && !r.comunidad, JSON.stringify(r))
  }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
