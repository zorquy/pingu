// Tanda 782 — bloque 3 de «PokeDoc al detalle»: SI1 una cabecera de página
// para todas y SI8 profundidad con intención (sombra solo en lo que flota).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Estático ──')
const PAGINAS = ['retos', 'mas-caro', 'carta-del-dia', 'nueve', 'laboratorio', 'repeticiones', 'noticias', 'guardados', 'mis-partidas']
for (const f of PAGINAS) check(`${f}: lleva la cabecera común`, /class="[^"]*\bcabecera-pagina\b/.test(leer(`${f}.html`)))
check('Mensajes también, en sus dos cabeceras', (leer('js/mensajes.js').match(/page-header cabecera-pagina/g) || []).length === 2)
for (const f of ['guardados', 'mis-partidas']) check(`${f}: a lo ancho, sin container-narrow`, !/container-narrow/.test(leer(`${f}.html`)))
for (const f of ['retos', 'mas-caro', 'carta-del-dia', 'nueve']) {
  const css = leer(`css/${f}.css`)
  check(`${f}.css: la cabecera ya no se centra`, !/-cabecera \{[^}]*text-align: center/.test(css))
}
check('SI8: la lista del foro de la portada, plana con separadores', /\.foro-vivo-lista > li \+ li \{\s*border-top: 1px solid var\(--border\)/.test(leer('css/portada.css')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
for (const f of ['retos', 'carta-del-dia', 'repeticiones', 'guardados']) {
  await p.goto(`${BASE}/${f}.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(() => {
    const h = document.querySelector('.cabecera-pagina h1')
    if (!h) return null
    const cs = getComputedStyle(h), cab = getComputedStyle(h.parentElement)
    return { alinea: cab.textAlign, fuente: cs.fontFamily, tam: cs.fontSize }
  })
  check(`${f}: el título a la izquierda y en Fredoka`, r && r.alinea !== 'center' && /Fredoka/i.test(r.fuente), JSON.stringify(r))
}
await p.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
const cols = await p.evaluate(() => getComputedStyle(document.getElementById('rtLista')).gridTemplateColumns.split(' ').length)
check('retos: en el PC se reparten en columnas', cols >= 2, cols)
await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
const sombra = await p.evaluate(() => {
  const n = document.createElement('div'); n.className = 'panel-lateral'; document.body.appendChild(n)
  const s = getComputedStyle(n).boxShadow; n.remove(); return s
})
check('SI8: lo que no flota no lleva sombra (el panel de la portada)', sombra === 'none', sombra)
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
