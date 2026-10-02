// Tanda 375 — el «Sin precio» que no era.
//
// PINGU: «he añadido una carta y me sale que no hay precio, pero debería
// haber». Eran TRES fallos encadenados, y los tres del mismo tipo: un
// hueco que se toma por una respuesta.
//
//   1. Marcar una carta como «reverse holo» pedía los campos `-holo` de
//      Cardmarket, que solo existen en las cartas que Cardmarket lista
//      como producto aparte. En las demás están a null — y el precio
//      DESAPARECÍA al elegir la versión.
//   2. `precioDeLinea` daba por buena cualquier fila de
//      `tcg_card_prices`, tuviera cifras o no. La función programada
//      guarda fila para toda carta que mira, así que una fila vacía
//      tapaba la consulta en vivo PARA SIEMPRE.
//   3. Un precio del que solo se sabe el `idProduct` pintaba «Desde — ·
//      tendencia —». Dos rayas no son un precio.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('\n── 1. Un reverso sin precio propio vale lo que la carta ──')
{
  const { precioDe, valorDe } = await import('/home/user/pingu/js/cardmarket.js')

  // El caso de PINGU: la carta tiene precio, los campos `-holo` no
  // existen, y pedir el del reverso devolvía NADA.
  const sinHolo = { cardmarket: { idProduct: 1, low: 2, trend: 5, avg30: 4 } }
  const r = precioDe(sinHolo, { reverse: true })
  check('el reverso ya no se queda sin precio', valorDe(r) === 5, JSON.stringify(r))
  check('  …y se marca que el número es prestado', r.prestado === true)
  check('  …mientras que el normal no lo marca', precioDe(sinHolo).prestado === false)

  // Y cuando SÍ tiene los suyos, manda los suyos: lo prestado es el
  // último recurso, no el primero. Un reverso suele valer más.
  const conHolo = { cardmarket: { idProduct: 1, low: 2, trend: 5, 'low-holo': 7, 'trend-holo': 9 } }
  const propio = precioDe(conHolo, { reverse: true })
  check('con cifras propias, manda lo suyo', propio.tendencia === 9 && propio.desde === 7,
    JSON.stringify(propio))
  check('  …y no se marca como prestado', propio.prestado === false)

  // Lo que no puede pasar nunca: que el normal se coma el del reverso.
  check('el normal nunca coge las del reverso', precioDe(conHolo).tendencia === 5)

  // Sin nada de nada, sigue siendo null: prestar no es inventar.
  check('sin cardmarket sigue sin haber precio', precioDe({}) === null && precioDe(null) === null)
  check('  …y con el idProduct a secas no hay cifras que sumar',
    valorDe(precioDe({ cardmarket: { idProduct: 9 } })) === null)
}

console.log('\n── 2. Una fila guardada VACÍA no es una respuesta ──')
{
  const { precioDeLinea, tieneCifras } = await import('/home/user/pingu/js/mi-coleccion/datos.js')

  // Así es como llega del servidor la carta que el día de la pasada no
  // estaba en Cardmarket: la fila existe, las cifras no.
  const guardadosVacio = new Map([['sv1-1', { card_id: 'sv1-1', cm_id_product: 77, cm_low: null, cm_trend: null, cm_avg30: null }]])
  const vivos = new Map([['sv1-1', { pricing: { cardmarket: { idProduct: 77, low: 3, trend: 6, avg30: 5 } } }]])
  const p = precioDeLinea({ card_id: 'sv1-1', variante: 'normal' }, guardadosVacio, vivos)
  check('la fila vacía ya no tapa la consulta en vivo', p?.tendencia === 6, JSON.stringify(p))

  // Pero una fila CON cifras sigue mandando: es la que no cuesta una
  // petición, y es para lo que existe la tabla.
  const guardadosLleno = new Map([['sv1-1', { card_id: 'sv1-1', cm_id_product: 77, cm_low: 1, cm_trend: 2, cm_avg30: 2 }]])
  check('  …pero una fila con cifras sigue mandando',
    precioDeLinea({ card_id: 'sv1-1' }, guardadosLleno, vivos)?.tendencia === 2)

  // Y si no hay cifras en ninguna parte, se devuelve el que traiga el
  // `idProduct`: sin él el enlace a Cardmarket cae en una búsqueda por
  // nombre en vez de en la carta.
  const solo = precioDeLinea({ card_id: 'sv1-1' }, guardadosVacio, new Map())
  check('sin cifras en ningún lado, queda el idProduct para el enlace', solo?.idProduct === 77,
    JSON.stringify(solo))
  check('  …y «tiene cifras» dice que no', tieneCifras(solo) === false)
  check('  …ni con null', tieneCifras(null) === false)
}

console.log('\n── 3. En la pantalla ──')
const browser = await chromium.launch()
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'

async function abrir(coleccion) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  // La ficha de TCGdex con precio pero SIN los campos del reverso: el
  // caso de PINGU, servido tal cual llega.
  await page.route('**/api.tcgdex.net/**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: 'sv1-1', pricing: { cardmarket: { idProduct: 769304, low: 2.5, trend: 5.5, avg30: 5, updated: '2026-09-29' } } }),
    })
  )
  await page.addInitScript((col) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI' }]
    window.__FAKE_CARTAS__ = [
      { id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/1', market: 'WEST', rarity: 'Rare Holo' },
    ]
    window.__FAKE_COLECCION__ = col
  }, coleccion)
  // `?ver=cartas` desde la tanda 447, y NO es un detalle de la prueba: la
  // pestaña por defecto es el PANEL desde la 440, y lo que esta prueba
  // mira vive en la pestaña de CARTAS. Sin el parámetro, el panel de
  // cartas está `hidden` y Playwright encuentra los elementos —existen en
  // el DOM— pero no son visibles: la prueba se cae con un «element is not
  // visible» que parece un fallo de la web y es una prueba que se quedó
  // vieja. Buscar un elemento NO es lo mismo que verlo.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

{
  const { page, errores } = await abrir([{ id: 'l1', card_id: 'sv1-1', cantidad: 1, variante: 'reverse', idioma: 'es', estado: 'NM' }])
  check('sin errores', errores.length === 0, errores.join(' | '))
  // El precio salió de la casilla en la tanda 392 —la colección enseña
  // la carta y ya— y vive en la ficha, que se abre pulsándola. Lo que se
  // comprueba no cambia; cambia dónde mirarlo.
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(500)
  const valor = limpio(await page.locator('#mcEdPrecio').textContent())
  check('la carta en reverse YA no dice «Sin precio»', !/Sin precio/.test(valor), valor)
  check('  …y enseña el de la normal', /5,50/.test(valor), valor)
  // La ficha lo dice con más palabras que la casilla de antes («de la
  // versión normal: Cardmarket no publica el del reverso»), que es lo
  // mismo pero explicado. Lo que importa es que NO se dé por suyo.
  check('  …diciendo de dónde sale', /de la versión normal/.test(valor), valor)
  // Y el total de arriba deja de decir que te falta un precio.
  const nota = limpio(await page.locator('#mcResumenNota').textContent())
  check('  …y arriba no se cuenta como carta sin precio', !/no tiene precio/.test(nota), nota)
  await page.close()
}

console.log('\n── 4. Y una normal no dice de dónde sale, porque sale de su sitio ──')
{
  const { page } = await abrir([{ id: 'l1', card_id: 'sv1-1', cantidad: 1, variante: 'normal', idioma: 'es', estado: 'NM' }])
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(500)
  const valor = limpio(await page.locator('#mcEdPrecio').textContent())
  check('la normal enseña su precio', /5,50/.test(valor), valor)
  check('  …y sin la coletilla', !/de la versión normal/.test(valor), valor)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
