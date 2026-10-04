// Tanda 512 — reportar el resultado de un torneo con el registro de TCG Live.
//
// PINGU, de la lista de ideas: «en "Tu partida", pegar el registro de TCG
// Live: se guarda, se adjunta a la mesa y propone el resultado cruzando los
// nombres de TCG Live».
//
//   1. Lo que dice: quién ganó según el registro, quién eras tú (por tu
//      nombre de TCG Live, o por descarte con el de tu rival) y el botón
//      con el resultado; NUNCA se reporta sin pulsarlo.
//   2. Lo que hace al confirmar: guarda la repetición, la adjunta a ESTA
//      mesa y reporta por la función de siempre — en ese orden, que si los
//      reportes no casan el juez ya la tiene puesta.
//   3. Los casos raros: los nombres no casan (pregunta), el registro no
//      dice quién ganó (solo adjunta), ya reportaste (solo adjunta), un BO3
//      (reporta la partida que toca) y que repintar «Tu partida» no se lleve
//      lo pegado por delante.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()

const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const TURNOS = leerRegistro(EJEMPLO).eventos.filter((e) => e.tipo === 'turno').length
// Sin la última línea («El rival se ha rendido. Rojo ha ganado.»): un
// registro copiado a medias.
const SIN_FIN = EJEMPLO.replace(/El rival se ha rendido\. Rojo ha ganado\.\s*$/, '')

console.log('\n── 0. El código ──')
{
  const js = leer('js/torneos/ronda.js')
  check('el lector de registros se pide bajo demanda (quien solo mira no lo baja)', /await import\('\.\.\/repeticiones\/registro\.js'\)/.test(js) && !/^import[^\n]*repeticiones\/registro\.js/m.test(js))
  check('reporta por la MISMA función que los botones (torneos_reportar), no por otra puerta', /if \(!\(await reportar\(mia, fin\.ganador === yo \? 'win' : 'loss', juego\)\)\)/.test(js))
  check('el bloque cuelga de «Tu partida» en juego, entre los botones y las repeticiones', /\$\{botones\}\$\{registroHtml\(juego, adjuntable\)\}\$\{repeticionesDeMesaHtml\(mia\)\}/.test(js))
  check('TURNOS del ejemplo sale de verdad del lector', TURNOS > 5, TURNOS)
  check('el registro sin final ya no dice quién ganó', !leerRegistro(SIN_FIN).eventos.some((e) => e.tipo === 'fin'))
}

// La ronda 2 en juego: Ash (user-1, «Rojo» en TCG Live) contra Misty
// (user-2, «Azul»), los dos con el check-in hecho.
const semillas = ({ tcg = { 'user-1': 'Rojo', 'user-2': 'Azul' }, bo = 1, mesa = {}, extra = {} } = {}) => ({
  __FAKE_PERFILES__: [],
  __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: 'in_progress', admin_id: 'admin-1', swiss_rounds: 2, swiss_bo: bo, top_cut_size: 0, checkin_minutes: 5, current_round_id: 'ronda-2', decklist_visibility: 'al_terminar' }],
  __FAKE_INSCRIPCIONES__: ['user-1', 'user-2'].map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: tcg[u] ?? null })),
  __FAKE_RONDAS__: [
    { id: 'ronda-1', round_number: 1, status: 'finished', started_at: hace(60) },
    { id: 'ronda-2', round_number: 2, status: 'active', started_at: hace(10), ends_at: new Date(Date.now() + 40 * 60000).toISOString() },
  ],
  __FAKE_MESAS__: [{ id: 'mesa-1', round_id: 'ronda-2', table_number: 3, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: hace(9), check_in_b_at: hace(9), ...mesa }],
  ...extra,
})
const browser = await chromium.launch()
async function abrir({ sesion = 'user-1', ...op } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, [sesion, semillas(op)])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#miPartidaContenido .torneo-duelo', { timeout: 8000 }).catch(() => null)
  return { page, errores }
}
const C = '#miPartidaContenido'
async function pegarYLeer(page, texto = EJEMPLO) {
  await page.locator(`${C} #torneoRegistro summary`).click()
  await page.locator(`${C} #torneoRegistroTexto`).fill(texto)
  await page.locator(`${C} [data-leer-registro]`).click()
  await page.waitForFunction(() => document.querySelector('#torneoRegistroVeredicto')?.textContent.trim(), null, { timeout: 5000 }).catch(() => null)
}
const veredicto = (page) => page.$eval('#torneoRegistroVeredicto', (x) => x.textContent.replace(/\s+/g, ' ').trim()).catch(() => '')
const rpcs = (page) => page.evaluate(() => (window.__RPCS__ || []).map((r) => ({ nombre: r.nombre, args: r.args })))
const confirmar = (page) => page.locator(`${C} [data-registro-confirmar]`)

console.log('\n── 1. Lo que dice ──')
{
  const { page, errores } = await abrir()
  const det = page.locator(`${C} #torneoRegistro`)
  check('«Tu partida» ofrece «Reportar con el registro de TCG Live», plegado', (await det.count()) === 1 && (await det.locator('summary').textContent()).trim() === 'Reportar con el registro de TCG Live' && !(await det.evaluate((d) => d.open)))
  await pegarYLeer(page)
  const v = await veredicto(page)
  check('dice quién ganó según el registro, cómo y en cuántos turnos', v.includes(`Según el registro, ganaste tú por rendición, en ${TURNOS} turnos.`), v)
  check('  …y quién eras tú en él (con la salida si se equivoca)', /En el registro eras Rojo No, era Azul\./.test(v), v)
  check('el botón propone el resultado, y NO se ha reportado nada sin pulsarlo', (await confirmar(page).textContent()).trim() === 'Reportar Victoria' && !(await rpcs(page)).some((r) => r.nombre === 'torneos_reportar'))
  check('la casilla de adjuntar viene marcada y dice quién la verá', (await page.locator('#torneoRegistroAdjuntar').isChecked()) && /Una vez adjunta, la ven tu rival y quien lleva o arbitra el torneo, y queda compartida/.test(v))
  await confirmar(page).click()
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'torneos_reportar'), null, { timeout: 6000 }).catch(() => null)
  const lista = await rpcs(page)
  const i = (n) => lista.findIndex((r) => r.nombre === n)
  const g = lista[i('repeticiones_guardar')]?.args
  check('guarda la repetición: el registro, los dos jugadores, el ganador y los turnos', g?.p_registro === EJEMPLO && JSON.stringify(g.p_jugadores) === '["Rojo","Azul"]' && g.p_ganador === 'Rojo' && g.p_turnos === TURNOS, JSON.stringify({ ...g, p_registro: g?.p_registro?.length }))
  check('  …con un título que dice de qué torneo, ronda y mesa es', g?.p_titulo === 'Copa del Gimnasio · Ronda 2 · Mesa 3', g?.p_titulo)
  const adj = lista[i('torneos_adjuntar_repeticion')]?.args
  const guardada = await page.evaluate(() => window.__TABLAS__.replays.at(-1)?.id)
  check('la adjunta a ESTA mesa, la que acaba de guardar', adj?.p_partida === 'mesa-1' && adj.p_repeticion === guardada, JSON.stringify(adj))
  const rep = lista[i('torneos_reportar')]?.args
  check('reporta Victoria por la función de siempre, partida 0 (BO1)', rep?.p_partida === 'mesa-1' && rep.p_resultado === 'win' && rep.p_juego === 0, JSON.stringify(rep))
  check('en ese orden: guardar, adjuntar y luego reportar', i('repeticiones_guardar') < i('torneos_adjuntar_repeticion') && i('torneos_adjuntar_repeticion') < i('torneos_reportar'), lista.map((r) => r.nombre).join())
  await page.waitForSelector(`${C} .torneo-rep a`, { timeout: 6000 }).catch(() => null)
  check('  …y la repetición sale ya en la mesa como «Tu repetición»', (await page.locator(`${C} .torneo-rep a`).count()) === 1)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Misty pega el mismo registro: perdió. Y desmarca la casilla.
  const { page } = await abrir({ sesion: 'user-2' })
  await pegarYLeer(page)
  const v = await veredicto(page)
  check('a la otra jugadora le dice que ganó su rival, y que ella era Azul', v.includes('Según el registro, ganó tu rival por rendición') && v.includes('En el registro eras Azul'), v)
  check('  …con «Reportar Derrota»', (await confirmar(page).textContent()).trim() === 'Reportar Derrota')
  await page.locator('#torneoRegistroAdjuntar').uncheck()
  await confirmar(page).click()
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'torneos_reportar'), null, { timeout: 6000 }).catch(() => null)
  const lista = await rpcs(page)
  check('sin la casilla, solo reporta: ni guarda ni adjunta', lista.find((r) => r.nombre === 'torneos_reportar')?.args.p_resultado === 'loss' && !lista.some((r) => /repeticiones_guardar|torneos_adjuntar_repeticion/.test(r.nombre)), lista.map((r) => r.nombre).join())
  await page.close()
}

console.log('\n── 2. Quién eras tú, cuando los nombres no casan ──')
{
  const { page, errores } = await abrir({ tcg: { 'user-1': 'Ash_TCG', 'user-2': 'Misty_TCG' } })
  await pegarYLeer(page)
  let v = await veredicto(page)
  check('si ningún nombre casa, lo dice y pregunta cuál eras', v.includes('En el registro juegan Rojo y Azul, y ninguno es «Ash_TCG», el nombre de TCG Live de tu inscripción. ¿Cuál de los dos eras tú?'), v)
  check('  …sin proponer resultado todavía', (await confirmar(page).count()) === 0 && (await page.locator('[data-registro-yo]').count()) === 2)
  await page.locator('[data-registro-yo="Azul"]').click()
  v = await veredicto(page)
  check('elegido «Azul», propone Derrota', v.includes('ganó tu rival') && (await confirmar(page).textContent()).trim() === 'Reportar Derrota', v)
  check('  …y avisa de que el rival del registro no es el de la mesa (¿otra partida?)', v.includes('Ojo: tu rival en esta mesa es «Misty_TCG» en TCG Live, y en el registro juegas contra «Rojo»'), v)
  check('  …y como lo has dicho tú, no ofrece «No, era…»', !/No, era/.test(v))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Ash no puso su nombre de TCG Live, pero el de Misty sí casa: por descarte.
  const { page } = await abrir({ tcg: { 'user-1': null, 'user-2': 'azul' } })
  await pegarYLeer(page)
  const v = await veredicto(page)
  check('sin tu nombre, te deduce por descarte con el de tu rival (sin distinguir mayúsculas)', v.includes('ganaste tú') && v.includes('En el registro eras Rojo') && !v.includes('Ojo'), v)
  await page.locator('[data-registro-yo="Azul"]').click()
  check('  …y «No, era Azul» lo cambia', (await veredicto(page)).includes('ganó tu rival') && (await confirmar(page).textContent()).trim() === 'Reportar Derrota')
  await page.close()
}
{
  // Tu nombre casa y el del rival no (se lo cambió): mandas TÚ, y avisa.
  const { page } = await abrir({ tcg: { 'user-1': 'rojo', 'user-2': 'OtroNick' } })
  await pegarYLeer(page)
  const v = await veredicto(page)
  check('con tu nombre (sin distinguir mayúsculas) basta, aunque el del rival no case', v.includes('ganaste tú') && v.includes('En el registro eras Rojo') && (await confirmar(page).textContent()).trim() === 'Reportar Victoria', v)
  check('  …y avisa de que el rival del registro no es el de la mesa', v.includes('Ojo: tu rival en esta mesa es «OtroNick» en TCG Live, y en el registro juegas contra «Azul»'), v)
  await page.close()
}
{
  const { page } = await abrir({ tcg: { 'user-1': null, 'user-2': null } })
  await pegarYLeer(page)
  check('sin ningún nombre en la inscripción, lo dice así y pregunta', (await veredicto(page)).includes('tu inscripción no tiene nombre de TCG Live para saberlo. ¿Cuál de los dos eras tú?'))
  await page.close()
}

console.log('\n── 3. Los casos raros ──')
{
  const { page, errores } = await abrir()
  await pegarYLeer(page, SIN_FIN)
  const v = await veredicto(page)
  check('un registro sin final no se atreve con el resultado', v.includes('El registro no dice quién ganó: ¿está entero? El resultado márcalo con los botones de arriba; la repetición sí se puede adjuntar.'), v)
  check('  …y solo ofrece adjuntarla', (await confirmar(page).textContent()).trim() === 'Guardar y adjuntar la repetición' && (await page.locator('#torneoRegistroAdjuntar').count()) === 0)
  await confirmar(page).click()
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'torneos_adjuntar_repeticion'), null, { timeout: 6000 }).catch(() => null)
  const lista = await rpcs(page)
  check('  …que guarda y adjunta, sin ganador y sin reportar', lista.find((r) => r.nombre === 'repeticiones_guardar')?.args.p_ganador === null && lista.some((r) => r.nombre === 'torneos_adjuntar_repeticion') && !lista.some((r) => r.nombre === 'torneos_reportar'), lista.map((r) => r.nombre).join())
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page } = await abrir()
  await pegarYLeer(page, 'hola, esto no es un registro')
  check('algo que no es un registro: lo dice, sin botón', /No encuentro a los dos jugadores/.test(await veredicto(page)) && (await confirmar(page).count()) === 0)
  await page.close()
}
{
  // Ya reportaste (BO1): el bloque sirve solo para adjuntar.
  const { page } = await abrir({ extra: { __FAKE_REPORTES__: [{ match_id: 'mesa-1', reporter_id: 'user-1', result: 'win', game_number: 0 }] } })
  check('con tu resultado ya puesto, el bloque se llama «Adjuntar el registro de TCG Live»', (await page.locator(`${C} #torneoRegistro summary`).textContent()).trim() === 'Adjuntar el registro de TCG Live')
  await pegarYLeer(page)
  check('  …dice quién ganó pero solo ofrece adjuntar', (await veredicto(page)).includes('ganaste tú') && (await confirmar(page).textContent()).trim() === 'Guardar y adjuntar la repetición')
  await confirmar(page).click()
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'torneos_adjuntar_repeticion'), null, { timeout: 6000 }).catch(() => null)
  check('  …y no vuelve a reportar', !(await rpcs(page)).some((r) => r.nombre === 'torneos_reportar'))
  await page.close()
}
{
  // Tres tuyas ya puestas y el resultado dado: no queda nada que hacer.
  const { page } = await abrir({
    extra: {
      __FAKE_REPORTES__: [{ match_id: 'mesa-1', reporter_id: 'user-1', result: 'win', game_number: 0 }],
      __FAKE_REPETICIONES_MESA__: ['a', 'b', 'c'].map((replay_id) => ({ match_id: 'mesa-1', user_id: 'user-1', replay_id })),
    },
  })
  check('reportado y con tres adjuntas, el bloque no sale', (await page.locator(`${C} #torneoRegistro`).count()) === 0)
  await page.close()
}
{
  // Al mejor de tres, con la 1.ª ya confirmada por los dos: toca la 2.ª.
  const { page, errores } = await abrir({
    bo: 3,
    extra: {
      __FAKE_REPORTES__: [
        { match_id: 'mesa-1', reporter_id: 'user-1', result: 'loss', game_number: 1 },
        { match_id: 'mesa-1', reporter_id: 'user-2', result: 'win', game_number: 1 },
      ],
    },
  })
  await pegarYLeer(page)
  check('en un BO3 propone la partida que toca', (await confirmar(page).textContent()).trim() === 'Reportar Victoria en la 2.ª partida')
  await confirmar(page).click()
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'torneos_reportar'), null, { timeout: 6000 }).catch(() => null)
  const lista = await rpcs(page)
  check('  …y la reporta con su número', lista.find((r) => r.nombre === 'torneos_reportar')?.args.p_juego === 2, JSON.stringify(lista.find((r) => r.nombre === 'torneos_reportar')?.args))
  check('  …y la repetición lo dice en el título', lista.find((r) => r.nombre === 'repeticiones_guardar')?.args.p_titulo === 'Copa del Gimnasio · Ronda 2 · Mesa 3 · 2.ª partida')
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Repintar «Tu partida» (aquí, porque el check-in llega mientras pegas)
  // no se lleva lo pegado.
  const { page, errores } = await abrir({ mesa: { check_in_a_at: null } })
  await pegarYLeer(page)
  const antes = await veredicto(page)
  await page.evaluate(() => {
    window.__TABLAS__.tournament_matches.find((m) => m.id === 'mesa-1').check_in_a_at = new Date().toISOString()
  })
  // «Actualizar» vive en la pestaña de rondas; vale igual pulsado desde aquí.
  await page.evaluate(() => document.getElementById('btnActualizarCiclo').click())
  await page.waitForFunction(() => !document.querySelector('#btnCheckin'), null, { timeout: 6000 }).catch(() => null)
  const repintado = (await page.locator('#btnCheckin').count()) === 0
  check('(se ha repintado: el botón de check-in ya no está)', repintado)
  check('tras repintar, el registro sigue pegado, abierto y leído', (await page.locator('#torneoRegistroTexto').inputValue()) === EJEMPLO && (await page.locator('#torneoRegistro').evaluate((d) => d.open)) && (await veredicto(page)) === antes, await veredicto(page))
  // Cambiar el texto invalida lo leído: proponer su resultado sería mentir.
  await page.locator('#torneoRegistroTexto').fill(SIN_FIN)
  check('cambiar el texto borra el veredicto de antes', (await veredicto(page)) === '' && (await confirmar(page).count()) === 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Si el reporte no entra, lo pegado vuelve: no se tira el trabajo.
  const { page } = await abrir({ extra: { __RPC_ERRORES__: { torneos_reportar: { code: 'P0001', message: 'La ronda ya está cerrada.' } } } })
  await pegarYLeer(page)
  await page.locator('#torneoRegistroAdjuntar').uncheck()
  await confirmar(page).click()
  await page.waitForTimeout(1200)
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '))
  const hay = await page.evaluate(() => Boolean(window.__RPC_ERRORES__))
  if (!hay || !/La ronda ya está cerrada/.test(toast)) {
    console.log('   (el doble no sabe hacer fallar una RPC — esta parte NO se ha comprobado)', toast)
  } else {
    check('un reporte rechazado deja el registro y el botón como estaban', (await confirmar(page).isEnabled()) && (await page.locator('#torneoRegistroTexto').inputValue()) === EJEMPLO)
    await page.locator('#torneoRegistroTexto').fill(SIN_FIN)
    check('  …y se puede seguir editando sin errores', (await veredicto(page)) === '')
  }
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
