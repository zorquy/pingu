// Tanda 1092 — «Apártamela», en el navegador: la chapa de lo apartado en el
// stock, «Apartar» desde la ficha de una línea (para quién, hasta cuándo, el
// precio que cuenta), Deshacer, lo apartado dentro de la ficha con «Quitar»,
// y el Panel con sus apartadas (Recogida, Quitar con dos toques y el aviso de
// las que caducaron). Sin la migración, nada de esto sale ni rompe.
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
const APARTADAS = [
  { id: 'r1', stock_id: 'st-2', unidades: 1, precio: 170, para: '@ane_tcg', para_username: 'ane_tcg', hasta: new Date(Date.now() + 3 * 36e5).toISOString(), card_id: 'carta-2', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'normal', nombre: 'Carta 2', set_id: 'set-0', numero: '2' },
  { id: 'r2', stock_id: 'st-1', unidades: 2, precio: 95, para: 'Jon', para_username: null, hasta: new Date(Date.now() + 4 * 864e5).toISOString(), card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', nombre: 'Carta 1', set_id: 'set-0', numero: '1' },
]
const b = await chromium.launch()
async function abrir({ lista = LISTA, ruta = '/tienda.html?ver=stock', movil = false, vistas = [], precios = [], rpc = {}, errores = {} } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1360, height: 900 }, acceptDownloads: true })
  const x = { tienda_apartar: { id: 'r1', quedan: 1 }, tienda_reserva_quitar: { devueltas: 1 }, tienda_reserva_recoger: { ticket: 'tk5', lineas: 1, total: 170, beneficio: 108, sin_coste: 0 }, tienda_reservas_al_dia: 0, tienda_reservas_lista: APARTADAS, tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} }, tienda_comprar: { ticket: 'tc1', lineas: 2, unidades: 3, total: 40 }, tienda_deshacer_compra: { lineas: 2, borradas: 2 }, tienda_compras_lista: COMPRAS, tienda_ventas_lista: { total: 0, tickets: 0, sumas: {}, por_donde: {}, filas: [] }, ...rpc }
  const e = errores
  await ctx.addInitScript(([l, v, c, s, pr, x, e]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = { tienda_reservas: [{ id: 'r0', stock_id: 'st-1', tienda_id: 'user-2', unidades: 1, para: '@leo', hasta: new Date(Date.now() + 2 * 864e5).toISOString() }], tienda_compras: [{ id: 'cp1', ticket: 'tc1', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 150, comprada_el: new Date().toISOString(), created_at: new Date().toISOString() }], tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }], tienda_vistas: v, tcg_products: [{ id: 501, name: 'ETB de prueba', image: null, lang: 'en', market: 'WEST', cm_lowest: 70, cm_lowest_eu: 71 }] }
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

console.log('── 1. El stock ──')
{
  const { p, ctx, errs } = await abrir()
  check('sin errores', !errs.length, errs.join(' | '))
  check('la línea con algo apartado lleva su chapa', /1 apartada/.test(await p.textContent('tr[data-fila="st-1"] .tds-c-marcas')) && !(await p.locator('tr[data-fila="st-3"] .tds-apartada').count()))
  check('  …y al abrir el stock, lo caducado vuelve (se pregunta)', (await llamadas(p, 'tienda_reservas_al_dia')).length >= 1)
  await p.click('tr[data-fila="st-1"] .tds-c-nombre strong'); await p.waitForTimeout(800)
  check('su ficha dice lo apartado, con «Quitar»', /1 para @leo/.test(await p.textContent('#tdsEditar .tds-apartadas')))
  await p.click('#tdsEditar [data-quitar-apartada="r0"]'); await p.waitForTimeout(600)
  check('  …que lo devuelve', (await ultima(p, 'tienda_reserva_quitar'))?.p_reserva === 'r0' && !(await p.isVisible('#tdsEditar')))
  await p.click('tr[data-fila="st-2"] .tds-c-nombre strong'); await p.waitForTimeout(800)
  await p.click('#tdsEditar [data-apartar-esta]'); await p.waitForTimeout(800)
  check('«Apartar» abre su hoja, con el precio que cuenta (279)', (await p.isVisible('dialog.tda[open]')) && (await p.inputValue('.tda [data-precio]')) === '279')
  await p.click('.tda [data-tda="apartar"]'); await p.waitForTimeout(300)
  check('sin para quién, no aparta y lo dice', /para quién/.test(await p.textContent('.tda [data-error]')) && !(await llamadas(p, 'tienda_apartar')).length)
  await p.fill('.tda [data-para]', '@ane_tcg')
  await p.click('.tda [data-plazo="168"]')
  await p.click('.tda [data-paso="1"]')
  await p.click('.tda [data-tda="apartar"]'); await p.waitForTimeout(700)
  const a = await ultima(p, 'tienda_apartar')
  const dias = (new Date(a?.p_hasta).getTime() - Date.now()) / 864e5
  check('aparta: la línea, dos unidades, para quién, una semana y el precio', a?.p_stock === 'st-2' && a.p_unidades === 2 && a.p_para === '@ane_tcg' && dias > 6.9 && dias < 7.1 && a.p_precio === 279, JSON.stringify(a))
  check('  …cierra, lo dice con Deshacer y vuelve a pedir el stock', !(await p.isVisible('dialog.tda[open]')) && (await p.locator('.toast', { hasText: 'Apartadas 2 para @ane_tcg' }).count()) === 1 && (await llamadas(p, 'tienda_stock_lista')).length >= 2)
  await p.locator('.toast', { hasText: 'Apartadas 2' }).locator('.toast-accion').click(); await p.waitForTimeout(500)
  check('Deshacer, desde el aviso', (await ultima(p, 'tienda_reserva_quitar'))?.p_reserva === 'r1')
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir({ movil: true })
  await p.tap('tr[data-fila="st-2"] .tds-c-nombre strong').catch(() => p.click('tr[data-fila="st-2"] .tds-c-nombre strong')); await p.waitForTimeout(800)
  await p.click('#tdsEditar [data-apartar-esta]'); await p.waitForTimeout(800)
  await p.click('.tda [data-plazo="otro"]')
  check('móvil: «Otro día» enseña el día', await p.isVisible('.tda [data-dia]'))
  const r = await p.evaluate(() => { const d = document.querySelector('.tda').getBoundingClientRect(); return { abajo: Math.round(innerHeight - d.bottom), ancho: Math.round(d.width), alto: Math.round(d.height) } })
  check('móvil: la hoja desde abajo, a lo ancho y con alto', r.abajo <= 1 && r.ancho >= 388 && r.alto > 300 && !errs.length, JSON.stringify(r) + errs.join(' | '))
  await p.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1092-apartar.png' })
  await ctx.close()
}

console.log('── 2. El Panel ──')
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html', rpc: { tienda_reservas_al_dia: 1 } })
  check('sin errores', !errs.length, errs.join(' | '))
  check('«Apartadas» con las dos, lo que antes acaba primero', (await p.isVisible('.tdh-apartadas')) && (await p.textContent('.tdh-apartadas-n')) === '2' && (await p.$$eval('.tda-fila', (ls) => ls.map((l) => l.dataset.reserva).join())) === 'r1,r2')
  const f1 = (await p.textContent('.tda-fila[data-reserva="r1"]')).replace(/\s+/g, ' ')
  check('  …para quién, la carta, el precio y cuándo acaba («hoy» y en ámbar)', /Para @ane_tcg/.test(f1) && /Carta 2/.test(f1) && /170,00/.test(f1) && /(hoy|mañana) \d\d:\d\d/.test(f1) && (await p.locator('.tda-fila[data-reserva="r1"] .tda-pronto').count()) === 1, f1)
  check('las caducadas vuelven y se dice', (await p.locator('.toast', { hasText: 'caducó y vuelve' }).count()) >= 1)
  await p.click('[data-recoger="r1"]'); await p.waitForTimeout(700)
  check('«Recogida» apunta la venta (en el sitio de siempre) y lo dice con Deshacer y Recibo', (await ultima(p, 'tienda_reserva_recoger'))?.p_reserva === 'r1' && (await p.locator('.toast', { hasText: 'Recogida y vendida · 170,00' }).locator('.toast-accion').count()) === 2)
  await p.click('[data-quitar-reserva="r2"]')
  check('«Quitar» pide un segundo toque', (await p.textContent('[data-quitar-reserva="r2"]')) === '¿Seguro?' && !(await llamadas(p, 'tienda_reserva_quitar')).length)
  await p.click('[data-quitar-reserva="r2"]'); await p.waitForTimeout(600)
  check('  …y lo devuelve', (await ultima(p, 'tienda_reserva_quitar'))?.p_reserva === 'r2')
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html', rpc: { tienda_reservas_lista: [] } })
  check('nada apartado: la tarjeta no sale', !(await p.isVisible('.tdh-apartadas')) && !errs.length)
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir({ ruta: '/tienda.html', errores: { tienda_reservas_al_dia: { code: 'PGRST202', message: 'Could not find the function public.tienda_reservas_al_dia' } } })
  check('sin la migración: ni tarjeta ni errores', !(await p.isVisible('.tdh-apartadas')) && !errs.length)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
