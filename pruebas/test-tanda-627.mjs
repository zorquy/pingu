// Tanda 627 — tus repeticiones en Mis partidas, enlazadas con tus mazos
// guardados.
//
// PINGU: «que puedas añadir tus repeticiones a tus partidas vinculando las
// repeticiones a uno de los mazos que tienes guardados en el constructor».
//
//   1. Lo puro (js/partidas-mazos.js), en Node: el arquetipo de un mazo
//      guardado, la fila que sale de una repetición, cuáles faltan por
//      apuntar.
//   2. La base, contra PostgreSQL: `match_log.user_deck_id`, solo con un
//      mazo TUYO, y borrar el mazo deja la partida.
//   3. /mis-partidas: «+ Desde una repetición», el mazo guardado en el
//      formulario, y la fila con su enlace al constructor.
//   4. Antes de la migración: no se ofrece, y apuntar sigue funcionando.
//   5. /repeticiones: al guardar, «Con tu mazo guardado».
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.RAIZ || '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const PM = await import(`${RAIZ}/js/partidas-mazos.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Lo puro ──')
const DRAGAPULT = { id: 'arq-dragapult', nombre: 'Dragapult', iconos: [{ nombre: 'Dragapult ex' }], requiere: [{ nombres: ['Dragapult ex'] }], activo: true }
const FILAS = new Map([
  ['c-drag', { id: 'c-drag', name: 'Dragapult ex', category: 'Pokémon' }],
  ['c-drak', { id: 'c-drak', name: 'Drakloak', category: 'Pokemon' }],
  ['c-boss', { id: 'c-boss', name: "Boss's Orders", category: 'Entrenador' }],
  ['c-ene', { id: 'c-ene', name: 'Psychic Energy', category: 'Energía' }],
  ['c-pika', { id: 'c-pika', name: 'Pikachu ex', category: 'Pokemon' }],
])
const filaDe = (id) => FILAS.get(id)
{
  const lista = PM.listaDeMazoGuardado([{ id: 'c-drag', n: 3 }, { id: 'c-boss', n: 2 }, { id: 'c-ene', n: 8 }, { id: 'no-esta', n: 4 }], filaDe)
  check('las secciones salen de la categoría, en inglés o en español', lista.pokemon.length === 1 && lista.trainer.length === 1 && lista.energy.length === 1, JSON.stringify(lista))
  check('  …con el nombre INGLÉS y las copias', lista.pokemon[0].name === 'Dragapult ex' && lista.pokemon[0].quantity === 3)
  check('  …y lo que el catálogo ya no tiene, fuera', [...lista.pokemon, ...lista.trainer, ...lista.energy].length === 3)
  const arq = PM.arquetipoDeMazoGuardado([{ id: 'c-drag', n: 3 }, { id: 'c-drak', n: 3 }], filaDe, [DRAGAPULT])
  check('un mazo guardado que el catálogo conoce: su arquetipo', arq?.id === 'arq-dragapult' && arq.nombre === 'Dragapult', JSON.stringify(arq))
  const deducido = PM.arquetipoDeMazoGuardado([{ id: 'c-pika', n: 4 }], filaDe, [DRAGAPULT])
  check('  …y uno que no, deducido de sus Pokémon', deducido && !deducido.id && /Pikachu/.test(deducido.nombre), JSON.stringify(deducido))
  check('  …y sin Pokémon, ninguno (no se inventa)', PM.arquetipoDeMazoGuardado([{ id: 'c-boss', n: 4 }], filaDe, [DRAGAPULT]) === null)

  check('la clave de un mazo por su nombre: la del catálogo si se llama así', PM.claveDeNombreDeMazo('Dragapult', [DRAGAPULT]) === 'a:arq-dragapult')
  check('  …la deducida si no', PM.claveDeNombreDeMazo('Gardevoir ex', [DRAGAPULT]) === 'd:gardevoir ex', PM.claveDeNombreDeMazo('Gardevoir ex', [DRAGAPULT]))
  check('  …y «sin-mazo» sin nombre', PM.claveDeNombreDeMazo('', [DRAGAPULT]) === 'sin-mazo')

  const REP = { id: 'rep1', jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Azul', mazo_a: 'Gardevoir ex', mazo_b: 'Dragapult', created_at: '2026-10-03T10:00:00Z' }
  check('el resultado desde quien eras', PM.resultadoDeRepeticion(REP, 'Azul') === 'win' && PM.resultadoDeRepeticion(REP, 'Rojo') === 'loss')
  check('  …y sin ganador en el registro, no se supone', PM.resultadoDeRepeticion({ ...REP, ganador: null }, 'Azul') === null)
  const sinMazo = PM.partidaDesdeRepeticion({ rep: REP, yo: 'Rojo', resultado: 'loss', userId: 'u1', catalogo: [DRAGAPULT], fecha: '2026-10-03' })
  check('la fila de una repetición: tu mazo y el suyo, el resultado, la fecha y el enlace', sinMazo.mi_mazo === 'd:gardevoir ex' && sinMazo.mi_mazo_nombre === 'Gardevoir ex' && sinMazo.rival_mazo === 'a:arq-dragapult' && sinMazo.resultado === 'loss' && sinMazo.jugada_el === '2026-10-03' && sinMazo.replay_id === 'rep1' && sinMazo.donde === 'TCG Live', JSON.stringify(sinMazo))
  check('  …sin mazo guardado, sin la columna', !('user_deck_id' in sinMazo))
  const conMazo = PM.partidaDesdeRepeticion({ rep: REP, yo: 'Rojo', resultado: 'loss', userId: 'u1', catalogo: [DRAGAPULT], mazoGuardado: 'mazo-9', arqGuardado: { id: null, nombre: 'Pikachu ex' }, conVinculo: true })
  check('con mazo guardado: tu mazo es EL GUARDADO (la lista entera), no lo que se vio', conMazo.mi_mazo === 'd:pikachu ex' && conMazo.mi_mazo_nombre === 'Pikachu ex' && conMazo.user_deck_id === 'mazo-9', JSON.stringify(conMazo))
  const sinColumna = PM.partidaDesdeRepeticion({ rep: REP, yo: 'Rojo', resultado: 'loss', userId: 'u1', mazoGuardado: 'mazo-9', conVinculo: false })
  check('  …pero sin la migración, la columna NO va (haría fallar el insert entero)', !('user_deck_id' in sinColumna))

  const reps = [{ id: 'a', created_at: '2026-10-01' }, { id: 'b', created_at: '2026-10-03' }, { id: 'c', created_at: '2026-10-02' }]
  const libres = PM.repeticionesSinApuntar(reps, [{ repeticion: 'c' }])
  check('las que faltan por apuntar, la más nueva primero', libres.map((r) => r.id).join(',') === 'b,a', libres.map((r) => r.id).join(','))
  const ops = PM.opcionesDeMazosGuardados([{ id: 'm1', name: 'Uno' }], 'm-borrado')
  check('el desplegable conserva el mazo que la fila YA tiene (tanda 472)', ops.length === 2 && ops[1].id === 'm-borrado', JSON.stringify(ops))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La base, contra PostgreSQL ──')
{
  const SQL = readFileSync(`${RAIZ}/supabase-migration-partidas-mazo-guardado.sql`, 'utf8')
  check('la columna se suelta al borrar el mazo', /user_deck_id uuid references public\.user_decks \(id\) on delete set null/.test(SQL))
  check('y un disparador exige que el mazo sea TUYO', /d\.id = new\.user_deck_id and d\.user_id = new\.user_id/.test(SQL) && /create trigger match_log_mazo_propio/.test(SQL))
  check('y avisa a PostgREST de la columna nueva', /notify pgrst, 'reload schema'/.test(SQL))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', `raiz=${RAIZ}`, '-f', new URL('./sql-partidas-mazo.sql', import.meta.url).pathname], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 14 && !fallos.length, fallos.slice(0, 3).join(' | '))
  }
}

// ═════════════════════════════════════════════════════════════════════
const browser = await chromium.launch()
const MAZOS = [
  { id: 'mazo-1', user_id: 'user-1', name: 'Dragapult de la liga', cards: [{ id: 'c-drag', n: 3 }, { id: 'c-drak', n: 3 }] },
  { id: 'mazo-2', user_id: 'user-1', name: 'Pikachu de pruebas', cards: [{ id: 'c-pika', n: 4 }] },
  // Uno de otra persona, público: no puede salir en tus desplegables.
  { id: 'mazo-ajeno', user_id: 'user-2', name: 'El de Misty', cards: [], is_public: true },
]
const CARTAS = [...FILAS.values()].map((f, i) => ({ ...f, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null }))
const REPS = [
  { id: 'rep0000001', user_id: 'user-1', titulo: 'Contra Lugia', jugador_a: 'PinguTCG', jugador_b: 'Rival1', ganador: 'PinguTCG', mazo_a: 'Dragapult ex', mazo_b: 'Lugia VSTAR', created_at: '2026-10-03T18:00:00Z' },
  { id: 'rep0000002', user_id: 'user-1', titulo: 'Sin final', jugador_a: 'Otro', jugador_b: 'PinguTCG', ganador: null, mazo_a: 'Miraidon ex', mazo_b: 'Dragapult ex', created_at: '2026-10-04T18:00:00Z' },
  { id: 'rep0000003', user_id: 'user-1', titulo: 'Ya apuntada', jugador_a: 'PinguTCG', jugador_b: 'X', ganador: 'X', mazo_a: 'A', mazo_b: 'B', created_at: '2026-10-05T18:00:00Z' },
]
const YA = { id: 'mlog-ya', user_id: 'user-1', mi_mazo: 'd:a', rival_mazo: 'd:b', mi_mazo_nombre: 'A', rival_mazo_nombre: 'B', resultado: 'loss', jugada_el: '2026-10-05', donde: 'TCG Live', replay_id: 'rep0000003', user_deck_id: 'mazo-2' }

async function misPartidas(antes = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/cdn\.jsdelivr|limitlesstcg|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(({ antes, mazos, cartas, reps, ya }) => {
    window.__FAKE_SESSION__ = 'user-1'
    // Las columnas que no se piden no llegan (como en la base): el
    // arquetipo de un mazo guardado necesita la CATEGORÍA de sus cartas.
    window.__PROYECTAR__ = ['tcg_cards']
    window.__FAKE_MAZOS__ = mazos
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_REPETICIONES__ = reps
    window.__FAKE_PARTIDAS__ = [ya]
    window.__FAKE_ARQUETIPOS__ = [{ id: 'arq-dragapult', nombre: 'Dragapult', iconos: [{ nombre: 'Dragapult ex' }], requiere: [{ nombres: ['Dragapult ex'] }], activo: true }]
    try {
      localStorage.removeItem('pokedoc-repeticion-yo')
    } catch {}
    Object.assign(window, antes)
  }, { antes, mazos: MAZOS, cartas: CARTAS, reps: REPS, ya: YA })
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.click('#partidasTabs [data-vista="sueltas"]')
  return { page, errores }
}
const filasLog = (page) => page.evaluate(() => window.__TABLAS__.match_log.map((f) => ({ ...f })))

console.log('\n── 3. /mis-partidas: desde una repetición, con tu mazo guardado ──')
{
  const { page, errores } = await misPartidas()
  check('la apuntada enseña su mazo guardado, con enlace al constructor', (await page.getAttribute('.partidas-fila-guardado a', 'href')) === '/constructor?mazo=mazo-2' && /Pikachu de pruebas/.test(await page.textContent('.partidas-fila-guardado')))
  await page.click('#btnDesdeRepeticion')
  const opciones = await page.$$eval('#desdeRepSel option', (xs) => xs.map((x) => x.value))
  check('ofrece tus repeticiones SIN apuntar, la más nueva primero', opciones.join(',') === 'rep0000002,rep0000001', opciones.join(','))
  const mazos = await page.$$eval('#desdeRepMazo option', (xs) => xs.map((x) => x.textContent))
  check('«Con tu mazo guardado»: los tuyos, no el público de otra persona', mazos.join('|') === 'Ninguno|Dragapult de la liga|Pikachu de pruebas', mazos.join('|'))
  // La primera es la que no dice quién ganó: hay que decirlo.
  check('la que no dice quién ganó pregunta cómo acabó', (await page.locator('#desdeRepResultado').count()) === 1)
  await page.click('#desdeRepForm input[name="desdeRepYo"][value="PinguTCG"]')
  await page.click('#btnGuardarDesdeRep')
  await page.waitForTimeout(300)
  check('  …y sin decirlo no apunta nada', (await filasLog(page)).length === 1)
  // La otra, la de Lugia, ganada, con el mazo de Dragapult.
  await page.selectOption('#desdeRepSel', 'rep0000001')
  await page.waitForTimeout(100)
  check('al cambiar de repetición, cambian los jugadores', /Rival1/.test(await page.textContent('#desdeRepForm')) && (await page.locator('#desdeRepResultado').count()) === 0)
  await page.click('#desdeRepForm input[name="desdeRepYo"][value="PinguTCG"]')
  await page.selectOption('#desdeRepMazo', 'mazo-1')
  await page.click('#btnGuardarDesdeRep')
  await page.waitForTimeout(800)
  const nueva = (await filasLog(page)).find((f) => f.replay_id === 'rep0000001')
  check('se apunta: ganada, contra Lugia, con su repetición y SU mazo guardado', nueva?.resultado === 'win' && nueva.rival_mazo_nombre === 'Lugia VSTAR' && nueva.user_deck_id === 'mazo-1' && nueva.donde === 'TCG Live' && nueva.jugada_el === '2026-10-03', JSON.stringify(nueva))
  check('  …y tu mazo sale del guardado (el arquetipo del catálogo)', nueva?.mi_mazo === 'a:arq-dragapult' && nueva.mi_mazo_nombre === 'Dragapult', JSON.stringify(nueva))
  check('  …y recuerda quién eres, como /repeticiones', (await page.evaluate(() => localStorage.getItem('pokedoc-repeticion-yo'))) === 'PinguTCG')
  check('  …y sale en la lista con su mazo', /Dragapult de la liga/.test(await page.textContent('#partidasLista')))

  // El formulario de siempre, con el mazo guardado.
  await page.click('#btnApuntarPartida')
  check('el formulario lleva «Con tu mazo guardado»', await page.isVisible('#partidaMazoGuardado'))
  await page.selectOption('#partidaMazoGuardado', 'mazo-1')
  await page.waitForTimeout(600)
  const mio = await page.locator('#selMio1 .selector-mazo-texto').inputValue()
  check('  …y elegirlo con «Tu mazo» vacío lo rellena con su arquetipo', /Dragapult/.test(mio), mio)
  await page.locator('#selRival1 .selector-mazo-texto').fill('Gardevoir')
  await page.waitForTimeout(400)
  await page.locator('#selRival1 .selector-mazo-opcion').first().click()
  await guardarPartida(page)
  await page.waitForTimeout(700)
  const amano = (await filasLog(page)).find((f) => !f.replay_id && f.id !== 'mlog-ya')
  check('  …y se guarda con él', amano?.user_deck_id === 'mazo-1' && amano.mi_mazo === 'a:arq-dragapult', JSON.stringify(amano))
  // Editar la ya apuntada: el desplegable trae el suyo.
  await page.click('[data-editar="mlog-ya"]')
  check('al editar, el desplegable trae el mazo que la partida ya tiene', (await page.inputValue('#partidaMazoGuardado')) === 'mazo-2')
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Un torneo apuntado: sus rondas no llevan mazo guardado (el mazo es el
  // del torneo).
  const { page } = await misPartidas({ __FAKE_LOG_TORNEOS__: [{ id: 'tl-1', user_id: 'user-1', nombre: 'Liga', mi_mazo: 'd:x', mi_mazo_nombre: 'X', jugado_el: '2026-10-01' }] })
  await page.click('#partidasTabs [data-vista="torneos"]')
  await page.click('[data-abrir-torneo="tl-1"]')
  await page.click('[data-anadir-ronda="tl-1"]')
  check('en una ronda de torneo no se ofrece', !(await page.isVisible('#partidaMazoGuardado')))
  await page.close()
}

console.log('\n── 4. Antes de la migración ──')
{
  const { page, errores } = await misPartidas({ __SIN_COLUMNAS__: { match_log: ['user_deck_id'] } })
  await page.click('#btnApuntarPartida')
  check('el formulario NO ofrece el mazo guardado (no habría dónde guardarlo)', !(await page.isVisible('#partidaMazoGuardado')))
  await page.click('#btnDesdeRepeticion')
  await page.selectOption('#desdeRepSel', 'rep0000001')
  await page.click('#desdeRepForm input[name="desdeRepYo"][value="PinguTCG"]')
  await page.selectOption('#desdeRepMazo', 'mazo-1')
  await page.click('#btnGuardarDesdeRep')
  await page.waitForTimeout(800)
  const nueva = (await filasLog(page)).find((f) => f.replay_id === 'rep0000001')
  check('apuntar desde una repetición sigue funcionando, sin la columna', nueva && !('user_deck_id' in nueva) && nueva.mi_mazo === 'a:arq-dragapult', JSON.stringify(nueva))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. /repeticiones: «Con tu mazo guardado» al guardar ──')
{
  const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8').replace(/\r/g, '')
  const abrir = async (antes = {}) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
    await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 404, body: '' }))
    await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.addInitScript(({ mazos, cartas, antes }) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__PROYECTAR__ = ['tcg_cards']
      window.__FAKE_MAZOS__ = mazos
      window.__FAKE_CARTAS__ = cartas
      window.__FAKE_ARQUETIPOS__ = [{ id: 'arq-dragapult', nombre: 'Dragapult', iconos: [{ nombre: 'Dragapult ex' }], requiere: [{ nombres: ['Dragapult ex'] }], activo: true }]
      Object.assign(window, antes)
    }, { mazos: MAZOS, cartas: CARTAS, antes })
    await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
    await page.fill('#repTexto', REGISTRO)
    await page.click('#repFormulario button[type=submit]')
    await page.waitForSelector('#repSala:not(.hidden)')
    await page.click('[data-accion="guardar"]')
    await page.waitForSelector('#repQuien', { timeout: 10000 }).catch(() => null)
    await page.waitForTimeout(600)
    return { page, errores }
  }
  {
    const { page, errores } = await abrir()
    const ops = await page.$$eval('#repMazoGuardado option', (xs) => xs.map((x) => x.textContent)).catch(() => [])
    check('al guardar se ofrece «Con tu mazo guardado», con los tuyos', ops.join('|') === 'Ninguno|Dragapult de la liga|Pikachu de pruebas', ops.join('|'))
    // Azul jugó Dragapult (eso se le vio), pero dice que su lista es la de
    // Pikachu: manda la LISTA.
    await page.click('#repQuien input[value="Azul"]')
    await page.selectOption('#repMazoGuardado', 'mazo-2')
    await page.click('#repFormGuardar [type=submit]')
    await page.waitForFunction(() => !document.getElementById('repDialogo').open, null, { timeout: 8000 }).catch(() => null)
    const fila = await page.evaluate(() => window.__TABLAS__.match_log.at(-1))
    check('  …y la partida apuntada lleva el mazo, y tu mazo es EL GUARDADO, no lo que se vio', fila?.user_deck_id === 'mazo-2' && fila.mi_mazo === 'd:pikachu ex' && fila.resultado === 'loss', JSON.stringify(fila))
    check('sin errores', !errores.length, errores.join(' | '))
    await page.close()
  }
  {
    const { page } = await abrir({ __SIN_COLUMNAS__: { match_log: ['user_deck_id'] } })
    check('antes de la migración, no se ofrece', (await page.locator('#repMazoGuardado').count()) === 0)
    await page.close()
  }
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)

// Desde la 632 el resultado no viene marcado («Ganada» por defecto era
// apuntar una victoria que nadie había marcado): si la prueba no lo ha
// elegido, se marca la victoria antes de guardar, como haría quien apunta.
async function guardarPartida(page) {
  const sinMarcar = await page.evaluate(() => !document.querySelector('#partidaResultado')?.value && !document.querySelector('#partidaCampoResultado')?.classList.contains('hidden'))
  if (sinMarcar) await page.click('#partidaJuegos [data-r="W"]')
  await page.click('#btnGuardarPartida')
}
