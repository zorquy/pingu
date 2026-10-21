// Tanda 946 — la portada es pokedoc.es/, no pokedoc.es/index.html.
//
// PINGU: «¿no está un poco feo que te meta en pokedoc.es/index.html?». Lo que
// se mira: que ningún enlace de la casa apunte a /index.html (las páginas,
// los módulos que pintan menús y la barra de abajo generada); que abrir
// /index.html deje en la barra de direcciones «/» SIN recargar y CONSERVANDO
// la consulta y el `#` (por el `#` vuelven los tokens del inicio de sesión con
// Google: perderlo es no poder entrar); y que el logo lleve a «/».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Ningún enlace de la casa a /index.html ──')
const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
const conIndex = paginas.filter((f) => /href="\/?index\.html"/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
check(`las ${paginas.length} páginas de la raíz enlazan la portada como «/»`, paginas.length > 30 && conIndex.length === 0, conIndex.join(', '))
const modulos = readdirSync(`${RAIZ}/js`).filter((f) => f.endsWith('.js'))
// Lo que se escribe en un enlace o se manda a `location`; la vuelta del inicio
// de sesión (redirectTo) va aparte, porque depende de la lista de Supabase.
const malos = modulos.filter((f) => /(href|url|i)\s*[:=]\s*['"`]\/index\.html|location\.href\s*=\s*['"`]\/index\.html|\|\|\s*['"`]\/index\.html/.test(readFileSync(`${RAIZ}/js/${f}`, 'utf8')))
check('ningún módulo pinta ni navega a /index.html', malos.length === 0, malos.join(', '))
const portada = readFileSync(`${RAIZ}/index.html`, 'utf8')
const cabeza = portada.slice(0, portada.indexOf('</head>'))
const primerModulo = portada.indexOf('type="module"')
check('la limpieza va en la cabeza de la portada, antes de cualquier módulo', /history\.replaceState\(/.test(cabeza) && (primerModulo < 0 || portada.indexOf('replaceState') < primerModulo))

console.log('── 2. Abrir /index.html ──')
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
let cargas = 0
page.on('load', () => cargas++)
await page.goto(`${BASE}/index.html?x=1#access_token=abc&type=signup`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const u = new URL(page.url())
check('la barra de direcciones dice «/»', u.pathname === '/', u.pathname)
check('  …con la consulta y el # intactos (los tokens de Google vuelven por el #)', u.search === '?x=1' && u.hash === '#access_token=abc&type=signup', u.search + u.hash)
check('  …sin recargar la página', cargas === 1, cargas)
check('  …y sin errores', errores.length === 0, errores.join(' | '))
const logo = await page.$eval('.nav-logo', (a) => a.getAttribute('href')).catch(() => null)
check('el logo lleva a «/»', logo === '/', logo)

console.log('── 3. Otra página no se toca ──')
await page.goto(`${BASE}/aprender.html?y=2`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
check('/aprender.html se queda como está', new URL(page.url()).pathname === '/aprender.html')
// La entrada del historial se SUSTITUYE: volver atrás da «/», no /index.html.
await page.goBack({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
check('volver atrás deja «/» (la entrada se sustituyó, no se añadió)', new URL(page.url()).pathname === '/', page.url())

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
