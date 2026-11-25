// Tanda 1436 — retirarse bien (Tardeo de Testeo del 25-11; Ibai: «si dropeas
// sigues saliendo en el emparejamiento», «dejar más claro el botón de dropear
// del torneo y que funcione correctamente»).
//
//  1. Tu mesa lleva un «⋯» con «Retirarme del torneo», que abre una ventana con
//     lo que pasa (terminas la ronda contra tu rival, no te emparejamos, no
//     vuelves) y solo escribe al decir que sí.
//  2. «Seguir en el torneo» no escribe nada.
//  3. Al emparejar y al sembrar el top se vuelven a leer las bajas
//     (`refrescarBajas`), y la ficha escucha las inscripciones en vivo.
//  4. Las líneas de la ventana (puro).
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
const abrir = async ({ sesion = 'user-1', ancho = 390 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 860 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, tab, ju]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
    window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, TORNEO, INSCRIPCIONES, RONDAS, MESAS, RESULTADOS, TABLON, JUECES])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  // La entrada a la ronda (1402) tapa la ficha: se cierra.
  await page.getByText('¡A jugar!').click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(300)
  return { page, ctx, errores }
}
const escrituras = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tournament_registrations'))

console.log('── 1. El «⋯» de tu mesa y la ventana ──')
for (const ancho of [390, 1280]) {
  const { page, ctx, errores } = await abrir({ ancho })
  const mas = page.locator('#torneoMiPartida .torneo-mimesa-mas')
  check(`${ancho}: tu mesa lleva su «⋯»`, (await mas.count()) === 1)
  await mas.locator('summary').click()
  await page.waitForTimeout(200)
  const boton = mas.locator('[data-retirarme]')
  check(`${ancho}: dentro, «Retirarme del torneo»`, (await boton.isVisible()) && /Retirarme del torneo/.test(await boton.textContent()))
  // El menú no se corta dentro de la tarjeta: el botón se puede pulsar.
  const pulsable = await boton.evaluate((b) => {
    const r = b.getBoundingClientRect()
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return e === b || b.contains(e)
  })
  check(`${ancho}: el menú se ve entero y se puede pulsar`, pulsable)
  await boton.click()
  await page.waitForTimeout(300)
  const ventana = await page.evaluate(() => {
    const d = document.getElementById('torneoRetirada')
    return d ? { abierta: d.open, texto: d.textContent.replace(/\s+/g, ' '), arriba: Math.round(d.getBoundingClientRect().top), alto: innerHeight } : null
  })
  check(`${ancho}: se abre la ventana «¿Te retiras del torneo?»`, ventana?.abierta && /¿Te retiras del torneo\?/.test(ventana.texto), JSON.stringify(ventana))
  check(`${ancho}: dice que terminas tu ronda contra Misty`, /ronda 2 la terminas: tu partida contra Misty cuenta/i.test(ventana?.texto || ''), ventana?.texto)
  check(`${ancho}: dice que no te emparejamos ni puedes volver`, /No te emparejamos/.test(ventana?.texto || '') && /No puedes volver a entrar/.test(ventana?.texto || ''))
  if (ancho === 390) check('390: en el móvil es una hoja desde abajo', ventana && ventana.arriba > 120, JSON.stringify(ventana))
  // 2. Seguir: no escribe.
  await page.click('[data-retirada="no"]')
  await page.waitForTimeout(300)
  check(`${ancho}: «Seguir en el torneo» cierra sin escribir`, !(await page.locator('#torneoRetirada').count()) && (await escrituras(page)).length === 0)
  // Y otra vez, ahora sí (centrado: la barra de arriba, pegada, lo tapaba).
  await mas.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await mas.locator('summary').click()
  await page.waitForTimeout(150)
  await boton.click()
  await page.waitForTimeout(250)
  await page.click('[data-retirada="si"]')
  await page.waitForTimeout(1200)
  const esc = await escrituras(page)
  const filas = esc.find((e) => e.tipo === 'update')?.filas
  const fila = Array.isArray(filas) ? filas[0] : filas
  check(`${ancho}: «Sí, retirarme» guarda la baja con la ronda en la que te vas`, fila?.status === 'dropped' && fila?.dropped_after_round_id === 'ronda-2', JSON.stringify(esc))
  const tras = await page.evaluate(() => document.querySelector('#torneoMiPartida .torneo-mesa-cab')?.textContent.replace(/\s+/g, ' ') || '')
  check(`${ancho}: tu mesa dice «Te has retirado» y ya no lleva el «⋯»`, /Te has retirado/.test(tras) && !(await page.locator('#torneoMiPartida .torneo-mimesa-mas').count()), tras)
  check(`${ancho}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Al emparejar, las bajas se leen frescas ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-3', ancho: 1280 })
  const r = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    // Alguien se retira desde su móvil, sin que esta pantalla se entere.
    // (Una fila NUEVA en el doble: si se cambiara la misma, la pantalla la
    // vería cambiada por compartir el objeto, cosa que en la base no pasa.)
    const T = window.__TABLAS__
    const k = T.tournament_registrations.findIndex((r) => r.id === 'insc-1')
    T.tournament_registrations[k] = { ...T.tournament_registrations[k], status: 'dropped', dropped_after_round_id: 'ronda-2' }
    void supabase
    const ronda = await import('/js/torneos/ronda.js')
    const idos = await ronda.refrescarBajas()
    return { idos: (idos || []).map((i) => i.user_id) }
  })
  check('refrescarBajas trae a quien se retiró por su cuenta', r.idos.join() === 'user-2', JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ronda = readFileSync(`${RAIZ}/js/torneos/ronda.js`, 'utf8')
  const pareo = ronda.slice(ronda.indexOf('async function generarPareos()'), ronda.indexOf('async function generarPareos()') + 9000)
  check('generarPareos lee las bajas antes de montar el snapshot', /await refrescarBajas\(\)/.test(pareo) && pareo.indexOf('refrescarBajas') < pareo.indexOf('montarSnapshot('))
  const top = ronda.slice(ronda.indexOf('async function sembrarTopCut()'), ronda.indexOf('async function sembrarTopCut()') + 900)
  check('sembrarTopCut también', /refrescarBajas\(\)/.test(top) && top.indexOf('refrescarBajas') < top.indexOf('computeStandings'))
  const torneo = readFileSync(`${RAIZ}/js/torneos/torneo.js`, 'utf8')
  check('la ficha escucha las inscripciones de SU torneo', /tabla: 'tournament_registrations', filtro: `tournament_id=eq\.\$\{torneo\.id\}`/.test(torneo))
}
await browser.close()

console.log('\n── 4. Las líneas de la ventana ──')
{
  const { lineasDeRetirada } = await import(`${RAIZ}/js/torneos/retirarse.js`).catch(() => ({}))
  if (!lineasDeRetirada) check('retirarse.js se importa en Node', false)
  else {
    const antes = lineasDeRetirada({ empezado: false })
    check('antes de empezar: dejas tu plaza', antes.length === 2 && /Dejas tu plaza/.test(antes[0].texto))
    const entre = lineasDeRetirada({ empezado: true })
    check('entre rondas: lo jugado cuenta', /ya has jugado cuentan/.test(entre[0].texto) && entre[0].si)
  }
}
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
