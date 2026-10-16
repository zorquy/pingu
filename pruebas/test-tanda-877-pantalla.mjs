// Tanda 877 — la barra de estado del torneo: la web cuenta la ronda sola.
//
// PINGU: «hay gente que cuando hay torneo y no lo retransmito en twitch,
// pierden un poco el hilo de cuando se cierra ronda, de qué está pasando».
// La barra viva (298) decía tu partida y el reloj; ahora dice además QUÉ
// FALTA con nombre (las mesas sin reportar y las disputas), «has
// terminado · esperando a N mesas» cuando tu mesa ya está, qué pasa entre
// rondas (antes la barra desaparecía) y, si te quedaste fuera del corte,
// que lo estás mirando desde fuera. Para todo el mundo, sin cuenta también.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const ahora = Date.now()

console.log('── 0. Lo puro: qué mesas faltan y cómo se dicen ──')
{
  const { mesasQueFaltan, fraseDeMesas } = await import(`${RAIZ}/js/torneos/mesas.js`)
  const m = (n, status, a = 'x', b = 'y') => ({ table_number: n, status, player_a_id: a, player_b_id: b })
  const f = mesasQueFaltan([m(1, 'active'), m(2, 'finished'), m(3, 'disputed'), m(4, 'awaiting_confirmation'), m(5, 'bye', 'z', null), m(7, 'pending')])
  check('pendientes por número (en juego, confirmando, sin empezar) y las disputas aparte; el bye no cuenta', f.pendientes.join() === '1,4,7' && f.disputas.join() === '3', JSON.stringify(f))
  check('«mesa 4» · «mesas 1 y 4» · «mesas 1, 4 y 7»', fraseDeMesas([4]) === 'mesa 4' && fraseDeMesas([1, 4]) === 'mesas 1 y 4' && fraseDeMesas([1, 4, 7]) === 'mesas 1, 4 y 7')
  check('a partir de cinco, «y N más»', fraseDeMesas([1, 2, 3, 4, 5, 6]) === 'mesas 1, 2, 3 y 3 más', fraseDeMesas([1, 2, 3, 4, 5, 6]))
  check('sin mesas, nada', fraseDeMesas([]) === '' && mesasQueFaltan([]).pendientes.length === 0)
}

const TORNEO = {
  id: 'torneo-1', slug: 'pachanga', name: 'Liga PokeDoc · Jornada 4', status: 'in_progress',
  admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3,
  round_time_minutes: 30, checkin_minutes: 5, is_official: true,
  start_at: new Date(ahora - 3600e3).toISOString(), current_round_id: 'ronda-2',
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const INSCRIPCIONES = GENTE.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(ahora - 7200e3).toISOString() }))
const R1 = { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: new Date(ahora - 4000e3).toISOString() }
const R2 = { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss', started_at: new Date(ahora - 120e3).toISOString(), ends_at: new Date(ahora + 14 * 60000).toISOString() }
const MESAS_R1 = [
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
  { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
]
const RESULTADOS = [
  { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 },
  { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
]

const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', movil = false, rondas, mesas, resultados = RESULTADOS, torneo = TORNEO } = {}) => {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
  }, [sesion, torneo, INSCRIPCIONES, rondas, mesas, resultados])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const barra = (page) => page.evaluate(() => {
  const t = (id) => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() || ''
  return { visible: !document.getElementById('torneoBarraViva').classList.contains('hidden'), rotulo: t('torneoVivaRotulo'), titular: t('torneoVivaTitular'), der: t('torneoVivaDer'), estado: t('torneoVivaEstado'), estadoOculto: document.getElementById('torneoVivaEstado').classList.contains('hidden'), anillo: t('torneoVivaAnillo') }
})

console.log('\n── 1. Jugando: qué mesa falta, con su número ──')
{
  const mesas = [...MESAS_R1,
    { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: new Date(ahora - 60e3).toISOString(), check_in_b_at: new Date(ahora - 50e3).toISOString() },
    { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
  ]
  const { page, ctx, errores } = await abrir({ rondas: [R1, R2], mesas, resultados: [...RESULTADOS, { id: 'r1', match_id: 'mesa-2', result: 'a_wins', winner_id: 'user-3', score_a: 2, score_b: 1 }] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('sigue diciendo tu partida y la ronda', /Tu partida contra Misty/.test(b.titular) && /Ronda suiza 2 de 3/.test(b.rotulo), JSON.stringify(b))
  check('y qué falta, con el número: «Falta 1 mesa por reportar · mesa 1»', !b.estadoOculto && /Falta 1 mesa por reportar · mesa 1/.test(b.estado), b.estado)
  await ctx.close()
}

console.log('\n── 2. Has terminado: a quién se espera, y la disputa en rojo ──')
{
  const mesas = [...MESAS_R1,
    { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
    { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'disputed' },
  ]
  const { page, ctx, errores } = await abrir({ rondas: [R1, R2], mesas, resultados: [...RESULTADOS, { id: 'r1', match_id: 'mesa-1', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 }] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('«Has terminado · esperando a 1 mesa», ya no «Tu partida contra»', /Has terminado · esperando a 1 mesa/.test(b.titular) && !/Tu partida/.test(b.titular), b.titular)
  check('  …con «Ver tu mesa» y sin pedirte el check-in', /Ver tu mesa/.test(b.der) && !/check-in/.test(b.der), b.der)
  check('la disputa, con su mesa y que un juez está en ello', /Disputa en la mesa 2 · un juez está en ello/.test(b.estado), b.estado)
  const rojo = await page.$eval('#torneoVivaEstado .torneo-viva-alerta', (e) => getComputedStyle(e).color)
  check('  …en rojo (el token de peligro, no un gris)', rojo !== 'rgba(0, 0, 0, 0)' && !/^rgb\(8[0-9], 1[0-9]{2}, 1[0-9]{2}\)$/.test(rojo), rojo)
  check('y sin mesas sin reportar que listar (la única viva es la disputada)', !/por reportar/.test(b.estado), b.estado)
  await ctx.close()
}

console.log('\n── 3. Entre rondas: la barra se queda y dice qué viene ──')
{
  const R2c = { ...R2, status: 'finished' }
  const mesas = [...MESAS_R1,
    { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
    { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
  ]
  const { page, ctx, errores } = await abrir({ rondas: [R1, R2c], mesas, torneo: { ...TORNEO, current_round_id: null } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('la barra sigue a la vista (antes desaparecía)', b.visible, JSON.stringify(b))
  check('«Ronda 2 de 3 · cerrada» y «Pareando la ronda 3…»', /[Rr]onda 2 de 3 · cerrada/.test(b.rotulo) && /Pareando la ronda 3…/.test(b.titular), JSON.stringify(b))
  check('  …sin reloj (el anillo en pausa) y sin «qué falta»', b.anillo === '—' && b.estadoOculto, JSON.stringify(b))
  check('  …y dice que los pareos salen aquí', /Los pareos salen aquí/.test(b.der), b.der)
  await ctx.close()
  // Con la siguiente ya pareada pero sin empezar.
  const R3 = { id: 'ronda-3', tournament_id: 'torneo-1', round_number: 3, status: 'pending', phase: 'swiss' }
  const b2 = await abrir({ rondas: [R1, R2c, R3], mesas: [...mesas, { id: 'mesa-5', round_id: 'ronda-3', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'pending' }], torneo: { ...TORNEO, current_round_id: 'ronda-3' } })
  const bb = await barra(b2.page)
  check('con la siguiente pareada: «Pareos de la ronda 3 listos · a punto de empezar»', /Pareos de la ronda 3 listos/.test(bb.titular), bb.titular)
  await b2.ctx.close()
  // Tras la última suiza, con corte: «Preparando el top 4…».
  const R3c = { ...R3, status: 'finished', started_at: new Date(ahora - 100e3).toISOString() }
  const b3 = await abrir({ rondas: [R1, R2c, R3c], mesas: [...mesas, { id: 'mesa-5', round_id: 'ronda-3', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' }], torneo: { ...TORNEO, current_round_id: null } })
  const b3b = await barra(b3.page)
  check('tras la última suiza: «Preparando el top 4…»', /Preparando el top 4…/.test(b3b.titular), b3b.titular)
  await b3.ctx.close()
}

console.log('\n── 4. Fuera del corte: lo miras desde fuera ──')
{
  const R3 = { id: 'ronda-3', tournament_id: 'torneo-1', round_number: 3, status: 'finished', phase: 'swiss', started_at: new Date(ahora - 1000e3).toISOString() }
  const TOP = { id: 'ronda-4', tournament_id: 'torneo-1', round_number: 4, status: 'active', phase: 'top_cut', started_at: new Date(ahora - 60e3).toISOString(), ends_at: new Date(ahora + 20 * 60000).toISOString() }
  const mesas = [...MESAS_R1,
    { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
    { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
    { id: 'mesa-5', round_id: 'ronda-3', table_number: 1, player_a_id: 'user-1', player_b_id: 'mod-1', status: 'finished' },
    { id: 'mesa-6', round_id: 'ronda-3', table_number: 2, player_a_id: 'user-2', player_b_id: 'user-3', status: 'finished' },
    { id: 'mesa-7', round_id: 'ronda-4', table_number: 1, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'active' },
  ]
  const res = [...RESULTADOS,
    { id: 'r4', match_id: 'mesa-1', result: 'b_wins', winner_id: 'user-2', score_a: 0, score_b: 2 },
    { id: 'r5', match_id: 'mesa-2', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
    { id: 'r6', match_id: 'mesa-5', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
    { id: 'r7', match_id: 'mesa-6', result: 'a_wins', winner_id: 'user-2', score_a: 2, score_b: 0 },
  ]
  const { page, ctx, errores } = await abrir({ rondas: [R1, R2, R3, TOP].map((r) => (r.id === 'ronda-2' ? { ...r, status: 'finished' } : r)), mesas, resultados: res, torneo: { ...TORNEO, top_cut_size: 2, current_round_id: 'ronda-4' } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('«Te quedaste fuera del top 2 (N.º) · mira las mesas», con tu puesto', /Te quedaste fuera del top 2 \(\d\.º\) · mira las mesas/.test(b.titular), b.titular)
  check('  …y la ronda es el top cut', /Top cut/.test(b.rotulo), b.rotulo)
  await ctx.close()
}

console.log('\n── 5. Sin cuenta: lo mismo, sin lo tuyo; y en el móvil ──')
{
  const mesas = [...MESAS_R1,
    { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active' },
    { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'active' },
  ]
  const { page, ctx, errores } = await abrir({ sesion: 'none', rondas: [R1, R2], mesas })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('«Ronda en marcha» y «Faltan 2 mesas por reportar · mesas 1 y 2»', b.titular === 'Ronda en marcha' && /Faltan 2 mesas por reportar · mesas 1 y 2/.test(b.estado), JSON.stringify(b))
  await ctx.close()
  const m = await abrir({ movil: true, rondas: [R1, R2], mesas })
  const ancho = await m.page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth, estado: document.getElementById('torneoVivaEstado').getBoundingClientRect().width }))
  check('en el móvil no se sale de la pantalla', ancho.doc <= ancho.win + 1 && ancho.estado > 0, JSON.stringify(ancho))
  check('sin errores', m.errores.length === 0, m.errores.join(' | '))
  await m.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
