// Tanda 1434 — Crear un torneo, una pregunta cada vez (PINGU: «¿no es mejor ir
// respondiendo a las cosas que te van saliendo…?»):
//   · lo puro: días rápidos, jornadas semanales y la frase del formato;
//   · el módulo y su hoja NO bajan con la lista: entran al pulsar «Crear»;
//   · se contesta pregunta a pregunta (una a la vista), la tarjeta pasa sola;
//   · Intro en el nombre es «Siguiente», nunca crear;
//   · no se avanza sin lo que hace falta (nombre, fecha, código);
//   · «Cambiar» del resumen vuelve a esa pregunta y de ella al resumen;
//   · la fila que se guarda es la de siempre (plazas, rondas oficiales, BO,
//     minutos, código aparte, listas, precio, premios);
//   · una liga pide las jornadas (puestas una por semana) y guarda sus fechas;
//   · Duplicar abre «¿Lo creamos?» con lo del torneo viejo;
//   · ?crear=1 abre la ventana con el foco en el nombre;
//   · la casilla de oficial solo existe para administración;
//   · en el móvil es una hoja desde abajo y nada se sale de ancho.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── Lo puro ──')
{
  const { diasRapidos, jornadasSemanales, frasesDelFormato, aLocal, PREGUNTAS } = await import(`${RAIZ}/js/torneos/crear-puro.js`)
  const miercoles = new Date(2026, 10, 25, 12, 0)
  const d = diasRapidos(miercoles)
  check('miércoles: Hoy, Mañana, Sáb 28 y Dom 29', d.map((x) => x.texto).join('|') === 'Hoy|Mañana|Sáb 28|Dom 29' && d[2].valor === '2026-11-28', d.map((x) => `${x.texto}=${x.valor}`).join(' '))
  const sabado = diasRapidos(new Date(2026, 10, 28, 12, 0))
  check('sábado: Hoy y Mañana, sin repetir el fin de semana', sabado.map((x) => x.texto).join('|') === 'Hoy|Mañana', sabado.map((x) => x.texto).join('|'))
  const viernes = diasRapidos(new Date(2026, 10, 27, 12, 0))
  check('viernes: Hoy, Mañana (el sábado) y Dom 29', viernes.map((x) => x.texto).join('|') === 'Hoy|Mañana|Dom 29', viernes.map((x) => x.texto).join('|'))
  check('jornadas: una por semana desde la primera', jornadasSemanales('2026-12-01T18:00', 3).join(' ') === '2026-12-01T18:00 2026-12-08T18:00 2026-12-15T18:00')
  check('jornadas sin primera fecha: vacías', jornadasSemanales('', 2).join('|') === '|')
  const f1 = frasesDelFormato({ liga: false, rondas: 4, bo: 1, corte: 4, boCorte: 3 })
  check('el formato: «4 rondas suizas al mejor de 1» y «Top 4 al mejor de 3»', f1.suizas === '4 rondas suizas al mejor de 1' && f1.corte === 'Top 4 al mejor de 3', JSON.stringify(f1))
  const f2 = frasesDelFormato({ liga: true, rondas: 1, porJornada: 3, bo: 3, corte: 0, boCorte: 3 })
  check('una liga: «1 jornada de 3 rondas al mejor de 3» y «Sin top cut»', f2.suizas === '1 jornada de 3 rondas al mejor de 3' && f2.corte === 'Sin top cut', JSON.stringify(f2))
  check('aLocal, en la hora de quien crea', aLocal(new Date(2026, 0, 5, 9, 7)) === '2026-01-05T09:07')
  check('las preguntas, en su orden y el resumen al final', PREGUNTAS[0] === 'nombre' && PREGUNTAS.at(-1) === 'resumen' && PREGUNTAS.includes('jornadas'))
}

const browser = await chromium.launch()
const abrir = async (ruta, sesion = 'user-1', { movil = false, semillas = {} } = {}) => {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: movil, hasTouch: movil, locale: 'es-ES', serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errores = []
  const pedidos = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('request', (r) => pedidos.push(r.url()))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: sesion, __FAKE_TORNEOS__: [], ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores, pedidos }
}
const escrituras = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]'))
const visible = (page) => page.evaluate(() => [...document.querySelectorAll('#torneoCrear [data-pregunta]')].filter((s) => !s.hidden).map((s) => s.dataset.pregunta))
const espera = (page, ms = 320) => page.waitForTimeout(ms)
const manana = () => {
  const d = new Date(Date.now() + 86400e3)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

console.log('\n── Un torneo de un día, pregunta a pregunta ──')
{
  const { page, ctx, errores, pedidos } = await abrir('/torneos')
  check('la lista no baja el creador ni su hoja', !pedidos.some((u) => /torneos\/crear\.js|torneo-crear\.css|editor-texto\.css/.test(u)), pedidos.filter((u) => /crear|editor-texto/.test(u)).join(' '))
  await page.click('#btnNuevoTorneo')
  await page.waitForSelector('#torneoCrear[open]')
  check('al pulsar «Crear un torneo» se abre la ventana', await page.isVisible('#torneoForm'))
  check('…con una sola pregunta a la vista: el nombre', JSON.stringify(await visible(page)) === '["nombre"]', JSON.stringify(await visible(page)))
  check('…y el foco en el nombre', (await page.evaluate(() => document.activeElement?.id)) === 'torneoNombre')
  check('«1 de 10» (1452: «¿Dónde se juega?»)', (await page.textContent('#tcCuenta')).trim() === '1 de 10', await page.textContent('#tcCuenta'))
  await page.keyboard.press('Enter')
  await espera(page)
  check('sin nombre no se avanza', JSON.stringify(await visible(page)) === '["nombre"]')
  await page.fill('#torneoNombre', 'Copa de prueba')
  await page.keyboard.press('Enter')
  await espera(page)
  check('Intro en el nombre pasa a «¿Dónde se juega?» (1452)', JSON.stringify(await visible(page)) === '["donde"]', JSON.stringify(await visible(page)))
  await page.click('.tc-opcion[data-campo="torneoModalidad"][data-valor="online"]')
  await espera(page)
  check('Online pasa a «¿Qué tipo…?» (y no crea nada)', JSON.stringify(await visible(page)) === '["tipo"]' && !(await escrituras(page)).some((e) => e.tabla === 'tournaments'), JSON.stringify(await visible(page)))
  check('la cabecera ya dice el nombre', (await page.textContent('#tcTitulo')).trim() === 'Copa de prueba')
  await page.click('.tc-opcion[data-campo="torneoTipo"][data-valor="standard"]')
  await espera(page)
  check('tocar «De un día» pasa sola a «¿Cuándo…?»', JSON.stringify(await visible(page)) === '["cuando"]')
  check('…y la pregunta nombra el torneo', /«Copa de prueba»/.test(await page.textContent('[data-titulo="cuando"]')), await page.textContent('[data-titulo="cuando"]'))
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('sin fecha no se avanza', JSON.stringify(await visible(page)) === '["cuando"]')
  await page.click('[data-chips="dia"] [data-dia]:nth-child(2)')
  check('«Mañana» pone mañana a las 17:00', (await page.inputValue('#torneoFecha')) === `${manana()}T17:00`, await page.inputValue('#torneoFecha'))
  await page.click('[data-hora="18:00"]')
  check('…y la hora se cambia con su chip', (await page.inputValue('#torneoFecha')) === `${manana()}T18:00`, await page.inputValue('#torneoFecha'))
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('un torneo de un día se salta las jornadas', JSON.stringify(await visible(page)) === '["plazas"]', JSON.stringify(await visible(page)))
  await page.click('.tc-opcion[data-campo="torneoPlazas"][data-valor="32"]')
  await espera(page)
  check('32 plazas → la tabla oficial: 6 suizas y Top 8', (await page.textContent('#tcFormatoSuizas')) === '6 rondas suizas al mejor de 1' && (await page.textContent('#tcFormatoCorte')) === 'Top 8 al mejor de 3', `${await page.textContent('#tcFormatoSuizas')} / ${await page.textContent('#tcFormatoCorte')}`)
  await page.click('#tcAjustes summary')
  await page.selectOption('#torneoSwissBo', '3')
  check('cambiar el BO se ve al momento en la tarjeta', (await page.textContent('#tcFormatoSuizas')) === '6 rondas suizas al mejor de 3')
  await page.click('#btnPasoSiguiente')
  await espera(page)
  await page.click('.tc-opcion[data-campo="torneoMinutos"][data-valor="50"]')
  await espera(page)
  check('50 min → «¿Quién puede apuntarse?»', JSON.stringify(await visible(page)) === '["entrada"]')
  await page.click('.tc-opcion[data-campo="torneoPrivado"][data-valor="si"]')
  await espera(page)
  check('«Solo con código» NO pasa sola: pide el código', JSON.stringify(await visible(page)) === '["entrada"]' && (await page.isVisible('#torneoCodigoNuevo')))
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('sin código no se avanza', JSON.stringify(await visible(page)) === '["entrada"]')
  await page.fill('#torneoCodigoNuevo', 'DELTA')
  await page.keyboard.press('Enter')
  await espera(page)
  await page.click('.tc-opcion[data-campo="torneoListasModo"][data-valor="en_juego"]')
  await espera(page)
  check('las listas → «Dale tu toque»', JSON.stringify(await visible(page)) === '["extras"]')
  check('una cuenta normal no tiene la casilla de oficial', (await page.locator('#torneoOficial').count()) === 0)
  await page.click('[data-extra="precio"] summary')
  await page.fill('#torneoPrecio', '5')
  await page.click('[data-extra="premios"] summary')
  await page.fill('[data-premio-puesto="0"]', '1º')
  await page.fill('[data-premio-que="0"]', 'Caja de sobres')
  check('cada apartado dice lo que lleva', /5 € inscripción/.test(await page.textContent('[data-extra-valor="precio"]')) && /1 premio: Caja de sobres/.test(await page.textContent('[data-extra-valor="premios"]')), `${await page.textContent('[data-extra-valor="precio"]')} / ${await page.textContent('[data-extra-valor="premios"]')}`)
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('«Ver cómo queda» → «¿Lo creamos?»', JSON.stringify(await visible(page)) === '["resumen"]' && (await page.isVisible('#btnCrearTorneo')) && !(await page.isVisible('#btnPasoSiguiente')))
  const resumen = await page.textContent('#wizardResumen')
  check('el resumen lo dice todo', /Copa de prueba/.test(resumen) && /32/.test(resumen) && /Top 8/.test(resumen) && /50 min/.test(resumen) && /«DELTA»/.test(resumen) && /Desde la ronda 1/.test(resumen), resumen)
  await page.click('[data-ir="plazas"]')
  await espera(page)
  check('«Cambiar» las plazas vuelve a esa pregunta', JSON.stringify(await visible(page)) === '["plazas"]')
  await page.click('.tc-opcion[data-campo="torneoPlazas"][data-valor="16"]')
  await espera(page)
  check('…y al contestar, de vuelta al resumen (no a «Así se jugaría»)', JSON.stringify(await visible(page)) === '["resumen"]', JSON.stringify(await visible(page)))
  const boton = await page.evaluate(() => getComputedStyle(document.getElementById('btnCrearTorneo')).opacity)
  check('«Crear torneo» no sale apagado', boton === '1', boton)
  await page.click('#btnCrearTorneo')
  await page.waitForTimeout(1200)
  const w = (await escrituras(page)).filter((e) => e.tabla === 'tournaments' && e.tipo === 'insert')
  const fila = w.at(-1)?.filas?.[0] || {}
  check('se crea UNA vez', w.length === 1, w.length)
  check('la fila: nombre, borrador, de un día, 16 plazas, 4 suizas BO3, Top 4 BO3', fila.name === 'Copa de prueba' && fila.status === 'draft' && fila.format === 'standard' && fila.max_players === 16 && fila.swiss_rounds === 4 && fila.swiss_bo === 3 && fila.top_cut_size === 4 && fila.top_cut_bo === 3, JSON.stringify(fila))
  check('…50 min, con código, listas desde la ronda 1, 5 € y su premio', fila.round_time_minutes === 50 && fila.is_private === true && fila.decklist_visibility === 'en_juego' && fila.show_opponent_decklists === true && fila.precio_entrada === 5 && fila.prizes?.[0]?.premio === 'Caja de sobres', JSON.stringify(fila))
  check('…la fecha de mañana a las 18:00 y una semilla', new Date(fila.start_at).getHours() === 18 && /^[a-z0-9]{32}$/.test(fila.pairing_seed || ''), `${fila.start_at} ${fila.pairing_seed}`)
  check('…y sin la casilla de oficial marcada', fila.is_official === false)
  const codigo = (await escrituras(page)).find((e) => e.tabla === 'tournament_join_codes')
  check('el código va aparte, a su tabla', codigo?.filas?.[0]?.code === 'DELTA', JSON.stringify(codigo))
  check('la ventana se cierra al crear', !(await page.isVisible('#torneoCrear')))
  check('sin errores', !errores.length, errores[0])
  await ctx.close()
}

console.log('\n── Una liga ──')
{
  const { page, ctx, errores } = await abrir('/torneos')
  await page.click('#btnNuevoTorneo')
  await page.waitForSelector('#torneoCrear[open]')
  await page.fill('#torneoNombre', 'Liga de invierno')
  await page.keyboard.press('Enter')
  await espera(page)
  await page.click('.tc-opcion[data-campo="torneoModalidad"][data-valor="online"]')
  await espera(page)
  await page.click('.tc-opcion[data-valor="league"]')
  await espera(page)
  check('una liga tiene una pregunta más («4 de 11»)', (await page.textContent('#tcCuenta')).trim() === '4 de 11', await page.textContent('#tcCuenta'))
  await page.fill('#torneoFecha', '2026-12-01T18:00')
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('pregunta las jornadas', JSON.stringify(await visible(page)) === '["jornadas"]')
  const fechas = await page.$$eval('#torneoJornadasLista input', (l) => l.map((i) => i.value))
  check('…ya puestas una por semana desde el 1 de diciembre', fechas.join(' ') === '2026-12-01T18:00 2026-12-08T18:00 2026-12-15T18:00 2026-12-22T18:00', fechas.join(' '))
  await page.click('[data-quitar-jornada="3"]')
  await page.click('#btnPasoSiguiente')
  await espera(page)
  await page.click('.tc-opcion[data-campo="torneoPlazas"][data-valor="64"]')
  await espera(page)
  check('en una liga las plazas no cambian las jornadas', (await page.textContent('#tcFormatoSuizas')) === '3 jornadas al mejor de 1', await page.textContent('#tcFormatoSuizas'))
  await page.click('#btnPasoSiguiente')
  for (const sel of ['.tc-opcion[data-campo="torneoMinutos"][data-valor="30"]', '.tc-opcion[data-campo="torneoPrivado"][data-valor="no"]', '.tc-opcion[data-campo="torneoListasModo"][data-valor="al_terminar"]']) {
    await espera(page)
    await page.click(sel)
  }
  await espera(page)
  await page.click('#btnPasoSiguiente')
  await espera(page)
  await page.click('#btnCrearTorneo')
  await page.waitForTimeout(1200)
  const fila = (await escrituras(page)).find((e) => e.tabla === 'tournaments' && e.tipo === 'insert')?.filas?.[0] || {}
  check('la liga se guarda con sus 3 jornadas', fila.format === 'league' && fila.swiss_rounds === 3 && fila.matchday_dates?.length === 3, JSON.stringify(fila))
  check('sin código', fila.is_private === false && !(await escrituras(page)).some((e) => e.tabla === 'tournament_join_codes'))
  check('sin errores', !errores.length, errores[0])
  await ctx.close()
}

console.log('\n── Duplicar, ?crear=1 y administración ──')
{
  const viejo = { id: 't-viejo', slug: 'copa-vieja', name: 'Copa vieja', status: 'finished', format: 'standard', admin_id: 'user-1', start_at: '2026-10-03T16:00:00Z', max_players: 8, swiss_rounds: 3, top_cut_size: 0, swiss_bo: 1, top_cut_bo: 3, round_time_minutes: 25, checkin_minutes: 10, decklist_visibility: 'nunca', prizes: [{ puesto: '1º', premio: 'Un sobre' }] }
  const { page, ctx, errores } = await abrir('/torneos', 'user-1', { semillas: { __FAKE_TORNEOS__: [viejo] } })
  const dup = page.locator('[data-duplicar="t-viejo"]').first()
  if (await page.locator('details.torneo-tarjeta-mas summary').count()) await page.locator('details.torneo-tarjeta-mas summary').first().click()
  await dup.click()
  await page.waitForSelector('#torneoCrear[open]')
  await espera(page, 500)
  check('Duplicar abre directo «¿Lo creamos?»', JSON.stringify(await visible(page)) === '["resumen"]', JSON.stringify(await visible(page)))
  const r = await page.textContent('#wizardResumen')
  check('…con lo del viejo: nombre, 8 plazas, 3 suizas sin top cut, 25 min y «Nunca»', /Copa vieja/.test(r) && /Plazas\s*8\b/.test(r) && /3 rondas suizas/.test(r) && /Sin top cut/.test(r) && /25 min/.test(r) && /Nunca/.test(r) && /1 premio/.test(r), r.replace(/\s+/g, ' '))
  check('…y la fecha, la semana que viene', new Date(await page.inputValue('#torneoFecha')).getTime() > Date.now() + 6 * 86400e3)
  check('sin errores', !errores.length, errores[0])
  await ctx.close()

  const c = await abrir('/torneos?crear=1')
  await c.page.waitForSelector('#torneoCrear[open]').catch(() => {})
  await espera(c.page, 400)
  check('?crear=1 abre la ventana con el foco en el nombre', (await c.page.isVisible('#torneoForm')) && (await c.page.evaluate(() => document.activeElement?.id)) === 'torneoNombre')
  await c.ctx.close()
  const sin = await abrir('/torneos')
  check('sin el parámetro sigue cerrada', !(await sin.page.isVisible('#torneoForm')))
  await sin.ctx.close()

  const a = await abrir('/torneos', 'admin-1')
  await a.page.click('#btnNuevoTorneo')
  await a.page.waitForSelector('#torneoCrear[open]')
  check('administración sí tiene la casilla de oficial', (await a.page.locator('#torneoOficial').count()) === 1)
  await a.ctx.close()
}

console.log('\n── En el móvil ──')
{
  const { page, ctx, errores } = await abrir('/torneos', 'user-1', { movil: true })
  await page.click('#btnNuevoTorneo')
  await page.waitForSelector('#torneoCrear[open]')
  await espera(page, 400)
  const caja = await page.evaluate(() => {
    const r = document.getElementById('torneoCrear').getBoundingClientRect()
    return { abajo: Math.round(innerHeight - r.bottom), ancho: Math.round(r.width), vw: innerWidth }
  })
  check('es una hoja desde abajo, a todo lo ancho', caja.abajo === 0 && caja.ancho === caja.vw, JSON.stringify(caja))
  const desborda = []
  await page.fill('#torneoNombre', 'Un nombre de torneo bastante largo para ver que no se sale nada')
  // En el móvil, por el camino de En persona (1452): así se miran también sus preguntas.
  for (const paso of ['nombre', 'donde', 'lugar', 'tipo', 'cuando', 'plazas', 'formato', 'reloj', 'entrada', 'listas', 'extras', 'resumen']) {
    if (paso !== 'nombre' && paso !== 'resumen') {
      // Se contesta lo que haga falta para pasar.
    }
    const ancho = await page.evaluate(() => {
      const c = document.getElementById('tcCuerpo')
      return c.scrollWidth - c.clientWidth
    })
    if (ancho > 0) desborda.push(`${paso}:${ancho}`)
    if (paso === 'cuando') await page.click('[data-chips="dia"] [data-dia]:nth-child(2)')
    if (paso === 'lugar') await page.fill('#torneoLugar', 'Una tienda con un nombre larguísimo de verdad, de los que no caben')
    if (paso === 'donde') await page.click('.tc-opcion[data-campo="torneoModalidad"][data-valor="presencial"]')
    else if (paso === 'entrada') await page.click('.tc-opcion[data-campo="torneoInscripcion"][data-valor="pedir"]')
    else if (paso !== 'resumen') await page.click('#btnPasoSiguiente')
    await espera(page)
  }
  check('ninguna pregunta se sale de ancho', !desborda.length, desborda.join(' '))
  check('y se llega al resumen', JSON.stringify(await visible(page)) === '["resumen"]', JSON.stringify(await visible(page)))
  check('sin errores', !errores.length, errores[0])
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
