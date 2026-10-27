// Tanda 1053 — La barra de una expansión y su menú ⋯ (PINGU: «el de marcar
// varias cartas lo sacaría fuera, para seleccionar… sin que rompa la
// estructura… al pulsar plus se suma una copia en español en Near Mint, eso
// quítalo también»).
//
// Lo que se comprueba:
//   · el ⋯ ya no lleva «Ver la edición japonesa», «Marcar varias cartas» ni
//     «Al pulsar + se suma…»;
//   · la barra, en el PC: el buscador en su fila y debajo, en una fila,
//     Todas/Tengo/Faltan · Vista · Apilar · Orden · Filtros · Seleccionar;
//   · en el móvil, una fila que se desliza con Vista, Apilar y Seleccionar
//     como su icono, delante;
//   · el orden: un chip que dice el puesto y abre su hoja; elegir uno la
//     cierra, cambia el rótulo y no cuenta como filtro;
//   · Seleccionar enciende el modo de marcar;
//   · la hoja de añadir sale con el idioma y el estado de la última vez, y el
//     aviso de «añadida» los dice.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const N = 12
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, tcg_online_code: 'SSP' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${String.fromCharCode(76 - i)}`, name_es: `Chispa ${String.fromCharCode(76 - i)}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const COLECCION = [1, 4].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${i + 1}T10:00:00Z` }))

async function abrir(url, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, COLECCION }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
  }, { SETS, CARTAS, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbum .mc-carta, #mcAlbum [data-carta]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const URL = '/mi-coleccion.html?ver=album&set=sv8'
const barra = (page) => page.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), visible: b.width > 0 && getComputedStyle(e).visibility !== 'hidden' } }
  const fila = document.getElementById('mcAlbumFiltros')
  const hijos = [...fila.children].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ id: e.id, ...r(e), texto: e.querySelector('.mc-chip-texto') ? getComputedStyle(e.querySelector('.mc-chip-texto')).clipPath : null }))
  return { buscador: r(document.getElementById('mcAlbumBuscar').closest('.mc-buscador')), fila: { ...r(fila), scroll: fila.scrollWidth, overflow: getComputedStyle(fila).overflowX }, hijos }
})

// 1. PC
{
  const { ctx, page, errores } = await abrir(URL)
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(300)
  const menu = await page.evaluate(() => ({ texto: document.querySelector('#mcAlbumMenu .mc-menu').innerText, ids: [...document.querySelectorAll('#mcAlbumMenu .mc-menu-opcion')].map((b) => b.id) }))
  check('el ⋯ sin «edición japonesa», sin «Marcar varias» ni «Al pulsar +»', !/edición japonesa|Marcar varias|Al pulsar/.test(menu.texto) && !menu.ids.includes('mcMarcarAbrir') && !menu.ids.includes('mcAlbumGemelaMenu'), JSON.stringify(menu))
  check('  …y sigue con copiar lo que falta, compartir y enseñar', ['mcFaltanCopiar', 'mcAlbumCompartir', 'mcAlbumEnsenar'].every((id) => menu.ids.includes(id)), JSON.stringify(menu.ids))
  await page.click('#mcAlbumMenu > summary')
  const b = await barra(page)
  const ids = b.hijos.map((h) => h.id)
  check('la barra del PC: Todas/Tengo/Faltan · Vista · Apilar · Orden · Filtros · Seleccionar, en ese orden', ids.join() === 'mcAlbumQue,mcAlbumVista,mcVistaVariantes,mcAlbumAbrirOrden,mcAlbumAbrirFiltros,mcMarcarAbrir', ids.join())
  check('  …en una fila, debajo del buscador', b.hijos.every((h) => Math.abs(h.y + h.h / 2 - (b.hijos[0].y + b.hijos[0].h / 2)) <= 4) && b.fila.y >= b.buscador.y + b.buscador.h, JSON.stringify(b))
  check('  …el buscador ancho (no una lupa)', b.buscador.w >= 500, b.buscador.w)
  check('  …y la fila cabe entera, sin cortar el último', b.fila.scroll <= b.fila.w, JSON.stringify(b.fila))
  check('  …y con sus palabras (Seleccionar dice «Seleccionar»)', (await page.textContent('#mcMarcarAbrir')).trim() === 'Seleccionar' && b.hijos.find((h) => h.id === 'mcMarcarAbrir').texto === 'none')

  // El orden
  check('el chip del orden dice el puesto', (await page.textContent('#mcAlbumOrdenRotulo')).trim() === 'Número', await page.textContent('#mcAlbumOrdenRotulo'))
  await page.click('#mcAlbumAbrirOrden')
  await page.waitForTimeout(300)
  check('  …y abre su hoja', await page.evaluate(() => document.getElementById('mcAlbumHojaOrden').open))
  const opcion = page.locator('#mcAlbumHojaOrden button', { hasText: 'Nombre' }).first()
  await opcion.click()
  await page.waitForTimeout(500)
  const tras = await page.evaluate(() => ({ abierta: document.getElementById('mcAlbumHojaOrden').open, rotulo: document.getElementById('mcAlbumOrdenRotulo').textContent.trim(), cuenta: document.getElementById('mcAlbumFiltrosCuenta').textContent, valor: document.getElementById('mcAlbumOrden').value }))
  check('elegir «Nombre» cierra la hoja y cambia el rótulo', !tras.abierta && tras.rotulo === 'Nombre' && tras.valor !== 'numero', JSON.stringify(tras))
  check('  …y el orden no cuenta como filtro', tras.cuenta === '', JSON.stringify(tras))
  check('  …y el orden ya no está en la hoja de filtros', !(await page.evaluate(() => Boolean(document.querySelector('#mcAlbumPanelFiltros #mcAlbumOrden')))))

  // Seleccionar
  await page.click('#mcMarcarAbrir')
  await page.waitForTimeout(600)
  check('Seleccionar enciende el modo de marcar', (await page.getAttribute('#mcMarcarAbrir', 'aria-pressed')) === 'true')
  await page.click('#mcMarcarAbrir')
  await page.waitForTimeout(400)

  // Lo último que usaste
  await page.locator('#mcAlbum [data-anadir="sv8-2"]').first().click()
  await page.waitForSelector('#mcAnadirDialogo[open]', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  const antes = await page.evaluate(() => ({ idioma: document.querySelector('#mcAdIdiomas .mc-idioma-chip.activo')?.dataset.idioma, estado: document.getElementById('mcAdEstado').value }))
  check('la hoja de añadir sale, de primeras, en español y Near Mint', antes.idioma === 'es' && antes.estado === 'NM', JSON.stringify(antes))
  await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="en"]').click()
  await page.selectOption('#mcAdEstado', 'EX')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  const aviso = await page.evaluate(() => document.querySelector('.mc-deshacer-texto')?.textContent || '')
  check('el aviso dice con qué se ha añadido', /añadida · Inglés · Excellent · ya tienes 1/.test(aviso), aviso)
  await page.locator('#mcAlbum [data-anadir="sv8-3"]').first().click()
  await page.waitForSelector('#mcAnadirDialogo[open]', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  const despues = await page.evaluate(() => ({ idioma: document.querySelector('#mcAdIdiomas .mc-idioma-chip.activo')?.dataset.idioma, estado: document.getElementById('mcAdEstado').value }))
  check('la siguiente sale con lo último que usaste (inglés, Excellent)', despues.idioma === 'en' && despues.estado === 'EX', JSON.stringify(despues))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 2. Móvil
{
  const { ctx, page, errores } = await abrir(URL, { movil: true })
  const b = await barra(page)
  const ids = b.hijos.map((h) => h.id)
  const x = Object.fromEntries(b.hijos.map((h) => [h.id, h.x]))
  check('en el móvil, Vista, Apilar y Seleccionar delante, como icono', x.mcAlbumVista < x.mcAlbumQue && x.mcVistaVariantes < x.mcAlbumQue && x.mcMarcarAbrir < x.mcAlbumQue && b.hijos.filter((h) => ['mcAlbumVista', 'mcVistaVariantes', 'mcMarcarAbrir'].includes(h.id)).every((h) => h.texto && h.texto !== 'none'), JSON.stringify(b.hijos))
  check('  …todo en una fila que se desliza', b.hijos.every((h) => Math.abs(h.y - b.hijos[0].y) <= 6) && b.fila.overflow === 'auto' && b.fila.scroll > b.fila.w, JSON.stringify(b.fila))
  check('  …y cada mando mide 36 a la vista (44 al dedo, 1038)', b.hijos.filter((h) => h.id !== 'mcAlbumQue').every((h) => h.h >= 36), JSON.stringify(b.hijos.map((h) => [h.id, h.h])))
  check('  …con los seis', ['mcAlbumQue', 'mcAlbumVista', 'mcVistaVariantes', 'mcAlbumAbrirOrden', 'mcAlbumAbrirFiltros', 'mcMarcarAbrir'].every((id) => ids.includes(id)), ids.join())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
