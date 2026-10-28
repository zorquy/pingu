// Tanda 1073 — «Hoy» de una tienda, en el navegador: las cuatro cifras con
// la comparación, la gráfica (una serie: barras del color de la sección, la
// mayor con su cifra y cada una con su fecha), las últimas ventas, los
// avisos que llevan al stock con su filtro, lo que busca la gente (sin
// nombres), las visitas, los periodos y los primeros pasos que se van al
// hacerlos. Y el escaparate cuenta sus visitas (las del QR aparte).
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
async function abrir(ruta, { movil = false, rpc = {}, errores = {}, tienda = { user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1' }, stock = [{ id: 's1', tienda_id: 'user-2' }], qr = true, sesion = 'user-2', perfil = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }, perfiles = [] } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1500, height: 950 } })
  await ctx.addInitScript(([r, e, ti, st, q, s, pf, pfs]) => {
    if (!sessionStorage.getItem('ya')) {
      sessionStorage.setItem('ya', '1')
      localStorage.setItem('pokedoc-theme', 'light')
      if (q) localStorage.setItem('pd-tienda-qr-user-2', '1')
    }
    window.__FAKE_SESSION__ = s
    if (pf) window.__FAKE_PERFIL__ = pf
    window.__FAKE_PERFILES__ = pfs
    window.__FAKE_FILAS__ = { tiendas: ti ? [ti] : [], tienda_stock: st }
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = r
    window.__RPC_ERRORES__ = e
  }, [{ tienda_hoy: HOY, tienda_ventas_lista: VENTAS, tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] }, ...rpc }, errores, tienda, stock, qr, sesion, perfil, perfiles])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

console.log('── 1. Hoy, con cifras ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  check('sin errores', !errs.length, errs.join(' | '))
  const pide = (await llamadas(p, 'tienda_hoy'))[0]
  check('pide hoy por horas, contra ayer a esta hora', pide?.p_paso === 'hour' && new Date(pide.p_desde).getHours() === 0 && new Date(pide.p_antes_hasta).getTime() < Date.now() - 23 * 36e5, JSON.stringify(pide))
  check('  …con las tres últimas ventas de hoy', (await llamadas(p, 'tienda_ventas_lista'))[0]?.p_cuantas === 3)
  check('hechos todos los primeros pasos, no salen', await p.isHidden('#tdPasosCaja'))
  const cifras = (await p.innerText('.tdh-cifras')).replace(/\s+/g, ' ')
  check('vendido, con «+18 % que ayer a esta hora»', /411,50 €/.test(cifras) && /\+18 % que ayer a esta hora/.test(cifras), cifras)
  check('beneficio y margen sobre lo pagado (136,20 € / 49 %), con lo que no tenía coste dicho', /\+136,20 €/.test(cifras) && /49 %/.test(cifras) && /1 sin coste/.test(cifras))
  check('el valor del stock a tu precio y en Cardmarket', /8\.940,00 €/.test(cifras) && /1212 uds\. · Cardmarket 9\.120,40 €/.test(cifras))
  check('la subida, en verde; con su texto (no solo color)', (await p.evaluate(() => getComputedStyle(document.querySelector('.tdh-sube')).color)) === 'rgb(13, 158, 110)')
  const g = await p.evaluate(() => ({ barras: document.querySelectorAll('.tdh-barra').length, max: document.querySelector('.tdh-barra-max')?.title, cifra: document.querySelector('.tdh-barra-cifra')?.textContent, color: getComputedStyle(document.querySelector('.tdh-barra-max i')).backgroundColor, eje: document.querySelector('.tdh-eje')?.innerText.replace(/\s+/g, ' ') }))
  check('la gráfica: 24 horas, la mayor con su cifra, en el color de la sección', g.barras === 24 && /^17 h · 179,00\s€$/.test(g.max) && /179,00/.test(g.cifra) && g.color === 'rgb(11, 114, 133)' && g.eje === '0 h 23 h', JSON.stringify(g))
  check('  …y dice lo que es para el lector de pantalla', /Ventas por hora: la mayor, 179,00\s€ \(17 h\)/.test(await p.getAttribute('.tdh-barras', 'aria-label')))
  check('las últimas ventas, con lo que dejaron', /Charizard ex/.test(await p.textContent('.tdh-ultimas')) && /\+54,00\s€/.test(await p.textContent('.tdh-ultimas')))
  const avisos = await p.$$eval('.tdh-aviso', (as) => as.map((a) => a.innerText.replace(/\s+/g, ' ')))
  check('los avisos que hay (sin el que está a cero)', avisos.length === 3 && /7 por debajo de Cardmarket/.test(avisos[0]) && /3 venden con pérdida/.test(avisos[1]) && /41 llevan más de 90 días/.test(avisos[2]), avisos.join(' | '))
  const dem = (await p.innerText('.tdh-demanda')).replace(/\s+/g, ' ')
  check('lo que busca la gente: cuántos y cuántas tienes, sin nombres', /Pikachu ex Obsidian Flames · 238 23 tienes 2/.test(dem) && /Mew ex/.test(dem) && /1 persona la tiene/.test(await p.getAttribute('.tdh-demanda li:nth-child(2) .tdh-quieren', 'title')), dem)
  const visitas = (await p.innerText('.tdh-visitas')).replace(/\s+/g, ' ')
  check('las visitas: 128, 9 desde el QR, y contra ayer', /128 visitas · 9 desde el QR/.test(visitas) && /\+31 % que ayer en todo el día/.test(visitas), visitas)
  await p.evaluate(() => { window.__sinRecargar = 1 })
  await p.click('.tdh-aviso[data-filtro="debajo"]'); await p.waitForTimeout(1200)
  check('un aviso lleva al stock con su filtro, sin recargar', (await p.isVisible('[data-td-hoja="stock"]')) && JSON.stringify((await ultima(p, 'tienda_stock_lista'))?.p_filtros) === '{"contra":["debajo"]}' && (await p.evaluate(() => window.__sinRecargar)) === 1, JSON.stringify(await ultima(p, 'tienda_stock_lista')))
  await p.click('.lat-seccion-enlace[data-ver="hoy"]'); await p.waitForTimeout(400)
  await p.click('[data-periodo="mes"]'); await p.waitForTimeout(800)
  const mes = await ultima(p, 'tienda_hoy')
  check('el Mes: por días, desde el 1, y la gráfica lo dice', mes.p_paso === 'day' && new Date(mes.p_desde).getDate() === 1 && (await p.textContent('.tdh-grafica-titulo')) === 'Ventas del mes')
  check('  …y lo recuerda', (await p.evaluate(() => localStorage.getItem('pd-tienda-periodo'))) === 'mes')
  await p.click('.tdh-ir'); await p.waitForTimeout(800)
  check('«Ver ventas» va a Ventas', await p.isVisible('[data-td-hoja="ventas"]'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { rpc: { tienda_hoy: VACIO, tienda_ventas_lista: { filas: [] } } })
  check('sin nada todavía: lo dice, sin inventar cifras', /Sin ventas en este periodo/.test(await p.textContent('.tdh-grafica')) && /Todo en orden/.test(await p.textContent('.tdh-avisos')) && /Nadie tiene en su lista/.test(await p.textContent('.tdh-demanda')))
  check('  …ni un beneficio ni un porcentaje que no existen', (await p.innerText('.tdh-cifras')).includes('—') && !/%.*que ayer/.test(await p.innerText('.tdh-cifras')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { errores: { tienda_hoy: { code: 'PGRST202', message: 'Could not find the function public.tienda_hoy' } } })
  check('sin la migración: dice cuáles faltan', /migraciones 1072 y 1073/.test(await p.textContent('#tdHoy')))
  await ctx.close()
}

console.log('── 2. Los primeros pasos ──')
{
  const { p, ctx } = await abrir('/tienda.html', { qr: false })
  check('sin el QR impreso, los pasos se ven', await p.isVisible('#tdPasosCaja'))
  await p.click('[data-td-ir="escaparate"]'); await p.waitForTimeout(800)
  await p.evaluate(() => { window.print = () => {} })
  await p.click('#tdImprimir'); await p.waitForTimeout(300)
  check('imprimir el cartel lo da por hecho, y los pasos se van', (await p.evaluate(() => localStorage.getItem('pd-tienda-qr-user-2'))) === '1' && (await p.evaluate(() => document.getElementById('tdPasosCaja').classList.contains('hidden'))))
  const qr = await p.evaluate(async () => { const { svgQR } = await import('/js/qr.js'); const t = document.createElement('div'); t.innerHTML = svgQR('https://pokedoc.es/usuario/prueba?utm_source=qr', { tam: 220 }); return document.getElementById('tdQr').innerHTML === t.innerHTML })
  check('el QR lleva la marca del QR (para contar sus visitas aparte)', qr && (await p.textContent('#tdEnlace')) === 'pokedoc.es/usuario/prueba')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { tienda: { user_id: 'user-2', ciudad: 'Bilbao' } })
  check('sin la dirección, los pasos siguen ahí', await p.isVisible('#tdPasosCaja'))
  await ctx.close()
}

console.log('── 3. Las visitas al escaparate ──')
const TIENDA = { id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&utm_source=qr', { perfil: null, perfiles: [TIENDA], rpc: { tienda_escaparate: { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] } } })
  check('alguien abre un escaparate desde el QR: una visita, marcada del QR', JSON.stringify((await llamadas(p, 'tienda_contar_visita'))[0]) === '{"p_tienda":"tienda-1","p_qr":true}', JSON.stringify(await llamadas(p, 'tienda_contar_visita')))
  await p.reload(); await p.waitForTimeout(2000)
  check('  …recargar no suma otra (una por navegador y día)', !(await llamadas(p, 'tienda_contar_visita')).length)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon', { sesion: 'none', perfil: null, perfiles: [TIENDA], rpc: { tienda_escaparate: { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] } } })
  check('sin cuenta también cuenta (sin QR)', JSON.stringify((await llamadas(p, 'tienda_contar_visita'))[0]) === '{"p_tienda":"tienda-1","p_qr":false}')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=prueba', { perfiles: [], rpc: { tienda_escaparate: { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] } } })
  check('la tienda mirando su propio escaparate no cuenta', !(await llamadas(p, 'tienda_contar_visita')).length)
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true })
  check('sin errores y sin salirse de ancho', !errs.length && (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, errs.join(' | '))
  check('las cifras a dos por fila', (await p.evaluate(() => getComputedStyle(document.querySelector('.tdh-cifras')).gridTemplateColumns.split(' ').length)) === 2)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
