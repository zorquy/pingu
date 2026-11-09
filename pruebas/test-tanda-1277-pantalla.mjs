// Tanda 1277 — el lote sin desglosar y el tanto por ciento libre, en el
// navegador: «− 80 % +» (de 5 en 5 y escrito) en la carta y abajo; «+ Lote sin
// desglosar» en Comprar y en «Te da» del Cambio (vale en total, tu %, cartas y
// foto, que se sube comprimida antes de apuntar); la pastilla del Panel; la
// hoja «Lotes por desglosar»; y desglosar con el buscador de Comprar, el coste
// repartido según lo que vale cada una y lo añadido guardado al cerrar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''
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

// Dos lotes esperando: el del cambio de esta mañana (con foto) y una compra.
FILAS_EXTRA.tienda_lotes = [
  { id: 'l1', tienda_id: 'user-2', compra_ticket: 'tc-l1', vale: 100, coste: 80, pct: 80, cartas: 10, foto: 'user-2/lotes/a.webp', cliente: 'Iker', estado: 'por_desglosar', creado_el: AHORA },
  { id: 'l2', tienda_id: 'user-2', compra_ticket: 'tc-l2', vale: null, coste: 15, pct: null, cartas: null, foto: null, cliente: null, estado: 'por_desglosar', creado_el: hace(3) },
]
FILAS_EXTRA.tienda_cambios = [...FILAS_EXTRA.tienda_cambios, { id: 'cb2', tienda_id: 'user-2', venta_ticket: 'tv-l1', compra_ticket: 'tc-l1', entregado: 200, recibido: 80, diferencia: 120, pago: 'efectivo', hecho_el: AHORA }]
const COMPRADA = { ticket: 'tk-lote', lineas: 1, unidades: 10, total: 80, valorado: 100, pago: 'efectivo', lotes: 1 }
const DESGLOSADO = { lote: 'l1', ticket: 'tc-l1', lineas: 2, unidades: 2, total: 80 }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const P = await import(`${RAIZ}/js/tiendas-puro.js`)
const euros = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sinFinos = (t) => t.replace(/[\u00a0\u202f]/g, ' ')

console.log('── 1. Comprar un lote, con el tanto por ciento escrito ──')
{
  const { p, ctx, errs } = await abrir({ rpc: { tienda_comprar: COMPRADA } })
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  check('al buscar, el atajo «¿Muchas cartas?»', (await p.isVisible('#tdcLoteAtajo')) && /lote/.test(await p.textContent('#tdcLoteAtajo')))
  await p.click('#tdcLoteAtajo'); await p.waitForTimeout(400)
  const linea = '.tdc-lote'
  check('lo lleva a una línea «Lote sin desglosar», con «Vale en total» enfocado', (await p.locator(linea).count()) === 1 && /Lote sin desglosar/.test(await p.textContent(linea)) && (await p.evaluate(() => document.activeElement?.matches('.tdc-lote [data-vale]'))))
  check('  …y abajo el mando del %: «Pagas el − 60 % +»', (await p.inputValue('#tdcPcts [data-pct-campo]')) === '60' && /Pagas el/.test(await p.textContent('#tdcPcts')))
  await p.fill(`${linea} [data-vale]`, '100'); await p.waitForTimeout(150)
  check('vale 100: pagas el 60 % (60)', (await p.inputValue(`${linea} [data-pagas]`)) === '60')
  await p.fill('#tdcPcts [data-pct-campo]', '75'); await p.waitForTimeout(200)
  check('escribes 75: pagas 75, sin perder el campo', (await p.inputValue(`${linea} [data-pagas]`)) === '75' && (await p.evaluate(() => document.activeElement?.matches('[data-pct-campo]'))))
  await p.click('#tdcPcts [data-pct-paso="5"]'); await p.waitForTimeout(200)
  check('«+»: 80 %, pagas 80', (await p.inputValue('#tdcPcts [data-pct-campo]')) === '80' && (await p.inputValue(`${linea} [data-pagas]`)) === '80')
  await p.fill('#tdcPcts [data-pct-campo]', '8x'); await p.waitForTimeout(150)
  await p.press('#tdcPcts [data-pct-campo]', 'Tab'); await p.waitForTimeout(150)
  check('lo que no es un número no cuenta y vuelve a 80', (await p.inputValue('#tdcPcts [data-pct-campo]')) === '80' && (await p.inputValue(`${linea} [data-pagas]`)) === '80')
  check('  …y se recuerda (el de comprar)', (await p.evaluate(() => localStorage.getItem('pd-tienda-compra-pct'))) === '80')
  await p.fill(`${linea} [data-cartas]`, '10')
  await p.setInputFiles(`${linea} [data-lote-foto]`, { name: 'lote.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(400)
  check('la foto: «Foto hecha», con la miniatura', /Foto hecha/.test(await p.textContent(linea)) && (await p.locator(`${linea} .tdc-foto-lote img`).count()) === 1)
  check('  …y el botón: «Comprada · 10 cartas»', /Comprada · 80,00/.test(await p.textContent('#tdcBoton')))
  if (CAPS) await p.screenshot({ path: `${CAPS}/1277-comprar-lote.png` })
  await p.click('#tdcBoton'); await p.waitForTimeout(1200)
  const a = await ultima(p, 'tienda_comprar')
  const l = a?.p_lineas?.[0] || {}
  const sub = await p.evaluate(() => window.__SUBIDAS__ || [])
  check('manda el lote: vale 100, paga 80, 10 cartas, al 80 %', l.lote === true && l.coste === 80 && l.valorado === 100 && l.cartas === 10 && l.pct === 80 && !l.card_id, JSON.stringify(a))
  check('  …con la foto subida ANTES a la carpeta de la tienda', sub.length === 1 && sub[0].cubo === 'tienda-fotos' && sub[0].ruta.startsWith('user-2/lotes/') && l.foto === sub[0].ruta, JSON.stringify(sub))
  check('  …y el aviso: «por desglosar»', /por desglosar/.test(await p.textContent('.toast')))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 2. Un cambio por un lote ──')
{
  const { p, ctx, errs } = await abrir()
  await p.click('.tdm-p-cambio'); await p.waitForTimeout(900)
  check('en el cambio, «+ Lote sin desglosar» al lado de «+ Añadir carta suya»', (await p.isVisible('#tdcLote')) && (await p.isVisible('#tdcOtra')))
  await p.click('#tdcLote'); await p.waitForTimeout(300)
  await p.fill('.tdc-lote [data-vale]', '100'); await p.waitForTimeout(150)
  check('vale 100 al 80 % del cambio: cuenta 80', (await p.inputValue('.tdc-lote [data-pagas]')) === '80' && /Cuenta/.test(await p.textContent('.tdc-lote')))
  await p.fill('#tdcLeDas [data-tdx-busca]', 'carta'); await p.waitForTimeout(900)
  await p.click('#tdcLeDas .tdv-resultado >> nth=0'); await p.waitForTimeout(400)
  check('tu carta de 95: te paga 15', /Te paga 15,00/.test(await texto(p, '#tdcCuenta')))
  await p.click('#tdcBoton'); await p.waitForTimeout(900)
  const a = await ultima(p, 'tienda_cambio')
  check('«Hacer el cambio» manda el lote en «te da» y el % entero', a?.p_te_da?.[0]?.lote === true && a.p_te_da[0].coste === 80 && a.p_te_da[0].valorado === 100 && a.p_pct === 80 && !(await p.evaluate(() => (window.__SUBIDAS__ || []).length)), JSON.stringify(a))
  check('  …y el aviso dice que su lote espera', /lote te espera/.test(await p.textContent('.toast')))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 3. En la carta, el % se escribe ──')
{
  const { p, ctx, errs } = await abrir()
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(1000)
  const campo = '[data-paso-de="carta"] [data-pct-campo]'
  await p.fill(campo, '85'); await p.waitForTimeout(200)
  check('85 % de 72: pagas 61,20, y el cursor sigue en el campo', (await p.inputValue('[data-paso-de="carta"] [data-pagas]')) === '61.2' && (await p.evaluate(() => document.activeElement?.matches('[data-pct-campo]'))) && /ganas 10,80/.test(await p.textContent('#tdcMargen')))
  await p.click('[data-paso-de="carta"] [data-pct-paso="-5"]'); await p.waitForTimeout(200)
  check('«−»: 80 % (57,60)', (await p.inputValue(campo)) === '80' && (await p.inputValue('[data-paso-de="carta"] [data-pagas]')) === '57.6')
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 4. El Panel: «2 lotes por desglosar» y desglosar ──')
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html', rpc: { tienda_hoy: { actual: { importe: 0, ventas: 0 }, anterior: null, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} }, tienda_lote_desglosar: DESGLOSADO } })
  await p.waitForTimeout(600)
  const pill = '.tdh-pill-toca[data-ver="lotes"]'
  check('la pastilla «2 lotes por desglosar», de las que te tocan', (await p.locator(pill).count()) === 1 && /2\s*lotes por desglosar/.test(await p.textContent(pill)))
  await p.click(pill); await p.waitForTimeout(900)
  const filas = await p.$$eval('.tdl-lote', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ').trim()))
  check('la hoja: los dos, el del cambio con su foto, coste y %', filas.length === 2 && /Lote de 10 cartas/.test(filas[0]) && /Cambio · hoy/.test(filas[0]) && /Iker/.test(filas[0]) && /Coste 80,00/.test(filas[0]) && /al 80 %/.test(filas[0]) && /Compra/.test(filas[1]) && (await p.getAttribute('.tdl-lote a.tdc-lote-mini', 'href')).includes('tienda-fotos/user-2/lotes/a.webp'), filas.join(' | '))
  if (CAPS) await p.screenshot({ path: `${CAPS}/1277-lotes.png` })
  await p.click('[data-desglosar="l1"]'); await p.waitForTimeout(1000)
  check('«Desglosar» abre Comprar en modo lote: arriba la foto y lo que llevas', (await p.isVisible('.tdc.tdm-hoja-lote')) && /Desglosar el lote/.test(await p.textContent('#tdcModo')) && /Lote de 10 cartas/.test(await p.textContent('#tdcLoteCab')) && (await p.locator('#tdcLoteCab [data-lote-grande]').count()) === 1)
  check('  …sin el atajo de lote ni el mando del %', !(await p.isVisible('#tdcLoteAtajo')) && !(await p.isVisible('#tdcPcts')) && !(await p.isVisible('.tdc .tdm-modo')))
  await p.click('#tdcLoteCab [data-lote-grande]'); await p.waitForTimeout(150)
  check('tocar la foto la agranda', await p.evaluate(() => document.querySelector('#tdcLoteCab').classList.contains('tdc-lote-cab-grande')))
  await p.click('#tdcLoteCab [data-lote-grande]')
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(1000)
  check('la carta, sin «Pagas» ni %: su coste sale del lote', !(await p.locator('[data-paso-de="carta"] [data-pagas]').count()) && !(await p.locator('[data-paso-de="carta"] [data-pct-campo]').count()) && /sale del lote/.test(await p.textContent('#tdcFicha')))
  check('  …y el botón «Añadir al lote · vale 72,00»', /Añadir al lote · vale 72,00/.test(await p.textContent('#tdcBoton')))
  await p.click('#tdcBoton'); await p.waitForTimeout(400)
  check('vuelve a buscar la siguiente, con «Ver el lote · 1 carta»', (await p.isVisible('#tdcBusca')) && /Ver el lote · 1 carta/.test(await p.textContent('#tdcBoton')))
  await p.fill('#tdcBusca', 'carta'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado >> nth=0'); await p.waitForTimeout(900)
  await p.fill('[data-paso-de="carta"] [data-vale]', '8'); await p.waitForTimeout(150)
  await p.click('#tdcBoton'); await p.waitForTimeout(400)
  await p.click('#tdcBoton'); await p.waitForTimeout(400)
  const costes = (await p.$$eval('#tdcLineas [data-coste-lote]', (bs) => bs.map((b) => b.textContent.trim()))).map(sinFinos)
  const esperado = P.repartirTotal([{ unidades: 1, cm: 72 }, { unidades: 1, cm: 8 }], 80).map((c) => `${euros(c)} €`)
  check(`en el lote: cada una con su parte del coste (${esperado.join(' + ')} = 80)`, costes.join() === esperado.join() && /Coste del lote 80,00/.test(await texto(p, '#tdcCuenta')), costes.join())
  check('  …y arriba «Llevas 80,00 € de los 100,00 € tasados · 2 de 10»', /Llevas 80,00\s€ de los 100,00\s€ tasados · 2 de 10 cartas/.test(await texto(p, '#tdcLoteCab')), await texto(p, '#tdcLoteCab'))
  await p.fill('#tdcLineas .tdc-linea >> nth=1 >> [data-vale]', '18'); await p.waitForTimeout(200)
  const costes2 = (await p.$$eval('#tdcLineas [data-coste-lote]', (bs) => bs.map((b) => b.textContent.trim()))).map(sinFinos)
  check('cambiar lo que vale una reparte otra vez', costes2.join() === P.repartirTotal([{ unidades: 1, cm: 72 }, { unidades: 1, cm: 18 }], 80).map((c) => `${euros(c)} €`).join(), costes2.join())
  if (CAPS) await p.screenshot({ path: `${CAPS}/1277-desglosar.png` })
  await p.click('.tdc [data-tdc="cerrar"]'); await p.waitForTimeout(300)
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(700)
  const tras = await p.evaluate(() => ({ lote: !!document.querySelector('.tdc.tdm-hoja-lote'), abierta: document.querySelector('.tdc')?.open, modo: document.querySelector('#tdcModo')?.innerText, lineas: document.querySelectorAll('#tdcLineas .tdc-linea').length }))
  check('cerrar y abrir Comprar: la compra de siempre, sin lo del lote', !tras.lote && tras.abierta && /Comprar/.test(tras.modo) && tras.lineas === 0, JSON.stringify(tras))
  await p.click('.tdc [data-tdc="cerrar"]'); await p.waitForTimeout(300)
  await p.click(pill); await p.waitForTimeout(800)
  await p.click('[data-desglosar="l1"]'); await p.waitForTimeout(900)
  check('volver al lote: lo añadido sigue ahí', (await p.locator('#tdcLineas .tdc-linea').count()) === 2 && /Terminar el desglose · 2 cartas/.test(await p.textContent('#tdcBoton')))
  await p.click('#tdcBoton'); await p.waitForTimeout(1000)
  const a = await ultima(p, 'tienda_lote_desglosar')
  check('«Terminar el desglose» manda el lote y sus cartas, con lo que vale cada una', a?.p_lote === 'l1' && a.p_lineas?.length === 2 && a.p_lineas[0].card_id === 'carta-4' && a.p_lineas[0].valorado === 72 && a.p_lineas[1].valorado === 18, JSON.stringify(a))
  check('  …cierra la hoja y avisa: «te esperan en Por poner a la venta»', !(await p.isVisible('.tdc')) && /Lote desglosado: 2 cartas te esperan/.test(await p.textContent('.toast')))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 5. Compras: el lote en la lista ──')
{
  const filas = [{ id: 'c1', ticket: 'tc-l2', lote_id: 'l2', cartas: 10, card_id: null, product_id: null, market: 'WEST', nombre: 'Lote sin desglosar', idioma: '', estado: 'lote', variante: 'normal', unidades: 1, coste: 15, cm: null, cliente: 'Ane', pago: 'efectivo', comprada_el: AHORA }]
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html?ver=ventas', rpc: { tienda_compras_lista: { total: 1, tickets: 1, sumas: { unidades: 1, importe: 15 }, filas } } })
  await p.waitForTimeout(500)
  await p.click('[data-tdvt-modo="compras"]'); await p.waitForTimeout(900)
  const t = await texto(p, '.tdvt-lista').catch(() => '')
  check('«Lote sin desglosar · 10 cartas · por desglosar», con su cliente', /Lote sin desglosar/.test(t) && /10 cartas · por desglosar · Ane/.test(t), t.slice(0, 300))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 6. El móvil ──')
{
  const { p, ctx, errs } = await abrir({ movil: true, ruta: '/tienda.html?comprar=1' })
  await p.waitForTimeout(600)
  await p.tap('#tdcLoteAtajo'); await p.waitForTimeout(400)
  const m = await p.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect()
    return { ancho: document.documentElement.scrollWidth, foto: r('.tdc-lote-foto').height, menos: r('#tdcPcts [data-pct-paso="-5"]').width, campo: parseFloat(getComputedStyle(document.querySelector('#tdcPcts [data-pct-campo]')).fontSize), dentro: r('.tdc-lote').right <= innerWidth }
  })
  check('cabe a lo ancho, «Foto del lote» y «−» de 44 y el % en letra de 16 o más', m.ancho <= 390 && m.foto >= 44 && m.menos >= 44 && m.campo >= 16 && m.dentro, JSON.stringify(m))
  if (CAPS) await p.screenshot({ path: `${CAPS}/1277-movil.png` })
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
