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
  // EL DE VOLVER YA NO ES UNA CHAPA (tanda 474), y esto lo decía: la 459
  // lo hizo chapa para quitarle la pinta de enlace pocho, y eso sigue
  // estando bien — pero PINGU volvió con «estás ocupando mucho espacio
  // arriba» y una chapa de 44 px en una fila para ella sola es mucho sitio.
  // Ahora es una MIGA, y lo que hay que seguir vigilando es lo mismo de
  // siempre: que no vuelva a ser un enlace azul y subrayado. Lo prueba
  // `test-tanda-474.mjs`, que las mira todas.
  const volver = page.locator('#mcAlbumVolver')
  check('  …y el de volver es una miga',
    (await volver.evaluate((n) => n.classList.contains('mc-miga'))) === true)
  const pinta = await volver.evaluate((n) => {
    const cs = getComputedStyle(n)
    return { deco: cs.textDecorationLine, alto: Math.round(n.getBoundingClientRect().height) }
  })
  check('  …sin subrayado', pinta.deco === 'none', JSON.stringify(pinta))
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
// Desde la 919 son una barra y una línea («N de M · P %» y lo que vale lo
// tuyo), no tres tarjetas: lo que se sigue pidiendo es que no se recorte
// nada y que no ocupe media pantalla.
{
  const { page } = await abrir()
  const datos = await page.evaluate(() => {
    const caja = document.querySelector('#mcAlbumProgreso')
    const linea = caja.querySelector('.mc-avance-linea')
    return { recortada: linea ? linea.scrollWidth > linea.clientWidth + 1 : null, alto: Math.round(caja.getBoundingClientRect().height), texto: linea?.textContent.trim() }
  })
  check('la línea de la barra no sale recortada', datos.recortada === false, JSON.stringify(datos))
  check('y el bloque entero no pasa de 80 px de alto', datos.alto <= 80, JSON.stringify(datos))
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
  // Y QUE PUEDA DESLIZARSE, que es lo que esta prueba defendía. Entre
  // medias cambió dos veces: la 473 se llevó cuatro controles al panel de
  // «Filtros» y dejó dos chapas, que en un móvil cabían; la 478 añadió la
  // tercera —la vista— y vuelven a pasarse unos píxeles. Que quepan o no
  // depende de cuántas haya, así que no es lo que hay que comprobar: lo
  // que no puede pasar nunca es que se APLASTEN para caber (la 320), y eso
  // lo miran la comprobación de arriba y la 473.
  // Desde la 919 la fila solo lleva «Filtros» (y el ✕), al lado del
  // buscador: ya no hay nada que deslizar.
  // Y desde la 927 (Dex), la vista, «Apilar» y «Filtros», en ese orden.
  check('  …con la vista, «Apilar» y «Filtros» al lado del buscador (927)', await page.evaluate(() => [...document.querySelectorAll('#mcAlbumFiltros > :not(.hidden)')].map((e) => e.id).join() === 'mcAlbumVista,mcVistaVariantes,mcAlbumAbrirFiltros'))
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
  // La chapa vive DENTRO del panel de «Filtros» desde la tanda 473, así
  // que hay que abrirlo: encontrar un elemento no es poder pulsarlo (la
  // lápida de la 447). Lo que esta prueba vigila sigue siendo lo mismo —
  // que la chapa FILTRE y no solo se encienda.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbumSoloFaltan').click()
  await page.waitForTimeout(600)
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(500)
  check('  …y con la chapa puesta quedan las 39 que faltan', (await cuantas()) === 39, await cuantas())
  check('  …con la chapa marcada como pulsada',
    (await page.locator('#mcAlbumSoloFaltan').getAttribute('aria-pressed')) === 'true')
  // Y para apagarla, otra vez por el panel: es donde vive.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbumSoloFaltan').click()
  await page.waitForTimeout(600)
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(500)
  check('  …y al apagarla vuelven las 48', (await cuantas()) === 48, await cuantas())
  await page.close()
}

console.log('\n── 6. Nada que se despliegue vive dentro de una tira ──')
{
  // Una tira recorta lo que se sale de ella, así que un panel colgado de
  // una chapa de dentro sale cortado — y sin dar ningún error. Es la forma
  // del fallo, no el caso: el «Al añadir» que lo estrenó se fue a los
  // ajustes en la 461, y la regla sigue valiendo para el que venga.
  const { page } = await abrir()
  const malos = await page.evaluate(() => {
    const fuera = []
    for (const d of document.querySelectorAll('details')) {
      // Solo los que FLOTAN. Un `details` que empuja lo de abajo dentro de
      // una caja que se desplaza está bien —así es el menú del móvil—; el
      // que se rompe es el que cuelga en `position: absolute`, porque ahí
      // el recorte del padre se lo come.
      const abierto = d.open
      d.open = true
      const panel = [...d.children].find((c) => c.tagName !== 'SUMMARY')
      const flota = panel && ['absolute', 'fixed'].includes(getComputedStyle(panel).position)
      d.open = abierto
      if (!flota) continue
      for (let p = d.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)) {
          fuera.push((d.id || d.className) + ' dentro de ' + (p.id || p.className))
          break
        }
      }
    }
    return fuera
  })
  check('ningún panel desplegable cuelga de una caja que recorta', malos.length === 0, malos.join(' | '))
  await page.close()
}

console.log('\n── 7. Y en un escritorio, la línea de debajo del título ──')
{
  // Con la lateral (1400 y ratón), que es cuando la columna lo dice en la línea.
  const { page } = await abrir({ ancho: 1440, alto: 1000, tactil: false })
  const r = await page.evaluate(() => ({ linea: (document.getElementById('mcAlbumLinea')?.textContent || '').trim(), barra: getComputedStyle(document.getElementById('mcAlbumProgreso')).display }))
  check('lo dice la línea («N de M · P %») y la barra no se repite (919)', /\d+ de \d+ · \d+ %/.test(r.linea) && r.barra === 'none', JSON.stringify(r))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
