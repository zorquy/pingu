// Tanda 785 — bloque 6 de «PokeDoc al detalle»: la portada. PA1 el móvil más
// corto, PA2 el PC con lo de todos a la derecha, PA3 el escaparate sin cuenta.
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

console.log('── 1. Puro ──')
const { lasQueMasSuben } = await import(`${RAIZ}/js/escaparate.js`).catch(() => ({}))
if (lasQueMasSuben) {
  const r = lasQueMasSuben([
    { card_id: 'a', cm_trend: 50, cm_avg7: 60, cm_avg30: 40 },
    { card_id: 'b', cm_trend: 30, cm_avg7: 31, cm_avg30: 30 },
    { card_id: 'c', cm_trend: 20, cm_avg7: 30, cm_avg30: 10 },
    { card_id: 'd', cm_trend: 90, cm_avg7: 0, cm_avg30: 80 },
  ])
  check('las que más suben: la media de 7 días sobre la de 30, de más a menos', JSON.stringify(r.map((x) => x.id)) === '["c","a"]', JSON.stringify(r))
  check('  …y lo que sube menos de un 5 % o no tiene media, fuera', !r.some((x) => x.id === 'b' || x.id === 'd'))
} else check('escaparate.js se importa en node', false)

console.log('── 2. Estático ──')
const idx = leer('index.html')
check('PA3: botones «Crear mi cuenta» y «Ver el catálogo»', /Crear mi cuenta/.test(idx) && /href="\/cartas" class="btn-outline">Ver el catálogo/.test(idx))
check('  …las tres puertas', (idx.match(/<nav class="hero-puertas"[\s\S]*?<\/nav>/)?.[0].match(/<a /g) || []).length === 3)
check('  …y el hueco de «lo que más sube»', /id="heroSuben"/.test(idx))
check('PA2: el torneo y el lanzamiento, arriba de la columna de la derecha', /<aside class="portada-lateral">\s*<!-- S780\.201 -->\s*<section id="torneoPortadaSeccion">[\s\S]*?<section id="lanzamientoSeccion">/.test(idx))
check('  …y el torneo con los azules fijos', /\.portada-torneo \{[^}]*var\(--navy-solid-dark\), var\(--navy-solid-light\)/.test(leer('css/portada.css')))

console.log('── 3. En el navegador ──')
const b = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'none'
  window.__FAKE_CARTAS__ = ['x1', 'x2', 'x3', 'x4'].map((id, i) => ({ id, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv08/${i + 1}` }))
  window.__FAKE_PRECIOS__ = [
    { card_id: 'x1', cm_trend: 40, cm_avg7: 40, cm_avg30: 20 },
    { card_id: 'x2', cm_trend: 30, cm_avg7: 33, cm_avg30: 30 },
    { card_id: 'x3', cm_trend: 25, cm_avg7: 30, cm_avg30: 20 },
    { card_id: 'x4', cm_trend: 15, cm_avg7: 18, cm_avg30: 15 },
  ]
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => ({
    filas: [...document.querySelectorAll('#heroSuben li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    visible: !document.querySelector('.hero-suben').classList.contains('hidden'),
    fotos: [...document.querySelectorAll('.hero-portada .tcg-card img')].map((i) => i.getAttribute('src')),
    alinea: getComputedStyle(document.querySelector('.hero-portada h1')).textAlign,
  }))
  check('PA3: «lo que más sube», con las tres de verdad y su subida', r.visible && r.filas.length === 3 && /^Carta 1/.test(r.filas[0]) && /\+100 %/.test(r.filas[0]), JSON.stringify(r.filas))
  check('  …y sus escaneos en el abanico', r.fotos.length === 3 && r.fotos.every((u) => /assets\.tcgdex\.net\/.*sv08/.test(u)), JSON.stringify(r.fotos))
  check('  …con el titular a la izquierda', r.alinea !== 'center', r.alinea)
  await ctx.close()
}
{
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const m = await p.evaluate(() => ({
    guias: getComputedStyle(document.getElementById('recentGrid')).overflowX,
    top: getComputedStyle(document.getElementById('topMesSeccion')).display,
  }))
  check('PA1: en el móvil las guías van en un carrusel', m.guias === 'auto', JSON.stringify(m))
  check('  …y el top del mes no se repite con la liga', m.top === 'none', JSON.stringify(m))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
