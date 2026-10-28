// Tanda 1077 y 1078 — el panel de una tienda más claro y su escaparate más
// visual (PINGU: «el perfil, ¿por qué se ve tan vertical?… puedes ancharlo;
// en móvil no»; «el escaparate debería ser el QR y todas las cartas que
// tengo»; «el panel, que sea de otra manera»). La cabecera con el saludo solo
// en el Panel; el Escaparate con el cartel y debajo el escaparate de verdad;
// el perfil público ancho en el PC, con sus datos como chapas; el stock con
// sus botones con icono y, en el móvil, cada línea como una tarjeta.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '1', rareza: 'Common', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 62, precio: 95, cm: 88.4, visible: true, entro_el: hace(12) },
  { id: 'st-2', card_id: 'carta-2', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '2', rareza: 'Common', idioma: 'en', estado: 'EX', variante: 'normal', unidades: 2, coste: 210, precio: 279, cm: 301.5, visible: true, entro_el: hace(34) },
]
const LISTA = { total: 2, en_stock: 2, sumas: { unidades: 3, coste: 272, precio: 374, cm: 389.9 }, facetas: { idioma: { es: 1, en: 1 }, sets: { 'set-0': 2 } }, filas: FILAS }
const ESCAPARATE = { total: 2, en_escaparate: 2, de_tu_lista: 0, precios: true, facetas: { idioma: { es: 1, en: 1 } }, filas: FILAS }
const TIENDA = { user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle Mayor 12', horario: 'L–S 10:30–20:30', web: 'rincon.es', instagram: 'el.rincon', precio_visible: true }
const HOY = { actual: { importe: 0, beneficio: null, coste: 0, unidades: 0, ventas: 0 }, anterior: { importe: 0, beneficio: null, coste: 0, unidades: 0, ventas: 0 }, serie: [], stock: { lineas: 2, unidades: 3, valor: 374, cm: 389.9 }, avisos: {}, demanda: [], visitas: { actual: 0, qr: 0, anterior: 0 } }
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', movil = false, ancho = 1500 } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: ancho, height: 950 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }; localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}') }
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [d.TIENDA] }
    window.__FAKE_CARTAS__ = [{ id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Pikachu ex' }, { id: 'carta-2', set_id: 'set-0', market: 'WEST', local_id: '2', name: 'Mew ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = { tienda_stock_lista: d.LISTA, tienda_escaparate: d.ESCAPARATE, tienda_hoy: d.HOY, tienda_ventas_lista: { total: 0, filas: [] } }
  }, { sesion, TIENDA, LISTA, ESCAPARATE, HOY })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const ancho = (p) => p.evaluate(() => document.documentElement.scrollWidth)

console.log('── 1. La cabecera, solo en el Panel ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  // Desde la 1085, «Tu escaparate» lleva a su pestaña (el QR y lo que ve la gente).
  check('en el Panel: el saludo, el nombre y «Tu escaparate»', !errs.length && (await p.isVisible('.td-cab')) && /Buen|Hola/.test(await p.textContent('#tdSaludo')) && (await p.textContent('#tdVerEscaparate')).trim() === 'Tu escaparate' && (await p.getAttribute('#tdVerEscaparate', 'data-ver')) === 'escaparate', errs.join(' | '))
  await p.click('.lat-seccion-enlace[data-ver="stock"]'); await p.waitForTimeout(800)
  check('  …en el Stock no se repite', await p.isHidden('.td-cab'))
  await ctx.close()
}

console.log('── 2. El stock: botones con icono, sin «Filtros» repetido en el PC ──')
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock')
  // Desde la 1086, en dos menús: «+ Añadir» (buscar, la Colección, importar) y «⋯».
  check('los mandos con su icono: Añadir con su menú y «⋯»', (await p.locator('.tds-menu [role^="menuitem"] svg').count()) >= 6 && (await p.getAttribute('.tds-menu[data-menu="anadir"] a', 'href')) === '/cartas' && (await p.locator('.tds-menu[data-menu="anadir"] [data-tds="importar"]').count()) === 1)
  check('  …el botón «Filtros» no sale con el panel a la vista', await p.isHidden('.tds-ver-filtros'))
  check('  …y no se sale de ancho (con la lateral y los filtros)', (await ancho(p)) <= 1500, await ancho(p))
  check('la tabla, con la bandera del idioma', (await p.locator('.tds-c-idioma .pv-bandera').count()) === 2)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock', { movil: true })
  const r = await p.evaluate(() => { const tr = document.querySelector('.tds-tabla tbody tr'); return { display: getComputedStyle(tr).display, cabeza: getComputedStyle(document.querySelector('.tds-tabla thead')).display, coste: getComputedStyle(tr.querySelector('.tds-c-coste')).display } })
  check('en el móvil, cada línea es una tarjeta (sin cabecera de tabla ni coste)', r.display === 'grid' && r.cabeza === 'none' && r.coste === 'none', JSON.stringify(r))
  check('  …sin salirse de ancho', (await ancho(p)) <= 390, await ancho(p))
  await ctx.close()
}

console.log('── 3. El Escaparate: el cartel y lo que ve la gente ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=escaparate')
  check('sin errores, el cartel con su QR', !errs.length && (await p.locator('#tdQr svg').count()) === 1, errs.join(' | '))
  check('  …y debajo, el escaparate de verdad con sus cartas', /Así te ve la gente/.test(await p.textContent('.td-esc-titulo')) && (await p.locator('#tdEscaparatePrevia .pt-carta').count()) === 2)
  check('  …en previa: sin botones (ni «Mi panel») y sin contar la visita', (await p.locator('#tdEscaparatePrevia .pt-botones').count()) === 0 && !(await p.evaluate(() => (window.__RPCS__ || []).some((r) => r.nombre === 'tienda_contar_visita'))))
  await ctx.close()
}

console.log('── 4. El perfil de una tienda, ancho en el PC ──')
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=rincon', { sesion: 'user-1' })
  const r = await p.evaluate(() => ({ main: document.querySelector('main').className, pt: document.getElementById('perfilTienda').getBoundingClientRect().width }))
  check('sin errores, fuera la rejilla de dos columnas: ocupa el ancho', !errs.length && !/perfil-pagina/.test(r.main) && /pt-pagina/.test(r.main) && r.pt > 1000, JSON.stringify(r) + errs.join(' | '))
  check('  …la cabecera: logo, nombre, sus cifras y los botones en una banda', (await p.isVisible('.pt-cab .pt-logo')) && (await p.textContent('[data-pt-en-escaparate]')) === '2' && (await p.isVisible('.pt-botones')))
  const chapas = await p.$$eval('.pt-datos > div', (ds) => ds.map((d) => (d.querySelector('svg') ? '✓' : '·') + d.textContent.trim()))
  check('  …sus datos, cada uno con su icono', chapas.length === 4 && chapas.every((c) => c.startsWith('✓')), chapas.join(' | '))
  check('  …y la rejilla, a lo ancho (más de cinco por fila)', (await p.evaluate(() => getComputedStyle(document.querySelector('.pt-rejilla')).gridTemplateColumns.split(' ').length)) >= 5)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon', { sesion: 'user-1', movil: true })
  check('en el móvil: una columna, «Cómo llegar» como icono, sin salirse', (await p.evaluate(() => getComputedStyle(document.querySelector('.pt-cab')).gridTemplateColumns.split(' ').length)) === 1 && (await p.isHidden('.pt-llegar span')) && (await ancho(p)) <= 390, await ancho(p))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
