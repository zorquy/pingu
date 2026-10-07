// Tanda 721 — el meta con sprites y el color de su tipo (J3 de la lista de
// propuestas, elegida por PINGU).
//
// Lo que se mira: que el tipo de cada arquetipo salga de las CARTAS de su
// especie (el más repetido, no el primero que aparezca); que la barra de
// uso lleve ese color —e Incoloro no tiña, que no se vería—; que mientras
// no se sabe vaya en el azul de siempre; que en el móvil la barra también
// esté; y que las victorias se lean bien (más grandes que la tendencia).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { tipoMasRepetido, dexDeIcono } = await import(`${RAIZ}/js/meta/datos.js`).catch(() => ({}))

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. El tipo sale de las cartas ──')
if (tipoMasRepetido) {
  const cartas = [{ dex_ids: [6], types: ['Fire'] }, { dex_ids: [6], types: ['Darkness'] }, { dex_ids: [6], types: ['Fire'] }, { dex_ids: [9], types: ['Water'] }]
  check('el más repetido de su especie, no el primero', tipoMasRepetido(cartas, 6) === 'Fire')
  check('sin cartas de esa especie, no se sabe', tipoMasRepetido(cartas, 25) === null)
  check('del icono a la especie: «charizard» es la 6, «dragapult» la 887', dexDeIcono('charizard') === 6 && dexDeIcono('dragapult') === 887, `${dexDeIcono('charizard')} ${dexDeIcono('dragapult')}`)
} else check('se puede importar js/meta/datos.js sin navegador', false, 'importa supabase.js: se prueba solo en la pantalla')

const browser = await chromium.launch()
const META = [
  { arquetipo: 'charizard-pidgeot', nombre: 'Charizard Pidgeot', iconos: ['charizard', 'pidgeot'], mazos: 120, top8: 30, cuota: 14.2, cuota_anterior: 12, victorias: 300, derrotas: 250, empates: 10, porcentaje_victorias: 54.1 },
  { arquetipo: 'dragapult', nombre: 'Dragapult ex', iconos: ['dragapult'], mazos: 90, top8: 20, cuota: 10.4, cuota_anterior: 11, victorias: 200, derrotas: 210, empates: 5, porcentaje_victorias: 48.9 },
  { arquetipo: 'lugia', nombre: 'Lugia Archeops', iconos: ['lugia'], mazos: 60, top8: 9, cuota: 6.1, cuota_anterior: 6, victorias: 100, derrotas: 100, empates: 0, porcentaje_victorias: 50 },
]
const semilla = ({ meta }) => {
  window.__RPC_RESPUESTAS__ = { meta_resumen: meta, meta_totales: [{ torneos: 12, jugadores: 800, online: 12, ultima_lectura: new Date().toISOString() }] }
  const c = (id, dex, tipo) => ({ id, market: 'WEST', set_id: 'sv3', local_id: id.split('-')[1], name: id, dex_ids: [dex], types: [tipo] })
  window.__FAKE_CARTAS__ = [c('sv3-1', 6, 'Fire'), c('sv3-2', 6, 'Darkness'), c('sv3-3', 6, 'Fire'), c('sv6-1', 887, 'Dragon'), c('sv2-1', 249, 'Colorless')]
}
async function abrir(movil) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { meta: META })
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/meta.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
const barras = (page) => page.$$eval('#metaRanking .meta-fila', (fs) => fs.map((f) => {
  const b = f.querySelector('.meta-barra')
  const i = b?.querySelector('i')
  return { nombre: f.querySelector('.meta-nombre strong')?.textContent, tipo: b?.dataset.tipo || null, color: i ? getComputedStyle(i).backgroundColor : null, ve: !!b && b.getBoundingClientRect().width > 40 && getComputedStyle(b).display !== 'none' }
}))

console.log('── 2. En el escritorio ──')
{
  const { page, ctx, errores } = await abrir(false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const bs = await barras(page)
  const ch = bs.find((b) => /Charizard/.test(b.nombre))
  const dr = bs.find((b) => /Dragapult/.test(b.nombre))
  const lu = bs.find((b) => /Lugia/.test(b.nombre))
  check('Charizard: barra de Fuego (el tipo más repetido de sus cartas)', ch?.tipo === 'Fire' && ch.color === 'rgb(232, 86, 74)', JSON.stringify(ch))
  check('Dragapult: de Dragón', dr?.tipo === 'Dragon' && dr.color === 'rgb(181, 148, 51)', JSON.stringify(dr))
  // Desde la 748 Incoloro también tiñe, con un gris que se ve (PINGU: «hay
  // otros que no tienen color»); el casi blanco de la ficha no se vería.
  check('Lugia (Incoloro): en su gris, que se ve', lu?.tipo === 'Colorless' && lu.color === 'rgb(154, 151, 140)', JSON.stringify(lu))
  const tallas = await page.$eval('#metaRanking .meta-fila', (f) => ({ v: parseFloat(getComputedStyle(f.querySelector('.meta-victorias')).fontSize), t: parseFloat(getComputedStyle(f.querySelector('.meta-tend')).fontSize) }))
  check('las victorias, más grandes que la tendencia', tallas.v > tallas.t, JSON.stringify(tallas))
  await ctx.close()
}

console.log('── 3. En un iPhone la barra también está ──')
{
  const { page, ctx, errores } = await abrir(true)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const bs = await barras(page)
  check('cada fila con su barra a la vista', bs.length === 3 && bs.every((b) => b.ve), JSON.stringify(bs))
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('  …sin que la página se vaya de ancho', ancho <= 1, String(ancho))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
