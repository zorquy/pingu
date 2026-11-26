// Tanda 1303 — «Ligas en curso» en /torneos (la T1 que eligió PINGU): una
// tarjeta ancha por liga en marcha con su tira de jornadas, los tres primeros
// y el botón que toca; la banda dice «1 liga en curso»; y en el Calendario
// cada jornada sale en su día con su nombre. Lo puro, en Node.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const { chapaDeLiga, botonDeLiga, cuandoEs, podioHtml, ligaFranjaHtml } = await import(`${REPO}/js/torneos/ligas-franja.js`)
const { jornadasDeLiga } = await import(`${REPO}/js/torneos/liga-en-curso.js`)
const { conJornadas } = await import(`${REPO}/js/torneos/ligas-franja.js`)

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const DIA = 864e5
const ahora = Date.now()
const manana = new Date(ahora + DIA); manana.setHours(19, 0, 0, 0)
const fechas = Array.from({ length: 10 }, (_, i) => new Date(manana.getTime() + (i - 5) * 7 * DIA).toISOString())
const LIGA = { id: 'torneo-1', slug: 'liga-fdn', name: 'Liga FDN [Oct–Dic]', format: 'league', status: 'in_progress', swiss_rounds: 10, rounds_per_matchday: 1, matchday_dates: fechas, max_players: null, start_at: fechas[0], admin_id: 'admin-1', pairing_seed: 'semilla' }
const RONDAS = [1, 2, 3, 4, 5].map((n) => ({ id: `ronda-${n}`, tournament_id: 'torneo-1', round_number: n, phase: 'swiss', status: 'finished', started_at: fechas[n - 1], closed_at: fechas[n - 1] }))

console.log('── Lo puro ──')
const j = jornadasDeLiga(LIGA, RONDAS)
check('la chapa: «Jornada 6 · mañana»', chapaDeLiga(j, ahora) === 'Jornada 6 · mañana', chapaDeLiga(j, ahora))
check('cuándo: hoy, mañana o el día', cuandoEs(new Date(ahora).toISOString(), ahora) === 'hoy' && cuandoEs(manana.toISOString(), ahora) === 'mañana' && /\d/.test(cuandoEs(fechas[7], ahora)))
check('el botón: «Manda tu lista» solo si estás dentro y sin lista', botonDeLiga(LIGA, { inscrito: true, conLista: false, siguiente: j.siguiente }).texto === 'Manda tu lista' && botonDeLiga(LIGA, { inscrito: true, conLista: true, siguiente: j.siguiente }).texto === 'Ver la liga' && botonDeLiga(LIGA, { siguiente: j.siguiente }).clase === 'btn-secondary')
check('el podio son tres filas siempre (vacío, esperando o lleno)', [null, [], [{ nombre: 'a', puntos: 3 }]].every((p) => (podioHtml(p).match(/<li /g) || []).length === 3))
const h = ligaFranjaHtml(LIGA, RONDAS, { ahora })
check('la tira: cinco hechas, la 6 siguiente, cuatro por jugar', (h.match(/lc-j-hecha/g) || []).length === 5 && (h.match(/lc-j-siguiente/g) || []).length === 1 && (h.match(/lc-j-pendiente/g) || []).length === 4)
check('«5 jugadas · Jornada 6 de 10 · Termina el…»', /5 jugadas · Jornada 6 de 10 · Termina el/.test(h))
if (conJornadas) {
  const cj = conJornadas([LIGA, { id: 'x', start_at: fechas[2], format: 'swiss' }])
  check('el calendario: una entrada por jornada con su número, y la liga no repetida', cj.filter((t) => t.id === 'torneo-1').length === 10 && cj.find((t) => t.jornadaDeLiga === 6)?.start_at === fechas[5] && cj.length === 11)
}

console.log('── La pantalla ──')
const P = ['user-1', 'p2', 'p3', 'p4']
const extra = ({ LIGA, RONDAS, P }) => {
  window.__FAKE_TORNEOS__ = [LIGA]
  window.__FAKE_RONDAS__ = RONDAS
  window.__FAKE_INSCRIPCIONES__ = P.map((u, i) => ({ id: `i${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active' }))
  // R1: user-1 gana a p2 y p3 a p4; R2: user-1 gana a p3, p2 empata con p4.
  window.__FAKE_MESAS__ = [
    { id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'p2', status: 'finished' },
    { id: 'mesa-2', round_id: 'ronda-1', table_number: 2, player_a_id: 'p3', player_b_id: 'p4', status: 'finished' },
    { id: 'mesa-3', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'p3', status: 'finished' },
    { id: 'mesa-4', round_id: 'ronda-2', table_number: 2, player_a_id: 'p2', player_b_id: 'p4', status: 'finished' },
  ]
  window.__FAKE_RESULTADOS__ = [{ match_id: 'mesa-1', result: 'a_wins' }, { match_id: 'mesa-2', result: 'a_wins' }, { match_id: 'mesa-3', result: 'a_wins' }, { match_id: 'mesa-4', result: 'draw' }]
  window.__FAKE_PERFILES__ = [{ id: 'p2', username: 'jesus' }, { id: 'p3', username: 'alex' }, { id: 'p4', username: 'mar' }]
  window.__FAKE_LISTAS_JORNADA__ = []
  window.__RPC_RESPUESTAS__ = { ...(window.__RPC_RESPUESTAS__ || {}), liga_listas_jornada: 3 }
}
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(extra, { LIGA, RONDAS, P })
  const page = await ctx.newPage()
  const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  // Desde la 1472 la liga entre jornadas es una fila de «Próximos» (una fila
  // por torneo); su clasificación vive en la ficha.
  await page.waitForSelector('.tf[data-torneo-id="torneo-1"]', { timeout: 15000 }).catch(() => {})
  const r = await page.evaluate(() => {
    const f = document.querySelector('.tf[data-torneo-id="torneo-1"]')
    const a = f?.querySelector('.tf-der .torneo-pie-accion')
    return {
      hay: Boolean(f),
      texto: f?.innerText.replace(/\s+/g, ' ') || '',
      boton: a?.textContent.trim(),
      href: a?.getAttribute('href') || '',
      visible: Boolean(a?.getClientRects().length),
      ancho: document.documentElement.scrollWidth <= innerWidth,
    }
  })
  const q = movil ? 'móvil' : 'PC'
  // En el móvil la línea de abajo va recortada a lo justo (el cuándo y el tipo).
  check(`${q}: la liga, en su fila de Próximos${movil ? '' : ' con «Jornada 6 de 10»'}`, r.hay && (movil || /Jornada 6 de 10/.test(r.texto)), JSON.stringify(r))
  check('  …y como juegas, «Tu lista» (a mandar la de la jornada), a la vista', r.boton === 'Tu lista' && r.visible && /ver=jugar/.test(r.href), JSON.stringify(r))
  check('  …sin salirse y sin errores', r.ancho && !err.length, err.join(' | '))
  await page.screenshot({ path: `/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/ligas-${q}.png`, fullPage: false })
  if (!movil) {
    // El calendario: el día de la jornada 6, con su nombre.
    await page.evaluate(() => document.getElementById('torneosVistaIcono')?.click())
    await page.waitForSelector('.torneo-cal-dia.con-jornada', { timeout: 5000 }).catch(() => {})
    const dia = await page.evaluate(() => { const d = [...document.querySelectorAll('.torneo-cal-dia.con-jornada')].find((x) => /J6/.test(x.title)); d?.click(); return d?.title || '' })
    await page.waitForTimeout(300)
    const panel = await page.evaluate(() => document.querySelector('#torneoCalDia')?.textContent.replace(/\s+/g, ' ') || '')
    check('el calendario: la jornada 6 en su día, «Liga FDN … · Jornada 6»', /J6/.test(dia) && /Jornada 6/.test(panel), `${dia} | ${panel.slice(0, 120)}`)
    await page.evaluate(() => document.getElementById('torneosVistaIcono')?.click())
  }
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
