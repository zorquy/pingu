// Tanda 1430 — Lo que busca la gente y NO tienes, en la pantalla:
//   · con Tienda (o en prueba): la tarjeta del Panel con lo que da la base,
//     cuántos la buscan y su precio de Cardmarket;
//   · con Puesto: la tarjeta sale, pero dice que es de Tienda y no pregunta;
//   · sin la migración (`tienda_buscan_y_no_tienes` falla): la tarjeta no sale;
//   · si no falta nada: «tienes todo lo que busca la gente»;
//   · en Comprar, «N la buscan» en las cartas que alguien tiene en «La quiero»
//     (y nada en las que no; con Puesto, ni se pregunta).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const en = (d) => new Date(Date.now() + d * 864e5).toISOString()
const PLAN = {
  tienda: { plan: 'tienda', pagado: 'tienda', prueba_hasta: en(-30), pagado_hasta: en(20), fundadora: true, se_queda: 'tienda', existe: true },
  puesto: { plan: 'puesto', pagado: 'puesto', prueba_hasta: en(-30), pagado_hasta: en(20), fundadora: true, se_queda: 'puesto', existe: true },
}
const BUSCAN = [
  { card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '125', quieren: 7, cardmarket: 64.5 },
  { card_id: 'carta-2', market: 'WEST', nombre: 'Umbreon VMAX', set_id: 'set-0', numero: '215', quieren: 3, cardmarket: null },
]
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: i === 1 ? 'Pikachu ex' : `Pikachu ${i}`, rarity: 'Common', variants: { normal: true } }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF', release_date: '2023-08-11' }]

const b = await chromium.launch()
async function abrir({ plan, movil = false, rpc = {}, errores = {}, ruta = '/tienda.html' } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas Bilbao', username: 'cartasbilbao' }
    try { localStorage.setItem('pd-tienda', '{"u":"cartasbilbao","id":"user-2"}'); localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', con_local: true, precio_visible: true }], tcg_products: [] }
    window.__FAKE_CARTAS__ = d.cartas
    window.__FAKE_SETS__ = d.sets
    window.__RPC_RESPUESTAS__ = {
      tienda_reservas_al_dia: 0,
      tienda_hoy: { actual: { importe: 100, ventas: 2, beneficio: 30, coste: 70, sin_coste: 0 }, anterior: { importe: 50, ventas: 1, beneficio: 10 }, serie: [], paso: 'hour', stock: { valor: 1000, unidades: 20, lineas: 10, coste: 700 }, visitas: { actual: 5, anterior: 3 }, avisos: {}, demanda: [] },
      tienda_ventas_lista: { total: 0, tickets: 0, sumas: { unidades: 0, importe: 0 }, por_donde: {}, filas: [] },
      ...(d.plan ? { tienda_mi_plan: d.plan } : {}),
      ...d.rpc,
    }
    window.__RPC_ERRORES__ = d.errores
  }, { plan, rpc, errores, cartas: CARTAS, sets: SETS })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errs.push(String(e).slice(0, 200)) })
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).length, n)
const texto = async (p, sel) => ((await p.innerText(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim()

console.log('── Con Tienda: la tarjeta del Panel ──')
{
  const { p, ctx, errs } = await abrir({ plan: PLAN.tienda, rpc: { tienda_buscan_y_no_tienes: BUSCAN } })
  check('sin errores', !errs.length, errs.join(' | '))
  check('la tarjeta sale', await p.isVisible('.tdh-buscan'))
  const t = await texto(p, '.tdh-buscan')
  check('con su título y «cuántos, nunca quién»', /Lo que busca la gente y no tienes/.test(t) && /nunca quién/.test(t), t)
  check('las dos cartas, en el orden de la base', (await p.locator('.tdh-buscan-lista li').count()) === 2 && /Charizard ex[\s\S]*Umbreon VMAX/.test(t), t)
  check('cuántos la buscan y el precio de Cardmarket', /7/.test(await texto(p, '.tdh-buscan-lista li:first-child .tdh-quieren')) && /Cardmarket 64,50/.test(t), t)
  check('la que no tiene precio, sin «Cardmarket»', !/Cardmarket/.test(await texto(p, '.tdh-buscan-lista li:nth-child(2)')))
  check('se pregunta una vez, con 8', (await llamadas(p, 'tienda_buscan_y_no_tienes')) === 1)
  await p.locator('.tdh-buscan').scrollIntoViewIfNeeded()
  await p.locator('.tdh-buscan').screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/c1430-pc.png' }).catch(() => {})
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir({ plan: PLAN.tienda, movil: true, rpc: { tienda_buscan_y_no_tienes: BUSCAN } })
  const ancho = await p.evaluate(() => { const r = document.querySelector('.tdh-buscan')?.getBoundingClientRect(); return r ? Math.round(r.right) : 0 })
  check('en el móvil, sin salirse', !errs.length && ancho > 0 && ancho <= 390, `${ancho}`)
  await p.locator('.tdh-buscan').scrollIntoViewIfNeeded()
  await p.locator('.tdh-buscan').screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/c1430-movil.png' }).catch(() => {})
  await ctx.close()
}

console.log('── Con Puesto: dice de qué plan es ──')
{
  const { p, ctx, errs } = await abrir({ plan: PLAN.puesto, rpc: { tienda_buscan_y_no_tienes: BUSCAN } })
  const t = await texto(p, '.tdh-buscan')
  check('la tarjeta sale con «Con Tienda (29 €/mes…)» y «Ver planes»', !errs.length && /Con Tienda \(29/.test(t) && /Ver planes/.test(t), t)
  check('…y no pregunta a la base', (await llamadas(p, 'tienda_buscan_y_no_tienes')) === 0)
  await ctx.close()
}

console.log('── Sin la migración ──')
{
  const { p, ctx, errs } = await abrir({ plan: PLAN.tienda, errores: { tienda_buscan_y_no_tienes: { code: 'PGRST202', message: 'Could not find the function' } } })
  check('la tarjeta no sale', !errs.length && !(await p.isVisible('.tdh-buscan')))
  await ctx.close()
}

console.log('── No falta nada ──')
{
  const { p, ctx } = await abrir({ plan: PLAN.tienda, rpc: { tienda_buscan_y_no_tienes: [] } })
  check('«tienes todo lo que busca la gente»', /tienes todo lo que busca la gente/.test(await texto(p, '.tdh-buscan')))
  await ctx.close()
}

console.log('── En Comprar: «N la buscan» ──')
{
  const { p, ctx, errs } = await abrir({ plan: PLAN.tienda, ruta: '/tienda.html?ver=stock', rpc: { tienda_quieren: [{ card_id: 'carta-1', quieren: 23 }, { card_id: 'carta-2', quieren: 2 }], tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] } } })
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(1500)
  const chapas = await p.$$eval('#tdcResultados .tdc-quieren', (xs) => xs.map((x) => x.textContent.trim()))
  check('sin errores', !errs.length, errs.join(' | '))
  check('«23 la buscan» y «2 la buscan», y nada en las demás', chapas.length === 2 && chapas.some((c) => /23 la buscan/.test(c)) && chapas.some((c) => /^2 la buscan/.test(c)), JSON.stringify(chapas))
  const args = await p.evaluate(() => (window.__RPCS__ || []).filter((r) => r.nombre === 'tienda_quieren').at(-1)?.args)
  check('pregunta por las cartas encontradas', Array.isArray(args?.p_cards) && args.p_cards.includes('carta-1'), JSON.stringify(args))
  await p.locator('#tdcResultados').screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/c1430-comprar.png' }).catch(() => {})
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ plan: PLAN.puesto, ruta: '/tienda.html?ver=stock', rpc: { tienda_quieren: [{ card_id: 'carta-1', quieren: 23 }], tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] } } })
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  await p.fill('#tdcBusca', 'pikachu'); await p.waitForTimeout(1500)
  check('con Puesto, Comprar sin chapas y sin preguntar', (await p.locator('#tdcResultados .tdc-quieren').count()) === 0 && (await llamadas(p, 'tienda_quieren')) === 0)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
