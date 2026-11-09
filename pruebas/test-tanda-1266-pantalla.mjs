// Tanda 1266 — el Cambio, en el navegador: Cambio en el abanico del móvil y
// en el botón partido del PC, la hoja de Comprar en modo cambio con «Te da»
// (Vale con Cardmarket en gris, «Cuenta» al 80 % que se recuerda aparte) y
// «Le das» (tu stock, «Lo dejas en» con tu precio en gris), la diferencia
// (te paga / le pagas / en paz) con su forma de pago, lo que manda a
// `tienda_cambio`, el aviso con Deshacer y Recibo, el recibo con los dos
// lados, la caja con «En cartas», las listas con la chapa y deshacer el
// cambio entero. Y Comprar ⇄ Cambio conserva las líneas.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const LISTA = {
  total: 4, en_stock: 5,
  sumas: { unidades: 10, coste: 752, precio: 1046.7, cm: 1099.4, sin_coste: 1, sin_precio: 1 },
  facetas: {
    catalogo: { WEST: 4, sellado: 1 },
    sets: { 'set-0': 3, 'set-1': 1 },
    idioma: { es: 3, en: 2 },
    estado: { NM: 3, EX: 1, sellado: 1 },
    variante: { normal: 4, reverse: 1 },
    rareza: { 'Special Illustration Rare': 2, Common: 1 },
    ubicacion: { Vitrina: 2, 'Caja comunes': 1 },
  },
  filas: [
    { id: 'st-1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', rareza: 'Special Illustration Rare', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, coste: 62, precio: 95, cm: 88.4, ubicacion: 'Vitrina', visible: true, notas: null, entro_el: hace(12) },
    { id: 'st-2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', rareza: 'Special Illustration Rare', idioma: 'en', estado: 'NM', variante: 'reverse', gradeo: 'PSA 10', unidades: 2, coste: 210, precio: 279, cm: 301.5, ubicacion: 'Vitrina', visible: true, notas: null, entro_el: hace(34) },
    { id: 'st-3', card_id: 'carta-3', market: 'WEST', product_id: null, nombre: 'Carta 3', set_id: 'set-0', numero: '3', rareza: 'Common', idioma: 'es', estado: 'EX', variante: 'normal', gradeo: null, unidades: 1, coste: 18, precio: 16, cm: 21, ubicacion: null, visible: true, notas: null, entro_el: hace(128) },
    { id: 'st-4', card_id: null, market: 'WEST', product_id: 501, nombre: 'ETB de prueba', set_id: null, numero: null, rareza: null, idioma: 'en', estado: 'sellado', variante: 'normal', gradeo: null, unidades: 6, coste: 44, precio: null, cm: 71, ubicacion: null, visible: false, notas: null, entro_el: hace(9) },
  ],
}
const VACIA = { total: 0, en_stock: 0, sumas: { unidades: 0, coste: 0, precio: 0, cm: 0, sin_coste: 0, sin_precio: 0 }, facetas: {}, filas: [] }
const CARTAS = Array.from({ length: 6 }, (_, i) => ({ id: `carta-${i}`, set_id: i < 5 ? 'set-0' : 'set-1', local_id: String(i), name: i === 4 ? 'Pikachu ex' : `Carta ${i}`, rarity: 'Common', variants: { normal: true, reverse: true } }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF', release_date: '2023-08-11' }, { id: 'set-1', name: 'Surging Sparks', market: 'WEST', tcg_online_code: 'SSP', release_date: '2024-11-08' }]

const AHORA = new Date().toISOString()
const FILAS_EXTRA = {
  tienda_cambios: [{ id: 'cb1', tienda_id: 'user-2', venta_ticket: 'tv9', compra_ticket: 'tc9', entregado: 90, recibido: 72, diferencia: 18, pago: 'tarjeta', hecho_el: AHORA }],
  tienda_ventas: [
    { id: 'v9', ticket: 'tv9', tienda_id: 'user-2', card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 90, coste: 62, pago: 'cambio', precio_lista: 95, donde: 'mostrador', vendida_el: AHORA, created_at: AHORA },
    { id: 'v8', ticket: 'tv8', tienda_id: 'user-2', card_id: 'carta-3', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 30, coste: 10, pago: 'efectivo', precio_lista: 30, donde: 'mostrador', vendida_el: AHORA, created_at: AHORA },
  ],
  tienda_compras: [{ id: 'c9', ticket: 'tc9', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 72, pago: 'cambio', comprada_el: AHORA, created_at: AHORA }],
  tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }],
  tcg_products: [],
}
const VENTAS = { total: 2, tickets: 2, sumas: { unidades: 2, importe: 120 }, por_donde: { mostrador: 120 }, filas: [
  { id: 'v9', ticket: 'tv9', card_id: 'carta-1', market: 'WEST', nombre: 'Carta 1', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 90, coste: 62, donde: 'mostrador', pago: 'cambio', vendida_el: AHORA },
  { id: 'v8', ticket: 'tv8', card_id: 'carta-3', market: 'WEST', nombre: 'Carta 3', set_id: 'set-0', numero: '3', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 30, coste: 10, donde: 'mostrador', pago: 'efectivo', vendida_el: AHORA },
] }
const PRECIOS = [{ card_id: 'carta-4', cm_low: 290, cm_low_es: 72, cm_low_en: 60 }]
const HECHO = { id: 'cb1', venta_ticket: 'tv9', compra_ticket: 'tc9', entregado: 90, recibido: 72, diferencia: 18, pago: 'tarjeta' }

const b = await chromium.launch()
async function abrir({ ruta = '/tienda.html?ver=stock', movil = false, rpc = {}, errores = {} } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1360, height: 900 } })
  const x = { tienda_stock_lista: LISTA, tienda_cambio: HECHO, tienda_deshacer_cambio: { id: 'cb1', diferencia: 18, pago: 'tarjeta' }, tienda_ventas_lista: VENTAS, tienda_compras_lista: { total: 0, tickets: 0, sumas: {}, filas: [] }, idiomas_de_set: ['es', 'en', 'fr', 'de', 'it'], tienda_reservas_al_dia: 0, ...rpc }
  await ctx.addInitScript(([f, c, s, pr, x, e]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = f
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = s
    window.__FAKE_PRECIOS__ = pr
    window.__FAKE_IDIOMAS_SET__ = { 'set-0': ['de', 'en', 'es', 'fr', 'it'] }
    window.__RPC_RESPUESTAS__ = x
    window.__RPC_ERRORES__ = e
    window.__TEXTOS__ = []
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__TEXTOS__.push(String(t)); return fill.call(this, t, ...r) }
  }, [FILAS_EXTRA, CARTAS, SETS, PRECIOS, x, errores])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)
const texto = async (p, sel) => ((await p.innerText(sel)) || '').replace(/\s+/g, ' ').trim()

console.log('── 1. El PC: Comprar | Cambio | Vender, y la hoja ──')
{
  const { p, ctx, errs } = await abrir()
  check('arriba, el botón partido lleva Cambio en medio', (await p.$$eval('.tdm-partido a', (as) => as.map((a) => a.dataset.ver).join())) === 'comprar,cambio,vender')
  await p.click('.tdm-p-cambio'); await p.waitForTimeout(900)
  check('abre la hoja en modo cambio, con los dos lados a la vista', (await p.isVisible('.tdc.tdm-hoja-cambio')) && (await p.getAttribute('.tdc [data-modo="cambio"]', 'aria-pressed')) === 'true' && (await p.isVisible('.tdx-teda .tdx-lado-titulo')) && (await p.isVisible('#tdcLeDas [data-tdx-busca]')))
  check('  …arriba, Comprar · Cambio · Vender', (await p.$$eval('.tdc .tdm-modo button', (bs) => bs.map((b) => b.textContent).join())) === 'Comprar,Cambio,Vender')
  check('  …el tanto por ciento es el de cambios, 80 de partida (libre desde la 1277: − 80 % +)', (await p.inputValue('#tdcPcts [data-pct-campo]')) === '80' && (await p.locator('#tdcPcts [data-pct-paso]').count()) === 2 && /Cuenta el/.test(await p.textContent('#tdcPcts')))
  check('  …y «Hacer el cambio» apagado mientras falte algo', (await p.isDisabled('#tdcBoton')) && /Hacer el cambio/.test(await p.textContent('#tdcBoton')))
  await p.click('#tdcOtra'); await p.waitForTimeout(300)
  check('«+ Añadir carta suya» va a buscar en el catálogo, con «Volver al cambio»', (await p.textContent('#tdcOtra')) === '+ Añadir carta suya' && (await p.isVisible('#tdcBusca')) && (await p.isVisible('.tdx-volver')))
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(1000)
  const vale = '[data-paso-de="carta"] [data-vale]'
  const cuenta = '[data-paso-de="carta"] [data-pagas]'
  check('su carta: «Vale» vacío con Cardmarket (72) en gris, y «Cuenta» el 80 %: 57,60', (await p.inputValue(vale)) === '' && (await p.getAttribute(vale, 'placeholder')) === '72' && (await p.inputValue(cuenta)) === '57.6' && /cuenta/i.test(await texto(p, '[data-paso-de="carta"] .tdm-dos-campos')))
  await p.fill(vale, '90'); await p.waitForTimeout(200)
  check('la valoras en 90: cuenta 72', (await p.inputValue(cuenta)) === '72' && /Añadir al cambio · 72,00/.test(await p.textContent('#tdcBoton')))
  await p.click('#tdcBoton'); await p.waitForTimeout(400)
  check('«Añadir al cambio» vuelve a ver los dos lados, con su carta en «Te da»', (await p.isVisible('#tdcLeDas')) && (await p.locator('.tdc-linea').count()) === 1 && /Añade lo que le das/.test(await p.textContent('#tdcError')))
  await p.fill('#tdcLeDas [data-tdx-busca]', 'carta'); await p.waitForTimeout(900)
  await p.click('#tdcLeDas .tdv-resultado >> nth=0'); await p.waitForTimeout(400)
  const precio = '#tdcLeDas [data-tdx-precio]'
  check('tu carta en «Le das»: «Tu precio» 95 y «Lo dejas en» vacío con 95 en gris', /95,00/.test(await p.textContent('#tdcLeDas .tdm-campo-fijo')) && (await p.inputValue(precio)) === '' && (await p.getAttribute(precio, 'placeholder')) === '95,00')
  let c = await texto(p, '#tdcCuenta')
  check('la cuenta: lo suyo 72, lo tuyo 95, te paga 23', /Lo suyo cuenta 72,00/.test(c) && /Lo tuyo 95,00/.test(c) && /Te paga 23,00/.test(c), c)
  check('  …con las formas de pago de una venta (tarjeta sí, «otro» no)', (await p.isVisible('.tdc [data-pago="tarjeta"]')) && !(await p.isVisible('.tdc [data-pago="otro"]')) && /Te paga con/i.test(await p.textContent('#tdcPago')))
  check('  …y el botón lo dice', /Hacer el cambio · Te paga 23,00/.test(await p.textContent('#tdcBoton')) && !(await p.isDisabled('#tdcBoton')))
  await p.fill(precio, '70'); await p.waitForTimeout(300)
  c = await texto(p, '#tdcCuenta')
  check('la dejas en 70: le pagas 2, con las formas de pago de una compra', /Le pagas 2,00/.test(c) && (await p.isVisible('.tdc [data-pago="otro"]')) && !(await p.isVisible('.tdc [data-pago="tarjeta"]')), c)
  await p.fill(precio, '72'); await p.waitForTimeout(300)
  check('en 72: quedáis en paz, sin forma de pago', /Quedáis en paz/.test(await texto(p, '#tdcCuenta')) && !(await p.isVisible('.tdc .tdm-pagos')))
  await p.fill(precio, '90'); await p.waitForTimeout(300)
  await p.click('.tdc [data-pago="tarjeta"]')
  await p.fill('.tdc [data-cliente]', '@ane')
  await p.click('#tdcBoton'); await p.waitForTimeout(900)
  const a = await ultima(p, 'tienda_cambio')
  const teDa = a?.p_te_da?.[0] || {}
  check('«Hacer el cambio» manda lo suyo (cuenta 72, vale 90, Cardmarket 72) y lo tuyo a 90', teDa.card_id === 'carta-4' && teDa.coste === 72 && teDa.valorado === 90 && teDa.cm === 72 && JSON.stringify(a?.p_le_das) === '[{"stock_id":"st-1","unidades":1,"precio":90}]', JSON.stringify(a))
  check('  …con tarjeta, el cliente, el sitio y el 80 %', a?.p_pago === 'tarjeta' && a?.p_cliente === '@ane' && a?.p_donde === 'mostrador' && a?.p_pct === 80, JSON.stringify(a))
  check('  …la hoja se queda abierta y vacía, y avisa con Deshacer y Recibo', (await p.isVisible('.tdc.tdm-hoja-cambio')) && (await p.locator('.tdc-linea').count()) === 0 && (await p.locator('#tdcLeDas [data-tdx-linea]').count()) === 0 && /Cambio hecho · Te paga 18,00/.test(await p.textContent('.toast')) && (await p.locator('.toast .toast-accion').count()) === 2)
  await p.click('.toast-accion:has-text("Recibo")'); await p.waitForTimeout(1500)
  const t = await p.evaluate(() => window.__TEXTOS__.join(' | '))
  check('el recibo: «Cambio», los dos lados, «Nos pagas» 18 y con tarjeta', (await p.isVisible('.tdr')) && /Cambio/.test(t) && /NOS DAS · 72,00/.test(t) && /TE LLEVAS · 90,00/.test(t) && /Nos pagas/.test(t) && /18,00/.test(t) && /Pagado con Tarjeta/.test(t), t.slice(0, 500))
  check('  …sin el coste ni lo que ganas', !/62,00|28,00/.test(t))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 2. Comprar ⇄ Cambio conserva las líneas ──')
{
  const { p, ctx, errs } = await abrir()
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(1000)
  check('en Comprar: «Pagas» al 60 % (43,20)', (await p.inputValue('[data-paso-de="carta"] [data-pagas]')) === '43.2' && /pagas/i.test(await texto(p, '[data-paso-de="carta"] .tdm-dos-campos')))
  await p.click('#tdcBoton'); await p.waitForTimeout(300)
  await p.click('.tdc [data-modo="cambio"]'); await p.waitForTimeout(700)
  check('pasar a Cambio: la misma carta en «Te da», ahora al 80 % (57,60)', (await p.locator('.tdc-linea').count()) === 1 && (await p.inputValue('.tdc-linea [data-pagas]')) === '57.6' && (await p.isVisible('#tdcLeDas')))
  await p.click('.tdc [data-modo="comprar"]'); await p.waitForTimeout(500)
  check('  …y volver a Comprar la deja al 60 % y esconde «Le das»', (await p.inputValue('.tdc-linea [data-pagas]')) === '43.2' && !(await p.isVisible('#tdcLeDas')) && /Comprada/.test(await p.textContent('#tdcBoton')))
  await p.click('.tdc [data-modo="cambio"]'); await p.waitForTimeout(500)
  await p.click('#tdcPcts [data-pct-paso="5"]'); await p.waitForTimeout(150)
  await p.click('#tdcPcts [data-pct-paso="5"]'); await p.waitForTimeout(200)
  await ctx.close()
  check('sin errores', !errs.length, errs.join(' | '))
}

console.log('── 3. El móvil: el abanico y la hoja ──')
{
  const { p, ctx, errs } = await abrir({ movil: true, ruta: '/tienda.html' })
  await p.tap('.bm a[data-ver="mostrador"]'); await p.waitForTimeout(500)
  check('el abanico lleva Cambio a lo ancho, entre los grandes y los finos', (await p.isVisible('.tdm-gran-cambio')) && /Cartas por cartas/.test(await p.textContent('.tdm-gran-cambio')))
  const caja = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { cambio: r('.tdm-gran-cambio'), comprar: r('.tdm-gran-comprar'), vender: r('.tdm-gran-vender'), panel: r('.tdm-panel'), barra: r('.bm') } })
  check('  …debajo de Comprar y Vender, a lo ancho y sin tapar la barra', caja.cambio.top >= caja.comprar.bottom && Math.round(caja.cambio.width) >= Math.round(caja.vender.right - caja.comprar.left) - 1 && caja.panel.bottom <= caja.barra.top + 1, JSON.stringify(caja))
  await p.tap('.tdm-gran-cambio'); await p.waitForTimeout(900)
  check('abre la hoja de cambio, sin salirse de ancho', (await p.isVisible('.tdc.tdm-hoja-cambio')) && (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await p.tap('.tdc [data-modo="vender"]'); await p.waitForTimeout(800)
  check('«Vender» arriba cambia de hoja, y desde Vender, «Cambio» vuelve', (await p.isVisible('.tdv:not(.tdc)')))
  await p.tap('.tdv:not(.tdc) [data-modo="cambio"]'); await p.waitForTimeout(800)
  check('  …a la hoja de cambio', (await p.isVisible('.tdc.tdm-hoja-cambio')))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 4. La caja, las listas y deshacer ──')
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html?caja=1' })
  await p.waitForTimeout(800)
  const t = await texto(p, '.tdk')
  const filas = await p.$$eval('.tdk-tabla tbody tr', (trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()))
  check('la caja: «De ello, 1 cambio: +18 € en dinero»', /De ello, 1 cambio: \+18,00\s€ en dinero/.test(t), t)
  check('  …lo pagado en cartas, aparte («En cartas» entra 72), y la tarjeta 18', filas.some((f) => /^En cartas 72,00\s€ −72,00\s€/.test(f)) && filas.some((f) => /^Tarjeta 18,00\s€/.test(f)), filas.join(' | '))
  check('  …y el efectivo que debería haber no cuenta el cambio (30 €)', /30,00\s€/.test(await p.textContent('.tdk-efectivo-caja')))
  await ctx.close()
  check('sin errores', !errs.length, errs.join(' | '))
}
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html?ver=ventas' })
  await p.waitForTimeout(800)
  const chapas = await p.$$eval('.tdvt-fila', (fs) => fs.map((f) => !!f.querySelector('.tdvt-chapa-cambio')))
  check('Ventas: la del cambio lleva la chapa «Cambio», la otra no', JSON.stringify(chapas) === '[true,false]', JSON.stringify(chapas))
  await p.click('.tdvt-fila >> nth=0'); await p.waitForTimeout(500)
  check('  …su hoja: «Recibo del cambio» y «Deshacer el cambio»', /Recibo del cambio/.test(await p.textContent('#tdvtHoja')) && (await p.textContent('#tdvtHoja .tdvt-deshacer')) === 'Deshacer el cambio')
  await p.click('#tdvtHoja .tdvt-deshacer'); await p.waitForTimeout(200)
  check('  …pide confirmar', /Las dos mitades/.test(await p.textContent('#tdvtHoja .tdvt-deshacer')))
  await p.click('#tdvtHoja .tdvt-deshacer'); await p.waitForTimeout(800)
  check('  …y deshace el cambio entero (por el ticket de la venta)', (await ultima(p, 'tienda_deshacer_cambio'))?.p_id === 'tv9' && !(await llamadas(p, 'tienda_deshacer_venta')).length)
  await p.click('.tdvt-fila >> nth=1'); await p.waitForTimeout(500)
  check('una venta normal sigue con «Deshacer la venta»', (await p.textContent('#tdvtHoja .tdvt-deshacer')) === 'Deshacer la venta')
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ errores: { tienda_cambio: { code: 'PGRST202', message: 'Could not find the function public.tienda_cambio' } } })
  await p.click('.tdm-p-cambio'); await p.waitForTimeout(900)
  await p.click('#tdcOtra'); await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(1000)
  await p.click('#tdcBoton'); await p.waitForTimeout(300)
  await p.fill('#tdcLeDas [data-tdx-busca]', 'carta'); await p.waitForTimeout(900)
  await p.click('#tdcLeDas .tdv-resultado >> nth=0'); await p.waitForTimeout(300)
  await p.click('#tdcBoton'); await p.waitForTimeout(700)
  check('sin la migración 1266: lo dice y no borra nada', /migración 1266/.test(await p.textContent('#tdcError')) && (await p.locator('.tdc-linea').count()) === 1)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
