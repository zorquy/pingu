// Tanda 1091 — comprar a un cliente, en el navegador: la hoja desde Vender y
// desde «+ Añadir» del Stock, buscar en el catálogo, la línea con su idioma,
// estado y Cardmarket (orientativo), lo que pagas por el tanto por ciento (que
// se recuerda) o por un total redondo, «Comprada» con lo que manda a la base,
// el aviso con Deshacer y Recibo, y Ventas → Compras con su hoja y su recibo.
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

const COMPRAS = { total: 2, tickets: 1, sumas: { unidades: 3, importe: 40, cm: 80, importe_con_cm: 40 }, filas: [
  { id: 'cp1', ticket: 'tc1', card_id: 'carta-4', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '4', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 36, cm: 72, cliente: '@ane_tcg', comprada_el: new Date().toISOString() },
  { id: 'cp2', ticket: 'tc1', card_id: 'carta-1', market: 'WEST', nombre: 'Carta 1', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'EX', variante: 'normal', unidades: 2, coste: 2, cm: 4, cliente: '@ane_tcg', comprada_el: new Date().toISOString() },
] }
const b = await chromium.launch()
async function abrir({ lista = LISTA, ruta = '/tienda.html?ver=stock', movil = false, vistas = [], precios = [], rpc = {}, errores = {} } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1360, height: 900 }, acceptDownloads: true })
  const x = { tienda_comprar: { ticket: 'tc1', lineas: 2, unidades: 3, total: 40 }, tienda_deshacer_compra: { lineas: 2, borradas: 2 }, tienda_compras_lista: COMPRAS, tienda_ventas_lista: { total: 0, tickets: 0, sumas: {}, por_donde: {}, filas: [] }, ...rpc }
  const e = errores
  await ctx.addInitScript(([l, v, c, s, pr, x, e]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = { tienda_compras: [{ id: 'cp1', ticket: 'tc1', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 150, comprada_el: new Date().toISOString(), created_at: new Date().toISOString() }], tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }], tienda_vistas: v, tcg_products: [{ id: 501, name: 'ETB de prueba', image: null, lang: 'en', market: 'WEST', cm_lowest: 70, cm_lowest_eu: 71 }] }
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = s
    window.__FAKE_PRECIOS__ = pr
    window.__FAKE_IDIOMAS_SET__ = { 'set-0': ['de', 'en', 'es', 'fr', 'it'] }
    window.__RPC_RESPUESTAS__ = { tienda_stock_lista: l, tienda_stock_precio_bloque: { cambiadas: 2, sin_cardmarket: 1 }, idiomas_de_set: ['es', 'en', 'fr', 'de', 'it'] }
    window.__RPC_ERRORES__ = e
    window.__TEXTOS__ = []
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__TEXTOS__.push(String(t)); return fill.call(this, t, ...r) }
    Object.assign(window.__RPC_RESPUESTAS__, x)
  }, [lista, vistas, CARTAS, SETS, precios, x, e])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

const PRECIOS = [{ card_id: 'carta-4', cm_low: 290, cm_low_es: 72, cm_low_en: 60 }, { card_id: 'carta-1', cm_low: 3, cm_low_es: 4, cm_low_en: 3 }]

console.log('── 1. La hoja ──')
{
  const { p, ctx, errs } = await abrir({ precios: PRECIOS })
  await p.click('.tdm-vender'); await p.waitForTimeout(500)
  await p.click('.tdv [data-tdv="comprar"]'); await p.waitForTimeout(700)
  check('desde Vender, «Comprar a un cliente» abre la hoja de comprar', (await p.isVisible('.tdc')) && !(await p.locator('dialog.tdv:not(.tdc)[open]').count()))
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  check('busca en el catálogo (no en el stock)', /Pikachu ex/.test(await p.textContent('#tdcResultados')), await p.textContent('#tdcResultados'))
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(1000)
  const l1 = await p.evaluate(() => ({ idioma: document.querySelector('.tdc-linea [data-campo="idioma"]')?.value, idiomas: [...document.querySelectorAll('.tdc-linea [data-campo="idioma"] option')].map((o) => o.value).join(), estado: document.querySelector('.tdc-linea [data-campo="estado"]')?.value, pagas: document.querySelector('.tdc-linea [data-pagas]')?.value, cm: document.querySelector('.tdc-linea .tdc-cm')?.textContent }))
  check('la línea: español, NM, los idiomas del set y Cardmarket de su idioma (72 €, orientativo)', l1.idioma === 'es' && l1.estado === 'NM' && l1.idiomas === 'es,en,fr,de,it' && /72,00/.test(l1.cm) && /orientativo/.test(l1.cm), JSON.stringify(l1))
  check('  …y lo que pagas: el 50 % (36 €)', l1.pagas === '36', l1.pagas)
  await p.selectOption('.tdc-linea [data-campo="idioma"]', 'en'); await p.waitForTimeout(200)
  check('cambiar el idioma cambia Cardmarket y lo que pagas (60 → 30)', (await p.inputValue('.tdc-linea [data-pagas]')) === '30' && /60,00/.test(await p.textContent('.tdc-linea .tdc-cm')))
  await p.click('.tdc [data-pct="60"]'); await p.waitForTimeout(200)
  check('el 60 %: 36 €', (await p.inputValue('.tdc-linea [data-pagas]')) === '36')
  await p.fill('#tdcBusca', 'carta 1'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado >> nth=0'); await p.waitForTimeout(1000)
  await p.click('.tdc-linea >> nth=1 >> [data-paso="1"]'); await p.waitForTimeout(150)
  await p.fill('.tdc [data-total]', '40'); await p.waitForTimeout(200)
  const reparto = await p.$$eval('.tdc-linea [data-pagas]', (is) => is.map((i) => Number(i.value)))
  check('un total redondo de 40 € se reparte por lo que vale cada una y suma 40', Math.abs(reparto[0] + reparto[1] * 2 - 40) < 0.001 && reparto[0] > reparto[1], JSON.stringify(reparto))
  check('  …y el botón lo dice', /Comprada · 40,00/.test(await p.textContent('#tdcComprada')))
  await p.fill('.tdc [data-cliente]', '@ane_tcg')
  await p.click('#tdcComprada'); await p.waitForTimeout(700)
  const pedida = await ultima(p, 'tienda_comprar')
  check('«Comprada» manda cada línea con su idioma, estado, versión, unidades, lo que pagas y Cardmarket, y a quién', pedida?.p_cliente === '@ane_tcg' && pedida.p_lineas.length === 2 && pedida.p_lineas[0].card_id === 'carta-4' && pedida.p_lineas[0].idioma === 'en' && pedida.p_lineas[0].estado === 'NM' && pedida.p_lineas[0].variante && pedida.p_lineas[0].cm === 60 && pedida.p_lineas[1].unidades === 2 && Math.abs(pedida.p_lineas[0].coste + pedida.p_lineas[1].coste * 2 - 40) < 0.001, JSON.stringify(pedida))
  check('  …cierra, avisa con Deshacer y Recibo y repinta el stock', !(await p.isVisible('.tdc')) && /Ya están en tu stock/.test(await p.textContent('.toast')) && (await p.locator('.toast .toast-accion').count()) === 2 && (await llamadas(p, 'tienda_stock_lista')).length >= 2)
  await p.click('.toast .toast-accion >> text=Deshacer'); await p.waitForTimeout(500)
  check('Deshacer, desde el aviso', (await ultima(p, 'tienda_deshacer_compra'))?.p_ticket === 'tc1')
  check('el tanto por ciento se recuerda', (await p.evaluate(() => localStorage.getItem('pd-tienda-compra-pct'))) === '60')
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ precios: PRECIOS, errores: { tienda_comprar: { code: 'PGRST202', message: 'Could not find the function public.tienda_comprar' } } })
  await p.click('[data-tds-menu="anadir"]'); await p.click('.tds-menu [data-tds="comprar"]'); await p.waitForTimeout(700)
  check('desde «+ Añadir» del Stock también', await p.isVisible('.tdc'))
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.click('#tdcResultados .tdv-resultado'); await p.waitForTimeout(900)
  await p.click('#tdcComprada'); await p.waitForTimeout(500)
  check('sin la migración, dice cuál falta', /migración 1091/.test(await p.textContent('#tdcError')) && (await p.isVisible('.tdc')))
  await ctx.close()
}

console.log('── 2. Ventas → Compras ──')
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html?ver=ventas' })
  await p.click('[data-tdvt-modo="compras"]'); await p.waitForTimeout(700)
  check('pide las compras', (await llamadas(p, 'tienda_compras_lista')).length === 1)
  const cifras = (await p.innerText('.tdvt-cifras')).replace(/\s+/g, ' ')
  check('las cifras: pagado, unidades y Cardmarket (orientativo)', /Pagado 40,00 € 1 compra/i.test(cifras) && /Unidades 3/i.test(cifras) && /pagaste el 50 %/.test(cifras), cifras)
  check('sin «Dónde» (una compra no se vende en ningún sitio)', !(await p.isVisible('[data-tdvt-donde]')))
  check('cada compra con a quién', /@ane_tcg/.test(await p.textContent('.tdvt-lista')))
  await p.click('[data-venta="cp1"]'); await p.waitForTimeout(400)
  check('su hoja: «Compra · 40,00 €», Recibo y Deshacer la compra', /Compra · 40,00/.test(await p.textContent('#tdvtHoja h2')) && /Deshacer la compra/.test(await p.textContent('#tdvtHoja')))
  await p.click('#tdvtHoja [data-recibo]'); await p.waitForTimeout(2000)
  const textos = await p.evaluate(() => window.__TEXTOS__.join(' | '))
  check('el recibo: «Te compramos» y «Te pagamos», sin Cardmarket', (await p.isVisible('dialog.tdr[open]')) && /Te compramos/.test(textos) && /Te pagamos/.test(textos) && !/Cardmarket|CM /.test(textos), textos)
  await p.click('dialog.tdr [data-tdr="cerrar"]')
  await p.click('#tdvtHoja [data-deshacer]')
  check('deshacer pide un segundo toque', /Sale del stock/.test(await p.textContent('#tdvtHoja [data-deshacer]')) && !(await llamadas(p, 'tienda_deshacer_compra')).length)
  await p.click('#tdvtHoja [data-deshacer]'); await p.waitForTimeout(600)
  check('  …y deshace la compra', (await ultima(p, 'tienda_deshacer_compra'))?.p_ticket === 'tc1')
  await p.click('[data-tdvt-modo="ventas"]'); await p.waitForTimeout(500)
  check('volver a Ventas', (await p.isVisible('[data-tdvt-donde]')) && (await llamadas(p, 'tienda_ventas_lista')).length >= 2)
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 3. El móvil ──')
{
  const { p, ctx, errs } = await abrir({ precios: PRECIOS, movil: true, ruta: '/tienda.html?comprar=1' })
  check('/tienda?comprar=1 abre la hoja', await p.isVisible('.tdc'))
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(900)
  await p.tap('#tdcResultados .tdv-resultado'); await p.waitForTimeout(900)
  const r = await p.evaluate(() => { const d = document.querySelector('.tdc').getBoundingClientRect(); return { abajo: Math.round(innerHeight - d.bottom), ancho: Math.round(d.width), alto: Math.round(d.height), sale: document.querySelector('.tdc .tdv-cuerpo').scrollWidth <= document.querySelector('.tdc .tdv-cuerpo').clientWidth } })
  check('desde abajo, a lo ancho, con alto y sin salirse', r.abajo <= 1 && r.ancho >= 388 && r.alto > 300 && r.sale, JSON.stringify(r))
  await p.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1091-movil.png' })
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ ruta: '/tienda.html?ver=ventas', movil: true })
  const fila = await p.evaluate(() => new Set([...document.querySelectorAll('.tdvt-arriba > *')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().top))).size)
  check('Ventas en el móvil: «Ventas · Compras» y debajo la fila de siempre, en una', fila === 1 && (await p.isVisible('.tdvt-modo')) && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), fila)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
