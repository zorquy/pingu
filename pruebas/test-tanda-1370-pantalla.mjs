// Tanda 1370 — La Pokédex en una fila (la propuesta «Una fila, como Dex»;
// PINGU: «dale con lo recomendado», la A de las regiones):
//   · buscar · bandera · «Kanto ▾» · Filtros, en una fila que cabe en un iPhone;
//   · las regiones, en su hoja (con lo que llevas de cada una); elegir una
//     cambia la rejilla y el botón;
//   · Filtros: Mostrar (Todos / Los que tengo / Los que me faltan), Ordenar
//     (número, casi completos, los que más tienes, A–Z) y Tipo, y funcionan;
//   · un Pokémon se ordena desde su hoja (más nuevas / más antiguas / rareza /
//     nombre).
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
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|cdn\.jsdelivr|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"><rect width="68" height="56" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return { ctx, page, errores }
}
const especies = (page) => page.$$eval('#mcPokedexPanel [data-dex]', (bs) => bs.map((x) => Number(x.dataset.dex)))
const enHoja = async (page, sel) => {
  await page.click('#mcPdxAbrirFiltros')
  await page.waitForTimeout(300)
  await page.click(sel)
  await page.waitForTimeout(500)
  await page.click('#mcPdxFiltrosCerrar')
  await page.waitForTimeout(200)
}

for (const movil of [true, false]) {
  const quien = movil ? 'móvil' : 'PC'
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=pokedex')
    await page.waitForSelector('#mcPokedexPanel [data-dex]', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
    const fila = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('#mcPdxMandos .mc-buscador, #mcPdxMandos .mc-mandos > *')].filter((e) => e.getBoundingClientRect().width > 2)
      const rs = vis.map((e) => e.getBoundingClientRect())
      return { ids: vis.map((e) => e.id || String(e.className).split(' ')[0]), centros: rs.map((r) => Math.round(r.top + r.height / 2)), derecha: Math.max(...rs.map((r) => r.right)), ancho: document.documentElement.clientWidth, regiones: Boolean(document.querySelector('#mcPokedexPanel .pdx-regiones')) }
    })
    check(`${quien}: buscar · bandera · región · Filtros en una fila que cabe`, ['mcPdxRegionAbrir', 'mcPdxAbrirFiltros', 'mc-chapa-select'].every((i) => fila.ids.includes(i)) && Math.max(...fila.centros) - Math.min(...fila.centros) <= 4 && fila.derecha <= fila.ancho + 1, JSON.stringify(fila))
    check(`${quien}: sin la fila de regiones ni «Tengo» ni el desplegable de orden en la página`, !fila.regiones && !(await page.$('#mcPdxSoloMios, #mcPdxOrden')))
    check(`${quien}: el botón dice la región`, (await page.textContent('#mcPdxRegionRotulo')).trim() === 'Kanto')
    const kanto = await especies(page)
    // La región, en su hoja
    await page.click('#mcPdxRegionAbrir')
    await page.waitForTimeout(400)
    check(`${quien}: «Kanto ▾» abre las nueve regiones`, (await page.$$('#mcPdxRegionHoja[open] [data-pdx-region]')).length === 9)
    await page.click('#mcPdxRegionHoja [data-pdx-region="1"]')
    await page.waitForTimeout(500)
    const johto = await especies(page)
    check(`${quien}: elegir Johto cierra la hoja y cambia la rejilla y el botón`, !(await page.$('#mcPdxRegionHoja[open]')) && johto[0] === 152 && kanto[0] === 1 && (await page.textContent('#mcPdxRegionRotulo')).trim() === 'Johto', `${kanto[0]} → ${johto[0]}`)
    // Filtros
    await page.click('#mcPdxAbrirFiltros')
    await page.waitForTimeout(400)
    const titulos = await page.$$eval('#mcPdxGrupos > .mc-grupo-filtro > h3', (hs) => hs.map((h) => h.textContent.trim()))
    check(`${quien}: la hoja lleva Mostrar, Ordenar y Tipo`, titulos.join() === 'Mostrar,Ordenar,Tipo', titulos)
    await page.click('#mcPdxFiltrosCerrar')
    await enHoja(page, '[data-pdxl-mostrar="tengo"]')
    const tengo = await page.$$eval('#mcPokedexPanel [data-dex]', (bs) => bs.every((x) => x.classList.contains('tengo')) && bs.length)
    check(`${quien}: «Los que tengo» deja solo los tuyos, y Filtros en color`, tengo > 0 && (await page.$eval('#mcPdxAbrirFiltros', (e) => e.classList.contains('mc-filtros-puestos'))), tengo)
    await enHoja(page, '[data-pdxl-mostrar="faltan"]')
    const faltan = await page.$$eval('#mcPokedexPanel [data-dex]', (bs) => bs.every((x) => !x.classList.contains('tengo')) && bs.length)
    check(`${quien}: «Los que me faltan» deja solo los que no tienes`, faltan > 0, faltan)
    await enHoja(page, '[data-pdxl-mostrar="todos"]')
    await enHoja(page, '[data-pdxl-orden="az"]')
    const az = await page.$$eval('#mcPokedexPanel [data-dex]', (bs) => bs.map((x) => x.getAttribute('title')))
    const ordenada = [...az].sort((x, y) => x.localeCompare(y, 'es'))
    check(`${quien}: «De la A a la Z» ordena por nombre y esconde la región`, az.length > 1000 && az.join() === ordenada.join() && (await page.$eval('#mcPdxRegionAbrir', (e) => e.classList.contains('hidden'))), az.slice(0, 3))
    await enHoja(page, '[data-pdxl-tipo="R"]')
    const fuego = await page.$$eval('#mcPokedexPanel [data-dex]', (bs) => bs.map((x) => Number(x.dataset.dex)))
    check(`${quien}: Tipo Fuego deja los de fuego (Charmander, Charizard…)`, fuego.includes(4) && fuego.includes(6) && !fuego.includes(1) && fuego.length < 200, fuego.slice(0, 6))
    await enHoja(page, '[data-pdxl-orden="mas"]')
    const mas = await especies(page)
    check(`${quien}: «Los que más tienes» con fuego: los tuyos, el que más primero`, mas.length >= 1 && mas.includes(6), mas)
    check(`${quien}: sin errores (lista)`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // Un Pokémon, ordenado desde su hoja
  {
    const { ctx, page, errores } = await abrir(movil, '/mi-coleccion?ver=pokedex&dex=6')
    await page.waitForSelector('#pdxAbrirFiltros', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1200)
    await page.click('#pdxAbrirFiltros')
    await page.waitForTimeout(400)
    const ordenes = await page.$$eval('#mcPdxGrupos [data-pdx-orden]', (bs) => bs.map((x) => `${x.dataset.pdxOrden}:${x.getAttribute('aria-checked')}`))
    check(`${quien}: un Pokémon se ordena (más nuevas, más antiguas, rareza, nombre)`, ordenes.join() === 'nuevas:true,antiguas:false,rareza:false,nombre:false', ordenes)
    await page.click('#mcPdxGrupos [data-pdx-orden="antiguas"]')
    await page.waitForTimeout(400)
    check(`${quien}: elegir «Más antiguas» se queda puesto`, (await page.getAttribute('#mcPdxGrupos [data-pdx-orden="antiguas"]', 'aria-checked')) === 'true')
    check(`${quien}: sin errores (un Pokémon)`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
