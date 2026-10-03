// Tanda 476 — la Pokédex, con la misma tira de datos que una expansión.
//
// PINGU: «la Pokédex tiene que ser igual» (que la pantalla de una
// expansión), y antes, sobre esa: «las estadísticas, en deslizables, ¿ves
// que se pueden deslizar? Pues igual».
//
// Tenía razón en lo de «igual», y lo decía de dos pantallas escritas
// aparte: la tira de una expansión la monta `js/mi-coleccion.js` y la
// cabecera de la Pokédex la montaba `pokedex.js` con su propia familia de
// clases (`.mc-pdx-caja`, `.mc-pdx-cifra`…) para decir lo mismo. Dos
// moldes para el mismo objeto se separan — la lección de la tarjeta de
// guía de la 316.
//
// Y ocupaba: dos cajas apiladas, 230 px antes del primer Pokémon.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { diapoHtml, tiraHtml } from '/home/user/pingu/js/mi-coleccion/diapos.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. El molde, sin navegador ──')
{
  const uno = diapoHtml('Registrados', '<p>1</p>')
  check('una tarjeta lleva su título', uno.includes('<h3 class="mc-diapo-titulo">Registrados</h3>'), uno)
  check('y el texto va escapado', diapoHtml('<img src=x>', '').includes('&lt;img'), diapoHtml('<img src=x>', ''))
  const tira = tiraHtml([uno, uno], { idPuntos: 'p' })
  // `mc-tira-datos` es lo que la hace deslizable. No va en `.mc-diapos` a
  // secas porque esa clase la usa también el bloque de «Estadísticas» del
  // panel, que es una rejilla larga y no una tira con puntos.
  check('la tira lleva su clase de deslizable', tira.includes('class="mc-diapos mc-tira-datos"'), tira)
  check('y su fila de puntos', tira.includes('<div class="mc-puntos" id="p"'), tira)
  // Los puntos se pintan VACÍOS: cuántos hay lo decide `engancharPuntos`
  // contando las tarjetas que al final salgan, y eso cambia.
  check('  …vacía', /<div class="mc-puntos"[^>]*><\/div>/.test(tira), tira)
  check('sin tarjetas no hay tira', tiraHtml([]) === '' && tiraHtml([null, '', false]) === '')
  check('las vacías no cuentan', (tiraHtml(['', diapoHtml('A', '')]).match(/mc-diapo"/g) || []).length === 1)
}

const browser = await chromium.launch()
const abrir = async (ancho = 390) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', serie_id: 'sv', market: 'WEST',
      card_count_official: 9, card_count_total: 9, logo_path: 'x/l' }]
    // Tres especies con un número de cartas DISTINTO, para que salgan las
    // tres tarjetas: «Registrados», «el que más» y «el que menos».
    //
    // Y con NOMBRES DE POKÉMON de verdad, que no es un detalle: la especie
    // se deduce del NOMBRE y no de `dex_ids` —a propósito, porque mientras
    // esa columna se rellena las cartas que tienes todavía no la traen—,
    // así que un fixture con «Carta 1» deja la Pokédex a cero y la prueba
    // afirmando cosas sobre una pantalla vacía.
    const NOMBRES = ['Bulbasaur', 'Bulbasaur', 'Bulbasaur', 'Charmander', 'Charmander', 'Squirtle', 'Pikachu', 'Pikachu', 'Pikachu']
    window.__FAKE_CARTAS__ = NOMBRES.map((nombre, i) => ({
      id: `sv1-${i + 1}`, market: 'WEST', set_id: 'sv1', local_id: String(i + 1),
      name: `${nombre} ex`, image_path: `x/${i + 1}`, rarity: 'Common', category: 'Pokemon',
      variants: { normal: true },
    }))
    // Tres Bulbasaur, un Charmander y un Squirtle: el que más y el que
    // menos son Pokémon distintos, que es cuando salen las tres tarjetas.
    window.__FAKE_COLECCION__ = [1, 2, 3, 4, 6].map((c, i) => ({
      id: `l${i}`, card_id: `sv1-${c}`, market: 'WEST', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', created_at: new Date().toISOString(),
    }))
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  return { page, errores }
}

console.log('\n── 2. En el móvil es una tira que se desliza ──')
{
  const { page, errores } = await abrir(390)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const tira = page.locator('#mcPokedexPanel .mc-tira-datos')
  check('la cabecera es la tira compartida', (await tira.count()) === 1)
  // Y ya NO es la familia que tenía para ella sola.
  check('ya no quedan las clases viejas',
    (await page.locator('.mc-pdx-caja, .mc-pdx-cabecera, .mc-pdx-cifra').count()) === 0)
  const r = await tira.evaluate((n) => ({
    desliza: n.scrollWidth > n.clientWidth + 4,
    overflow: getComputedStyle(n).overflowX,
    // Un hijo de flex CEDE antes de desbordar (la lección de la 320): sin
    // `flex-shrink: 0` la tira cabría siempre, con las tarjetas aplastadas.
    anchos: [...n.children].map((c) => Math.round(c.getBoundingClientRect().width)),
    alto: Math.round(n.getBoundingClientRect().height),
  }))
  check('se desliza de verdad', r.desliza === true, JSON.stringify(r))
  check('  …y ninguna tarjeta se aplasta', r.anchos.every((a) => a >= 260), JSON.stringify(r.anchos))
  check('  …todas del mismo ancho', new Set(r.anchos).size === 1, JSON.stringify(r.anchos))
  // Lo que PINGU pidió: «más pequeñitos». Antes eran dos cajas apiladas.
  check('y ocupa UNA fila, no dos apiladas', r.alto <= 180, String(r.alto))

  const puntos = await page.locator('#mcPdxPuntos .mc-punto').count()
  check('los puntos dicen cuántas hay', puntos === r.anchos.length, `${puntos} puntos / ${r.anchos.length} tarjetas`)
  check('  …y el primero está marcado',
    (await page.locator('#mcPdxPuntos .mc-punto').first().getAttribute('aria-selected')) === 'true')

  // Las tres tarjetas, con lo suyo.
  const titulos = await page.locator('#mcPokedexPanel .mc-diapo-titulo').allTextContents()
  check('salen las tres', titulos.length === 3, titulos.join(' | '))
  check('  …empezando por «Registrados»', titulos[0] === 'Registrados', titulos.join(' | '))
  // El anillo FLOTA en su esquina, como el de una expansión: antes caía
  // debajo de la cifra porque esa regla colgaba de `#mcAlbumProgreso`.
  const anillo = await page.locator('#mcPokedexPanel .mc-diapo').first().evaluate((caja) => {
    const a = caja.querySelector('.mc-anillo')
    if (!a) return null
    const c = caja.getBoundingClientRect()
    const r = a.getBoundingClientRect()
    return { pos: getComputedStyle(a).position, dentro: r.right <= c.right + 1 && r.top >= c.top - 1,
      redondo: Math.round(r.width) === Math.round(r.height), arriba: Math.round(r.top - c.top) }
  })
  check('el anillo flota en su esquina', anillo?.pos === 'absolute', JSON.stringify(anillo))
  check('  …dentro de su caja y redondo', anillo?.dentro && anillo?.redondo, JSON.stringify(anillo))
  check('  …y arriba, no debajo de la cifra', anillo?.arriba <= 24, JSON.stringify(anillo))

  // Y la página no se va de ancho: la tira desborda DENTRO de su caja.
  const pag = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  check('la página no se va de ancho', pag.s <= pag.c + 1, `${pag.s} > ${pag.c}`)
  await page.close()
}

console.log('\n── 3. Con sitio de sobra, en fila y sin puntos ──')
{
  const { page } = await abrir(1280)
  const r = await page.locator('#mcPokedexPanel .mc-tira-datos').evaluate((n) => ({
    display: getComputedStyle(n).display,
    columnas: getComputedStyle(n).gridTemplateColumns.split(' ').length,
    desliza: n.scrollWidth > n.clientWidth + 4,
  }))
  check('es una rejilla', r.display === 'grid', JSON.stringify(r))
  // `auto-flow: column` y no `repeat(3, 1fr)`: la Pokédex pinta dos o tres
  // tarjetas según si «el que menos» es otro que «el que más», y una
  // rejilla de tres fijas le dejaría un hueco vacío.
  check('  …con una columna por tarjeta', r.columnas === 3, JSON.stringify(r))
  check('  …y no hay nada que deslizar', r.desliza === false, JSON.stringify(r))
  check('los puntos no se ven', await page.locator('#mcPdxPuntos').isHidden())
  await page.close()
}

console.log('\n── 4. Y una expansión sigue igual que estaba ──')
{
  // El molde es compartido desde esta tanda, así que lo que se rompe en un
  // sitio se rompe en los dos: la prueba tiene que mirar los dos.
  const page = await browser.newPage({ viewport: { width: 390, height: 1100 }, hasTouch: true, isMobile: true })
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', serie_id: 'sv', market: 'WEST',
      card_count_official: 6, card_count_total: 6, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 6 }, (_, i) => ({
      id: `sv1-${i}`, market: 'WEST', set_id: 'sv1', local_id: String(i + 1), name: `Carta ${i}`,
      image_path: `x/${i}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = [{ id: 'l0', card_id: 'sv1-0', market: 'WEST', cantidad: 1,
      idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() }]
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  const r = await page.locator('#mcAlbumProgreso .mc-tira-datos').evaluate((n) => ({
    desliza: n.scrollWidth > n.clientWidth + 4,
    anchos: [...n.children].map((c) => Math.round(c.getBoundingClientRect().width)),
  }))
  check('la tira de una expansión sigue deslizándose', r.desliza === true, JSON.stringify(r))
  check('  …sin aplastar sus tarjetas', r.anchos.every((a) => a >= 260), JSON.stringify(r.anchos))
  check('y sus puntos siguen', (await page.locator('#mcAlbumPuntos .mc-punto').count()) === r.anchos.length)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
