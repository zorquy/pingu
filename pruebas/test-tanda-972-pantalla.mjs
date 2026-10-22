// Tanda 972 — el buscador de arriba en pantalla: B1–B6.
//
// /buscar y la paleta (Ctrl+K): las expansiones, el mejor resultado, las
// japonesas, las cuentas en las chapas, la chapa Cartas que lleva a Cartas ›
// Buscar, y «@» para buscar gente.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'sv3pt5', name: '151', name_en: '151', serie_id: 'sv', market: 'WEST', tcg_online_code: 'MEW', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207, logo_tcggo: 'https://images.tcggo.com/logo-151.png' },
  { id: 'sv3', name: 'Obsidiana en Llamas', name_en: 'Obsidian Flames', serie_id: 'sv', market: 'WEST', tcg_online_code: 'OBF', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, logo_tcggo: 'https://images.tcggo.com/logo-obf.png' },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', tcg_online_code: 'SV2a', release_date: '2023-06-16', card_count_official: 165, card_count_total: 210 },
]
const C = (id, set, n, name, market = 'WEST', extra = {}) => ({ id, set_id: set, local_id: n, name, market, category: 'Pokemon', ...extra })
const CARTAS = [
  C('sv3pt5-151', 'sv3pt5', '151', 'Mew ex'),
  C('sv3pt5-205', 'sv3pt5', '205', 'Mew ex'),
  C('sv3pt5-6', 'sv3pt5', '6', 'Charizard ex'),
  C('sv3-125', 'sv3', '125', 'Charizard ex'),
  C('sv3-29', 'sv3', '29', 'Ninetales'),
  C('SV2a-151', 'SV2a', '151', 'ミュウex', 'JP', { name_en: 'Mew ex' }),
  C('SV2a-6', 'SV2a', '6', 'リザードンex', 'JP', { name_en: 'Charizard ex' }),
]
const browser = await chromium.launch()
async function abrir(ruta) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_PRECIOS__ = [{ card_id: 'sv3pt5-151', cm_low: 24.9, cm_low_es: 24.9, checked_at: new Date().toISOString() }]
    window.__FAKE_GUIAS__ = [{ slug: 'guia-charizard', title: 'Cómo jugar Charizard ex', description: 'Lista y consejos' }]
    window.__FAKE_TEMAS__ = [{ id: 'tema-9', title: '¿Charizard o Dragapult?' }]
    window.__FAKE_PERFILES__ = [{ id: 'user-9', username: 'charlie', display_name: 'Charlie' }, { id: 'user-8', username: 'mewfan', display_name: 'Mew Fan' }]
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRODUCTOS__ = [{ id: 9002, episode_id: 300, market: 'WEST', lang: 'en', name: 'Obsidian Flames Charizard ex Tin', tipo: 'lata', cm_lowest: 20, cm_lowest_es: 21, release_date: '2023-08-11' }]
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f2b632"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const grupos = (page) => page.$$eval('#searchResults .bs-grupo > .bs-seccion', (hs) => hs.map((h) => h.textContent.trim()))
const chapas = (page) => page.$$eval('#bsChips [data-grupo]', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()))

console.log('── B1 · Expansiones en /buscar ──')
{
  const { ctx, page, errores } = await abrir('/buscar.html?q=obsidiana')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const exp = await page.$$eval('#searchResults .bs-fila.bs-expansiones', (as) => as.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]))
  check('«obsidiana» encuentra la expansión, con su día y sus cartas', exp.length === 1 && exp[0][0] === '/cartas?ver=album&set=sv3' && /Obsidiana en Llamas/.test(exp[0][1]) && /230 cartas/.test(exp[0][1]), JSON.stringify(exp))
  check('  …con su logo', (await page.locator('#searchResults .bs-expansiones .bs-logo img').count()) === 1)
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/buscar.html?q=151')
  const exp = await page.$$eval('#searchResults .bs-fila.bs-expansiones', (as) => as.map((a) => a.getAttribute('href')))
  check('«151»: el occidental y el japonés (en su catálogo)', exp.join() === '/cartas?ver=album&set=sv3pt5,/cartas?ver=album&set=SV2a&catalogo=JP', exp.join())
  await ctx.close()
}

console.log('── B2 · Lo más probable ──')
{
  const { ctx, page, errores } = await abrir('/buscar.html?q=mew%20151')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const g = await grupos(page)
  check('«MEW 151»: arriba, «Lo más probable»', g[0] === 'Lo más probable', JSON.stringify(g))
  const mejor = await page.$eval('#searchResults .bs-mejor', (a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()])
  check('  …es el Mew ex 151 de 151, con su precio', /sv3pt5-151/.test(mejor[0]) && /Mew ex/.test(mejor[1]) && /24,90 €/.test(mejor[1]), JSON.stringify(mejor))
  check('  …y no sale repetido en Cartas', (await page.locator('#searchResults .bs-fila.bs-cartas[href*="sv3pt5-151"]').count()) === 1)
  if (CAPS) await page.screenshot({ path: `${CAPS}/972-mejor.png`, fullPage: true })
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/buscar.html?q=mew')
  check('«mew» a secas no tiene un mejor resultado', (await page.locator('#searchResults .bs-mejor').count()) === 0)
  await ctx.close()
}

console.log('── B3 · También en Japón ──')
{
  const { ctx, page } = await abrir('/buscar.html?q=charizard')
  const jp = await page.$eval('#searchResults .bs-japon', (a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]).catch(() => null)
  check('debajo de las cartas, «También en Pokémon Japón · 1 carta», a Cartas › Buscar en Japón', jp && jp[0] === '/cartas?catalogo=JP&ver=buscar&q=charizard' && /1 carta/.test(jp[1]), JSON.stringify(jp))

  console.log('── B4 · Las chapas dicen cuántos ──')
  const ch = await chapas(page)
  check('Cartas 2 · Productos 1 · Guías 1 · Foro 1; sin número donde no hay nada', ch.includes('Cartas2') && ch.includes('Productos1') && ch.includes('Guías1') && ch.includes('Foro1') && ch.includes('Expansiones') && ch.includes('Gente'), JSON.stringify(ch))
  if (CAPS) await page.screenshot({ path: `${CAPS}/972-chapas.png`, fullPage: true })

  console.log('── B5 · La chapa Cartas lleva a Cartas › Buscar ──')
  await page.click('#bsChips [data-grupo="cartas"]')
  await page.waitForTimeout(2500)
  check('tocarla abre Cartas › Buscar con lo escrito', /\/cartas\?ver=buscar&q=charizard/.test(page.url()) && (await page.inputValue('#mcBuscarTodo')) === 'charizard', page.url())
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/buscar.html?q=zapdos&en=cartas')
  check('un enlace viejo a /buscar?en=cartas también lleva allí', /\/cartas\?ver=buscar&q=zapdos/.test(page.url()), page.url())
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/cartas?ver=buscar&q=charizard')
  await page.locator('.seg [data-vista="ja"]:visible').first().click()
  await page.waitForTimeout(1500)
  const ids = await page.$$eval('#mcBuscarResultados [data-carta]', (as) => [...new Set(as.map((a) => a.dataset.carta))])
  check('  …y allí, en Japón, «charizard» encuentra la japonesa (por su nombre inglés)', ids.join() === 'SV2a-6', ids.join())
  await ctx.close()
}

console.log('── B6 · «@» busca gente ──')
{
  const { ctx, page, errores } = await abrir('/buscar.html?q=%40mew')
  const g = await grupos(page)
  check('«@mew»: solo Gente (no las cartas de Mew)', g.join() === 'Gente', JSON.stringify(g))
  check('  …y encuentra a @mewfan', /@mewfan/.test(await page.textContent('#searchResults')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── La paleta (Ctrl+K) ──')
{
  const { ctx, page, errores } = await abrir('/')
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(400)
  await page.fill('#paletaInput', 'mew 151')
  await page.waitForTimeout(1600)
  const secciones = await page.$$eval('#paletaLista .bs-seccion', (ss) => ss.map((s) => s.textContent.trim()))
  check('la primera sección es «Lo más probable»', secciones[0] === 'Lo más probable', JSON.stringify(secciones))
  check('  …con el Mew ex 151 seleccionado (Intro lo abre)', /sv3pt5-151/.test(await page.getAttribute('#paletaLista [data-i="0"]', 'href') || '') && (await page.getAttribute('#paletaLista [data-i="0"]', 'aria-selected')) === 'true')
  await page.fill('#paletaInput', 'obsidiana')
  await page.waitForTimeout(1600)
  const filas = await page.$$eval('#paletaLista [data-i]', (fs) => fs.map((f) => [f.textContent.replace(/\s+/g, ' ').trim(), f.getAttribute('href')]))
  check('«obsidiana»: la expansión sale, y lleva a su estantería', filas.some(([t, h]) => /Obsidiana en Llamas/.test(t) && h === '/cartas?ver=album&set=sv3'), JSON.stringify(filas.slice(0, 5)))
  await page.fill('#paletaInput', 'charizard')
  await page.waitForTimeout(1600)
  const jp = await page.$$eval('#paletaLista [data-i]', (fs) => fs.map((f) => [f.textContent.replace(/\s+/g, ' ').trim(), f.getAttribute('href')]).filter(([t]) => /Pokémon Japón/.test(t)))
  check('«charizard»: «También en Pokémon Japón», a su catálogo', jp.length === 1 && jp[0][1] === '/cartas?catalogo=JP&ver=buscar&q=charizard', JSON.stringify(jp))
  if (CAPS) await page.screenshot({ path: `${CAPS}/972-paleta.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
