// Tanda 1376 — Hoy en tarjetas (la versión 2 de «El torneo, renovado»; PINGU:
// «dale con la versión 2 y lo recomendado»):
//   · una tarjeta grande con lo que te toca y UN botón («Mandar mi lista»), sin
//     la cuenta atrás (ya está en la cabecera), y «o usar la de la jornada 6»
//     de un toque;
//   · «Tu puesto» en grande (6º de 8 · 21 puntos) en vez de cuatro filas;
//   · «Tu mazo» con sus Pokémon y «Cambiar»;
//   · la lista se pega en una VENTANA (decisión 2), no en la página.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ahora = Date.now()
const dia = 86400e3
const GENTE = [['user-1', 'pingu'], ['user-2', 'enege'], ['user-3', 'laiafdn'], ['mod-1', 'soyfedeegb'], ['p5', 'srpaquito'], ['p6', 'nox'], ['p7', 'pokecata'], ['p8', 'gorka-rubio']]
// Una liga de diez jornadas de tres rondas, con seis jugadas: entre jornadas.
const TORNEO = { id: 'liga-1', slug: 'liga', name: 'Liga FDN [Oct-Dic]', status: 'in_progress', format: 'league', admin_id: 'user-3', max_players: 32,
  swiss_rounds: 30, rounds_per_matchday: 3, swiss_bo: 1, round_time_minutes: 30, checkin_minutes: 5, start_at: new Date(ahora - 42 * dia).toISOString(),
  matchday_dates: Array.from({ length: 10 }, (_, i) => new Date(ahora + (i - 6) * 7 * dia + 3 * 3600e3).toISOString()) }
let semilla = 7
const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280)
const RONDAS = [], MESAS = [], RES = []
for (let n = 1; n <= 18; n++) {
  RONDAS.push({ id: `r-${n}`, tournament_id: 'liga-1', round_number: n, status: 'finished', phase: 'swiss', started_at: new Date(ahora - (19 - n) * dia).toISOString() })
  const ids = GENTE.map((g) => g[0]).sort(() => azar() - 0.5)
  for (let t = 0; t < 4; t++) {
    const a = ids[t * 2], b = ids[t * 2 + 1], id = `m-${n}-${t}`
    const gana = azar() < 0.5 ? a : b
    MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: 'finished' })
    RES.push({ id: `res-${id}`, match_id: id, result: gana === a ? 'a_wins' : 'b_wins', winner_id: gana, score_a: gana === a ? 1 : 0, score_b: gana === b ? 1 : 0 })
  }
}
const INSC = GENTE.map(([u, n], i) => ({ id: `i-${i}`, tournament_id: 'liga-1', user_id: u, status: 'active', tcg_live_username: `TCG_${n}`, registered_at: new Date(ahora - 50 * dia).toISOString() }))
const TABLON = []
for (let n = 1; n <= 6; n++) {
  TABLON.push({ id: `ta-${n}`, tournament_id: 'liga-1', author_id: null, kind: 'auto', body: `Ronda ${n} en marcha`, created_at: new Date(ahora - (19 - n) * dia).toISOString() })
  TABLON.push({ id: `tb-${n}`, tournament_id: 'liga-1', author_id: null, kind: 'auto', body: `Ronda ${n} cerrada`, created_at: new Date(ahora - (19 - n) * dia + 1800e3).toISOString() })
}
const LISTA = 'Pokémon: 7\n4 Charizard ex OBF 125\n3 Pidgeot ex OBF 164\n'
const CARTAS = { pokemon: [{ quantity: 4, name: 'Charizard ex', set: 'OBF', number: '125' }, { quantity: 3, name: 'Pidgeot ex', set: 'OBF', number: '164' }], trainer: [], energy: [], total: 7 }
const LISTAS = [{ tournament_id: 'liga-1', user_id: 'user-1', matchday: 6, raw_text: LISTA, parsed_cards: CARTAS, submitted_at: new Date(ahora - 8 * dia).toISOString() }]
TABLON.push({ id: 'th-1', tournament_id: 'liga-1', author_id: 'user-3', kind: 'aviso', body: 'El viernes empezamos a las 19:00.', created_at: new Date(ahora - 7200e3).toISOString() })
const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))

const browser = await chromium.launch()
async function abrir(movil) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = d.TABLON; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES; window.__FAKE_LISTAS_JORNADA__ = d.LISTAS
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { TORNEO, INSC, RONDAS, MESAS, RES, TABLON, PERFILES, LISTAS })
  await page.goto(BASE + '/torneo?slug=liga&ver=jugar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

try {
  for (const movil of [false, true]) {
    const quien = movil ? 'Móvil' : 'PC'
    console.log(quien)
    const { page, ctx, errores } = await abrir(movil)
    check(`${quien}: sin errores de página`, errores.length === 0, errores.join(' | '))
    const t = await page.evaluate(() => {
      const c = document.getElementById('torneoProximaCaja')
      const b = c?.querySelector('[data-abrir-jornada]')?.getBoundingClientRect()
      return { titulo: c?.querySelector('.torneo-hoy-titulo')?.textContent.trim(), boton: c?.querySelector('[data-abrir-jornada]')?.textContent.trim(), anterior: c?.querySelector('[data-usar-anterior]')?.textContent.trim(), cuenta: Boolean(c?.querySelector('.torneo-proxima-cuenta')), botonAbajo: b ? Math.round(b.bottom) : null, alto: innerHeight }
    })
    check(`${quien}: la tarjeta dice «Te falta mandar tu lista» con UN botón`, t.titulo === 'Te falta mandar tu lista' && t.boton === 'Mandar mi lista', JSON.stringify(t))
    check(`${quien}: …sin la cuenta atrás (ya está arriba)`, !t.cuenta)
    check(`${quien}: …y «o usar la de la jornada 6»`, /jornada 6/.test(t.anterior || ''), JSON.stringify(t))
    if (movil) check('Móvil: el botón se ve al abrir, sin bajar', t.botonAbajo != null && t.botonAbajo <= t.alto, JSON.stringify(t))
    const p = await page.evaluate(() => ({ num: document.querySelector('.torneo-puesto-num')?.textContent.trim(), texto: document.querySelector('.torneo-puesto-texto b')?.textContent.trim(), filas: document.querySelectorAll('.torneo-como-vas li').length, forma: document.querySelectorAll('#comoVasContenido .torneo-forma').length }))
    check(`${quien}: «Tu puesto» en grande, sin filas de la tabla`, /^\d+º$/.test(p.num || '') && /^de 8 · \d+ puntos?$/.test(p.texto || '') && p.filas === 0 && p.forma === 1, JSON.stringify(p))
    if (!movil) {
      const col = await page.evaluate(() => { const a = document.getElementById('torneoProximaCaja').getBoundingClientRect(); const b = document.getElementById('torneoComoVas').getBoundingClientRect(); return { lado: b.left > a.right - 1, arriba: Math.abs(a.top - b.top) <= 2 } })
      check('PC: lo que te toca a la izquierda y tu puesto a la derecha', col.lado && col.arriba, JSON.stringify(col))
    }
    check(`${quien}: la lista NO está en la página`, !(await page.locator('#torneoDecklistCaja').isVisible()) && !(await page.locator('#decklistTexto').isVisible()))
    await page.click('#torneoProximaCaja [data-abrir-jornada]')
    await page.waitForTimeout(500)
    const v = await page.evaluate(() => ({ abierta: document.getElementById('torneoListaVentana').open, jornada: document.getElementById('decklistJornada')?.value, texto: document.getElementById('decklistTexto')?.value }))
    check(`${quien}: «Mandar mi lista» abre la ventana en la jornada 7, con la lista de la 6 puesta`, v.abierta && v.jornada === '7' && /Charizard/.test(v.texto || ''), JSON.stringify(v))
    await page.click('#torneoListaCerrar')
    await page.waitForTimeout(300)
    check(`${quien}: la X la cierra`, !(await page.evaluate(() => document.getElementById('torneoListaVentana').open)))
    await page.click('#torneoProximaCaja [data-usar-anterior]')
    await page.waitForTimeout(2500)
    const d = await page.evaluate(() => ({ titulo: document.querySelector('#torneoProximaCaja .torneo-hoy-titulo')?.textContent.trim(), mazo: document.getElementById('torneoMazoCaja')?.textContent.replace(/\s+/g, ' ').trim(), mazoVisible: getComputedStyle(document.getElementById('torneoMazoCaja')).display !== 'none', sprites: document.querySelectorAll('#torneoMazoCaja .torneo-mazo-sprites img').length }))
    check(`${quien}: «usar la de la jornada 6» la manda de un toque`, /^Listo: juegas la jornada 7/.test(d.titulo || ''), JSON.stringify(d))
    check(`${quien}: «Tu mazo» con sus Pokémon y «Cambiar»`, d.mazoVisible && /Charizard ex/.test(d.mazo) && /Cambiar/.test(d.mazo) && d.sprites >= 1, JSON.stringify(d))
    await page.click('#torneoMazoCaja [data-abrir-lista]')
    await page.waitForTimeout(400)
    check(`${quien}: «Cambiar» abre la ventana`, await page.evaluate(() => document.getElementById('torneoListaVentana').open))
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
