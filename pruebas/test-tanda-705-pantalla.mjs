// Tandas 705 y 706 — hojas desde abajo y la expansión compacta en el móvil.
//
// PINGU, con Dex delante y «dale con todo lo planeado». 705: el panel de
// filtros (cajón lateral) y la ficha de una carta (diálogo centrado) son
// hojas desde abajo en el móvil, y en el escritorio siguen como estaban.
// 706: la expansión sin la miga que repite la pestaña, con el carrusel
// de estadísticas sin aire de escritorio y el «+» abajo a la izquierda,
// donde no tapa el dibujo; las cartas empiezan antes.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  localStorage.setItem('mc-split', '0')
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164 }]
  window.__FAKE_CARTAS__ = ['Weedle', 'Kakuna', 'Beedrill', 'Pikachu', 'Raichu', 'Eevee'].map((x, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: x, name_es: x, image_path: `xy/xy5/${i + 1}`, rarity: 'Common', category: 'Pokemon', dex_ids: [13 + i], variants: { normal: true, reverse: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = [1, 2, 4].map((i) => ({ id: `l${i}`, card_id: `xy5-${i}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
}
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1200, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
const caja = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(r.left), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), vw: window.innerWidth, vh: window.innerHeight, radio: cs.borderTopLeftRadius, radioAbajo: cs.borderBottomLeftRadius, abierto: e.open } })
const esHoja = (c) => c.abierto && c.x === 0 && c.w === c.vw && c.bottom === c.vh && c.top > 40 && c.radio !== '0px' && c.radioAbajo === '0px'

console.log('── 705. Las hojas desde abajo ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  const f = await caja(page, '#mcAlbumPanelFiltros')
  check('los filtros son una hoja desde abajo: de lado a lado, pegada al fondo, redondeada arriba', esHoja(f), JSON.stringify(f))
  await page.click('#mcAlbumFiltrosCerrar')
  await page.waitForTimeout(300)
  check('  …y al cerrar deja de verse', !(await page.locator('#mcAlbumPanelFiltros').isVisible()))
  await page.locator('#mcAlbum .mc-bolsillo').first().click()
  await page.waitForTimeout(500)
  const e = await caja(page, '#mcEditor')
  check('la ficha de una carta también es una hoja desde abajo', esHoja(e), JSON.stringify(e))
  check('  …con sus acciones dentro (Añadir, Editar, Avísame)', (await page.locator('#mcEditor .mc-ficha-acciones').count()) === 1)
  // 705b: PINGU, «con el dedo se va para los lados; debería ser inmóvil».
  const ancho = await page.$eval('#mcEditor', (d) => ({ scrollW: d.scrollWidth, clientW: d.clientWidth, x: getComputedStyle(d).overflowX, fuera: [...d.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1 }).length }))
  check('  …y la hoja no se desliza de lado: nada dentro es más ancho que la pantalla', ancho.scrollW === ancho.clientW && ancho.x === 'hidden' && ancho.fuera === 0, JSON.stringify(ancho))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('  …y Escape la cierra', !(await page.locator('#mcEditor').isVisible()))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=xy5', { movil: false })
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  const f = await caja(page, '#mcAlbumPanelFiltros')
  check('en el escritorio los filtros siguen siendo el cajón lateral (pegado a la derecha, de arriba abajo)', f.abierto && f.x > 600 && f.x + f.w === f.vw && f.top === 0, JSON.stringify(f))
  await ctx.close()
}

console.log('── 706. La expansión compacta ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  check('la miga «Expansiones ›» no sale: la burbuja ya dice dónde estás', !(await page.locator('#mcAlbumMigas').isVisible()))
  const primera = await page.$eval('#mcAlbum .mc-bolsillo', (e) => Math.round(e.getBoundingClientRect().top))
  check('la primera carta empieza en la primera pantalla (antes, a pantalla y media)', primera <= 460, String(primera))
  const mas = await page.$eval('#mcAlbum .mc-bolsillo .mc-mas', (e) => { const r = e.getBoundingClientRect(); const p = e.closest('.mc-bolsillo').getBoundingClientRect(); return { abajo: r.bottom <= p.bottom && r.bottom > p.bottom - 40, izquierda: r.left >= p.left && r.left < p.left + 40, w: Math.round(r.width) } })
  check('el «+» va abajo a la izquierda de la carta, sin tapar el dibujo', mas.abajo && mas.izquierda && mas.w >= 28, JSON.stringify(mas))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
