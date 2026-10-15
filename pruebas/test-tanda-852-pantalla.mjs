// Tanda 852 — el número de una promo lleva letras delante («XY124»).
//
// PINGU: «esta carta es el Pikachu EX XY124 […] si busco Pikachu XY124, o
// Pikachu 124, no sale». «124» se comparaba con `local_id` ENTERO, que es
// «XY124»; y «xy124» se tomaba por una palabra del nombre. Ahora un número
// a secas vale con cualquier prefijo delante, «xy124» es número con prefijo
// (y entonces no se mira la Pokédex), y «XY 124» separado se prueba pegado
// en una segunda pasada. Se mira en los DOS buscadores: /buscar (el de la
// barra de arriba) y la pestaña Buscar de /mi-coleccion.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const { partirBusqueda, filtroDeNumero, conPrefijoPegado, llevaElNumero } = await import(`${RAIZ}/js/mi-coleccion/busqueda.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Cómo se lee lo escrito ──')
{
  const p = partirBusqueda('pikachu xy124')
  check('«pikachu xy124» = nombre + número 124 con prefijo xy', p.nombre.join() === 'pikachu' && p.numero === '124' && p.prefijo === 'xy', JSON.stringify(p))
  check('«XY124» a secas es una búsqueda por número', partirBusqueda('XY124').soloNumero === true)
  check('«pikachu 124» no tiene prefijo', partirBusqueda('pikachu 124').prefijo === null)
  check('«Porygon2» sigue siendo un nombre', partirBusqueda('Porygon2').numero === null)
  check('con prefijo no se mira la Pokédex; sin él, sí', !filtroDeNumero('124', 'xy').includes('dex_ids') && filtroDeNumero('124').includes('dex_ids.cs.{124}'))
  check('«pikachu xy 124» se pega para la segunda pasada; «mew 151» también, pero solo si la primera no da nada', conPrefijoPegado('pikachu xy 124') === 'pikachu xy124' && conPrefijoPegado('pikachu 124') === null)
  check('XY124 lleva el 124 (y no el tg124); 064 lleva el 64; 1124 no', llevaElNumero('XY124', '124') && !llevaElNumero('XY124', '124', 'tg') && llevaElNumero('064', '64') && !llevaElNumero('1124', '124'))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  const set = (id, name, code, total, serie) => ({ id, name, tcg_online_code: code, serie_id: serie, market: 'WEST', release_date: '2016-01-01', card_count_official: total, card_count_total: total })
  window.__FAKE_SETS__ = [set('xyp', 'XY Black Star Promos', null, 211, 'xy'), set('sv3pt5', '151', 'MEW', 165, 'sv'), set('swsh12tg', 'Silver Tempest TG', 'SIT', 30, 'swsh'), set('base1', 'Set Básico', 'BS', 102, 'base')]
  const nombres = { xyp: 'XY Black Star Promos', sv3pt5: '151', swsh12tg: 'Silver Tempest TG', base1: 'Set Básico' }
  const series = { xyp: 'xy', sv3pt5: 'sv', swsh12tg: 'swsh', base1: 'base' }
  const c = (setId, n, nombre, dex) => ({ id: `${setId}-${n}`, market: 'WEST', set_id: setId, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${setId}/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: dex, tcg_sets: { id: setId, name: nombres[setId], serie_id: series[setId] } })
  window.__FAKE_CARTAS__ = [c('xyp', 'XY124', 'Pikachu EX', [25]), c('xyp', 'XY1', 'Xerneas', [716]), c('xyp', 'XY12', 'Pikachu', [25]), c('sv3pt5', 25, 'Pikachu', [25]), c('swsh12tg', 'TG05', 'Pikachu VMAX', [25]), c('base1', 124, 'Jynx', [124]), c('sv3pt5', 124, 'Slowpoke', [79])]
  window.__FAKE_PRECIOS__ = []
  window.__FAKE_GUIAS__ = []
  window.__FAKE_TEMAS__ = []
  window.__FAKE_PERFILES__ = []
  window.__FAKE_COLECCION__ = []
}
async function abrir(ruta) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const ids = (hs) => hs.map((h) => (String(h).match(/(xyp|sv3pt5|swsh12tg|base1)-[a-z0-9]+$/i) || [''])[0]).sort()

console.log('── 2. El buscador de arriba (/buscar) ──')
const arriba = (page) => page.$$eval('#searchResults .bs-grupo', (gs) => { const g = gs.find((x) => x.querySelector('.bs-seccion')?.textContent.trim() === 'Cartas'); return g ? [...g.querySelectorAll('.bs-fila')].map((a) => a.getAttribute('href')) : [] })
for (const [q, esperado, l] of [
  ['Pikachu 124', ['xyp-XY124'], '«Pikachu 124» encuentra la XY124 (y no a Jynx, que es el 124 de la Pokédex)'],
  ['Pikachu XY124', ['xyp-XY124'], '«Pikachu XY124» también'],
  ['pikachu xy 124', ['xyp-XY124'], '«pikachu xy 124», con el prefijo separado, también (segunda pasada)'],
  ['124', ['base1-124', 'sv3pt5-124', 'xyp-XY124'], '«124» a secas: las tres que llevan el 124 impreso, con letras o sin ellas (y Jynx por la Pokédex)'],
  ['XY124', ['xyp-XY124'], '«XY124» a secas: solo la promo'],
  ['pikachu tg5', ['swsh12tg-TG05'], '«pikachu tg5» encuentra la TG05 (ceros delante)'],
  // 853: mientras se escribe «Pikachu XY124», letra a letra, la carta no se va.
  ['pikachu xy', ['xyp-XY12', 'xyp-XY124'], '«pikachu xy»: las de Pikachu cuyo número empieza por XY (853)'],
  ['pikachu xy1', ['xyp-XY12', 'xyp-XY124'], '«pikachu xy1»: XY12 y XY124, no Xerneas (XY1, que no es Pikachu)'],
  ['pikachu xy12', ['xyp-XY12', 'xyp-XY124'], '«pikachu xy12»: XY12 y XY124'],
  ['xy1', ['xyp-XY1', 'xyp-XY12', 'xyp-XY124'], '«xy1» a secas: todas las XY que empiezan por 1'],
]) {
  const { page, ctx, errores } = await abrir(`/buscar.html?q=${encodeURIComponent(q)}&en=cartas`)
  const hs = ids(await arriba(page))
  check(l, JSON.stringify(hs) === JSON.stringify(esperado) && errores.length === 0, JSON.stringify(hs) + (errores.length ? ' ' + errores.join(' | ') : ''))
  await ctx.close()
}

console.log('── 3. La pestaña Buscar de /mi-coleccion ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=buscar')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const resultados = () => page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.getAttribute('data-carta')))
  for (const [q, esperado, l] of [
    ['Pikachu 124', ['xyp-XY124'], '«Pikachu 124» encuentra la XY124'],
    ['pikachu xy124', ['xyp-XY124'], '«pikachu xy124» también'],
    ['pikachu xy 124', ['xyp-XY124'], '«pikachu xy 124» también'],
    ['tg05', ['swsh12tg-TG05'], '«tg05» a secas: la Trainer Gallery'],
    ['pikachu xy', ['xyp-XY12', 'xyp-XY124'], '«pikachu xy»: las de Pikachu cuyo número empieza por XY (853)'],
    ['pikachu xy12', ['xyp-XY12', 'xyp-XY124'], '«pikachu xy12»: XY12 y XY124'],
  ]) {
    await page.fill('#mcBuscarTodo', q)
    await page.dispatchEvent('#mcBuscarTodo', 'input')
    await page.waitForTimeout(900)
    const hs = ids(await resultados())
    check(l, JSON.stringify(hs) === JSON.stringify(esperado), JSON.stringify(hs))
  }
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
