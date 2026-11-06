// Tanda 1252 — el Panel de una tienda, nuevo (PINGU eligió lo recomendado):
// arriba la CARTERA (lo vendido en grande, cómo va y cuántas ventas, los
// periodos, la gráfica y cuatro cifras: beneficio, margen, valor del stock y
// visitas), luego lo que espera en PASTILLAS (ofertas por contestar y fotos
// pedidas primero, del color de la tienda; después los avisos del stock), y
// las filas con la foto de la carta. Y en el móvil nada se sale por un lado:
// la fila de «lo que busca la gente» empujaba «Avisar» fuera de la pantalla.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const pad = (n) => String(n).padStart(2, '0')
const d0 = new Date()
const t = (h) => `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}T${pad(h)}:00`
const VALORES = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 95, 0, 0, 0, 0, 179, 89.95, 0, 35.55, 0, 0, 0]
const HOY = {
  actual: { importe: 411.5, beneficio: 136.2, coste: 276.3, unidades: 6, ventas: 4, sin_coste: 1 },
  anterior: { importe: 350, beneficio: 100, coste: 250, unidades: 5, ventas: 3 },
  serie: VALORES.map((v, h) => ({ t: t(h), importe: v })),
  stock: { lineas: 812, unidades: 1212, valor: 8940, cm: 9120.4, coste: 5100 },
  avisos: { debajo: 7, pierden: 3, viejas: 41, agotadas: 0 },
  demanda: [
    { card_id: 'carta-1', market: 'WEST', quieren: 23, tienes: 2, nombre: 'Pikachu ex', set_id: 'set-0', numero: '238' },
    { card_id: 'carta-2', market: 'WEST', quieren: 1, tienes: 1, nombre: 'Mew ex', set_id: 'set-0', numero: '151' },
  ],
  visitas: { actual: 128, qr: 9, anterior: 98 },
}
const VENTAS = { total: 1, tickets: 1, sumas: {}, por_donde: {}, filas: [{ id: 'v1', ticket: 'tk1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 179, coste: 125, donde: 'mostrador', vendida_el: new Date().toISOString() }] }
const VACIO = { actual: { importe: 0, beneficio: null, coste: 0, unidades: 0, ventas: 0, sin_coste: 0 }, anterior: { importe: 0, beneficio: null, coste: 0, unidades: 0, ventas: 0 }, serie: VALORES.map((_, h) => ({ t: t(h), importe: 0 })), stock: { lineas: 0, unidades: 0, valor: 0, cm: 0, coste: 0 }, avisos: { debajo: 0, pierden: 0, viejas: 0, agotadas: 0 }, demanda: [], visitas: { actual: 0, qr: 0, anterior: 0 } }
const b = await chromium.launch()
async function abrir(ruta, { movil = false, rpc = {}, errores = {}, tienda = { user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1' }, stock = [{ id: 's1', tienda_id: 'user-2' }], qr = true, sesion = 'user-2', perfil = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }, perfiles = [], ofertas = [], fotos = [] } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1500, height: 950 } })
  await ctx.addInitScript(([r, e, ti, st, q, s, pf, pfs, of, fo]) => {
    if (!sessionStorage.getItem('ya')) {
      sessionStorage.setItem('ya', '1')
      localStorage.setItem('pokedoc-theme', 'light')
      if (q) localStorage.setItem('pd-tienda-qr-user-2', '1')
    }
    window.__FAKE_SESSION__ = s
    if (pf) window.__FAKE_PERFIL__ = pf
    window.__FAKE_PERFILES__ = pfs
    window.__FAKE_FILAS__ = { tiendas: ti ? [ti] : [], tienda_stock: st, tienda_ofertas: of, tienda_fotos_pedidas: fo }
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = r
    window.__RPC_ERRORES__ = e
  }, [{ tienda_hoy: HOY, tienda_ventas_lista: VENTAS, tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] }, ...rpc }, errores, tienda, stock, qr, sesion, perfil, perfiles, ofertas, fotos])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)


const OFERTAS = [
  { id: 'o1', tienda_id: 'user-2', estado: 'abierta', turno: 'tienda' },
  { id: 'o2', tienda_id: 'user-2', estado: 'abierta', turno: 'tienda' },
  { id: 'o3', tienda_id: 'user-2', estado: 'abierta', turno: 'comprador' },
  { id: 'o4', tienda_id: 'user-9', estado: 'abierta', turno: 'tienda' },
]
const FOTOS = [
  { id: 'f1', tienda_id: 'user-2', atendida_at: null },
  { id: 'f2', tienda_id: 'user-2', atendida_at: '2026-11-01T10:00:00Z' },
]

console.log('── 1. La cartera: lo vendido en grande ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { ofertas: OFERTAS, fotos: FOTOS })
  check('sin errores', !errs.length, errs.join(' | '))
  const vend = (await p.innerText('.tdh-vendido')).replace(/\s+/g, ' ')
  check('«Vendido hoy», la cifra, cómo va y cuántas ventas', /^Vendido hoy 411,50 € ▲ \+18 % que ayer a esta hora 4 ventas$/i.test(vend.trim()), vend)
  const tam = await p.evaluate(() => ({ cifra: parseFloat(getComputedStyle(document.querySelector('.tdh-vendido-cifra')).fontSize), otra: parseFloat(getComputedStyle(document.querySelector('.tdh-cifra-valor, .tdh-cifra b')).fontSize) }))
  check('  …y es la cifra más grande del panel', tam.cifra > tam.otra, JSON.stringify(tam))
  check('la gráfica y los periodos van DENTRO de la cartera', (await p.locator('.tdh-cartera .tdh-grafica').count()) === 1 && (await p.locator('.tdh-cartera [data-periodo]').count()) >= 4)
  const nombres = await p.$$eval('.tdh-cifras .tdh-cifra', (cs) => cs.map((c) => c.querySelector('small, h3, .tdh-cifra-titulo')?.textContent.trim()))
  check('debajo, cuatro cifras: beneficio, margen, valor del stock y visitas', JSON.stringify(nombres) === JSON.stringify(['Beneficio', 'Margen medio', 'Valor del stock', 'Visitas']), JSON.stringify(nombres))
  check('  …las visitas son una cifra más, con el QR y contra ayer', /128/.test(await p.innerText('.tdh-cifra.tdh-visitas')) && /9 desde el QR/.test(await p.innerText('.tdh-cifra.tdh-visitas')) && (await p.locator('p.tdh-visitas').count()) === 0)

  console.log('── 2. Lo que espera, en pastillas ──')
  const pills = await p.$$eval('.tdh-pendientes .tdh-aviso', (as) => as.map((a) => a.innerText.replace(/\s+/g, ' ').trim()))
  check('ofertas por contestar (solo las suyas y en su turno) y fotos pedidas (solo pendientes), delante', /^2 ofertas por contestar$/.test(pills[0]) && /^1 te pide fotos$/.test(pills[1]), pills.join(' | '))
  check('  …y después los avisos del stock, con su número aparte, y al final «Caja de hoy» (1256)', pills.length === 6 && /^7 por debajo de Cardmarket/.test(pills[2]) && pills[5] === 'Caja de hoy' && (await p.locator('.tdh-pendientes .tdh-aviso[data-filtro] .tdh-pill-n').count()) === 3, pills.join(' | '))
  check('  …lo que espera va de otro color', (await p.locator('.tdh-pill-toca').count()) === 2 && (await p.evaluate(() => getComputedStyle(document.querySelector('.tdh-pill-toca')).backgroundColor !== getComputedStyle(document.querySelector('.tdh-aviso[data-filtro]')).backgroundColor)))
  const cuentas = await p.evaluate(() => (window.__CUENTAS__ || null))
  await p.evaluate(() => { window.__sinRecargar = 1 })
  await p.click('.tdh-pill-toca'); await p.waitForTimeout(900)
  check('una pastilla de ofertas lleva a Ofertas, sin recargar', (await p.isVisible('[data-td-hoja="ofertas"]')) && (await p.evaluate(() => window.__sinRecargar)) === 1)

  console.log('── 3. Las filas con su foto ──')
  await p.click('.lat-seccion-enlace[data-ver="hoy"]'); await p.waitForTimeout(600)
  check('lo que busca la gente lleva la foto de la carta', (await p.locator('.tdh-demanda li .tdh-foto').count()) === 2)
  check('  …y las últimas ventas también', (await p.locator('.tdh-ultimas li .tdh-foto').count()) === 1)
  const foto = await p.evaluate(() => { const r = document.querySelector('.tdh-demanda .tdh-foto').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })
  check('  …a 36 px de ancho, con la proporción de una carta (hueco reservado)', foto.w === 36 && Math.abs(foto.h - Math.round(36 * 342 / 245)) <= 1, JSON.stringify(foto))
  check('  …y el nombre sigue siendo el nombre (la foto no se lo come)', /Pikachu ex/.test(await p.textContent('.tdh-demanda li:first-child strong')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { rpc: { tienda_hoy: VACIO, tienda_ventas_lista: { filas: [] } } })
  check('sin ventas: la lista lo dice en una línea, sin hueco en blanco', /Todavía no hay ventas en este periodo/.test(await p.textContent('.tdh-ultimas')))
  check('  …y sin nada pendiente, «Todo en orden» (y ninguna pastilla de ofertas)', /Todo en orden/.test(await p.textContent('.tdh-pendientes')) && (await p.locator('.tdh-pill-toca').count()) === 0)
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true, ofertas: OFERTAS, fotos: FOTOS })
  check('sin errores y sin salirse de ancho', !errs.length && (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, errs.join(' | '))
  const fuera = await p.evaluate(() => [...document.querySelectorAll('.tdh button, .tdh a')].filter((x) => !x.closest('.tdh-pendientes')).filter((x) => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5) }).map((x) => x.className))
  check('ningún botón ni enlace del panel se sale por un lado', !fuera.length, fuera.join(', '))
  const fila = await p.evaluate(() => { const c = document.querySelector('.tdh-pendientes'); const ys = new Set([...c.querySelectorAll('.tdh-aviso')].map((a) => Math.round(a.getBoundingClientRect().top))); return { lineas: ys.size, desliza: c.scrollWidth > c.clientWidth, oy: getComputedStyle(c).overflowY } })
  check('las pastillas, en UNA fila que se desliza (y no en vertical)', fila.lineas === 1 && fila.desliza && fila.oy === 'hidden', JSON.stringify(fila))
  check('la cifra de lo vendido, la primera de la pantalla', await p.evaluate(() => { const r = document.querySelector('.tdh-vendido-cifra').getBoundingClientRect(); return r.top < 400 && r.top > 0 }))
  check('las cuatro cifras a dos por fila', (await p.evaluate(() => getComputedStyle(document.querySelector('.tdh-cifras')).gridTemplateColumns.split(' ').length)) === 2)
  await p.screenshot({ path: '/tmp/panel-1252-movil.png', fullPage: true })
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { ofertas: OFERTAS, fotos: FOTOS })
  await p.screenshot({ path: '/tmp/panel-1252-pc.png', fullPage: true })
  const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.tdh-dos')).gridTemplateColumns.split(' ').length)
  check('en el PC, lo que busca la gente al lado de reservas y ventas', cols === 2, cols)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
