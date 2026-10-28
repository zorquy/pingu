// Tanda 1089 — «Avisar a los que la buscan», en el navegador: en el Panel,
// «Lo que busca la gente y tienes» lleva «Avisar» en las cartas con alguien
// por avisar y «Avisadas · fecha» en las ya avisadas; avisar cambia en el
// acto, llama a la base con la carta y lo confirma con cuántos (nunca
// quién); si falla, vuelve. Sin la migración no hay botón. Y en /ajustes,
// quien no quiera estos avisos los apaga.
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
    { card_id: 'carta-2', market: 'WEST', quieren: 3, tienes: 1, nombre: 'Mew ex', set_id: 'set-0', numero: '151' },
    { card_id: 'carta-3', market: 'WEST', quieren: 1, tienes: 4, nombre: 'Pidgey', set_id: 'set-0', numero: '10' },
  ],
  visitas: { actual: 128, qr: 9, anterior: 98 },
}
const VENTAS = { total: 1, tickets: 1, sumas: {}, por_donde: {}, filas: [{ id: 'v1', ticket: 'tk1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 179, coste: 125, donde: 'mostrador', vendida_el: new Date().toISOString() }] }
const VACIO = { actual: { importe: 0, beneficio: null, coste: 0, unidades: 0, ventas: 0, sin_coste: 0 }, anterior: { importe: 0, beneficio: null, coste: 0, unidades: 0, ventas: 0 }, serie: VALORES.map((_, h) => ({ t: t(h), importe: 0 })), stock: { lineas: 0, unidades: 0, valor: 0, cm: 0, coste: 0 }, avisos: { debajo: 0, pierden: 0, viejas: 0, agotadas: 0 }, demanda: [], visitas: { actual: 0, qr: 0, anterior: 0 } }
const AVISOS = [
  { card_id: 'carta-1', market: 'WEST', pendientes: 21, avisadas: 0, ultimo: null },
  { card_id: 'carta-2', market: 'WEST', pendientes: 0, avisadas: 3, ultimo: '2026-10-20T10:00:00Z' },
  { card_id: 'carta-3', market: 'WEST', pendientes: 0, avisadas: 0, ultimo: null },
]
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
  }, [{ tienda_hoy: HOY, tienda_avisos_de: AVISOS, tienda_avisar: { avisadas: 21, antes: 0 }, tienda_ventas_lista: VENTAS, tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] }, ...rpc }, errores, tienda, stock, qr, sesion, perfil, perfiles])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

const fila = (p, card) => p.evaluate((c) => document.querySelector(`[data-tdh-avisar="${c}"]`)?.innerText.replace(/\s+/g, ' ').trim() || '', card)

console.log('── 1. El Panel ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  check('sin errores', !errs.length, errs.join(' | '))
  const pide = (await llamadas(p, 'tienda_avisos_de'))[0]
  check('pregunta por las cartas de la lista, con su catálogo', JSON.stringify(pide?.p_cartas) === JSON.stringify(HOY.demanda.map((x) => ({ card_id: x.card_id, market: 'WEST' }))), JSON.stringify(pide))
  check('con alguien por avisar: «Avisar»', (await fila(p, 'carta-1')) === 'Avisar' && (await p.locator('[data-tdh-avisar="carta-1"] [data-avisar]').count()) === 1, await fila(p, 'carta-1'))
  check('ya avisadas: «Avisadas · 20 oct», sin botón (en el móvil, sin la fecha)', /^Avisadas · 20 oct/.test(await fila(p, 'carta-2')) && !(await p.locator('[data-tdh-avisar="carta-2"] button').count()), await fila(p, 'carta-2'))
  check('nadie por avisar (lo apagaron): nada', (await fila(p, 'carta-3')) === '')
  check('el botón dice qué pasa, y que no sabrás quién', /No verás quiénes/.test(await p.getAttribute('[data-avisar]', 'title')))
  check('en ninguna parte sale un nombre de quien la busca', !/ane|jon|user-/i.test(await p.textContent('.tdh-demanda')))
  await p.click('[data-tdh-avisar="carta-1"] [data-avisar]')
  check('al tocarlo, ya dice «Avisadas»', /^Avisadas/.test(await fila(p, 'carta-1')))
  await p.waitForTimeout(600)
  check('  …avisa de esa carta', JSON.stringify(await ultima(p, 'tienda_avisar')) === JSON.stringify({ p_card: 'carta-1', p_market: 'WEST' }), JSON.stringify(await ultima(p, 'tienda_avisar')))
  check('  …y lo confirma con cuántos', /Avisamos a 21 personas que la buscan/.test(await p.textContent('.toast')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { rpc: { tienda_avisos_de: [{ card_id: 'carta-1', market: 'WEST', pendientes: 2, avisadas: 19, ultimo: '2026-10-20T10:00:00Z' }] } })
  check('ya avisadas y dos nuevas: «Avisar a 2 más»', (await fila(p, 'carta-1')) === 'Avisar a 2 más', await fila(p, 'carta-1'))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html', { errores: { tienda_avisar: { code: 'P0001', message: 'Esa carta no está a la vista en tu escaparate' } } })
  await p.click('[data-tdh-avisar="carta-1"] [data-avisar]'); await p.waitForTimeout(600)
  check('si la base dice que no, vuelve el botón', (await fila(p, 'carta-1')) === 'Avisar' && !errs.length, await fila(p, 'carta-1'))
  check('  …y dice por qué', /ya no está a la vista/.test(await p.textContent('.toast')))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html', { errores: { tienda_avisos_de: { code: 'PGRST202', message: 'Could not find the function public.tienda_avisos_de' } } })
  check('sin la migración: la lista igual, sin botones y sin errores', !errs.length && (await p.locator('.tdh-demanda li').count()) === 3 && !(await p.locator('[data-avisar]').count()))
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true })
  const r = await p.evaluate(() => {
    const li = document.querySelector('[data-tdh-avisar="carta-1"]').closest('li')
    const b = li.querySelector('[data-avisar]').getBoundingClientRect()
    return { ancho: document.documentElement.scrollWidth, dentro: b.right <= li.getBoundingClientRect().right + 1, alto: Math.round(b.height), fila: li.getBoundingClientRect().height < 80 }
  })
  check('en el móvil, «Avisadas» sin la fecha', (await p.evaluate(() => document.querySelector('[data-tdh-avisar="carta-2"]').innerText.trim())) === 'Avisadas')
  check('en el móvil, en la misma fila, a 44 px y sin salirse', !errs.length && r.ancho <= 390 && r.dentro && r.alto >= 44 && r.fila, JSON.stringify(r))
  await ctx.close()
}
await b.close()

console.log('── 2. /ajustes ──')
{
  const b2 = await chromium.launch()
  const ctx = await b2.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1'; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  await p.goto(`${BASE}/ajustes.html`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200)
  const fila = p.locator('#ajCanal label', { has: p.locator('[data-interruptor="tiendas"]') })
  check('«Cuando una tienda tiene una carta que buscas», puesto', /Cuando una tienda tiene una carta que buscas/.test((await fila.textContent()) || '') && (await p.isChecked('[data-interruptor="tiendas"]')))
  await p.click('#ajCanal [data-interruptor="tiendas"]'); await p.waitForTimeout(600)
  const perfil = await p.evaluate(() => (window.__TABLAS__ || {}).user_profiles?.find((x) => x.id === 'user-1'))
  check('  …apagarlo escribe tienda_la_tiene', JSON.stringify(perfil?.notification_prefs_disabled) === '["tienda_la_tiene"]', JSON.stringify(perfil?.notification_prefs_disabled))
  await b2.close()
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
