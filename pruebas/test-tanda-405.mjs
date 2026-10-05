// Tanda 405 — la ficha vestida como Dex, y las expansiones ordenadas.
//
// PINGU, con capturas de Dex al lado: «la ficha de Dex es mucho más
// bonita», «el trozo de las notas no te abre el formulario hasta que no
// le das a añadir nota», «algunos logos se salen, todos deberían ser del
// mismo tamaño, y podríamos hacer como Dex que pone una imagen de fondo
// emborronada y el logo en el medio más pequeñito».
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
const BASE = 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

// `?ver=cartas` desde la tanda 436: la pestaña que se abre sola pasó a ser
// el Panel, así que una ruta sin parámetros ya no entra en las cartas.
const abrir = async (ruta = '/mi-coleccion.html?ver=cartas') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 108,
        card_count_total: 110, release_date: '2015-05-06', logo_path: 'x/logo', tcg_online_code: 'ROS' },
    ]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-104', set_id: 'sv1', local_id: '104', name: 'Rayquaza EX',
      image_path: 'x/1', market: 'WEST', rarity: 'Ultra Rare', category: 'Pokemon',
      illustrator: 'Ryo Ueda', types: ['Colorless'], dex_ids: [384], variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-104', cantidad: 1,
      idioma: 'es', estado: 'NM', variante: 'normal', notas: null }]
  })
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('\n── 1. El rótulo va FUERA de la caja ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  // Con el rótulo DENTRO de una caja con borde, cada bloque parece un
  // campo de formulario; fuera, el rótulo titula y la caja es contenido.
  const r = await page.locator('.mc-ficha-bloque').first().evaluate((b) => {
    const h = b.querySelector('h3')
    const caja = b.querySelector('.mc-ficha-caja')
    return {
      hayCaja: Boolean(caja),
      rotuloFuera: Boolean(h && caja && !caja.contains(h)),
      bloqueSinBorde: getComputedStyle(b).borderTopWidth === '0px',
    }
  })
  check('cada bloque tiene su caja', r.hayCaja)
  check('  …y el rótulo está fuera de ella', r.rotuloFuera)
  check('  …y el bloque ya no lleva borde', r.bloqueSinBorde)
  await page.close()
}

console.log('\n── 2. La nota, plegada ──')
{
  const { page } = await abrir()
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  const campoVisible = () => page.locator('#mcEdNotaCampo').evaluate((e) => !e.classList.contains('hidden'))
  // Un campo de texto vacío ocupando cinco renglones en una ficha que
  // casi nunca lleva nota es el bulto más grande de la pantalla.
  check('el campo no está de entrada', (await campoVisible()) === false)
  check('  …y sí el botón de ponerla', (await page.locator('#mcEdNotaAbrir').count()) === 1)
  await desplegarCopia(page)
  await page.locator('#mcEdNotaAbrir').click()
  await page.waitForTimeout(300)
  check('al pulsar, sale el campo', (await campoVisible()) === true)

  // Con nota puesta se LEE, no se edita: el campo solo cuando lo pides.
  await desplegarCopia(page)
  await page.fill('#mcEdNotas', 'La compré en Barcelona')
  await desplegarCopia(page)
  await page.locator('#mcEdNotaCerrar').click()
  await page.waitForTimeout(400)
  check('al cerrar, la nota se lee', (await campoVisible()) === false)
  check('  …y se ve lo escrito',
    /Barcelona/.test((await page.locator('#mcEdNotaPuesta').textContent()) || ''),
    await page.locator('#mcEdNotaPuesta').textContent())
  // Y tocarla la vuelve a abrir: si no, habría que borrarla para
  // corregir una letra.
  await desplegarCopia(page)
  await page.locator('#mcEdNotaPuesta').click()
  await page.waitForTimeout(300)
  check('  …y tocarla la abre para cambiarla', (await campoVisible()) === true)
  await page.close()
}

console.log('\n── 3. Las expansiones, todas del mismo tamaño ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album')
  await page.waitForTimeout(800)
  const t = page.locator('.mc-set-tarjeta').first()
  // La cabecera se llama `.mc-set-titulo` desde la 458, que rehizo la
  // tarjeta con el reparto de Dex: el logo pequeño a un lado y el nombre
  // como TEXTO al otro.
  check('la tarjeta tiene su cabecera', (await t.locator('.mc-set-titulo').count()) === 1)
  // El fondo emborronado: el propio logo, ampliado. No hace falta pedir
  // el arte de una carta —serían doscientas peticiones más— y el
  // navegador ya tiene la imagen porque la enseña encima.
  const arte = await t.locator('.mc-set-arte').evaluate((e) => {
    const c = getComputedStyle(e)
    return { filtro: c.filter, imagen: c.backgroundImage.slice(0, 40) }
  }).catch(() => null)
  check('hay fondo emborronado', Boolean(arte) && /blur/.test(arte.filtro), JSON.stringify(arte))
  check('  …y sale del propio logo', Boolean(arte) && /url/.test(arte.imagen), arte?.imagen)

  // Lo que se arregla: un `max-height` no contiene nada a lo ANCHO, y
  // por eso los logos anchos se salían de la tarjeta.
  const cabe = await t.evaluate((b) => {
    const img = b.querySelector('.mc-set-logo img')
    if (!img) return null
    const a = img.getBoundingClientRect()
    const c = b.getBoundingClientRect()
    return a.left >= c.left - 1 && a.right <= c.right + 1
  })
  check('el logo no se sale de la tarjeta', cabe !== false, String(cabe))
  // Y el código del set en su esquina, que es lo que lo identifica.
  check('el código del set está', (await t.locator('.mc-set-codigo').count()) === 1)
  check('  …y es el suyo', (await t.locator('.mc-set-codigo').textContent()) === 'ROS',
    await t.locator('.mc-set-codigo').textContent())
  // El nombre se lee LLEGUE O NO EL LOGO (tanda 458). Antes iba en
  // `sr-only` porque un logo occidental lleva su nombre escrito; pero si el
  // logo no llegaba —aquí nunca llega, la CDN está cortada, y el
  // 2026-09-20 se cayó de verdad— la tarjeta se quedaba sin nada que leer
  // y sin dar error. Y con los catálogos japoneses el logo que sí llega
  // está en kanji, que para quien mira es lo mismo que no llegar.
  check('si el logo no llega, el nombre se lee',
    await t.locator('.mc-set-nombre').isVisible())
  check('  …y dice cuál es', (await t.locator('.mc-set-nombre').textContent()) === 'Roaring Skies',
    await t.locator('.mc-set-nombre').textContent())
  // El código viene de `tcg_online_code`, que había que PEDIR: la
  // consulta de sets no lo traía y la chapa no habría salido nunca.
  check('  …y la consulta lo pide', /card_count_total,tcg_online_code/.test(leer('js/mi-coleccion.js')))
  await page.close()
}

console.log('\n── 4. El menú, a la izquierda en el ordenador ──')
{
  const { page } = await abrir()
  // Es lo que pidió PINGU («el menú de Dex es lateral, que deja meter más
  // cosas sin que las pestañas se vayan mucho») y lo que arregla el
  // problema: una columna crece hacia abajo y no se pelea con el ancho.
  // (Las cinco pestañas y las mudanzas, en test-tanda-408.)
  const sitio = await page.evaluate(() => {
    const m = document.getElementById('mcMenu').getBoundingClientRect()
    const p = document.getElementById('mcPanelCartas').getBoundingClientRect()
    return { menuDerecha: m.right, panelIzquierda: p.left, menuAncho: m.width }
  })
  check('el menú está a la izquierda del panel', sitio.menuDerecha <= sitio.panelIzquierda + 1,
    JSON.stringify(sitio))
  check('  …y no se come la pantalla', sitio.menuAncho < 280, sitio.menuAncho)
  const todas = await page.locator('#mcMenu [data-pestania]').count()
  const visibles = await page.locator('#mcMenu [data-pestania]:visible').count()
  check('se ven todas', visibles === todas && todas >= 5, `${visibles}/${todas}`)
  // Los iconos salen de js/icons.js y los pone el JavaScript: copiarlos a
  // mano en el HTML deja dos versiones del mismo dibujo.
  check('cada pestaña lleva su icono',
    (await page.locator('#mcMenu [data-pestania] > svg').count()) === todas,
    await page.locator('#mcMenu [data-pestania] > svg').count())
  await page.close()
}

console.log('\n── 5. La barra de buscar, más pequeña y con chapas ──')
{
  const { page } = await abrir()
  const m = await page.evaluate(() => {
    const i = document.getElementById('mcBuscar').getBoundingClientRect()
    const f = document.getElementById('mcFiltros').getBoundingClientRect()
    return { campo: i.width, barra: f.width, radio: getComputedStyle(document.getElementById('mcBuscar')).borderRadius }
  })
  // Una búsqueda no es más larga por tener la pantalla más ancha: el
  // campo medía TODO el ancho y el hueco que sobraba era lo que hacía
  // que la barra pareciera un formulario.
  check('el campo no ocupa toda la barra', m.campo < m.barra * 0.75, JSON.stringify(m))
  check('  …y es redondo', /999|50%/.test(m.radio) || parseFloat(m.radio) >= 20, m.radio)
  // Y la lupa la lleva TODO buscador de la pantalla, no solo este: las
  // tres barras (cartas, expansiones y Pokédex) son la misma pieza desde
  // la 405, que era medio motivo de que no se parecieran. Eran cuatro
  // hasta la 408, cuando el buscador de «Añadir cartas» se fundió con el
  // de «Cartas».
  const buscadores = await page.locator('.mc-buscador').count()
  check('  …y lleva su lupa dentro',
    buscadores >= 3 && (await page.locator('.mc-buscador > .mc-buscador-lupa > svg').count()) === buscadores,
    `${buscadores} buscadores`)
  check('el botón de filtros es una chapa',
    await page.locator('#mcAbrirFiltros.mc-chip-mando').count() === 1)

  // El ✕ solo cuando hay algo que quitar, y quita TAMBIÉN el texto: si no
  // lo quitara, la lista seguiría recortada y parecería que no hace nada.
  check('el ✕ no está si no hay nada puesto',
    (await page.locator('#mcFiltrosQuitar').isVisible()) === false)
  await page.fill('#mcBuscar', 'zzzznohay')
  await page.waitForTimeout(400)
  check('  …y sale al escribir', await page.locator('#mcFiltrosQuitar').isVisible())
  await page.locator('#mcFiltrosQuitar').click()
  await page.waitForTimeout(400)
  check('  …y al pulsarlo se limpia el texto',
    (await page.locator('#mcBuscar').inputValue()) === '')
  check('  …y vuelven las cartas', (await page.locator('.mc-carta').count()) >= 1)
  check('  …y el ✕ se esconde otra vez',
    (await page.locator('#mcFiltrosQuitar').isVisible()) === false)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
