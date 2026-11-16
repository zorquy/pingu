// Tanda 1369 — Una fila, como Dex (PINGU: «lo hace todo en una fila…
// nosotros usamos demasiadas filas… una barra de búsqueda más pequeñita y que
// no se expanda»). En una expansión, en un Pokémon y en Buscar:
//   · buscador y mandos en UNA fila, que cabe entera en un iPhone (nada se
//     sale por la derecha) y en el PC;
//   · el catálogo, una bandera con flecha (el select a la vista, `data-cat`);
//   · Todas/Tengo/Faltan y el orden ya no están en la barra: son Mostrar y
//     Ordenar, los dos primeros grupos de la hoja de Filtros, y funcionan;
//   · Filtros se pinta en color (`.mc-filtros-puestos`) con algo puesto.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
async function abrir(movil, ruta) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|cdn\.jsdelivr|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return { ctx, page, errores }
}
// Lo visible de la fila: todo a la misma altura y dentro de la pantalla.
const medirFila = (page, sel) => page.evaluate((sel) => {
  const fila = document.querySelector(sel)
  if (!fila) return null
  const vis = [...fila.querySelectorAll('.mc-buscador, .mc-mandos > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' })
  const rs = vis.map((e) => e.getBoundingClientRect())
  const busc = fila.querySelector('.mc-buscador').getBoundingClientRect()
  return {
    n: vis.length,
    centros: rs.map((r) => Math.round(r.top + r.height / 2)),
    derecha: Math.max(...rs.map((r) => r.right)),
    ancho: document.documentElement.clientWidth,
    buscador: Math.round(busc.width),
    ids: vis.map((e) => e.id || String(e.className).split(' ')[0]),
  }
}, sel)
const unaFila = (m) => m && Math.max(...m.centros) - Math.min(...m.centros) <= 4

for (const movil of [true, false]) {
  const quien = movil ? 'móvil' : 'PC'
  // ── Una expansión ──
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=album&set=sv08&catalogo=WEST')
    await page.waitForSelector('#mcAlbumBuscar', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const m = await medirFila(page, '.mc-album-busca')
    check(`${quien} · expansión: buscador y mandos en una fila`, unaFila(m), JSON.stringify(m))
    check(`${quien} · expansión: nada se sale por la derecha`, m && m.derecha <= m.ancho + 1, JSON.stringify(m))
    check(`${quien} · expansión: el buscador es pequeño (≤ 260) y se puede usar (≥ 96)`, m && m.buscador <= 261 && m.buscador >= 96, m?.buscador)
    check(`${quien} · expansión: Filtros y Seleccionar a la vista`, m && m.ids.includes('mcAlbumAbrirFiltros') && m.ids.includes('mcMarcarAbrir'), m?.ids)
    check(`${quien} · expansión: ni Todas/Tengo/Faltan ni el orden en la barra`, (await page.$$('#mcAlbumQue, #mcAlbumAbrirOrden, #mcAlbumHojaOrden')).length === 0)
    await page.click('#mcAlbumAbrirFiltros')
    await page.waitForTimeout(600)
    const titulos = await page.$$eval('#mcAlbumPanelFiltros .mc-panel-cuerpo > .mc-grupo-filtro:not(.hidden) > h3', (hs) => hs.slice(0, 2).map((h) => h.textContent.trim()))
    check(`${quien} · expansión: la hoja empieza por Mostrar y Ordenar`, titulos[0] === 'Mostrar' && titulos[1] === 'Ordenar', titulos)
    const contar = () => page.$$eval('#mcAlbum a[data-carta]', (a) => a.length).catch(() => -1)
    const antes = await contar()
    await page.click('#mcAlbumSoloFaltan')
    await page.waitForTimeout(500)
    const despues = await contar()
    check(`${quien} · expansión: «Las que me faltan» filtra`, despues >= 0 && despues < antes, `${antes} → ${despues}`)
    check(`${quien} · expansión: Filtros se pinta en color y cuenta 1`, await page.$eval('#mcAlbumAbrirFiltros', (e) => e.classList.contains('mc-filtros-puestos') && e.querySelector('.mc-filtros-cuenta').textContent.trim() === '1'))
    await page.click('#mcAlbumGrupoOrden [data-valor="nombre"]')
    await page.waitForTimeout(300)
    check(`${quien} · expansión: Ordenar se elige en la hoja`, (await page.$eval('#mcAlbumOrden', (s) => s.value)) === 'nombre')
    check(`${quien} · expansión: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // ── Un Pokémon ──
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=pokedex&dex=6')
    await page.waitForSelector('#pdxEspecieBuscar', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const m = await medirFila(page, '#mcPokedexPanel .mc-una-fila')
    check(`${quien} · un Pokémon: una fila que cabe`, unaFila(m) && m.derecha <= m.ancho + 1, JSON.stringify(m))
    const cat = await page.$eval('#mcPokedexPanel .mc-una-fila select.mc-mercado', (s) => ({ cat: s.dataset.cat, ancho: s.nextElementSibling?.classList.contains('seg') ? s.nextElementSibling.getBoundingClientRect().width : 0 })).catch(() => null)
    check(`${quien} · un Pokémon: el catálogo a la vista (el slide de banderas desde la 1381)`, cat && cat.cat === 'occ' && cat.ancho > 40, JSON.stringify(cat))
    check(`${quien} · un Pokémon: Todas/Tengo/Faltan fuera de la barra`, (await page.$$('#pdxQue')).length === 0)
    await page.click('#pdxAbrirFiltros')
    await page.waitForTimeout(600)
    const primero = await page.$eval('#mcPdxGrupos > .mc-grupo-filtro > h3', (h) => h.textContent.trim()).catch(() => '')
    check(`${quien} · un Pokémon: la hoja empieza por Mostrar`, primero === 'Mostrar', primero)
    await page.click('#mcPdxGrupos [data-pdx-que="tengo"]')
    await page.waitForTimeout(500)
    check(`${quien} · un Pokémon: «Las que tengo» se queda puesto y Filtros en color`, (await page.$eval('#mcPdxGrupos [data-pdx-que="tengo"]', (e) => e.getAttribute('aria-checked'))) === 'true' && (await page.$eval('#pdxAbrirFiltros', (e) => e.classList.contains('mc-filtros-puestos'))))
    check(`${quien} · un Pokémon: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // ── Buscar ──
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=buscar&q=charizard')
    await page.waitForSelector('#mcBuscarTodo', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const m = await medirFila(page, '#mcBuscarBarra')
    check(`${quien} · Buscar: una fila que cabe`, unaFila(m) && m.derecha <= m.ancho + 1, JSON.stringify(m))
    check(`${quien} · Buscar: el orden ya no está en la barra`, (await page.$$('#mcBuscarAbrirOrden, #mcBuscarHojaOrden')).length === 0)
    await page.click('#mcBuscarAbrirFiltros')
    await page.waitForTimeout(600)
    const chips = await page.$$eval('#mcBuscarOrdenChips [data-borden]', (bs) => bs.map((x) => ({ id: x.dataset.borden, puesto: x.getAttribute('aria-pressed'), t: x.textContent })))
    const puesto = chips.find((c) => c.puesto === 'true')
    check(`${quien} · Buscar: Ordenar en la hoja, con el puesto y su flecha`, chips.length >= 3 && puesto && /[↑↓]$/.test(puesto.t), JSON.stringify(chips))
    if (puesto) {
      await page.click(`#mcBuscarOrdenChips [data-borden="${puesto.id}"]`)
      await page.waitForTimeout(400)
      const otra = await page.$eval(`#mcBuscarOrdenChips [data-borden="${puesto.id}"]`, (x) => x.textContent)
      check(`${quien} · Buscar: pulsar el puesto le da la vuelta`, otra.slice(-1) !== puesto.t.slice(-1), `${puesto.t} → ${otra}`)
    }
    check(`${quien} · Buscar: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
