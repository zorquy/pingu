// Tanda 975 — /admin → Colecciones: todo eras, plegadas, y moverlas sin números.
//
// PINGU: «con los números no sé en qué… que al mover también se mueva donde
// yo quiero, crear eras… quita el apartado de otros sets… que sean todo eras
// y yo voy moviendo el orden. El orden de ahora está bien, no muevas nada».
//
// Se mira: lo puro (el id de una era nueva, dónde cae), que el panel enseñe
// las eras en el MISMO orden que la web, plegadas y recordando las abiertas;
// marcar varias y «Mover a…»; «+ Nueva era» con las marcadas dentro y en su
// sitio; renombrar sin números; y el móvil sin desbordar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const { idDeEraNueva, conEraEn } = await import(`${RAIZ}/admin/js/orden-arrastrable.js`)
  check("«McDonald's» da «mcdonalds»", idDeEraNueva("McDonald's") === 'mcdonalds', idDeEraNueva("McDonald's"))
  check('  …sin acentos ni espacios', idDeEraNueva('Pokémon Futsal & Más') === 'pokemon-futsal-mas', idDeEraNueva('Pokémon Futsal & Más'))
  check('  …y si ya existe, con -2', idDeEraNueva('POP Series', ['pop-series']) === 'pop-series-2' && idDeEraNueva('', []) === 'era')
  check('una era nueva arriba, abajo o detrás de otra', conEraEn(['a', 'b'], 'n', '__arriba').join() === 'n,a,b' && conEraEn(['a', 'b'], 'n', '__abajo').join() === 'a,b,n' && conEraEn(['a', 'b'], 'n', 'a').join() === 'a,n,b')
}

const SETS = [
  ['sv8', 'Chispas Fulgurantes', '2024-11-08', 'sv'], ['sv7', 'Corona Astral', '2024-09-13', 'sv'], ['svp', 'Promos de Escarlata y Púrpura', '2023-03-31', 'sv'],
  ['swsh12', 'Tempestad Plateada', '2022-11-11', 'swsh'], ['mcd22', "McDonald's Collection 2022", '2022-08-03', 'swsh'], ['fut20', 'Pokémon Futsal 2020', '2020-09-11', 'swsh'],
  ['base1', 'Set Básico', '1999-01-09', 'base'], ['pop1', 'POP Series 1', '2004-09-01', 'pop'], ['pop2', 'POP Series 2', '2005-08-01', 'pop'], ['tk1a', 'EX Trainer Kit Latias', '2004-06-01', 'tk'],
  ['pp1', 'Prize Pack Series One', '2021-08-01', 'prize-pack'],
].map(([id, name, release_date, serie_id]) => ({ id, name, release_date, serie_id, market: 'WEST', card_count_official: 100, card_count_total: 100 }))
const ERAS = [
  { market: 'WEST', id: 'sv', nombre: 'Escarlata y Púrpura', orden: 10 }, { market: 'WEST', id: 'swsh', nombre: 'Espada y Escudo', orden: 20 },
  { market: 'WEST', id: 'base', nombre: 'Base', orden: 90 }, { market: 'WEST', id: 'pop', nombre: 'POP Series', orden: 95, grupo: 'otros' },
  { market: 'WEST', id: 'prize-pack', nombre: 'Play! Pokémon Prize Pack', orden: 100, grupo: 'otros' },
]

const browser = await chromium.launch()
async function abrir(ruta, opciones = { viewport: { width: 1280, height: 1000 } }) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES' })
  await ctx.addInitScript(([s, e]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = s
    window.__FAKE_FILAS__ = { tcg_eras: e }
    window.__FAKE_CARTAS__ = []
    window.__FAKE_COLECCION__ = []
  }, [SETS, ERAS])
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }))
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="40"/>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (ruta.startsWith('/admin')) {
    await page.evaluate(() => document.querySelector('[data-section="colecciones"]')?.click())
    await page.waitForTimeout(1200)
  }
  return { page, ctx, errores }
}
const erasDelPanel = (page) => page.$$eval('#coleccionesLista > [data-era]', (xs) => xs.map((x) => x.querySelector('h3').textContent.trim()))
const tabla = (page, t) => page.evaluate((t) => window.__TABLAS__[t] || [], t)

console.log('\n── 2. El panel enseña lo que enseña la web ──')
let deLaWeb = []
{
  const { page, ctx, errores } = await abrir('/cartas?ver=album')
  check('la web sin errores', errores.length === 0, errores.join(' | '))
  deLaWeb = await page.$$eval('#mcEstanteriaRejilla h3', (hs) => hs.map((h) => h.textContent.trim()))
  check('la web: todo eras, sin «Otros sets» ni «Sets especiales»', !deLaWeb.some((t) => /Otros sets|Sets especiales/.test(t)) && (await page.locator('#mcEstanteriaRejilla h2').count()) === 0, deLaWeb.join(' | '))
  check("  …y McDonald's sale en la era que tiene (Espada y Escudo), no aparte", await page.locator('.mc-estanteria-titulo:text-is("Espada y Escudo") + .mc-estanteria [data-set="mcd22"]').count() === 1)
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir('/admin/')
  check('el panel sin errores', errores.length === 0, errores.join(' | '))
  const panel = await erasDelPanel(page)
  check('las mismas eras, en el mismo orden que la web', panel.join(' | ') === deLaWeb.join(' | '), `${panel.join(' | ')} ≠ ${deLaWeb.join(' | ')}`)
  check('  …sin el rótulo «Otros sets»', (await page.locator('#coleccionesLista h2').count()) === 0)
  check('todas plegadas de salida', (await page.locator('#coleccionesLista .col-sets:not([hidden])').count()) === 0)
  await page.click('[data-plegar="swsh"]')
  check('  …tocar una la abre', (await page.getAttribute('[data-plegar="swsh"]', 'aria-expanded')) === 'true' && (await page.locator('[data-era="swsh"] [data-set]').count()) === 3)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('[data-section="colecciones"]')?.click())
  await page.waitForTimeout(1200)
  check('  …y se acuerda al volver', (await page.getAttribute('[data-plegar="swsh"]', 'aria-expanded')) === 'true')
  await page.fill('#coleccionesFiltro', 'pop series')
  await page.waitForTimeout(300)
  check('buscar enseña solo las eras con algo que casa, abiertas', (await erasDelPanel(page)).join() === 'POP Series' && (await page.locator('[data-era="pop"] .col-sets:not([hidden]) [data-set]').count()) === 2, (await erasDelPanel(page)).join())
  await page.fill('#coleccionesFiltro', '')
  await page.waitForTimeout(300)

  console.log('\n── 3. Marcar varias y «Mover a…» ──')
  await page.check('[data-marcar="mcd22"]')
  await page.check('[data-marcar="fut20"]')
  check('la barra dice cuántas hay marcadas', /2 marcadas/.test(await page.textContent('#coleccionesSeleccion')))
  await page.click('#colMoverA')
  await page.waitForTimeout(300)
  check('«Mover a…» lista las eras por su nombre', (await page.locator('.col-destino').allTextContents()).some((t) => /POP Series/.test(t)))
  await page.click('#colMoverNueva')
  await page.waitForTimeout(300)
  await page.fill('#colNuevaEraNombre', "McDonald's")
  await page.selectOption('#colNuevaEraDonde', 'base')
  await page.click('#colNuevaEraCrear')
  await page.waitForTimeout(1500)
  const sets = await tabla(page, 'tcg_sets')
  const corr = await tabla(page, 'tcg_correcciones')
  check("«+ Nueva era» las mete en «McDonald's»", ['mcd22', 'fut20'].every((id) => sets.find((s) => s.id === id)?.serie_id === 'mcdonalds'), JSON.stringify(sets.filter((s) => ['mcd22', 'fut20'].includes(s.id)).map((s) => s.serie_id)))
  check('  …como corrección, que la pasada del catálogo no deshace (908)', corr.filter((c) => c.columna === 'serie_id' && JSON.stringify(c.valor) === '"mcdonalds"').length === 2, JSON.stringify(corr))
  const panel2 = await erasDelPanel(page)
  check('  …y la era sale justo detrás de Base, donde se pidió', panel2[panel2.indexOf('Base') + 1] === "McDonald's", panel2.join(' | '))
  const eras = await tabla(page, 'tcg_eras')
  check('  …con todas las eras guardadas en ese orden y sin grupo', eras.every((e) => !e.grupo) && eras.find((e) => e.id === 'mcdonalds')?.nombre === "McDonald's", JSON.stringify(eras.map((e) => [e.id, e.orden, e.grupo])))
  check('  …y sin marcas', await page.locator('#coleccionesSeleccion').isHidden())
  await page.check('[data-marcar="tk1a"]').catch(async () => { await page.click('[data-plegar="tk"]'); await page.check('[data-marcar="tk1a"]') })
  await page.click('#colMoverA')
  await page.waitForTimeout(300)
  await page.check('.col-destino input[value="pop"]')
  await page.click('#colMoverAqui')
  await page.waitForTimeout(1200)
  check('«Mover aquí» la lleva a una era que ya existe', (await tabla(page, 'tcg_sets')).find((s) => s.id === 'tk1a')?.serie_id === 'pop')

  console.log('\n── 4. Renombrar, sin números ──')
  await page.click('[data-era-editar="pop"]')
  await page.waitForTimeout(300)
  check('la hoja de una era no pide un número ni un grupo', (await page.locator('#colEraOrden, #colEraGrupo').count()) === 0 && (await page.locator('#colEraNombre').count()) === 1)
  await page.fill('#colEraNombre', 'POP y Trainer Kits')
  await page.click('#colEraGuardar')
  await page.waitForTimeout(600)
  check('  …y renombrar se guarda', (await tabla(page, 'tcg_eras')).find((e) => e.id === 'pop')?.nombre === 'POP y Trainer Kits')
  await page.click('[data-plegar="swsh"]').catch(() => {})
  await page.waitForTimeout(200)
  if ((await page.getAttribute('[data-plegar="swsh"]', 'aria-expanded')) !== 'true') await page.click('[data-plegar="swsh"]')
  await page.click('[data-editar="swsh12"]')
  await page.waitForTimeout(400)
  check('el editor de una colección elige la era en un desplegable con sus nombres, sin «orden»', (await page.locator('select#colEra option').allTextContents()).includes('Espada y Escudo') && (await page.locator('#colOrden, #colEraNombreNuevo').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. En el móvil ──')
{
  const { page, ctx, errores } = await abrir('/admin/', { ...devices['iPhone 13'] })
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('no se va de ancho', ancho <= 1, String(ancho))
  check('↑ ↓ de cada era miden 44 px', (await page.$eval('[data-bajar-era="sv"]', (b) => b.getBoundingClientRect().height)) >= 44)
  await page.click('[data-plegar="swsh"]')
  await page.check('[data-marcar="fut20"]')
  await page.click('#colMoverA')
  await page.waitForTimeout(300)
  const boton = await page.$eval('#colMoverAqui', (b) => { const r = b.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.width > 0 })
  check('la hoja de «Mover a…» cabe, con «Mover aquí» a la vista', boton)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
