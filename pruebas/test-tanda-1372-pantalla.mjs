// Tanda 1372 — Cambios en una fila («Más mejoras», A; PINGU: «dale con lo
// recomendado»). El Mercado, La quiero, Las que doy y Cruces:
//   · el Mercado: buscar · Filtros · Seleccionar en una fila que cabe; la hoja
//     lleva Mostrar, Ordenar e Idioma, y elegir pinta Filtros en color con su
//     cuenta; Limpiar lo quita;
//   · La quiero: lista · + · Filtros · Seleccionar · ⋯ caben; «Todas · La dan
//     · Nadie» va en la hoja y filtra;
//   · Las que doy: lo mismo con «La buscan»;
//   · Cruces: los tres chips caben sin salirse.
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
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
// Lo visible de una fila: a la misma altura y dentro de la pantalla.
const medir = (page, sel) => page.evaluate((sel) => {
  const fila = [...document.querySelectorAll(sel)].find((f) => f.getBoundingClientRect().width > 0)
  if (!fila) return null
  const vis = [...fila.querySelectorAll(':scope > *, :scope > .mc-mandos > *')].filter((e) => !e.classList.contains('mc-mandos') && e.getBoundingClientRect().width > 2 && getComputedStyle(e).display !== 'none')
  const rs = vis.map((e) => e.getBoundingClientRect())
  return { ids: vis.map((e) => e.id || String(e.className).split(' ')[0]), centros: rs.map((r) => Math.round(r.top + r.height / 2)), derecha: Math.round(Math.max(...rs.map((r) => r.right))), ancho: document.documentElement.clientWidth }
}, sel)
const unaFila = (m) => m && m.centros.length && Math.max(...m.centros) - Math.min(...m.centros) <= 4 && m.derecha <= m.ancho + 1
const vista = async (page, v) => { await page.click(`[data-deseos-vista="${v}"]:visible`); await page.waitForTimeout(1200) }

for (const movil of [true, false]) {
  const quien = movil ? 'móvil' : 'PC'
  // ── Mercado ──
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=mercado')
    const m = await medir(page, '#mcPanelMercado .mc-mercado-barra')
    check(`${quien} · Mercado: buscar · Filtros · Seleccionar en una fila que cabe`, unaFila(m) && m.ids.includes('mcMercadoAbrirFiltros') && m.ids.includes('mcMercadoSeleccionar'), JSON.stringify(m))
    check(`${quien} · Mercado: ni Idioma ni Orden ni «Lo que busco» en la barra`, !(await page.isVisible('#mcMercadoIdioma, #mcMercadoOrden')) && !(await page.$eval('.mc-mercado-barra', (f) => /Lo que busco|Idioma/.test(f.textContent))))
    await page.click('#mcMercadoAbrirFiltros')
    await page.waitForTimeout(400)
    const titulos = await page.$$eval('#mcMercadoHoja[open] .mc-grupo-filtro:not(.hidden) > h3', (hs) => hs.map((h) => h.textContent.trim()))
    check(`${quien} · Mercado: la hoja lleva Mostrar, Ordenar e Idioma`, titulos.join() === 'Mostrar,Ordenar,Idioma', titulos)
    check(`${quien} · Mercado: «Lo que busco» en Mostrar`, await page.isVisible('#mcMercadoHoja #mcMercadoMias'))
    await page.click('#mcMercadoHoja [data-hoja="orden"] [data-valor="caro"]')
    await page.waitForTimeout(500)
    await page.click('#mcMercadoHoja [data-hoja="idioma"] [data-valor="ja"]')
    await page.waitForTimeout(500)
    check(`${quien} · Mercado: Ordenar e Idioma mueven los de siempre`, (await page.$eval('#mcMercadoOrden', (s) => s.value)) === 'caro' && (await page.$eval('#mcMercadoIdioma', (s) => s.value)) === 'ja')
    await page.click('#mcMercadoHojaVer')
    await page.waitForTimeout(300)
    check(`${quien} · Mercado: Filtros en color y cuenta 2`, await page.$eval('#mcMercadoAbrirFiltros', (e) => e.classList.contains('mc-filtros-puestos') && e.querySelector('.mc-filtros-cuenta').textContent.trim() === '2') && !(await page.$('#mcMercadoHoja[open]')))
    await page.click('#mcMercadoAbrirFiltros')
    await page.waitForTimeout(300)
    await page.click('#mcMercadoHojaLimpiar')
    await page.waitForTimeout(600)
    check(`${quien} · Mercado: Limpiar lo deja como estaba`, (await page.$eval('#mcMercadoOrden', (s) => s.value)) === 'nuevo' && (await page.$eval('#mcMercadoIdioma', (s) => s.value)) === '' && !(await page.$eval('#mcMercadoAbrirFiltros', (e) => e.classList.contains('mc-filtros-puestos'))) && (await page.getAttribute('#mcMercadoHoja [data-hoja="orden"] [data-valor="nuevo"]', 'aria-checked')) === 'true')
    check(`${quien} · Mercado: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // ── La quiero y Las que doy ──
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=quiero')
    const m = await medir(page, '#mcQuieroBarra')
    check(`${quien} · La quiero: lista · Filtros · Seleccionar · ⋯ en una fila que cabe`, unaFila(m) && ['mcQuieroLista', 'mcQuieroFiltros', 'mcQuieroSeleccionar', 'mcQuieroMenu'].every((i) => m.ids.includes(i)), JSON.stringify(m))
    check(`${quien} · La quiero: sin «Todas · La dan · Nadie» en la barra`, (await page.$$('#mcQuieroQue, #mcQuieroBarra [data-quiero-filtro]')).length === 0)
    const antes = await page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (a) => a.length)
    await page.click('#mcQuieroFiltros')
    await page.waitForTimeout(400)
    const ops = await page.$$eval('#mcDeseosHoja[open] [data-hoja-valor]:not(.mc-panel-limpiar)', (bs) => bs.map((x) => x.dataset.hojaValor))
    check(`${quien} · La quiero: la hoja enseña Todas · Las que alguien da · Las que nadie da`, ops.join() === 'todas,dan,nadie', ops)
    await page.click('#mcDeseosHoja [data-hoja-valor="dan"]')
    await page.waitForTimeout(500)
    const despues = await page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (a) => a.length)
    const ver = (await page.textContent('#mcDeseosHojaVer')).trim()
    check(`${quien} · La quiero: «Las que alguien da» filtra y la hoja dice cuántas`, despues < antes && (ver === `Ver ${despues} ${despues === 1 ? 'carta' : 'cartas'}` || (despues === 0 && /Ninguna/.test(ver))), `${antes} → ${despues} · ${ver}`)
    await page.click('#mcDeseosHojaVer')
    await page.waitForTimeout(300)
    check(`${quien} · La quiero: Filtros en color con 1`, await page.$eval('#mcQuieroFiltros', (e) => e.classList.contains('mc-filtros-puestos') && e.querySelector('.mc-filtros-cuenta').textContent.trim() === '1'))
    await page.click('#mcQuieroFiltros')
    await page.waitForTimeout(300)
    await page.click('#mcDeseosHoja .mc-panel-limpiar')
    await page.waitForTimeout(500)
    await page.click('#mcDeseosHojaVer')
    check(`${quien} · La quiero: Limpiar vuelve a todas`, (await page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (a) => a.length)) === antes)
    // Las que doy
    await vista(page, 'doy')
    const d = await medir(page, '#mcDoyBarra')
    check(`${quien} · Las que doy: la fila cabe, con Filtros y sin chips sueltos`, unaFila(d) && d.ids.includes('mcDoyFiltros') && (await page.$$('#mcDoyQue')).length === 0, JSON.stringify(d))
    await page.click('#mcDoyFiltros')
    await page.waitForTimeout(400)
    const opsDoy = await page.$$eval('#mcDeseosHoja[open] [data-hoja-valor]:not(.mc-panel-limpiar)', (bs) => bs.map((x) => x.dataset.hojaValor))
    check(`${quien} · Las que doy: la hoja enseña Todas · Las que busca alguien · Las que no busca nadie`, opsDoy.join() === 'todas,buscan,nadie', opsDoy)
    await page.click('#mcDeseosHoja [data-hoja-valor="nadie"]')
    await page.waitForTimeout(600)
    check(`${quien} · Las que doy: elegir deja la opción puesta`, (await page.getAttribute('#mcDeseosHoja [data-hoja-valor="nadie"]', 'aria-pressed')) === 'true')
    await page.click('#mcDeseosHojaVer')
    check(`${quien} · La quiero / Las que doy: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // ── Cruces ──
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=cambios')
    const c = await page.evaluate(() => {
      const f = document.querySelector('.mc-cruces-filtros')
      if (!f) return null
      const rs = [...f.children].map((x) => x.getBoundingClientRect())
      return { n: rs.length, derecha: Math.round(Math.max(...rs.map((r) => r.right))), ancho: document.documentElement.clientWidth, alto: new Set(rs.map((r) => Math.round(r.top))).size }
    })
    check(`${quien} · Cruces: Todos · Perfectos · En curso caben en una fila`, c && c.n === 3 && c.alto === 1 && c.derecha <= c.ancho - 8, JSON.stringify(c))
    check(`${quien} · Cruces: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
