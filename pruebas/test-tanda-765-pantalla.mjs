// Tanda 765 — la hoja «Añadir carta» (B1) y Deseos y cambios en el menú (M2).
//
// La ronda 3 pedía que Buscar dejara de ser una pestaña y fuera UNA hoja
// que se abre desde todas partes, y que el menú de Mi colección fuera
// Panel, Expansiones, Pokédex, Álbumes, Productos y Deseos y cambios. En
// la burbuja del móvil, «Trade» (PINGU: «Deseos y cambios es demasiado
// largo»). Lo que se mira: el menú, que la hoja se abre encima sin
// cambiar de pestaña y se cierra con ✕, Escape y atrás; «151/165» y
// «MEW 151»; que un bolsillo vacío use la misma hoja; y que /cartas siga
// con su pestaña Buscar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { entenderBusqueda } from '/home/user/pingu/js/mi-coleccion/busqueda.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'sv3pt5', name: '151', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207, tcg_online_code: 'MEW', logo_tcggo: 'https://images.tcggo.com/logo-151.png' },
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcg_online_code: 'OBF' },
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', serie_name: 'Espada y Escudo', market: 'WEST', release_date: '2021-08-27', card_count_official: 203, card_count_total: 237, tcg_online_code: 'EVS' },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date } })
const CARTAS = [
  carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'),
  carta('sv3pt5-6', 'sv3pt5', 6, 'Charizard ex'),
  carta('sv3-151', 'sv3', 151, 'Pidgeot'),
  carta('swsh7-151', 'swsh7', 151, 'Vaporeon'),
  carta('swsh7-52', 'swsh7', 52, 'Mew'),
]

console.log('── 1. Lo que se escribe, puro ──')
{
  const a = entenderBusqueda('151/165', SETS)
  check('«151/165»: el número y la expansión de 165', a.texto === '151' && a.total === 165 && a.setIds.join() === 'sv3pt5', JSON.stringify(a))
  const b = entenderBusqueda('MEW 151', SETS)
  check('«MEW 151»: el código del set y el número', b.texto === '151' && b.codigo === 'MEW' && b.setIds.join() === 'sv3pt5', JSON.stringify(b))
  const c = entenderBusqueda('mew', SETS)
  check('«mew» a secas es el Pokémon, no el código', c.texto === 'mew' && c.setIds === null, JSON.stringify(c))
  const d = entenderBusqueda('Pidgeot 151/999', SETS)
  check('un total que no es de ningún set no filtra', d.texto === 'Pidgeot 151' && d.setIds === null, JSON.stringify(d))
  const e = entenderBusqueda('OBF 151/165', SETS)
  check('si código y total no se cruzan, manda el código', e.setIds.join() === 'sv3', JSON.stringify(e))
}

const browser = await chromium.launch()
async function abrir(ruta, { movil = false, ancho = 1280 } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv3pt5-6', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_ALBUMES__ = [{ id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '2x2', paginas: 10, tapa: 'verde', cartas: [{ id: 'sv3pt5-6' }], updated_at: '2026-10-04T10:00:00Z' }]
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}
const visible = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().height > 0 }, id)
const resultados = (page) => page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.dataset.carta).sort().join())
const buscar = async (page, q) => { await page.fill('#mcBuscarTodo', q); await page.waitForTimeout(1200) }

console.log('── 2. El menú y las búsquedas ──')
// Desde la 767 Buscar vuelve a ser su pestaña (PINGU: «la hoja se lleva todo
// el menú»); lo de la hoja y de los bolsillos lo mira la 767-pantalla.
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const menu = await page.$$eval('#mcMenu > button', (bs) => bs.map((b) => `${b.dataset.pestania}:${b.innerText.trim()}`))
  check('Panel, Expansiones, Pokédex, Álbumes, Productos, Deseos y cambios y Buscar', menu.join('|') === 'resumen:Panel|album:Expansiones|pokedex:Pokédex|carpetas:Álbumes|productos:Productos|mercado:Deseos y cambios|buscar:Buscar', JSON.stringify(menu))
  await page.click('#mcMenu [data-pestania="mercado"]')
  await page.waitForTimeout(500)
  await page.click('[data-deseos-vista="cruces"]')
  await page.waitForTimeout(500)
  check('en los cruces, «Deseos y cambios» sigue encendido', (await page.getAttribute('#mcMenu [data-pestania="mercado"]', 'aria-selected')) === 'true' && new URL(page.url()).searchParams.get('ver') === 'cambios', page.url())
  await page.click('#mcMenu [data-pestania="buscar"]')
  await page.waitForTimeout(500)
  await buscar(page, '151/165')
  check('«151/165» da la de 151, y no las 151 de todas', (await resultados(page)) === 'sv3pt5-151', await resultados(page))
  await buscar(page, 'MEW 151')
  check('«MEW 151» también', (await resultados(page)) === 'sv3pt5-151', await resultados(page))
  await buscar(page, 'mew 52')
  check('«mew 52»: como set no hay, así que como nombre', (await resultados(page)) === 'swsh7-52', await resultados(page))
  await buscar(page, '151')
  check('«151» a secas, las tres', (await resultados(page)) === 'sv3-151,sv3pt5-151,swsh7-151', await resultados(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=buscar&q=Mew')
  check('?ver=buscar&q= abre Buscar con la búsqueda hecha', (await visible(page, 'mcPanelBuscar')) && (await resultados(page)) === 'sv3pt5-151,swsh7-52', await resultados(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/mi-coleccion.html', { movil: true })
  const textos = await page.$$eval('#mcMenu > button', (bs) => bs.map((b) => b.innerText.trim()))
  check('en la burbuja del iPhone, «Trade»', textos.includes('Trade') && !textos.some((t) => /Deseos/.test(t)), JSON.stringify(textos))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
