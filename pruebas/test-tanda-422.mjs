// Tanda 422 — moverse por la ficha sin cerrarla, y poder cerrarla.
//
// Dos huecos de /mi-coleccion que se ven en cuanto se usa de verdad:
//
//   1. repasar un set de 200 cartas eran 400 toques, porque cada ficha
//      había que cerrarla para abrir la de al lado;
//   2. la ficha solo se cerraba con Escape o pulsando fuera. En un
//      teléfono no hay Escape, y «pulsa fuera» no se le ocurre a nadie
//      que no lo sepa ya.
//
// Lo que se prueba contra la FORMA del fallo y no contra el caso:
//   · el orden de las flechas sale del DOM, así que un FILTRO puesto lo
//     cambia — si saliera de una lista interna, «la siguiente» sería una
//     carta que no está en la pantalla;
//   · las flechas del TECLADO no se le roban a un campo (dentro de un
//     desplegable, ← y → cambian el valor de la carta);
//   · lo que estabas escribiendo se GUARDA al cambiar de carta, en la
//     suya. El guardado va con retardo: sin cerrarlo, el temporizador
//     saltaría con otra ficha puesta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

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
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

// Cinco cartas en el set, tres tuyas: así una expansión tiene cartas que
// NO tienes, que es justo por donde también hay que poder pasar.
const semilla = () => {
  window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 108,
    card_count_total: 110, release_date: '2015-05-06', logo_path: 'x/logo', tcg_online_code: 'ROS' }]
  window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5].map((n) => ({
    id: `sv1-10${n}`, set_id: 'sv1', local_id: `10${n}`, name: `Carta ${n}`, image_path: `x/${n}`,
    market: 'WEST', rarity: n === 1 ? 'Common' : 'Ultra Rare', category: 'Pokemon',
    illustrator: 'Ryo Ueda', types: ['Colorless'], dex_ids: [384], variants: { normal: true } }))
  window.__FAKE_COLECCION__ = [1, 2, 3].map((n) => ({ id: `l${n}`, card_id: `sv1-10${n}`, cantidad: 1,
    idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
}

const abrir = async ({ ancho = 1280, alto = 1000 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(semilla)
  // `?ver=cartas`: la pestaña por defecto es el Panel desde la 440 y esto
  // mira la rejilla de CARTAS. Sin el parámetro los elementos existen en
  // el DOM pero escondidos, y Playwright se cae con «element is not
  // visible» — encontrar un elemento no es verlo.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const sitio = (p) => p.locator('#mcEdSitio').textContent()
const titulo = (p) => p.locator('#mcEditorTitulo').textContent()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las flechas recorren TU colección ──')
{
  const { page, errores } = await abrir()
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  check('la ficha se abre', (await page.locator('#mcEditor[open]').count()) === 1)
  check('  …y dice dónde estás', (await sitio(page)) === '1 de 3', await sitio(page))
  check('en la primera, «anterior» está apagada', await page.locator('#mcEdAnterior').isDisabled())
  check('  …y «siguiente» no', !(await page.locator('#mcEdSiguiente').isDisabled()))
  const primera = await titulo(page)
  await page.locator('#mcEdSiguiente').click()
  await page.waitForTimeout(600)
  check('la flecha cambia de carta', (await titulo(page)) !== primera, await titulo(page))
  check('  …y el sitio con ella', (await sitio(page)) === '2 de 3', await sitio(page))
  check('  …sin cerrar la ficha', (await page.locator('#mcEditor[open]').count()) === 1)
  await page.locator('#mcEdSiguiente').click()
  await page.waitForTimeout(600)
  check('en la última, «siguiente» se apaga', await page.locator('#mcEdSiguiente').isDisabled())
  check('  …y no se pasa de la lista', (await sitio(page)) === '3 de 3', await sitio(page))
  // Y el TOPE, de verdad. Un `click({ force: true })` sobre un botón
  // desactivado no dispara nada, así que la guarda de «no te salgas de la
  // lista» no se pisaría nunca: hay que encender el botón a mano para
  // llegar a ella. (El rigor de la 422 lo cantó: quitar la guarda no se
  // notaba.)
  await page.locator('#mcEdSiguiente').evaluate((b) => {
    b.disabled = false
    b.click()
  })
  await page.waitForTimeout(600)
  check('  …y por el final no se sale de la lista', (await sitio(page)) === '3 de 3', await sitio(page))
  check('    …ni se queda con una ficha vacía', (await titulo(page)) === 'Carta 3', await titulo(page))
  await page.locator('#mcEdAnterior').click()
  await page.waitForTimeout(600)
  check('y vuelve atrás', (await sitio(page)) === '2 de 3', await sitio(page))
  // Un `showModal()` sobre un diálogo YA abierto lanza InvalidStateError:
  // es el fallo natural de repintar la misma ficha una y otra vez.
  check('sin errores tras cuatro flechas', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El orden es el de LA PANTALLA, no el de una lista interna ──')
{
  const { page } = await abrir()
  // Con un filtro puesto la rejilla enseña menos cartas. Si las flechas
  // salieran de los datos y no del DOM, «la siguiente» sería una carta
  // que no está a la vista y el «de N» mentiría.
  // El orden es una bandeja desde la 449; aquí solo hacía falta «tocar el
  // orden», así que vale cualquiera.
  await page.locator('#mcAbrirOrden').click().catch(() => {})
  await page.waitForTimeout(300)
  await page.locator('[data-orden="nombre"]').click().catch(() => {})
  await page.fill('#mcBuscar', 'Carta 2')
  await page.waitForTimeout(900)
  const aLaVista = await page.locator('#mcCartas .mc-carta').count()
  check('el buscador deja menos cartas', aLaVista === 1, `${aLaVista} a la vista`)
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  // Con UNA sola carta detrás no se pinta ningún paso: dos flechas
  // apagadas y un «1 de 1» son tres cosas ocupando sitio para decir que no
  // hay nada que hacer. Y es un caso que pasa de verdad, no uno inventado:
  // basta con que el buscador deje una.
  check('  …y con una sola carta no se pintan pasos', await page.locator('#mcEdPasos').isHidden())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2 bis. En cuanto hay dos, vuelven ──')
{
  const { page } = await abrir()
  await page.fill('#mcBuscar', 'Carta')
  await page.waitForTimeout(900)
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  check('con tres cartas sí se pintan', await page.locator('#mcEdPasos').isVisible())
  check('  …y lo dicen', (await sitio(page)) === '1 de 3', await sitio(page))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El teclado, sin robarle las flechas a un campo ──')
{
  const { page, errores } = await abrir()
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(600)
  check('→ pasa a la siguiente', (await sitio(page)) === '2 de 3', await sitio(page))
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(600)
  check('← vuelve', (await sitio(page)) === '1 de 3', await sitio(page))
  // Y la trampa: con el foco en un desplegable, ← y → son SUYAS. Si se
  // las quitara, creyendo pasar de carta estarías cambiándole el idioma
  // a la que tienes delante.
  await desplegarCopia(page)
  await page.locator('#mcEdEstado').focus()
  const antes = await page.locator('#mcEdEstado').inputValue()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(500)
  check('con el foco en un desplegable NO cambia de carta', (await sitio(page)) === '1 de 3', await sitio(page))
  check('  …y el desplegable sí hace lo suyo',
    (await page.locator('#mcEdEstado').inputValue()) !== antes,
    `${antes} → ${await page.locator('#mcEdEstado').inputValue()}`)
  await desplegarCopia(page)
  await page.locator('#mcEdCantidad').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  check('  …ni con el foco en un número', (await sitio(page)) === '1 de 3', await sitio(page))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo escrito se guarda en SU carta al cambiar ──')
{
  const { page, errores } = await abrir()
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  const cualEs = await page.evaluate(() => document.getElementById('mcEditor').dataset.linea)
  await desplegarCopia(page)
  await page.click('#mcEdNotaAbrir')
  await desplegarCopia(page)
  await page.fill('#mcEdNotas', 'la del sobre de Madrid')
  // Sin esperar al retardo: cambiar de carta tiene que llevárselo.
  await page.locator('#mcEdSiguiente').click()
  await page.waitForTimeout(1200)
  const fila = (id) => page.evaluate((i) => window.__TABLAS__.user_collection.find((x) => x.id === i), id)
  check('la nota se guardó en la carta en la que se escribió',
    (await fila(cualEs)).notas === 'la del sobre de Madrid', JSON.stringify((await fila(cualEs)).notas))
  const otra = await page.evaluate(() => document.getElementById('mcEditor').dataset.linea)
  check('  …y no en la de al lado', (await fila(otra)).notas === null, JSON.stringify((await fila(otra)).notas))
  check('  …y la ficha nueva no la enseña', (await page.locator('#mcEdNotas').inputValue()) === '')
  // Y al revés: pasar de carta SIN tocar nada no guarda nada. El
  // temporizador se pone a null al saltar; si se quedara con su id
  // gastado, cada flecha dispararía un guardado de una carta que nadie ha
  // tocado —y lo diría en pantalla—. En un set de 200 son 200 escrituras
  // que no pide nadie.
  const avisoVisible = () => page.locator('#mcEdEstadoGuardado').evaluate((n) => n.classList.contains('visible'))
  // Y ahora dejando que el guardado salte SOLO, que es lo normal: se
  // escribe y se espera los 600 ms. Hace falta que salte él y no que se lo
  // lleve una flecha, porque lo que se prueba es lo que queda DESPUÉS: el
  // temporizador se pone a null al saltar, y si se quedara con su id
  // gastado, la siguiente flecha dispararía un guardado de una carta que
  // nadie ha tocado. En un set de 200 son 200 escrituras que no pide nadie
  // —y cada una lo dice en pantalla—.
  // Desde la 563 el gradeo es casa + nota en dos desplegables.
  await desplegarCopia(page)
  await page.selectOption('#mcEdGradeoCasa', 'PSA')
  await desplegarCopia(page)
  await page.selectOption('#mcEdGradeoNota', '9')
  await page.waitForTimeout(1400)
  check('el guardado salta solo a los 600 ms', await avisoVisible())
  await page.waitForTimeout(2200) // y el aviso se apaga solo
  check('  …y su aviso se apaga', !(await avisoVisible()))
  await page.locator('#mcEdSiguiente').click()
  await page.waitForTimeout(1200)
  check('pasar de carta sin tocar nada no guarda nada', !(await avisoVisible()))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. En una expansión: también por las que NO tienes ──')
{
  const { page, errores } = await abrir()
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(900)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  const bolsillos = await page.locator('#mcAlbum .mc-bolsillo-enlace').count()
  check('la expansión enseña las cinco cartas', bolsillos === 5, String(bolsillos))
  // La cuarta no es tuya: la ficha sale igual, con el botón de añadirla.
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(3).click()
  await page.waitForTimeout(800)
  check('se abre la ficha de una que no tienes', (await page.locator('#mcEditor[open]').count()) === 1 && !(await page.locator('#mcEdCopiaBloque').isVisible()) && (await page.locator('#mcEdMas').isVisible()))
  check('  …con su sitio en el SET entero', (await sitio(page)) === '4 de 5', await sitio(page))
  await page.locator('#mcEdSiguiente').click()
  await page.waitForTimeout(700)
  check('y la flecha pasa a la siguiente del set', (await sitio(page)) === '5 de 5', await sitio(page))
  await page.locator('#mcEdAnterior').click()
  await page.locator('#mcEdAnterior').click()
  await page.waitForTimeout(800)
  check('  …y hacia atrás llega a una que SÍ tienes',
    await page.locator('#mcEdCopiaBloque').isVisible(), await sitio(page))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Sin lista detrás, no se pintan pasos ──')
{
  const { page } = await abrir()
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(900)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(3).click()
  await page.waitForTimeout(800)
  check('con lista, los pasos se ven', await page.locator('#mcEdPasos').isVisible())
  // Y la regla del `[hidden]`: una clase con `display` le gana al
  // `display: none` del navegador, así que esconder tiene que estar
  // escrito (tanda 412).
  const css = leer('css/mi-coleccion.css')
  check('la hoja apaga `.mc-ficha-pasos[hidden]`', /\.mc-ficha-pasos\[hidden\]\s*\{[^}]*display:\s*none/.test(css))
  const r = await page.evaluate(() => {
    const p = document.getElementById('mcEdPasos')
    p.hidden = true
    return getComputedStyle(p).display
  })
  check('  …y escondidos de verdad no ocupan', r === 'none', r)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Y un cerrar a la vista ──')
{
  const { page, errores } = await abrir()
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  const cerrar = page.locator('#mcEdCerrar')
  check('hay un botón de cerrar', await cerrar.isVisible())
  check('  …con nombre para quien no lo ve', Boolean(await cerrar.getAttribute('aria-label')))
  await cerrar.click()
  await page.waitForTimeout(400)
  check('  …y cierra', (await page.locator('#mcEditor[open]').count()) === 0)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. En el móvil ──')
{
  const { page, errores } = await abrir({ ancho: 360, alto: 740 })
  await page.locator('#mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('el mando no desborda', sobra <= 1, `${sobra}px`)
  for (const id of ['mcEdAnterior', 'mcEdSiguiente', 'mcEdCerrar']) {
    const c = await page.locator(`#${id}`).boundingBox()
    check(`  …y ${id} se puede tocar (44 px)`, c.width >= 44 && c.height >= 44, `${c.width}×${c.height}`)
  }
  // El mando va pegado arriba: si se fuera con el desplazamiento, para
  // pasar de carta habría que subir primero.
  const pegado = await page.locator('.mc-ficha-mando').evaluate((n) => getComputedStyle(n).position)
  check('el mando se queda arriba al bajar', pegado === 'sticky', pegado)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
