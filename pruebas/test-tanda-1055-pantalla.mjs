// Tanda 1055 — La misma hoja de filtros en las cuatro pantallas de cartas
// (Cartas, una expansión, una especie de la Pokédex y Buscar).
//
// Lo que se comprueba:
//   · las cuatro hojas: «Filtros» y el ✕ arriba (sin «Borrar todo»), y abajo
//     «Limpiar» y «Ver N cartas»;
//   · los grupos salen en el orden de hoja-filtros.js (Tipo, Rareza, Tipo de
//     carta, Tipo de entrenador, Versión, Precio, Idioma de tus copias, y lo
//     de cada pantalla detrás), con esos nombres y no los de antes
//     («Categoría», «Tipo de energía», «Contar solo las que tengo en»);
//   · Cartas: sin bloques plegables; los atajos de precio filtran y Limpiar
//     los quita; en la columna del PC, la lista de expansiones y no el
//     desplegable;
//   · la Pokédex: el idioma de tus copias está en la hoja (no en la barra) y
//     cambia lo que cuenta como «Tengo»;
//   · Buscar: la serie y la expansión están en la hoja (no en la barra),
//     filtran y cuentan en la chapa; Apilar está en la barra;
//   · el Tipo va como símbolo también en Buscar y la Pokédex.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const ORDEN = ['Tipo', 'Rareza', 'Tipo de carta', 'Tipo de entrenador', 'Versión', 'Precio', 'Idioma de tus copias']
const browser = await chromium.launch()
const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 6, card_count_total: 6 },
  { id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 2, card_count_total: 2 },
]
const carta = (set, n, extra = {}) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: `Pikachu ${n}`, name_es: `Pikachu ${n}`, name_search: `pikachu ${n}`, image_path: `x/${set}/${n}`, rarity: n % 2 ? 'Common' : 'Rare', category: 'Pokemon', types: [n % 3 ? 'Lightning' : 'Colorless'], dex_ids: [25], variants: { normal: true, reverse: true }, ...extra })
const CARTAS = [...[1, 2, 3, 4, 5, 6].map((n) => carta('sv8', n)), ...[1, 2].map((n) => carta('base1', n))]
const COLECCION = [
  { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
  { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'en', estado: 'EX', variante: 'reverse', created_at: '2026-10-02T10:00:00Z' },
  { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-03T10:00:00Z' },
]

async function abrir(url, { movil = true, sesion = true } = {}) {
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

// Lo que dice una hoja abierta: cabecera, pie y los títulos de los grupos que
// se ven, en orden, separando lo de delante y lo de detrás de la raya.
const hoja = (page, id) => page.evaluate((id) => {
  const d = document.getElementById(id)
  const ve = (e) => e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none'
  const cab = [...d.querySelectorAll('.mc-panel-cabecera > *')].map((e) => e.textContent.trim())
  const pie = [...d.querySelectorAll('.mc-panel-pie > *')].filter(ve).map((e) => ({ t: e.textContent.trim(), x: Math.round(e.getBoundingClientRect().x) }))
  const titulos = []
  let detras = false
  for (const e of d.querySelectorAll('.mc-grupo-filtro, .mc-hoja-raya')) {
    if (e.matches('.mc-hoja-raya')) { if (ve(e)) detras = true; continue }
    if (!ve(e)) continue
    titulos.push((detras ? '| ' : '') + e.querySelector('h3').childNodes[0].textContent.trim())
  }
  return { cab, pie, titulos, bloques: d.querySelectorAll('details.mc-bloque-filtro').length }
}, id)
const enOrden = (titulos) => {
  const delante = titulos.filter((t) => !t.startsWith('| '))
  const i = delante.map((t) => ORDEN.indexOf(t))
  return i.every((x, k) => x >= 0 && (k === 0 || x > i[k - 1]))
}
const comun = (nombre, h) => {
  check(`${nombre}: arriba «Filtros» y el ✕, sin «Borrar todo»`, h.cab[0] === 'Filtros' && h.cab.length === 2 && !h.cab.some((t) => /Borrar/.test(t)), h.cab.join(' | '))
  check(`${nombre}: abajo «Limpiar» a la izquierda y «Ver N cartas»`, h.pie.length === 2 && h.pie[0].t === 'Limpiar' && /^Ver \d+ cartas?$|^Ninguna carta/.test(h.pie[1].t) && h.pie[0].x < h.pie[1].x, JSON.stringify(h.pie))
  check(`${nombre}: los grupos en el orden común`, enOrden(h.titulos), h.titulos.join(' · '))
  check(`${nombre}: sin los nombres viejos`, !h.titulos.some((t) => /Categoría|Tipo de energía|Contar solo|Precio de cada|Precio por copia/.test(t)), h.titulos.join(' · '))
}

// 1. Cartas (móvil)
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(500)
  const h = await hoja(page, 'mcPanelFiltros')
  comun('Cartas', h)
  check('Cartas: sin bloques plegables', h.bloques === 0, h.bloques)
  check('Cartas: Tipo, Rareza, Versión, Precio, Idioma de tus copias delante; Expansión y Estado detrás de la raya', ['Tipo', 'Rareza', 'Versión', 'Precio', 'Idioma de tus copias'].every((t) => h.titulos.includes(t)) && h.titulos.includes('| Expansión') && h.titulos.includes('| Estado'), h.titulos.join(' · '))
  check('Cartas: el idioma de tus copias en chips', await page.locator('#mcPanelFiltros [data-hoja="idioma"] .mc-seg button').count() >= 3)
  const cuantas = () => page.locator('#mcCartas .mc-carta').count()
  const antes = await cuantas()
  await page.click('#mcPrecioAtajos [data-precio-atajo="10-"]')
  await page.waitForTimeout(400)
  check('Cartas: «Más de 10 €» filtra (sin precios, ninguna) y se queda pulsado', (await cuantas()) === 0 && (await page.getAttribute('#mcPrecioAtajos [data-precio-atajo="10-"]', 'aria-pressed')) === 'true' && (await page.inputValue('#mcFiltroPrecioDesde')) === '10', `${antes} → ${await cuantas()}`)
  await page.click('#mcFiltrosLimpiar')
  await page.waitForTimeout(400)
  check('Cartas: «Limpiar» lo quita', (await cuantas()) === antes && (await page.getAttribute('#mcPrecioAtajos [data-precio-atajo="10-"]', 'aria-pressed')) === 'false', `${antes} / ${await cuantas()}`)
  await page.click('#mcPanelFiltros [data-hoja="idioma"] .mc-seg button[data-valor="en"]')
  await page.waitForTimeout(400)
  check('Cartas: el chip «Inglés» deja solo la inglesa', (await cuantas()) === 1 && (await page.inputValue('#mcFiltroIdioma')) === 'en', await cuantas())
  check('sin errores (Cartas)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 2. Cartas en el PC: la columna lleva la lista de expansiones y Limpiar.
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=cartas', { movil: false })
  const r = await page.evaluate(() => {
    const ve = (id) => { const e = document.getElementById(id); return !!e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none' }
    return { columna: document.getElementById('mcPanelCartas').classList.contains('mc-con-columna'), lista: ve('mcColumnaSets'), desplegable: ve('mcFiltroSet'), limpiar: ve('mcFiltrosLimpiar'), ver: ve('mcFiltrosVer') }
  })
  check('PC: en columna, la lista de expansiones y no el desplegable; Limpiar sí, «Ver» no', r.columna && r.lista && !r.desplegable && r.limpiar && !r.ver, JSON.stringify(r))
  check('sin errores (Cartas PC)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 3. Una expansión
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(500)
  const h = await hoja(page, 'mcAlbumPanelFiltros')
  comun('Expansión', h)
  check('Expansión: «Tipo de carta» e «Idioma de tus copias», y «Qué cartas» detrás de la raya', h.titulos.includes('Idioma de tus copias') && h.titulos.includes('| Qué cartas') && (h.titulos.includes('Tipo de carta') || !(await page.locator('#mcAlbumGrupoTipo:not(.hidden)').count())), h.titulos.join(' · '))
  check('sin errores (Expansión)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 4. Una especie de la Pokédex
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=pokedex&dex=25')
  await page.waitForSelector('#pdxAbrirFiltros', { timeout: 6000 }).catch(() => {})
  check('Pokédex: el idioma ya no está en la barra', (await page.locator('#pdxIdioma').count()) === 0)
  await page.click('#pdxAbrirFiltros')
  await page.waitForTimeout(500)
  const h = await hoja(page, 'mcPdxPanelFiltros')
  comun('Pokédex', h)
  check('Pokédex: Tipo, Rareza e Idioma de tus copias', ['Tipo', 'Rareza', 'Idioma de tus copias'].every((t) => h.titulos.includes(t)), h.titulos.join(' · '))
  check('Pokédex: el Tipo va como símbolo', (await page.locator('#mcPdxGrupos [data-hoja="energia"] img.mc-energia').count()) >= 2)
  const tengo = () => page.locator('#mcPokedexPanel .pdx-carta.tengo').count()
  const antes = await tengo()
  await page.click('#mcPdxGrupos [data-pdx-idioma="es"]')
  await page.waitForTimeout(500)
  const enEs = await tengo()
  check('Pokédex: con «Español», la inglesa deja de contar como «Tengo»', antes === 3 && enEs === 2 && (await page.getAttribute('#mcPdxGrupos [data-pdx-idioma="es"]', 'aria-checked')) === 'true', `${antes} → ${enEs}`)
  check('  …y la chapa de «Filtros» lo cuenta', (await page.textContent('#pdxAbrirFiltros .mc-filtros-cuenta')).trim() === '1')
  await page.click('#mcPdxFiltrosLimpiar')
  await page.waitForTimeout(500)
  check('Pokédex: «Limpiar» vuelve a cualquier idioma', (await tengo()) === antes)
  check('sin errores (Pokédex)', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 5. Buscar
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=buscar')
  await page.fill('#mcBuscarTodo', 'pikachu')
  await page.waitForTimeout(1500)
  const enBarra = await page.evaluate(() => ['mcBuscarSerie', 'mcBuscarSet'].map((id) => !!document.getElementById(id)?.closest('#mcBuscarBarra')))
  check('Buscar: la serie y la expansión ya no están en la barra', enBarra.every((x) => !x), JSON.stringify(enBarra))
  check('Buscar: «Apilar» en la barra', await page.locator('#mcBuscarVariantes').isVisible() && (await page.textContent('#mcBuscarVariantes')).trim() === 'Apilar')
  await page.click('#mcBuscarAbrirFiltros')
  await page.waitForTimeout(500)
  const h = await hoja(page, 'mcBuscarPanelFiltros')
  comun('Buscar', h)
  check('Buscar: Serie y Expansión detrás de la raya', h.titulos.includes('| Serie') && h.titulos.includes('| Expansión'), h.titulos.join(' · '))
  check('Buscar: el Tipo va como símbolo', (await page.locator('#mcBuscarGrupos [data-hoja="energia"] img.mc-energia').count()) >= 2)
  const res = () => page.$$eval('#mcBuscarResultados a[data-carta]', (as) => as.map((a) => a.dataset.carta))
  const antes = await res()
  await page.selectOption('#mcBuscarSet', 'base1')
  await page.waitForTimeout(500)
  const despues = await res()
  check('Buscar: la expansión de la hoja filtra', antes.length === 8 && despues.length === 2 && despues.every((id) => id.startsWith('base1')), `${antes.length} → ${despues.join()}`)
  check('  …la chapa de «Filtros» la cuenta y «Ver» dice cuántas', (await page.textContent('#mcBuscarFiltrosCuenta')).trim() === '1' && (await page.textContent('#mcBuscarFiltrosVer')).trim() === 'Ver 2 cartas', await page.textContent('#mcBuscarFiltrosVer'))
  await page.click('#mcBuscarFiltrosLimpiar')
  await page.waitForTimeout(1500)
  check('Buscar: «Limpiar» quita también la expansión', (await res()).length === 8 && (await page.inputValue('#mcBuscarSet')) === '', (await res()).length)
  check('sin errores (Buscar)', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
