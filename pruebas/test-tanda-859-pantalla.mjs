// Tanda 859 — las pestañas de las demás páginas, en la dirección y sin
// rastro: el perfil (Vitrina · Actividad · Medallas), el torneo (Torneo ·
// Jugar · Rondas…) y Mis partidas (Torneos · Sueltas · Estadísticas).
// Recargar o compartir enseña la misma pestaña, y cambiar de pestaña no
// alarga el historial (la regla de la 856). Los mazos del meta ya lo
// hacían (`?fuente` y `?dias`).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ }
  window.__FAKE_TORNEOS__ = [{ slug: 'copa', name: 'Copa Medida', status: 'in_progress', max_players: 32, swiss_rounds: 5 }]
  window.__FAKE_INSCRIPCIONES__ = Array.from({ length: 8 }, (_, i) => ({ id: `i-${i}`, tournament_id: 'torneo-1', user_id: i === 0 ? 'user-1' : `user-${(i % 3) + 2}`, status: 'active', tcg_live_username: `TCG_${i}` }))
  window.__FAKE_RONDAS__ = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }]
  window.__FAKE_MESAS__ = Array.from({ length: 4 }, (_, i) => ({ id: `mesa-${i}`, round_id: 'ronda-1', table_number: i + 1, player_a_id: i === 0 ? 'user-1' : 'user-2', player_b_id: 'user-3', status: 'active' }))
}
async function abrir(ruta) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, ctx, errores }
}
const donde = (page) => page.evaluate(() => location.search)
const largo = (page) => page.evaluate(() => history.length)

console.log('── 1. El perfil ──')
{
  const { page, ctx, errores } = await abrir('/perfil.html?ver=logros')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const activa = () => page.evaluate(() => document.querySelector('#profileTabs .tab-btn.active')?.dataset.ptab)
  check('con ?ver=logros se abre en Logros', (await activa()) === 'logros', await activa())
  const n0 = await largo(page)
  await page.click('#profileTabs [data-ptab="guides"]')
  await page.waitForTimeout(500)
  // Desde la 867 es UNA fila de pestañas: tocar cualquiera la escribe.
  check('tocar Guías la escribe en la dirección', (await donde(page)) === '?ver=guides' && (await activa()) === 'guides', await donde(page))
  await page.click('#profileTabs [data-ptab="logros"]')
  await page.waitForTimeout(500)
  check('tocar Medallas la escribe, sin alargar el historial', (await donde(page)) === '?ver=logros' && (await largo(page)) === n0, `${await donde(page)} · ${n0} → ${await largo(page)}`)
  await ctx.close()
}

console.log('── 2. El torneo ──')
{
  const { page, ctx, errores } = await abrir('/torneo.html?slug=copa&ver=rondas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const activa = () => page.evaluate(() => document.querySelector('#torneoPestanas .seg-btn.activa')?.dataset.pestana)
  check('con ?ver=rondas se abre en Rondas', (await activa()) === 'rondas', await activa())
  const n0 = await largo(page)
  await page.click('#torneoPestanas [data-pestana="torneo"]')
  await page.waitForTimeout(500)
  check('tocar Torneo limpia `ver`', !/ver=/.test(await donde(page)) && (await activa()) === 'torneo', await donde(page))
  await page.click('#torneoPestanas [data-pestana="rondas"]')
  await page.waitForTimeout(500)
  check('tocar Rondas la escribe, sin alargar el historial', /ver=rondas/.test(await donde(page)) && (await largo(page)) === n0, `${await donde(page)} · ${n0} → ${await largo(page)}`)
  await ctx.close()
}

console.log('── 3. Mis partidas ──')
{
  const { page, ctx, errores } = await abrir('/mis-partidas.html?ver=stats')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const activa = () => page.evaluate(() => document.querySelector('#partidasTabs .seg-btn[aria-pressed="true"]')?.dataset.vista)
  check('con ?ver=stats se abre en Estadísticas', (await activa()) === 'stats', await activa())
  const n0 = await largo(page)
  await page.click('#partidasTabs [data-vista="sueltas"]')
  await page.waitForTimeout(400)
  check('tocar Partidas sueltas la escribe, sin alargar el historial', (await donde(page)) === '?ver=sueltas' && (await largo(page)) === n0, `${await donde(page)} · ${n0} → ${await largo(page)}`)
  await page.click('#partidasTabs [data-vista="torneos"]')
  await page.waitForTimeout(400)
  check('tocar Torneos limpia la dirección', (await donde(page)) === '', await donde(page))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
