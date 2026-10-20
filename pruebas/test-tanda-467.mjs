// Tanda 467 — el orden de una expansión, y los datos deslizables.
//
// PINGU, con Dex al lado: «debería ser como en Dex, que tienes los filtros
// arriba, porque tiene más sentido. Y después las estadísticas en
// deslizables, ¿ves que se pueden deslizar? Y luego ya irían las cartas
// abajo. Ahora mismo me estás poniendo primero las estadísticas y luego
// los filtros con el buscador y queda muy raro».
//
// Dos cosas, y las dos corrigen tandas mías:
//
//  · EL ORDEN. La 412 puso el progreso delante «porque es lo que se viene
//    a ver», y con CINCO filas de controles encima tenía razón. Con los
//    controles ya en una fila (459), lo primero que se hace al abrir una
//    expansión de 200 cartas es BUSCAR una — y para eso había que pasar
//    por tres tarjetas de datos.
//
//  · LA TIRA. La 459 las sacó de una tira «porque una cifra cortada por el
//    borde se lee como un fallo». Pero el síntoma que medí entonces era
//    otro: las tres se encogían a 97 px CADA UNA. No es que la tira
//    estuviera mal, es que NO SE DESLIZABA — un hijo de flex cede antes de
//    desbordar y le faltaba el `flex-shrink: 0`. Con él, lo que asoma es
//    la tarjeta DE AL LADO y no la mitad de la que estás leyendo.
//
// Por eso la prueba no mira «hay una tira»: mira que SE DESLICE y que
// ninguna tarjeta se aplaste, que es la diferencia entre las dos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const browser = await chromium.launch()
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

const abrir = async (ancho = 414) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 900, isMobile: ancho < 900 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.route('**assets.tcgdex.net/**', (r) => r.fulfill({ path: SC + '/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 24, card_count_total: 32, logo_path: 'x/l', release_date: '2026-09-26', tcg_online_code: 'MEE' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 24 }, (_, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: 'Bulbasaur ' + (i + 1), image_path: 'x/' + (i + 1), rarity: ['Common', 'Uncommon', 'Rare'][i % 3],
      category: i % 7 === 0 ? 'Trainer' : 'Pokemon', types: ['Grass'], variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', valor_manual: 23, created_at: new Date().toISOString() }]
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=album', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1600)
  return { page, errores }
}
const alturas = (page) => page.evaluate(() => {
  const t = (s) => { const n = document.querySelector(s); return n ? Math.round(n.getBoundingClientRect().top + scrollY) : null }
  // DENTRO del archivador abierto: `#mcPanelAlbum .mc-buscador` también
  // casa con el de la estantería, que está escondido y mide 0 — y «0 es
  // menor que todo» convertía la comprobación del orden en un sí seguro.
  return { titulo: t('.mc-album-barra'), buscador: t('#mcArchivadorZona .mc-buscador'), mandos: t('#mcAlbumFiltros'),
    datos: t('#mcAlbumProgreso'), cartas: t('#mcAlbum') }
})

console.log('\n── 1. El orden: buscar, filtrar, mirar, y luego las cartas ──')
for (const ancho of [414, 1280]) {
  const { page, errores } = await abrir(ancho)
  if (ancho === 414) check('sin errores', errores.length === 0, errores.join(' | '))
  const y = await alturas(page)
  check(`en ${ancho} px el buscador va antes que los mandos`, y.buscador < y.mandos, JSON.stringify(y))
  check(`  …los mandos antes que los datos`, y.mandos < y.datos, JSON.stringify(y))
  check(`  …y los datos antes que las cartas`, y.datos < y.cartas, JSON.stringify(y))
  // Lo que motivó el cambio: llegar a BUSCAR sin pasar por tres tarjetas.
  check(`  …y al buscador se llega enseguida`, y.buscador - y.titulo < 80, JSON.stringify(y))
  await page.close()
}

console.log('\n── 2. La tira se fue en la 919: arriba, una barra ──')
// PINGU aprobó en la propuesta «PokeDoc más sencillo» cambiar el carrusel
// de tres tarjetas (lo que esta prueba defendía desde la 467: que se
// deslizara y que sus puntos dijeran la verdad) por una barra de progreso.
// Lo que queda que comprobar es que el carrusel no vuelve a medias.
{
  const { page } = await abrir(414)
  const m = await page.evaluate(() => ({
    tira: document.querySelectorAll('#mcAlbumProgreso .mc-diapos, .mc-punto').length,
    barra: Boolean(document.querySelector('#mcAlbumProgreso .mc-avance-barra')),
  }))
  check('sin tira ni puntos, con su barra', m.tira === 0 && m.barra, JSON.stringify(m))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
