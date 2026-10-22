// Tanda 969 — el idioma de un producto, y Buscar al cambiar de catálogo.
//
// PINGU: «cuando agregas un producto, que te pregunte el idioma: tiene que
// tratar igual que una carta». Y: «busco Scyther en inglés, cambio a
// japonés y la búsqueda no se actualiza».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. La migración y lo puro ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-969-productos-idioma.sql`, 'utf8')
  check('`idioma` en user_products, lo de antes en el idioma del producto', /add column if not exists idioma text/.test(sql) && /set idioma = case when lower\(coalesce\(p\.lang, 'en'\)\) like 'ja%' then 'ja' else 'en' end/.test(sql))
  check('  …y la fila única pasa a persona + producto + idioma', /drop constraint if exists user_products_uno;/.test(sql) && /unique \(user_id, product_id, idioma\)/.test(sql))
  check('  …sin tablas temporales (la 631)', !/temp(orary)? table/i.test(sql))
  const { idiomasDeProducto, precioDeProductoEnIdioma, valorDeProductos } = await import(`${RAIZ}/js/productos.js`)
  check('occidental: español, inglés, alemán, francés e italiano; japonés: japonés', idiomasDeProducto({ lang: 'en' }).join() === 'es,en,de,fr,it' && idiomasDeProducto({ lang: 'ja', market: 'JP' }).join() === 'ja')
  const f = { lang: 'en', cm_lowest: 22, cm_lowest_eu: 20, cm_lowest_es: 21, cm_lowest_de: 19 }
  check('una copia vale lo de SU idioma', precioDeProductoEnIdioma(f, 'de').valor === 19 && precioDeProductoEnIdioma(f, 'en').valor === 20)
  check('  …sin cifra en su idioma, el de siempre diciendo cuál', precioDeProductoEnIdioma(f, 'it').valor === 21 && precioDeProductoEnIdioma(f, 'it').idioma === 'es')
  const v = valorDeProductos([{ product_id: 1, idioma: 'es', cantidad: 2 }, { product_id: 1, idioma: 'de', cantidad: 1 }], new Map([[1, f]]))
  check('  …y el valor de tus productos suma cada línea con su idioma (2 × 21 + 19)', v.total === 61 && v.unidades === 3, JSON.stringify(v))
}

const SETS = [
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcggo_id: 300 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165, card_count_total: 210, tcggo_id: 900 },
]
const PRODUCTOS = [
  { id: 9001, episode_id: 300, market: 'WEST', lang: 'en', name: 'Obsidian Flames Booster', tipo: 'sobre', cm_lowest: 6, cm_lowest_eu: 5, cm_lowest_es: 5.5, release_date: '2023-08-11' },
  { id: 9002, episode_id: 300, market: 'WEST', lang: 'en', name: 'Obsidian Flames Charizard ex Tin', tipo: 'lata', cm_lowest: 22, cm_lowest_eu: 20, cm_lowest_es: 21, cm_lowest_de: 19, release_date: '2023-08-11' },
  { id: 1_000_009_900, market: 'JP', episode_id: 900, lang: 'ja', name: 'Pokémon Card 151 Booster Box (JP)', tipo: 'caja', cm_lowest: 120, cm_lowest_eu: 125, release_date: '2023-06-16' },
]
const CARTAS = [
  { id: 'sv3-1', set_id: 'sv3', local_id: '1', name: 'Scyther', market: 'WEST', category: 'Pokemon' },
  { id: 'sv3-2', set_id: 'sv3', local_id: '2', name: 'Scyther', market: 'WEST', category: 'Pokemon' },
  { id: 'SV2a-123', set_id: 'SV2a', local_id: '123', name: 'Scyther', market: 'JP', category: 'Pokemon' },
]
const browser = await chromium.launch()
async function abrir(ruta, { misProductos = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, PRODUCTOS, CARTAS, misProductos }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = misProductos
    try { localStorage.removeItem('pokedoc-prod-idioma') } catch {}
  }, { SETS, PRODUCTOS, CARTAS, misProductos })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const lineas = (page) => page.evaluate(async () => {
  const { supabase } = await import('/js/supabase.js')
  const { data } = await supabase.from('user_products').select('*').eq('user_id', 'admin-1')
  return (data || []).map((m) => `${m.product_id}:${m.idioma}:${m.cantidad}`).sort()
})

console.log('── 2. Añadir un producto pregunta el idioma ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos', { misProductos: [{ product_id: 9001, cantidad: 1 }] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.click('#mcProdSets [data-prod-set="300"]')
  await page.waitForTimeout(800)
  await page.click('#mcProdRejilla [data-prod="9002"] [data-prod-anadir]')
  await page.waitForTimeout(300)
  const idiomas = await page.$$eval('#mcProdIdioma [data-prodi-idioma]', (bs) => bs.map((b) => `${b.dataset.prodiIdioma}:${b.textContent.replace(/\s+/g, ' ').trim()}`))
  check('«+ Añadir» abre «¿En qué idioma lo tienes?» con los cinco y su precio', (await page.isVisible('#mcProdIdioma')) && idiomas.length === 5 && /^es:Español ?21,00 €/.test(idiomas[0]) && /^de:Alemán ?19,00 €/.test(idiomas[2]) && /^it:Italiano ?sin precio/.test(idiomas[4]), JSON.stringify(idiomas))
  check('  …y todavía no ha apuntado nada', JSON.stringify(await lineas(page)) === JSON.stringify(['9001:en:1']))
  if (CAPS) await page.screenshot({ path: `${CAPS}/969-idioma.png` })
  await page.click('#mcProdIdioma [data-prodi-idioma="es"]')
  await page.waitForTimeout(700)
  check('elegir Español la apunta en español', !(await page.isVisible('#mcProdIdioma')) && JSON.stringify(await lineas(page)) === JSON.stringify(['9001:en:1', '9002:es:1']), JSON.stringify(await lineas(page)))
  check('  …y la tarjeta enseña su bandera y su − ×1 +', (await page.$eval('#mcProdRejilla [data-prod="9002"] .mc-prod-mando', (m) => m.dataset.idiomaLinea + ':' + m.textContent.replace(/\s+/g, ''))) === 'es:−×1+')
  await page.click('#mcProdRejilla [data-prod="9002"] [data-prod-mas]')
  await page.waitForTimeout(600)
  check('el «+» de la tarjeta suma otra IGUAL (en español), sin preguntar', JSON.stringify(await lineas(page)) === JSON.stringify(['9001:en:1', '9002:es:2']) && !(await page.isVisible('#mcProdIdioma')))
  await page.click('#mcProdRejilla [data-prod="9002"] .mc-prod-abrir')
  await page.waitForTimeout(700)
  await page.click('#mcProdFichaMando [data-prod-anadir]')
  await page.waitForTimeout(300)
  check('en la ficha, «+ En otro idioma» vuelve a preguntar, y recuerda el último', (await page.isVisible('#mcProdIdioma')) && (await page.getAttribute('#mcProdIdioma .recordado', 'data-prodi-idioma')) === 'es' && /tienes 2/.test(await page.textContent('#mcProdIdioma [data-prodi-idioma="es"]')))
  await page.click('#mcProdIdioma [data-prodi-idioma="de"]')
  await page.waitForTimeout(700)
  const filas = await page.$$eval('#mcProdFichaMando .mc-prodf-copias .mc-prod-mando', (ms) => ms.map((m) => `${m.dataset.idiomaLinea}:${m.textContent.replace(/\s+/g, '')}`))
  check('la ficha: «Tienes 3», una fila por idioma con su − y su +', /Tienes 3/.test(await page.textContent('#mcProdFichaMando')) && filas.join() === 'es:Español−×2+,de:Alemán−×1+', JSON.stringify(filas))
  check('  …y la tarjeta, con dos idiomas, «Tus copias · 3»', /Tus copias · 3/.test(await page.textContent('#mcProdRejilla [data-prod="9002"] .mc-prod-mando')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/969-ficha.png` })
  await page.click('#mcProdFichaMando [data-idioma-linea="de"] [data-prod-menos]')
  await page.waitForTimeout(600)
  check('el − de la fila alemana quita esa (y solo esa)', JSON.stringify(await lineas(page)) === JSON.stringify(['9001:en:1', '9002:es:2']))
  await page.keyboard.press('Escape')
  await page.click('#mcProdVolver')
  await page.waitForTimeout(500)
  check('«Tus productos» vale cada copia en su idioma (2 × 21 + 5 del sobre inglés)', /47,00 €/.test(await page.textContent('#mcProdTuyos .mc-prod-valor')), await page.textContent('#mcProdTuyos .mc-prod-valor'))
  check('  …con una tarjeta por producto, no por línea', (await page.locator('#mcProdTuyos [data-prod="9002"]').count()) === 1)
  await page.click('[data-prod-mercado="JP"]')
  await page.waitForTimeout(900)
  await page.click('#mcProdSets [data-prod-set="900"]')
  await page.waitForTimeout(800)
  await page.click(`#mcProdRejilla [data-prod="${1_000_009_900}"] [data-prod-anadir]`)
  await page.waitForTimeout(700)
  check('un producto japonés no pregunta: es japonés', !(await page.isVisible('#mcProdIdioma')) && (await lineas(page)).includes(`${1_000_009_900}:ja:1`), JSON.stringify(await lineas(page)))
  check('sin errores al acabar', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Buscar, al cambiar de catálogo ──')
{
  const { ctx, page, errores } = await abrir('/cartas?ver=buscar&q=scyther')
  const ids = () => page.$$eval('#mcBuscarResultados [data-carta]', (as) => [...new Set(as.map((a) => a.dataset.carta))].sort())
  check('en Pokémon, los Scyther occidentales', JSON.stringify(await ids()) === JSON.stringify(['sv3-1', 'sv3-2']), JSON.stringify(await ids()))
  await page.locator('.seg [data-vista="ja"]:visible').first().click()
  await page.waitForTimeout(1600)
  check('al pasar a Pokémon Japón, la búsqueda se hace otra vez allí', JSON.stringify(await ids()) === JSON.stringify(['SV2a-123']) && (await page.inputValue('#mcBuscarTodo')) === 'scyther', JSON.stringify(await ids()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
