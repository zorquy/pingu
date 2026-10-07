// Tanda 476 — la Pokédex, con la misma tira de datos que una expansión.
// (Desde la 748 la Pokédex lleva la cabecera de su maqueta; ver la sección 2.)
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

// Desde la 748 (la C3 de su maqueta) la Pokédex YA NO lleva la tira: el
// título con la región, cuántos llevas de ella y el anillo del total, y
// debajo las pestañas por región. La tira sigue en las expansiones (el
// molde puro de arriba es el suyo). Lo que se mira ahora es lo que la
// sustituye, con la misma preocupación de entonces: que no se coma la
// pantalla antes del primer Pokémon.
console.log('\n── 2. La cabecera de la Pokédex, la de su maqueta ──')
for (const ancho of [390, 1280]) {
  const { page, errores } = await abrir(ancho)
  check(`[${ancho}] sin errores`, errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const e = document.getElementById('mcPdxEncabezado')
    const a = e?.querySelector('.mc-anillo')
    const ra = a?.getBoundingClientRect()
    const primero = document.querySelector('#mcPokedexPanel .pdx-especie')?.getBoundingClientRect()
    return {
      titulo: e?.querySelector('.pdx-titulo')?.textContent, sub: e?.querySelector('.pdx-sub')?.textContent,
      anillo: a?.textContent, redondo: ra && Math.round(ra.width) === Math.round(ra.height),
      tira: document.querySelectorAll('#mcPokedexPanel .mc-tira-datos').length,
      regiones: [...document.querySelectorAll('.pdx-region')].map((b) => b.textContent),
      primerPokemon: primero ? Math.round(primero.top) : null,
      ancho: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    }
  })
  check(`[${ancho}] «Pokédex», la región con lo que llevas de ella y el anillo del total`, r.titulo === 'Pokédex' && r.sub === 'Kanto · 3 de 151' && /0,3 %/.test(r.anillo) && r.redondo, JSON.stringify(r))
  check(`[${ancho}]   …sin la tira de antes`, r.tira === 0)
  check(`[${ancho}]   …las nueve regiones, de Kanto a Paldea`, r.regiones.join() === 'Kanto,Johto,Hoenn,Sinnoh,Teselia,Kalos,Alola,Galar,Paldea', r.regiones.join())
  check(`[${ancho}]   …y el primer Pokémon a la vista sin bajar`, r.primerPokemon !== null && r.primerPokemon < 700, String(r.primerPokemon))
  check(`[${ancho}] la página no se va de ancho`, r.ancho)
  await page.locator('.pdx-region', { hasText: 'Johto' }).click()
  await page.waitForTimeout(400)
  check(`[${ancho}] tocar Johto enseña Johto: 100, del #152`, (await page.locator('.pdx-especie').count()) === 100 && (await page.locator('.pdx-especie').first().getAttribute('data-dex')) === '152' && /Johto · 0 de 100/.test(await page.textContent('.pdx-sub')))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
