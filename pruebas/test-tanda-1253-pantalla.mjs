// Tanda 1253 — el SKU con su código de barras y su QR, en el navegador:
//  · el Code 128 es el del estándar (las barras de un SKU, módulo a módulo,
//    contra la tabla de referencia) y la etiqueta lo PINTA de verdad: se lee
//    una fila de píxeles de la tira de abajo y tiene que dar ese SKU;
//  · /s/<tienda>/<SKU> abre el escaparate con el pop-up de esa copia (y cuenta
//    la visita como de QR); si quien escanea es la tienda, va a esa línea de
//    su stock;
//  · en el Stock y en Vender, un SKU y un Intro (lo que manda un lector USB)
//    abren la línea o la meten en la venta, una unidad por lectura.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El código de barras ──')
const cb = await import(`${RAIZ}/js/codigo-barras.js`)
const tp = await import(`${RAIZ}/js/tiendas-puro.js`)
// «OBF-2-ES-NM» en Code 128 B, sacado símbolo a símbolo de la tabla de
// JsBarcode (la 1253 comprobó las 107 contra la nuestra).
const REFERENCIA = '110100100001000111011010001011000100011000101001101110011001110010100110111001000110100011011101000100110111001011100011010111011000111001001101100011101011'
check('«OBF-2-ES-NM», módulo a módulo como la referencia', cb.modulosDe('OBF-2-ES-NM') === REFERENCIA)
const m = cb.modulosDe('ASC-276-ES-NM-H')
check('cada símbolo, 11 módulos, y la parada 13 (con su barra final)', m.length === 11 * (1 + 15 + 1) + 13 && m.startsWith('11010010000') && m.endsWith('1100011101011'))
check('solo cifras en número par: el juego C, la mitad de largo', cb.simbolosDe('123456')[0] === 105 && cb.modulosDe('123456').length === 11 * (1 + 3 + 1) + 13)
check('lo que no es ASCII imprimible no se codifica (sin inventar)', cb.modulosDe('ÑU-1') === null && cb.modulosDe('') === null)
check('parece un SKU: tres trozos o más con guiones', tp.pareceSku('ASC-276-ES-NM-H') && tp.pareceSku(' sel-555-es ') && !tp.pareceSku('Pikachu ex') && !tp.pareceSku('PSA-10') && !tp.pareceSku('ASC 276 ES'))
check('el QR lleva la tienda y el SKU en pokedoc.es', tp.enlaceDeSku('rincon', 'OBF-2-ES-NM') === 'https://pokedoc.es/s/rincon/OBF-2-ES-NM')
const stock = readFileSync(`${RAIZ}/js/tienda-stock.js`, 'utf8')
check('las etiquetas del Stock llevan el SKU y el QR a /s/', /sku: skuDe\(/.test(stock) && /enlaceDe: \(f\) => enlaceDeSku\(perfil\?\.username, f\.sku\)/.test(stock))
const toml = readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
check('netlify.toml sirve /s/<tienda>/<SKU> con el escaparate', /from = "\/s\/:username\/:sku"\s*\n\s*to = "\/usuario\.html\?u=:username"\s*\n\s*status = 200/.test(toml))

const TIENDA = { id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda', avatar_url: null }
const ESC = [
  { id: 'e1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: 95, de_tu_lista: false },
  { id: 'e2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', idioma: 'en', estado: 'EX', variante: 'reverse', gradeo: null, unidades: 2, precio: 30, de_tu_lista: false },
  { id: 'e2b', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: 40, de_tu_lista: false },
]
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const LISTA = {
  total: 2, en_stock: 3, sumas: { unidades: 3, coste: 100, precio: 200, cm: 210, sin_coste: 0, sin_precio: 0 }, facetas: { catalogo: { WEST: 2 }, sets: { 'set-0': 2 } },
  filas: [
    { id: 'st-1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', rareza: 'Common', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 2, coste: 40, precio: 60, cm: 58, ubicacion: null, visible: true, notas: null, entro_el: hace(3) },
    { id: 'st-2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', rareza: 'Common', idioma: 'en', estado: 'EX', variante: 'reverse', gradeo: null, unidades: 1, coste: 20, precio: 30, cm: 31, ubicacion: null, visible: true, notas: null, entro_el: hace(5) },
  ],
}
// Lo que contesta `tienda_sku_buscar` (la base la prueba test-tanda-1253.mjs).
const POR_SKU = {
  'OBF-2-ES-NM': [{ id: 'e2b', card_id: 'carta-2', market: 'WEST', product_id: null, idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 40, nombre: 'Carta 2' }],
  'OBF-1-ES-NM': [{ id: 'st-1', card_id: 'carta-1', market: 'WEST', product_id: null, idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, precio: 60, nombre: 'Carta 1', visible: true }],
}
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: `Carta ${i}`, rarity: 'Common', variants: { normal: true, reverse: true } }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF' }]

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', sinMigracion = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([s, esc, lista, porSku, cartas, sets, tienda, sinMig]) => {
    window.__FAKE_SESSION__ = s
    if (s === tienda.id) window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: tienda.display_name, username: tienda.username }
    window.__FAKE_PERFILES__ = [tienda]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: tienda.id, ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }] }
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_SETS__ = sets
    window.__FAKE_IDIOMAS_SET__ = { 'set-0': ['de', 'en', 'es', 'fr', 'it'] }
    window.__RPC_RESPUESTAS__ = {
      tienda_escaparate: (a) => {
        const f = a.p_filtros || {}
        const sale = esc.filter((x) => (!f.carta || x.card_id === f.carta) && (!f.id || x.id === f.id))
        return { total: sale.length, en_escaparate: esc.length, de_tu_lista: 0, precios: true, facetas: { catalogo: { WEST: esc.length } }, filas: sale }
      },
      tienda_stock_lista: lista,
      idiomas_de_set: ['es', 'en', 'fr', 'de', 'it'],
      tienda_sku_buscar: (a) => porSku[String(a.p_sku || '').toUpperCase()] || [],
    }
    if (sinMig) window.__RPC_ERRORES__ = { tienda_sku_buscar: { code: 'PGRST202', message: 'Could not find the function public.tienda_sku_buscar' } }
  }, [sesion, ESC, LISTA, POR_SKU, CARTAS, SETS, TIENDA, sinMigracion])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2400)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)

console.log('── 2. La etiqueta pinta el SKU y se lee ──')
{
  const { p, ctx } = await abrir('/tienda.html', { sesion: 'tienda-1' })
  for (const formato of ['a4', 'rollo']) {
    const r = await p.evaluate(async ({ formato }) => {
      const m = await import('/js/tienda-etiquetas.js')
      const cbm = await import('/js/codigo-barras.js')
      const { FORMATOS_ETIQUETA } = await import('/js/tiendas-puro.js')
      const f = FORMATOS_ETIQUETA[formato]
      const PX = 8
      const c = document.createElement('canvas')
      c.width = Math.round(f.anchoMm * PX); c.height = Math.round(f.altoMm * PX)
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      const sku = 'OBF-2-ES-NM'
      m.dibujarEtiqueta(ctx, { nombre: 'Carta 2', detalle: 'OBF · 2 · ES · NM', precio: 40, sku }, { x: 0, y: 0, w: f.anchoMm, h: f.altoMm, enlace: 'https://pokedoc.es/s/rincon/OBF-2-ES-NM' })
      // Una fila de píxeles por la mitad de las barras (la tira va abajo).
      const altoBarras = f.altoMm > 32 ? 6.5 : 5
      const y = Math.round((f.altoMm - 2.5 * 0.6 - (altoBarras + 2.6) + altoBarras / 2) * PX)
      const d = ctx.getImageData(0, y, c.width, 1).data
      let fila = ''
      for (let i = 0; i < c.width; i++) fila += d[i * 4] < 128 ? '1' : '0'
      const primero = fila.indexOf('1'); const ultimo = fila.lastIndexOf('1')
      const barras = fila.slice(primero, ultimo + 1)
      // El módulo: la primera barra del inicio B mide 2 módulos.
      const modulo = barras.indexOf('0') / 2
      let leido = ''
      for (let i = 0; i < barras.length; i += modulo) leido += barras[i]
      return { ok: leido === cbm.modulosDe(sku), modulo, margen: primero / modulo, derecha: (c.width - 1 - ultimo) / modulo, enteros: Number.isInteger(modulo) }
    }, { formato })
    check(`${formato}: la fila de la tira dice OBF-2-ES-NM, módulo a módulo`, r.ok, JSON.stringify(r))
    check(`${formato}:   …con un módulo de píxeles enteros y su zona en blanco a cada lado`, r.enteros && r.modulo >= 2 && r.margen >= 10 && r.derecha >= 10, JSON.stringify(r))
  }
  const sinSku = await p.evaluate(async () => {
    const m = await import('/js/tienda-etiquetas.js')
    const c = document.createElement('canvas'); c.width = 560; c.height = 297
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 560, 297)
    m.dibujarEtiqueta(ctx, { nombre: 'Carta 2', detalle: 'OBF', precio: 40 }, { x: 0, y: 0, w: 70, h: 37.125, enlace: 'https://pokedoc.es/tiendas/rincon' })
    const d = ctx.getImageData(0, 280, 300, 1).data
    let negros = 0
    for (let i = 0; i < 300; i++) if (d[i * 4] < 128) negros++
    return negros
  })
  check('sin SKU, la etiqueta es la de antes (sin tira de barras abajo)', sinSku < 40, sinSku)
  await ctx.close()
}

console.log('── 3. El QR: /s/<tienda>/<SKU> ──')
{
  const { p, ctx, errs } = await abrir('/s/rincon/OBF-2-ES-NM')
  check('sin errores', !errs.length, errs.join(' | '))
  const pide = (await llamadas(p, 'tienda_sku_buscar'))[0]
  check('busca ese SKU en ESA tienda', pide?.p_tienda === 'tienda-1' && pide?.p_sku === 'OBF-2-ES-NM', JSON.stringify(pide))
  check('el escaparate entero con el pop-up de esa copia', (await p.isVisible('dialog.ptc[open]')) && (await p.textContent('#ptcTitulo')) === 'Carta 2' && (await p.getAttribute('[data-ptc-linea="e2b"]', 'aria-pressed')) === 'true' && (await p.locator('.pt-rejilla .pt-carta').count()) >= 2)
  const u = new URL(p.url())
  check('la dirección queda en /tiendas/rincon con la carta, sin el SKU', u.pathname === '/tiendas/rincon' && u.searchParams.get('carta') === 'carta-2' && u.searchParams.get('linea') === 'e2b' && !u.searchParams.has('sku'), p.url())
  check('la visita cuenta como del QR', (await llamadas(p, 'tienda_contar_visita'))[0]?.p_qr === true)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/s/rincon/OBF-9-ES-NM')
  check('un SKU que ya no está: la tienda, sin pop-up, y lo dice', !(await p.isVisible('dialog.ptc[open]')) && /ya no está en esta tienda/.test(await p.textContent('body')) && !new URL(p.url()).searchParams.has('sku'))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/s/rincon/OBF-1-ES-NM', { sesion: 'tienda-1' })
  await p.waitForTimeout(1500)
  const u = new URL(p.url())
  check('si escanea la propia tienda: a su stock con ese SKU', u.pathname.replace(/\.html$/, '') === '/tienda' && u.searchParams.get('ver') === 'stock' && u.searchParams.get('sku') === 'OBF-1-ES-NM', p.url())
  check('  …y se abre esa línea para editarla, con su SKU escrito', (await p.isVisible('#tdsEditar[open]')) && (await p.textContent('#tdsEditar .tds-sku span')) === 'OBF-1-ES-NM', errs.join(' | '))
  check('  …sin contar su propia visita', !(await llamadas(p, 'tienda_contar_visita')).length)
  await ctx.close()
}

console.log('── 4. El lector USB en el Stock ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock', { sesion: 'tienda-1' })
  check('la lupa dice que se puede buscar por SKU', /SKU/.test(await p.getAttribute('[data-tds-q]', 'placeholder')))
  await p.fill('[data-tds-q]', 'Carta'); await p.press('[data-tds-q]', 'Enter'); await p.waitForTimeout(600)
  check('un texto normal con Intro no busca un SKU', !(await llamadas(p, 'tienda_sku_buscar')).length)
  await p.fill('[data-tds-q]', 'obf-1-es-nm'); await p.press('[data-tds-q]', 'Enter'); await p.waitForTimeout(1200)
  check('un SKU y un Intro: lo busca (en mayúsculas) y abre la línea', JSON.stringify((await llamadas(p, 'tienda_sku_buscar')).at(-1)) === '{"p_tienda":null,"p_sku":"OBF-1-ES-NM"}' && (await p.isVisible('#tdsEditar[open]')), errs.join(' | '))
  check('  …y la lista se queda con esa carta', (await p.inputValue('[data-tds-q]')) === 'Carta 1')
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  await p.fill('[data-tds-q]', 'OBF-7-ES-NM'); await p.press('[data-tds-q]', 'Enter'); await p.waitForTimeout(900)
  check('un SKU que no tienes: lo dice', /Ninguna línea de tu stock con el SKU OBF-7-ES-NM/.test(await p.textContent('body')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock', { sesion: 'tienda-1', sinMigracion: true })
  await p.fill('[data-tds-q]', 'OBF-1-ES-NM'); await p.press('[data-tds-q]', 'Enter'); await p.waitForTimeout(900)
  check('sin la migración: dice cuál falta, no «no está»', /migración 1253/.test(await p.textContent('body')))
  await ctx.close()
}

console.log('── 5. Vender con el lector ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?vender=1', { sesion: 'tienda-1' })
  check('Vender dice que se puede escanear', /escanea la etiqueta/.test(await p.getAttribute('#tdvBusca', 'placeholder')))
  await p.fill('#tdvBusca', 'OBF-1-ES-NM'); await p.press('#tdvBusca', 'Enter'); await p.waitForTimeout(1200)
  const una = await p.evaluate(() => [...document.querySelectorAll('.tdv [data-linea]')].map((l) => l.dataset.linea))
  check('un SKU y un Intro: la línea entra en la venta y la caja se vacía', JSON.stringify(una) === '["st-1"]' && (await p.inputValue('#tdvBusca')) === '' && (await p.locator('#tdvResultados:not([hidden])').count()) === 0, JSON.stringify(una) + errs.join(' | '))
  await p.fill('#tdvBusca', 'OBF-1-ES-NM'); await p.press('#tdvBusca', 'Enter'); await p.waitForTimeout(1200)
  check('otra lectura: otra unidad de la misma línea', /2/.test(await p.textContent('.tdv [data-linea="st-1"]')) && (await p.locator('.tdv [data-linea]').count()) === 1)
  await p.fill('#tdvBusca', 'OBF-1-ES-NM'); await p.press('#tdvBusca', 'Enter'); await p.waitForTimeout(1000)
  check('con las dos ya en la venta: «No te quedan más»', /No te quedan más de OBF-1-ES-NM/.test(await p.textContent('body')))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
