// Tanda 1054 — La misma barra en todas las pantallas de cartas (PINGU: «que
// sea todo consistente durante todos los sitios donde salgan cartas… quizá
// podríamos meter un selector también para elegir varias cartas»).
//
// Lo que se comprueba:
//   · Cartas: Orden · Filtros · Seleccionar y el catálogo al final;
//   · la Pokédex (una especie): Todas/Tengo/Faltan · Apilar · Filtros ·
//     Seleccionar, y Tengo/Faltan filtran de verdad;
//   · Buscar: Todas/Tengo/Faltan · Orden · Filtros · Seleccionar · catálogo,
//     y Tengo/Faltan filtran; «Solo las que tengo» ya no existe;
//   · Seleccionar marca cartas en la Pokédex y en Buscar (la barra de abajo
//     cuenta), y no abre la ficha;
//   · en el móvil, los iconos delante;
//   · sin cuenta (/cartas), no hay «Seleccionar».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const N = 8
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Pikachu ${i + 1}`, name_es: `Pikachu ${i + 1}`, name_search: `pikachu ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25], variants: { normal: true } }))
const COLECCION = [1, 2, 3].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${i + 1}T10:00:00Z` }))

async function abrir(url, { movil = false, sesion = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, COLECCION, sesion }) => {
    window.__FAKE_SESSION__ = sesion ? 'admin-1' : 'none'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = sesion ? COLECCION : []
  }, { SETS, CARTAS, COLECCION, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|pokeapi/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}
// Lo que se ve de una barra, en orden de izquierda a derecha.
const piezas = (page, sel) => page.evaluate((sel) => {
  const fila = document.querySelector(sel)
  if (!fila) return null
  return [...fila.children].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== 'none' })
    .map((e) => ({ id: e.id || (e.matches('.mc-mercado') ? 'catalogo' : e.tagName), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) }))
    // El catálogo es un <select> que se pinta como segmento (el SPAN de detrás): uno.
    .filter((e, i, a) => !(e.id === 'SPAN' && a[i - 1]?.id === 'catalogo'))
}, sel)
const ids = (p) => (p || []).map((x) => x.id).join(',')
const tarjetas = (page, zona) => page.$$eval(`${zona} a[data-carta]`, (as) => as.map((a) => a.dataset.carta))

// 1. Cartas (PC)
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  const p = await piezas(page, '#mcMandos')
  check('Cartas: Orden · Filtros · Seleccionar y el catálogo al final', ids(p) === 'mcAbrirOrden,mcAbrirFiltros,mcCartasSeleccionar,catalogo', ids(p))
  await page.click('#mcCartasSeleccionar')
  await page.waitForTimeout(500)
  // La caja de la barra no mide nada (748): se ve su tira de arriba.
  check('  …y Seleccionar enciende la selección de copias', (await page.getAttribute('#mcCartasSeleccionar', 'aria-pressed')) === 'true' && await page.locator('#mcMarcarBarra .mc-sel-arriba').isVisible())
  await page.click('#mcCartasSeleccionar')
  await page.waitForTimeout(300)
  check('sin errores (Cartas)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 2. La Pokédex (PC)
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=pokedex&dex=25')
  await page.waitForSelector('#pdxQue', { timeout: 6000 }).catch(() => {})
  const fila = await page.evaluate(() => document.getElementById('pdxQue')?.parentElement?.id || document.getElementById('pdxQue')?.parentElement?.className)
  const p = await page.evaluate(() => [...document.getElementById('pdxQue').parentElement.children].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.id || (e.matches('.mc-mercado') ? 'catalogo' : e.tagName)).join(',').replace('catalogo,SPAN', 'catalogo'))
  check('Pokédex: Todas/Tengo/Faltan · Apilar · Filtros · Seleccionar y el catálogo (el idioma, en la hoja desde la 1055)', /^pdxQue,pdxVariantes,(pdxAbrirFiltros,)?pdxSeleccionar,catalogo$/.test(p), `${fila}: ${p}`)
  check('  …ya sin «Solo las que me faltan» ni «Variantes juntas»', !(await page.locator('#pdxSoloFaltan').count()) && !/Variantes (juntas|separadas)/.test(await page.textContent('#mcPokedexPanel')))
  const todas = (await tarjetas(page, '#mcPokedexPanel')).length
  await page.click('[data-pdx-que="tengo"]')
  await page.waitForTimeout(400)
  const tengo = await tarjetas(page, '#mcPokedexPanel')
  await page.click('[data-pdx-que="faltan"]')
  await page.waitForTimeout(400)
  const faltan = await tarjetas(page, '#mcPokedexPanel')
  check('  …Tengo deja las tuyas y Faltan las demás', todas === 8 && tengo.join() === 'sv8-1,sv8-2,sv8-3' && faltan.length === 5 && !faltan.includes('sv8-1'), JSON.stringify({ todas, tengo, faltan }))
  check('  …y el botón dice cuál está puesto', (await page.getAttribute('[data-pdx-que="faltan"]', 'aria-pressed')) === 'true')
  await page.click('[data-pdx-que="todas"]')
  await page.waitForTimeout(400)
  // Seleccionar
  await page.click('#pdxSeleccionar')
  await page.waitForTimeout(500)
  const primeras = page.locator('#mcPokedexPanel a[data-carta]')
  await primeras.nth(0).click()
  await primeras.nth(4).click()
  await page.waitForTimeout(400)
  const sel = await page.evaluate(() => ({ marcadas: [...document.querySelectorAll('#mcPokedexPanel a[data-carta].marcada')].map((a) => a.dataset.carta), cuenta: document.getElementById('mcMarcarCuenta')?.textContent, ficha: document.getElementById('mcEditor')?.open, modo: document.getElementById('mcPokedexPanel').classList.contains('mc-cat-marcando') }))
  check('Seleccionar en la Pokédex: marca al tocar, sin abrir la ficha', sel.modo && sel.marcadas.length === 2 && sel.cuenta === '2 seleccionadas' && !sel.ficha, JSON.stringify(sel))
  await page.click('[data-pdx-que="tengo"]')
  await page.waitForTimeout(500)
  const tras = await page.evaluate(() => [...document.querySelectorAll('#mcPokedexPanel a[data-carta].marcada')].map((a) => a.dataset.carta))
  check('  …y lo marcado sigue marcado aunque la rejilla se repinte', tras.length === 1, JSON.stringify(tras))
  await page.click('#mcMarcarCancelar')
  await page.waitForTimeout(300)
  check('  …y Cancelar lo apaga todo', !(await page.evaluate(() => document.querySelectorAll('#mcPokedexPanel .marcada').length || document.getElementById('mcPokedexPanel').classList.contains('mc-cat-marcando'))))
  check('sin errores (Pokédex)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 3. Buscar (PC)
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=buscar')
  await page.fill('#mcBuscarTodo', 'pikachu')
  await page.waitForTimeout(1500)
  const p = await page.evaluate(() => [...document.querySelector('#mcBuscarBarra .mc-mandos').children].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.id || (e.matches('.mc-mercado') ? 'catalogo' : e.tagName)).join(',').replace('catalogo,SPAN', 'catalogo'))
  check('Buscar: Todas/Tengo/Faltan · Apilar · Orden · Filtros · Seleccionar · catálogo (serie y expansión, en la hoja desde la 1055)', /^mcBuscarQue,mcBuscarVariantes,mcBuscarAbrirOrden,mcBuscarAbrirFiltros,mcBuscarSeleccionar,catalogo$/.test(p), p)
  check('  …y «Solo las que tengo» ya no está', !(await page.locator('#mcBuscarSoloMias').count()))
  const todas = (await tarjetas(page, '#mcBuscarResultados')).length
  await page.click('[data-bus-que="tengo"]')
  await page.waitForTimeout(400)
  const tengo = await tarjetas(page, '#mcBuscarResultados')
  await page.click('[data-bus-que="faltan"]')
  await page.waitForTimeout(400)
  const faltan = await tarjetas(page, '#mcBuscarResultados')
  check('  …Tengo y Faltan filtran lo que ha vuelto', todas === 8 && tengo.length === 3 && faltan.length === 5 && !faltan.some((x) => tengo.includes(x)), JSON.stringify({ todas, tengo, faltan }))
  await page.click('[data-bus-que="todas"]')
  await page.waitForTimeout(400)
  await page.click('#mcBuscarSeleccionar')
  await page.waitForTimeout(500)
  await page.locator('#mcBuscarResultados a[data-carta]').nth(1).click()
  await page.waitForTimeout(300)
  const sel = await page.evaluate(() => ({ n: document.querySelectorAll('#mcBuscarResultados a.marcada').length, cuenta: document.getElementById('mcMarcarCuenta')?.textContent, url: location.search }))
  check('Seleccionar en Buscar: marca al tocar y no navega', sel.n === 1 && sel.cuenta === '1 seleccionada' && /ver=buscar/.test(sel.url), JSON.stringify(sel))
  await page.click('#mcMarcarTodas')
  await page.waitForTimeout(300)
  check('  …y «Seleccionar todas» coge las ocho', (await page.textContent('#mcMarcarCuenta')) === '8 seleccionadas', await page.textContent('#mcMarcarCuenta'))
  await page.click('#mcMarcarCancelar')
  check('sin errores (Buscar)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 4. Móvil: los iconos delante
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=pokedex&dex=25', { movil: true })
  await page.waitForSelector('#pdxQue', { timeout: 6000 }).catch(() => {})
  const x = await page.evaluate(() => Object.fromEntries(['pdxQue', 'pdxVariantes', 'pdxSeleccionar', 'pdxAbrirFiltros'].map((id) => [id, Math.round(document.getElementById(id)?.getBoundingClientRect().x ?? -1)])))
  check('en el móvil, Apilar y Seleccionar delante, como icono', x.pdxVariantes < x.pdxQue && x.pdxSeleccionar < x.pdxQue, JSON.stringify(x))
  check('sin errores (móvil)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 5. Sin cuenta, sin «Seleccionar»
{
  const { ctx, page } = await abrir('/cartas.html?ver=buscar', { sesion: false })
  await page.fill('#mcBuscarTodo', 'pikachu').catch(() => {})
  await page.waitForTimeout(1500)
  const visibles = await page.evaluate(() => [...document.querySelectorAll('[data-seleccionar]')].filter((b) => b.getBoundingClientRect().width > 0).length)
  check('sin cuenta (/cartas), ningún «Seleccionar» a la vista', visibles === 0, visibles)
  check('  …ni Todas/Tengo/Faltan en Buscar', !(await page.locator('#mcBuscarQue').isVisible()))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
