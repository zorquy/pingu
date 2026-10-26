// Tanda 981 — Que la web no «suba y baje» al cargar.
//
// PINGU: «la web carga de una manera y quiero que cargue más al instante o
// sin que cargue con el esqueleto para luego destruirlo y romperlo… empieza
// y sube y baja la pantalla». Medido con herramientas/medir-saltos.mjs
// (CLS del navegador, en un iPhone, con sesión y la base retrasada 500 ms):
// 8,3 entre 32 páginas y 18 por encima de 0,1; después de la 981, 0,5 y
// ninguna. Esta prueba mira LA FORMA: ninguna página por encima de 0,1, y
// las piezas que lo consiguen.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

console.log('── 1. Lo que va en el HTML ──')
{
  const conBarra = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && leer(f).includes('id="navbar"'))
  const sinClase = conBarra.filter((f) => !/<meta name="viewport"[^>]*>\s*<script>if\(window\.matchMedia\('\(max-width: 900px\)'\)\.matches\)document\.documentElement\.classList\.add\('con-barra-movil'\)[^<]*<\/script>/.test(leer(f)))  // desde la 1023 el guion lleva también el tipo de la transición
  check(`las ${conBarra.length} páginas con barra ponen la clase del móvil en la cabecera, DESPUÉS del viewport`, conBarra.length > 30 && !sinClase.length, sinClase.join(', '))
  const sinHoja = conBarra.filter((f) => !/<link rel="stylesheet" href="\/css\/movil\.css" media="\(max-width: 900px\)">\s*<\/head>/.test(leer(f)))
  check('  …y la hoja del móvil en la cabecera, con `media`', !sinHoja.length, sinHoja.join(', '))
  check('la marca de «barra montada» ya no es la clase', /dataset\.bmMontada/.test(leer('js/barra-movil.js')))
  check('torneos y la ficha de un torneo esconden con `visibility` (ocupan su sitio)', ['torneos.html', 'torneo.html'].every((f) => /<main class="page-content container" id="torneos?Contenido" style="visibility:hidden">/.test(leer(f))))
  check('el contenido mide una pantalla (el pie empieza fuera de la vista)', /body:has\(> \.footer\) \.page-content \{[^}]*min-height: 100svh/.test(leer('css/style.css')))
  check('el degradado de abajo mide siempre lo mismo', /html\.con-barra-movil body::after \{[^}]*height: calc\(160px/.test(leer('css/movil.css')))
}

const PAGINAS = ['/index.html', '/aprender', '/noticias', '/foro', '/torneos', '/torneo?slug=torneo-0', '/mazos', '/meta', '/cartas', '/mi-coleccion',
  '/mi-coleccion?ver=cartas', '/mi-coleccion?ver=album', '/mi-coleccion?ver=pokedex', '/mi-coleccion?ver=carpetas', '/perfil', '/usuarios', '/retos', '/lanzamientos', '/ajustes', '/glosario']
console.log('\n── 2. Ninguna página salta al cargar (CLS < 0,1, móvil, sesión, base a 500 ms) ──')
const browser = await chromium.launch()
for (const ruta of PAGINAS) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
    const siempre = new Proxy({}, { get: () => 500 })
    window.__FAKE_RETRASO__ = siempre
    window.__RPC_RETRASO__ = siempre
    window.__cls = 0
    window.__fuentes = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue
        window.__cls += e.value
        if (e.value > 0.01) window.__fuentes.push(...(e.sources || []).map((s) => `${s.node?.tagName?.toLowerCase() || '?'}${s.node?.id ? '#' + s.node.id : ''}`))
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }).catch(() => {}), 500))
  const page = await ctx.newPage()
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  const { cls, fuentes } = await page.evaluate(() => ({ cls: window.__cls, fuentes: window.__fuentes }))
  check(`${ruta}: ${cls.toFixed(3)}`, cls < 0.1, [...new Set(fuentes)].join(', '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
