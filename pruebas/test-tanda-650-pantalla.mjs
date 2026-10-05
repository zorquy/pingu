// Tanda 650 en pantalla — añadir como en TCGGO.
//
// PINGU: «el botón de añadir debería estar arriba, pegado a la carta; y
// cuando agrego una copia en inglés de una que ya tengo en español, se
// cambia y me dice que las dos son inglesas. En TCGGO agregas en el plus
// y te dice en qué idioma añadirla; la segunda vez te sale lo que tienes
// y le das a añadir más». Así que: el «+» debajo de la carta, un diálogo
// con el idioma (banderas), estado, versión, copias y lo que pagaste; y
// cada guardado es una línea nueva o una copia más de la misma — nunca
// reescribe la que había.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 0. Lo estático ──')
{
  const html = readFileSync(`${RAIZ}/mi-coleccion.html`, 'utf8')
  check('el bloque viejo de añadir ya no existe', !/mcEdAnadirBloque|mcEdAnadirVersiones|mcEdAnadirVariante/.test(html))
  check('las acciones van dentro de la columna de la carta', /id="mcEdFoto"><\/div>\s*<!--[\s\S]*?-->\s*<div class="mc-ficha-acciones hidden" id="mcEdAcciones">/.test(html))
  const js = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('guardar pasa por `datos.anadir`, nunca por `actualizar`', /const nueva = await datos\.anadir\(sesion\.user\.id, linea, mercado\)/.test(js) && !/tocarBolsillo\(/.test(js))
  check('cartas.html lleva lo mismo (generado)', /id="mcAnadirDialogo"/.test(readFileSync(`${RAIZ}/cartas.html`, 'utf8')))
}

const browser = await chromium.launch()
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
  ]
  window.__FAKE_COLECCION__ = sesion === 'none' ? [] : [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
}
const cartaFalsa = () => ({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" rx="12" fill="#c9a227"/></svg>' })
async function abrir(ruta, { sesion = 'admin-1', ancho = 1200 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla, { sesion })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill(cartaFalsa()))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const abrirFicha = async (page, id) => {
  await page.locator(`#mcAlbum .mc-bolsillo-enlace[data-carta="${id}"]`).click()
  await page.waitForTimeout(900)
}
const dialogo = (page) => page.locator('#mcAnadirDialogo')

console.log('\n── 1. Una que no tienes: el «+» bajo la carta abre el formulario ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await abrirFicha(page, 'xy5-1')
  check('las acciones se ven debajo de la carta, con el «+» y sin «Tienes»', (await page.locator('#mcEdAcciones').isVisible()) && (await page.locator('#mcEdMas').isVisible()) && !(await page.locator('#mcEdTienes').isVisible()))
  const foto = await page.locator('#mcEdFoto').boundingBox()
  const mas = await page.locator('#mcEdMas').boundingBox()
  check('  …pegado a la carta: justo debajo y centrado con ella', mas.y >= foto.y + foto.height && Math.abs((mas.x + mas.width / 2) - (foto.x + foto.width / 2)) < 60, JSON.stringify({ foto, mas }))
  check('  …y no hay bloque de «tu copia»', !(await page.locator('#mcEdCopiaBloque').isVisible()))
  await page.click('#mcEdMas')
  await page.waitForTimeout(500)
  check('se abre el diálogo de añadir, en la cara del formulario', (await dialogo(page).evaluate((d) => d.open)) && (await page.locator('#mcAdForm').isVisible()) && !(await page.locator('#mcAdYa').isVisible()))
  check('  …con la carta y su nombre', (await page.locator('#mcAdCarta img').count()) === 1 && /Añadiendo Weedle/.test(limpio(await page.locator('#mcAdNombre').innerText())))
  const chips = page.locator('#mcAdIdiomas .mc-idioma-chip')
  check('los idiomas son chips con bandera, y el español viene puesto', (await chips.count()) >= 5 && (await chips.locator('.pv-bandera').count()) === (await chips.count()) && (await page.locator('#mcAdIdiomas .mc-idioma-chip.activo').getAttribute('data-idioma')) === 'es')
  check('la versión se ofrece (normal y reverse)', (await page.locator('#mcAdVarianteLabel').isVisible()) && (await page.$$eval('#mcAdVariante option', (os) => os.map((o) => o.value).join(','))) === 'normal,reverse')
  await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="en"]').click()
  await page.locator('#mcAdCantidad').locator('xpath=../button[@data-paso="1"]').click()
  await page.fill('#mcAdCompra', '2,5')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('al guardar, el diálogo se cierra', !(await dialogo(page).evaluate((d) => d.open)))
  check('  …y la ficha pasa a ser la de tu copia en INGLÉS, dos copias', (await page.locator('#mcEdCopiaBloque').isVisible()) && /EN NM/.test(limpio(await page.locator('#mcEdCopiaChapas').innerText())) && /2 copias/.test(limpio(await page.locator('#mcEdCopiaVale').innerText())), limpio(await page.locator('#mcEdCopiaVale').innerText()))
  check('  …con lo que pagaste', /pagaste 2,50 €/.test(limpio(await page.locator('#mcEdCopiaVale').innerText())), limpio(await page.locator('#mcEdCopiaVale').innerText()))
  check('  …y «Tienes 2» junto al «+»', limpio(await page.locator('#mcEdTienes').innerText()) === 'Tienes 2')
  check('  …y la casilla del álbum pasa a «la tengo»', ((await page.locator('#mcAlbum .mc-bolsillo').first().getAttribute('class')) || '').includes('tengo'))
  await page.close()
}

console.log('\n── 2. Una que ya tienes en español: «ya en tu colección», y la inglesa es OTRA línea ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  await abrirFicha(page, 'xy5-150')
  check('la ficha de tu copia: «Tienes 1» y el «+»', limpio(await page.locator('#mcEdTienes').innerText()) === 'Tienes 1' && (await page.locator('#mcEdMas').isVisible()))
  await page.click('#mcEdMas')
  await page.waitForTimeout(500)
  check('el diálogo abre en «Ya en tu colección», con tu línea', (await page.locator('#mcAdYa').isVisible()) && !(await page.locator('#mcAdForm').isVisible()) && /ES NM Holo 1 copia/.test(limpio(await page.locator('#mcAdYaLista').innerText())), limpio(await page.locator('#mcAdYaLista').innerText()))
  await page.click('#mcAdMas')
  await page.waitForTimeout(300)
  check('«Añadir más» pasa al formulario, con el idioma otra vez a elegir', (await page.locator('#mcAdForm').isVisible()) && (await page.locator('#mcAdIdiomas .mc-idioma-chip').count()) >= 5)
  check('  …y sin desplegable de versión: solo existe en holo', !(await page.locator('#mcAdVarianteLabel').isVisible()))
  await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="en"]').click()
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  const otras = page.locator('#mcEdOtrasCopias')
  check('la ficha pasa a la copia inglesa y dice que también tienes la española', /EN NM/.test(limpio(await page.locator('#mcEdCopiaChapas').innerText())) && (await otras.isVisible()) && /ES NM/.test(limpio(await otras.innerText())) && /×1/.test(limpio(await otras.innerText())), limpio(await otras.innerText()))
  check('  …«Tienes 2»', limpio(await page.locator('#mcEdTienes').innerText()) === 'Tienes 2')
  // LA FORMA DEL FALLO: la española tiene que seguir siendo española.
  await otras.locator('.mc-otra-copia').first().click()
  await page.waitForTimeout(700)
  check('la copia española sigue siendo española (no se reescribió)', /ES NM/.test(limpio(await page.locator('#mcEdCopiaChapas').innerText())) && /1 copia\b/.test(limpio(await page.locator('#mcEdCopiaVale').innerText())), limpio(await page.locator('#mcEdCopiaVale').innerText()))
  const lineasEn = await page.evaluate(() => fetch('/rest/v1/user_collection?select=idioma,cantidad').then((r) => r.json()).catch(() => null))
  check('  …y en la base son DOS líneas, una por idioma', Array.isArray(lineasEn) ? lineasEn.length === 2 && lineasEn.some((l) => l.idioma === 'es' && l.cantidad === 1) && lineasEn.some((l) => l.idioma === 'en' && l.cantidad === 1) : true, JSON.stringify(lineasEn))
  // Y otra vez en inglés: no es una tercera línea, es una copia más.
  await page.click('#mcEdMas')
  await page.waitForTimeout(400)
  check('la tercera vez enseña las dos líneas', (await page.locator('#mcAdYaLista .mc-ad-ya-linea').count()) === 2)
  await page.click('#mcAdMas')
  await page.waitForTimeout(300)
  await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="en"]').click()
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('otra inglesa suma a la inglesa: 2 copias, y sigue habiendo dos líneas', /EN NM/.test(limpio(await page.locator('#mcEdCopiaChapas').innerText())) && /2 copias/.test(limpio(await page.locator('#mcEdCopiaVale').innerText())) && (await otras.locator('.mc-otra-copia').count()) === 1 && limpio(await page.locator('#mcEdTienes').innerText()) === 'Tienes 3')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Sin cuenta no hay «+»: la ficha dice «entra» ──')
{
  const { page } = await abrir('/cartas?set=xy5', { sesion: 'none' })
  await abrirFicha(page, 'xy5-1')
  check('sin acciones bajo la carta y con el bloque de entrar', !(await page.locator('#mcEdAcciones').isVisible()) && (await page.locator('#mcEdEntrarBloque').isVisible()))
  await page.close()
}

console.log('\n── 4. En el móvil ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album&set=xy5', { ancho: 390 })
  await abrirFicha(page, 'xy5-1')
  check('el «+» se ve debajo de la carta', await page.locator('#mcEdMas').isVisible())
  await page.click('#mcEdMas')
  await page.waitForTimeout(500)
  check('el diálogo cabe: sin desplazamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  const caja = await dialogo(page).boundingBox()
  check('  …y mide lo que mide la pantalla', caja && caja.width <= 391 && caja.x >= 0, JSON.stringify(caja))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
