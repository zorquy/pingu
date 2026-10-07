// Tanda 400 — la cabecera de la Pokédex.
//
// PINGU, enseñando Dex: arriba de su Pokédex hay cuatro cifras —cuántos
// llevas, cuántos has completado, el que más tienes y el que menos— y
// aquí solo había un «X de 1.025» en letra pequeña.
//
// «Completados» se fue en la tanda 431, a petición suya: «es una
// estadística que sobra porque nadie o casi nadie tendrá completadas todas
// las cartas de un Pokémon». Un Pikachu tiene más de 300, así que era un
// cero permanente ocupando un cuarto de la cabecera.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

console.log('\n── 1. Las cifras, sin navegador ──')
{
  const { resumenDePokedex, cabeceraHtml } = await import('/home/user/pingu/js/mi-coleccion/pokedex.js')
  const mio = new Map([[1, 3], [25, 31], [150, 1], [4, 0]])
  const totales = new Map([[1, 3], [25, 90], [150, 12]])
  const r = resumenDePokedex({ mio, totales })

  check('cuenta los que tienes', r.registrados === 3, String(r.registrados))
  check('  …y el que está a cero no cuenta', r.registrados !== 4)
  // Y «completados» ya no existe (tanda 431): era un cero permanente.
  check('ya no se cuentan los completados', r.completados === undefined, String(r.completados))
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
  check('  …pero «Registrados» sí', /Registrados/.test(html))
  check('  …y «Completados» ya no está en ninguna', !/Completados/.test(html) &&
    !/Completados/.test(cabeceraHtml(r)))

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
  // Desde la 748 la cabecera es la de su maqueta (C3): «Pokédex», la región
  // que se mira con cuántas llevas de ella, y el anillo de la Pokédex
  // entera. Lo que esta prueba vigila —que esté y que diga cuántos llevas—
  // sigue; el «el que más tienes» se fue con la tira.
  check('la cabecera está', (await page.locator('#mcPdxEncabezado .pdx-encabezado').count()) === 1)
  const texto = (await page.locator('#mcPdxEncabezado').textContent())?.replace(/\s+/g, ' ') || ''
  check('dice cuántos llevas de la región', /Pokédex/.test(texto) && /Kanto · 2 de 151/.test(texto), texto.slice(0, 120))
  check('  …y el anillo, de la Pokédex entera y sin redondear a cero', /0,2 %/.test(texto), texto.slice(0, 160))
  // `especiePorDex` devuelve el NOMBRE, no un objeto: pedirle `.nombre`
  // daba undefined y salía «#25» en vez de «Pikachu».
  const pika = (await page.locator('.pdx-especie').nth(24).textContent())?.replace(/\s+/g, ' ') || ''
  check('y nombra al Pokémon, no solo su número', /Pikachu/.test(pika), pika.slice(0, 160))
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
