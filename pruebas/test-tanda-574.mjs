// Tanda 574 — tres cosas pequeñas de la lista de PINGU.
//
//  1. «Mi colección en una imagen» más grande en escritorio.
//  2. «Quitar de mi colección» en la ficha, dicho: hace lo mismo que
//     bajar las copias a cero (pregunta y quita).
//  3. Filtro por ilustrador en Cartas (el grupo sale cuando hay al menos
//     dos ilustradores distintos en tu colección).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Desde la 645 los campos de «Tu copia» arrancan PLEGADOS detrás de
// «Editar»: antes de tocar uno hay que desplegarlos (leerlos no hace falta).
async function desplegarCopia(page) {
  const b = page.locator('#mcEdEditar')
  if ((await b.count()) && (await b.isVisible()) && (await b.getAttribute('aria-expanded')) !== 'true') {
    await b.click()
    await page.waitForTimeout(150)
  }
}


let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'
const SETS = [{ id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', market: 'WEST', card_count_official: 3, card_count_total: 3, logo_path: 'x/l', release_date: '2024-11-08', tcg_online_code: 'SSP' }]
const CARTAS = [
  { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Lapras', name_es: 'Lapras', image_path: 'sv/sv8/1', rarity: 'Rare', category: 'Pokemon', illustrator: 'Mitsuhiro Arita', variants: { normal: true } },
  { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Pikachu', name_es: 'Pikachu', image_path: 'sv/sv8/2', rarity: 'Rare', category: 'Pokemon', illustrator: 'Kouki Saitou', variants: { normal: true } },
  { id: 'sv8-3', market: 'WEST', set_id: 'sv8', local_id: '3', name: 'Eevee', name_es: 'Eevee', image_path: 'sv/sv8/3', rarity: 'Rare', category: 'Pokemon', illustrator: 'Mitsuhiro Arita', variants: { normal: true } },
]
const COL = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 10, created_at: `2026-09-0${i + 1}T10:00:00Z` }))

const browser = await chromium.launch()
async function abrir(ancho, ver) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, isMobile: ancho < 500, hasTouch: ancho < 500 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.accept())
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA }))
  await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
  await page.route('**/images.pokemontcg.io/**', (r) => r.abort())
  await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  await page.addInitScript(([sets, cartas, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_COLECCION__ = col
  }, [SETS, CARTAS, COL])
  await page.goto(`${BASE}/mi-coleccion.html${ver ? `?ver=${ver}` : ''}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}

console.log('── 1. La imagen, más grande en escritorio ──')
{
  const { page, errores } = await abrir(1280)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('#mcImagenCrear').click()
  await page.waitForTimeout(2000)
  const ancho = await page.evaluate(() => document.getElementById('mcImagenLienzo').getBoundingClientRect().width)
  check('en escritorio la previsualización pasa de 500 px', ancho >= 500, `${Math.round(ancho)}px`)
  await page.close()
  const { page: movil } = await abrir(390)
  await movil.locator('#mcImagenCrear').click()
  await movil.waitForTimeout(2000)
  const anchoMovil = await movil.evaluate(() => document.getElementById('mcImagenLienzo').getBoundingClientRect().width)
  check('  …y en el móvil cabe en la pantalla', anchoMovil > 200 && anchoMovil <= 390, `${Math.round(anchoMovil)}px`)
  await movil.close()
}

console.log('── 2. «Quitar de mi colección», en la ficha ──')
{
  const { page } = await abrir(1200, 'cartas')
  check('tres cartas', (await page.locator('#mcCartas .mc-carta').count()) === 3)
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(800)
  // Desde la 645 el «Quitar» a la vista es el del resumen de tu copia; el
  // de dentro del formulario sigue ahí, plegado, y hace lo mismo.
  const boton = page.locator('#mcEdQuitarResumen')
  check('la ficha de una que tienes lleva «Quitar» a la vista (y el largo, plegado)', (await boton.count()) === 1 && (await boton.innerText()).trim() === 'Quitar' && (await page.locator('#mcEdQuitar').innerText()).trim() === 'Quitar de mi colección')
  // Desde la 669 el bloque de tu copia nace plegado: Editar lo despliega.
  await page.click('#mcEdEditar')
  await page.waitForTimeout(250)
  await boton.click()
  await page.waitForTimeout(1200)
  check('al pulsarlo (y aceptar la pregunta) se quita', (await page.locator('#mcCartas .mc-carta').count()) === 2, String(await page.locator('#mcCartas .mc-carta').count()))
  check('  …y la ficha se cierra', !(await page.evaluate(() => document.getElementById('mcEditor').open)))
  await page.close()
}

console.log('── 3. Filtro por ilustrador ──')
{
  const { page } = await abrir(1200, 'cartas')
  // En el ordenador el panel ya está abierto como columna (738): «Filtros»
  // solo se pulsa si no lo está, o lo escondería.
  if (!(await page.evaluate(() => document.getElementById('mcPanelFiltros').open))) await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(600)
  const chips = await page.$$eval('[data-grupo="ilustrador"]', (bs) => bs.map((b) => b.dataset.valor))
  check('el grupo ofrece los ilustradores que tienes', chips.includes('Mitsuhiro Arita') && chips.includes('Kouki Saitou'), chips.join(','))
  await page.click('[data-grupo="ilustrador"][data-valor="Mitsuhiro Arita"]')
  await page.waitForTimeout(600)
  // «Ver resultados» solo existe en la hoja; en la columna no hay que cerrar nada.
  if (await page.locator('#mcFiltrosVer').isVisible()) await page.click('#mcFiltrosVer')
  await page.waitForTimeout(800)
  check('filtrar por Arita deja sus dos', (await page.locator('#mcCartas .mc-carta').count()) === 2, String(await page.locator('#mcCartas .mc-carta').count()))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
