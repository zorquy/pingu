// Tanda 412 — los mandos del archivador, y la lupa que se tapaba.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

// ── LOS MANDOS DE LA CABECERA VIVEN DETRÁS DEL ⋮ (tanda 475) ──
// Encontrar un elemento no es poder pulsarlo, así que hay que abrir el menú
// primero. Y se cierra solo al elegir, así que cada pulsación abre otra vez.
const porElMenu = async (page, sel) => {
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(250)
  await page.click(sel)
  await page.waitForTimeout(350)
}
const browser = await chromium.launch()
const abrir = async (ruta) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP',
      market: 'WEST', card_count_official: 20, card_count_total: 25, release_date: '2023-03-31', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({ id: 'sv1-' + (i + 1), set_id: 'sv1',
      local_id: String(i + 1), name: 'Pikachu', image_path: 'x/' + i, market: 'WEST', rarity: 'Common',
      category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 6).map((c, i) => ({ id: 'l' + i,
      card_id: c.id, cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

console.log('\n── 1. Ninguna lupa se come su texto ──')
{
  // LA FORMA DEL FALLO, no el fallo: al unificar los buscadores (tanda
  // 406) el relleno de la izquierda lo pone `.mc-buscador input`, pero la
  // regla propia de la Pokédex va DESPUÉS en la hoja y se lo devolvía a
  // 12 px — el texto de ejemplo se pintaba ENCIMA de la lupa y no daba
  // error. Se miran TODOS los buscadores de la pantalla, no el que falló.
  const { page, errores } = await abrir('/mi-coleccion.html?ver=pokedex')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const malos = await page.evaluate(() =>
    [...document.querySelectorAll('.mc-buscador')]
      .filter((c) => c.offsetParent)
      .map((c) => {
        const i = c.querySelector('input')
        const l = c.querySelector('.mc-buscador-lupa')
        if (!i || !l) return null
        const hueco = parseFloat(getComputedStyle(i).paddingLeft)
        const lupa = l.getBoundingClientRect().right - i.getBoundingClientRect().left
        return hueco >= lupa ? null : `${i.id}: relleno ${hueco}, lupa hasta ${Math.round(lupa)}`
      })
      .filter(Boolean)
  )
  check('el texto empieza DESPUÉS de la lupa', malos.length === 0, malos.join(' | '))
  await page.close()
}

console.log('\n── 2. El archivador, con los mandos en una fila ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album')
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(900)
  const y = await page.evaluate(() => {
    const t = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? null
    return { titulo: t('.mc-album-barra'), barras: t('#mcAlbumProgreso'), filtros: t('#mcAlbumFiltros'),
      cartas: t('#mcAlbum') }
  })
  // EL ORDEN SE DIO LA VUELTA EN LA 467, y es un cambio a propósito. Esta
  // tanda puso las barras primero «porque es lo que se viene a ver», y con
  // CINCO filas de controles encima tenía razón: lo que arreglaba era que
  // el progreso estuviera enterrado. Con los controles ya en una sola fila
  // (459) el reparto correcto es el de Dex, y PINGU lo dijo mirando los
  // dos: «me estás poniendo primero las estadísticas y luego los filtros
  // con el buscador y queda muy raro».
  //
  // Lo que esta tanda defiende sigue en pie y es lo que se comprueba: que
  // entre el título y la primera carta no haya cinco filas de controles.
  check('los mandos son UNA fila entre el título y los datos',
    y.filtros < y.barras && y.barras - y.filtros < 140, JSON.stringify(y))
  // Y los filtros antes que las cartas. (Era «antes que la paginación»;
  // desde la 417 una expansión no tiene páginas, es una rejilla.)
  check('  …y los filtros antes que las cartas', y.filtros < y.cartas, JSON.stringify(y))

  // «Al pulsar + se suma una copia en…» ocupaba una fila entera con su
  // frase para un ajuste que se toca una vez. Ahora cuelga de su chapa.
  check('el ajuste de añadir no ocupa sitio',
    (await page.locator('#mcTocarOpciones').isVisible()) === false)
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(300)
  check('  …y se abre al pedirlo', await page.locator('#mcTocarOpciones').isVisible())
  // Y colgando: si empujara la fila, al abrirlo se movería todo lo de
  // debajo y se perdería de vista lo que estabas mirando. Desde la tanda
  // 475 quien flota es EL MENÚ que lo lleva dentro, no el ajuste suelto:
  // el engranaje propio desapareció porque un desplegable dentro de otro
  // desplegable es un acertijo.
  const flota = await page.locator('#mcAlbumMenu .mc-menu').evaluate((e) => getComputedStyle(e).position)
  check('  …sin empujar lo de abajo', flota === 'absolute', flota)

  // La chapa de versión vive en la misma fila que los filtros, no en una
  // suya. Desde la tanda 473 es UNA y no dos: eran «Juntar variantes» y
  // «Separar variantes», y una de las dos estaba siempre de adorno.
  const mismaFila = await page.evaluate(() => {
    const f = document.getElementById('mcAlbumFiltros')
    return f.contains(document.getElementById('mcVistaVariantes'))
  })
  check('la chapa de versión está en la fila de filtros', mismaFila)
  await page.close()
}

console.log('\n── 3. La cabecera, más corta ──')
{
  // Las cuatro cifras en dos filas de cajas grandes se comían 200 px
  // antes de lo que venías a ver, en las CINCO pestañas. En un móvil eso
  // es un cuarto de pantalla repetido cinco veces.
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } })
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP',
      market: 'WEST', card_count_official: 20, card_count_total: 25, release_date: '2023-03-31', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 6 }, (_, i) => ({ id: 'sv1-' + (i + 1), set_id: 'sv1',
      local_id: String(i + 1), name: 'Pikachu', image_path: 'x/' + i, market: 'WEST', rarity: 'Common',
      category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: 'l' + i, card_id: c.id,
      cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  // Desde la tanda 436 la pestaña que se abre sola es el Panel, así que
  // una ruta sin parámetros ya no entra en las cartas.
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=cartas', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => {
    const c = document.getElementById('mcResumen')
    return { filas: new Set([...c.children].map((e) => Math.round(e.getBoundingClientRect().top))).size,
      desliza: getComputedStyle(c).overflowX,
      // Lo que de verdad importa: que no se salga. Un `overflow` concreto
      // es CÓMO se arregla; esto es QUÉ se arregla.
      sobra: c.scrollWidth > c.clientWidth + 4,
      buscador: Math.round(document.getElementById('mcFiltros').getBoundingClientRect().top),
      nota: document.getElementById('mcResumenNota').classList.contains('hidden') }
  })
  // UNA fila, y desde la tanda 440 SIN deslizarse: las cifras perdieron el
  // recuadro y pasaron a vivir dentro de la cabecera de perfil, así que
  // caben en 390 px. Lo que la 412 pedía era que no se comieran la
  // pantalla, y eso se sigue pidiendo igual —lo que ha cambiado es CÓMO se
  // consigue, y la tira era un rodeo—.
  check('las cifras van en UNA fila', r.filas === 1, JSON.stringify(r))
  check('  …y ya no hace falta deslizarlas', !r.sobra, JSON.stringify(r))
  check('  …y la nota del valor no está aquí', r.nota)
  check('  …así que el buscador entra en la primera pantalla', r.buscador < 400, `${r.buscador} px`)
  // Pero la nota SÍ está donde se explica el valor.
  await page.locator('#mcMenu [data-pestania="resumen"]').click()
  await page.waitForTimeout(600)
  check('la nota del valor sale en el Panel',
    (await page.locator('#mcResumenNota').evaluate((e) => e.classList.contains('hidden'))) === false)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
