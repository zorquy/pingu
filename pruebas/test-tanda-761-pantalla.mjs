// Tanda 761 — Buscar, por expansión (B1 de la ronda 3; PINGU: «el añadir
// carta agrupado por expansiones, hazlo como tú veas»).
//
// Lo que se mira: que los resultados salgan en grupos por expansión, de la
// más nueva a la más vieja, cada uno con su logo, su nombre y «tienes X de Y
// · N resultados»; que cada `.mc-resultado` siga siendo hijo directo de la
// rejilla (la ficha y el escáner lo buscan ahí); que se pueda afinar por
// serie, por expansión y «Solo las que tengo» sin volver a preguntar, con
// los desplegables sacados de lo que ha vuelto, y que el vacío diga cuál es.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'base1', name: 'Set Básico', serie_id: 'base', serie_name: 'Base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102, logo_tcggo: 'https://images.tcggo.com/logo-base1.png' },
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, logo_tcggo: 'https://images.tcggo.com/logo-sv3.png' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 },
]
const carta = (id, set, n, nombre) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: SETS.find((s) => s.id === set).name, serie_id: SETS.find((s) => s.id === set).serie_id, release_date: SETS.find((s) => s.id === set).release_date } })
const CARTAS = [
  carta('base1-4', 'base1', 4, 'Charizard'),
  carta('sv3-125', 'sv3', 125, 'Charizard ex'),
  carta('sv3-215', 'sv3', 215, 'Charizard ex'),
  carta('sv3-223', 'sv3', 223, 'Charizard ex'),
  carta('sv8-11', 'sv8', 11, 'Charmander'),
  carta('sv8-12', 'sv8', 12, 'Charmeleon'),
]
const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv3-125', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', card_id: 'base1-4', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
    ]
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /logo/.test(r.request().url()) ? '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}
const grupos = (page) => page.$$eval('#mcBuscarResultados .mc-bus-grupo', (gs) => gs.map((g) => ({ set: g.dataset.grupoSet, texto: g.textContent.replace(/\s+/g, ' ').trim(), logo: !!g.querySelector('img'), cartas: (() => { const r = []; let n = g.nextElementSibling; while (n && n.classList.contains('mc-resultado')) { r.push(n.dataset.carta); n = n.nextElementSibling } return r })() })))
const buscar = async (page, q) => { await page.fill('#mcBuscarTodo', q); await page.waitForTimeout(1200) }

console.log('── 1. Por expansión ──')
{
  const { ctx, page, errores } = await abrir()
  await buscar(page, 'char')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const g = await grupos(page)
  check('tres grupos, de la expansión más nueva a la más vieja', g.map((x) => x.set).join() === 'sv8,sv3,base1', JSON.stringify(g.map((x) => x.set)))
  check('cada uno con su nombre y «tienes X de Y · N resultados»', /Chispas Fulgurantes ?tienes 0 de 252 · 2 resultados/.test(g[0].texto) && /Obsidiana en Llamas ?tienes 1 de 230 · 3 resultados/.test(g[1].texto) && /Set Básico ?tienes 1 de 102 · 1 resultado$/.test(g[2].texto), JSON.stringify(g.map((x) => x.texto)))
  check('  …con el logo cuando lo hay', !g[0].logo && g[1].logo && g[2].logo, JSON.stringify(g.map((x) => x.logo)))
  check('  …y debajo, sus cartas', g[1].cartas.length === 3 && g[1].cartas.every((id) => id.startsWith('sv3-')), JSON.stringify(g[1].cartas))
  check('las cartas siguen siendo hijas directas de la rejilla', (await page.locator('#mcBuscarResultados > .mc-resultado').count()) === 6)
  const cab = await page.$eval('#mcBuscarResultados .mc-bus-grupo', (e) => Math.round(e.getBoundingClientRect().width))
  const rej = await page.$eval('#mcBuscarResultados', (e) => Math.round(e.getBoundingClientRect().width))
  check('  …y la cabecera ocupa la fila entera', Math.abs(cab - rej) <= 2, `${cab} de ${rej}`)
  if (CAPS) await page.screenshot({ path: `${CAPS}/761-grupos.png` })

  console.log('── 2. Afinar ──')
  const series = await page.$$eval('#mcBuscarSerie option', (os) => os.map((o) => o.textContent))
  check('las series que han salido, con su nombre', series.join() === 'Todas las series,Escarlata y Púrpura,Base', JSON.stringify(series))
  await page.selectOption('#mcBuscarSerie', 'sv')
  await page.waitForTimeout(300)
  check('por serie: solo Escarlata y Púrpura', (await grupos(page)).map((x) => x.set).join() === 'sv8,sv3')
  const sets = await page.$$eval('#mcBuscarSet option', (os) => os.map((o) => o.value))
  check('  …y el desplegable de expansión se acota a esa serie', sets.join() === ',sv8,sv3', JSON.stringify(sets))
  await page.selectOption('#mcBuscarSet', 'sv3')
  await page.waitForTimeout(300)
  check('por expansión: solo Obsidiana', (await grupos(page)).map((x) => x.set).join() === 'sv3')
  await page.click('#mcBuscarSoloMias')
  await page.waitForTimeout(300)
  check('«Solo las que tengo»: la que tienes', (await page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.dataset.carta))).join() === 'sv3-125' && (await page.getAttribute('#mcBuscarSoloMias', 'aria-pressed')) === 'true')
  await page.selectOption('#mcBuscarSerie', '')
  await page.waitForTimeout(300)
  check('  …en todas las series, las dos tuyas', (await page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.dataset.carta))).sort().join() === 'base1-4,sv3-125')
  await buscar(page, 'charmeleon')
  check('una búsqueda nueva vuelve a todas las series; «Solo las que tengo» se queda', (await page.inputValue('#mcBuscarSerie')) === '' && /No tienes ninguna de estas/.test(await page.textContent('#mcBuscarResultados')), await page.textContent('#mcBuscarResultados'))
  await page.click('#mcBuscarSoloMias')
  await page.waitForTimeout(300)
  check('  …y quitándolo, sale', (await page.locator('#mcBuscarResultados .mc-resultado').count()) === 1)
  await page.click('#mcBuscarResultados .mc-resultado')
  await page.waitForTimeout(800)
  check('tocar una abre su ficha, como siempre', await page.evaluate(() => !!document.getElementById('mcEditor')?.open))
  await ctx.close()
}

console.log('── 3. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await buscar(page, 'char')
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('sin irse de ancho', ancho <= 1, String(ancho))
  const altos = await page.$$eval('#mcBuscarAfinar select, #mcBuscarAfinar button', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)))
  check('lo de afinar se toca (44)', altos.every((h) => h >= 44), JSON.stringify(altos))
  if (CAPS) await page.screenshot({ path: `${CAPS}/761-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
