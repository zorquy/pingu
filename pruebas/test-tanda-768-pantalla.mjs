// Tanda 768 — el buscador de «La quiero».
//
// PINGU: «el buscador no funciona, solo busca unas pocas cartas, no todas,
// y no puedes escoger si son japonesas o no; mejórame la interfaz». Pedía
// 24 por orden alfabético en el catálogo de la página. Lo que se mira: que
// encuentre TODAS (hasta el tope de Buscar), por expansión y con su logo;
// que entienda «151/165» y el ilustrador; que tenga su catálogo propio
// (occidental o japonés) sin cambiar el de la página; que apuntar una
// japonesa la apunte en japonés; y que lo que escribes no se borre cuando
// la lista se repinta.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

// Cuarenta Charizard en cuatro expansiones: con el tope de antes (24) no
// salían todas.
const SETS = [
  { id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102, tcg_online_code: 'BS', logo_tcggo: 'https://images.tcggo.com/logo-base1.png' },
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcg_online_code: 'OBF', logo_tcggo: 'https://images.tcggo.com/logo-sv3.png' },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207, tcg_online_code: 'MEW' },
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203, card_count_total: 237, tcg_online_code: 'EVS' },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165, card_count_total: 210 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [
  ...Array.from({ length: 10 }, (_, i) => carta(`base1-c${i}`, 'base1', 100 + i, 'Charizard')),
  ...Array.from({ length: 10 }, (_, i) => carta(`sv3-c${i}`, 'sv3', 120 + i, 'Charizard ex')),
  ...Array.from({ length: 10 }, (_, i) => carta(`sv3pt5-c${i}`, 'sv3pt5', 180 + i, 'Charizard ex')),
  ...Array.from({ length: 10 }, (_, i) => carta(`swsh7-c${i}`, 'swsh7', 200 + i, 'Charizard VMAX')),
  carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'),
  carta('sv3-50', 'sv3', 50, 'Pidgey', { illustrator: 'Mitsuhiro Arita' }),
  carta('SV2a-6', 'SV2a', '006', 'リザードン', { name_en: 'Charizard' }),
]
const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv3-50', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_DESEOS__ = [{ id: 'd1', user_id: 'admin-1', card_id: 'base1-c0', idioma: null, prioridad: 2, created_at: '2026-10-01T10:00:00Z' }]
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /logo/.test(r.request().url()) ? '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=quiero`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { ctx, page, errores }
}
const buscar = async (page, q) => { await page.fill('#mcDeseoBuscar', q); await page.waitForTimeout(1300) }
const ids = (page) => page.$$eval('#mcDeseoResultados [data-desear]', (bs) => bs.map((b) => b.dataset.desear))

console.log('── 1. Encuentra todas, por expansión ──')
{
  const { ctx, page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el buscador, con su lupa y el catálogo al lado', (await page.locator('#mcDeseoAlta .mc-buscador #mcDeseoBuscar').count()) === 1 && (await page.getAttribute('[data-deseo-mercado="WEST"]', 'aria-pressed')) === 'true')
  await buscar(page, 'charizard')
  const todas = await ids(page)
  check('las cuarenta Charizard, y no 24', todas.length === 40, String(todas.length))
  const grupos = await page.$$eval('#mcDeseoResultados .mc-bus-grupo', (gs) => gs.map((g) => `${g.textContent.replace(/\s+/g, ' ').trim()}|${g.querySelector('img') ? 'logo' : ''}`))
  check('  …en cuatro grupos, de la más nueva a la más vieja, con su logo', grupos.length === 4 && /^151/.test(grupos[0]) && /^Set Básico.*\|logo$/.test(grupos[3]) && /^Obsidiana.*\|logo$/.test(grupos[1]), JSON.stringify(grupos))
  check('  …la que ya buscas, desactivada y dicho', await page.$eval('#mcDeseoResultados [data-desear="base1-c0"]', (b) => b.disabled && /Ya la buscas/.test(b.textContent)))
  check('  …y cuántas son', /40 cartas/.test(await page.textContent('#mcDeseoCuantas')), await page.textContent('#mcDeseoCuantas'))
  if (CAPS) await page.screenshot({ path: `${CAPS}/768-buscar.png` })
  await buscar(page, '151/165')
  check('«151/165»: la de esa expansión', (await ids(page)).join() === 'sv3pt5-151', JSON.stringify(await ids(page)))
  await buscar(page, 'Mitsuhiro Arita')
  check('y por ilustrador, si por nombre no sale nada', (await ids(page)).join() === 'sv3-50', JSON.stringify(await ids(page)))

  console.log('── 2. Apuntar, y lo escrito se queda ──')
  await buscar(page, 'charizard vmax')
  await page.click('#mcDeseoResultados [data-desear="swsh7-c3"]')
  // Desde la 771 pregunta el idioma; «Cualquiera» va marcado.
  await page.waitForTimeout(400)
  await page.click('#iddApuntar')
  await page.waitForTimeout(1500)
  const fila = await page.evaluate(() => window.__TABLAS__.user_wants.find((d) => d.card_id === 'swsh7-c3'))
  check('se apunta en «cualquier idioma»', fila && fila.idioma == null, JSON.stringify(fila))
  check('  …sale en la lista', (await page.locator('#mcQuieroPanel .mc-deseo-baldosa').count()) === 2)
  check('  …y la búsqueda se queda, con esa ya marcada', (await page.inputValue('#mcDeseoBuscar')) === 'charizard vmax' && (await page.$eval('#mcDeseoResultados [data-desear="swsh7-c3"]', (b) => b.disabled)))

  console.log('── 3. El catálogo japonés, sin cambiar el de la página ──')
  await page.click('[data-deseo-mercado="JP"]')
  await page.waitForTimeout(1300)
  check('el buscador pasa a Pokémon Japón', (await page.getAttribute('[data-deseo-mercado="JP"]', 'aria-pressed')) === 'true')
  await buscar(page, 'charizard')
  check('  …y encuentra la japonesa por su nombre inglés', (await ids(page)).join() === 'SV2a-6', JSON.stringify(await ids(page)))
  check('  …sin tocar el catálogo de la página', (await page.locator('.mc-mercado').first().evaluate((n) => n.value)) === 'es')
  await page.click('#mcDeseoResultados [data-desear="SV2a-6"]')
  await page.waitForTimeout(400)
  await page.click('#iddApuntar')
  await page.waitForTimeout(1500)
  const jp = await page.evaluate(() => window.__TABLAS__.user_wants.find((d) => d.card_id === 'SV2a-6'))
  check('una japonesa se apunta en japonés', jp?.idioma === 'ja', JSON.stringify(jp))
  check('  …y sale en la lista con su nombre', /リザードン|Charizard/.test(await page.textContent('#mcQuieroPanel')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await buscar(page, 'charizard')
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('sin irse de ancho', ancho <= 1, String(ancho))
  const alto = await page.$$eval('[data-deseo-mercado]', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)))
  check('el catálogo se toca (44)', alto.every((h) => h >= 44), JSON.stringify(alto))
  if (CAPS) await page.screenshot({ path: `${CAPS}/768-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
