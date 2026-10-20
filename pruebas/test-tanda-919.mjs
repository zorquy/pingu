// Tanda 919 — La cabecera de una expansión, más sencilla (la parte 4 de la
// propuesta «PokeDoc más sencillo», aprobada por PINGU).
//   1. En el móvil, una fila: volver (un icono), el nombre y «⋯».
//   2. Una barra de progreso con «4 de 18 · 22 %» y lo que vale lo tuyo, en
//      vez del carrusel de tres tarjetas con sus puntos.
//   3. El detalle del set (completo, maestro…) y lo que vale lo tuyo, dentro
//      del «⋯».
//   4. El buscador con un solo botón de filtros al lado: Archivador y
//      Variantes juntas entran en la hoja de filtros, arriba, y siguen
//      funcionando desde ahí.
//   5. En el PC, la línea de debajo del título sigue diciéndolo.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('── 0. Lo estático ──')
{
  const html = readFileSync(join(RAIZ, 'mi-coleccion.html'), 'utf8')
  const panel = html.slice(html.indexOf('id="mcAlbumPanelFiltros"'), html.indexOf('id="mcAlbumFiltrosVer"'))
  // La 927 (Dex) los sacó otra vez a la fila del buscador: lo comprueba la 927.
  check('la vista y Apilar ya no viven dentro de la hoja de filtros (927)', !/id="mcAlbumVista"/.test(panel) && !/id="mcVistaVariantes"/.test(panel))
  check('  …y el buscador y «Filtros» van en una fila', /<div class="mc-album-busca">[\s\S]*id="mcAlbumBuscar"[\s\S]*id="mcAlbumAbrirFiltros"/.test(html))
  check('las cifras del set van dentro del «⋯»', /id="mcAlbumMenu"[\s\S]{0,1200}id="mcAlbumCifras"/.test(html))
  const js = readFileSync(join(RAIZ, 'js/mi-coleccion.js'), 'utf8')
  check('la expansión ya no pinta el carrusel de tarjetas', !/diapoHtml\('Conjunto completo'/.test(js) && /mc-avance-barra/.test(js))
  check('cartas.html sale del generador con lo mismo', /id="mcAlbumCifras"/.test(readFileSync(join(RAIZ, 'cartas.html'), 'utf8')))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 18, card_count_total: 18 }]
  window.__FAKE_CARTAS__ = Array.from({ length: 18 }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', category: 'Pokemon', dex_ids: [i + 1], variants: { normal: true, reverse: i < 10 }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }))
  window.__FAKE_PRECIOS__ = Array.from({ length: 18 }, (_, i) => ({ card_id: `sv8-${i + 1}`, cm_id_product: 100 + i, cm_low_es: 0.5 + i * 3, checked_at: new Date().toISOString() }))
  window.__FAKE_COLECCION__ = [1, 2, 5, 17].map((n) => ({ id: `l${n}`, user_id: 'user-1', card_id: `sv8-${n}`, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: n === 2 ? 2 : 1 }))
}
async function abrir({ movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1440, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('#mcAlbum .mc-bolsillo, #mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  return { page, ctx, errores }
}

console.log('── 1–4. En el móvil ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const r = (e) => e && e.getBoundingClientRect()
    const volver = document.querySelector('#mcAlbumMigas .mc-miga')
    const titulo = document.getElementById('mcAlbumTitulo')
    const menu = document.querySelector('#mcAlbumMenu > summary')
    const busca = document.getElementById('mcAlbumBuscar')
    const filtros = document.getElementById('mcAlbumAbrirFiltros')
    const centro = (e) => r(e).top + r(e).height / 2
    return {
      fila: [volver, titulo, menu].every(Boolean) && Math.abs(centro(volver) - centro(titulo)) < 16 && Math.abs(centro(menu) - centro(titulo)) < 16,
      volver: volver && { ancho: Math.round(r(volver).width), alto: Math.round(r(volver).height), nombre: volver.textContent.trim() },
      // En el móvil, desde la 927, el buscador va encima y los mandos debajo.
      filtrosAlLado: busca && filtros && r(filtros).top >= r(busca).bottom - 1,
      vistaEnFila: Math.abs(centro(document.getElementById('mcAlbumVista')) - centro(filtros)) < 12,
      linea: (document.querySelector('#mcAlbumProgreso .mc-avance-linea')?.textContent || '').replace(/\s+/g, ' ').trim(),
      barra: document.querySelector('#mcAlbumProgreso .mc-avance-barra')?.getAttribute('aria-valuenow'),
      relleno: document.querySelector('#mcAlbumProgreso .mc-avance-barra i')?.style.getPropertyValue('--ancho'),
      carrusel: document.querySelectorAll('#mcAlbumProgreso .mc-diapo, #mcAlbumProgreso .mc-puntos').length,
    }
  })
  check('una fila: volver, el nombre y «⋯»', r.fila, JSON.stringify(r))
  check('  …volver es un icono de 44 que sigue diciendo adónde (para quien no ve)', r.volver && r.volver.ancho >= 44 && r.volver.ancho <= 52 && r.volver.alto >= 44 && /Expansiones/.test(r.volver.nombre), JSON.stringify(r.volver))
  check('el buscador encima y «Filtros» con la vista debajo, en una fila (927)', r.filtrosAlLado && r.vistaEnFila, JSON.stringify(r))
  check('una barra de progreso: «4 de 18 · 22 %» y lo que vale lo tuyo', /^4 de 18 · 22 %/.test(r.linea) && /€/.test(r.linea) && r.barra === '22' && r.relleno === '22%', JSON.stringify(r))
  check('  …y sin el carrusel ni sus puntos', r.carrusel === 0, String(r.carrusel))

  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(400)
  const cifras = limpio(await page.locator('#mcAlbumCifras').innerText())
  check('el «⋯» lleva el set completo, el maestro y lo que vale lo tuyo', /Set completo\s*4 de 18/.test(cifras) && /Set maestro\s*4 de 28/.test(cifras) && /Lo tuyo vale/.test(cifras), cifras)
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(300)

  // «Apilar» (927, antes «Variantes juntas»): en la barra, y separa.
  const antes = await page.evaluate(() => document.querySelectorAll('#mcAlbum .mc-bolsillo').length)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(800)
  const tras = await page.evaluate(() => ({ pulsado: document.getElementById('mcVistaVariantes').getAttribute('aria-pressed'), cuantas: document.querySelectorAll('#mcAlbum .mc-bolsillo').length }))
  check('  …y Apilar sigue funcionando: quitado, separa las versiones', tras.pulsado === 'false' && tras.cuantas > antes, JSON.stringify({ antes, tras }))
  await page.click('#mcAlbumVista')
  await page.waitForTimeout(500)
  check('  …y la vista abre su hoja', await page.evaluate(() => document.getElementById('mcAlbumVistaHoja')?.open === true))
  await ctx.close()
}

console.log('── 5. En el PC ──')
{
  const { page, ctx, errores } = await abrir({ movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => ({
    linea: (document.getElementById('mcAlbumLinea')?.textContent || '').trim(),
    progreso: getComputedStyle(document.getElementById('mcAlbumProgreso')).display,
    volver: (document.querySelector('#mcAlbumMigas .mc-miga')?.textContent || '').trim(),
    volverVisible: getComputedStyle(document.querySelector('#mcAlbumMigas .mc-miga')).fontSize !== '0px',
  }))
  check('la línea de debajo del título lo dice y la barra no se repite', /^4 de 18 · 22 %/.test(r.linea) && r.progreso === 'none', JSON.stringify(r))
  check('  …y «‹ Expansiones» sigue con su palabra', r.volver === 'Expansiones' && r.volverVisible, JSON.stringify(r))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
