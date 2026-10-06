// Tanda 478 — las tres vistas de una expansión.
//
// PINGU, enumerando la barra de Dex: «un botón que si le das te sale el
// desplegable si lo quieres ver en grid, en lista o en binder».
//
// Y son tres cosas distintas de verdad, no tres tamaños:
//   · ARCHIVADOR es la de APUNTAR: cada carta en su bolsillo con su −, su
//     + y sus chapas de versión. Es lo que haces con un sobre en la mano.
//   · CUADRÍCULA es la de MIRAR: los escaneos y nada más.
//   · LISTA es la de BUSCAR: un renglón por carta con número y nombre. En
//     un set de 200, leer una columna de nombres es muchísimo más rápido
//     que mirar 200 dibujos.
//
// Lo que se comprueba no es que cambie una clase: es que cada vista
// enseñe LO SUYO — que la cuadrícula no tenga mandos, que la lista tenga
// un renglón por carta y que el archivador siga teniendo sus botones.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ancho = 390) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  // Una captura con los datos a medias no es la pantalla (la 441): la
  // carta de mentira va con su proporción de verdad.
  await page.route('**assets.tcgdex.net/**', (r) =>
    r.fulfill({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 12, card_count_total: 12, logo_path: 'x/l', release_date: '2026-09-26' }]
    const RAR = ['Common', 'Uncommon', 'Rare', 'Double rare']
    window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({
      id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: `Bulbasaur ${i + 1}`, name_es: `Bulbasaur ${i + 1}`, image_path: `x/${i + 1}`,
      rarity: RAR[i % 4], category: 'Pokemon', variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 5).map((c, i) => ({
      id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: i === 1 ? 3 : 1, idioma: 'es',
      estado: 'NM', variante: 'normal', created_at: new Date().toISOString(),
    }))
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  return { page, errores }
}

const abierta = (page) => page.locator('#mcAlbumVistaHoja').evaluate((n) => n.open)

// Se ASEGURA de abrirla en vez de pulsar el botón a ciegas: si ya estaba
// abierta, el clic se lo come el fondo y lo que falla después es el clic
// de dentro, con un error que parece de la opción y es de la apertura.
const elegir = async (page, vista) => {
  if (!(await abierta(page))) {
    await page.click('#mcAlbumVista')
    await page.waitForTimeout(300)
  }
  await page.click(`[data-vista="${vista}"]`)
  await page.waitForTimeout(800)
}

const { page, errores } = await abrir()

console.log('── 1. El botón dice la vista PUESTA ──')
// Un control que guarda un estado tiene que decir el estado, o hay que
// abrirlo para saber qué pusiste (la lección de la 449).
check('empieza en «Archivador»', (await page.locator('#mcAlbumVistaRotulo').textContent()).trim() === 'Archivador',
  await page.locator('#mcAlbumVistaRotulo').textContent())
check('y lo dice también para quien no lo ve',
  /Archivador/.test(await page.locator('#mcAlbumVista').getAttribute('aria-label')),
  await page.locator('#mcAlbumVista').getAttribute('aria-label'))
await page.click('#mcAlbumVista')
await page.waitForTimeout(400)
const opciones = await page.locator('#mcAlbumVistaMenu [data-vista]').evaluateAll((ns) =>
  ns.map((n) => ({ id: n.dataset.vista, texto: n.textContent.trim(), marcada: n.getAttribute('aria-checked'), svg: Boolean(n.querySelector('svg')) })))
check('el menú trae las tres', opciones.length === 3, JSON.stringify(opciones.map((o) => o.id)))
check('  …con su nombre', opciones.map((o) => o.texto).join(',') === 'Archivador,Cuadrícula,Lista', JSON.stringify(opciones.map((o) => o.texto)))
// El icono no es adorno: es lo único que distingue tres renglones de menú
// que dicen tres palabras parecidas.
check('  …y su dibujo', opciones.every((o) => o.svg), JSON.stringify(opciones))
// `menuitemradio` y no tres botones sueltos: son UNA pregunta con tres
// respuestas, y tres botones la cuentan como tres.
check('  …marcada la puesta y solo esa',
  opciones.filter((o) => o.marcada === 'true').map((o) => o.id).join(',') === 'archivador',
  JSON.stringify(opciones.map((o) => `${o.id}:${o.marcada}`)))
// Y se cierra con su ✕, que es lo que hay.
await page.click('#mcAlbumVistaCerrar')
await page.waitForTimeout(300)

// Y LA HOJA NO CUELGA DE LA TIRA (la trampa de la 459): una tira recorta
// lo que se sale de ella, así que un panel colgado de una chapa de dentro
// sale cortado — y sin dar ningún error. Lo intenté primero con un
// `<details>` y por eso está escrito aquí.
check('la hoja vive FUERA de la tira de mandos',
  await page.evaluate(() => !document.getElementById('mcAlbumFiltros').contains(document.getElementById('mcAlbumVistaHoja'))))
check('  …y es un diálogo, que no se recorta',
  await page.evaluate(() => document.getElementById('mcAlbumVistaHoja')?.tagName) === 'DIALOG')
check('  …que al cerrarse deja de verse', (await page.locator('#mcAlbumVistaHoja').isHidden()))

console.log('\n── 2. El archivador: la vista de APUNTAR ──')
{
  const r = await page.evaluate(() => ({
    caja: Boolean(document.querySelector('.mc-album-rejilla')),
    huecos: document.querySelectorAll('.mc-album-rejilla .mc-bolsillo').length,
    // Sin mando desde la 565: la casilla es la carta, y se apunta desde
    // la ficha. Lo que sí tiene que llevar cada bolsillo es su enlace,
    // que es lo que la abre.
    // Desde la 657 cada bolsillo lleva el «+» (`.mc-mas[data-anadir]`),
    // que abre el diálogo de añadir; lo que no puede haber es un mando de
    // sumar/quitar en la casilla (la 565).
    mandos: document.querySelectorAll('.mc-album-rejilla [data-anadir]:not(.mc-mas), .mc-album-rejilla [data-quitar]').length,
    enlaces: document.querySelectorAll('.mc-album-rejilla .mc-bolsillo-enlace[data-carta]').length,
  }))
  check('son bolsillos', r.caja && r.huecos === 12, JSON.stringify(r))
  check('  …sin mando de sumar o quitar (se apunta desde la ficha, tanda 565; el «+» de la 657 abre el diálogo)', r.mandos === 0, JSON.stringify(r))
  check('  …y cada uno abre su ficha', r.enlaces === 12, JSON.stringify(r))
}

console.log('\n── 3. La cuadrícula: la vista de MIRAR ──')
await elegir(page, 'cuadricula')
{
  check('el botón lo dice', (await page.locator('#mcAlbumVistaRotulo').textContent()).trim() === 'Cuadrícula')
  const r = await page.evaluate(() => {
    const celdas = [...document.querySelectorAll('.mc-album-cuadricula .mc-rejilla-celda')]
    const una = celdas[0]?.getBoundingClientRect()
    return {
      caja: Boolean(document.querySelector('.mc-album-cuadricula')),
      celdas: celdas.length,
      // Sin mandos a propósito: si quieres apuntar, la vista de apuntar es
      // el archivador.
      mandos: document.querySelectorAll('.mc-album-cuadricula button').length,
      bolsillos: document.querySelectorAll('.mc-bolsillo').length,
      tengo: celdas.filter((c) => c.classList.contains('tengo')).length,
      ancho: Math.round(una?.width || 0),
      proporcion: una ? Math.round((una.height / una.width) * 100) / 100 : 0,
    }
  })
  check('son celdas y no bolsillos', r.caja && r.celdas === 12 && r.bolsillos === 0, JSON.stringify(r))
  check('  …sin un solo mando encima', r.mandos === 0, JSON.stringify(r))
  check('  …con las cinco que tengo marcadas', r.tengo === 5, JSON.stringify(r))
  // El hueco reservado ANTES de que llegue la imagen (regla de la casa):
  // sin él la rejilla da un salto por cada escaneo que entra.
  check('  …y con la proporción de una carta', Math.abs(r.proporcion - 342 / 245) < 0.05, JSON.stringify(r))
  // Y es MÁS DENSA que el archivador, que es para lo que existe.
  check('  …y más densa que el archivador', r.ancho < 150, `${r.ancho}px`)

  // LA LECCIÓN DE LA 470, que vive en cuanto se pinta un hueco con un
  // nombre debajo de una foto: `opacity` y `filter` crean un contexto de
  // apilamiento, así que quitárselos a la que SÍ tienes le quita lo único
  // que mantenía la imagen por encima del nombre — y la carta se ve negra.
  // No se deduce leyendo el CSS: se le pregunta al navegador qué se pinta
  // en el centro.
  const encima = await page.evaluate(() => {
    const c = document.querySelector('.mc-album-cuadricula .mc-rejilla-celda.tengo')
    if (!c) return null
    const r = c.getBoundingClientRect()
    if (r.bottom > innerHeight - 150 || r.top < 60) return 'fuera-de-pantalla'
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el?.tagName
  })
  check('la carta que tienes se ve, no sale en negro', encima === 'IMG' || encima === 'fuera-de-pantalla', String(encima))
}

console.log('\n── 4. La lista: la vista de BUSCAR ──')
await elegir(page, 'lista')
{
  check('el botón lo dice', (await page.locator('#mcAlbumVistaRotulo').textContent()).trim() === 'Lista')
  const r = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('.mc-album-lista .mc-album-fila')]
    return {
      filas: filas.length,
      altos: [...new Set(filas.map((f) => Math.round(f.getBoundingClientRect().height)))],
      primera: filas[0]?.textContent.replace(/\s+/g, ' ').trim(),
      conCopias: filas.filter((f) => /×/.test(f.textContent)).length,
      // El nombre tiene que poder recortarse: `text-overflow` no hace nada
      // sobre un hijo de flex sin `min-width: 0` (la lección de la 320).
      minimo: getComputedStyle(filas[0].querySelector('.mc-album-fila-nombre')).minWidth,
    }
  })
  check('un renglón por carta', r.filas === 12, JSON.stringify(r.filas))
  // Lo que se pulsa mide 44 (regla de la 312).
  check('  …de 44 px', r.altos.every((a) => a >= 44), JSON.stringify(r.altos))
  check('  …con el número delante y el nombre', /^1 Bulbasaur 1/.test(r.primera), r.primera)
  check('  …y las cinco que tengo dicen cuántas', r.conCopias === 5, String(r.conCopias))
  check('  …y el nombre puede recortarse', r.minimo === '0px', r.minimo)
}

console.log('\n── 5. La vista se recuerda ──')
// Como «juntas / separadas»: quien repasa un set entero en cuadrícula lo
// quiere en cuadrícula también en el siguiente.
check('se guarda en el navegador', (await page.evaluate(() => localStorage.getItem('mc-album-vista'))) === 'lista')
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3400)
check('y al recargar sigue puesta', (await page.locator('#mcAlbumVistaRotulo').textContent()).trim() === 'Lista',
  await page.locator('#mcAlbumVistaRotulo').textContent())
check('  …con sus renglones', (await page.locator('.mc-album-fila').count()) === 12)

console.log('\n── 6. Los filtros valen para las tres ──')
// La vista cambia CÓMO se pintan, no CUÁLES: si una vista se saltara los
// filtros, el mismo set diría dos cosas distintas según cómo lo mires.
await page.fill('#mcAlbumBuscar', 'Bulbasaur 1')
await page.waitForTimeout(700)
const enLista = await page.locator('.mc-album-fila').count()
await elegir(page, 'cuadricula')
const enRejilla = await page.locator('.mc-rejilla-celda').count()
await elegir(page, 'archivador')
const enAlbum = await page.locator('.mc-bolsillo').count()
check('las tres enseñan lo mismo', enLista === enRejilla && enRejilla === enAlbum && enLista > 0 && enLista < 12,
  `lista ${enLista} · cuadrícula ${enRejilla} · archivador ${enAlbum}`)

console.log('\n── 7. Sin errores ──')
check('ninguno', errores.length === 0, errores.join(' | '))
await page.close()

console.log('\n── 8. Y en el móvil no se va de ancho ──')
{
  const { page: p2 } = await abrir(390)
  for (const v of ['cuadricula', 'lista']) {
    await elegir(p2, v)
    const r = await p2.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
    check(`${v} cabe`, r.s <= r.c + 1, `${r.s} > ${r.c}`)
  }
  await p2.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
