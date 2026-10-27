// Tanda 1070 — las pantallas: «Tu mazo» de tus mazos guardados, el puesto,
// el mazo predeterminado y la imagen del torneo con sus diseños.
//
//   1. Un torneo nuevo sale con tu predeterminado elegido; se crea con su
//      mazo guardado (el arquetipo deducido, sin escribirlo) y su puesto, y
//      su primera ronda copia el mazo guardado.
//   2. Editarlo con otro mazo y marcarlo de predeterminado: el torneo, sus
//      rondas (el disparador de la 251) y el predeterminado cambian.
//   3. Un mazo cuya lista no dice a qué juega pide el arquetipo a mano.
//   4. Un puesto imposible no se guarda; «A mano» no enlaza mazo; desmarcar
//      el predeterminado lo quita.
//   5. Una partida suelta sale con tu predeterminado; «Cambiar» el arquetipo.
//   6. Cerrar un torneo pregunta el puesto; la tarjeta lo enseña; los de
//      PokeDoc lo sacan de su podio.
//   7. Sin la migración, todo como antes (y nada se rompe).
//   8. La hoja de compartir: diseños, fondos y puesto; se recuerda lo
//      elegido; la partida suelta, solo fondos. Las imágenes, a disco.
//   9. /mazos: la chapa y el «⋯» del predeterminado.
//  10. En el móvil, nada se sale de lado.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const SALIDA = process.env.PD_SALIDA || '/tmp/imagenes-1070'
mkdirSync(SALIDA, { recursive: true })
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const SPRITE = readFileSync(`${RAIZ}/assets/app-icon-192.png`)
const ARQ = [{ id: 'arq-dragapult', nombre: 'Dragapult', iconos: [{ nombre: 'Dragapult ex' }], requiere: [{ nombres: ['Dragapult ex'] }], activo: true }]
const MAZOS = [
  { id: 'mazo-1', user_id: 'user-1', name: 'Dragapult de la liga', format: 'standard', cards: [{ id: 'c-drag', n: 3 }, { id: 'c-drak', n: 3 }], updated_at: '2026-10-26T10:00:00Z' },
  { id: 'mazo-2', user_id: 'user-1', name: 'Pikachu de pruebas', format: 'standard', cards: [{ id: 'c-pika', n: 4 }], updated_at: '2026-10-25T10:00:00Z' },
  { id: 'mazo-3', user_id: 'user-1', name: 'Solo entrenadores', format: 'expanded', cards: [{ id: 'c-boss', n: 4 }], updated_at: '2026-10-24T10:00:00Z' },
  // Uno público de otra persona: no puede salir entre los tuyos.
  { id: 'mazo-ajeno', user_id: 'user-2', name: 'El de Misty', format: 'standard', cards: [], is_public: true },
]
const CARTAS = [
  { id: 'c-drag', name: 'Dragapult ex', category: 'Pokémon', set_id: 'fk', local_id: '1', market: 'WEST', image_path: null },
  { id: 'c-drak', name: 'Drakloak', category: 'Pokemon', set_id: 'fk', local_id: '2', market: 'WEST', image_path: null },
  { id: 'c-pika', name: 'Pikachu ex', category: 'Pokemon', set_id: 'fk', local_id: '3', market: 'WEST', image_path: null },
  { id: 'c-boss', name: "Boss's Orders", category: 'Entrenador', set_id: 'fk', local_id: '4', market: 'WEST', image_path: null },
]
const PREDET = { user_id: 'user-1', user_deck_id: 'mazo-1', mi_mazo: 'a:arq-dragapult', mi_mazo_nombre: 'Dragapult' }

const browser = await chromium.launch()
async function abrir(antes = {}, { movil = false, ruta = '/mis-partidas' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1200, height: 1100 }, locale: 'es-ES' })
  await ctx.route(/r2\.limitlesstcg\.net|\/sprite\/|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: SPRITE, headers: { 'access-control-allow-origin': '*' } }))
  await ctx.route(/\/escaneo\/|api\.tcgdex\.net/, (r) => r.fulfill({ status: 404, body: '' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(({ antes, mazos, cartas, arq }) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__PROYECTAR__ = ['tcg_cards']
    window.__FAKE_MAZOS__ = mazos
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ARQUETIPOS__ = arq
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 }))
    } catch {}
    Object.assign(window, antes)
  }, { antes, mazos: MAZOS, cartas: CARTAS, arq: ARQ })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { ctx, page, errores }
}
const escrituras = (page, tabla, tipo) => page.evaluate(([t, k]) => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === t && e.tipo === k), [tabla, tipo])
const tabla = (page, t) => page.evaluate((x) => (window.__TABLAS__[x] || []).map((f) => ({ ...f })), t)
const marcado = (page, sel) => page.getAttribute(sel, 'aria-checked')
async function elegirRival(page, texto = 'Gardevoir') {
  await page.locator('#selRival1 .selector-mazo-texto').fill(texto)
  await page.waitForTimeout(300)
  await page.locator('#selRival1 .selector-mazo-opcion').first().click()
}
async function marcarVictoria(page) {
  const sinMarcar = await page.evaluate(() => !document.querySelector('#partidaResultado')?.value && !document.querySelector('#partidaCampoResultado')?.classList.contains('hidden'))
  if (sinMarcar) await page.click('#partidaJuegos [data-r="W"]')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un torneo nuevo, con tu predeterminado y tu puesto ──')
{
  const { ctx, page, errores } = await abrir({ __FAKE_AJUSTES_PARTIDAS__: [PREDET] })
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(900)
  check('«Tu mazo» enseña tus mazos guardados (y no el público de otra persona)', (await page.locator('#torneoTuMazo [data-mazo]').count()) === 3 && (await page.locator('#torneoTuMazo [data-mazo="mazo-ajeno"]').count()) === 0)
  check('  …el predeterminado, primero, elegido y con su estrella', (await page.getAttribute('#torneoTuMazo [data-mazo]:first-child', 'data-mazo')) === 'mazo-1' && (await marcado(page, '#torneoTuMazo [data-mazo="mazo-1"]')) === 'true' && (await page.locator('#torneoTuMazo [data-mazo="mazo-1"] .partidas-guardado-predet').count()) === 1)
  check('  …dice con qué arquetipo cuenta, sin escribirlo', /Cuenta como\s*Dragapult/.test(await page.textContent('#torneoTuMazo [data-cuenta-como]')))
  check('  …los selectores de «a mano» no se ven', !(await page.isVisible('#selTorneoMio1')))
  check('  …y la casilla del predeterminado sale marcada', await page.isChecked('#torneoPredeterminado'))
  check('las baldosas llevan los sprites del arquetipo deducido', (await page.locator('#torneoTuMazo [data-mazo="mazo-1"] img.partidas-sprite').count()) >= 1)
  check('se ofrece el puesto (opcional)', await page.isVisible('#torneoLogPuesto') && await page.isVisible('#torneoLogJugadores'))
  await page.fill('#torneoLogNombre', 'Liga del jueves')
  await page.fill('#torneoLogPuesto', '3')
  await page.fill('#torneoLogJugadores', '24')
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(900)
  const [t] = await tabla(page, 'match_log_torneos')
  check('se crea con SU mazo guardado y el arquetipo deducido', t?.user_deck_id === 'mazo-1' && t.mi_mazo === 'a:arq-dragapult' && t.mi_mazo_nombre === 'Dragapult', JSON.stringify(t))
  check('  …y su puesto', t?.puesto === 3 && t.jugadores === 24, JSON.stringify(t))
  check('  …sin tocar el predeterminado (ya lo era)', !(await escrituras(page, 'match_log_ajustes', 'upsert')).length && !(await escrituras(page, 'match_log_ajustes', 'delete')).length)
  // Se abre «Añadir ronda» solo.
  await elegirRival(page)
  await marcarVictoria(page)
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(800)
  const [r] = await tabla(page, 'match_log')
  check('su primera ronda copia el mazo guardado del torneo', r?.torneo_id === t?.id && r.user_deck_id === 'mazo-1' && r.mi_mazo === 'a:arq-dragapult', JSON.stringify(r))
  const cab = await page.textContent(`[data-abrir-torneo="${t?.id}"]`)
  check('la tarjeta enseña el puesto', /3\.º/.test(cab), cab)
  const det = await page.textContent('.partidas-torneo-detalle')
  check('  …y dentro, con qué mazo guardado y «quedaste 3.º de 24»', /con tu mazo Dragapult de la liga/.test(det) && /quedaste 3\.º de 24/.test(det), det.replace(/\s+/g, ' ').slice(0, 160))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Cambiar el mazo del torneo y hacerlo el predeterminado ──')
{
  const TORNEO = { id: 'tl-1', user_id: 'user-1', nombre: 'Liga del jueves', donde: 'Torneo local', mi_mazo: 'a:arq-dragapult', mi_mazo_nombre: 'Dragapult', user_deck_id: 'mazo-1', puesto: 3, jugadores: 24, jugado_el: '2026-10-22' }
  const RONDAS = [1, 2].map((i) => ({ id: `r${i}`, user_id: 'user-1', torneo_id: 'tl-1', mi_mazo: 'a:arq-dragapult', mi_mazo_nombre: 'Dragapult', user_deck_id: 'mazo-1', rival_mazo: 'd:gardevoir ex', rival_mazo_nombre: 'Gardevoir ex', resultado: i === 1 ? 'win' : 'loss', tipo: 'normal', jugada_el: '2026-10-22', created_at: `2026-10-22T1${i}:00:00Z` }))
  const { ctx, page, errores } = await abrir({ __FAKE_AJUSTES_PARTIDAS__: [PREDET], __FAKE_LOG_TORNEOS__: [TORNEO], __FAKE_PARTIDAS__: RONDAS })
  await page.click('[data-abrir-torneo="tl-1"]')
  await page.click('[data-editar-torneo="tl-1"]')
  await page.waitForTimeout(600)
  check('al editar sale elegido SU mazo, con su puesto', (await marcado(page, '#torneoTuMazo [data-mazo="mazo-1"]')) === 'true' && (await page.inputValue('#torneoLogPuesto')) === '3' && (await page.inputValue('#torneoLogJugadores')) === '24')
  await page.click('#torneoTuMazo [data-mazo="mazo-2"]')
  await page.waitForTimeout(500)
  check('elegir otro: cuenta como Pikachu ex y la casilla se desmarca (no es el predeterminado)', /Cuenta como\s*Pikachu ex/.test(await page.textContent('#torneoTuMazo [data-cuenta-como]')) && !(await page.isChecked('#torneoPredeterminado')))
  await page.check('#torneoPredeterminado')
  await page.fill('#torneoLogPuesto', '2')
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(900)
  const [t] = await tabla(page, 'match_log_torneos')
  check('el torneo cambia de mazo guardado, de arquetipo y de puesto', t.user_deck_id === 'mazo-2' && t.mi_mazo === 'd:pikachu ex' && t.mi_mazo_nombre === 'Pikachu ex' && t.puesto === 2, JSON.stringify(t))
  const rondas = await tabla(page, 'match_log')
  check('  …y sus rondas lo siguen (el disparador de la base)', rondas.length === 2 && rondas.every((r) => r.user_deck_id === 'mazo-2' && r.mi_mazo === 'd:pikachu ex'), JSON.stringify(rondas.map((r) => [r.user_deck_id, r.mi_mazo])))
  const [aj] = await tabla(page, 'match_log_ajustes')
  check('  …y Pikachu es ahora tu predeterminado, con su arquetipo', aj?.user_deck_id === 'mazo-2' && aj.mi_mazo === 'd:pikachu ex' && aj.mi_mazo_nombre === 'Pikachu ex' && aj.user_id === 'user-1', JSON.stringify(aj))
  // Y el siguiente torneo sale ya con él.
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(600)
  check('el siguiente torneo nuevo sale ya con Pikachu', (await marcado(page, '#torneoTuMazo [data-mazo="mazo-2"]')) === 'true' && (await page.getAttribute('#torneoTuMazo [data-mazo]:first-child', 'data-mazo')) === 'mazo-2')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Un mazo cuya lista no dice a qué juega ──')
{
  const { ctx, page, errores } = await abrir()
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(600)
  check('sin predeterminado y con mazos guardados, se abre en «Mis mazos» sin ninguno elegido', (await marcado(page, '#torneoTuMazo [data-origen="guardado"]')) === 'true' && (await page.locator('#torneoTuMazo [data-mazo][aria-checked="true"]').count()) === 0)
  await page.click('#torneoTuMazo [data-mazo="mazo-3"]')
  await page.waitForTimeout(500)
  check('elegir el de solo entrenadores pide el arquetipo a mano', /No sabemos a qué juega esa lista/.test(await page.textContent('#torneoTuMazo [data-cuenta-como]')) && (await page.isVisible('#selTorneoMio1')))
  check('  …y su baldosa dice «Sin arquetipo»', /Sin arquetipo/.test(await page.textContent('#torneoTuMazo [data-mazo="mazo-3"]')))
  await page.fill('#torneoLogNombre', 'Torneo de entrenadores')
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(500)
  check('  …y sin decirlo no se crea nada, y se dice por qué', !(await tabla(page, 'match_log_torneos')).length && /Dinos a qué juega ese mazo/.test(await page.textContent('body')))
  await page.locator('#selTorneoMio1 .selector-mazo-texto').fill('Gholdengo')
  await page.waitForTimeout(300)
  await page.locator('#selTorneoMio1 .selector-mazo-opcion').first().click()
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(800)
  const [t] = await tabla(page, 'match_log_torneos')
  check('  …dicho, se crea con el mazo guardado y el arquetipo que pusiste', t?.user_deck_id === 'mazo-3' && /gholdengo/i.test(t.mi_mazo_nombre), JSON.stringify(t))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo imposible, «A mano» y quitar el predeterminado ──')
{
  const { ctx, page, errores } = await abrir({ __FAKE_AJUSTES_PARTIDAS__: [PREDET] })
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(600)
  await page.fill('#torneoLogNombre', 'Regional')
  await page.fill('#torneoLogPuesto', '30')
  await page.fill('#torneoLogJugadores', '24')
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(400)
  check('«30.º de 24» no se guarda, y se dice', !(await tabla(page, 'match_log_torneos')).length && /No puedes quedar 30\.º de 24/.test(await page.textContent('body')))
  await page.fill('#torneoLogPuesto', '')
  await page.fill('#torneoLogJugadores', '')
  // «A mano», y desmarcar el predeterminado.
  await page.click('#torneoTuMazo [data-origen="mano"]')
  check('«A mano» enseña los selectores y esconde tus mazos', (await page.isVisible('#selTorneoMio1')) && !(await page.isVisible('#torneoTuMazo [data-guardados]')))
  await page.locator('#selTorneoMio1 .selector-mazo-texto').fill('Charizard')
  await page.waitForTimeout(300)
  await page.locator('#selTorneoMio1 .selector-mazo-opcion').first().click()
  check('  …con otro mazo la casilla no está marcada', !(await page.isChecked('#torneoPredeterminado')))
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(800)
  const [t] = await tabla(page, 'match_log_torneos')
  check('a mano se guarda sin mazo guardado y sin puesto', t && t.user_deck_id === null && t.puesto === null && t.jugadores === null && /charizard/i.test(t.mi_mazo_nombre), JSON.stringify(t))
  check('  …y no toca el predeterminado', !(await escrituras(page, 'match_log_ajustes', 'delete')).length && (await tabla(page, 'match_log_ajustes'))[0]?.user_deck_id === 'mazo-1')
  check('«A mano» se recuerda para la próxima', (await page.evaluate(() => localStorage.getItem('pokedoc-partidas-origen-mazo-torneo'))) === 'mano')
  // Desmarcar el predeterminado con él elegido lo quita.
  await page.click('[data-cancelar-ronda], #btnCancelarPartida').catch(() => {})
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(500)
  check('el predeterminado manda sobre lo recordado', (await marcado(page, '#torneoTuMazo [data-mazo="mazo-1"]')) === 'true')
  await page.uncheck('#torneoPredeterminado')
  await page.fill('#torneoLogNombre', 'Liga del martes')
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(800)
  check('desmarcarlo con él elegido lo quita', (await escrituras(page, 'match_log_ajustes', 'delete')).length === 1 && !(await tabla(page, 'match_log_ajustes')).length)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Una partida suelta con tu predeterminado ──')
{
  const { ctx, page, errores } = await abrir({ __FAKE_AJUSTES_PARTIDAS__: [PREDET] })
  await page.click('#partidasTabs [data-vista="sueltas"]')
  await page.click('#btnApuntarPartida')
  await page.waitForTimeout(700)
  check('sale con tu predeterminado elegido', (await marcado(page, '#partidaTuMazo [data-mazo="mazo-1"]')) === 'true' && (await page.isChecked('#partidaPredeterminado')))
  // «Cambiar»: el arquetipo, a mano, con el mazo guardado enlazado igual.
  await page.click('#partidaTuMazo [data-cambiar-arq]')
  check('«Cambiar» abre los selectores con el arquetipo puesto', (await page.isVisible('#selMio1')) && /Dragapult/.test(await page.locator('#selMio1 .selector-mazo-texto').inputValue()))
  await page.click('#selMio1 .selector-mazo-limpiar')
  // El selector cierra su lista 120 ms después de perder el foco (al tocar
  // la ×): escribir antes la cerraría. Una persona no escribe tan rápido.
  await page.waitForTimeout(300)
  await page.locator('#selMio1 .selector-mazo-texto').fill('Dusknoir')
  await page.waitForTimeout(300)
  await page.locator('#selMio1 .selector-mazo-opcion').first().click()
  await elegirRival(page)
  await marcarVictoria(page)
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(800)
  const [p] = await tabla(page, 'match_log')
  check('se apunta con el mazo guardado y el arquetipo que dijiste', p?.user_deck_id === 'mazo-1' && /dusknoir/i.test(p.mi_mazo_nombre) && !p.torneo_id, JSON.stringify(p))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Cerrar con el puesto, y los de PokeDoc desde su podio ──')
{
  const TORNEO = { id: 'tl-1', user_id: 'user-1', nombre: 'Liga del jueves', mi_mazo: 'd:x', mi_mazo_nombre: 'X', jugado_el: '2026-10-22' }
  const MAZO_MIO = { pokemon: [{ quantity: 3, name: 'Dragapult ex', set: 'TWM', number: '130' }], trainer: [], energy: [] }
  const MAZO_RIVAL = { pokemon: [{ quantity: 3, name: 'Gardevoir ex', set: 'SVI', number: '86' }], trainer: [], energy: [] }
  const { ctx, page, errores } = await abrir({
    __FAKE_LOG_TORNEOS__: [TORNEO],
    __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa de PokeDoc', status: 'finished', admin_id: 'admin-1', start_at: '2026-10-01T10:00:00Z', podium: ['user-2', 'user-1'] }],
    __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished' }],
    __FAKE_MESAS__: [{ id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' }],
    __FAKE_RESULTADOS__: [{ id: 'res-1', match_id: 'mesa-1', result: 'b_wins', winner_id: 'user-2' }],
    __FAKE_DECKLISTS__: [{ id: 'dk-1', tournament_id: 'torneo-1', user_id: 'user-1', parsed_cards: MAZO_MIO }, { id: 'dk-2', tournament_id: 'torneo-1', user_id: 'user-2', parsed_cards: MAZO_RIVAL }],
  })
  check('el de PokeDoc saca tu puesto de su podio (segundo: «2.º»)', /2\.º/.test(await page.textContent('[data-abrir-torneo="pd-torneo-1"]')))
  await page.click('[data-abrir-torneo="tl-1"]')
  await page.click('[data-cerrar-torneo="tl-1"]')
  await page.waitForTimeout(200)
  await page.fill('[data-cierre-puesto]', '1')
  await page.fill('[data-cierre-jugadores]', '16')
  await page.click('[data-confirmar-cierre="tl-1"]')
  await page.waitForTimeout(800)
  const cambios = await escrituras(page, 'match_log_torneos', 'update')
  check('cerrar guarda el cierre y el puesto en la MISMA escritura', cambios.length === 1 && !!cambios[0].filas[0].cerrado_el && cambios[0].filas[0].puesto === 1 && cambios[0].filas[0].jugadores === 16, JSON.stringify(cambios).slice(0, 200))
  check('  …y la tarjeta enseña «1.º» en oro', (await page.locator('[data-abrir-torneo="tl-1"] .partidas-puesto.oro').count()) === 1)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Sin la migración, como antes ──')
{
  const { ctx, page, errores } = await abrir({ __SIN_COLUMNAS__: { match_log_torneos: ['user_deck_id', 'puesto', 'jugadores'] }, __SIN_TABLAS__: ['match_log_ajustes'], __FAKE_LOG_TORNEOS__: [{ id: 'tl-1', user_id: 'user-1', nombre: 'Viejo', mi_mazo: 'd:x', mi_mazo_nombre: 'X', jugado_el: '2026-10-22' }] })
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(500)
  check('el torneo no ofrece tus mazos, ni el puesto, ni el predeterminado', !(await page.isVisible('#torneoTuMazo [data-origenes]')) && !(await page.isVisible('#torneoLogPuesto')) && !(await page.isVisible('#torneoPredeterminado')) && (await page.isVisible('#selTorneoMio1')))
  await page.fill('#torneoLogNombre', 'Nuevo')
  await page.locator('#selTorneoMio1 .selector-mazo-texto').fill('Gardevoir')
  await page.waitForTimeout(300)
  await page.locator('#selTorneoMio1 .selector-mazo-opcion').first().click()
  await page.click('#btnGuardarTorneoLog')
  await page.waitForTimeout(800)
  const nuevo = (await tabla(page, 'match_log_torneos')).find((t) => t.nombre === 'Nuevo')
  check('  …y crear uno sigue funcionando, sin las columnas nuevas', nuevo && !('user_deck_id' in nuevo) && !('puesto' in nuevo), JSON.stringify(nuevo))
  await page.click('#btnCancelarPartida')
  await page.click('[data-abrir-torneo="tl-1"]')
  await page.click('[data-cerrar-torneo="tl-1"]')
  await page.waitForTimeout(700)
  check('cerrar no pregunta el puesto: cierra como antes', (await page.locator('[data-cierre-puesto]').count()) === 0 && (await page.locator('.partidas-torneo.cerrado').count()) === 1)
  await page.click('#partidasTabs [data-vista="sueltas"]')
  await page.click('#btnApuntarPartida')
  check('la partida suelta sigue ofreciendo tus mazos (la 627 sí está)', await page.isVisible('#partidaTuMazo [data-mazo="mazo-1"]'))
  check('  …pero sin la casilla del predeterminado', !(await page.isVisible('#partidaPredeterminado')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. La hoja de compartir: diseños, fondos y puesto ──')
{
  const TORNEO = { id: 'tl-1', user_id: 'user-1', nombre: 'Liga del jueves', donde: 'Liga de tienda', mi_mazo: 'a:arq-dragapult', mi_mazo_nombre: 'Dragapult', user_deck_id: 'mazo-1', puesto: 3, jugadores: 24, jugado_el: '2026-10-22' }
  const SIN = { id: 'tl-2', user_id: 'user-1', nombre: 'Sin puesto', mi_mazo: 'd:x', mi_mazo_nombre: 'X', jugado_el: '2026-10-20' }
  const nombres = ['Gardevoir ex', 'Charizard ex', 'Raging Bolt ex', 'Lugia VSTAR', 'Gholdengo ex', 'Miraidon ex']
  const RONDAS = nombres.map((n, i) => ({ id: `r${i}`, user_id: 'user-1', torneo_id: 'tl-1', mi_mazo: 'a:arq-dragapult', mi_mazo_nombre: 'Dragapult', rival_mazo: `d:${n.toLowerCase()}`, rival_mazo_nombre: n, resultado: ['win', 'loss', 'win', 'draw', 'win', 'win'][i], tipo: i === 3 ? 'id' : 'normal', jugada_el: '2026-10-22', created_at: `2026-10-22T1${i}:00:00Z` }))
  const SUELTA = { id: 's1', user_id: 'user-1', torneo_id: null, mi_mazo: 'd:dragapult ex', mi_mazo_nombre: 'Dragapult ex', rival_mazo: 'd:gardevoir ex', rival_mazo_nombre: 'Gardevoir ex', resultado: 'win', tipo: 'normal', jugada_el: '2026-10-24', donde: 'TCG Live' }
  const { ctx, page, errores } = await abrir({ __FAKE_LOG_TORNEOS__: [TORNEO, { ...SIN }], __FAKE_PARTIDAS__: [...RONDAS, { ...SUELTA }, { id: 'r-sin', user_id: 'user-1', torneo_id: 'tl-2', mi_mazo: 'd:x', mi_mazo_nombre: 'X', rival_mazo: 'd:y', rival_mazo_nombre: 'Y', resultado: 'win', tipo: 'normal', jugada_el: '2026-10-20' }] })
  await page.click('[data-abrir-torneo="tl-1"]')
  await page.click('[data-compartir-torneo="tl-1"]')
  await page.waitForSelector('.ch-hoja[open] .ch-imagen', { timeout: 10000 })
  check('la hoja ofrece cuatro diseños, tres fondos y «Mi puesto» (encendido)', (await page.locator('[data-ch-diseno]').count()) === 4 && (await page.locator('[data-ch-fondo]').count()) === 3 && (await page.getAttribute('[data-ch-puesto]', 'aria-pressed')) === 'true')
  check('  …y por defecto, Clásico sobre Noche', (await page.getAttribute('[data-ch-diseno="clasico"]', 'aria-pressed')) === 'true' && (await page.getAttribute('[data-ch-fondo="noche"]', 'aria-pressed')) === 'true')
  const src = () => page.getAttribute('.ch-imagen', 'src')
  const antes = await src()
  await page.click('[data-ch-diseno="podio"]')
  await page.waitForTimeout(500)
  const podio = await src()
  await page.click('[data-ch-fondo="claro"]')
  await page.waitForTimeout(500)
  const claro = await src()
  check('cambiar el diseño y el fondo cambia la imagen', antes !== podio && podio !== claro)
  check('  …y se recuerda para la próxima', JSON.stringify(JSON.parse(await page.evaluate(() => localStorage.getItem('pokedoc-imagen-partidas')))) === JSON.stringify({ diseno: 'podio', fondo: 'claro', puesto: true }))
  await page.click('[data-ch-red="x"]')
  await page.waitForTimeout(400)
  check('el texto para X lleva el puesto…', /3\.º de 24 · 4-1-1/.test(await page.textContent('#chTextoX')), await page.textContent('#chTextoX'))
  await page.click('[data-ch-puesto]')
  await page.waitForTimeout(400)
  check('  …y sin «Mi puesto», no (ni en el enlace de X)', !/3\.º/.test(await page.textContent('#chTextoX')) && !/3\.%C2%BA/.test(await page.getAttribute('[data-ch-x]', 'href')))
  // Cada diseño, en cada forma y fondo: que se dibuja, a su medida, y a disco.
  const medidas = await page.evaluate(async () => {
    const M = await import('/js/partida-imagen.js')
    const cargar = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = u })
    const img = await cargar('/assets/app-icon-192.png')
    const spr = img ? [{ img }] : []
    const rondas = ['Gardevoir ex', 'Charizard ex', 'Raging Bolt ex', 'Lugia VSTAR', 'Gholdengo ex', 'Miraidon ex', 'Terapagos ex'].map((n, i) => ({ ronda: i + 1, rival: { nombre: n, sprites: spr }, resultado: ['win', 'loss', 'win', 'draw', 'win', 'win', 'loss'][i], tipo: i === 3 ? 'id' : 'normal' }))
    const t = { nombre: 'Liga del jueves — Semana 3', donde: 'Liga de tienda', fecha: '2026-10-23', mazo: { nombre: 'Dragapult ex', sprites: [...spr, ...spr] }, rondas, puesto: 3, jugadores: 24 }
    const salida = {}
    for (const d of M.DISENOS) for (const f of M.FONDOS) for (const forma of ['larga', 'historia', 'apaisada']) {
      const c = document.createElement('canvas')
      M.pintarTorneo(c, t, forma, { diseno: d.id, fondo: f.id, puesto: true })
      salida[`torneo-${d.id}-${f.id}-${forma}`] = { w: c.width, h: c.height, png: c.toDataURL('image/png') }
    }
    for (const f of M.FONDOS) {
      const c = document.createElement('canvas')
      M.pintarPartida(c, { mio: { nombre: 'Dragapult ex', sprites: spr }, rival: { nombre: 'Gardevoir ex', sprites: spr }, resultado: 'win', donde: 'TCG Live', fecha: '2026-10-24' }, 'historia', { fondo: f.id })
      salida[`partida-${f.id}`] = { w: c.width, h: c.height, png: c.toDataURL('image/png') }
    }
    return salida
  })
  const lista = Object.entries(medidas)
  check(`${lista.length} imágenes dibujadas (4 diseños × 3 fondos × 3 formas, y la partida en 3 fondos)`, lista.length === 39)
  check('  …cada una a su medida: 1080×1920, 1080×1350 y 1200×630', lista.every(([k, v]) => (/larga/.test(k) ? v.w === 1080 && v.h === 1920 : /apaisada/.test(k) ? v.w === 1200 && v.h === 630 : v.w === 1080 && v.h === 1350)))
  check('  …y todas distintas entre sí (ningún diseño ni fondo se queda sin aplicar)', new Set(lista.map(([, v]) => v.png)).size === lista.length)
  for (const [k, v] of lista) writeFileSync(`${SALIDA}/${k}.png`, Buffer.from(v.png.split(',')[1], 'base64'))
  console.log(`   (imágenes en ${SALIDA})`)
  await page.keyboard.press('Escape')
  // Un torneo sin puesto: sin el botón. Y se abre con lo recordado.
  await page.click('[data-abrir-torneo="tl-2"]')
  await page.click('[data-compartir-torneo="tl-2"]')
  await page.waitForSelector('.ch-hoja[open] .ch-imagen', { timeout: 10000 })
  check('un torneo sin puesto no ofrece «Mi puesto»', (await page.locator('[data-ch-puesto]').count()) === 0)
  check('  …y abre con lo que elegiste la última vez (Podio, Claro)', (await page.getAttribute('[data-ch-diseno="podio"]', 'aria-pressed')) === 'true' && (await page.getAttribute('[data-ch-fondo="claro"]', 'aria-pressed')) === 'true')
  await page.keyboard.press('Escape')
  // La partida suelta: solo fondos.
  await page.click('#partidasTabs [data-vista="sueltas"]')
  await page.click('[data-compartir="s1"]')
  await page.waitForSelector('.ch-hoja[open] .ch-imagen', { timeout: 10000 })
  check('la partida suelta ofrece los fondos, sin diseños ni puesto', (await page.locator('[data-ch-fondo]').count()) === 3 && (await page.locator('[data-ch-diseno]').count()) === 0 && (await page.locator('[data-ch-puesto]').count()) === 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. /mazos: el predeterminado ──')
{
  const { ctx, page, errores } = await abrir({ __FAKE_AJUSTES_PARTIDAS__: [PREDET] }, { ruta: '/mazos' })
  await page.waitForTimeout(800)
  check('el predeterminado lleva su chapa', (await page.locator('[data-id="mazo-1"] .mz-chip-predet').count()) === 1 && (await page.locator('.mz-chip-predet').count()) === 1)
  await page.click('[data-id="mazo-2"] .cm-mazo-mas summary')
  check('  …y el «⋯» de otro ofrece hacerlo el tuyo', /Mi mazo predeterminado/.test(await page.textContent('[data-id="mazo-2"] [data-predeterminado]')))
  await page.click('[data-id="mazo-2"] [data-predeterminado]')
  await page.waitForTimeout(600)
  const [aj] = await tabla(page, 'match_log_ajustes')
  check('  …y lo hace: la chapa se muda y la base lo guarda', (await page.locator('[data-id="mazo-2"] .mz-chip-predet').count()) === 1 && aj?.user_deck_id === 'mazo-2', JSON.stringify(aj))
  await page.click('[data-id="mazo-2"] .cm-mazo-mas summary')
  check('  …y entonces ofrece quitarlo', /Quitar de predeterminado/.test(await page.textContent('[data-id="mazo-2"] [data-predeterminado]')))
  await page.click('[data-id="mazo-2"] [data-predeterminado]')
  await page.waitForTimeout(600)
  check('  …y quitarlo lo quita', (await page.locator('.mz-chip-predet').count()) === 0 && !(await tabla(page, 'match_log_ajustes')).length)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const sin = await abrir({ __SIN_TABLAS__: ['match_log_ajustes'] }, { ruta: '/mazos' })
  await sin.page.waitForTimeout(800)
  check('sin la tabla, el «⋯» no lo ofrece', (await sin.page.locator('[data-predeterminado]').count()) === 0)
  await sin.ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 10. En el móvil ──')
{
  const { ctx, page, errores } = await abrir({ __FAKE_AJUSTES_PARTIDAS__: [PREDET] }, { movil: true })
  await page.click('#btnApuntarTorneo')
  await page.waitForTimeout(800)
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('el formulario no se sale de lado', desborde <= 0, desborde)
  const alto = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#torneoTuMazo [data-origen]')]
    return b.map((x) => Math.round(x.getBoundingClientRect().height))
  })
  check('«Mis mazos / A mano» en una línea y a 44 al dedo', alto.every((h) => h >= 44 && h < 60), alto.join(','))
  await page.screenshot({ path: `${SALIDA}/movil-torneo.png` })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
