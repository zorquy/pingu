// Tanda 740 — Mi colección en tres columnas (D2 de la lista de propuestas,
// elegidas por PINGU): tus expansiones a la izquierda, la rejilla en el
// centro y la carta abierta a la derecha.
//
// Lo que se mira: la regla (ancha Y desde la rejilla de Cartas); y a 1.680
// con ratón: «Tus expansiones» con sus cuentas, que filtra al pulsar y
// deja de pulsar con «Todas»; la carta abierta a la derecha SIN modal, con
// la rejilla a la vista y que se puede pulsar otra; las flechas con el foco
// en la rejilla pasan de carta; Esc cierra y la página vuelve a lo ancho;
// el menú de Mi colección vive en la barra lateral y funciona; desde una
// expansión la ficha sigue siendo la de siempre; y a 1.440 también.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { vaAlLado } = await import(`${RAIZ}/js/mi-coleccion/ficha-al-lado.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La regla ──')
check('ancha y desde Cartas: al lado', vaAlLado({ ancha: true, vista: 'cartas' }))
// Desde la 748 (D2 de su maqueta) también desde una expansión, y desde 1.400.
check('desde una expansión, también', vaAlLado({ ancha: false, anchaExpansion: true, vista: 'album' }))
check('  …pero no en una expansión estrecha', !vaAlLado({ ancha: false, anchaExpansion: false, vista: 'album' }))
check('desde la Pokédex, no', !vaAlLado({ ancha: true, vista: 'pokedex' }))
check('estrecha, no', !vaAlLado({ ancha: false, vista: 'cartas' }))

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 16 }, { id: 'sv1', name: 'Escarlata y Púrpura', serie_id: 'sv', market: 'WEST', card_count_official: 8 }]
  const set = (i) => (i < 16 ? { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } : { id: 'sv1', name: 'Escarlata y Púrpura', serie_id: 'sv' })
  window.__FAKE_CARTAS__ = Array.from({ length: 24 }, (_, i) => ({ id: `${set(i).id}-${i + 1}`, market: 'WEST', set_id: set(i).id, local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}`, rarity: 'Common', category: 'Pokemon', dex_ids: [i + 1], tcg_sets: set(i) }))
  window.__FAKE_COLECCION__ = Array.from({ length: 24 }, (_, i) => ({ id: `l${i}`, user_id: 'user-1', card_id: `${set(i).id}-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
}
async function abrir(ruta = '/mi-coleccion.html?ver=cartas', ancho = 1680) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const ficha = (page) => page.evaluate(() => {
  const d = document.getElementById('mcEditor')
  const r = d.getBoundingClientRect()
  const g = document.getElementById('mcCartas').getBoundingClientRect()
  return { open: d.open, modal: d.matches(':modal'), visto: getComputedStyle(d).display !== 'none', der: Math.round(r.right), izq: Math.round(r.left), rejillaDer: Math.round(g.right), nombre: d.querySelector('#mcEditorTitulo')?.textContent.trim(), columnas: getComputedStyle(document.getElementById('mcCartas')).gridTemplateColumns.split(' ').length, ancho: document.documentElement.scrollWidth, ventana: innerWidth }
})

console.log('── 2. Tus expansiones, a la izquierda ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const lista = await page.$$eval('#mcColumnaSets .mc-columna-set', (bs) => bs.map((b) => [...b.children].map((c) => c.textContent.trim()).join(' ')))
  check('la lista, con la que más tienes primero y su cuenta', JSON.stringify(lista) === JSON.stringify(['Todas', 'Duelos Primigenios 16', 'Escarlata y Púrpura 8']), JSON.stringify(lista))
  check('  …y el desplegable de colección no se ve (es la misma elección)', !(await page.locator('#mcFiltroSet').isVisible()))
  await page.click('#mcColumnaSets [data-columna-set="sv1"]')
  await page.waitForTimeout(400)
  check('pulsar una filtra la rejilla', (await page.locator('#mcCartas .mc-carta').count()) === 8 && (await page.getAttribute('#mcColumnaSets [data-columna-set="sv1"]', 'aria-pressed')) === 'true')
  await page.click('#mcColumnaSets [data-columna-set=""]')
  await page.waitForTimeout(400)
  check('  …y «Todas» lo quita', (await page.locator('#mcCartas .mc-carta').count()) === 24)

  console.log('── 3. La carta, a la derecha ──')
  await page.click('#mcCartas .mc-carta >> nth=2')
  await page.waitForTimeout(800)
  const f = await ficha(page)
  check('se abre sin modal, pegada a la derecha y sin tapar la rejilla', f.open && !f.modal && f.der === f.ventana && f.izq >= f.rejillaDer && f.ancho <= f.ventana, JSON.stringify(f))
  check('  …y a la rejilla le quedan cinco columnas', f.columnas >= 5, JSON.stringify(f))
  const antes = f.nombre
  await page.click('#mcCartas .mc-carta >> nth=5')
  await page.waitForTimeout(700)
  const otra = await ficha(page)
  check('con ella abierta se puede pulsar otra carta, y la de la derecha cambia', otra.open && !otra.modal && otra.nombre !== antes, `${antes} → ${otra.nombre}`)
  await page.focus('#mcCartas .mc-carta >> nth=0').catch(() => {})
  await page.evaluate(() => document.querySelector('#mcCartas .mc-carta')?.focus?.())
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(700)
  const sig = await ficha(page)
  check('las flechas, con el foco en la rejilla, pasan de carta', sig.nombre !== otra.nombre, `${otra.nombre} → ${sig.nombre}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const cerrada = await ficha(page)
  check('Esc la cierra y la página vuelve a lo ancho', !cerrada.open && !cerrada.visto && !(await page.evaluate(() => document.documentElement.classList.contains('con-ficha-al-lado'))), JSON.stringify(cerrada))

  console.log('── 4. El menú de Mi colección, en la barra lateral ──')
  const menu = await page.evaluate(() => { const m = document.getElementById('mcMenu'); return { enLateral: !!m?.closest('.lat'), visible: !!m && m.getBoundingClientRect().height > 0, opciones: [...(m?.querySelectorAll('[data-pestania]') || [])].map((b) => b.textContent.trim()) } })
  // Desde la 767 cuelga directamente del cajón de Cartas (sin la fila «Mi
  // colección»), con siete: Productos (762), Deseos y cambios y Buscar.
  check('va en la lateral, con sus siete', menu.enLateral && menu.visible && menu.opciones.length === 7, JSON.stringify(menu))
  await page.click('.lat [data-pestania="album"]')
  await page.waitForTimeout(800)
  check('  …y funciona: abre Expansiones', await page.locator('#mcPanelAlbum').isVisible())
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Donde la ficha es la de siempre ──')
{
  // Desde la 748 la expansión ancha va en tres columnas (748-pantalla, 14).
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=xy5', 1280)
  await page.locator('#mcPanelAlbum .mc-bolsillo-enlace').first().click()
  await page.waitForTimeout(800)
  const f = await ficha(page)
  check('desde una expansión estrecha, la ficha es modal', f.open && f.modal, JSON.stringify(f))
  await ctx.close()
  const b = await abrir('/mi-coleccion.html?ver=cartas', 1440)
  await b.page.click('#mcCartas .mc-carta >> nth=2')
  await b.page.waitForTimeout(800)
  const g = await ficha(b.page)
  check('a 1.440, modal: con la lateral y los filtros no caben tres', g.open && g.modal, JSON.stringify(g))
  await b.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
