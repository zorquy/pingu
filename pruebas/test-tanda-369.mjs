// Tanda 369 — el archivador que se estiraba, el logo en la lista y la
// ventana de editar con la carta delante.
//
// PINGU: «en álbumes está perfecto enseñado, pero en álbumes soñados
// debería ser igual […] se ve como una página, pero demasiado grande».
//
// No eran dos diseños: era el MISMO estirado. `.mc-archivador` iba con
// `auto-fit`, y con una sola hoja esa hoja se lleva todas las pistas y
// ocupa el ancho entero — los bolsillos salían al doble. En el álbum de
// un set casi siempre hay dos hojas y por eso ahí nunca cantó; en los
// soñados, que tienen pocas cartas, pasaba siempre.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const CARTA = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342">
<rect width="245" height="342" rx="12" fill="#f7d354"/>
<text x="122" y="180" font-size="60" text-anchor="middle" fill="#8a6a20">${n}</text></svg>`

async function abrir(cuantas, coleccion, opciones = {}) {
  const page = await browser.newPage({ viewport: opciones.viewport || { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => {
    const m = String(r.request().url()).match(/(\d+)\/low/)
    r.fulfill({ contentType: 'image/svg+xml', body: CARTA(m ? m[1] : '1') })
  })
  await page.addInitScript(([n, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', card_count_total: n, release_date: '2023-03-31', tcg_online_code: 'SVI' }]
    window.__FAKE_CARTAS__ = Array.from({ length: n }, (_, i) => ({
      id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1),
      name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv01/${i + 1}`, market: 'WEST',
    }))
    window.__FAKE_COLECCION__ = col
  }, [cuantas, coleccion])
  // `?ver=cartas` desde la tanda 447, y NO es un detalle de la prueba: la
  // pestaña por defecto es el PANEL desde la 440, y lo que esta prueba
  // mira vive en la pestaña de CARTAS. Sin el parámetro, el panel de
  // cartas está `hidden` y Playwright encuentra los elementos —existen en
  // el DOM— pero no son visibles: la prueba se cae con un «element is not
  // visible» que parece un fallo de la web y es una prueba que se quedó
  // vieja. Buscar un elemento NO es lo mismo que verlo.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

console.log('\n── 1. Un archivador mide lo mismo lleve una hoja o dos ──')
{
  const css = leer('css/mi-coleccion.css')
  // `auto-fit` decide por su cuenta cuántas pistas hay. Está bien para
  // una rejilla de tarjetas y mal para algo que tiene que medir SIEMPRE
  // lo mismo.
  check('el archivador ya no usa auto-fit', !/\.mc-archivador\s*\{[^}]*auto-fit/.test(css),
    (css.match(/\.mc-archivador\s*\{[^}]*\}/) || [])[0])

  // Seis cartas = una sola hoja, que es el caso que se rompía.
  const una = await abrir(6, [{ id: 'c1', card_id: 'sv1-1', cantidad: 1 }])
  // Desde la tanda 417 el archivador ya no es la vista de una expansión
  // —allí es una rejilla— sino la de un álbum soñado, que es donde el
  // orden lo pones tú carta a carta. Se monta uno con el set entero.
  await una.page.locator('[data-pestania="carpetas"]').click()
  await una.page.waitForTimeout(1200)
  await una.page.locator('#mcAlbNuevoAbrir').click()
  await una.page.waitForTimeout(700)
  // 759: primero el tipo; «una colección entera» es ahora un álbum de set.
  await una.page.click('[data-tipo="set"]')
  await una.page.waitForTimeout(500)
  await una.page.locator('#mcAlbNuevoSets [data-set]').first().click()
  await una.page.waitForTimeout(300)
  await una.page.locator('#mcAlbNuevoCrear').click()
  await una.page.waitForTimeout(1800)
  check('sin errores', una.errores.length === 0, una.errores.join(' | '))
  const medidaUna = await una.page.evaluate(() => {
    const h = document.querySelector('.mc-hoja:not(.mc-hoja-fantasma)')
    const a = document.querySelector('.mc-archivador')
    const b = document.querySelector('.mc-bolsillo')
    return h && a && b
      ? { hoja: Math.round(h.getBoundingClientRect().width), archivador: Math.round(a.getBoundingClientRect().width), bolsillo: Math.round(b.getBoundingClientRect().width) }
      : null
  })
  // Con el fallo, la hoja se comía el archivador entero.
  check('con una hoja, no se lleva el ancho entero',
    medidaUna && medidaUna.hoja < medidaUna.archivador * 0.65, JSON.stringify(medidaUna))
  // Y la otra cara no se queda en blanco: un archivador abierto tiene dos.
  check('  …y la otra cara está, vacía', (await una.page.locator('.mc-hoja-fantasma').count()) === 1)
  await una.page.close()

  // Y con dos hojas de verdad, el bolsillo tiene que medir LO MISMO. Es
  // lo que se quería: que el archivador no cambie de tamaño según lo
  // lleno que esté.
  const dos = await abrir(18, [{ id: 'c1', card_id: 'sv1-1', cantidad: 1 }])
  // Desde la tanda 417 el archivador ya no es la vista de una expansión
  // —allí es una rejilla— sino la de un álbum soñado, que es donde el
  // orden lo pones tú carta a carta. Se monta uno con el set entero.
  await dos.page.locator('[data-pestania="carpetas"]').click()
  await dos.page.waitForTimeout(1200)
  await dos.page.locator('#mcAlbNuevoAbrir').click()
  await dos.page.waitForTimeout(700)
  // 759: primero el tipo; «una colección entera» es ahora un álbum de set.
  await dos.page.click('[data-tipo="set"]')
  await dos.page.waitForTimeout(500)
  await dos.page.locator('#mcAlbNuevoSets [data-set]').first().click()
  await dos.page.waitForTimeout(300)
  await dos.page.locator('#mcAlbNuevoCrear').click()
  await dos.page.waitForTimeout(1800)
  const medidaDos = await dos.page.evaluate(() => {
    const b = document.querySelector('.mc-bolsillo')
    return b ? Math.round(b.getBoundingClientRect().width) : null
  })
  check('el bolsillo mide igual con una hoja que con dos',
    medidaUna && medidaDos && Math.abs(medidaUna.bolsillo - medidaDos) <= 2,
    `${medidaUna?.bolsillo} vs ${medidaDos}`)
  check('  …y con dos hojas no sobra una fantasma', (await dos.page.locator('.mc-hoja-fantasma').count()) === 0)
  await dos.page.close()
}

console.log('\n── 2. En el móvil sigue abriéndose por una hoja ──')
{
  const { page } = await abrir(18, [], { viewport: { width: 390, height: 900 } })
  // Desde la tanda 417 el archivador ya no es la vista de una expansión
  // —allí es una rejilla— sino la de un álbum soñado, que es donde el
  // orden lo pones tú carta a carta. Se monta uno con el set entero.
  await page.locator('[data-pestania="carpetas"]').click()
  await page.waitForTimeout(1200)
  await page.locator('#mcAlbNuevoAbrir').click()
  await page.waitForTimeout(700)
  // 759: primero el tipo; «una colección entera» es ahora un álbum de set.
  await page.click('[data-tipo="set"]')
  await page.waitForTimeout(500)
  await page.locator('#mcAlbNuevoSets [data-set]').first().click()
  await page.waitForTimeout(300)
  await page.locator('#mcAlbNuevoCrear').click()
  await page.waitForTimeout(1800)
  check('una hoja a la vez', (await page.locator('.mc-hoja:not(.mc-hoja-fantasma)').count()) === 1)
  // Y sin fantasma: en el móvil el archivador no está «abierto», se pasa
  // hoja a hoja. Una cara vacía ahí solo sería media pantalla perdida.
  check('  …y sin cara vacía', (await page.locator('.mc-hoja-fantasma').count()) === 0)
  await page.close()
}

console.log('\n── 3. Cardmarket, ahora dentro de la ficha ──')
{
  // Esto miraba la LISTA. Desde la tanda 392 la casilla es solo la carta
  // —sin nombre, sin precio y sin botones— y Cardmarket vive en la ficha,
  // que se abre pulsándola. Lo que se comprueba es lo mismo que antes; lo
  // que ha cambiado es dónde está, así que la prueba se muda con el dato
  // en vez de borrarse.
  const { page, errores } = await abrir(6, [{ id: 'c1', card_id: 'sv1-1', cantidad: 2 }])
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(500)
  // Desde la 589 el botón vive en el bloque de precio (js/precio-vista.js).
  const cm = page.locator('#mcEdPrecioBloque .btn-cardmarket')
  check('Cardmarket va con su marca, no con un enlace de texto',
    (await cm.locator('.cm-marca').count()) === 1)
  check('  …y sigue llevando a cardmarket.com',
    /cardmarket\.com/.test((await cm.getAttribute('href')) || ''), await cm.getAttribute('href'))
  // Lo que se pulsa mide 44 (norma de la casa); con ratón se deja en 32,
  // que es la excepción ya declarada para los controles densos.
  const alto = await cm.evaluate((e) => e.getBoundingClientRect().height)
  check('y se puede pulsar', alto >= 32, `${Math.round(alto)}px`)
  // Y la carta de la lista también: es el único control que queda ahí.
  const carta = await page.locator('.mc-carta-foto').first().evaluate((e) => e.getBoundingClientRect())
  check('la carta de la lista también se puede pulsar',
    carta.width >= 44 && carta.height >= 44, `${Math.round(carta.width)}×${Math.round(carta.height)}`)
  await page.close()
}

console.log('\n── 4. La ventana de editar enseña la carta ──')
{
  // El fallo que arregla: con dos impresiones de la misma carta en la
  // colección, la ventana decía el nombre y nada más — no había forma de
  // saber cuál estabas tocando hasta guardar.
  const { page, errores } = await abrir(6, [
    { id: 'c1', card_id: 'sv1-1', cantidad: 2 },
    { id: 'c2', card_id: 'sv1-3', cantidad: 1 },
  ])
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  const d = page.locator('#mcEditor')
  check('la ventana se abre', await d.isVisible())
  check('  …con el escaneo de la carta', (await d.locator('#mcEdFoto img').count()) === 1)
  check('  …con su nombre', ((await d.locator('#mcEditorTitulo').textContent()) || '').trim().length > 0)
  check('  …y de qué colección es', /Escarlata/.test((await d.locator('#mcEdSet').textContent()) || ''),
    await d.locator('#mcEdSet').textContent())
  check('  …y su enlace a Cardmarket', (await d.locator('#mcEdPrecioBloque .btn-cardmarket .cm-marca').count()) === 1)

  // Y la foto es la de LA LÍNEA que has pulsado, no la primera que haya:
  // es justo el fallo que esto arregla.
  const primera = await d.locator('#mcEditorTitulo').textContent()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('.mc-carta-foto').nth(1).click()
  await page.waitForTimeout(700)
  check('  …y cambia al abrir otra línea', (await d.locator('#mcEditorTitulo').textContent()) !== primera,
    `${primera} → ${await d.locator('#mcEditorTitulo').textContent()}`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
