// Tanda 780 — el bloque 1 de «PokeDoc al detalle»: hacer sitio y lo pequeño.
//
// LO1 (en la lista, «Media portada son comentarios»): los porqués largos de
// style.css, components.css, portada.css e index.html, a SCHEMA (eran 65 de
// los 169 KB de la portada). LO5 «Bronce», LO6 la racha una vez, LO4 la
// burbuja de Mi colección centra la activa, LO9 los callejones (curso sin
// curso, carta del día sin día, debilidad «—» que no se sabe), MV11 la barra
// del aviso con Deshacer, PA19 el degradado bajo la burbuja, PA20 el pie corto.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Sin comentarios largos en la portada (LO1) ──')
for (const f of ['css/style.css', 'css/components.css', 'css/portada.css']) {
  const largos = (leer(f).match(/\/\*[\s\S]*?\*\//g) || []).filter((c) => c.includes('\n') || c.length > 110)
  check(`${f}: ningún comentario de más de una línea`, largos.length === 0, largos[0])
}
const idx = leer('index.html')
const largosHtml = (idx.match(/<!--[\s\S]*?-->/g) || []).filter((c) => (c.includes('\n') || c.length > 110) && !/<!--\s*\/?(meta-social|articulo|barra-movil)/.test(c))
check('index.html: ningún comentario largo (los marcadores se quedan)', largosHtml.length === 0, largosHtml[0])
check('  …y los marcadores de meta-social y la barra siguen', /<!-- meta-social:inicio -->/.test(idx) && /<!-- \/barra-movil -->/.test(idx))
check('el porqué vive en SCHEMA (S780.1 en adelante)', /\*\*S780\.1\*\*/.test(leer('SCHEMA.md')))

console.log('── 2. Lo pequeño ──')
const guia = leer('js/guia.js')
check('guía: la rareza con su nombre en español (LO5)', /NOMBRE_RAREZA\s*=\s*\{\s*bronze:\s*'Bronce'/.test(guia) && !/escapeHtml\(guide\.guide_rarity/.test(guia))
check('portada: la racha del saludo, solo en el móvil (LO6)', /racha > 0 && matchMedia\('\(max-width: 900px\)'\)\.matches/.test(leer('js/home.js')))
const curso = leer('js/curso.js')
check('/curso sin curso va a Aprender (LO9)', /if \(!slug\) \{\s*location\.replace\('\/aprender'\)/.test(curso) && !/Curso no encontrado/.test(curso))
check('carta del día sin día ni carta: el aviso de siempre (LO9)', /!r\.dia \|\| !r\.carta/.test(leer('js/carta-del-dia-juego.js')))
check('ficha: debilidad y resistencia que no se saben, sin pintar (LO9)', /if \(!Array\.isArray\(filas\)\) return ''/.test(leer('js/carta-nucleo.js')))

console.log('── 3. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { avisoConDeshacer } = await import('/js/mi-coleccion/deshacer.js')
    avisoConDeshacer({ html: 'Quitada', alDeshacer: () => {}, segundos: 6 })
    const el = document.querySelector('.mc-deshacer')
    el.dispatchEvent(new PointerEvent('pointerenter'))
    const parado = el.classList.contains('parado')
    el.dispatchEvent(new PointerEvent('pointerleave'))
    return { barra: Boolean(el.querySelector('.mc-deshacer-tiempo')), duracion: el.querySelector('.mc-deshacer-tiempo')?.style.animationDuration, parado, sigue: el.classList.contains('parado') }
  })
  check('el aviso con Deshacer lleva su barra de tiempo (MV11)', r.barra && r.duracion === '6s', JSON.stringify(r))
  check('  …que se para al pasar por encima y sigue al salir', r.parado && !r.sigue, JSON.stringify(r))
  await p.close()
}
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const v = await p.evaluate(() => {
    const m = document.getElementById('mcMenu'), a = m?.querySelector('[data-pestania].activa')
    if (!m || !a) return null
    const rm = m.getBoundingClientRect(), ra = a.getBoundingClientRect()
    return { dentro: ra.left >= rm.left - 1 && ra.right <= rm.right + 1, cual: a.dataset.pestania }
  })
  check('en Buscar, la pestaña marcada se ve entera en la burbuja (LO4)', v?.dentro === true, JSON.stringify(v))
  const fondo = await p.evaluate(() => getComputedStyle(document.body, '::after').backgroundImage)
  check('el degradado bajo la burbuja (PA19)', /linear-gradient/.test(fondo), fondo)
  await p.goto(`${BASE}/aprender.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const pie = await p.evaluate(() => document.querySelector('.pie-rejilla')?.getBoundingClientRect().height || 0)
  check('el pie del móvil, corto (PA20: menos de 480 px)', pie > 0 && pie < 480, `${Math.round(pie)} px`)
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
