// Tanda 765 — la hoja «Añadir carta» (B1) y Deseos y cambios en el menú (M2).
//
// La ronda 3 pedía que Buscar dejara de ser una pestaña y fuera UNA hoja
// que se abre desde todas partes, y que el menú de Mi colección fuera
// Panel, Expansiones, Pokédex, Álbumes, Productos y Deseos y cambios. En
// la burbuja del móvil, «Trade» (PINGU: «Deseos y cambios es demasiado
// largo»). Lo que se mira: el menú, que la hoja se abre encima sin
// cambiar de pestaña y se cierra con ✕, Escape y atrás; «151/165» y
// «MEW 151»; que un bolsillo vacío use la misma hoja; y que /cartas siga
// con su pestaña Buscar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { entenderBusqueda } from '/home/user/pingu/js/mi-coleccion/busqueda.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'sv3pt5', name: '151', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207, tcg_online_code: 'MEW', logo_tcggo: 'https://images.tcggo.com/logo-151.png' },
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcg_online_code: 'OBF' },
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', serie_name: 'Espada y Escudo', market: 'WEST', release_date: '2021-08-27', card_count_official: 203, card_count_total: 237, tcg_online_code: 'EVS' },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date } })
const CARTAS = [
  carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'),
  carta('sv3pt5-6', 'sv3pt5', 6, 'Charizard ex'),
  carta('sv3-151', 'sv3', 151, 'Pidgeot'),
  carta('swsh7-151', 'swsh7', 151, 'Vaporeon'),
  carta('swsh7-52', 'swsh7', 52, 'Mew'),
]

console.log('── 1. Lo que se escribe, puro ──')
{
  const a = entenderBusqueda('151/165', SETS)
  check('«151/165»: el número y la expansión de 165', a.texto === '151' && a.total === 165 && a.setIds.join() === 'sv3pt5', JSON.stringify(a))
  const b = entenderBusqueda('MEW 151', SETS)
  check('«MEW 151»: el código del set y el número', b.texto === '151' && b.codigo === 'MEW' && b.setIds.join() === 'sv3pt5', JSON.stringify(b))
  const c = entenderBusqueda('mew', SETS)
  check('«mew» a secas es el Pokémon, no el código', c.texto === 'mew' && c.setIds === null, JSON.stringify(c))
  const d = entenderBusqueda('Pidgeot 151/999', SETS)
  check('un total que no es de ningún set no filtra', d.texto === 'Pidgeot 151' && d.setIds === null, JSON.stringify(d))
  const e = entenderBusqueda('OBF 151/165', SETS)
  check('si código y total no se cruzan, manda el código', e.setIds.join() === 'sv3', JSON.stringify(e))
}

const browser = await chromium.launch()
async function abrir(ruta, { movil = false, ancho = 1280 } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv3pt5-6', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_ALBUMES__ = [{ id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '2x2', paginas: 10, tapa: 'verde', cartas: [{ id: 'sv3pt5-6' }], updated_at: '2026-10-04T10:00:00Z' }]
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}
const visible = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().height > 0 }, id)
const resultados = (page) => page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.dataset.carta).sort().join())
const buscar = async (page, q) => { await page.fill('#mcBuscarTodo', q); await page.waitForTimeout(1200) }

console.log('── 2. El menú ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const menu = await page.$$eval('#mcMenu > button', (bs) => bs.map((b) => `${b.dataset.pestania || (b.hasAttribute('data-abrir-anadir') ? '+' : '?')}:${b.innerText.trim()}`))
  check('Panel, Expansiones, Pokédex, Álbumes, Productos, Deseos y cambios, y «Añadir carta»', menu.join('|') === 'resumen:Panel|album:Expansiones|pokedex:Pokédex|carpetas:Álbumes|productos:Productos|quiero:Deseos y cambios|+:Añadir carta', JSON.stringify(menu))
  check('  …sin Buscar como pestaña', (await page.locator('#mcMenu [data-pestania="buscar"]').count()) === 0)
  const partes = await page.evaluate(async () => (await import('/js/barra-lateral.js')).PARTES_DE_LA_COLECCION.map((p) => `${p.ver}:${p.texto}`))
  check('la lateral dice lo mismo', partes.join('|') === 'resumen:Panel|album:Expansiones|pokedex:Pokédex|carpetas:Álbumes|productos:Productos|quiero:Deseos y cambios', JSON.stringify(partes))
  await page.click('#mcMenu [data-pestania="quiero"]')
  await page.waitForTimeout(500)
  await page.click('[data-deseos-vista="cruces"]')
  await page.waitForTimeout(500)
  check('en los cruces, «Deseos y cambios» sigue encendido', (await page.getAttribute('#mcMenu [data-pestania="quiero"]', 'aria-selected')) === 'true' && new URL(page.url()).searchParams.get('ver') === 'cambios', page.url())

  console.log('── 3. La hoja ──')
  await page.click('#mcMenu [data-pestania="resumen"]')
  await page.waitForTimeout(400)
  await page.click('#mcMenu [data-abrir-anadir]')
  await page.waitForTimeout(500)
  const hoja = await page.evaluate(() => { const r = document.getElementById('mcPanelBuscar').getBoundingClientRect(); return { pos: getComputedStyle(document.getElementById('mcPanelBuscar')).position, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), titulo: document.getElementById('mcHojaTitulo').textContent, foco: document.activeElement?.id } })
  check('se abre encima, a pantalla entera, con su título', hoja.pos === 'fixed' && hoja.w === 1280 && hoja.h === 900 && hoja.top === 0 && hoja.titulo === 'Añadir carta', JSON.stringify(hoja))
  check('  …con el ratón, el foco en el campo', hoja.foco === 'mcBuscarTodo', hoja.foco)
  check('  …y el Panel se queda debajo', await visible(page, 'mcPanelResumen'))
  check('  …y la dirección dice ?ver=buscar', new URL(page.url()).searchParams.get('ver') === 'buscar', page.url())
  await buscar(page, '151/165')
  check('«151/165» da la de 151, y no las 151 de todas', (await resultados(page)) === 'sv3pt5-151', await resultados(page))
  await buscar(page, 'MEW 151')
  check('«MEW 151» también', (await resultados(page)) === 'sv3pt5-151', await resultados(page))
  await buscar(page, 'mew 52')
  check('«mew 52»: como set no hay, así que como nombre', (await resultados(page)) === 'swsh7-52', await resultados(page))
  await buscar(page, '151')
  check('«151» a secas, las tres', (await resultados(page)) === 'sv3-151,sv3pt5-151,swsh7-151', await resultados(page))
  check('  …agrupadas por expansión, con «tienes X de Y»', /tienes 1 de 207/.test(await page.textContent('#mcBuscarResultados')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/765-hoja.png` })
  await page.click('#mcBuscarResultados [data-carta="sv3-151"]')
  await page.waitForTimeout(800)
  check('tocar una abre su ficha por encima', await page.evaluate(() => document.getElementById('mcEditor')?.open))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('  …Escape cierra la ficha y la hoja se queda', !(await page.evaluate(() => document.getElementById('mcEditor')?.open)) && (await visible(page, 'mcPanelBuscar')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('  …y otro Escape, la hoja', !(await visible(page, 'mcPanelBuscar')) && !new URL(page.url()).searchParams.get('ver'), page.url())
  await page.click('#mcMenu [data-abrir-anadir]')
  await page.waitForTimeout(400)
  await page.click('#mcHojaCerrar')
  await page.waitForTimeout(300)
  check('✕ la cierra', !(await visible(page, 'mcPanelBuscar')) && (await visible(page, 'mcPanelResumen')))
  await page.click('#mcMenu [data-pestania="carpetas"]')
  await page.waitForTimeout(400)
  await page.click('#mcMenu [data-abrir-anadir]')
  await page.waitForTimeout(400)
  await page.goBack()
  await page.waitForTimeout(500)
  check('atrás la cierra, y sigues en Álbumes', !(await visible(page, 'mcPanelBuscar')) && (await visible(page, 'mcPanelCarpetas')), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Con ?ver=buscar en la dirección ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=buscar&q=Mew')
  check('abre la hoja encima del Panel', (await visible(page, 'mcPanelBuscar')) && (await visible(page, 'mcPanelResumen')))
  check('  …con la búsqueda hecha', (await resultados(page)) === 'sv3pt5-151,swsh7-52', await resultados(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Un bolsillo vacío usa la misma hoja ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  await page.waitForSelector('#mcAlbArchivador [data-hueco]', { timeout: 8000 }).catch(() => {})
  await page.click('#mcAlbArchivador [data-hueco="2"]')
  await page.waitForTimeout(400)
  check('se abre la hoja, rotulada con el bolsillo', (await visible(page, 'mcPanelBuscar')) && (await page.textContent('#mcHojaTitulo')) === 'Bolsillo 3')
  await buscar(page, 'MEW 151')
  await page.click('#mcBuscarResultados [data-carta="sv3pt5-151"]')
  await page.waitForTimeout(900)
  const guardado = await page.evaluate(() => (window.__TABLAS__.user_albums.find((a) => a.id === 'alb-bin')?.cartas || []).map((c) => c.id || '·').join())
  check('la carta va a ESE bolsillo, sin abrir la ficha', guardado === 'sv3pt5-6,·,sv3pt5-151' && !(await page.evaluate(() => document.getElementById('mcEditor')?.open)), guardado)
  check('  …y la hoja se cierra, con el álbum abierto', !(await visible(page, 'mcPanelBuscar')) && (await visible(page, 'mcAlbArchivador')))
  await page.click('#mcMenu [data-abrir-anadir]')
  await page.waitForTimeout(400)
  await page.click('#mcBuscarResultados [data-carta="sv3pt5-151"]')
  await page.waitForTimeout(800)
  check('abierta desde el menú, la misma carta abre su ficha (ya no elige)', await page.evaluate(() => document.getElementById('mcEditor')?.open))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html', { movil: true })
  const textos = await page.$$eval('#mcMenu > button', (bs) => bs.map((b) => b.innerText.trim()))
  check('en la burbuja, «Trade» y «Añadir»', textos.includes('Trade') && textos.includes('Añadir') && !textos.some((t) => /Deseos/.test(t)), JSON.stringify(textos))
  await page.click('#mcMenu [data-abrir-anadir]')
  await page.waitForTimeout(500)
  const hoja = await page.evaluate(() => ({ foco: document.activeElement?.id, w: Math.round(document.getElementById('mcPanelBuscar').getBoundingClientRect().width), cerrar: Math.round(document.getElementById('mcHojaCerrar').getBoundingClientRect().height) }))
  check('la hoja, a lo ancho y sin sacar el teclado', hoja.w === 390 && hoja.foco !== 'mcBuscarTodo', JSON.stringify(hoja))
  check('  …y su ✕ se toca (44)', hoja.cerrar >= 44, String(hoja.cerrar))
  await buscar(page, 'mew')
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('sin irse de ancho', ancho <= 1, String(ancho))
  if (CAPS) await page.screenshot({ path: `${CAPS}/765-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. /cartas sigue con su pestaña Buscar ──')
{
  const { ctx, page, errores } = await abrir('/cartas.html')
  await page.click('#mcMenu [data-pestania="buscar"]')
  await page.waitForTimeout(500)
  const v = await page.evaluate(() => ({ pos: getComputedStyle(document.getElementById('mcPanelBuscar')).position, cab: getComputedStyle(document.querySelector('.mc-hoja-cabeza')).display, album: document.getElementById('mcPanelAlbum').classList.contains('hidden') }))
  check('es una pestaña: sin hoja ni cabecera, y Expansiones se esconde', v.pos !== 'fixed' && v.cab === 'none' && v.album, JSON.stringify(v))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
