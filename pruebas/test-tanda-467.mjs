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

console.log('\n── 2. La tira se desliza DE VERDAD ──')
{
  const { page } = await abrir(414)
  const m = await page.evaluate(() => {
    const t = document.querySelector('#mcAlbumProgreso .mc-diapos')
    return {
      desliza: t.scrollWidth > t.clientWidth + 4,
      anchos: [...t.children].map((c) => Math.round(c.getBoundingClientRect().width)),
      // Lo que lo hace posible, y lo que faltaba: ninguna tarjeta cede.
      ceden: [...t.children].filter((c) => getComputedStyle(c).flexShrink !== '0').length,
    }
  })
  check('se desliza', m.desliza, JSON.stringify(m))
  check('  …sin que ninguna tarjeta ceda', m.ceden === 0, JSON.stringify(m))
  check('  …todas del mismo ancho', new Set(m.anchos).size === 1, JSON.stringify(m.anchos))
  // 97 px era el síntoma del fallo de la 459: si vuelve, vuelve aquí.
  check('  …y ninguna aplastada', m.anchos.every((a) => a >= 260), JSON.stringify(m.anchos))
  await page.close()
}

console.log('\n── 3. Los puntos dicen cuántas hay y en cuál estás ──')
{
  const { page } = await abrir(414)
  const puntos = page.locator('.mc-punto')
  check('hay un punto por tarjeta', (await puntos.count()) === 3, String(await puntos.count()))
  const activo = () => page.evaluate(() => [...document.querySelectorAll('.mc-punto')].findIndex((x) => x.classList.contains('activo')))
  check('  …y empieza en el primero', (await activo()) === 0, String(await activo()))
  // Pulsar un punto LLEVA a su tarjeta: son botones, no adornos.
  await puntos.nth(2).click()
  await page.waitForTimeout(800)
  check('  …pulsar el último lleva al último', (await activo()) === 2, String(await activo()))
  // Y al deslizar con el dedo los puntos siguen a la tira, que es el otro
  // sentido de la misma pareja: si solo funcionara al pulsar, los puntos
  // mentirían en cuanto alguien arrastrara.
  await page.locator('#mcAlbumProgreso .mc-diapos').evaluate((n) => n.scrollTo({ left: 0, behavior: 'instant' }))
  await page.waitForTimeout(600)
  check('  …y al deslizar vuelven con ella', (await activo()) === 0, String(await activo()))
  // Lo que se pulsa, 24 px: el punto mide 6, su caja no.
  const caja = await puntos.first().evaluate((n) => Math.round(n.getBoundingClientRect().width))
  check('  …y se pueden pulsar', caja >= 24, `${caja}px`)
  await page.close()
}

console.log('\n── 4. Con sitio de sobra no hay nada que deslizar ──')
{
  const { page } = await abrir(1280)
  const m = await page.evaluate(() => {
    const t = document.querySelector('#mcAlbumProgreso .mc-diapos')
    return {
      display: getComputedStyle(t).display,
      desliza: t.scrollWidth > t.clientWidth + 4,
      puntos: getComputedStyle(document.querySelector('.mc-puntos')).display,
      anchos: [...t.children].map((c) => Math.round(c.getBoundingClientRect().width)),
    }
  })
  check('las tres en fila', m.display === 'grid' && new Set(m.anchos).size === 1, JSON.stringify(m))
  check('  …sin deslizarse', !m.desliza, JSON.stringify(m))
  // Unos puntos que no se pueden mover no dicen nada: son tres adornos.
  check('  …y sin puntos, que no dirían nada', m.puntos === 'none', JSON.stringify(m))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
