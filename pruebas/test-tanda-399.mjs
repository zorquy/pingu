// Tanda 399 — los filtros, en un panel de chips.
//
// PINGU, enseñando Dex: su panel lleva orden, tipo de carta, energía y
// rareza en chips. Nosotros teníamos cuatro desplegables en fila, que en
// un móvil no caben y que además no llegaban a lo que de verdad se
// filtra.
//
// Lo que esta prueba mira y no supone:
//   · Que los grupos salen de lo que HAY en tu colección. Una lista
//     escrita a mano ofrece rarezas que no tienes y se queda sin las que
//     salgan mañana (la lección de la 323).
//   · Que un grupo con un solo valor NO se pinta: un filtro con una
//     opción no filtra nada.
//   · Que dentro de un grupo los chips SUMAN y entre grupos RESTAN. Al
//     revés, elegir dos rarezas daría cero resultados siempre.
//   · Y que la chapa dice cuántos hay puestos: sin ella, un filtro
//     olvidado parece una colección que ha encogido.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST',
      card_count_official: 4, card_count_total: 4, release_date: '2023-01-01' }]
    window.__FAKE_CARTAS__ = [
      { id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Agua1', image_path: 'x/1', market: 'WEST',
        category: 'Pokemon', types: ['Water'], rarity: 'Rare', variants: { normal: true } },
      { id: 'sv1-2', set_id: 'sv1', local_id: '2', name: 'Fuego1', image_path: 'x/2', market: 'WEST',
        category: 'Pokemon', types: ['Fire'], rarity: 'Common', variants: { normal: true } },
      { id: 'sv1-3', set_id: 'sv1', local_id: '3', name: 'Objeto', image_path: 'x/3', market: 'WEST',
        category: 'Trainer', rarity: 'Common', variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = [1, 2, 3].map((n) => ({
      id: `l${n}`, card_id: `sv1-${n}`, cantidad: 1, idioma: 'es', estado: 'nueva', variante: 'normal',
    }))
  })
  // `?ver=cartas` desde la tanda 447, y NO es un detalle de la prueba: la
  // pestaña por defecto es el PANEL desde la 440, y lo que esta prueba
  // mira vive en la pestaña de CARTAS. Sin el parámetro, el panel de
  // cartas está `hidden` y Playwright encuentra los elementos —existen en
  // el DOM— pero no son visibles: la prueba se cae con un «element is not
  // visible» que parece un fallo de la web y es una prueba que se quedó
  // vieja. Buscar un elemento NO es lo mismo que verlo.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('\n── 1. Los grupos salen de lo que hay ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las tres cartas', (await page.locator('.mc-carta').count()) === 3)
  // En el ordenador el panel ya está abierto como columna (738): «Filtros»
  // solo se pulsa si no lo está, o lo escondería.
  if (!(await page.evaluate(() => document.getElementById('mcPanelFiltros').open))) await page.locator('#mcAbrirFiltros').click()
  await page.waitForTimeout(500)
  const grupos = await page.locator('#mcGruposChips h3').allTextContents()
  check('hay grupo de tipo, energía y rareza',
    ['Tipo de carta', 'Tipo de energía', 'Rareza'].every((g) => grupos.includes(g)), grupos.join(', '))
  // Todas las líneas son normal/nueva/es: esos grupos tendrían UN valor
  // y no se pintan.
  check('un grupo con un solo valor no se pinta',
    !grupos.includes('Versión') && !grupos.includes('Estado'), grupos.join(', '))

  // Y los valores son los de TU colección, traducidos.
  const energias = await page.locator('.chip-filtro[data-grupo="energia"]').allTextContents()
  check('las energías son las que tienes', energias.sort().join(',') === 'Agua,Fuego', energias.join(','))
  await page.close()
}

console.log('\n── 2. Dentro suman, entre grupos restan ──')
{
  const { page } = await abrir()
  // En el ordenador el panel ya está abierto como columna (738): «Filtros»
  // solo se pulsa si no lo está, o lo escondería.
  if (!(await page.evaluate(() => document.getElementById('mcPanelFiltros').open))) await page.locator('#mcAbrirFiltros').click()
  await page.waitForTimeout(400)
  const cartas = () => page.locator('.mc-carta').count()
  const chip = (g, v) => page.locator(`.chip-filtro[data-grupo="${g}"][data-valor="${v}"]`)

  await chip('energia', 'Agua').click()
  await page.waitForTimeout(500)
  check('un chip filtra', (await cartas()) === 1, `${await cartas()}`)
  await chip('energia', 'Fuego').click()
  await page.waitForTimeout(500)
  check('dos del MISMO grupo suman', (await cartas()) === 2, `${await cartas()}`)

  // Rareza «Común» es de la de fuego y de la de entrenador: cruzado con
  // energía {Agua, Fuego} tiene que quedar solo la de fuego.
  await chip('rareza', 'Común').click()
  await page.waitForTimeout(500)
  const n = await cartas()
  check('otro grupo RESTA', n === 1, `${n}`)

  check('la chapa dice cuántos hay puestos',
    (await page.locator('#mcFiltrosCuenta').textContent()) === '3',
    await page.locator('#mcFiltrosCuenta').textContent())

  await page.locator('#mcFiltrosLimpiar').click()
  await page.waitForTimeout(500)
  check('limpiar los quita todos', (await cartas()) === 3)
  check('  …y la chapa se apaga',
    (await page.locator('#mcFiltrosCuenta').getAttribute('class'))?.includes('hidden'))
  await page.close()
}

console.log('\n── 3. El orden al revés ──')
{
  const { page } = await abrir()
  // SIN abrir el panel de filtros (tanda 447): el orden y su «Al revés»
  // viven en la BARRA desde la 444, no dentro del panel. Abrirlo deja un
  // `<dialog>` modal por delante, y el modal se come la pulsación — el
  // error dice «intercepts pointer events» y no «no está», que es la
  // pista. Un control que se muda de sitio deja la prueba apuntando a
  // donde estaba.
  await page.waitForTimeout(300)
  // Desde la tanda 449 el orden es una BANDEJA con su interruptor de
  // sentido, no un <select> más un botón «Al revés».
  const ponOrden = async (orden, sentido) => {
    await page.locator('#mcAbrirOrden').click()
    await page.waitForTimeout(350)
    if (orden) await page.locator(`[data-orden="${orden}"]`).click()
    else await page.locator(`[data-sentido="${sentido}"]`).click()
    await page.waitForTimeout(500)
    if (!orden) await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  await ponOrden('nombre')
  const nombres = () => page.locator('.mc-carta-foto').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label')))
  const antes = await nombres()
  await ponOrden(null, 'desc')
  const despues = await nombres()
  // Se invierte la lista YA ordenada, así que un orden nuevo sale con su
  // vuelta puesta sin escribir otro comparador.
  check('al revés es al revés', JSON.stringify(despues) === JSON.stringify([...antes].reverse()),
    `${antes.join(' | ')} → ${despues.join(' | ')}`)
  check('  …y el interruptor lo dice',
    (await page.locator('[data-sentido="desc"]').getAttribute('aria-checked')) === 'true')
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
