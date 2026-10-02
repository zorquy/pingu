// Tanda 459 — la pantalla de una expansión, en el móvil.
//
// PINGU, con la captura de /mi-coleccion → Expansiones → Mega Evolution en
// un móvil: «en movil se ve fatal y ademas ahi hay otro enlace pocho».
//
// Eran dos cosas distintas:
//
// · El «← Todas las colecciones» era un `link-btn` azul subrayado en una
//   pantalla donde todo lo demás son botones. Es la tercera vez que lo
//   dice, así que aquí se prueba la FORMA y no el caso: en la pantalla de
//   una expansión no queda NINGÚN enlace de esos.
//
// · Y las tres tarjetas de datos no se deslizaban: iban en un `.mc-tira`,
//   que es flex, y un hijo de flex CEDE antes de desbordar (la lección de
//   la 320). En 390 px las tres se encogían a 97 px cada una — el anillo
//   del porcentaje encima del título, «de 40 cartas» partido en dos
//   renglones, 328 px de alto y una flecha de «ver lo siguiente» que no
//   llevaba a ninguna parte. La prueba tampoco mira ESE caso: barre la
//   sección entera buscando cajas que se deslizan con hijos que ceden,
//   que es la forma del fallo y la que se repite.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const browser = await chromium.launch()

const abrir = async ({ ancho = 390, alto = 844, tactil = true } = {}) => {
  const page = await browser.newPage({
    viewport: { width: ancho, height: alto },
    hasTouch: tactil,
    isMobile: tactil,
  })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // Una captura con los datos a medias no es la pantalla (la lección de la
  // 441): la carta de mentira va con su proporción de verdad.
  await page.route('**assets.tcgdex.net/**', (r) =>
    r.fulfill({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 40, card_count_total: 48, logo_path: 'x/l',
      release_date: '2026-09-26', tcg_online_code: 'MEE' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 48 }, (_, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: 'Bulbasaur ' + (i + 1), name_es: 'Bulbasaur ' + (i + 1), image_path: 'x/' + (i + 1),
      rarity: ['Common', 'Uncommon', 'Rare'][i % 3],
      // Dos categorías, para que «Tipos de carta» tenga dos renglones con
      // nombre largo: «Entrenador» es justo lo que no cabía.
      category: i % 7 === 0 ? 'Trainer' : 'Pokemon',
      types: ['Grass'], dex_ids: [1], variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 9).map((c, i) => ({
      id: 'l' + i, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z',
    }))
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=album', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  return { page, errores }
}

console.log('\n── 1. Ni un enlace pocho dentro de una expansión ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const pochos = await page.locator('#mcArchivadorZona .link-btn').evaluateAll((ns) =>
    ns.map((n) => n.id || n.textContent.trim().slice(0, 30)))
  check('no queda ningún `link-btn` en la pantalla de una expansión',
    pochos.length === 0, pochos.join(' | '))
  const volver = page.locator('#mcAlbumVolver')
  check('  …y el de volver es una chapa',
    (await volver.evaluate((n) => n.classList.contains('mc-chip-mando'))) === true)
  // Un botón se lee como un botón: ni subrayado ni del azul de los enlaces.
  const pinta = await volver.evaluate((n) => {
    const cs = getComputedStyle(n)
    return { deco: cs.textDecorationLine, borde: cs.borderTopWidth, alto: Math.round(n.getBoundingClientRect().height) }
  })
  check('  …sin subrayado y con su contorno', pinta.deco === 'none' && pinta.borde !== '0px', JSON.stringify(pinta))
  // Lo que se pulsa mide 44 px en una pantalla táctil (regla de la casa).
  check('  …y mide 44 px de alto', pinta.alto >= 44, pinta.alto)
  await page.close()
}

console.log('\n── 2. Una caja que se desliza no encoge a sus hijos ──')
{
  // LA FORMA DEL FALLO, no el caso: `.mc-tira` llevaba tres tarjetas que
  // nunca se deslizaron porque cedían antes de desbordar. Cualquier caja
  // futura con `overflow-x: auto` y un hijo que cede tiene el mismo fallo,
  // y no da ningún error: se ve mal y ya está.
  const { page } = await abrir()
  const malas = await page.evaluate(() => {
    const fuera = []
    for (const caja of document.querySelectorAll('#mcPanelAlbum *')) {
      const cs = getComputedStyle(caja)
      if (cs.display !== 'flex' || !['auto', 'scroll'].includes(cs.overflowX)) continue
      if (cs.flexWrap !== 'nowrap') continue
      for (const hijo of caja.children) {
        if (getComputedStyle(hijo).flexShrink !== '0') {
          fuera.push((caja.id || caja.className) + ' → ' + (hijo.id || hijo.className))
          break
        }
      }
    }
    return fuera
  })
  check('ninguna tira deja ceder a sus hijos', malas.length === 0, malas.join(' | '))
  await page.close()
}

console.log('\n── 3. Los datos de la colección, legibles en 390 px ──')
{
  const { page } = await abrir()
  const datos = await page.evaluate(() => {
    const caja = document.querySelector('#mcAlbumProgreso')
    const tarjetas = [...caja.querySelectorAll('.mc-diapo')]
    // Un rótulo recortado se lee como un fallo: `scrollWidth` mayor que el
    // ancho visible es justo eso, un texto que no cabe en su caja.
    const recortados = [...caja.querySelectorAll('.mc-diapo-titulo, .mc-reparto-nombre, .mc-barra-nombre')]
      .filter((n) => n.scrollWidth > n.clientWidth + 1)
      .map((n) => n.textContent.trim())
    // Y el anillo no puede caer encima del título. Se mide el TEXTO con un
    // `Range` y no la caja del `<h3>`: la caja llega hasta el borde de la
    // tarjeta —el hueco del anillo es su `padding`— así que compararlas
    // daría «se pisan» siempre, aunque la letra se quede a 80 px.
    const anillo = caja.querySelector('.mc-anillo')?.getBoundingClientRect()
    const h = caja.querySelector('.mc-diapo-titulo')
    const r = document.createRange()
    r.selectNodeContents(h)
    const titulo = r.getBoundingClientRect()
    const pisa = anillo && titulo
      && anillo.left < titulo.right && anillo.right > titulo.left
      && anillo.top < titulo.bottom && anillo.bottom > titulo.top
    return {
      cuantas: tarjetas.length,
      anchos: tarjetas.map((t) => Math.round(t.getBoundingClientRect().width)),
      alto: Math.round(caja.getBoundingClientRect().height),
      recortados,
      pisa: Boolean(pisa),
    }
  })
  check('siguen siendo tres tarjetas', datos.cuantas === 3, JSON.stringify(datos.anchos))
  // La primera lleva el anillo y las barras: a media fila no cabe ninguna
  // de las dos, así que cruza la fila entera y las otras dos la comparten.
  check('  …la del conjunto cruza la fila entera', datos.anchos[0] >= 300, datos.anchos[0])
  check('  …y las otras dos van a la par', datos.anchos[1] === datos.anchos[2] && datos.anchos[1] >= 140, JSON.stringify(datos.anchos))
  check('ningún rótulo sale recortado', datos.recortados.length === 0, datos.recortados.join(' | '))
  check('el anillo no cae encima del título', datos.pisa === false)
  check('y el bloque entero no pasa de 360 px de alto', datos.alto <= 360, datos.alto)
  await page.close()
}

console.log('\n── 4. Los mandos, en UNA fila que se desliza ──')
{
  const { page } = await abrir()
  const fila = await page.locator('#mcAlbumFiltros').evaluate((n) => {
    const cs = getComputedStyle(n)
    return { alto: Math.round(n.getBoundingClientRect().height), desliza: n.scrollWidth > n.clientWidth + 4, overflow: cs.overflowX, mandos: n.classList.contains('mc-mandos') }
  })
  check('la fila de filtros es una tira de mandos', fila.mandos === true)
  check('  …de una sola altura de control', fila.alto <= 56, fila.alto)
  check('  …y se desliza de verdad', fila.desliza === true)
  // Lo que se midió: antes de la 459 había 920 px entre el borde de arriba
  // y la primera carta, de los cuales 264 eran cuatro filas de controles.
  const hasta = await page.evaluate(() => {
    const c = document.querySelector('.mc-album-rejilla > *')
    return Math.round(c.getBoundingClientRect().top + scrollY)
  })
  check('la primera carta cae antes del píxel 800', hasta < 800, hasta)
  await page.close()
}

console.log('\n── 5. «Solo las que me faltan» FILTRA, no solo se enciende ──')
{
  // Una prueba que mira si un botón se pone `activo` no prueba lo que el
  // botón hace (la lección de la 313): aquí se cuentan las cartas.
  const { page } = await abrir()
  const cuantas = () => page.locator('.mc-album-rejilla > *').count()
  check('se abren las 48 cartas del set', (await cuantas()) === 48, await cuantas())
  await page.locator('#mcAlbumSoloFaltan').scrollIntoViewIfNeeded()
  await page.locator('#mcAlbumSoloFaltan').click()
  await page.waitForTimeout(600)
  check('  …y con la chapa puesta quedan las 39 que faltan', (await cuantas()) === 39, await cuantas())
  check('  …con la chapa marcada como pulsada',
    (await page.locator('#mcAlbumSoloFaltan').getAttribute('aria-pressed')) === 'true')
  await page.locator('#mcAlbumSoloFaltan').click()
  await page.waitForTimeout(600)
  check('  …y al apagarla vuelven las 48', (await cuantas()) === 48, await cuantas())
  await page.close()
}

console.log('\n── 6. El ajuste que se despliega NO va en la tira ──')
{
  // Es el motivo de que las acciones tengan su propia fila: una tira
  // recorta lo que se sale de ella, así que un panel colgado de una chapa
  // de dentro saldría cortado — y sin dar ningún error.
  const { page } = await abrir()
  await page.click('#mcTocarCaja > summary')
  await page.waitForTimeout(400)
  const panel = await page.locator('#mcTocarOpciones').evaluate((n) => {
    const r = n.getBoundingClientRect()
    return { visible: r.width > 0 && r.height > 0, izq: Math.round(r.left), der: Math.round(r.right), ventana: innerWidth }
  })
  check('el panel de «al añadir» se ve entero',
    panel.visible && panel.izq >= 0 && panel.der <= panel.ventana, JSON.stringify(panel))
  check('  …y su chapa está fuera de la tira de mandos',
    (await page.locator('#mcAlbumFiltros #mcTocarCaja').count()) === 0)
  await page.close()
}

console.log('\n── 7. Y en un escritorio, las tres en fila ──')
{
  const { page } = await abrir({ ancho: 1280, alto: 1000, tactil: false })
  const anchos = await page.locator('#mcAlbumProgreso .mc-diapo').evaluateAll((ns) =>
    ns.map((n) => Math.round(n.getBoundingClientRect().width)))
  check('las tres miden lo mismo', new Set(anchos).size === 1, JSON.stringify(anchos))
  check('  …y ninguna se queda en un palmo', anchos[0] >= 240, JSON.stringify(anchos))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
