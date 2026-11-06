// Tandas 1254–1256 — el Mostrador, en el navegador. El botón del centro del
// móvil abre el abanico (Comprar, Vender, Escanear, Caja de hoy y lo de hoy),
// se cierra con la «×», tocando fuera o con Escape; en el PC, Comprar | Vender
// arriba. Vender no ofrece lo que está por poner a la venta, «Escanear» deja
// el cursor esperando al lector, y sin la migración 1254 vende como antes y
// deja de preguntar cómo se paga. La caja de hoy suma por forma de pago y dice
// cuánto efectivo debería haber. «Por poner a la venta» (1255): la franja del
// Stock, la hoja con «A la venta» de una en una y todas, y la pastilla del
// Panel con «Caja de hoy». Y el recibo dice cómo se pagó.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const hoy = new Date().toISOString()
const STOCK = { total: 2, en_stock: 2, sumas: {}, facetas: {}, filas: [
  { id: 's1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 125, precio: 250, cm: 240, visible: true, entro_el: hoy },
  // La comprada que espera precio (1255): la lista del stock la trae, Vender no.
  { id: 'pp1', card_id: 'carta-4', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '4', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 48, precio: null, cm: 72, visible: false, entro_el: hoy },
] }
const FILAS = {
  tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1' }],
  tienda_stock: [
    { id: 's1', tienda_id: 'user-2', card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 125, precio: 250, por_poner: false, visible: true, entro_el: hoy },
    { id: 'pp1', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 48, valorado: 80, precio: null, por_poner: true, visible: false, entro_el: hoy },
    { id: 'pp2', tienda_id: 'user-2', card_id: 'carta-2', market: 'WEST', idioma: 'en', estado: 'EX', gradeo: 'PSA 9', variante: 'normal', unidades: 2, coste: 5, valorado: null, precio: null, por_poner: true, visible: false, entro_el: hoy },
  ],
  tienda_ventas: [
    { ticket: 'a', tienda_id: 'user-2', card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 240, coste: 125, pago: 'efectivo', precio_lista: 250, donde: 'mostrador', vendida_el: hoy, created_at: hoy },
    { ticket: 'b', tienda_id: 'user-2', card_id: 'carta-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, precio: 30, coste: null, pago: 'tarjeta', precio_lista: 30, donde: 'mostrador', vendida_el: hoy, created_at: hoy },
  ],
  tienda_compras: [{ ticket: 'c', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 20, pago: 'efectivo', comprada_el: hoy, created_at: hoy }],
}
const CARTAS = Array.from({ length: 6 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: i === 4 ? 'Pikachu ex' : i === 1 ? 'Charizard ex' : `Carta ${i}` }))
const HOY = { actual: { importe: 300, ventas: 2, beneficio: 115, coste: 125, sin_coste: 1 }, anterior: null, serie: [], stock: { valor: 250, unidades: 2 }, visitas: { actual: 0 } }

const b = await chromium.launch()
// `sinPago`: la base sin la 1254 (tienda_vender con p_pago no existe).
async function abrir(ruta, { movil = false, sinPago = false, rpc = {} } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript(([f, c, st, h, r, sp]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = f
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = { tienda_stock_lista: st, tienda_hoy: h, tienda_vender: { ticket: 'a', lineas: 1, total: 250, beneficio: 125, sin_coste: 0, rebaja: 0, pago: 'efectivo' }, tienda_poner_a_la_venta: (a) => ({ puestas: (a.p_ids || []).length, sin_precio: 0 }), tienda_reservas_al_dia: 0, ...r }
    window.__TEXTOS__ = []
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...x) { window.__TEXTOS__.push(String(t)); return fill.call(this, t, ...x) }
    if (sp) window.__RPC_ERRORES__ = { tienda_vender: (a) => ('p_pago' in a ? { code: 'PGRST202', message: 'Could not find the function public.tienda_vender(p_donde, p_lineas, p_pago)' } : null) }
  }, [FILAS, CARTAS, STOCK, HOY, rpc, sinPago])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

console.log('── 1. El abanico (móvil) ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true })
  check('sin errores', !errs.length, errs.join(' | '))
  const centro = p.locator('.bm a[data-ver="mostrador"]')
  check('el centro de la barra se llama Mostrador', (await centro.textContent()).trim() === 'Mostrador' && (await centro.getAttribute('href')) === '/tienda?mostrador=1')
  await centro.tap(); await p.waitForTimeout(500)
  check('abre el abanico: Comprar y Vender en grande, Escanear y Caja de hoy', (await p.isVisible('.tdm-gran-comprar')) && (await p.isVisible('.tdm-gran-vender')) && (await p.isVisible('[data-tdm="escanear"]')) && (await p.isVisible('[data-tdm="caja"]')))
  check('  …y no navega', !/mostrador=/.test(p.url()), p.url())
  check('  …el botón dice «Cerrar», con su «×» y aria-expanded', (await centro.textContent()).trim() === 'Cerrar' && (await centro.getAttribute('aria-expanded')) === 'true')
  const hoyTxt = (await p.textContent('[data-tdm-hoy]')).replace(/\s+/g, ' ')
  check('  …lo de hoy: 2 ventas por 300 € y 1 compra por 40 €', /2 ventas · 300,00\s€/.test(hoyTxt) && /1 compra · 40,00\s€/.test(hoyTxt), hoyTxt)
  const capas = await p.evaluate(() => ({ velo: +getComputedStyle(document.querySelector('.tdm-velo')).zIndex, panel: +getComputedStyle(document.querySelector('.tdm-panel')).zIndex, barra: +getComputedStyle(document.querySelector('.bm')).zIndex, abajoPanel: Math.round(document.querySelector('.tdm-panel').getBoundingClientRect().bottom), arribaBarra: Math.round(document.querySelector('.bm').getBoundingClientRect().top) }))
  check('  …por encima del velo, y la barra encima (para cerrar), sin taparla', capas.panel > capas.velo && capas.barra > capas.velo && capas.abajoPanel <= capas.arribaBarra, JSON.stringify(capas))
  check('  …sin salirse de ancho', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await centro.tap(); await p.waitForTimeout(300)
  check('el mismo botón lo cierra y vuelve a «Mostrador»', !(await p.isVisible('.tdm-gran-comprar')) && (await centro.textContent()).trim() === 'Mostrador' && !(await p.evaluate(() => document.documentElement.classList.contains('tdm-abierto'))))
  await centro.tap(); await p.waitForTimeout(300)
  await p.mouse.click(195, 150); await p.waitForTimeout(300)
  check('tocar fuera lo cierra', !(await p.isVisible('.tdm-gran-comprar')))
  await centro.tap(); await p.waitForTimeout(300)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  check('Escape lo cierra', !(await p.isVisible('.tdm-gran-comprar')))
  await centro.tap(); await p.waitForTimeout(300)
  await p.tap('[data-tdm="escanear"]'); await p.waitForTimeout(800)
  check('Escanear: Vender con el cursor esperando al lector', (await p.isVisible('.tdv')) && (await p.evaluate(() => document.activeElement?.id)) === 'tdvBusca' && /Escanea la etiqueta/.test(await p.getAttribute('#tdvBusca', 'placeholder')) && !(await p.isVisible('.tdm-gran-comprar')))
  await p.tap('.tdv [data-modo="comprar"]'); await p.waitForTimeout(800)
  check('  …y «Comprar» arriba cambia a la otra hoja', (await p.isVisible('.tdc')) && !(await p.isVisible('.tdv:not(.tdc)')))
  await p.tap('.tdc [data-modo="vender"]'); await p.waitForTimeout(800)
  check('  …y «Vender» vuelve', (await p.isVisible('.tdv:not(.tdc)')) && !(await p.isVisible('.tdc')))
  await ctx.close()
}

console.log('── 2. Vender: lo que está por poner a la venta no sale ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  check('arriba, en el PC, Comprar | Vender', (await p.isVisible('.tdm-p-comprar')) && (await p.isVisible('.tdm-p-vender')) && !(await p.isVisible('.tdm-gran-comprar')))
  await p.click('.tdm-p-vender'); await p.waitForTimeout(700)
  await p.fill('#tdvBusca', 'ex'); await p.waitForTimeout(900)
  const res = await p.$$eval('.tdv-resultado', (bs) => bs.map((x) => x.innerText.replace(/\s+/g, ' ')))
  check('solo Charizard: el Pikachu comprado y sin poner a la venta no se vende', res.length === 1 && /Charizard ex/.test(res[0]), res.join(' | '))
  await p.click('.tdv-resultado'); await p.click('#tdvVendida'); await p.waitForTimeout(700)
  check('vender a su precio: «Vendido por» vacío manda 250 y efectivo', JSON.stringify((await ultima(p, 'tienda_vender'))?.p_lineas) === '[{"stock_id":"s1","unidades":1,"precio":250}]' && (await ultima(p, 'tienda_vender'))?.p_pago === 'efectivo')
  await p.click('.toast-accion:has-text("Recibo")'); await p.waitForTimeout(1500)
  const textos = await p.evaluate(() => window.__TEXTOS__.join(' | '))
  check('el recibo dice cómo se pagó', (await p.isVisible('.tdr')) && /Pagado con Efectivo/.test(textos), textos.slice(0, 300))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { sinPago: true })
  await p.click('.tdm-p-vender'); await p.waitForTimeout(700)
  await p.fill('#tdvBusca', 'char'); await p.waitForTimeout(900)
  await p.click('.tdv-resultado'); await p.click('#tdvVendida'); await p.waitForTimeout(800)
  const intentos = await llamadas(p, 'tienda_vender')
  check('sin la migración 1254: vende como antes (sin forma de pago)', intentos.length === 2 && 'p_pago' in intentos[0] && !('p_pago' in intentos[1]) && /Vendida/.test(await p.textContent('.toast')), JSON.stringify(intentos))
  check('  …y deja de preguntar cómo se paga', !(await p.isVisible('.tdv .tdm-pagos')))
  await p.fill('#tdvBusca', 'char'); await p.waitForTimeout(900)
  await p.click('.tdv-resultado'); await p.click('#tdvVendida'); await p.waitForTimeout(800)
  check('  …y la siguiente va directa por el camino de antes', (await llamadas(p, 'tienda_vender')).length === 3 && !('p_pago' in (await ultima(p, 'tienda_vender'))))
  await ctx.close()
}

console.log('── 3. La caja de hoy ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true })
  await p.tap('.bm a[data-ver="mostrador"]'); await p.waitForTimeout(400)
  await p.tap('[data-tdm="caja"]'); await p.waitForTimeout(900)
  const t = (await p.innerText('.tdk')).replace(/\s+/g, ' ')
  check('se abre con lo vendido (300 €, 2 ventas) y lo comprado (40 €, 1 compra)', /VENDIDO 300,00\s€ 2 ventas/i.test(t) && /COMPRADO 40,00\s€ 1 compra/i.test(t), t)
  check('  …lo ganado (115 €, una sin coste) y lo rebajado (10 €)', /\+115,00\s€ 1 sin coste/.test(t) && /REBAJADO 10,00\s€/i.test(t), t)
  const filas = await p.$$eval('.tdk-tabla tbody tr', (trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()))
  check('  …por forma de pago: efectivo entra 240 y sale 40, tarjeta 60', filas.length === 2 && /Efectivo 240,00\s€ −40,00\s€/.test(filas[0]) && /Tarjeta 60,00\s€ —/.test(filas[1]), filas.join(' | '))
  check('  …y el efectivo que debería haber: 200 €', /200,00\s€/.test(await p.textContent('.tdk-efectivo-caja')))
  check('  …sin salirse de ancho', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 4. Por poner a la venta ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  const pills = (await p.$$eval('.tdh-pendientes a', (as) => as.map((a) => a.innerText.replace(/\s+/g, ' ').trim()))).join(' | ')
  check('el Panel: la pastilla «2 por poner a la venta» y «Caja de hoy»', /2 por poner a la venta/.test(pills) && /Caja de hoy/.test(pills), pills)
  await p.click('.tdh-pendientes a:has-text("Caja de hoy")'); await p.waitForTimeout(900)
  check('  …«Caja de hoy» la abre ahí mismo', (await p.isVisible('.tdk')) && !/caja=/.test(p.url()))
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  await p.click('.tdh-pendientes a:has-text("por poner")'); await p.waitForTimeout(2500)
  check('  …la de por poner lleva al Stock con la hoja abierta', /ver=stock/.test(p.url()) && (await p.isVisible('.tdpp')), p.url())
  const lineas = await p.$$eval('.tdpp-linea', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ')))
  check('las dos, con lo que pagaste y lo que vale', lineas.length === 2 && /Pikachu ex/.test(lineas[0]) && /48,00\s€ · 80,00\s€/.test(lineas[0]) && /PSA 9/.test(lineas[1]), lineas.join(' | '))
  check('  …el precio vacío con lo que vale en gris', (await p.getAttribute('[data-linea="pp1"] [data-precio]', 'placeholder')) === '80,00' && (await p.getAttribute('[data-linea="pp2"] [data-precio]', 'placeholder')) === 'Precio')
  await p.fill('[data-linea="pp1"] [data-precio]', '85')
  await p.click('[data-poner="pp1"]'); await p.waitForTimeout(700)
  check('«A la venta» con el precio escrito', JSON.stringify(await ultima(p, 'tienda_poner_a_la_venta')) === '{"p_ids":["pp1"],"p_precio":85}' && /ya está a la venta/i.test(await p.textContent('.toast')), JSON.stringify(await ultima(p, 'tienda_poner_a_la_venta')))
  await p.click('#tdppTodas').catch(() => {})
  await p.waitForTimeout(700)
  check('«Todas a la venta» sin precio escrito: una llamada con todas', JSON.stringify(await ultima(p, 'tienda_poner_a_la_venta')).includes('"p_precio":null'), JSON.stringify(await llamadas(p, 'tienda_poner_a_la_venta')))
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  check('la franja del Stock lo cuenta', /2\s*compradas por poner a la venta/.test(await p.textContent('.tdpp-caja')))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
