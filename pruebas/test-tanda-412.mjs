// Tanda 412 — los mandos del archivador, y la lupa que se tapaba.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
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
  // Primero cuánto llevas, que es lo que se viene a ver, y después los
  // mandos. Antes las barras estaban por debajo de dos filas de controles.
  check('las barras van antes que los filtros', y.barras < y.filtros, JSON.stringify(y))
  // Y los filtros antes que las cartas. (Era «antes que la paginación»;
  // desde la 417 una expansión no tiene páginas, es una rejilla.)
  check('  …y los filtros antes que las cartas', y.filtros < y.cartas, JSON.stringify(y))

  // «Al pulsar + se suma una copia en…» ocupaba una fila entera con su
  // frase para un ajuste que se toca una vez. Ahora cuelga de su chapa.
  check('el ajuste de añadir no ocupa sitio',
    (await page.locator('#mcTocarOpciones').isVisible()) === false)
  await page.locator('#mcTocarCaja summary').click()
  await page.waitForTimeout(300)
  check('  …y se abre al pedirlo', await page.locator('#mcTocarOpciones').isVisible())
  // Y colgando: si empujara la fila, al abrirlo se movería todo lo de
  // debajo y se perdería de vista lo que estabas mirando.
  const flota = await page.locator('#mcTocarOpciones').evaluate((e) => getComputedStyle(e).position)
  check('  …sin empujar lo de abajo', flota === 'absolute', flota)

  // Las dos chapas de versión viven ahora en la misma fila que los
  // filtros, no en una suya.
  const mismaFila = await page.evaluate(() => {
    const f = document.getElementById('mcAlbumFiltros')
    return f.contains(document.getElementById('mcVistaStack'))
  })
  check('las chapas de versión están en la fila de filtros', mismaFila)
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
      buscador: Math.round(document.getElementById('mcFiltros').getBoundingClientRect().top),
      nota: document.getElementById('mcResumenNota').classList.contains('hidden') }
  })
  check('las cifras van en UNA fila que se desliza', r.filas === 1 && r.desliza === 'auto', JSON.stringify(r))
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
