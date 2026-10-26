// Tanda 1018 — el color de cada sección (propuesta «PokeDoc como app», C;
// PINGU: «me ha gustado que le pongas colores al menú según el apartado»):
// la barra de abajo, la burbuja, la lateral y el botón principal llevan el
// color de la sección, que viene de `data-seccion` en <html> (lo escribe el
// generador) y de `--acento` / `--acento-texto` en los dos temas. Lo que se
// vigila: que cada color pase el contraste con su texto y como texto sobre
// la superficie, en claro y en oscuro; y que en pantalla la barra, la
// burbuja y el botón se pinten con él.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contraste = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
const largo = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h)

console.log('── 1. Los tokens ──')
const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8')
const SECCIONES = ['aprender', 'cartas', 'comunidad', 'jugar']
{
  check('--acento y --acento-texto nacen en :root (navy y blanco fijo)', /--acento: var\(--navy-solid\);\s*--acento-texto: var\(--blanco-fijo\);/.test(css))
  const claro = Object.fromEntries(SECCIONES.map((s) => [s, css.match(new RegExp(`html\\[data-seccion='${s}'\\] \\{ --acento: (#[0-9a-f]{3,6}); \\}`))?.[1]]))
  const oscuro = Object.fromEntries(SECCIONES.map((s) => [s, css.match(new RegExp(`:root\\[data-theme='dark'\\]\\[data-seccion='${s}'\\] \\{ --acento: (#[0-9a-f]{3,6}); --acento-texto: (#[0-9a-f]{3,6}); \\}`))?.slice(1)]))
  check('las cuatro secciones tienen su color en claro y en oscuro (con su texto)', SECCIONES.every((s) => claro[s] && oscuro[s]), JSON.stringify({ claro, oscuro }))
  const superficieClara = '#ffffff', fondoClaro = '#f6f8fa', superficieOscura = '#1a2733', fondoOscuro = '#0b1219'
  for (const s of SECCIONES) {
    if (!claro[s] || !oscuro[s]) continue
    const c = largo(claro[s]), [o, ot] = oscuro[s].map(largo)
    check(`${s} claro: blanco encima ≥ 4,5 y como texto sobre la superficie ≥ 4,5`, contraste(c, '#ffffff') >= 4.5 && contraste(c, superficieClara) >= 4.5 && contraste(c, fondoClaro) >= 4.5, `${c}: ${contraste(c, '#ffffff').toFixed(2)} / ${contraste(c, fondoClaro).toFixed(2)}`)
    check(`${s} oscuro: su texto encima ≥ 4,5 y como texto sobre la superficie ≥ 4,5`, contraste(o, ot) >= 4.5 && contraste(o, superficieOscura) >= 4.5 && contraste(o, fondoOscuro) >= 4.5, `${o}/${ot}: ${contraste(o, ot).toFixed(2)} / ${contraste(o, superficieOscura).toFixed(2)}`)
  }
  check('el botón principal y la barra de abajo piden --acento', /\.btn-primary \{\s*background: var\(--acento\);\s*color: var\(--acento-texto\);/.test(css) && /\.bm a\[aria-current='page'\] \{\s*color: var\(--acento\);/.test(css))
  const movil = readFileSync(`${RAIZ}/css/movil.css`, 'utf8'), mc = readFileSync(`${RAIZ}/css/mi-coleccion.css`, 'utf8'), lat = readFileSync(`${RAIZ}/css/lateral.css`, 'utf8')
  check('la burbuja, la de Mi colección y la lateral también', /\.bm-burbuja-item\[aria-current='page'\] \{\s*background: var\(--acento\);/.test(movil) && /\.mc-pestanias \.pildora \{\s*background: var\(--acento\);/.test(mc) && /\.lat-activa > \.lat-seccion-enlace \{\s*color: var\(--acento\);/.test(lat))
  check('el token no se pide con respaldo en ninguna hoja (310)', !/var\(--acento,/.test(css + movil + mc + lat))
}

console.log('\n── 2. En pantalla ──')
const b = await chromium.launch()
const rgb = (hex) => { const h = largo(hex); return `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})` }
async function colores(ruta, tema, movil) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((tema) => { window.__FAKE_SESSION__ = 'user-1'; localStorage.setItem('pokedoc-theme', tema); localStorage.setItem('pokedoc-onboarding', '1') }, tema)
  const p = await ctx.newPage()
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const c = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null }
    return { seccion: document.documentElement.dataset.seccion, tema: document.documentElement.dataset.theme, barra: c('.bm a[aria-current="page"]', 'color'), burbuja: c('.bm-burbuja-item[aria-current="page"], .mc-pestanias .pildora', 'backgroundColor'), boton: c('.btn-primary', 'backgroundColor'), lateral: c('.lat-activa .lat-seccion-enlace', 'color') }
  })
  await ctx.close()
  return r
}
{
  const r = await colores('/aprender.html', 'dark', true)
  check('Aprender en oscuro (móvil): barra, burbuja y botón en el verde de la sección', r.seccion === 'aprender' && r.barra === rgb('#2fb47c') && r.burbuja === rgb('#2fb47c') && r.boton === rgb('#2fb47c'), JSON.stringify(r))
}
{
  const r = await colores('/torneos.html', 'light', true)
  check('Torneos en claro (móvil): el violeta oscuro', r.seccion === 'jugar' && r.barra === rgb('#5f43d9') && r.boton === rgb('#5f43d9'), JSON.stringify(r))
}
{
  const r = await colores('/mi-coleccion.html?ver=cartas', 'dark', true)
  check('Mi colección en oscuro: la píldora de la burbuja en ámbar', r.seccion === 'cartas' && r.burbuja === rgb('#e4b44a'), JSON.stringify(r))
}
{
  const r = await colores('/foro.html', 'dark', false)
  check('El foro en el PC: la sección activa de la lateral en rosa', r.seccion === 'comunidad' && r.lateral === rgb('#f06c9b'), JSON.stringify(r))
}
{
  const r = await colores('/index.html', 'light', true)
  check('La portada: el azul de siempre', r.seccion === 'inicio' && r.barra === rgb('#1e5175'), JSON.stringify(r))
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
