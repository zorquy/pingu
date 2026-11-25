// Tanda 1441 — el panel de juez con tickets (Ibai: «mejorar la interfaz de
// jueces y el sistema de tickets», «que como juez puedas hablar en el chat de
// la mesa de los jugadores»).
//  1. Llamar al juez pide el motivo y lo guarda con su línea.
//  2. El juez ve los tickets por grupos con motivo, quién y la espera.
//  3. El mapa de mesas: al tocar una, su chat; lo que escribe el juez sale
//     firmado «Juez» y en ámbar.
//  4. Resolver pide la nota en el propio ticket.
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
const LLAMADAS = [{ id: 'llamada-1', tournament_id: 'torneo-1', match_id: 'mesa-1', created_by: 'user-2', status: 'open', motivo: 'desconexion', detalle: 'Se me cerró TCG Live', created_at: new Date(ahora - 4 * 60000).toISOString() }]
const abrir = async ({ sesion, llamadas = [], ancho = 1280 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, tab, ju, ll]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
    window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju; window.__FAKE_LLAMADAS__ = ll
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, TORNEO, INSCRIPCIONES, RONDAS, MESAS, RESULTADOS, TABLON, JUECES, llamadas])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.getByText('¡A jugar!').click({ timeout: 1000 }).catch(() => {})
  // Las celebraciones (mod-1 perdió su mesa) tapan la ficha: fuera.
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { page, ctx, errores }
}
const escrituras = (page, tabla) => page.evaluate((t) => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === t), tabla)

console.log('── 1. Llamar al juez con motivo ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-1', ancho: 390 })
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('torneo:llamar-juez')))
  await page.waitForTimeout(400)
  const hoja = await page.evaluate(() => { const d = document.getElementById('torneoMotivoJuez'); return d ? { abierta: d.open, opciones: [...d.querySelectorAll('.torneo-motivo-op')].map((o) => o.textContent.trim()), arriba: Math.round(d.getBoundingClientRect().top) } : null })
  check('sale «¿Qué pasa en tu mesa?» con los cinco motivos', hoja?.abierta && hoja.opciones.length === 5 && /Desconexión/.test(hoja.opciones.join()), JSON.stringify(hoja))
  check('en el móvil, como hoja desde abajo', hoja && hoja.arriba > 100, JSON.stringify(hoja))
  await page.check('input[name="motivo"][value="desconexion"]')
  await page.fill('#torneoMotivoJuez input[name="detalle"]', 'Se me cerró el juego')
  await page.click('#torneoMotivoJuez button[type="submit"]')
  await page.waitForTimeout(800)
  const fila = (await escrituras(page, 'judge_calls'))[0]?.filas
  const f = Array.isArray(fila) ? fila[0] : fila
  check('la llamada se guarda con motivo y su línea', f?.motivo === 'desconexion' && f?.detalle === 'Se me cerró el juego' && f?.match_id === 'mesa-1', JSON.stringify(f))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2 y 3. El panel del juez ──')
for (const ancho of [1280, 390]) {
  const { page, ctx, errores } = await abrir({ sesion: 'mod-1', llamadas: LLAMADAS, ancho })
  await page.click('#torneoPestanas [data-pestana="jueces"]')
  await page.waitForTimeout(500)
  const t = await page.evaluate(() => {
    const a = document.querySelector('[data-ticket="llamada-1"]')
    return a ? { texto: a.textContent.replace(/\s+/g, ' '), grupo: document.querySelector('.torneo-ticket-grupo')?.textContent, espera: a.querySelector('[data-espera]')?.textContent } : null
  })
  check(`${ancho}: el ticket dice mesa, motivo, quién y qué`, /Mesa 1/.test(t?.texto || '') && /Desconexión/.test(t?.texto || '') && /Se me cerró TCG Live/.test(t?.texto || ''), t?.texto)
  check(`${ancho}: va en «Sin atender» con lo que lleva esperando (≈4 min)`, /Sin atender/.test(t?.grupo || '') && /^4:\d\d$/.test(t?.espera || ''), JSON.stringify(t))
  const e1 = t?.espera
  await page.waitForTimeout(2100)
  const e2 = await page.evaluate(() => document.querySelector('[data-espera]')?.textContent)
  check(`${ancho}: la espera corre sola`, e1 !== e2, `${e1} → ${e2}`)
  const mapa = await page.evaluate(() => [...document.querySelectorAll('.torneo-juez-mesa')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
  check(`${ancho}: el mapa trae las mesas de la ronda con su estado (y el ticket)`, mapa.length === 2 && /ticket/.test(mapa[0]) && /Terminada/.test(mapa[1]), JSON.stringify(mapa))
  await page.click('.torneo-juez-mesa[data-ver-mesa="mesa-1"]')
  await page.waitForTimeout(600)
  const abierta = await page.evaluate(() => ({ visible: !document.getElementById('mesaJuezAbierta').classList.contains('hidden'), titulo: document.querySelector('#mesaJuezAbierta h4')?.textContent, chat: !!document.querySelector('#chatMesaJuez .torneo-chat-envio input') }))
  check(`${ancho}: tocar la mesa abre su chat para escribir`, abierta.visible && /Mesa 1/.test(abierta.titulo || '') && abierta.chat, JSON.stringify(abierta))
  if (ancho === 1280) {
    await page.fill('#chatMesaJuez .torneo-chat-envio input', 'Tenéis 5 minutos para volver a empezar')
    await page.click('#chatMesaJuez .torneo-chat-envio button')
    await page.waitForTimeout(800)
    const msg = (await escrituras(page, 'match_messages'))[0]?.filas
    const m = Array.isArray(msg) ? msg[0] : msg
    check('el juez escribe en el chat de la mesa', m?.match_id === 'mesa-1' && m?.sender_id === 'mod-1', JSON.stringify(m))
    const burbuja = await page.evaluate(() => { const l = document.querySelector('#chatMesaJuez .torneo-chat-linea.de-juez'); return l ? { quien: l.querySelector('.torneo-burbuja-quien')?.textContent, fondo: getComputedStyle(l.querySelector('.torneo-burbuja')).backgroundColor } : null })
    check('…y su mensaje sale firmado «Juez» y en ámbar', /^Juez · /.test(burbuja?.quien || '') && burbuja?.fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(burbuja))

    console.log('\n── 4. Atender y resolver con nota ──')
    await page.click('[data-atender="llamada-1"]')
    await page.waitForTimeout(800)
    await page.click('[data-resolver-llamada="llamada-1"]')
    await page.waitForTimeout(300)
    const form = await page.locator('[data-ticket="llamada-1"] .torneo-ticket-resolver input').count()
    check('«Resolver» pide cómo se ha resuelto en el propio ticket', form === 1)
    await page.fill('[data-ticket="llamada-1"] .torneo-ticket-resolver input', 'Se repitió la partida 2')
    await page.click('[data-ticket="llamada-1"] .torneo-ticket-resolver button')
    await page.waitForTimeout(800)
    const upd = (await escrituras(page, 'judge_calls')).filter((e) => e.tipo === 'update').map((e) => (Array.isArray(e.filas) ? e.filas[0] : e.filas)).at(-1)
    check('se guarda resuelta y con la nota', upd?.status === 'resolved' && upd?.nota === 'Se repitió la partida 2', JSON.stringify(upd))
  }
  const ancho_ = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check(`${ancho}: sin scroll de lado`, ancho_ <= 0, ancho_)
  check(`${ancho}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── El jugador ve al juez en su mesa ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-1' })
  await page.evaluate(async () => { const { supabase } = await import('/js/supabase.js'); window.__TABLAS__.match_messages = window.__TABLAS__.match_messages || []; window.__TABLAS__.match_messages.push({ id: 'mm1', match_id: 'mesa-1', sender_id: 'mod-1', message: 'Aquí el juez', sent_at: new Date().toISOString() }); void supabase })
  await page.evaluate(() => document.getElementById('chatDeMesa')?.refrescarMensajes?.())
  await page.waitForTimeout(600)
  const j = await page.evaluate(() => document.querySelector('#chatDeMesa .torneo-chat-linea.de-juez .torneo-burbuja-quien')?.textContent || '')
  check('en el chat de la mesa del jugador, el mensaje del juez va firmado', /^Juez · /.test(j), j)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
