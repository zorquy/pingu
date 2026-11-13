// Tanda 1340 — dos arreglos de la ficha de un torneo en juego.
//
// 1) EL CHAT (PINGU: «parece que el chat no se actualiza seguido, va un poco
//    mal»). La ficha se saltaba el refresco mientras el cursor estaba en una
//    caja —y la caja del chat es una—, y ese refresco saltado se perdía: el
//    mensaje del rival no salía hasta tocar fuera y esperar al siguiente aviso
//    (con el vivo puesto, un minuto). Ahora los chats se ponen al día aunque
//    escribas, el refresco entero se aplaza hasta que sales de la caja, y los
//    chats con el juez también se escuchan en vivo.
// 2) EL MENÚ (PINGU: «aparece la hamburguesa antigua y desaparece el menú a la
//    izquierda»). Abierta la página con la ventana estrecha y ensanchada
//    después, el CSS guardaba el hueco de la lateral pero nadie la montaba:
//    columna vacía y, con un torneo en juego, la hamburguesa vieja.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ahora = Date.now()

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
const abrir = async ({ sesion = 'user-1', ancho = 1280, tablon = TABLON, jueces = JUECES } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, tab, ju]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
    window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, TORNEO, INSCRIPCIONES, RONDAS, MESAS, RESULTADOS, tablon, jueces])
  return { page, ctx, errores }
}

console.log('── 0. Lo estático ──')
{
  const torneo = readFileSync(`${RAIZ}/js/torneos/torneo.js`, 'utf8')
  check('la ficha escucha en vivo los chats con el juez (judge_messages)', /tabla: 'judge_messages'/.test(torneo))
  const app = readFileSync(`${RAIZ}/js/app.js`, 'utf8')
  check('app.js monta la lateral también al cruzar el ancho (change)', /addEventListener\?\.\('change'[\s\S]{0,200}barra-lateral\.js/.test(app))
}

console.log('\n── 1. El chat llega mientras escribes ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-1' })
  await page.goto(`${BASE}/torneo?slug=pachanga&ver=jugar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const caja = page.locator('#chatDeMesa .torneo-chat-envio input')
  check('tu mesa tiene su chat con la caja de escribir', (await caja.count()) === 1)
  await caja.click()
  await caja.type('hola mis')
  // Misty escribe mientras tú tienes el cursor en la caja.
  // (Directo en las tablas del doble: es lo que haría la base al escribir el otro.)
  await page.evaluate(() => {
    const T = window.__TABLAS__
    T.match_messages.push({ id: 'msg-1', match_id: 'mesa-1', sender_id: 'user-2', message: 'no me llega la invitación', sent_at: new Date().toISOString() })
    T.tournament_updates.push({ id: 'a-nuevo', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Aviso nuevo mientras escribes', created_at: new Date().toISOString() })
    // …y llegan sus avisos en vivo, como los manda la base.
    window.__VIVO__.emitir(null, { table: 'match_messages', new: { match_id: 'mesa-1' } })
    window.__VIVO__.emitir(null, { table: 'tournament_updates', new: { tournament_id: 'torneo-1' } })
  })
  await page.waitForTimeout(2500)
  const v = await page.evaluate(() => ({
    chat: document.querySelector('#chatDeMesa .torneo-chat-mensajes')?.textContent || '',
    foco: document.activeElement?.closest?.('#chatDeMesa') ? 'chat' : document.activeElement?.tagName,
    valor: document.querySelector('#chatDeMesa .torneo-chat-envio input')?.value,
    tablon: document.getElementById('torneoTablon')?.textContent || '',
  }))
  check('el mensaje de Misty sale sin salir de la caja', /no me llega la invitación/.test(v.chat), v.chat.slice(0, 120))
  check('  …y lo que llevas tecleado sigue ahí, con el cursor dentro', v.valor === 'hola mis' && v.foco === 'chat', JSON.stringify({ valor: v.valor, foco: v.foco }))
  check('  …la ficha entera no se repinta mientras escribes (el tablón espera)', !/Aviso nuevo mientras escribes/.test(v.tablon))
  // Al salir de la caja, lo aplazado se hace YA (sin esperar al sondeo).
  await page.locator('#torneoNombre, h1').first().click().catch(() => {})
  await page.evaluate(() => document.activeElement?.blur?.())
  await page.waitForTimeout(1800)
  const tablon = await page.evaluate(() => document.getElementById('torneoTablon')?.textContent || '')
  check('al salir de la caja, lo que se aplazó llega al momento', /Aviso nuevo mientras escribes/.test(tablon))
  const escribe = await page.evaluate(() => { const e = document.querySelector('#chatDeMesa .torneo-chat-escribe'); return e ? Math.round(e.getBoundingClientRect().height) : 0 })
  check('la línea de «está escribiendo…» tiene su sitio guardado', escribe >= 14, escribe)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 1b. «Está escribiendo…» ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-1' })
  await page.goto(`${BASE}/torneo?slug=pachanga&ver=jugar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  // Misty teclea: llega por el canal de difusión de la mesa (el doble lo lleva
  // por BroadcastChannel, que entrega a cualquier otro canal con ese nombre).
  await page.evaluate(() => new BroadcastChannel('difusion:escribe-match_messages-mesa-1').postMessage({ evento: 'escribe', payload: { quien: 'user-2' } }))
  await page.waitForTimeout(400)
  const aviso = await page.evaluate(() => document.querySelector('#chatDeMesa .torneo-chat-escribe')?.textContent || '')
  check('Ash ve «Misty está escribiendo…»', /Misty está escribiendo/.test(aviso), aviso)
  await page.waitForTimeout(4300)
  check('  …y se apaga solo a los pocos segundos', (await page.evaluate(() => document.querySelector('#chatDeMesa .torneo-chat-escribe')?.textContent || '')) === '')
  // Lo que Ash teclea se avisa, como mucho una vez cada dos segundos.
  await page.locator('#chatDeMesa .torneo-chat-envio input').type('ya va, mira', { delay: 40 })
  const enviados = await page.evaluate(() => window.__VIVO__.difusiones.filter((d) => d.tema === 'escribe-match_messages-mesa-1').flatMap((d) => d.enviados))
  check('al teclear, Ash avisa de que escribe (una vez, aunque teclee deprisa)', enviados.length === 1 && enviados[0].quien === 'user-1', JSON.stringify(enviados))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. El menú: ventana estrecha y luego ancha ──')
for (const ruta of ['/torneo?slug=pachanga', '/index.html']) {
  const { page, ctx, errores } = await abrir({ sesion: 'user-1', ancho: 1000 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  check(`${ruta}: a 1000 px, sin lateral`, (await page.locator('.lat').count()) === 0)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.waitForTimeout(1800)
  const v = await page.evaluate(() => ({
    lat: Boolean(document.querySelector('.lat')) && !document.querySelector('.lat').hidden,
    clase: document.documentElement.classList.contains('con-lateral'),
    hamburguesa: (() => { const b = document.querySelector('.nav-toggle'); return b ? getComputedStyle(b).display !== 'none' : false })(),
  }))
  check(`${ruta}: al ensanchar a 1600, sale el menú de la izquierda y no la hamburguesa`, v.lat && v.clase && !v.hamburguesa, JSON.stringify(v))
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.waitForTimeout(600)
  check(`${ruta}: y al volver a estrechar, la barra de siempre`, !(await page.evaluate(() => document.documentElement.classList.contains('con-lateral'))))
  check(`${ruta}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
