// Tanda 801 — PINGU: «se ha jugado una ronda y ¿qué? ¿Se ha acabado? No
// debería ser así». En una liga, tras la jornada 1 no salía ningún botón
// (había que cerrar la J2 abajo) y, si nadie había mandado lista para la
// J2, no había forma de emparejarla. Ahora el botón sale siempre, emparejar
// cierra la jornada, y sin listas juegan todos con la de la liga.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const AQUI = dirname(fileURLToPath(import.meta.url))
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const dentroDe = (dias) => new Date(Date.now() + dias * 86400000).toISOString()

const LISTA = 'Pokémon: 4\n4 Pikachu SVI 63\nTrainer: 0\nEnergy: 56\n56 Basic {L} Energy SVE 4\n'
const CARTAS = { pokemon: [{ quantity: 4, name: 'Pikachu', set: 'SVI', number: '63' }], trainer: [], energy: [{ quantity: 56, name: 'Basic {L} Energy', set: 'SVE', number: '4' }], total: 60 }
const GENTE = [['user-1', 'Ash'], ['user-2', 'Misty'], ['user-3', 'Brock'], ['p4', 'Gary'], ['p5', 'Erika'], ['p6', 'Sabrina']]
const JUGADORES = GENTE.map(([id]) => id)

// Una liga de tres jornadas. `jugadas` rondas cerradas; `listas` =
// [usuario, jornada]; `cerradas` = jornadas cerradas por el organizador.
function liga({ jugadas = 1, listas = [], cerradas = [], formato = 'league', estado = 'in_progress', inscritos = JUGADORES } = {}) {
  const rondas = Array.from({ length: jugadas }, (_, i) => ({
    id: `ronda-${i + 1}`, tournament_id: 'torneo-1', round_number: i + 1, phase: 'swiss', status: 'finished', started_at: hace(60 * 24 * (jugadas - i)),
  }))
  const mesas = jugadas >= 1
    ? [['r1-1', 'user-1', 'user-2'], ['r1-2', 'user-3', 'p4'], ['r1-3', 'p5', 'p6']].map(([id, a, b], i) => ({
        id, round_id: 'ronda-1', table_number: i + 1, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(1500), check_in_b_at: hace(1500), finished_at: hace(1450),
      }))
    : []
  return {
    __FAKE_PERFILES__: [['admin-1', 'Oak'], ...GENTE].map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{
      id: 'torneo-1', slug: 'liga', name: 'Liga del Gimnasio', status: estado, admin_id: 'admin-1', format: formato,
      swiss_rounds: 3, swiss_bo: 1, top_cut_size: 0, checkin_minutes: 10, current_round_id: null, max_players: null,
      matchday_dates: [dentroDe(-1), dentroDe(6), dentroDe(13)], decklist_visibility: 'al_terminar', start_at: dentroDe(-1),
    }],
    __FAKE_INSCRIPCIONES__: inscritos.map((u, i) => ({
      id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}`, participation_confirmed_at: hace(3000),
    })),
    __FAKE_RONDAS__: rondas,
    __FAKE_MESAS__: mesas,
    __FAKE_RESULTADOS__: mesas.map((m, i) => ({ id: `res-${i + 1}`, match_id: m.id, result: 'a_wins', winner_id: m.player_a_id })),
    __FAKE_LISTAS_JORNADA__: listas.map(([user_id, matchday]) => ({ tournament_id: 'torneo-1', user_id, matchday, raw_text: LISTA, parsed_cards: CARTAS, submitted_at: hace(100) })),
    __FAKE_JORNADAS_CERRADAS__: cerradas.map((matchday) => ({ tournament_id: 'torneo-1', matchday })),
  }
}

const browser = await chromium.launch()
async function abrir(sem, { sesion = 'user-1', antes = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(([s, se, a]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    if (a) Object.assign(window, a)
  }, [sesion, sem, antes])
  await page.goto(`${BASE}/torneo?slug=liga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const pestana = async (page, id) => {
  await page.click(`[data-pestana="${id}"]`).catch(() => {})
  await page.waitForTimeout(250)
}
const filas = (page) =>
  page.$$eval('.torneo-mis-jornadas-fila', (fs) =>
    fs.map((f) => ({
      texto: f.textContent.replace(/\s+/g, ' ').trim(),
      botones: [...f.querySelectorAll('.torneo-jornada-cambiar')].map((b) => b.textContent.trim()),
    }))
  )
const tablas = (page) => page.evaluate(() => window.__TABLAS__)
const rpcs = (page, nombre) => page.evaluate((n) => (window.__RPCS__ || []).filter((r) => r.nombre === n), nombre)
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))

console.log('── 1. Una liga tras la jornada 1, sin listas de la J2 ──')
{
  // Nadie ha mandado lista para la J2 y la J2 sigue abierta: lo que tenía
  // PINGU. Antes: ni botón ni forma de seguir.
  const { page, errores } = await abrir(liga({ listas: [] }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  check('sale «Generar pareos de la jornada 2» con la J2 abierta', /Generar pareos de la jornada 2/.test((await page.locator('#btnGenerarPareos').textContent().catch(() => '')) || ''))
  const aviso = await page.locator('#rondasAdmin').textContent()
  check('  …y avisa de que la cierra y de que juegan todos con la lista de la liga', /se cierran sus inscripciones/.test(aviso) && /la juegan todos los activos con su lista de la liga/.test(aviso), aviso.replace(/\s+/g, ' ').slice(0, 300))
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const r2 = T.rounds.find((r) => r.round_number === 2)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r2?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('la J2 se empareja', Boolean(r2), JSON.stringify(T.rounds.map((r) => r.round_number)))
  check('  …con los seis activos', JUGADORES.every((u) => sentados.includes(u)), sentados.join(','))
  check('  …y la J2 queda cerrada', T.tournament_matchday_closures.some((c) => c.matchday === 2))
  check('  …sin tocar «la» lista de nadie (no había listas de la J2)', !(await rpcs(page, 'torneos_publicar_listas_jornada')).length)
  check('  …y lo dice', /juegan todos con su lista de la liga/.test(await toasts(page)), await toasts(page))
  check('la liga NO se da por terminada', T.tournaments?.[0]?.status !== 'finished' && !/terminado/i.test(await toasts(page)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Con listas de la J2 y la J2 abierta: un clic la cierra y la empareja con quien tiene lista.
  const { page } = await abrir(liga({ listas: [['user-1', 2], ['user-2', 2], ['user-3', 2]] }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const r2 = T.rounds.find((r) => r.round_number === 2)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r2?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('con listas, un clic cierra la J2 y sienta solo a quien la mandó', Boolean(r2) && T.tournament_matchday_closures.some((c) => c.matchday === 2) && ['user-1', 'user-2', 'user-3'].every((u) => sentados.includes(u)) && !sentados.includes('p6'), sentados.join(','))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
