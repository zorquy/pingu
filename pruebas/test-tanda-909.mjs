// Tanda 909 — el buscador de arriba ES el de Cartas.
//
// Sergio, en el foro: «soy coleccionista de Zapdos y cuando he buscado por
// carta no aparece la de 151. Sin embargo si la buscas de manera individual
// sí». /buscar tenía su copia del buscador «con las mismas reglas» (851) y
// otro tope y otro orden: 24 por orden alfabético, así que con muchos Zapdos
// se quedaba en los Galarian, los de Rocket y los «Moltres & Zapdos», y el
// Zapdos ex de 151 no llegaba nunca. PINGU: que use la función del buscador
// de Cartas. Ahora las dos pantallas llaman a js/buscar-cartas.js, con el
// mismo tope (120) y por expansión, de la más nueva a la más vieja.
//
// Se mira: que salgan las tres de 151 con muchos Zapdos delante en el
// alfabeto; que «Todo» enseñe las de la expansión más nueva y diga cuántas
// hay; que «Cartas» las agrupe por expansión como /cartas; que /buscar y
// /cartas devuelvan LAS MISMAS cartas; y que ya no quede una segunda copia
// de la consulta en ninguna de las dos.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const semilla = () => {
  window.__FAKE_SESSION__ = 'none'
  const sets = [
    ['30c', '30th Celebration', '2026-09-16', 'me'],
    ['sv10', 'Destined Rivals', '2025-05-30', 'sv'],
    ['sv3pt5', '151', '2023-09-22', 'sv'],
    ['pp2', 'Prize Pack Series Two', '2022-03-01', 'swsh'],
    ['pp1', 'Prize Pack Series One', '2021-08-01', 'swsh'],
    ['sm115', 'Hidden Fates', '2019-08-23', 'sm'],
    ['gym2', 'Gym Challenge', '2000-10-16', 'base'],
  ]
  // Muchos sets viejos con un «Galarian Zapdos»: van antes que «Zapdos ex»
  // en el alfabeto, que es lo que dejaba fuera a los de 151.
  for (let i = 0; i < 30; i++) sets.push([`viejo${i}`, `Set viejo ${i}`, `2010-01-${String(i % 28 + 1).padStart(2, '0')}`, 'bw'])
  window.__FAKE_SETS__ = sets.map(([id, name, release_date, serie_id]) => ({ id, name, release_date, serie_id, market: 'WEST', card_count_official: 100, card_count_total: 100 }))
  const porId = Object.fromEntries(sets.map(([id, name, release_date, serie_id]) => [id, { id, name, release_date, serie_id }]))
  const c = (setId, n, nombre) => ({
    id: `${setId}-${n}`, market: 'WEST', set_id: setId, local_id: String(n), name: nombre, name_es: nombre,
    image_path: `x/${setId}/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [145], illustrator: 'Alguien',
    tcg_sets: porId[setId],
  })
  window.__FAKE_CARTAS__ = [
    c('30c', 12, 'Zapdos'),
    c('sv10', 70, "Team Rocket's Zapdos"),
    c('sv3pt5', 145, 'Zapdos ex'),
    c('sv3pt5', 192, 'Zapdos ex'),
    c('sv3pt5', 202, 'Zapdos ex'),
    c('pp2', 82, 'Galarian Zapdos'),
    c('pp1', 82, 'Galarian Zapdos'),
    c('sm115', 44, 'Moltres & Zapdos & Articuno GX'),
    c('gym2', 15, "Rocket's Zapdos"),
    ...Array.from({ length: 30 }, (_, i) => c(`viejo${i}`, i + 1, 'Galarian Zapdos')),
  ]
  window.__FAKE_PRECIOS__ = []
  window.__FAKE_GUIAS__ = []
  window.__FAKE_TEMAS__ = []
  window.__FAKE_PERFILES__ = []
}

const browser = await chromium.launch()
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, ctx, errores }
}
const idDe = (href) => (String(href).match(/([a-z0-9]+)-(\d+)$/) || [''])[0]
const TOTAL = 39

console.log('── 1. Solo cartas: las tres de 151, todas, por expansión ──')
// Desde la 972 «solo cartas» ES Cartas › Buscar: /buscar?en=cartas lleva
// allí con la búsqueda puesta (B3), así que se mira en esa pantalla.
let deBuscar = []
{
  const { page, ctx, errores } = await abrir('/buscar.html?q=zapdos&en=cartas')
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('«solo cartas» lleva a Cartas › Buscar con la búsqueda puesta', /\/cartas\?ver=buscar&q=zapdos$/.test(page.url()), page.url())
  const hs = await page.$$eval('#mcBuscarResultados .mc-resultado', (as) => [...new Set(as.map((a) => a.dataset.carta))])
  deBuscar = hs
  check('salen los tres Zapdos ex de 151', ['sv3pt5-145', 'sv3pt5-192', 'sv3pt5-202'].every((x) => hs.includes(x)), JSON.stringify(hs.slice(0, 8)))
  check(`salen todas (${TOTAL}), no las 24 de antes`, hs.length === TOTAL, hs.length)
  await ctx.close()
}

console.log('── 2. «Todo»: las de la expansión más nueva, y cuántas hay ──')
{
  const { page, ctx, errores } = await abrir('/buscar.html?q=zapdos', { movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const hs = (await page.$$eval('#searchResults .bs-fila.bs-cartas', (as) => as.map((a) => a.getAttribute('href')))).map(idDe)
  check('cuatro, empezando por la más nueva (30th Celebration)', hs.length === 4 && hs[0] === '30c-12', JSON.stringify(hs))
  check('  …y la de 151 entre ellas', hs.includes('sv3pt5-145'), JSON.stringify(hs))
  // Desde la 968 el botón lleva DIRECTO a Cartas › Buscar (Sergio: eran
  // tres pasos para llegar a la misma pantalla).
  const boton = page.locator('#searchResults a.bs-mas')
  const texto = (await boton.textContent().catch(() => '')).trim()
  check(`el botón dice «Ver las ${TOTAL} cartas»`, texto === `Ver las ${TOTAL} cartas`, texto)
  check('  …y lleva a Cartas › Buscar con la búsqueda puesta', (await boton.getAttribute('href')) === '/cartas?ver=buscar&q=zapdos', await boton.getAttribute('href'))
  // 972: la chapa «Cartas» también lleva allí, y dice cuántas hay.
  const chapa = (await page.textContent('#bsChips [data-grupo="cartas"]')).replace(/\s+/g, ' ').trim()
  check(`la chapa «Cartas» dice ${TOTAL}`, chapa.replace(/\s/g, "") === `Cartas${TOTAL}`, chapa)
  await Promise.all([page.waitForURL(/\/cartas\?ver=buscar/, { timeout: 8000 }).catch(() => {}), page.click('#bsChips [data-grupo="cartas"]')])
  check('  …y lleva a Cartas › Buscar', /\/cartas\?ver=buscar&q=zapdos$/.test(page.url()), page.url())
  await ctx.close()
}

console.log('── 4. Una consulta, no dos ──')
{
  const buscador = readFileSync(`${RAIZ}/js/buscador.js`, 'utf8')
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  const comun = readFileSync(`${RAIZ}/js/buscar-cartas.js`, 'utf8')
  check('buscador.js llama a buscarComoEnCartas', /import \{[^}]*\bbuscarComoEnCartas\b[^}]*\} from '\.\/buscar-cartas\.js'/.test(buscador))
  check('  …y no pregunta él a tcg_cards', !/from\('tcg_cards'\)/.test(buscador))
  check('mi-coleccion.js busca con el mismo módulo', /from '\.\/buscar-cartas\.js'/.test(mc) && /buscarComoEnCartas\(/.test(mc))
  check('  …y ya no lleva su copia de la consulta por nombre', !/like\('name_search'/.test(mc) && !/name_search\.like/.test(mc))
  check('la consulta vive en buscar-cartas.js', /like\('name_search'/.test(comun) && /ilike\('illustrator'/.test(comun))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
