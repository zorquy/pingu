// Tanda 1088 — Ventas y Escaparate más limpios: en Ventas, los mandos son una
// fila (periodo y dónde en un desplegable, la lupa que abre la búsqueda en
// el móvil y Exportar) y cada venta es una fila que abre su hoja con el
// recibo y Deshacer; en el Escaparate, el QR al lado del enlace y cuatro
// botones con icono, Compartir incluido, sin tocar el cartel impreso.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const ahora = Date.now()
const STOCK = { total: 3, en_stock: 3, sumas: { unidades: 4, coste: 0, precio: 0, cm: 0, sin_coste: 0, sin_precio: 1 }, facetas: {}, filas: [
  { id: 's1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 125, precio: 179, cm: 170, visible: true, entro_el: new Date().toISOString() },
  { id: 's2', card_id: 'carta-2', market: 'WEST', nombre: 'Umbreon VMAX', set_id: 'set-0', numero: '215', idioma: 'en', estado: 'EX', variante: 'reverse', unidades: 1, coste: null, precio: 95, cm: 90, visible: true, entro_el: new Date().toISOString() },
  { id: 's3', card_id: 'carta-3', market: 'WEST', nombre: 'Pidgey', set_id: 'set-0', numero: '10', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 0.1, precio: null, cm: 0.2, visible: true, entro_el: new Date().toISOString() },
] }
const VENTAS = {
  total: 3, tickets: 3,
  sumas: { unidades: 3, importe: 363.95, coste: 248, importe_con_coste: 363.95, beneficio: 115.95, sin_coste: 0 },
  por_donde: { mostrador: 268.95, cardmarket: 95 },
  filas: [
    { id: 'v1', ticket: 'tk1', stock_id: 's1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 179, coste: 125, donde: 'mostrador', vendida_el: new Date(ahora - 6e4).toISOString() },
    { id: 'v2', ticket: 'tk2', stock_id: 's9', product_id: 501, market: 'WEST', nombre: 'ETB Prismatic Evolutions', idioma: 'en', estado: 'sellado', variante: 'normal', unidades: 1, precio: 89.95, coste: 65, donde: 'mostrador', vendida_el: new Date(ahora - 12e4).toISOString() },
    { id: 'v3', ticket: 'tk3', stock_id: 's2', card_id: 'carta-2', market: 'WEST', nombre: 'Umbreon VMAX', set_id: 'set-0', numero: '215', idioma: 'en', estado: 'EX', variante: 'reverse', unidades: 1, precio: 95, coste: 58, donde: 'cardmarket', vendida_el: new Date(ahora - 30 * 36e5).toISOString() },
  ],
}
const VENDIDA = { ticket: 'tk9', lineas: 1, total: 340, beneficio: 90, sin_coste: 0 }
const b = await chromium.launch()
async function abrir(ruta, { movil = false, rpc = {}, errores = {}, tema = 'light' } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1500, height: 950 }, acceptDownloads: true })
  await ctx.addInitScript(([r, e, t]) => {
    if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('pokedoc-theme', t) }
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1' }] }
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = r
    window.__RPC_ERRORES__ = e
    window.__COMPARTIDO__ = []
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__COMPARTIDO__.push(d) } })
  }, [{ tienda_stock_lista: STOCK, tienda_ventas_lista: VENTAS, tienda_vender: VENDIDA, tienda_deshacer_venta: { borradas: 1, devueltas: 1 }, ...rpc }, errores, tema])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)


console.log('── 1. Ventas: una fila de mandos ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ventas', { movil: true })
  check('sin errores', !errs.length, errs.join(' | '))
  const fila = await p.evaluate(() => {
    const vs = [...document.querySelectorAll('.tdvt-arriba > *')].filter((e) => e.getBoundingClientRect().width > 0)
    const tops = new Set(vs.map((e) => Math.round(e.getBoundingClientRect().top)))
    return { n: vs.length, filas: tops.size, ancho: document.documentElement.scrollWidth }
  })
  check('en el móvil, periodo, dónde, lupa y exportar caben en UNA fila', fila.filas === 1 && fila.n === 4 && fila.ancho <= 390, JSON.stringify(fila))
  check('la búsqueda va escondida tras la lupa', !(await p.isVisible('[data-tdvt-q]')))
  await p.tap('[data-tdvt="lupa"]'); await p.waitForTimeout(200)
  check('  …que la abre y le pone el foco', (await p.isVisible('[data-tdvt-q]')) && (await p.evaluate(() => document.activeElement?.matches('[data-tdvt-q]'))) && (await p.getAttribute('[data-tdvt="lupa"]', 'aria-expanded')) === 'true')
  const alto = await p.evaluate(() => Math.round(document.querySelector('.tdvt-fila').getBoundingClientRect().height))
  check('cada venta es una fila que se toca (≥ 44 px)', alto >= 44, alto)
  check('en la lista no hay Recibo ni Deshacer: van en la hoja', !(await p.locator('.tdvt-lista [data-recibo], .tdvt-lista [data-deshacer]').count()))
  await p.tap('[data-venta="v1"]'); await p.waitForTimeout(500)
  const hoja = await p.evaluate(() => { const r = document.querySelector('#tdvtHoja').getBoundingClientRect(); return { abajo: Math.round(innerHeight - r.bottom), ancho: Math.round(r.width) } })
  check('al tocarla, una hoja desde abajo', (await p.isVisible('#tdvtHoja[open]')) && hoja.abajo <= 1 && hoja.ancho >= 388, JSON.stringify(hoja))
  const texto = (await p.textContent('#tdvtHoja')).replace(/\s+/g, ' ')
  check('  …con lo vendido, el importe y lo que dejó', /Charizard ex/.test(texto) && /179,00 €/.test(texto) && /\+54,00 €/.test(texto), texto)
  await p.tap('#tdvtHoja [data-tdvt-cerrar]'); await p.waitForTimeout(300)
  check('  …y se cierra', !(await p.locator('#tdvtHoja[open]').count()))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ventas')
  const fila = await p.evaluate(() => new Set([...document.querySelectorAll('.tdvt-arriba > *')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().top))).size)
  check('en el PC, también en una fila y con la búsqueda a la vista', !errs.length && fila === 1 && (await p.isVisible('[data-tdvt-q]')), fila)
  check('«Dónde» es uno: todo o un sitio', (await p.$$eval('[data-tdvt-donde] option', (os) => os.map((o) => o.value))).join() === ',mostrador,cardmarket,evento,otro')
  await p.click('[data-venta="v3"]'); await p.waitForTimeout(400)
  check('en el PC la hoja es un pop-up centrado', await p.evaluate(() => { const r = document.querySelector('#tdvtHoja').getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 4 && r.top > 8 }))
  check('  …de la venta tocada', /Umbreon VMAX/.test(await p.textContent('#tdvtHoja')))
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  check('  …y Escape la cierra', !(await p.locator('#tdvtHoja[open]').count()))
  await ctx.close()
}

console.log('── 2. Escaparate: la tarjeta compacta ──')
for (const movil of [true, false]) {
  const { p, ctx, errs } = await abrir('/tienda.html?ver=escaparate', { movil })
  const donde = movil ? 'móvil' : 'PC'
  check(`${donde}: sin errores`, !errs.length, errs.join(' | '))
  const iconos = await p.$$eval('.td-esc-icono', (bs) => bs.filter((b) => b.getBoundingClientRect().width > 0).map((b) => ({ svg: !!b.querySelector('svg'), alto: Math.round(b.getBoundingClientRect().height), texto: b.textContent.trim() })))
  check(`${donde}: cuatro botones con su icono y su palabra`, iconos.length === 4 && iconos.every((i) => i.svg && i.alto >= 44 && i.texto), JSON.stringify(iconos))
  check(`${donde}: el enlace a la vista`, /pokedoc\.es\//.test(await p.textContent('#tdEnlace')))
  check(`${donde}: el QR se pinta`, !!(await p.$('#tdQr svg, #tdQr img, #tdQr canvas')))
  check(`${donde}: sin salirse de ancho`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  if (movil) {
    const r = await p.evaluate(() => { const q = document.querySelector('#tdQr').getBoundingClientRect(); const e = document.querySelector('#tdEnlace').getBoundingClientRect(); return { lado: e.left >= q.right - 1, arriba: q.top < 500 } })
    check('móvil: el QR al lado del enlace, arriba', r.lado && r.arriba, JSON.stringify(r))
  }
  await p.click('#tdCompartir'); await p.waitForTimeout(300)
  const comp = await p.evaluate(() => window.__COMPARTIDO__)
  check(`${donde}: Compartir pasa el enlace del escaparate`, comp.length === 1 && /^https:\/\/pokedoc\.es\//.test(comp[0].url), JSON.stringify(comp))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=escaparate')
  await p.evaluate(() => document.documentElement.classList.add('td-imprimiendo'))
  await p.emulateMedia({ media: 'print' })
  const r = await p.evaluate(() => ({ cartel: document.querySelector('#tdCartel').getBoundingClientRect().width, titulo: !!document.querySelector('.td-cartel-titulo')?.getBoundingClientRect().width, botones: [...document.querySelectorAll('.td-esc-icono')].some((b) => getComputedStyle(b).visibility === 'visible') }))
  check('al imprimir, el cartel entero y sin botones', r.cartel > 200 && r.titulo && !r.botones, JSON.stringify(r))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
