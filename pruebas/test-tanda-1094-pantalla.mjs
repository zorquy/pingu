// Tanda 1094 — el cierre del mes: lo puro (los meses, el rango del mes, las
// cuentas por día, por dónde y lo más vendido) y en el navegador, desde Ventas
// (el botón de exportar es un menú): pide el mes entero, enseña lo vendido, lo
// que costó, lo que dejó y lo comprado, y baja el PDF A4 y los CSV del mes.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Desde la 1086, «Seleccionar» está en «⋯» y la barra de abajo lo apaga con «Hecho».
const seleccionar = async (p) => ((await p.isVisible('.tds-sel')) ? p.click('.tds-sel-fin') : (await p.click('[data-tds-menu="mas"]'), p.click('.tds-menu [data-tds="seleccionar"]')))
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
const COMPRAS = { total: 1, tickets: 1, sumas: {}, filas: [{ id: 'c1', ticket: 'tc1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 40, cm: 80, cliente: 'Ane', comprada_el: new Date().toISOString() }] }
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
    window.__TEXTOS__ = []
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__TEXTOS__.push(String(t)); return fill.call(this, t, ...r) }
  }, [{ tienda_stock_lista: STOCK, tienda_ventas_lista: VENTAS, tienda_vender: VENDIDA, tienda_deshacer_venta: { borradas: 1, devueltas: 1 }, tienda_compras_lista: COMPRAS, ...rpc }, errores, tema])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  const ms = P.mesesDeCierre(new Date(2026, 0, 15), 3)
  check('los meses: este y los de antes, cruzando el año', ms.map((m) => m.clave).join() === '2026-01,2025-12,2025-11' && /enero de 2026/.test(ms[0].nombre))
  const r = P.rangoDeMes('2024-02')
  check('el rango de un mes (febrero bisiesto: 29 días)', r.dias === 29 && new Date(r.desde).getDate() === 1 && new Date(r.hasta).getMonth() === 2)
  const V = [
    { ticket: 't1', card_id: 'a', nombre: 'A', unidades: 2, precio: 10, coste: 4, donde: 'mostrador', vendida_el: new Date(2026, 9, 3, 12).toISOString() },
    { ticket: 't1', card_id: 'b', nombre: 'B', unidades: 1, precio: 50, coste: null, donde: 'mostrador', vendida_el: new Date(2026, 9, 3, 12).toISOString() },
    { ticket: 't2', card_id: 'a', nombre: 'A', unidades: 1, precio: 12, coste: 4, donde: 'cardmarket', vendida_el: new Date(2026, 9, 31, 22).toISOString() },
  ]
  const c = P.cierreDelMes(V, [{ ticket: 'c1', coste: 5, unidades: 3 }], '2026-10')
  check('vendido 82, coste 12 (solo lo que tiene), beneficio 20 y la de sin coste fuera', c.importe === 82 && c.coste === 12 && c.beneficio === 20 && c.sinCoste === 1 && c.margen === 167 && c.ventas === 2 && c.unidades === 4, JSON.stringify(c))
  check('cada día (el 3: 70, el 31: 12) y por dónde (ventas = tickets)', c.porDia.length === 31 && c.porDia[2].importe === 70 && c.porDia[30].importe === 12 && c.porDonde.mostrador.ventas === 1 && c.porDonde.mostrador.importe === 70)
  check('lo más vendido, por importe, juntando la misma carta', c.top[0].nombre === 'B' && c.top[1].nombre === 'A' && c.top[1].unidades === 3 && c.top[1].importe === 32)
  check('lo comprado: 15 € en una compra', c.comprado === 15 && c.compras === 1 && c.unidadesCompradas === 3)
}

console.log('── En Ventas ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ventas')
  await p.click('[data-tdvt="menu"]')
  check('exportar es un menú: el CSV y el cierre', (await p.isVisible('[data-tdvt-menu]')) && /Cierre del mes/.test(await p.textContent('[data-tdvt-menu]')))
  await p.keyboard.press('Escape')
  check('  …Escape lo cierra', !(await p.isVisible('[data-tdvt-menu]')))
  await p.click('[data-tdvt="menu"]'); await p.click('[data-tdvt="cierre"]'); await p.waitForTimeout(1200)
  check('abre el cierre', await p.isVisible('dialog.tdcm[open]'))
  const pide = (await llamadas(p, 'tienda_ventas_lista')).at(-1)
  const ahora = new Date()
  check('pide el mes entero, todas las líneas', pide?.p_cuantas === 5000 && new Date(pide.p_filtros.desde).getDate() === 1 && new Date(pide.p_filtros.desde).getMonth() === ahora.getMonth() && new Date(pide.p_filtros.hasta).getDate() === 1, JSON.stringify(pide))
  check('  …y las compras del mismo mes', (await llamadas(p, 'tienda_compras_lista')).at(-1)?.p_filtros?.desde === pide.p_filtros.desde)
  const resumen = (await p.innerText('.tdcm-cifras')).replace(/\s+/g, ' ')
  check('el resumen: vendido, coste, beneficio y comprado', /363,95/.test(resumen) && /248,00/.test(resumen) && /\+115,95/.test(resumen) && /80,00/.test(resumen) && /1 compra/.test(resumen), resumen)
  const [pdf] = await Promise.all([p.waitForEvent('download'), p.click('.tdcm [data-tdcm="pdf"]')])
  const t = readFileSync(await pdf.path()).toString('latin1')
  const mes = ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  check('el PDF: A4, una página, con su nombre', /^cierre-prueba-\d{4}-\d\d\.pdf$/.test(pdf.suggestedFilename()) && t.startsWith('%PDF-1.4') && /\/Count 1/.test(t) && /MediaBox \[0 0 595.28 841.89\]/.test(t), pdf.suggestedFilename())
  const textos = await p.evaluate(() => window.__TEXTOS__.join(' | '))
  check('  …que dice el mes, las cifras, cada día, por dónde y lo más vendido', textos.includes(`Cierre de ${mes}`) && /VENDIDO/.test(textos) && /BENEFICIO/.test(textos) && /Vendido cada día/.test(textos) && /Por dónde/.test(textos) && /Mostrador/.test(textos) && /Lo más vendido/.test(textos) && /Charizard ex/.test(textos), textos.slice(0, 400))
  const [csv] = await Promise.all([p.waitForEvent('download'), p.click('.tdcm [data-tdcm="csv"]')])
  check('el CSV de las ventas del mes', /^ventas-prueba-\d{4}-\d\d\.csv$/.test(csv.suggestedFilename()) && readFileSync(await csv.path(), 'utf8').split('\n').length === 4)
  const [csv2] = await Promise.all([p.waitForEvent('download'), p.click('.tdcm [data-tdcm="csv-compras"]')])
  check('  …y el de las compras', /^compras-prueba-\d{4}-\d\d\.csv$/.test(csv2.suggestedFilename()) && /Ane/.test(readFileSync(await csv2.path(), 'utf8')))
  const otro = await p.$$eval('.tdcm [data-mes] option', (os) => os[1].value)
  await p.selectOption('.tdcm [data-mes]', otro); await p.waitForTimeout(800)
  const pide2 = (await llamadas(p, 'tienda_ventas_lista')).at(-1)
  check('otro mes: lo pide', new Date(pide2.p_filtros.desde).getMonth() === (ahora.getMonth() + 11) % 12, JSON.stringify(pide2.p_filtros))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ventas', { movil: true, errores: { tienda_compras_lista: { code: 'PGRST202', message: 'Could not find the function public.tienda_compras_lista' } } })
  await p.click('[data-tdvt="menu"]'); await p.click('[data-tdvt="cierre"]'); await p.waitForTimeout(1200)
  check('sin la migración de compras: el cierre igual, «sin compras apuntadas» y sin su CSV', /sin compras apuntadas/.test(await p.textContent('.tdcm-cifras')) && !(await p.isVisible('.tdcm [data-tdcm="csv-compras"]')) && !errs.length)
  const r = await p.evaluate(() => { const d = document.querySelector('.tdcm').getBoundingClientRect(); return { abajo: Math.round(innerHeight - d.bottom), ancho: Math.round(d.width) } })
  check('móvil: desde abajo y a lo ancho', r.abajo <= 1 && r.ancho >= 388, JSON.stringify(r))
  await p.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1094-movil.png' })
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
