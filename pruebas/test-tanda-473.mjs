// Tanda 473 — la barra de una expansión, como la de «Cartas».
//
// PINGU, enseñando Dex: «el botón de juntar variantes y separar variantes
// que sea solamente uno… yo quiero que los filtros estén en un botón que
// sea filtros… mira un poquito mejor cómo están los espaciados entre los
// filtros».
//
// Había CINCO controles sueltos en la tira —orden, «solo las que me
// faltan», rareza, categoría y los dos de variantes— y había que
// deslizarla para ver la mitad. La pestaña «Cartas» resolvió esto mismo en
// la 449 y la 450; esta era la última pantalla de la sección sin hacerlo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

// `conRareza: false` = una colección cuyas cartas todavía no tienen rareza
// guardada, que es como está medio catálogo mientras el engorde avanza.
const siembra = (conRareza) => {
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
    market: 'WEST', card_count_official: 12, card_count_total: 14, logo_path: 'x/l', release_date: '2026-09-26' }]
  const RAR = ['Common', 'Uncommon', 'Rare', 'Double rare']
  window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({
    id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
    name: `Bulbasaur ${i + 1}`, name_es: `Bulbasaur ${i + 1}`, image_path: `x/${i + 1}`,
    rarity: conRareza ? RAR[i % 4] : null, category: conRareza ? (i % 5 === 0 ? 'Trainer' : 'Pokemon') : null,
    variants: { normal: true, reverse: true },
  }))
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 4).map((c, i) => ({
    id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM',
    variante: 'normal', created_at: new Date().toISOString(),
  }))
}

const abrir = async ({ conRareza = true, ancho = 1280 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(siembra, conRareza)
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  return { page, errores }
}

const { page, errores } = await abrir()

console.log('── 1. La barra se queda en dos chapas ──')
check('se ha abierto la expansión', await page.locator('#mcArchivadorZona').isVisible())
const enLaBarra = await page.evaluate(() =>
  [...document.querySelectorAll('#mcAlbumFiltros > *')]
    .filter((e) => !e.classList.contains('hidden'))
    .map((e) => e.id || e.tagName)
)
check('solo «Filtros» y el de variantes', enLaBarra.length === 2, enLaBarra.join(','))
check('y son esos dos', enLaBarra.includes('mcAlbumAbrirFiltros') && enLaBarra.includes('mcVistaVariantes'), enLaBarra.join(','))
// Los desplegables sueltos ya no están EN LA BARRA: están dentro del panel.
// Se mira dónde VIVEN y no si existen — existir, existen.
const dondeViven = await page.evaluate(() =>
  ['mcAlbumOrden', 'mcAlbumRareza', 'mcAlbumTipo', 'mcAlbumSoloFaltan'].map(
    (id) => `${id}:${document.getElementById(id)?.closest('dialog')?.id || 'FUERA'}`
  )
)
check('los cuatro filtros viven dentro del panel',
  dondeViven.every((x) => x.endsWith(':mcAlbumPanelFiltros')), dondeViven.join(' | '))
// Y no queda ni rastro del grupo de dos chapas.
check('el grupo de dos chapas ya no existe',
  (await page.locator('.mc-vista-variantes, #mcVistaStack, #mcVistaSplit').count()) === 0)

console.log('\n── 2. UN botón de variantes, y dice el ESTADO ──')
// Un control que guarda un estado tiene que decir el estado, o hay que
// pulsarlo para saber qué tenías puesto (la lección de la 449).
const variantes = page.locator('#mcVistaVariantes')
check('empieza en «Variantes juntas»', (await variantes.textContent()).trim() === 'Variantes juntas',
  await variantes.textContent())
check('y sin pulsar', (await variantes.getAttribute('aria-pressed')) === 'false')
const bolsillosJuntas = await page.locator('.mc-bolsillo').count()
await variantes.click()
await page.waitForTimeout(700)
check('al pulsarlo dice «Variantes separadas»', (await variantes.textContent()).trim() === 'Variantes separadas',
  await variantes.textContent())
check('y queda pulsado', (await variantes.getAttribute('aria-pressed')) === 'true')
const bolsillosSeparadas = await page.locator('.mc-bolsillo').count()
// Esto es lo que prueba que el botón HACE algo y no solo cambia de rótulo:
// en «separadas» cada versión tiene su hueco (la lección de la 313 — una
// prueba que mira si se llama a una función no prueba lo que la función
// hace).
check('y el archivador reparte un hueco por versión', bolsillosSeparadas > bolsillosJuntas,
  `${bolsillosJuntas} → ${bolsillosSeparadas}`)
check('se recuerda en el navegador', (await page.evaluate(() => localStorage.getItem('mc-split'))) === '1')
await variantes.click()
await page.waitForTimeout(700)
check('y vuelve', (await variantes.textContent()).trim() === 'Variantes juntas')

console.log('\n── 3. El panel abre y cierra por los cuatro caminos ──')
const panel = page.locator('#mcAlbumPanelFiltros')
await page.click('#mcAlbumAbrirFiltros')
await page.waitForTimeout(400)
check('abre con el botón', await panel.isVisible())
await page.click('#mcAlbumFiltrosCerrar')
await page.waitForTimeout(300)
check('cierra con la ✕', !(await panel.isVisible()))
await page.click('#mcAlbumAbrirFiltros')
await page.waitForTimeout(300)
await page.click('#mcAlbumFiltrosVer')
await page.waitForTimeout(300)
check('cierra con «Ver resultados»', !(await panel.isVisible()))
await page.click('#mcAlbumAbrirFiltros')
await page.waitForTimeout(300)
// El clic en el FONDO. Se distingue del de dentro porque `e.target` es el
// propio <dialog>: su caja ocupa la pantalla y el contenido va en hijos.
await page.mouse.click(20, 500)
await page.waitForTimeout(300)
check('y cierra al tocar fuera', !(await panel.isVisible()))

console.log('\n── 4. El pie va PEGADO AL FONDO del cajón ──')
// El pie es `position: sticky; bottom: 0`, y un sticky solo se pega cuando
// hay algo que desplazar: con cuatro filtros dentro se quedaba pegado al
// último grupo y debajo colgaba media pantalla en blanco. Lo arregla que el
// cajón sea una columna flexible.
await page.click('#mcAlbumAbrirFiltros')
await page.waitForTimeout(400)
const hueco = await page.evaluate(() => {
  const d = document.getElementById('mcAlbumPanelFiltros')
  const pie = d.querySelector('.mc-panel-pie')
  return Math.round(d.getBoundingClientRect().bottom - pie.getBoundingClientRect().bottom)
})
check('no queda hueco debajo de «Ver resultados»', hueco <= 2, `${hueco}px`)
// Y lo mismo en el de «Cartas», que comparte la pieza: el arreglo es de la
// hoja, no de esta pantalla.
await page.click('#mcAlbumFiltrosVer')
await page.waitForTimeout(300)

console.log('\n── 5. Los filtros filtran, y la chapa los cuenta ──')
const cuenta = page.locator('#mcAlbumFiltrosCuenta')
check('la chapa empieza escondida', await cuenta.isHidden())
await page.click('#mcAlbumAbrirFiltros')
await page.waitForTimeout(300)
await page.selectOption('#mcAlbumRareza', { index: 1 })
await page.waitForTimeout(600)
const trasRareza = await page.locator('.mc-bolsillo').count()
check('filtrar por rareza deja menos cartas', trasRareza > 0 && trasRareza < 12, String(trasRareza))
check('y la chapa dice 1', (await cuenta.textContent()) === '1', await cuenta.textContent())
await page.click('#mcAlbumSoloFaltan')
await page.waitForTimeout(500)
check('con «solo las que me faltan», dice 2', (await cuenta.textContent()) === '2', await cuenta.textContent())
await page.click('#mcAlbumFiltrosLimpiar')
await page.waitForTimeout(600)
check('«Limpiar» lo deja todo a cero', await cuenta.isHidden())
check('y vuelven las 12', (await page.locator('.mc-bolsillo').count()) === 12,
  String(await page.locator('.mc-bolsillo').count()))
await page.click('#mcAlbumFiltrosVer')
await page.waitForTimeout(300)

console.log('\n── 6. La ✕ de la barra quita también lo escrito ──')
const equis = page.locator('#mcAlbumQuitar')
check('empieza escondida', await equis.isHidden())
await page.fill('#mcAlbumBuscar', 'Bulbasaur 3')
await page.waitForTimeout(600)
check('al escribir, sale', await equis.isVisible())
await equis.click()
await page.waitForTimeout(600)
check('y lo borra', (await page.inputValue('#mcAlbumBuscar')) === '')
check('y se esconde otra vez', await equis.isHidden())
check('y vuelven las 12', (await page.locator('.mc-bolsillo').count()) === 12)

console.log('\n── 7. Sin errores en consola ──')
check('ninguno', errores.length === 0, errores.join(' | '))
await page.close()

console.log('\n── 8. Sin rarezas guardadas, se esconde el GRUPO entero ──')
// Y no solo el desplegable: desde que viven dentro del panel cada uno lleva
// su rótulo encima, y esconder el desplegable dejaba un «Rareza» suelto
// sobre nada.
{
  const { page: p2, errores: e2 } = await abrir({ conRareza: false })
  await p2.click('#mcAlbumAbrirFiltros')
  await p2.waitForTimeout(500)
  check('el grupo de rareza no se ve', await p2.locator('#mcAlbumGrupoRareza').isHidden())
  check('ni el de categoría', await p2.locator('#mcAlbumGrupoTipo').isHidden())
  check('pero «Ordenar por» sigue', await p2.locator('#mcAlbumOrden').isVisible())
  check('sin errores', e2.length === 0, e2.join(' | '))
  await p2.close()
}

console.log('\n── 9. Y en el móvil cabe sin desbordar ──')
{
  const { page: p3 } = await abrir({ ancho: 390 })
  const r = await p3.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  check('la página no se va de ancho', r.s <= r.c + 1, `${r.s} > ${r.c}`)
  // Dos chapas en 390 px entran sin deslizar. No se exige que la tira NO
  // pueda deslizarse —sigue siendo `.mc-mandos`—, sino que no haga falta.
  const tira = await p3.evaluate(() => {
    const t = document.getElementById('mcAlbumFiltros')
    return { s: t.scrollWidth, c: t.clientWidth }
  })
  check('y la barra de la expansión no hay que deslizarla', tira.s <= tira.c + 1, `${tira.s} > ${tira.c}`)
  await p3.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
