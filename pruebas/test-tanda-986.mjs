// Tanda 986 — Una carta japonesa en la ficha completa y en la ventana de su
// expansión (PINGU con el Raichu & Alolan Raichu GX de GG End: desde el
// buscador la ventana decía «GG End · 008» con su ilustrador; desde la
// expansión, «sm10a_ja · 008» y sin ilustrador; y «Ficha completa» daba
// «Carta no encontrada»).
//   1. /carta buscaba solo en el catálogo occidental (`MERCADO = 'WEST'`).
//      Ahora busca en todos y elige el que dice el enlace (`?catalogo=`), o
//      el occidental, o el que haya; y `rutaDeCarta` lleva el catálogo.
//   2. Las cartas de una expansión llegan con lo justo de su set (sin el
//      nombre): la ventana coge el set de la estantería y pide lo que falta
//      de la carta (ilustrador, Pokédex, tipo) al abrirse.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. La dirección dice el catálogo ──')
{
  const { rutaDeCarta, mercadoDeRuta, elegirCartaDeRuta } = await import(`${RAIZ}/js/carta-ruta.js`)
  check('una japonesa lleva ?catalogo=JP', rutaDeCarta({ id: 'sm10a_ja-008', name: 'Raichu', market: 'JP' }).endsWith('-sm10a_ja-008?catalogo=JP'), rutaDeCarta({ id: 'sm10a_ja-008', name: 'Raichu', market: 'JP' }))
  check('  …una occidental, no', !rutaDeCarta({ id: 'sv8-1', name: 'Pikachu', market: 'WEST' }).includes('?') && !rutaDeCarta({ id: 'sv8-1', name: 'Pikachu' }).includes('?'))
  check('el catálogo de la dirección: JP, el de por defecto, y nada inventado', mercadoDeRuta('?catalogo=JP') === 'JP' && mercadoDeRuta('?catalogo=jp') === 'JP' && mercadoDeRuta('') === 'WEST' && mercadoDeRuta('?catalogo=XX') === 'WEST')
  const dos = [{ id: 'x', market: 'WEST', name: 'occ' }, { id: 'x', market: 'JP', name: 'jap' }]
  check('con el mismo id en los dos, gana el que pide la dirección', elegirCartaDeRuta(dos, 'JP').name === 'jap' && elegirCartaDeRuta(dos, 'WEST').name === 'occ')
  check('  …y si solo hay japonesa (un enlace viejo, sin catálogo), esa', elegirCartaDeRuta([{ id: 'y', market: 'JP' }], 'WEST')?.market === 'JP')
  check('  …y sin nada, nada', elegirCartaDeRuta([], 'WEST') === null)
  check('/carta ya no filtra por el occidental a fuego', !/const MERCADO = 'WEST'/.test(leer('js/carta.js')) && /elegirCartaDeRuta\(data, mercadoDeRuta\(location\.search\)\)/.test(leer('js/carta.js')))
  const borde = leer('netlify/edge-functions/meta-social.js')
  check('  …ni la mitad del servidor', !/tcg_cards\?id=in\.\(\$\{lista\}\)&market=eq\.WEST/.test(borde) && /elegirCartaDeRuta\(await pedirVarias/.test(borde) && /PARAMETROS_CANONICOS = \[[^\]]*'catalogo'/.test(borde))
}

const b = await chromium.launch()
const JP = {
  sets: [{ id: 'sm10a_ja', name: 'GG End', market: 'JP', serie_id: 'SM', release_date: '2019-04-05', card_count_official: 54 }, { id: 'sm10a_ja', name: 'Otro set con el mismo id', market: 'WEST', serie_id: 'sm' }],
  cartas: [
    { id: 'sm10a_ja-008', market: 'JP', set_id: 'sm10a_ja', local_id: '008', name: 'ライチュウ&アローラライチュウGX', name_en: 'Raichu & Alolan Raichu GX', illustrator: 'Mitsuhiro Arita', rarity: 'Double Rare', category: 'Pokemon', image_path: 'SM/SM10a/008' },
  ],
}

console.log('\n── 2. La ficha completa de una japonesa ──')
for (const [ruta, que] of [['/carta?id=sm10a_ja-008&catalogo=JP', 'con su catálogo en la dirección'], ['/carta?id=sm10a_ja-008', 'con un enlace viejo, sin catálogo']]) {
  const ctx = await b.newContext({ locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => { window.__FAKE_SESSION__ = 'none'; window.__FAKE_SETS__ = d.sets; window.__FAKE_CARTAS__ = d.cartas }, JP)
  await ctx.route(/assets\.tcgdex|images\.tcggo|limitless|githubusercontent|pokemontcg|api\.tcgdex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(BASE + ruta, { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  const h1 = await p.locator('h1').first().textContent()
  check(`${que}: se abre la carta, no «Carta no encontrada»`, !/no encontrada/i.test(h1) && /Raichu/.test(await p.locator('main').textContent()), h1)
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. La ventana de una carta abierta desde su expansión ──')
{
  const N = 6
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((n) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: n, card_count_total: n }]
    window.__FAKE_CARTAS__ = Array.from({ length: n }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', category: 'Pokemon', illustrator: 'Mitsuhiro Arita', dex_ids: [25], variants: { normal: true } }))
    window.__FAKE_COLECCION__ = []
  }, N)
  // Desde la CDN llegan como de verdad: con lo justo del set (sin el nombre) y sin ilustrador.
  const cdn = { cartas: Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { tcg_online_code: 'SSP', serie_id: 'sv', release_date: '2024-11-08' } })), versiones: [] }
  await ctx.route(/assets\.tcgdex|images\.tcggo|limitless|githubusercontent|pokemontcg|api\.tcgdex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => (/cartas-set/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cdn) }) : r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('#mcEstanteriaRejilla [data-set="sv8"]', { timeout: 10000 })
  await p.locator('#mcEstanteriaRejilla [data-set="sv8"]').first().click()
  await p.waitForSelector('#mcAlbum [data-carta]', { timeout: 10000 })
  await p.waitForTimeout(600)
  await p.locator('#mcAlbum [data-carta]').first().click()
  await p.waitForSelector('#mcEditor[open]', { timeout: 5000 })
  await p.waitForTimeout(1200)
  const r = await p.evaluate(() => ({ cabecera: document.getElementById('mcEdSet')?.textContent || '', tabla: document.getElementById('mcEdTabla')?.textContent || '', ficha: document.getElementById('mcEdFicha')?.getAttribute('href') || '' }))
  check('la cabecera dice el nombre del set, no su id', /Chispas Fulgurantes/.test(r.cabecera) && !/sv8 ·/.test(r.cabecera), r.cabecera)
  check('  …y la tabla también, con la cuenta del set', /Chispas Fulgurantes · 1\/6/.test(r.tabla), r.tabla)
  check('lo que no traía la carta se pide y se pinta: el ilustrador y la Pokédex', /Mitsuhiro Arita/.test(r.tabla) && /N\.º nacional25/.test(r.tabla), r.tabla)
  check('«Ficha completa» lleva a la carta', /^\/carta\/carta-1-sv8-1$/.test(r.ficha), r.ficha)
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
