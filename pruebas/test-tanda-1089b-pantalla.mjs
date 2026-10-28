// Tanda 1089b — dos fallos que vio PINGU en su iPhone con la tienda de prueba:
// (1) el botón Vender del centro de la barra dejaba la pantalla gris sin hoja:
// en Safari, un hijo `flex: 1` de un diálogo en columna sin alto se queda a
// cero; ahora el diálogo es un bloque y la columna es su caja, con el tope de
// alto heredado (Vender, el recibo y la hoja de una venta). (2) Al moverse
// por la barra de abajo se veía un momento la barra de una persona antes que
// la de la tienda: con la marca `pd-tienda`, la cabecera la esconde hasta que
// llega la suya.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const VENTAS = { total: 1, tickets: 1, sumas: { unidades: 1, importe: 179, coste: 125, importe_con_coste: 179, beneficio: 54, sin_coste: 0 }, por_donde: { mostrador: 179 }, filas: [
  { id: 'v1', ticket: 'tk1', stock_id: 's1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 179, coste: 125, donde: 'mostrador', vendida_el: new Date().toISOString() },
] }
const b = await chromium.launch()
async function abrir(ruta, { tienda = true, marca = tienda, retrasarApp = 0 } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript(([t, m, VENTAS]) => {
    if (!sessionStorage.getItem('ya')) {
      sessionStorage.setItem('ya', '1')
      localStorage.setItem('pokedoc-theme', 'dark')
      if (m) localStorage.setItem('pd-tienda', JSON.stringify({ u: 'prueba', id: 'user-2' }))
    }
    window.__FAKE_SESSION__ = 'user-2'
    if (t) window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1' }], tienda_ventas: VENTAS.filas.map((f) => ({ ...f, tienda_id: 'user-2', created_at: f.vendida_el })) }
    window.__FAKE_CARTAS__ = [{ id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '199', name: 'Charizard ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = { tienda_ventas_lista: VENTAS, tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] }, tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} } }
  }, [tienda, marca, VENTAS])
  let soltar
  const espera = new Promise((r) => { soltar = r })
  if (retrasarApp) await ctx.route(/\/js\/app\.js/, async (r) => { await espera; r.continue() })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: retrasarApp ? 'commit' : 'domcontentloaded' })
  if (!retrasarApp) await p.waitForTimeout(2200)
  return { p, ctx, errs, soltar }
}

console.log('── 1. Las hojas de la tienda tienen alto ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock')
  check('sin errores', !errs.length, errs.join(' | '))
  await p.tap('.bm a.bm-vender'); await p.waitForTimeout(900)
  const r = await p.evaluate(() => {
    const d = document.querySelector('.tdv'); const c = d.querySelector('.tdv-caja')
    return { display: getComputedStyle(d).display, alto: Math.round(d.getBoundingClientRect().height), caja: Math.round(c.getBoundingClientRect().height), busca: !!d.querySelector('#tdvBusca').getBoundingClientRect().height, abajo: Math.round(innerHeight - d.getBoundingClientRect().bottom) }
  })
  check('Vender: la hoja es un bloque (no una columna flex que Safari aplasta)', r.display === 'block', JSON.stringify(r))
  check('  …con alto, su buscador a la vista y pegada abajo', r.alto > 200 && r.caja > 200 && r.busca && r.abajo <= 1, JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=ventas')
  await p.tap('[data-venta="v1"]'); await p.waitForTimeout(500)
  const r = await p.evaluate(() => { const d = document.querySelector('#tdvtHoja'); return { display: getComputedStyle(d).display, alto: Math.round(d.getBoundingClientRect().height) } })
  check('la hoja de una venta, igual', r.display === 'block' && r.alto > 150, JSON.stringify(r))
  await p.tap('#tdvtHoja [data-recibo]'); await p.waitForTimeout(2000)
  const s = await p.evaluate(() => { const d = document.querySelector('dialog.tdr'); return { display: getComputedStyle(d).display, alto: Math.round(d.getBoundingClientRect().height), img: Math.round(d.querySelector('.tdr-vista').getBoundingClientRect().height) } })
  check('  …y el recibo, con su imagen', s.display === 'block' && s.alto > 200 && s.img > 100, JSON.stringify(s))
  await ctx.close()
}

console.log('── 2. La barra de abajo, sin la de una persona ──')
{
  const { p, ctx, soltar } = await abrir('/mensajes.html', { retrasarApp: true })
  await p.waitForSelector('.bm a', { state: 'attached' })
  await p.waitForTimeout(400)
  const antes = await p.evaluate(() => ({ marca: document.documentElement.classList.contains('pd-tienda'), visibles: [...document.querySelectorAll('.bm a')].filter((a) => getComputedStyle(a).visibility === 'visible').length, enlaces: [...document.querySelectorAll('.nav-links a')].filter((a) => getComputedStyle(a).visibility === 'visible' && a.getBoundingClientRect().width).length }))
  check('con la marca de tienda, antes de que llegue el JS: ni un botón de persona a la vista', antes.marca && antes.visibles === 0 && antes.enlaces === 0, JSON.stringify(antes))
  soltar(); await p.waitForTimeout(2500)
  const despues = await p.evaluate(() => [...document.querySelectorAll('.bm a')].filter((a) => getComputedStyle(a).visibility === 'visible').map((a) => a.textContent.trim()))
  check('  …y luego, la de la tienda', despues.join() === 'Panel,Colección,Vender,Stock,Mensajes', despues.join())
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/foro.html', { tienda: false })
  const r = await p.evaluate(() => ({ marca: document.documentElement.classList.contains('pd-tienda'), visibles: [...document.querySelectorAll('.bm a')].filter((a) => getComputedStyle(a).visibility === 'visible').length }))
  check('una persona: sin marca y con su barra entera', !r.marca && r.visibles === 5, JSON.stringify(r))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
