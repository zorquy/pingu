// Tanda 1087 — la tabla del Stock en el PC a siete columnas (el idioma y el
// estado debajo del nombre; los días y si se ve, al final y en pequeño), que
// cabe en un portátil de 1.280 sin deslizarse; los filtros con cuatro grupos
// abiertos y lo demás en «Más filtros» (que se abre solo si hay alguno suyo
// puesto, y dice cuántos); y con los enlaces arriba, sin las pestañas de
// /tienda repetidas. En el móvil, cada línea sigue siendo su tarjeta.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', rareza: 'Common', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 50, precio: 95, cm: 90, visible: true, ubicacion: 'Vitrina', entro_el: hace(3) },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', rareza: 'Common', idioma: 'en', estado: 'EX', variante: 'normal', unidades: 1, coste: 10, precio: 20, cm: 22, visible: false, entro_el: hace(120) },
]
const b = await chromium.launch()
async function abrir({ ancho = 1280, movil = false, ruta = '/tienda.html?ver=stock' } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: ancho, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2' }] }
    window.__FAKE_CARTAS__ = [{ id: 'carta-0', set_id: 'set-0', market: 'WEST', local_id: '0', name: 'Pikachu ex' }, { id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Mew ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: 2, en_stock: 2, sumas: {}, facetas: { catalogo: { WEST: 2 }, sets: { 'set-0': 2 }, idioma: { es: 1, en: 1 }, estado: { NM: 1, EX: 1 }, rareza: { Common: 2 }, ubicacion: { Vitrina: 1 } }, filas: d.FILAS },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { FILAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const cabeceras = (p) => p.$$eval('.tds-tabla thead th', (ths) => ths.filter((t) => getComputedStyle(t).display !== 'none').map((t) => t.textContent.trim()))

console.log('── La tabla en un portátil ──')
{
  const { p, ctx, errs } = await abrir()
  const cab = await cabeceras(p)
  check('siete columnas: Carta, Uds., Coste, Tu precio, Cardmarket, Margen y la de las marcas', !errs.length && cab.length === 7 && cab.slice(0, 6).join('|') === 'Carta|Uds.|Coste|Tu precio|Cardmarket|Margen', cab.join('|') || errs.join(' | '))
  check('  …y cabe sin deslizarse', await p.evaluate(() => { const c = document.querySelector('.tds-tabla-caja'); return c.scrollWidth <= c.clientWidth }))
  check('el idioma y el estado, debajo del nombre', /EN\s*EX/.test(await p.textContent('[data-fila="st-1"] .tds-meta')) && (await p.locator('[data-fila="st-1"] .tds-meta .pv-bandera').count()) === 1)
  check('los días en pequeño; más de 90, en rojo y con su reloj; y la oculta, dicho', /3 d/.test(await p.textContent('[data-fila="st-0"] .tds-c-marcas')) && /Vitrina/.test(await p.textContent('[data-fila="st-0"] .tds-c-marcas')) && (await p.locator('[data-fila="st-1"] .tds-dias.tds-rojo svg').count()) === 1 && /Oculta/.test(await p.textContent('[data-fila="st-1"] .tds-c-marcas')))
  check('sin las pestañas de /tienda (los enlaces de arriba ya son las secciones)', (await p.isHidden('#tdPestanas')) && (await p.isVisible('.nav-links a[data-ver="stock"]')))
  const grupos = await p.$$eval('.tds-filtros > .tds-grupo > h3, .tds-filtros > .tds-mas-filtros > summary', (xs) => xs.map((x) => x.textContent.trim()))
  check('filtros: cuatro abiertos y «Más filtros»', grupos.join('|') === 'Catálogo|Expansión|Idioma|Estado|Más filtros', grupos.join('|'))
  check('  …plegado si no hay ninguno suyo puesto', (await p.locator('.tds-mas-filtros').getAttribute('open')) === null)
  await p.click('.tds-mas-filtros > summary')
  await p.click('[data-filtro="margen"][data-valor="pierdes"]'); await p.waitForTimeout(500)
  await p.click('[data-filtro="dias"][data-valor="90+"]'); await p.waitForTimeout(500)
  check('  …con dos suyos puestos, abierto y diciendo cuántos', (await p.locator('.tds-mas-filtros').getAttribute('open')) !== null && (await p.textContent('.tds-mas-filtros > summary em')) === '2')
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ ancho: 1100 })
  check('en un PC estrecho (el menú plegado arriba), las pestañas se quedan', await p.isVisible('#tdPestanas'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ movil: true })
  check('en el móvil, cada línea su tarjeta, con su idioma y su estado de siempre', (await p.isVisible('[data-fila="st-0"] .tds-c-idioma')) && (await p.isHidden('[data-fila="st-0"] .tds-meta')) && (await p.isHidden('[data-fila="st-0"] .tds-c-marcas')) && (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
