// Tanda 1072 — vender y las ventas, en el navegador: la hoja de Vender (el
// botón de arriba en el PC, el del centro de la barra en el móvil, la ficha
// de una línea y «Seleccionar» del stock), con el precio puesto, las
// unidades sin pasar de lo que hay, dónde se vendió, la cuenta y Deshacer;
// y la pestaña Ventas con sus periodos, dónde, la búsqueda, las sumas de la
// base, deshacer con dos toques y el CSV.
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

console.log('── 1. Vender, desde el botón de arriba ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  check('sin errores', !errs.length, errs.join(' | '))
  check('el botón Vender está arriba, en el color de la sección', (await p.isVisible('.tdm-vender')) && (await p.evaluate(() => getComputedStyle(document.querySelector('.tdm-vender')).backgroundColor)) === 'rgb(11, 114, 133)')
  await p.click('.tdm-vender'); await p.waitForTimeout(800)
  check('abre la hoja, con el cursor en el buscador', (await p.isVisible('.tdv')) && (await p.evaluate(() => document.activeElement?.id)) === 'tdvBusca')
  check('  …y vacía lo dice', /Busca una carta de tu stock/.test(await p.textContent('#tdvLineas')) && (await p.isDisabled('#tdvVendida')))
  await p.fill('#tdvBusca', 'char'); await p.waitForTimeout(800)
  const busca = await ultima(p, 'tienda_stock_lista')
  check('busca en el stock, solo lo que tiene unidades', busca?.p_filtros?.q === 'char' && JSON.stringify(busca.p_filtros.unidades) === '["una","varias"]', JSON.stringify(busca))
  const res = await p.$$eval('.tdv-resultado', (bs) => bs.map((x) => x.innerText.replace(/\s+/g, ' ')))
  check('  …con su set, número, idioma, estado y versión, precio y unidades', res.length === 3 && /Charizard ex Obsidian Flames · 199 · ES · NM 179,00\s€ 2 uds\./.test(res[0]) && /EN · EX · Reverse holo/.test(res[1]), res.join(' | '))
  await p.click('.tdv-resultado >> nth=0'); await p.waitForTimeout(300)
  check('elegir una: a la lista, con su precio puesto, y la búsqueda se va', (await p.inputValue('[data-precio]')) === '179' && (await p.isHidden('#tdvResultados')) && (await p.inputValue('#tdvBusca')) === '')
  check('  …lo que costó y la cuenta (179 €, +54 €, 43 %)', /Te costó 125,00\s€/.test(await p.textContent('.tdv-linea')) && /179,00\s€/.test(await p.textContent('#tdvCuenta')) && /\+54,00\s€/.test(await p.textContent('#tdvCuenta')) && /43 %/.test(await p.textContent('#tdvCuenta')))
  check('  …una menos, no (ya es una)', await p.isDisabled('[data-paso="-1"]'))
  await p.click('[data-paso="1"]')
  check('una más: dos, y no más (hay dos)', (await p.textContent('.tdv-paso b')) === '2' && (await p.isDisabled('[data-paso="1"]')))
  await p.fill('[data-precio]', '170')
  check('cambiar el precio cambia la cuenta (340 €, +90 €)', /340,00\s€/.test(await p.textContent('#tdvCuenta')) && /\+90,00\s€/.test(await p.textContent('#tdvCuenta')) && /Vendida · 340,00\s€/.test(await p.textContent('#tdvVendida')))
  await p.fill('#tdvBusca', 'pid'); await p.waitForTimeout(800)
  await p.click('.tdv-resultado >> nth=2'); await p.waitForTimeout(300)
  check('una sin precio: hay que ponerlo antes de vender', (await p.isDisabled('#tdvVendida')) && /Pon el precio/.test(await p.textContent('#tdvError')))
  await p.click('.tdv-linea:nth-child(2) [data-quitar]')
  check('  …quitarla deja vender', !(await p.isDisabled('#tdvVendida')))
  await p.click('[data-donde="cardmarket"]')
  check('dónde: Mostrador de entrada, Cardmarket al tocarlo', (await p.getAttribute('[data-donde="cardmarket"]', 'aria-pressed')) === 'true' && (await p.getAttribute('[data-donde="mostrador"]', 'aria-pressed')) === 'false')
  await p.click('#tdvVendida'); await p.waitForTimeout(800)
  const v = await ultima(p, 'tienda_vender')
  check('«Vendida» pide la venta: la línea, dos unidades a 170, en Cardmarket', JSON.stringify(v?.p_lineas) === '[{"stock_id":"s1","unidades":2,"precio":170}]' && v?.p_donde === 'cardmarket', JSON.stringify(v))
  check('  …cierra la hoja y lo dice, con Deshacer', !(await p.isVisible('.tdv')) && /Vendidas 2 · 340,00\s€ · \+90,00\s€/.test(await p.textContent('.toast')) && (await p.isVisible('.toast-accion')))
  check('  …y recuerda dónde para la próxima', (await p.evaluate(() => localStorage.getItem('pd-tienda-donde'))) === 'cardmarket')
  // Desde la 1084 el aviso lleva también «Recibo»: se pulsa Deshacer por su nombre.
  await p.click('.toast-accion:has-text("Deshacer")'); await p.waitForTimeout(600)
  check('Deshacer deshace esa venta', (await ultima(p, 'tienda_deshacer_venta'))?.p_ticket === 'tk9')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { errores: { tienda_vender: { code: '22023', message: 'No quedan tantas: de una línea hay 1.' } } })
  await p.click('.tdm-vender'); await p.waitForTimeout(500)
  await p.fill('#tdvBusca', 'char'); await p.waitForTimeout(800)
  await p.click('.tdv-resultado >> nth=0'); await p.click('#tdvVendida'); await p.waitForTimeout(600)
  check('si la base dice que no, lo dice y la hoja se queda', (await p.isVisible('.tdv')) && /No quedan tantas/.test(await p.textContent('#tdvError')) && !(await p.isDisabled('#tdvVendida')))
  await ctx.close()
}

console.log('── 2. Desde el stock ──')
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock')
  await p.click('[data-tds="seleccionar"]'); await p.waitForTimeout(300)
  await p.click('[data-marcar="s1"]'); await p.click('[data-marcar="s2"]')
  await p.click('[data-bloque="vender"]'); await p.waitForTimeout(800)
  check('«Seleccionar» → Vender: la hoja con las marcadas', (await p.isVisible('.tdv')) && (await p.locator('.tdv-linea').count()) === 2, await p.locator('.tdv-linea').count())
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  await p.click('[data-tds="seleccionar"]'); await p.waitForTimeout(300)
  await p.click('[data-fila="s2"]'); await p.waitForTimeout(800)
  await p.click('[data-vender-esta]'); await p.waitForTimeout(800)
  check('la ficha de una línea → Vender: la hoja con esa', (await p.isVisible('.tdv')) && (await p.locator('.tdv-linea').count()) === 1 && /Umbreon VMAX/.test(await p.textContent('.tdv-linea')))
  const antes = (await llamadas(p, 'tienda_stock_lista')).length
  await p.click('#tdvVendida'); await p.waitForTimeout(800)
  check('vender vuelve a pedir el stock (las unidades cambian)', (await llamadas(p, 'tienda_stock_lista')).length > antes)
  await ctx.close()
}

console.log('── 3. Ventas ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ventas')
  check('sin errores', !errs.length, errs.join(' | '))
  const pide = (await llamadas(p, 'tienda_ventas_lista'))[0]
  check('pide el mes de entrada', pide?.p_filtros?.desde && pide.p_filtros.hasta && new Date(pide.p_filtros.desde).getDate() === 1, JSON.stringify(pide))
  const cifras = (await p.innerText('.tdvt-cifras')).replace(/\s+/g, ' ')
  check('las sumas de la base: vendido, ventas, beneficio, margen, unidades y por dónde', /363,95 € 3 ventas/.test(cifras) && /\+115,95 €/.test(cifras) && /47 %/.test(cifras) && /Mostrador 268,95 € · Cardmarket 95,00 €/.test(cifras), cifras)
  const dias = await p.$$eval('.tdvt-dia h3', (hs) => hs.map((h) => h.textContent))
  check('por días: Hoy y Ayer', dias.join() === 'Hoy,Ayer', dias.join())
  const fila = (await p.textContent('.tdvt-fila')).replace(/\s+/g, ' ')
  check('cada venta: qué, dónde, cuánto y lo que dejó', /Charizard ex/.test(fila) && /Obsidian Flames · 199 · ES · NM · Mostrador/.test(fila) && /179,00 €/.test(fila) && /\+54,00 €/.test(fila), fila)
  await p.click('[data-periodo="todo"]'); await p.waitForTimeout(400)
  check('«Todo»: sin fechas', !('desde' in ((await ultima(p, 'tienda_ventas_lista'))?.p_filtros || {})))
  await p.click('[data-donde="cardmarket"]'); await p.waitForTimeout(400)
  check('dónde: solo Cardmarket', JSON.stringify((await ultima(p, 'tienda_ventas_lista')).p_filtros.donde) === '["cardmarket"]' && (await p.getAttribute('[data-donde=""]', 'aria-pressed')) === 'false')
  await p.click('[data-donde=""]'); await p.waitForTimeout(400)
  check('  …y «Todo» lo quita', !('donde' in (await ultima(p, 'tienda_ventas_lista')).p_filtros))
  await p.fill('[data-tdvt-q]', 'umbreon'); await p.waitForTimeout(700)
  check('buscar', (await ultima(p, 'tienda_ventas_lista')).p_filtros.q === 'umbreon')
  await p.click('[data-deshacer="tk1"]')
  check('Deshacer pide un segundo toque', /Vuelve al stock/.test(await p.textContent('[data-deshacer="tk1"]')) && !(await llamadas(p, 'tienda_deshacer_venta')).length)
  await p.click('[data-deshacer="tk1"]'); await p.waitForTimeout(700)
  check('  …y con él, deshace esa venta y vuelve a pedir la lista', (await ultima(p, 'tienda_deshacer_venta'))?.p_ticket === 'tk1' && (await llamadas(p, 'tienda_ventas_lista')).length >= 6)
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('[data-tdvt="exportar"]')])
  const nombre = d?.suggestedFilename() || ''
  const texto = d ? await (await import('node:fs/promises')).readFile(await d.path(), 'utf8') : ''
  check('Exportar: un CSV con su cabecera', /^ventas-prueba-\d{4}-\d{2}-\d{2}\.csv$/.test(nombre) && texto.startsWith('﻿fecha;venta;id;') && texto.split('\n').length === 4, nombre)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=ventas', { errores: { tienda_ventas_lista: { code: 'PGRST202', message: 'Could not find the function public.tienda_ventas_lista' } } })
  check('sin la migración: dice cuál falta', /migración 1072/.test(await p.textContent('.tdvt-lista')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=ventas', { rpc: { tienda_ventas_lista: { total: 0, tickets: 0, sumas: { importe: 0, unidades: 0, beneficio: 0, coste: 0, importe_con_coste: 0, sin_coste: 0 }, por_donde: {}, filas: [] } } })
  check('sin ventas: lo dice, con Vender', /Aún no hay ventas/.test(await p.textContent('.tdvt-lista')))
  await p.click('.tdvt-lista [data-tdvt="vender"]'); await p.waitForTimeout(700)
  check('  …que abre la hoja', await p.isVisible('.tdv'))
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true, tema: 'dark' })
  check('sin errores', !errs.length, errs.join(' | '))
  check('arriba no hay botón Vender (va en la barra)', !(await p.isVisible('.tdm-vender')))
  const r = await p.evaluate(() => { const a = document.querySelector('.bm a.bm-vender svg').getBoundingClientRect(); const o = document.querySelector('.bm a[data-ver="stock"] span').getBoundingClientRect(); const v = document.querySelector('.bm a.bm-vender span').getBoundingClientRect(); return { circulo: Math.round(a.width), fila: Math.abs(v.top - o.top) } })
  check('Vender en el centro, en su círculo, con la palabra en la fila de las otras', r.circulo === 40 && r.fila <= 2, JSON.stringify(r))
  await p.tap('.bm a.bm-vender'); await p.waitForTimeout(800)
  const caja = await p.evaluate(() => { const d = document.querySelector('.tdv').getBoundingClientRect(); return { abajo: Math.round(innerHeight - d.bottom), ancho: Math.round(d.width) } })
  check('abre la hoja, desde abajo y a lo ancho', (await p.isVisible('.tdv')) && caja.abajo <= 1 && caja.ancho >= 388, JSON.stringify(caja))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html', { movil: true })
  await p.tap('.bm a.bm-vender'); await p.waitForTimeout(2500)
  check('desde Mensajes: al panel, con la hoja abierta', /\/tienda/.test(p.url()) && (await p.isVisible('.tdv')) && !/vender=/.test(p.url()), p.url())
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=ventas', { movil: true })
  check('Ventas en el móvil, sin salirse de ancho', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
