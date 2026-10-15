// Tanda 851 — el buscador de arriba busca cartas con las reglas del de Cartas.
//
// PINGU: «busco Pikachu 277 y no encuentro nada […] en el buscador de cartas
// me sale el Pikachu de Ascended Heroes». El de arriba exigía que cada
// palabra estuviera en el NOMBRE, y «277» no lo está. Ahora comparte
// `partirBusqueda`, `entenderBusqueda` y `filtroDeNumero` con /mi-coleccion:
// un número suelto es el de la carta (o el de la Pokédex), «MEW 151» dice la
// expansión, y si por nombre no hay nada se prueba por ilustrador. Pocket,
// fuera. Se mira en /buscar y en la paleta (Ctrl+K), que van por el mismo sitio.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'none'
  const set = (id, name, code, total, serie) => ({ id, name, tcg_online_code: code, serie_id: serie, market: 'WEST', release_date: '2025-01-01', card_count_official: total, card_count_total: total })
  window.__FAKE_SETS__ = [
    set('base1', 'Set Básico', 'BS', 102, 'base'),
    set('me2pt5', 'Héroes Ascendidos', 'ASC', 217, 'me'),
    set('sv3pt5', '151', 'MEW', 165, 'sv'),
    set('A1', 'Genes Formidables', null, 226, 'tcgp'),
  ]
  const nombres = { base1: 'Set Básico', me2pt5: 'Héroes Ascendidos', sv3pt5: '151', A1: 'Genes Formidables' }
  const series = { base1: 'base', me2pt5: 'me', sv3pt5: 'sv', A1: 'tcgp' }
  const c = (setId, n, nombre, dex, artista) => ({
    id: `${setId}-${n}`, market: 'WEST', set_id: setId, local_id: String(n), name: nombre, name_es: nombre,
    image_path: `x/${setId}/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: dex, illustrator: artista,
    tcg_sets: { id: setId, name: nombres[setId], serie_id: series[setId] },
  })
  window.__FAKE_CARTAS__ = [
    c('me2pt5', 277, 'Pikachu ex', [25], 'Mitsuhiro Arita'),
    c('base1', 58, 'Pikachu', [25], 'Atsuko Nishida'),
    c('sv3pt5', 25, 'Pikachu', [25], 'Kagemaru Himeno'),
    c('sv3pt5', 151, 'Mew ex', [151], 'Ryota Murayama'),
    c('base1', 4, 'Charizard', [6], 'Mitsuhiro Arita'),
    c('A1', 277, 'Pikachu ex', [25], 'Mitsuhiro Arita'),
  ]
  window.__FAKE_PRECIOS__ = []
  window.__FAKE_GUIAS__ = []
  window.__FAKE_TEMAS__ = []
  window.__FAKE_PERFILES__ = []
}
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  // La lista de sets de la CDN no existe aquí: cae a Supabase, como en la web sin CDN.
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const cartasDe = (page) => page.$$eval('#searchResults .bs-grupo', (gs) => {
  const g = gs.find((x) => x.querySelector('.bs-seccion')?.textContent.trim() === 'Cartas')
  return g ? [...g.querySelectorAll('.bs-fila')].map((a) => a.getAttribute('href')) : []
})
const fin = (href) => (String(href).match(/(base1|me2pt5|sv3pt5|A1)-\d+$/) || [''])[0]

console.log('── 1. «Pikachu 277»: la carta 277, y la de Pocket no ──')
{
  const { page, ctx, errores } = await abrir('/buscar.html?q=Pikachu%20277')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const hs = await cartasDe(page)
  check('sale el Pikachu ex de Héroes Ascendidos (la 277)', hs.length >= 1 && fin(hs[0]) === 'me2pt5-277', JSON.stringify(hs))
  check('  …y no el de TCG Pocket, que también es la 277', !hs.some((h) => /A1-277$/.test(h)), JSON.stringify(hs))
  await ctx.close()
}

console.log('── 2. «Pikachu 25»: primero la que lleva el 25 impreso ──')
{
  const { page, ctx } = await abrir('/buscar.html?q=pikachu%2025')
  const hs = await cartasDe(page)
  check('la 25 de 151 va primera; los demás Pikachu (el 25 de la Pokédex) detrás', hs.length === 3 && fin(hs[0]) === 'sv3pt5-25', JSON.stringify(hs))
  await ctx.close()
}

console.log('── 3. «Pikachu» a secas: todos, sin Pocket ──')
{
  const { page, ctx } = await abrir('/buscar.html?q=pikachu&en=cartas')
  const hs = await cartasDe(page)
  check('los tres del TCG y ninguno de Pocket', hs.length === 3 && !hs.some((h) => /A1-/.test(h)), JSON.stringify(hs))
  await ctx.close()
}

console.log('── 4. «MEW 151»: el código dice la expansión ──')
{
  const { page, ctx } = await abrir('/buscar.html?q=MEW%20151')
  const hs = await cartasDe(page)
  check('sale el Mew ex, la 151 de 151', hs.length >= 1 && fin(hs[0]) === 'sv3pt5-151', JSON.stringify(hs))
  await ctx.close()
}

console.log('── 5. «Arita»: por ilustrador cuando el nombre no da nada ──')
{
  const { page, ctx } = await abrir('/buscar.html?q=arita&en=cartas')
  const hs = await cartasDe(page).then((l) => l.map(fin).sort())
  check('las dos de Mitsuhiro Arita del TCG', JSON.stringify(hs) === JSON.stringify(['base1-4', 'me2pt5-277']), JSON.stringify(hs))
  await ctx.close()
}

console.log('── 6. La paleta del escritorio va por el mismo sitio ──')
{
  const { page, ctx, errores } = await abrir('/index.html', { movil: false })
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(600)
  await page.keyboard.type('pikachu 277')
  await page.waitForTimeout(1200)
  const ops = await page.$$eval('#paletaLista [role="option"]', (os) => os.map((o) => o.getAttribute('href') || ''))
  check('«pikachu 277» en Ctrl+K ofrece la ficha de la 277', ops.some((h) => /me2pt5-277$/.test(h)) && !ops.some((h) => /A1-277$/.test(h)), JSON.stringify(ops))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
