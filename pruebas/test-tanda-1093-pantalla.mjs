// Tanda 1093 — etiquetas para imprimir: lo puro (dónde cae cada una, una por
// unidad, el PDF de varias páginas) y en el navegador, desde «Seleccionar» del
// Stock y desde «⋯»: la hoja con los dos formatos, la vista previa, «empezar
// en la etiqueta N», y el PDF de verdad (A4 o una por página) con lo que
// tiene que decir —nombre, detalle, precio y la oferta tachada— y sin el coste.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
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

console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  const e = P.etiquetasDeLineas([{ id: 'a', unidades: 3 }, { id: 'b', unidades: 1 }], { porUnidad: true })
  check('una por unidad: 3 + 1', e.map((x) => x.id).join() === 'a,a,a,b')
  check('  …o una por línea', P.etiquetasDeLineas([{ id: 'a', unidades: 3 }, { id: 'b', unidades: 1 }]).length === 2)
  let c = P.colocarEtiquetas(26, 'a4')
  check('26 en la hoja de 24: dos páginas, la 25 arriba a la izquierda de la segunda', c.paginas === 2 && c.sitios[24].pagina === 1 && c.sitios[24].x === 0 && c.sitios[24].y === 0 && c.sitios[2].x === 140 && c.sitios[3].y === 37.125)
  c = P.colocarEtiquetas(3, 'a4', 23)
  check('empezando en la 24: la primera en la última casilla y las otras en otra hoja', c.sitios[0].pagina === 0 && c.sitios[0].x === 140 && c.sitios[0].y === 37.125 * 7 && c.sitios[1].pagina === 1 && c.paginas === 2)
  check('en el rollo, una por página (y «saltar» no cuenta)', P.colocarEtiquetas(3, 'rollo', 5).paginas === 3)
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9])
  const pdf = Buffer.from(P.pdfDeImagenes([{ jpeg, ancho: 10, alto: 20 }, { jpeg, ancho: 10, alto: 20 }], { anchoPt: 595.28, altoPt: 841.89 })).toString('latin1')
  const pos = [...pdf.matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]))
  check('un PDF de dos páginas: ocho objetos, cada posición en su objeto', pos.length === 8 && pos.every((p, i) => pdf.slice(p, p + 8) === `${i + 1} 0 obj\n`) && /\/Kids \[3 0 R 6 0 R\] \/Count 2/.test(pdf) && (pdf.match(/MediaBox \[0 0 595.28 841.89\]/g) || []).length === 2)
}

console.log('── En el Stock ──')
{
  const { p, ctx, errs } = await abrir({ lista: { ...LISTA, filas: LISTA.filas.map((f) => (f.id === 'st-1' ? { ...f, oferta_precio: 80, oferta_hasta: null } : f)) } })
  await p.evaluate(() => {
    window.__TEXTOS__ = []
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__TEXTOS__.push(String(t)); return fill.call(this, t, ...r) }
  })
  await p.click('[data-tds-menu="mas"]'); await p.click('.tds-menu [data-tds="etiquetas"]'); await p.waitForTimeout(300)
  check('«Etiquetas» en «⋯» sin nada marcado: a marcar, y lo dice', (await p.isVisible('.tds-sel')) && /Marca las cartas/.test(await p.textContent('.toast')))
  await p.check('[data-marcar="st-1"]'); await p.check('[data-marcar="st-2"]'); await p.waitForTimeout(200)
  await p.click('.tds-sel [data-bloque="etiquetas"]'); await p.waitForTimeout(1500)
  check('abre la hoja de etiquetas', await p.isVisible('dialog.tde[open]'))
  check('una por unidad: 1 + 2 = 3, en una página de 24', /3 etiquetas · 1 página de 24/.test(await p.textContent('.tde [data-cuenta]')), await p.textContent('.tde [data-cuenta]'))
  check('  …con su vista previa', /^blob:/.test((await p.getAttribute('.tde [data-vista]', 'src')) || ''))
  const t = await p.evaluate(() => window.__TEXTOS__.join(' | '))
  check('dice el nombre, el detalle con el código de la colección, el precio y la oferta con el de antes', /Carta 1/.test(t) && /Carta 2/.test(t) && /OBF · 2 · EN · NM · Reverse/.test(t) && /80,00\s€/.test(t) && /95,00\s€/.test(t) && /279,00\s€/.test(t), t)
  check('  …y nunca lo que costó (62 y 210)', !/62,00|210,00/.test(t), t)
  await p.uncheck('.tde [data-por-unidad]'); await p.waitForTimeout(800)
  check('una por línea: 2', /2 etiquetas/.test(await p.textContent('.tde [data-cuenta]')))
  await p.fill('.tde [data-saltar]', '24'); await p.dispatchEvent('.tde [data-saltar]', 'change'); await p.waitForTimeout(800)
  check('empezando en la 24 de una hoja empezada: dos páginas', /2 etiquetas · 2 páginas/.test(await p.textContent('.tde [data-cuenta]')))
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('.tde [data-tde="pdf"]')])
  const pdf = readFileSync(await d1.path()).toString('latin1')
  check('«Descargar PDF»: un PDF A4 de dos páginas', /^etiquetas-rincon-\d{4}-\d\d-\d\d\.pdf$/.test(d1.suggestedFilename()) && pdf.startsWith('%PDF-1.4') && /\/Count 2/.test(pdf) && /MediaBox \[0 0 595.28 841.89\]/.test(pdf), d1.suggestedFilename())
  await p.click('.tde [data-formato="rollo"]'); await p.waitForTimeout(800)
  check('«Una por carta»: sin «empezar en», una página por etiqueta', !(await p.isVisible('.tde-saltar')) && /2 etiquetas · 2 páginas\.$/.test(await p.textContent('.tde [data-cuenta]')))
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('.tde [data-tde="pdf"]')])
  const pdf2 = readFileSync(await d2.path()).toString('latin1')
  check('  …y su PDF, de 62 × 29 mm', /\/Count 2/.test(pdf2) && /MediaBox \[0 0 175.75 82.2\]/.test(pdf2))
  check('lo elegido se recuerda', JSON.parse(await p.evaluate(() => localStorage.getItem('pd-tienda-etiquetas'))).formato === 'rollo')
  check('sin errores', !errs.length, errs.join(' | '))
  await p.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1093-pc.png' })
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir({ movil: true })
  await p.click('[data-tds-menu="mas"]'); await p.click('.tds-menu [data-tds="seleccionar"]'); await p.waitForTimeout(300)
  await p.check('[data-marcar="st-1"]'); await p.waitForTimeout(200)
  const barra = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, ver: !!document.querySelector('.tds-sel [data-bloque="etiquetas"]').getBoundingClientRect().width }))
  check('móvil: «Etiquetas» en la barra de abajo sin salirse de ancho', barra.ancho <= 390 && barra.ver, JSON.stringify(barra))
  await p.click('.tds-sel [data-bloque="etiquetas"]').catch(() => {}); await p.waitForTimeout(1500)
  await p.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1093-movil.png' })
  check('móvil: la hoja, sin errores', (await p.isVisible('dialog.tde[open]')) && !errs.length, errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
