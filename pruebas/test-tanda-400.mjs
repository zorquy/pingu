// Tanda 400 — la cabecera de la Pokédex.
//
// PINGU, enseñando Dex: arriba de su Pokédex hay cuatro cifras —cuántos
// llevas, cuántos has completado, el que más tienes y el que menos— y
// aquí solo había un «X de 1.025» en letra pequeña.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

console.log('\n── 1. Las cuatro cifras, sin navegador ──')
{
  const { resumenDePokedex, cabeceraHtml } = await import('/home/user/pingu/js/mi-coleccion/pokedex.js')
  const mio = new Map([[1, 3], [25, 31], [150, 1], [4, 0]])
  const totales = new Map([[1, 3], [25, 90], [150, 12]])
  const r = resumenDePokedex({ mio, totales })

  check('cuenta los que tienes', r.registrados === 3, String(r.registrados))
  check('  …y el que está a cero no cuenta', r.registrados !== 4)
  // Completado es tener TODAS las que el catálogo conoce.
  check('completado es tenerlas todas', r.completados === 1, String(r.completados))
  check('el que más tienes', r.mas.dex === 25 && r.mas.cuantas === 31, JSON.stringify(r.mas))
  // El que MENOS es entre los que tienes: un cero no es «poco», es que
  // no lo tienes, y para eso ya está lo que falta.
  check('el que menos, entre los que tienes', r.menos.dex === 150, JSON.stringify(r.menos))

  // Con la Pokédex vacía no hay «el que más»: enseñar a alguien con un 0
  // sería inventarlo (la regla de los tres estados, tanda 319).
  const vacia = resumenDePokedex({})
  check('vacía, no hay «el que más»', vacia.mas === null && vacia.menos === null)
  const html = cabeceraHtml(vacia)
  check('  …y esas dos tarjetas no se pintan',
    !/El que más/.test(html) && !/El que menos/.test(html))
  check('  …pero las otras dos sí', /Registrados/.test(html) && /Completados/.test(html))

  // 2 de 1.025 redondeado da «0 %», que parece que no tienes nada.
  const poco = cabeceraHtml(resumenDePokedex({ mio: new Map([[1, 1], [2, 1]]), totales: new Map() }))
  check('un porcentaje pequeño no se redondea a cero', /0,2 %/.test(poco), poco.slice(0, 200))
  // Y el total con punto de millar: «1025» se lee como un número de carta.
  check('  …y el total lleva su punto', /1\.025/.test(poco), poco.slice(0, 200))
}

console.log('\n── 2. En la pantalla ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST',
      card_count_official: 4, card_count_total: 4, release_date: '2023-01-01' }]
    window.__FAKE_CARTAS__ = [
      { id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Pikachu', image_path: 'x/1', market: 'WEST', dex_ids: [25], variants: { normal: true } },
      { id: 'sv1-2', set_id: 'sv1', local_id: '2', name: 'Bulbasaur', image_path: 'x/2', market: 'WEST', dex_ids: [1], variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = [1, 2].map((n) => ({
      id: `l${n}`, card_id: `sv1-${n}`, cantidad: 1, idioma: 'es', estado: 'nueva', variante: 'normal',
    }))
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=pokedex', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la cabecera está', (await page.locator('.mc-pdx-caja').count()) >= 2)
  const texto = (await page.locator('.mc-pdx-cabecera').textContent())?.replace(/\s+/g, ' ') || ''
  check('dice cuántos llevas', /Registrados/.test(texto) && /de 1\.025/.test(texto), texto.slice(0, 120))
  // `especiePorDex` devuelve el NOMBRE, no un objeto: pedirle `.nombre`
  // daba undefined y salía «#25» en vez de «Pikachu».
  check('y nombra al Pokémon, no su número', /Pikachu/.test(texto) && !/#25/.test(texto), texto.slice(0, 160))
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
