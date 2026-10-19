// Tanda 898 — la hoja de filtros de Mi colección › Cartas en cuatro bloques
// plegables (Expansión · Rareza y tipo · Idioma y estado · Precio), con lo
// elegido en la cabecera de cada uno. En el móvil se abren solo los que
// tienen algo puesto; en la columna del ordenador, todos.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. Lo estático ──')
{
  const html = leer('mi-coleccion.html')
  const bloques = [...html.matchAll(/<details class="mc-bloque-filtro" data-bloque="([a-z]+)">/g)].map((m) => m[1])
  check('la hoja tiene los cuatro bloques, en su orden', bloques.join(',') === 'expansion,rareza,estado,precio', bloques.join(','))
  check('  …cada uno con su resumen y su cuenta en la cabecera', (html.match(/<summary class="mc-bloque-cab"><b>[^<]+<\/b><span class="mc-bloque-resumen" data-resumen>Cualquiera<\/span><span class="mc-bloque-cuenta hidden" data-cuenta><\/span>/g) || []).length === 4)
  check('  …y /cartas lleva lo mismo (se genera)', leer('cartas.html').includes('data-bloque="precio"'))
  const js = leer('js/mi-coleccion.js')
  check('los grupos de chips caen en su bloque: estado, notas, ilustrador y gradeo con el idioma', /const BLOQUE_DE_GRUPO = \{ estado: 'estado', notas: 'estado', ilustrador: 'estado', gradeo: 'estado' \}/.test(js))
  check('  …el resumen sale de lo elegido, al cambiar cualquier filtro', /function pintarCuentaDeFiltros\(\) \{\s*pintarResumenesDeBloques\(\)/.test(js))
  check('  …al abrir: en columna todos, si no los que tienen algo', /bloque\.open = todos \|\| \(por\[bloque\.dataset\.bloque\] \|\| \[\]\)\.length > 0/.test(js) && /abrirBloquesDeFiltros\(todos = Boolean\(columnaFiltros\?\.enColumna\(\)\)\)/.test(js) && /pintarTiradores\(\); abrirBloquesDeFiltros\(true\) \}/.test(js))
  check('  …y los chips se escuchan en el panel entero (hay dos huecos)', /\$\('mcPanelFiltros'\)\.addEventListener\('click', \(e\) => \{\s*const chip = e\.target\.closest\('\.chip-filtro\[data-grupo\]'\)/.test(js))
  const css = leer('css/mi-coleccion.css')
  check('la cabecera del bloque mide 44 y el foco se ve', /\.mc-bloque-cab \{[^}]*min-height: 44px/.test(css) && /\.mc-bloque-cab:focus-visible \{\s*outline: none;\s*box-shadow: var\(--shadow-ring\)/.test(css))
  check('  …la cuenta va en azul sólido con el blanco fijo', /\.mc-bloque-cuenta \{[^}]*background: var\(--navy-solid\);\s*color: var\(--blanco-fijo\)/.test(css))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 4, card_count_total: 4, tcg_online_code: 'PRC' }]
  const c = (n, nombre, tipo, rareza) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${n}`, rarity: rareza, category: 'Pokemon', types: [tipo], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } })
  window.__FAKE_CARTAS__ = [c(1, 'Oddish', 'Grass', 'Common'), c(2, 'Charmander', 'Fire', 'Common'), c(3, 'Squirtle', 'Water', 'Rare'), c(4, 'Mew', 'Psychic', 'Rare')]
  const l = (id, carta, valor, idioma = 'es', estado = 'NM') => ({ id, card_id: carta, market: 'WEST', cantidad: 1, idioma, estado, variante: 'normal', valor_manual: valor, created_at: '2026-10-01T10:00:00Z' })
  window.__FAKE_COLECCION__ = [l('l1', 'xy5-1', 2), l('l2', 'xy5-2', 12, 'en', 'EX'), l('l3', 'xy5-3', null)]
}
async function abrir(opciones) {
  const ctx = await browser.newContext({ locale: 'es-ES', ...opciones })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|r2\.limitlesstcg\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const bloques = (page) => page.evaluate(() => [...document.querySelectorAll('#mcPanelFiltros .mc-bloque-filtro')].map((d) => ({ id: d.dataset.bloque, open: d.open, resumen: d.querySelector('[data-resumen]').textContent, cuenta: d.querySelector('[data-cuenta]').textContent, con: d.querySelector('[data-resumen]').classList.contains('con'), alto: Math.round(d.getBoundingClientRect().height) })))

console.log('\n── 2. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir({ ...devices['iPhone 13'] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(400)
  let b = await bloques(page)
  check('sin nada puesto, los cuatro bloques salen plegados y dicen «Cualquiera»', b.length === 4 && b.every((x) => !x.open && x.resumen === 'Cualquiera' && x.cuenta === ''), JSON.stringify(b))
  const hoja = await page.evaluate(() => { const d = document.getElementById('mcPanelFiltros'); const c = d.querySelector('.mc-panel-cuerpo'); return { cuerpo: Math.round(c.scrollHeight), hoja: Math.round(d.getBoundingClientRect().height) } })
  check('  …y la hoja plegada cabe sin desplazarse', hoja.cuerpo <= hoja.hoja, JSON.stringify(hoja))
  check('  …cada cabecera mide 44 o más', b.every((x) => x.alto >= 44), JSON.stringify(b.map((x) => x.alto)))
  // Abrir «Rareza y tipo» tocando su cabecera y elegir Fuego.
  await page.click('.mc-bloque-filtro[data-bloque="rareza"] > summary')
  await page.waitForTimeout(200)
  await page.locator('.chip-energia[aria-label="Fuego"]').click()
  await page.waitForTimeout(300)
  b = await bloques(page)
  const rareza = b.find((x) => x.id === 'rareza')
  check('tocar Fuego: la cabecera dice «Fuego» con cuenta 1, en azul', rareza.open && rareza.resumen === 'Fuego' && rareza.cuenta === '1' && rareza.con, JSON.stringify(rareza))
  check('  …y los demás siguen plegados y en «Cualquiera»', b.filter((x) => x.id !== 'rareza').every((x) => !x.open && x.resumen === 'Cualquiera'), JSON.stringify(b))
  check('  …y el botón de abajo cuenta', limpio(await page.locator('#mcFiltrosVer').innerText()) === 'Ver 1 carta')
  // El idioma, desde su bloque; y el precio.
  await page.click('.mc-bloque-filtro[data-bloque="estado"] > summary')
  await page.selectOption('#mcFiltroIdioma', 'en')
  await page.click('.mc-bloque-filtro[data-bloque="precio"] > summary')
  await page.fill('#mcFiltroPrecioDesde', '5')
  await page.waitForTimeout(300)
  b = await bloques(page)
  check('idioma y precio: «Inglés» y «Desde 5 €» en sus cabeceras', b.find((x) => x.id === 'estado').resumen === 'Inglés' && /^Desde 5/.test(b.find((x) => x.id === 'precio').resumen), JSON.stringify(b))
  check('  …y la chapa del botón «Filtros» suma los tres', limpio(await page.locator('#mcFiltrosCuenta').innerText()) === '3')
  // Cerrar y volver a abrir: salen abiertos SOLO los que tienen algo.
  await page.click('#mcFiltrosVer')
  await page.waitForTimeout(300)
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(400)
  b = await bloques(page)
  check('al volver a abrir, abiertos solo los que tienen algo (rareza, estado, precio) y plegada la expansión', b.map((x) => `${x.id}:${x.open ? 1 : 0}`).join(' ') === 'expansion:0 rareza:1 estado:1 precio:1', JSON.stringify(b))
  // Lo plegado a mano con la hoja abierta se respeta al cambiar un filtro.
  await page.click('.mc-bloque-filtro[data-bloque="precio"] > summary')
  await page.selectOption('#mcFiltroIdioma', '')
  await page.waitForTimeout(300)
  b = await bloques(page)
  check('plegar uno a mano y cambiar otro filtro no lo vuelve a abrir', !b.find((x) => x.id === 'precio').open && b.find((x) => x.id === 'estado').resumen === 'Cualquiera', JSON.stringify(b))
  await page.click('#mcFiltrosLimpiar')
  await page.waitForTimeout(300)
  b = await bloques(page)
  check('«Borrar todo» deja las cuatro cabeceras en «Cualquiera»', b.every((x) => x.resumen === 'Cualquiera' && x.cuenta === ''), JSON.stringify(b))
  await ctx.close()
}

console.log('\n── 3. En el ordenador (la columna) ──')
{
  const { page, ctx, errores } = await abrir({ viewport: { width: 1400, height: 900 }, hasTouch: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const abierta = await page.evaluate(() => document.getElementById('mcPanelFiltros').open && document.getElementById('mcPanelCartas').classList.contains('mc-con-columna'))
  check('la columna sale abierta', abierta)
  const b = await bloques(page)
  check('  …con los cuatro bloques abiertos y sus cabeceras', b.length === 4 && b.every((x) => x.open && x.resumen === 'Cualquiera'), JSON.stringify(b))
  await page.click('#mcColumnaSets [data-columna-set="xy5"]')
  await page.waitForTimeout(300)
  const exp = (await bloques(page)).find((x) => x.id === 'expansion')
  check('elegir una expansión en la lista la escribe en la cabecera del bloque', exp.resumen === 'Duelos Primigenios' && exp.cuenta === '1', JSON.stringify(exp))
  await ctx.close()
}
await browser.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
