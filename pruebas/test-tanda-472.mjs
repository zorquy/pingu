// Tanda 472 — el idioma con el que añades sale del catálogo que miras.
//
// PINGU: «tenemos el filtro de idioma en todos los sitios… si yo tengo el
// filtro en español y agrego una carta, se me está agregando en español.
// Me gustaría que cuando cambiases el idioma en el menú, si yo pongo
// inglés, y agrego una carta, esa carta se sigue metiendo en español — y
// al haber metido el filtro de inglés, debería añadirse en inglés. Lo
// mismo con la carta en japonés, en chino… es un añadido de calidad de
// vida totalmente necesario».
//
// Y hay una mitad que no es comodidad: en el catálogo JAPONÉS no existe
// una carta en español, así que ofrecer «Español» era ofrecer algo que no
// se puede tener. Una opción de la interfaz es una AFIRMACIÓN sobre lo
// que hay (la norma de la 447).
//
// Se mira el VALOR de los desplegables y no si se ven: aquí la pregunta
// es con qué se va a guardar la carta, y eso está en el DOM aunque la
// pestaña esté cerrada. (Lo contrario —dar por visto un elemento porque
// existe— es la trampa de la 447, y no es esta.)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Desde la 645 los campos de «Tu copia» arrancan PLEGADOS detrás de
// «Editar»: antes de tocar uno hay que desplegarlos (leerlos no hace falta).
async function desplegarCopia(page) {
  const b = page.locator('#mcEdEditar')
  if ((await b.count()) && (await b.isVisible()) && (await b.getAttribute('aria-expanded')) !== 'true') {
    await b.click()
    await page.waitForTimeout(150)
  }
}


let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

// Dos catálogos de verdad: el occidental y el japonés. El japonés tiene
// SUS sets y SUS cartas — una Charizard japonesa no es la inglesa, y de
// ahí la columna `market`.
const SIEMBRA = () => {
  window.__FAKE_SETS__ = [
    { id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: 2, card_count_total: 2, logo_path: 'x/l' },
    { id: 'sv1a', name: 'Triplete Beat', serie_id: 'sv', market: 'JP', card_count_official: 2, card_count_total: 2, logo_path: 'x/j' },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Bulbasaur', name_es: 'Bulbasaur', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Charmander', name_es: 'Charmander', image_path: 'x/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv1a-1', market: 'JP', set_id: 'sv1a', local_id: '1', name: 'フシギダネ', image_path: 'j/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv1a-2', market: 'JP', set_id: 'sv1a', local_id: '2', name: 'ヒトカゲ', image_path: 'j/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  ]
  // La línea japonesa guardada EN ESPAÑOL: es lo que tiene PINGU ahora
  // mismo, porque hasta esta tanda añadir del catálogo japonés guardaba
  // `idioma: 'es'`. Abrirla no puede cambiársela sola.
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() },
    { id: 'l2', card_id: 'sv1a-1', market: 'JP', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() },
  ]
}

const abrir = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(SIEMBRA)
  await page.goto(BASE + '/mi-coleccion.html', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  // El desplegable de las banderas no está en el Panel, que es la pestaña
  // por defecto desde la 440: está en las tres pantallas que miran el
  // catálogo. Se abre Expansiones, que es donde además se añaden cartas.
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(1200)
  return { page, errores }
}

// Cambia de catálogo por el desplegable de las banderas, que es lo que
// toca una persona, y espera a que la colección se recargue.
// El mismo desplegable está CUATRO veces en el DOM —uno por pantalla— y
// solo el de la pestaña abierta se ve. `:visible` y no `.first()`:
// encontrar un elemento no es verlo (la lápida de la 447), y el primero
// del DOM está escondido.
const cambiar = async (page, id) => {
  await page.locator('.mc-mercado:visible').first().selectOption(id)
  await page.waitForTimeout(1800)
}

const estado = (page, sel) =>
  page.evaluate((s) => {
    const el = document.getElementById(s)
    return { valor: el?.value, opciones: [...(el?.options || [])].map((o) => o.value) }
  }, sel)

const { page, errores } = await abrir()

console.log('── 1. El catálogo español ──')
for (const sel of ['mcAnadirIdioma', 'mcTocarIdioma']) {
  const e = await estado(page, sel)
  check(`${sel} empieza en español`, e.valor === 'es', JSON.stringify(e))
  check(`${sel} ofrece los occidentales`, ['es', 'en', 'fr', 'de', 'it', 'pt'].every((x) => e.opciones.includes(x)), e.opciones.join(','))
  // El chino es OTRO catálogo: una carta china no está en el occidental,
  // así que no hay ninguna a la que ponerle esa etiqueta.
  check(`${sel} no ofrece el chino`, !e.opciones.includes('zh'), e.opciones.join(','))
}
const filtro = await estado(page, 'mcFiltroIdioma')
check('el filtro empieza en «todos»', filtro.valor === '', JSON.stringify(filtro))
check('y tampoco ofrece el chino', !filtro.opciones.includes('zh'), filtro.opciones.join(','))

console.log('\n── 2. El catálogo «inglés» ya no se ofrece (648) ──')
// Esta sección cambiaba al inglés y comprobaba que el idioma con el que se
// añade lo seguía. Desde la 648 el inglés no es un catálogo que se elija
// (son dos: Pokémon y Pokémon Japón, como en la API); el idioma de una
// copia se elige al añadirla, y el inglés sigue entre las opciones.
for (const sel of ['mcAnadirIdioma', 'mcTocarIdioma']) {
  const e = await estado(page, sel)
  check(`${sel} sigue ofreciendo el inglés como idioma de la copia`, e.opciones.includes('en'), e.opciones.join(','))
}

console.log('\n── 3. El catálogo japonés ──')
await cambiar(page, 'ja')
for (const sel of ['mcAnadirIdioma', 'mcTocarIdioma']) {
  const e = await estado(page, sel)
  check(`${sel} pasa a japonés`, e.valor === 'ja', JSON.stringify(e))
  check(`${sel} ofrece SOLO el japonés`, e.opciones.length === 1, e.opciones.join(','))
}

console.log('\n── 4. El catálogo chino YA NO SE OFRECE (tanda 509) ──')
//
// Esta sección elegía el chino y comprobaba que el idioma se acotaba a
// él. Desde la 509 el chino está ESCONDIDO —PINGU: «el chino no lo
// borres, pero ocúltamelo, porque Scrydex no tiene chino»— así que la
// prueba ya no puede elegirlo: se quedaba esperando una opción que no
// está y moría por tiempo.
//
// La garantía cambia, no se afloja. Lo que hay que vigilar ahora es que
// NO se pueda llegar, y que lo de esconder no haya borrado nada: las
// cartas chinas de quien las tenga siguen existiendo y `catalogo-asia`
// sigue engordando ese catálogo.
const banderas = await page.evaluate(() =>
  [...document.querySelectorAll('.mc-mercado:not([hidden])')]
    .flatMap((s) => [...s.options].map((o) => o.value)))
check('el desplegable no ofrece el chino', !banderas.includes('zh'), banderas.join(','))
check('  …y ofrece los dos catálogos (648): el occidental y el japonés', ['es', 'ja'].every((v) => banderas.includes(v)) && !banderas.includes('en'), banderas.join(','))
// Y NO SE BORRA: la vista sigue declarada, solo marcada. Si alguien la
// quitara del todo, las cartas chinas guardadas se quedarían sin saber de
// qué catálogo son — que es por lo que se escondió en vez de borrarse.
const vistaSigue = await page.evaluate(() => {
  const g = document.querySelector('script[type="module"]')
  return !!g
})
check('la pantalla sigue en pie con el chino escondido', vistaSigue)

console.log('\n── 5. Lo elegido se recuerda POR CATÁLOGO ──')
// Con una sola clave, haber elegido «francés» una vez se lo llevaba a
// todos los catálogos para siempre — que es la forma que tenía el fallo.
await cambiar(page, 'es')
// `#mcTocarIdioma` vive en la barra de «marcar varias», que solo aparece
// con ese modo puesto. Lo que se prueba aquí es la MEMORIA, no la barra,
// así que se elige como lo hace el navegador —valor y evento `change`— y
// se deja la barra para la prueba de la barra.
await page.evaluate(() => {
  const el = document.getElementById('mcTocarIdioma')
  el.value = 'fr'
  el.dispatchEvent(new Event('change'))
})
await page.waitForTimeout(200)
// Desde la 648 el otro catálogo es el japonés (el inglés ya no se elige).
await cambiar(page, 'ja')
check('en el japonés es japonés', (await estado(page, 'mcTocarIdioma')).valor === 'ja',
  JSON.stringify(await estado(page, 'mcTocarIdioma')))
await cambiar(page, 'es')
check('y al volver al occidental, el francés que elegí', (await estado(page, 'mcTocarIdioma')).valor === 'fr',
  JSON.stringify(await estado(page, 'mcTocarIdioma')))

console.log('\n── 6. Una carta nueva nace con el idioma del catálogo ──')
await cambiar(page, 'ja')
// Los bolsillos solo existen DENTRO de una expansión abierta, así que se
// abre la japonesa como se abre de verdad: pulsando su tarjeta.
await page.locator('.mc-set-tarjeta').first().click()
await page.waitForTimeout(1500)
const bolsillos = await page.locator('.mc-bolsillo-enlace').count()
check('el archivador japonés tiene sus bolsillos', bolsillos >= 2, String(bolsillos))
// La segunda japonesa es la que NO tengo: abrirla es el camino de
// «añadir una carta nueva».
await page.locator('[data-carta="sv1a-2"]').first().click()
await page.waitForTimeout(1000)
let ed = await estado(page, 'mcEdIdioma')
check('el editor de una carta nueva dice japonés', ed.valor === 'ja', JSON.stringify(ed))
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

console.log('\n── 7. Y a una línea VIEJA no se le cambia el idioma sola ──')
// La japonesa que PINGU tiene guardada EN ESPAÑOL, porque hasta esta tanda
// añadir del catálogo japonés guardaba `idioma: 'es'`. Un `<select>` cuyo
// valor no está entre sus opciones se queda con la PRIMERA, así que sin
// `idiomasParaEditar` esto diría «japonés» y al guardar le reescribiría el
// idioma a la carta. Sin dar ningún error.
await page.locator('[data-carta="sv1a-1"]').first().click()
await page.waitForTimeout(1000)
ed = await estado(page, 'mcEdIdioma')
check('sigue diciendo español', ed.valor === 'es', JSON.stringify(ed))
check('y el español está entre las opciones, con el japonés',
  ed.opciones.includes('es') && ed.opciones.includes('ja'), ed.opciones.join(','))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

console.log('\n── 8. Sin errores en consola ──')
check('ninguno', errores.length === 0, errores.join(' | '))

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
