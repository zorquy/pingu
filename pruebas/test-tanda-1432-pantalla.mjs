// Tanda 1432 — Novedades de una tienda, en la pantalla:
//   · /tienda → Escaparate con Tienda: la tarjeta, cuántos la siguen, el botón
//     se enciende al escribir, «Añadir cartas» busca en el stock, la carta
//     elegida va en el `p_cartas` de `tienda_publicar_novedad`;
//   · ya contó una esta semana: lo dice con la fecha, sin el formulario; lo que
//     ha contado, con «Avisaste a N» y Borrar en dos toques;
//   · con Puesto: dice que es de Tienda, sin formulario;
//   · sin la migración: la tarjeta no sale;
//   · el escaparate público: «Noticias de la tienda» con el texto y sus cartas,
//     y la que llega por #novedad-<id>, marcada;
//   · Ajustes → Avisos tiene la fila «Novedades de las tiendas que sigues».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const S = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const en = (d) => new Date(Date.now() + d * 864e5).toISOString()
const PLAN = {
  tienda: { plan: 'tienda', pagado: 'tienda', prueba_hasta: en(-30), pagado_hasta: en(20), fundadora: true, se_queda: 'tienda', existe: true },
  puesto: { plan: 'puesto', pagado: 'puesto', prueba_hasta: en(-30), pagado_hasta: en(20), fundadora: true, se_queda: 'puesto', existe: true },
}
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: ['Charizard ex', 'Mew ex', 'Pikachu', 'Eevee'][i], rarity: 'Common' }))
const SETS = [{ id: 'set-0', name: '151', market: 'WEST', tcg_online_code: 'MEW' }]
const NOVEDAD = { id: 'nov-1', tienda_id: 'user-2', texto: 'Ha llegado la caja de 151: Charizard y Mew. ¡Pásate!', cartas: [{ card_id: 'carta-0', market: 'WEST' }, { card_id: 'carta-1', market: 'WEST' }], avisados: 12, created_at: en(-2) }
const STOCK = { total: 2, en_stock: 2, sumas: {}, facetas: {}, filas: [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '0', unidades: 1, precio: 60 },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', unidades: 2, precio: 20 },
] }

const b = await chromium.launch()
async function abrir(ruta, { plan, movil = false, rpc = {}, errores = {}, filas = {}, sesion = 'user-2', perfil = { tipo: 'tienda', display_name: 'Cartas Bilbao', username: 'cartasbilbao' } } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') {
      window.__FAKE_PERFIL__ = d.perfil
      try { localStorage.setItem('pd-tienda', '{"u":"cartasbilbao","id":"user-2"}') } catch {}
    } else if (d.sesion) {
      window.__FAKE_PERFIL__ = { tipo: 'persona', display_name: 'Ane', username: 'ane' }
    }
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'cartasbilbao', display_name: 'Cartas Bilbao', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', con_local: true, precio_visible: true }], tcg_products: [], ...d.filas }
    window.__FAKE_CARTAS__ = d.cartas
    window.__FAKE_SETS__ = d.sets
    window.__RPC_RESPUESTAS__ = {
      tienda_reservas_al_dia: 0,
      tienda_hoy: { actual: { importe: 0, ventas: 0, beneficio: 0, coste: 0, sin_coste: 0 }, anterior: {}, serie: [], paso: 'hour', stock: {}, visitas: {}, avisos: {}, demanda: [] },
      tienda_escaparate: { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] },
      ...(d.plan ? { tienda_mi_plan: d.plan } : {}),
      ...d.rpc,
    }
    window.__RPC_ERRORES__ = d.errores
  }, { plan, rpc, errores, filas, sesion, perfil, cartas: CARTAS, sets: SETS })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errs.push(String(e).slice(0, 200)) })
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const texto = async (p, sel) => ((await p.innerText(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim()

console.log('── Escaparate con Tienda: escribir y publicar ──')
for (const movil of [false, true]) {
  const { p, ctx, errs } = await abrir('/tienda.html?ver=escaparate', { plan: PLAN.tienda, movil, rpc: { tienda_novedades_estado: { seguidores: 12, ultima_at: null, proxima: null }, tienda_stock_lista: STOCK, tienda_publicar_novedad: { vale: true, id: 'nov-2', avisados: 12, proxima: en(7) } } })
  const que = movil ? 'móvil' : 'PC'
  check(`${que}: sin errores`, !errs.length, errs.join(' | '))
  check(`${que}: la tarjeta sale con «12 personas te siguen»`, (await p.isVisible('#tdNovedades')) && /12 personas te siguen/.test(await texto(p, '#tdNovedades')))
  check(`${que}: sin escribir, «Publicar» apagado`, await p.isDisabled('[data-tdn-publicar]'))
  await p.fill('[data-tdn-texto]', 'Ha llegado la caja de 151')
  check(`${que}: al escribir, se enciende y cuenta`, !(await p.isDisabled('[data-tdn-publicar]')) && /25 \/ 280/.test(await texto(p, '[data-tdn-cuenta]')) && /Publicar y avisar a 12/.test(await texto(p, '[data-tdn-publicar]')))
  await p.click('[data-tdn-anadir]')
  await p.fill('[data-tdn-q]', 'char'); await p.waitForTimeout(900)
  check(`${que}: busca en tu stock`, (await p.locator('[data-tdn-elegir]').count()) === 2)
  await p.locator('[data-tdn-elegir]').first().click(); await p.waitForTimeout(200)
  check(`${que}: la carta elegida, en su chapa`, /Charizard ex/.test(await texto(p, '[data-tdn-cartas]')))
  const ancho = await p.evaluate(() => Math.round(document.querySelector('#tdNovedades').getBoundingClientRect().right))
  check(`${que}: sin salirse`, ancho <= (movil ? 390 : 1280), String(ancho))
  await p.locator('#tdNovedades').screenshot({ path: `${S}/c1432-panel-${movil ? 'movil' : 'pc'}.png` }).catch(() => {})
  await p.click('[data-tdn-publicar]'); await p.waitForTimeout(900)
  const a = (await llamadas(p, 'tienda_publicar_novedad')).at(-1)
  check(`${que}: publica con el texto y la carta`, a?.p_texto === 'Ha llegado la caja de 151' && JSON.stringify(a?.p_cartas) === JSON.stringify([{ card_id: 'carta-0', market: 'WEST' }]), JSON.stringify(a))
  check(`${que}: y dice a cuántos se lo ha contado`, /Se lo hemos contado a 12 personas/.test(await texto(p, 'body')))
  await ctx.close()
}

console.log('── Ya contó una esta semana ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=escaparate', { plan: PLAN.tienda, filas: { tienda_novedades: [NOVEDAD] }, rpc: { tienda_novedades_estado: { seguidores: 12, ultima_at: NOVEDAD.created_at, proxima: en(5) }, tienda_borrar_novedad: true } })
  const t = await texto(p, '#tdNovedades')
  check('sin errores', !errs.length, errs.join(' | '))
  check('«Ya has contado una esta semana» con la fecha, y sin formulario', /Ya has contado una esta semana\. La siguiente, a partir del \d+ de \w+/.test(t) && !(await p.locator('[data-tdn-texto]').count()), t)
  check('lo que ha contado: el texto, sus dos cartas y «Avisaste a 12 personas»', /Ha llegado la caja de 151/.test(t) && (await p.locator('.tdn-mini .tdn-foto').count()) === 2 && /Avisaste a 12 personas/.test(t), t)
  await p.locator('#tdNovedades').screenshot({ path: `${S}/c1432-espera.png` }).catch(() => {})
  await p.click('[data-tdn-borrar]'); await p.waitForTimeout(200)
  check('Borrar pide un segundo toque', /¿Seguro\? Borrar/.test(await texto(p, '[data-tdn-borrar]')) && !(await llamadas(p, 'tienda_borrar_novedad')).length)
  await p.click('[data-tdn-borrar]'); await p.waitForTimeout(800)
  check('…y al segundo, borra esa', (await llamadas(p, 'tienda_borrar_novedad')).at(-1)?.p_id === 'nov-1')
  await ctx.close()
}

console.log('── Con Puesto, y sin la migración ──')
{
  const { p, ctx } = await abrir('/tienda.html?ver=escaparate', { plan: PLAN.puesto, rpc: { tienda_novedades_estado: { seguidores: 3, proxima: null } } })
  const t = await texto(p, '#tdNovedades')
  check('Puesto: «Con Tienda (29 €/mes)…» y «Ver planes», sin formulario', /Con Tienda \(29/.test(t) && /Ver planes/.test(t) && !(await p.locator('[data-tdn-texto]').count()), t)
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=escaparate', { plan: PLAN.tienda, errores: { tienda_novedades_estado: { code: 'PGRST202', message: 'Could not find the function' } } })
  check('sin la migración, la tarjeta no sale', !errs.length && !(await p.isVisible('#tdNovedades')), errs.join(' | '))
  await ctx.close()
}

console.log('── El escaparate público ──')
for (const movil of [false, true]) {
  const { p, ctx, errs } = await abrir('/usuario.html?u=cartasbilbao#novedad-nov-1', { sesion: 'user-3', movil, filas: { tienda_novedades: [NOVEDAD] } })
  const que = movil ? 'móvil' : 'PC'
  const t = await texto(p, '.pt-noticias')
  check(`${que}: sin errores`, !errs.length, errs.join(' | '))
  check(`${que}: «Noticias de la tienda» con el texto y sus dos cartas`, (await p.isVisible('.pt-noticias')) && /Noticias de la tienda/.test(t) && /Ha llegado la caja de 151/.test(t) && (await p.locator('.pt-noticia-carta').count()) === 2, t)
  check(`${que}: la que llega por el enlace, marcada`, await p.locator('#novedad-nov-1.pt-noticia-marcada').count() === 1)
  const ancho = await p.evaluate(() => Math.round(document.querySelector('.pt-noticias').getBoundingClientRect().right))
  check(`${que}: sin salirse`, ancho <= (movil ? 390 : 1280), String(ancho))
  await p.locator('.pt-noticias').screenshot({ path: `${S}/c1432-publico-${movil ? 'movil' : 'pc'}.png` }).catch(() => {})
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=cartasbilbao', { sesion: 'user-3' })
  check('sin novedades, el hueco no sale', !(await p.isVisible('.pt-noticias')))
  await ctx.close()
}

console.log('── Ajustes → Avisos ──')
{
  const A = await import(`${RAIZ}/js/avisos-prefs.js`)
  const N = await import(`${RAIZ}/js/notifications.js`).catch(() => null)
  const fila = A.SECCIONES_AVISOS.flatMap((s) => s.filas).find((f) => f.tipos.includes('tienda_novedad'))
  check('la fila «Novedades de las tiendas que sigues» existe', fila?.titulo === 'Novedades de las tiendas que sigues')
  check('y el grupo de la campanita también', A.GRUPOS_CAMPANITA.some((g) => g.tipos.includes('tienda_novedad')))
  if (N?.NOTIFICATION_TYPES) check('el tipo está en la campanita', !!N.NOTIFICATION_TYPES.tienda_novedad)
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
