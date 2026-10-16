// Tanda 878 — el tablón del torneo.
//
// PINGU: «un chat para que los organizadores pongan updates? algo así?».
// No es un chat: avisos cortos del organizador y sus jueces, con hora, que
// ve todo el mundo, y en la misma lista los sucesos que la web apunta sola.
// El último aviso humano va pegado en la barra de estado (877). Escribir
// pasa por `torneos_tablon_escribir` (quién puede, y el aviso push a los
// inscritos que no lo tengan apagado).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const ahora = Date.now()

console.log('── 0. Lo puro y lo estático ──')
{
  const { avisoPegado } = await import(`${RAIZ}/js/torneos/tablon-pegado.js`)
  const h = (min) => new Date(ahora - min * 60000).toISOString()
  check('el último aviso HUMANO reciente va pegado; uno automático más nuevo no lo tapa', avisoPegado([{ kind: 'auto', created_at: h(1), body: 'x' }, { kind: 'aviso', created_at: h(20), body: 'y' }], ahora)?.body === 'y')
  check('uno de hace cuatro horas ya no es «lo último»', avisoPegado([{ kind: 'aviso', created_at: h(240), body: 'y' }], ahora) === null && avisoPegado([], ahora) === null)
  const sql = readFileSync(`${RAIZ}/supabase-migration-878-tablon-torneo.sql`, 'utf8')
  check('la migración: tabla, lectura para todos, nadie inserta a pelo, la función con mando o juez, y en tiempo real', /create table if not exists public\.tournament_updates/.test(sql) && /for select to anon, authenticated using \(true\)/.test(sql) && !/create policy \w+ on public\.tournament_updates\s+for insert/.test(sql) && /torneos_mando\(p_torneo\) or public\.repeticiones_juez_de\(p_torneo\)/.test(sql) && /add table public\.tournament_updates/.test(sql))
  check('  …y avisa solo a quien no tiene apagado torneo_aviso, sin avisarse a sí mismo', /notification_prefs_disabled[^;]*torneo_aviso/.test(sql) && /r\.user_id <> v_yo/.test(sql))
  const notif = readFileSync(`${RAIZ}/js/notifications.js`, 'utf8')
  check('el tipo torneo_aviso está en las preferencias (se puede apagar)', (notif.match(/torneo_aviso:/g) || []).length === 2)
  const torneo = readFileSync(`${RAIZ}/js/torneos/torneo.js`, 'utf8')
  check('la ficha escucha la tabla en tiempo real', /tabla: 'tournament_updates'/.test(torneo))
}

const TORNEO = {
  id: 'torneo-1', slug: 'pachanga', name: 'Liga PokeDoc · Jornada 4', status: 'in_progress',
  admin_id: 'user-3', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3,
  round_time_minutes: 30, checkin_minutes: 5, is_official: true,
  start_at: new Date(ahora - 3600e3).toISOString(), current_round_id: 'ronda-2',
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const INSCRIPCIONES = GENTE.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(ahora - 7200e3).toISOString() }))
const RONDAS = [
  { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: new Date(ahora - 4000e3).toISOString() },
  { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss', started_at: new Date(ahora - 120e3).toISOString(), ends_at: new Date(ahora + 14 * 60000).toISOString() },
]
const MESAS = [
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
  { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
  { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: new Date(ahora - 60e3).toISOString(), check_in_b_at: new Date(ahora - 50e3).toISOString() },
  { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
]
const RESULTADOS = [
  { id: 'r1', match_id: 'mesa-2', result: 'a_wins', winner_id: 'user-3', score_a: 2, score_b: 1 },
  { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 },
  { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
]
const h = (min) => new Date(ahora - min * 60000).toISOString()
const TABLON = [
  { id: 'a1', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Esperamos 5 minutos a la mesa 1, que se le ha caído TCG Live.', created_at: h(2) },
  { id: 'a2', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 2 en marcha · pareos publicados · 2 mesas · 30 min', created_at: h(20) },
  { id: 'a3', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 1 cerrada · 2 mesas', created_at: h(22) },
  { id: 'a4', tournament_id: 'torneo-1', author_id: 'mod-1', kind: 'aviso', body: 'Recordad: el reporte lo hace el que gana.', created_at: h(26) },
  { id: 'a5', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 1 en marcha · pareos publicados · 2 mesas · 30 min', created_at: h(50) },
  { id: 'a6', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Bienvenidos a la jornada 4.', created_at: h(55) },
]
const JUECES = [{ id: 'j1', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'approved' }]

const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', movil = false, tablon = TABLON, jueces = JUECES, prefs = {} } = {}) => {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, tab, ju, pr]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
    window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju
    window.__FAKE_PERFILES_EXTRA__ = pr
  }, [sesion, TORNEO, INSCRIPCIONES, RONDAS, MESAS, RESULTADOS, tablon, jueces, prefs])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const leer = (page) => page.evaluate(() => {
  const t = (sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() || ''
  return {
    visible: !document.getElementById('torneoTablon').classList.contains('hidden'),
    form: !!document.querySelector('#torneoTablonForm') && !document.querySelector('#torneoTablonForm').classList.contains('hidden'),
    filas: [...document.querySelectorAll('.torneo-tablon-fila')].map((f) => ({ auto: f.classList.contains('auto'), texto: f.textContent.replace(/\s+/g, ' ').trim() })),
    cuenta: t('#torneoTablonCuenta'),
    mas: t('#torneoTablonMas'),
    barra: t('#torneoVivaAviso'),
    barraOculta: document.getElementById('torneoVivaAviso').classList.contains('hidden'),
  }
})

console.log('\n── 1. Un jugador lo ve: la lista con lo humano y lo automático, y el último aviso en la barra ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const v = await leer(page)
  check('el tablón está, con «6 avisos» y sin caja de escribir (Ash no organiza)', v.visible && v.cuenta === '6 avisos' && !v.form, JSON.stringify({ visible: v.visible, cuenta: v.cuenta, form: v.form }))
  check('cinco a la vista y «Ver los 6»', v.filas.length === 5 && v.mas === 'Ver los 6', `${v.filas.length} · ${v.mas}`)
  check('la primera es el aviso de jesus (organizador) con su papel', !v.filas[0].auto && /jesus/.test(v.filas[0].texto) && /organizador/.test(v.filas[0].texto) && /Esperamos 5 minutos/.test(v.filas[0].texto), v.filas[0].texto)
  check('la segunda es automática, en su estilo', v.filas[1].auto && /Ronda 2 en marcha/.test(v.filas[1].texto), v.filas[1].texto)
  check('el juez sale como juez', /Brock/.test(v.filas[3].texto) && /juez/.test(v.filas[3].texto), v.filas[3].texto)
  check('en la barra de estado, el último aviso humano con quién y hace cuánto', !v.barraOculta && /jesus/.test(v.barra) && /hace 2 min/.test(v.barra) && /«Esperamos 5 minutos/.test(v.barra), v.barra)
  await page.locator('#torneoTablonMas').click()
  await page.waitForTimeout(300)
  const v2 = await leer(page)
  check('«Ver los 6» los enseña todos', v2.filas.length === 6 && /Bienvenidos/.test(v2.filas[5].texto), String(v2.filas.length))
  check('un jugador no puede borrar nada', (await page.locator('[data-borrar-aviso]').count()) === 0)
  await ctx.close()
}

console.log('\n── 2. El organizador escribe: la fila aparece, la barra cambia y los inscritos reciben su aviso ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-3', tablon: [] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const v = await leer(page)
  check('sin avisos, el tablón sale igual para quien organiza, con la caja de escribir', v.visible && v.form && v.filas.length === 0 && /Todavía no hay avisos/.test(await page.locator('#torneoTablonLista').textContent()), JSON.stringify(v))
  check('«avisar también por push» viene marcado', await page.locator('#torneoTablonForm input[name="avisar"]').isChecked())
  await page.fill('#torneoTablonForm input[name="texto"]', 'Descanso de 10 minutos antes del top.')
  await page.locator('#torneoTablonForm button[type="submit"]').click()
  await page.waitForTimeout(900)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_tablon_escribir'))
  check('va por la función de la base, con avisar y sin auto', llamadas.length === 1 && llamadas[0].args.p_torneo === 'torneo-1' && llamadas[0].args.p_avisar === true && llamadas[0].args.p_auto === false, JSON.stringify(llamadas))
  const v2 = await leer(page)
  check('la fila aparece arriba, con «organizador», y la caja se vacía', v2.filas[0] && /Descanso de 10 minutos/.test(v2.filas[0].texto) && /organizador/.test(v2.filas[0].texto) && (await page.inputValue('#torneoTablonForm input[name="texto"]')) === '', JSON.stringify(v2.filas[0]))
  check('y la barra de estado la lleva pegada', /Descanso de 10 minutos/.test(v2.barra), v2.barra)
  const avisos = await page.evaluate(() => window.__TABLAS__.user_notifications.filter((n) => n.type === 'torneo_aviso').map((n) => `${n.recipient_id}:${n.link}`).sort())
  check('los otros tres inscritos reciben la notificación (quien escribe, no), con el enlace al torneo', avisos.join() === 'mod-1:/torneo?slug=pachanga,user-1:/torneo?slug=pachanga,user-2:/torneo?slug=pachanga', avisos.join())
  check('su propio aviso se puede borrar', (await page.locator('[data-borrar-aviso]').count()) === 1)
  await page.locator('[data-borrar-aviso]').first().click()
  await page.waitForTimeout(600)
  const v3 = await leer(page)
  check('  …y borrado, se va de la lista y de la barra', v3.filas.length === 0 && v3.barraOculta, JSON.stringify(v3))
  await ctx.close()
}

console.log('\n── 3. Sin push cuando se desmarca; un juez también escribe; un jugador no ──')
{
  const { page, ctx } = await abrir({ sesion: 'mod-1', tablon: [] })
  const v = await leer(page)
  check('el juez aprobado ve la caja de escribir', v.form)
  await page.locator('#torneoTablonForm input[name="avisar"]').uncheck()
  await page.fill('#torneoTablonForm input[name="texto"]', 'Recordad el reporte.')
  await page.locator('#torneoTablonForm button[type="submit"]').click()
  await page.waitForTimeout(800)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_tablon_escribir'))
  const avisos = await page.evaluate(() => window.__TABLAS__.user_notifications.filter((n) => n.type === 'torneo_aviso').length)
  check('desmarcado, se publica sin avisar a nadie', llamadas[0]?.args.p_avisar === false && avisos === 0, JSON.stringify({ llamadas, avisos }))
  const v2 = await leer(page)
  check('la fila dice «juez»', /Brock/.test(v2.filas[0]?.texto || '') && /juez/.test(v2.filas[0]?.texto || ''), v2.filas[0]?.texto)
  await ctx.close()
  const j = await abrir({ sesion: 'user-2', tablon: [] })
  const vj = await leer(j.page)
  check('un jugador sin avisos no ve el tablón (ni ocupa)', !vj.visible)
  await j.ctx.close()
}

console.log('\n── 4. Los sucesos de la web se apuntan solos al cerrar e iniciar una ronda ──')
{
  const mesasCerrables = MESAS.map((m) => (m.id === 'mesa-1' ? { ...m, status: 'finished' } : m))
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([t, i, r, m, res]) => {
    window.__FAKE_SESSION__ = 'user-3'
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m
    window.__FAKE_RESULTADOS__ = [...res, { id: 'r9', match_id: 'mesa-1', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 }]; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []
  }, [TORNEO, INSCRIPCIONES, RONDAS, mesasCerrables, RESULTADOS])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('#torneoPestanas [data-pestana="rondas"]').click()
  await page.waitForTimeout(500)
  const cerrar = page.locator('#btnCerrarRonda')
  check('hay botón de cerrar la ronda (todas las mesas han terminado)', (await cerrar.count()) === 1)
  await cerrar.click()
  await page.waitForTimeout(1500)
  const auto = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_tablon_escribir' && r.args.p_auto).map((r) => r.args.p_texto))
  check('al cerrar, la web apunta «Ronda 2 cerrada · 2 mesas» sin avisar a nadie', auto.some((t) => /Ronda 2 cerrada · 2 mesas/.test(t)), JSON.stringify(auto))
  const v = await leer(page)
  check('  …y sale en el tablón como automático', v.filas.some((f) => f.auto && /Ronda 2 cerrada/.test(f.texto)), JSON.stringify(v.filas))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. En el móvil cabe ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-3', movil: true })
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth, form: document.querySelector('#torneoTablonForm input[name="texto"]').getBoundingClientRect().width }))
  check('no se sale de la pantalla y la caja ocupa el ancho', ancho.doc <= ancho.win + 1 && ancho.form > 250, JSON.stringify(ancho))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
