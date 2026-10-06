// Tanda 632 — Mis partidas al mejor de tres, juego a juego.
//
// PINGU: «me falta que se pueda marcar en Mis partidas el Bo3: algo más
// dinámico, tipo poner game 1 W, L, T y así consecutivamente, como
// trainingcourt.app; una interfaz más cómoda para rellenar tus partidas».
//
// Lo que se prueba:
//   1. Las cuentas (js/partidas-juegos.js): el resultado sale de los juegos
//      —«V, E» es una victoria 1-0, «V D E» un empate—, lo que sobra de una
//      partida decidida se quita y las columnas van y vuelven.
//   2. La migración, sentencia a sentencia (como el SQL Editor, 631), con
//      sus tres reglas y dos veces.
//   3. En la página: Bo1 de un toque; Bo3 fila a fila, con la siguiente
//      saliendo al marcar la anterior y la tercera solo si hace falta; quién
//      empezó; lo que se guarda; sin resultado no se guarda; editar la
//      devuelve como estaba; la lista y las estadísticas lo enseñan; una
//      ronda de torneo abre al mejor de tres; y sin la migración, Bo1 y sin
//      mandar columnas que la base no tiene.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const J = await import(`${RAIZ}/js/partidas-juegos.js`)
const js = (txt, sal = '') => [...txt].map((r, i) => ({ r, s: sal[i] === '1' || sal[i] === '2' ? sal[i] : null }))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las cuentas ──')
check('Bo1: lo que diga el juego', J.resultadoDeJuegos('bo1', js('L')) === 'loss')
check('Bo3 2-1: ganada', J.resultadoDeJuegos('bo3', js('WLW')) === 'win')
check('Bo3 V, E (se acabó el tiempo): ganada 1-0', J.resultadoDeJuegos('bo3', js('WT')) === 'win')
check('Bo3 V D E: empate', J.resultadoDeJuegos('bo3', js('WLT')) === 'draw')
check('Bo3 D D: perdida', J.resultadoDeJuegos('bo3', js('LL')) === 'loss')
check('sin juegos no hay resultado (null, no un empate)', J.resultadoDeJuegos('bo3', []) === null)
check('2-0 no tiene juego 3: se quita', JSON.stringify(J.recortar('bo3', js('WWL')).map((j) => j.r)) === '["W","W"]')
check('un hueco en medio corta ahí', J.recortar('bo3', [{ r: 'W' }, { r: null }, { r: 'L' }]).length === 1)
check('filas: una más mientras no está decidida, ninguna de más si lo está', J.filasVisibles('bo3', []) === 1 && J.filasVisibles('bo3', js('W')) === 2 && J.filasVisibles('bo3', js('WL')) === 3 && J.filasVisibles('bo3', js('WW')) === 2)
const col = J.aColumnas('bo3', js('WLW', '--1'))
check('a columnas: «WLW» y la salida con «-» donde no se sabe', col.formato === 'bo3' && col.juegos === 'WLW' && col.salida === '--1', JSON.stringify(col))
check('sin ninguna salida, salida null', J.aColumnas('bo3', js('WL')).salida === null)
const vuelta = J.deColumnas(col)
check('y de vuelta, igual', vuelta.formato === 'bo3' && vuelta.juegos.map((j) => j.r + (j.s || '-')).join('') === 'W-L-W1', JSON.stringify(vuelta))
check('una fila de antes: Bo1 sin juegos', JSON.stringify(J.deColumnas({ resultado: 'win' })) === '{"formato":"bo1","juegos":[]}')
const c = J.cifrasDeJuegos([{ formato: 'bo3', juegos: js('WLW', '121') }, { formato: 'bo3', juegos: js('LL', '22') }, { formato: 'bo1', juegos: [] }])
check('cifras: 2-3 en juegos, 2 de 2 empezando tú, 0 de 3 empezando el rival', c.partidas === 2 && c.juegos.g === 2 && c.juegos.p === 3 && c.primero.g === 2 && c.primero.total === 2 && c.segundo.g === 0 && c.segundo.total === 3, JSON.stringify(c))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La migración, sentencia a sentencia ──')
{
  const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const psql = (sql) => execFileSync('psql', [...PSQL, '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const intenta = (sql) => {
    try {
      psql(sql)
      return ''
    } catch (e) {
      return String(e.stderr || e.message).split('\n')[0]
    }
  }
  const sentencias = (sql) => sql.replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)
  psql(`drop table if exists public.match_log cascade;
    create table public.match_log (id serial primary key, user_id uuid, resultado text not null);
    insert into public.match_log (resultado) values ('win');`)
  const mig = readFileSync(`${RAIZ}/supabase-migration-partidas-juegos.sql`, 'utf8')
  let error = ''
  for (const vez of [1, 2]) for (const s of sentencias(mig)) error ||= intenta(s) && `pasada ${vez}: ${intenta(s)}`
  check('se ejecuta entera dos veces, cada sentencia por su lado', !error, error)
  check('una fila de antes sigue valiendo (todo null)', !intenta("update public.match_log set resultado = 'loss' where id = 1"))
  check('Bo3 «WLW» con salida «--1»: vale', !intenta("insert into public.match_log (resultado, formato, juegos, salida) values ('win', 'bo3', 'WLW', '--1')"))
  check('Bo1 con dos juegos: no', /match_log_juegos_ok/.test(intenta("insert into public.match_log (resultado, formato, juegos) values ('win', 'bo1', 'WL')")))
  check('cuatro juegos: no', /match_log_juegos_ok/.test(intenta("insert into public.match_log (resultado, formato, juegos) values ('win', 'bo3', 'WLWW')")))
  check('una salida de otro largo: no', /match_log_salida_ok/.test(intenta("insert into public.match_log (resultado, formato, juegos, salida) values ('win', 'bo3', 'WL', '1')")))
  check('un formato raro: no', /match_log_formato_ok/.test(intenta("insert into public.match_log (resultado, formato) values ('win', 'bo5')")))
  psql('drop table if exists public.match_log cascade')
}

// ═════════════════════════════════════════════════════════════════════
const browser = await chromium.launch()
const abrir = async (semillas = {}, { ancho = 1200 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort())
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: 'admin-1', ...semillas })
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}
const elegirMazo = async (page, caja, texto) => {
  await page.fill(`#${caja} input`, texto)
  await page.waitForTimeout(250)
  await page.click(`#${caja} .selector-mazo-opcion`)
  await page.waitForTimeout(120)
}
const leer = (page) =>
  page.evaluate(() => ({
    filas: [...document.querySelectorAll('#partidaJuegos .partidas-juego')].map((f) => f.querySelector('.partidas-juego-num')?.textContent || 'única'),
    botones: [...document.querySelectorAll('#partidaJuegos .partidas-juego')].map((f) => [...f.querySelectorAll('[data-r]')].map((b) => b.textContent).join('/')),
    marcados: [...document.querySelectorAll('#partidaJuegos [data-r][aria-pressed="true"]')].map((b) => b.dataset.r).join(''),
    salidas: [...document.querySelectorAll('#partidaJuegos .partidas-juego')].map((f) => f.querySelector('[data-s][aria-pressed="true"]')?.dataset.s || '-').join(''),
    formato: document.querySelector('#partidaFormato [aria-checked="true"]')?.dataset.formato,
    switchVisible: !document.querySelector('#partidaFormato').classList.contains('hidden'),
    marcador: document.querySelector('#partidaMarcador').textContent.replace(/\s+/g, ' ').trim(),
    resultado: document.querySelector('#partidaResultado').value,
    foco: document.activeElement?.dataset?.juego != null ? `${document.activeElement.dataset.juego}:${document.activeElement.dataset.r || document.activeElement.dataset.s}` : '',
  }))
const pulsar = (page, i, que) => page.click(`#partidaJuegos [data-juego="${i}"][data-${que.length === 1 && '12'.includes(que) ? 's' : 'r'}="${que}"]`)
const ultima = (page) => page.evaluate(() => (window.__TABLAS__.match_log || []).at(-1))

console.log('\n── 3. Apuntar al mejor de uno: un toque ──')
{
  const { page, errores } = await abrir({ __FAKE_PARTIDAS__: [] })
  await page.evaluate(() => localStorage.clear())
  await page.click('[data-vista="sueltas"]')
  await page.click('#btnApuntarPartida')
  await page.waitForTimeout(200)
  const a = await leer(page)
  check('una suelta abre al mejor de uno, con el cambio a Bo3 a la vista', a.formato === 'bo1' && a.switchVisible, JSON.stringify(a))
  check('  …tres botones con palabras y nada marcado', a.botones[0] === 'Ganada/Perdida/Empate' && !a.marcados && !a.resultado, JSON.stringify(a))
  await elegirMazo(page, 'selMio1', 'dragapult')
  await elegirMazo(page, 'selRival1', 'gardevoir')
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(500)
  check('sin marcar el resultado no se guarda', !(await ultima(page)), JSON.stringify(await ultima(page)))
  await pulsar(page, 0, 'L')
  await pulsar(page, 0, '2')
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(1000)
  const f = await ultima(page)
  check('se guarda «Perdida», Bo1, juego «L», salida «2»', f?.resultado === 'loss' && f.formato === 'bo1' && f.juegos === 'L' && f.salida === '2', JSON.stringify(f))
  check('sin errores de JavaScript', !errores.length, errores[0])
  await page.close()
}

console.log('\n── 4. Al mejor de tres, juego a juego ──')
{
  const { page, errores } = await abrir({ __FAKE_PARTIDAS__: [] })
  await page.click('[data-vista="sueltas"]')
  await page.click('#btnApuntarPartida')
  await page.click('#partidaFormato [data-formato="bo3"]')
  await page.waitForTimeout(150)
  let a = await leer(page)
  check('Bo3: solo la fila del juego 1, con V/D/E', a.filas.join() === 'Juego 1' && a.botones[0] === 'V/D/E', JSON.stringify(a))
  await pulsar(page, 0, 'W')
  a = await leer(page)
  check('al marcar el juego 1 sale el 2, y el foco salta a él', a.filas.join() === 'Juego 1,Juego 2' && a.foco === '1:W', JSON.stringify(a))
  check('  …y el marcador dice «1-0 · Ganada» (y que se puede guardar así si se acabó el tiempo)', /1-0 · Ganada/.test(a.marcador) && /tiempo/.test(a.marcador), a.marcador)
  await pulsar(page, 1, 'W')
  a = await leer(page)
  check('2-0: no sale el juego 3', a.filas.length === 2 && /2-0 · Ganada/.test(a.marcador) && !/tiempo/.test(a.marcador), JSON.stringify(a))
  await pulsar(page, 1, 'L')
  a = await leer(page)
  check('cambiar el 2 a derrota: sale el 3', a.filas.length === 3 && /1-1 · Empate/.test(a.marcador), JSON.stringify(a))
  // Quién empieza se sabe ANTES de saber quién gana.
  await pulsar(page, 2, '1')
  a = await leer(page)
  check('marcar quién empieza el juego 3 antes de su resultado', a.salidas === '--1' && a.marcados === 'WL', JSON.stringify(a))
  await pulsar(page, 2, 'W')
  a = await leer(page)
  check('  …y al marcar el resultado se queda', a.salidas === '--1' && a.marcados === 'WLW' && /2-1 · Ganada/.test(a.marcador), JSON.stringify(a))
  await elegirMazo(page, 'selMio1', 'dragapult')
  await elegirMazo(page, 'selRival1', 'gardevoir')
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(1200)
  const f = await ultima(page)
  check('se guarda «Ganada», Bo3, «WLW», salida «--1»', f?.resultado === 'win' && f.formato === 'bo3' && f.juegos === 'WLW' && f.salida === '--1', JSON.stringify(f))
  a = await leer(page)
  check('el formulario queda en Bo3 y limpio para la siguiente', a.formato === 'bo3' && !a.marcados && a.filas.length === 1, JSON.stringify(a))

  // La lista: «V D V 2-1», y quien no lo ve lo oye entero.
  const mini = await page.locator('#partidasLista .partidas-mini').first()
  check('la lista enseña los juegos y el marcador', (await mini.innerText()).replace(/\s+/g, '') === 'VDV2-1', await mini.innerText())
  check('  …y lo dice entero', /2-1: juego 1 ganado; juego 2 perdido; juego 3 ganado, empezaste tú/.test(await mini.getAttribute('aria-label')), await mini.getAttribute('aria-label'))

  // Tocar otra vez el juego 1 lo quita todo.
  await page.click('#partidaJuegos [data-juego="0"][data-r="L"]')
  await page.click('#partidaJuegos [data-juego="0"][data-r="L"]')
  a = await leer(page)
  check('volver a tocar lo marcado lo quita (con lo de detrás)', !a.marcados && a.filas.length === 1, JSON.stringify(a))

  // Editar la guardada: vuelve como estaba.
  await page.click('#btnCancelarPartida')
  await page.click(`[data-editar="${f.id}"]`)
  await page.waitForTimeout(400)
  a = await leer(page)
  check('editarla la devuelve igual: Bo3, V D V, empezaste el 3', a.formato === 'bo3' && a.marcados === 'WLW' && a.salidas === '--1', JSON.stringify(a))
  check('sin errores de JavaScript', !errores.length, errores[0])
  await page.close()
}

console.log('\n── 5. Las estadísticas ──')
{
  const PARTIDAS = [
    { id: 'p1', user_id: 'admin-1', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', rival_mazo: 'd:gardevoir', rival_mazo_nombre: 'Gardevoir', resultado: 'win', tipo: 'normal', jugada_el: '2026-10-01', formato: 'bo3', juegos: 'WLW', salida: '121' },
    { id: 'p2', user_id: 'admin-1', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', rival_mazo: 'd:gardevoir', rival_mazo_nombre: 'Gardevoir', resultado: 'loss', tipo: 'normal', jugada_el: '2026-10-02', formato: 'bo3', juegos: 'LL', salida: '22' },
    { id: 'p3', user_id: 'admin-1', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', rival_mazo: 'd:gardevoir', rival_mazo_nombre: 'Gardevoir', resultado: 'win', tipo: 'normal', jugada_el: '2026-10-03', formato: null, juegos: null, salida: null },
  ]
  const { page } = await abrir({ __FAKE_PARTIDAS__: PARTIDAS })
  await page.click('[data-vista="stats"]')
  await page.waitForTimeout(400)
  const extra = (await page.locator('#partidasExtra').innerText()).replace(/\s+/g, ' ')
  check('«Juegos 2-3 · 40%», de las dos que los traen', /Juegos 2-3 · 40%/i.test(extra) && /En 2 partidas apuntadas juego a juego/i.test(extra), extra)
  check('«Empezando tú / el rival 100% / 0%»', /Empezando tú \/ el rival 100% \/ 0%/i.test(extra), extra)
  await page.close()

  const { page: sin } = await abrir({ __FAKE_PARTIDAS__: PARTIDAS.slice(2) })
  await sin.click('[data-vista="stats"]')
  await sin.waitForTimeout(400)
  check('sin ninguna con juegos, no se enseña (no es un cero)', !/Juegos|Empezando/i.test(await sin.locator('#partidasExtra').innerText()))
  await sin.close()
}

console.log('\n── 6. Una ronda de torneo abre al mejor de tres ──')
{
  const TORNEO = { id: 'logt-1', nombre: 'Liga del jueves', donde: 'Tienda', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', jugado_el: '2026-08-30' }
  const { page } = await abrir({ __FAKE_LOG_TORNEOS__: [TORNEO], __FAKE_PARTIDAS__: [] })
  await page.evaluate(() => localStorage.clear())
  await page.locator('[data-abrir-torneo="logt-1"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-anadir-ronda]').click()
  await page.waitForTimeout(300)
  const a = await leer(page)
  check('«Añadir ronda» abre en Bo3', a.formato === 'bo3' && a.filas.join() === 'Juego 1', JSON.stringify(a))
  // Y se recuerda por sitio: pasar la ronda a Bo1 no cambia las sueltas.
  await page.click('#partidaFormato [data-formato="bo1"]')
  const guardado = await page.evaluate(() => [localStorage.getItem('pokedoc-partidas-formato-ronda'), localStorage.getItem('pokedoc-partidas-formato-suelta')])
  check('el formato se recuerda por sitio (ronda / suelta)', guardado[0] === 'bo1' && guardado[1] === null, JSON.stringify(guardado))
  await page.close()
}

console.log('\n── 7. Sin la migración ──')
{
  const { page, errores } = await abrir({ __FAKE_PARTIDAS__: [], __SIN_COLUMNAS__: { match_log: ['formato', 'juegos', 'salida'] } })
  await page.click('[data-vista="sueltas"]')
  await page.click('#btnApuntarPartida')
  await page.waitForTimeout(200)
  const a = await leer(page)
  check('sin dónde guardarlo: sin Bo3 ni «quién empieza»', a.formato === 'bo1' && !a.switchVisible && (await page.locator('#partidaJuegos [data-s]').count()) === 0, JSON.stringify(a))
  await elegirMazo(page, 'selMio1', 'dragapult')
  await elegirMazo(page, 'selRival1', 'gardevoir')
  await pulsar(page, 0, 'W')
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(1000)
  const f = await ultima(page)
  check('se guarda igual, sin mandar columnas que no existen', f?.resultado === 'win' && !('formato' in f) && !('juegos' in f), JSON.stringify(f))
  check('sin errores de JavaScript', !errores.length, errores[0])
  await page.close()
}

console.log('\n── 8. En el móvil ──')
{
  const { page } = await abrir({ __FAKE_PARTIDAS__: [] }, { ancho: 360 })
  await page.click('[data-vista="sueltas"]')
  await page.click('#btnApuntarPartida')
  await page.click('#partidaFormato [data-formato="bo3"]')
  await pulsar(page, 0, 'W')
  await pulsar(page, 1, 'L')
  await page.waitForTimeout(150)
  const medidas = await page.evaluate(() => {
    const ancho = document.documentElement.clientWidth
    const bs = [...document.querySelectorAll('#partidaJuegos button, #partidaFormato button')]
    return { ancho, fuera: bs.filter((b) => b.getBoundingClientRect().right > ancho + 0.5).length, bajos: bs.filter((b) => b.getBoundingClientRect().height < 35.5).length, juegos: bs.filter((b) => b.dataset.r).map((b) => Math.round(b.getBoundingClientRect().height)) }
  })
  check('a 360 px nada se sale de la pantalla', medidas.fuera === 0, JSON.stringify(medidas))
  check('  …y los de V/D/E miden 44', medidas.juegos.every((h) => h >= 44), JSON.stringify(medidas.juegos))
  await page.locator('#partidaCampoResultado').screenshot({ path: '/tmp/t632-movil.png' })
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
