// Tanda 738 — los filtros en una columna fija junto a la rejilla, en el
// ordenador (X14 de la lista de propuestas, elegidas por PINGU).
//
// Lo que se mira: la regla (pantalla ancha con ratón y no haberla
// escondido); que en el ordenador el panel salga ya abierto, SIN modal, a
// la izquierda de la rejilla y pegado al bajar; que tocar un chip filtre al
// momento con la rejilla a la vista; que «Filtros» la esconda y se recuerde
// al volver; y que en el móvil todo siga como hoja.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { vaEnColumna } = await import(`${RAIZ}/js/mi-coleccion/filtros-columna.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La regla ──')
check('ancha y sin elegir: columna', vaEnColumna({ ancha: true, guardado: null }))
check('ancha y escondida a propósito: no', !vaEnColumna({ ancha: true, guardado: 'no' }))
check('estrecha: nunca', !vaEnColumna({ ancha: false, guardado: 'si' }))

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  // 60, para que la rejilla sea más alta que el panel también con la barra
  // lateral (739), que la ensancha: si no, el `sticky` no tiene recorrido.
  const rarezas = Array.from({ length: 60 }, (_, i) => (i === 3 ? 'Rare Holo' : i % 2 ? 'Rare' : 'Common'))
  window.__FAKE_CARTAS__ = rarezas.map((r, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i + 1}`, rarity: r, category: 'Pokemon', dex_ids: [i + 1], tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = rarezas.map((r, i) => ({ id: `l${i}`, user_id: 'user-1', card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
}
async function abrir({ movil = false, ctx = null } = {}) {
  ctx = ctx || await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1440, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const estado = (page) => page.evaluate(() => {
  const p = document.getElementById('mcPanelFiltros')
  const r = p.getBoundingClientRect()
  const g = document.getElementById('mcCartas').getBoundingClientRect()
  return { open: p.open, modal: p.matches(':modal'), visto: getComputedStyle(p).display !== 'none', izq: Math.round(r.right) <= Math.round(g.left), top: Math.round(r.top), cartas: document.querySelectorAll('#mcCartas > *').length, chips: document.querySelectorAll('#mcGruposChips [data-grupo]').length, ver: getComputedStyle(document.getElementById('mcFiltrosVer')).display }
})

console.log('── 2. En el ordenador ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const e = await estado(page)
  check('el panel sale abierto, sin modal, a la izquierda de la rejilla', e.open && !e.modal && e.visto && e.izq && e.cartas === 60, JSON.stringify(e))
  check('  …con sus chips ya pintados y sin «Ver resultados»', e.chips > 0 && e.ver === 'none', JSON.stringify(e))
  // Se baja poco: con 24 cartas la rejilla es corta, y al final de su
  // zona el panel se va con ella, que es lo que hace un `sticky`.
  await page.evaluate(() => scrollTo(0, 260))
  await page.waitForTimeout(300)
  const abajo = await estado(page)
  check('  …y pegado al bajar', abajo.visto && abajo.top >= 60 && abajo.top <= 100, JSON.stringify(abajo))
  await page.evaluate(() => scrollTo(0, 0))
  const chip = page.locator('#mcGruposChips [data-grupo]').filter({ hasText: /Rara Holo|Rare Holo|Holo/ }).first()
  if (await chip.count()) {
    await chip.click()
    await page.waitForTimeout(400)
    const f = await estado(page)
    check('tocar un chip filtra al momento, con la rejilla y el panel a la vista', f.cartas === 1 && f.open, JSON.stringify(f))
  } else check('hay un chip de «holo» que tocar', false, await page.textContent('#mcGruposChips'))
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(300)
  const fuera = await estado(page)
  check('«Filtros» esconde la columna y la rejilla se queda a lo ancho', !fuera.open && !fuera.visto && (await page.$eval('#mcPanelCartas', (s) => !s.classList.contains('mc-con-columna'))), JSON.stringify(fuera))
  check('  …sin abrir la hoja', !(await page.evaluate(() => document.getElementById('mcPanelFiltros').matches(':modal'))))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('al volver, se acuerda: sigue escondida', !(await estado(page)).open)
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(300)
  const otra = await estado(page)
  check('  …y «Filtros» la vuelve a sacar como columna', otra.open && !otra.modal && otra.izq, JSON.stringify(otra))
  await page.click('#mcFiltrosCerrar')
  await page.waitForTimeout(300)
  check('el ✕ también la esconde', !(await estado(page)).open)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.waitForTimeout(300)
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(400)
  check('con la ventana estrecha, «Filtros» abre la hoja de siempre', await page.evaluate(() => document.getElementById('mcPanelFiltros').matches(':modal')))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. En el móvil, como siempre ──')
{
  const { page, ctx } = await abrir({ movil: true })
  const e = await estado(page)
  check('el panel no sale solo', !e.open && !e.visto, JSON.stringify(e))
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(400)
  check('  …y «Filtros» abre la hoja (modal)', await page.evaluate(() => document.getElementById('mcPanelFiltros').matches(':modal')))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
