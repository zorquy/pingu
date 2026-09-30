// Tanda 374 — el resumen: qué tienes, no cuánto.
//
// Las cuatro cifras de arriba dicen CUÁNTO tienes. Esta pestaña dice QUÉ
// tienes, y todo sale de lo que ya estaba guardado — ni una consulta
// más.
//
// Lo que importa de las tres:
//   · Las REPETIDAS son la puerta a los intercambios: sin saber qué te
//     sobra no hay nada que ofrecer.
//   · Lo más valioso va por lo que vale UNA copia, no la línea: diez
//     cartas de un euro no son «lo más valioso que tienes».
//   · El reparto cuenta cartas DISTINTAS: «tengo 40 de Espada y Escudo»
//     se entiende; «78 contando repetidas» no dice nada.
// (Tanda 377: las cuatro cajas se nombran por su REJILLA. Desde
// entonces hay una quinta con la misma clase —la del valor en el
// tiempo— que va fuera de ella a propósito, así que «las cuatro cajas»
// ya no es «todo lo que lleva esta clase».)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

const SETS = [
  { id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', card_count_official: 198, tcg_online_code: 'SVI', release_date: '2023-03-31' },
  { id: 'swsh1', name: 'Espada y Escudo', market: 'WEST', serie_id: 'swsh', serie_name: 'Espada y Escudo', card_count_official: 202, tcg_online_code: 'SSH', release_date: '2020-02-07' },
]

async function abrir(coleccion, opciones = {}) {
  const page = await browser.newPage({ viewport: opciones.viewport || { width: 1280, height: 1250 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) =>
    r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>' })
  )
  await page.addInitScript(([sets, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = sets
    const RAREZAS = ['Common', 'Rare Holo', 'Ultra Rare', 'Hyper rare', 'Common', 'Rare']
    window.__FAKE_CARTAS__ = [...Array(12)].map((_, i) => ({
      id: i < 8 ? `sv1-${i + 1}` : `swsh1-${i - 7}`,
      set_id: i < 8 ? 'sv1' : 'swsh1',
      local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`,
      image_path: `x/${i + 1}`, market: 'WEST', rarity: RAREZAS[i % 6],
    }))
    window.__FAKE_COLECCION__ = col
  }, [SETS, coleccion])
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('[data-pestania="resumen"]').click()
  await page.waitForTimeout(1200)
  return { page, errores }
}

const COL = [
  { id: 'l1', card_id: 'sv1-1', cantidad: 3, valor_manual: 120 },
  { id: 'l2', card_id: 'sv1-2', cantidad: 2, valor_manual: 8 },
  { id: 'l3', card_id: 'sv1-3', cantidad: 1, valor_manual: 45 },
  { id: 'l4', card_id: 'sv1-4', cantidad: 4, valor_manual: 2 },
  { id: 'l5', card_id: 'swsh1-1', cantidad: 1, valor_manual: 15 },
  { id: 'l6', card_id: 'swsh1-2', cantidad: 2, valor_manual: 30 },
]

console.log('\n── 1. Las repetidas ──')
{
  const { page, errores } = await abrir(COL)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las cuatro cajas', (await page.locator('.mc-resumen-rejilla .mc-resumen-caja').count()) === 4)
  const caja = page.locator('.mc-resumen-rejilla .mc-resumen-caja').first()
  // Sobran: 2 (de 3) + 1 (de 2) + 3 (de 4) + 1 (de 2) = 7, de 4 cartas.
  check('dice cuántas copias te sobran', /Te sobran 7 copias de 4 cartas/.test(limpio(await caja.textContent())),
    limpio(await caja.textContent()).slice(0, 90))
  // Ordenadas por lo que sobra, no por lo que tienes: lo que se quiere
  // ver arriba es lo que más puedes cambiar.
  check('  …y van por lo que SOBRA', /Carta 4.*te sobran 3/.test(limpio(await caja.locator('.mc-fila-carta').first().textContent())),
    limpio(await caja.locator('.mc-fila-carta').first().textContent()))
  check('  …con la cuenta de las dos cosas', /tienes 4 · te sobran 3/.test(limpio(await caja.locator('.mc-fila-carta').first().textContent())))
  // Una carta con una sola copia no es una repetida.
  check('  …y las que no tienes repetidas no salen',
    !/Carta 3/.test(limpio(await caja.textContent())), limpio(await caja.textContent()).slice(0, 200))
  await page.close()
}

console.log('\n── 2. Lo más valioso, por copia ──')
{
  const { page } = await abrir(COL)
  const caja = page.locator('.mc-resumen-rejilla .mc-resumen-caja').nth(1)
  const filas = await caja.locator('.mc-fila-carta').allTextContents()
  // Carta 1 vale 120 la copia (y 360 la línea); Carta 4 vale 2 la copia
  // (y 8 la línea). Si se ordenara por la LÍNEA, la 4 subiría por encima
  // de la 2 — y diez cartas de un euro no son «lo más valioso».
  check('la más cara va primera', /Carta 1/.test(limpio(filas[0])), limpio(filas[0]))
  check('  …con el precio de UNA copia', /120,00/.test(limpio(filas[0])), limpio(filas[0]))
  const orden = filas.map((t) => (limpio(t).match(/Carta \d+/) || [''])[0])
  check('  …y el orden es por copia, no por línea', orden.indexOf('Carta 2') < orden.indexOf('Carta 4'),
    orden.join(' > '))
  check('  …y se dice', /vale UNA copia/.test(limpio(await caja.textContent())))
  await page.close()
}

console.log('\n── 3. El reparto cuenta DISTINTAS ──')
{
  const { page } = await abrir(COL)
  const porColeccion = page.locator('.mc-resumen-rejilla .mc-resumen-caja').nth(2)
  const t = limpio(await porColeccion.textContent())
  // 4 cartas distintas de sv1 y 2 de swsh1 — aunque sean 13 copias.
  check('Escarlata y Púrpura cuenta 4', /Escarlata y Púrpura 4/.test(t.replace(/\s+/g, ' ')), t.slice(0, 120))
  check('  …y Espada y Escudo 2', /Espada y Escudo 2/.test(t.replace(/\s+/g, ' ')), t.slice(0, 120))
  const porRareza = page.locator('.mc-resumen-rejilla .mc-resumen-caja').nth(3)
  // Las rarezas salen EN CRISTIANO, no en el inglés del catálogo.
  check('las rarezas salen traducidas', /Hiperrara|Ultra rara|Rara holo/.test(limpio(await porRareza.textContent())),
    limpio(await porRareza.textContent()).slice(0, 120))
  await page.close()
}

console.log('\n── 4. Una colección vacía no enseña cajas vacías ──')
{
  const { page, errores } = await abrir([])
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('no se pintan cuatro cajas en blanco', (await page.locator('.mc-resumen-rejilla .mc-resumen-caja').count()) === 0,
    String(await page.locator('.mc-resumen-rejilla .mc-resumen-caja').count()))
  check('  …sino que se dice', /Cuando añadas cartas/.test(limpio(await page.locator('#mcResumenPanel').textContent())),
    limpio(await page.locator('#mcResumenPanel').textContent()))
  await page.close()
}

console.log('\n── 5. Sin repetidas y sin precios, se dice ──')
{
  const { page } = await abrir([
    { id: 'l1', card_id: 'sv1-1', cantidad: 1 },
    { id: 'l2', card_id: 'sv1-2', cantidad: 1 },
  ])
  check('lo de las repetidas se dice', /No tienes ninguna repetida/.test(limpio(await page.locator('.mc-resumen-rejilla .mc-resumen-caja').first().textContent())),
    limpio(await page.locator('.mc-resumen-rejilla .mc-resumen-caja').first().textContent()))
  // Sin precio no se enseña una lista vacía ni un 0,00 €, que mentiría.
  check('  …y lo del precio también', /no sabemos el precio/.test(limpio(await page.locator('.mc-resumen-rejilla .mc-resumen-caja').nth(1).textContent())),
    limpio(await page.locator('.mc-resumen-rejilla .mc-resumen-caja').nth(1).textContent()))
  await page.close()
}

console.log('\n── 6. Cuatro cajas, dos columnas ──')
{
  // Con tres columnas la cuarta se queda sola en una fila con media
  // pantalla en blanco al lado. Se mide dónde acaban pintadas.
  const { page } = await abrir(COL)
  const filas = await page.evaluate(() =>
    [...document.querySelectorAll('.mc-resumen-rejilla .mc-resumen-caja')].map((e) => Math.round(e.getBoundingClientRect().top))
  )
  check('dos por fila', new Set(filas).size === 2, filas.join(', '))
  await page.close()

  // Y en el móvil, una: un `minmax` con un mínimo mayor que la pantalla
  // saca barra horizontal.
  const movil = await abrir(COL, { viewport: { width: 390, height: 900 } })
  const ancho = await movil.page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }))
  check('en el móvil no se desborda', ancho.doc <= ancho.ventana + 1, JSON.stringify(ancho))
  await movil.page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
