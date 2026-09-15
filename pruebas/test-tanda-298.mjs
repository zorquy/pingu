// Tanda 298 (B y C): la ficha del torneo y las rondas.
//
// PINGU: «B y C, quiero que acabes con torneos». Segunda y tercera parte
// del rediseño, con las maquetas ya vistas.
//
// Lo que se prueba no es que quede bonito —eso se mira— sino lo que el
// rediseño promete: que mientras se juega, lo que importa esté a la
// vista sin scroll; que el tablero diga quién va ganando sin echar la
// cuenta; y que nada de lo que ya funcionaba (reportar, check-in,
// resolver una mesa, el historial) se haya quedado por el camino.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const CSS = readFileSync('/home/user/pingu/css/torneos.css', 'utf8')
const RONDA = readFileSync('/home/user/pingu/js/torneos/ronda.js', 'utf8')
const ahora = Date.now()

const TORNEO = {
  id: 'torneo-1', slug: 'pachanga', name: 'La Pachanga de Otoño', status: 'in_progress',
  description: 'Tres rondas suizas y corte a semifinales.',
  admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3,
  round_time_minutes: 30, checkin_minutes: 5, is_official: true,
  start_at: new Date(ahora - 3600e3).toISOString(), current_round_id: 'ronda-2',
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const INSCRIPCIONES = GENTE.map((u, i) => ({
  id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active',
  tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(ahora - 7200e3).toISOString(),
}))
const RONDAS = [
  { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss' },
  { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss',
    started_at: new Date(ahora - 120e3).toISOString(), ends_at: new Date(ahora + 14 * 60000).toISOString() },
]
const MESAS = [
  { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2',
    status: 'active', check_in_a_at: new Date(ahora - 60e3).toISOString() },
  { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
  { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
]
const RESULTADOS = [
  { id: 'r1', match_id: 'mesa-2', result: 'a_wins', winner_id: 'user-3', score_a: 2, score_b: 1 },
  { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 },
  { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
]
// Ash gana la 1.ª de su serie: la 2.ª es la que toca marcar.
const REPORTES = [
  { id: 'rep-1', match_id: 'mesa-1', reporter_id: 'user-1', result: 'win', game_number: 1 },
  { id: 'rep-2', match_id: 'mesa-1', reporter_id: 'user-2', result: 'loss', game_number: 1 },
]

const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', ancho = 1280, torneo = TORNEO, rondas = RONDAS, mesas = MESAS, reportes = REPORTES } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, rep]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]
    window.__FAKE_INSCRIPCIONES__ = i
    window.__FAKE_RONDAS__ = r
    window.__FAKE_MESAS__ = m
    window.__FAKE_RESULTADOS__ = res
    window.__FAKE_REPORTES__ = rep
  }, [sesion, torneo, INSCRIPCIONES, rondas, mesas, RESULTADOS, reportes])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const pestana = async (page, cual) => {
  const t = page.locator(`[data-pestana="${cual}"]`)
  if (!(await t.count())) return false
  await t.click()
  await page.waitForTimeout(600)
  return true
}

console.log('\n── 1. La cabecera dice lo que es el torneo, de un vistazo ──')
{
  const { page, errores } = await abrir()
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const cab = page.locator('#torneoCabecera')
  check('hay cabecera', await cab.isVisible())
  check('  …con el estado', (await cab.locator('#torneoEstado').textContent())?.includes('En juego'))
  check('  …con el sello de oficial', (await cab.locator('#torneoChapaOficial').count()) === 1)
  // Cinco chapas y no cuatro cajas del mismo tamaño: con cuatro cajas
  // iguales no destacaba ninguna.
  const datos = await cab.locator('.torneo-dato').allTextContents()
  check('  …y los datos en chapas', datos.length >= 4, datos.join(' | '))
  check('  …que incluyen la estructura', datos.some((d) => /3 rondas suizas/.test(d)), datos.join(' | '))
  check('  …y el corte', datos.some((d) => /Top 4/.test(d)), datos.join(' | '))
  // Quién organiza no se decía en ningún sitio de la ficha.
  check('y dice quién organiza', (await cab.locator('#torneoMeta').textContent())?.includes('equipo de PokeDoc'),
    await cab.locator('#torneoMeta').textContent())
  await page.close()
}

console.log('\n── 2. La barra viva ──')
{
  const { page } = await abrir()
  const viva = page.locator('#torneoBarraViva')
  check('sale con una ronda en marcha', await viva.isVisible())
  check('  …y dice por qué ronda va', (await page.locator('#torneoVivaRotulo').textContent())?.includes('Ronda suiza 2 de 3'),
    await page.locator('#torneoVivaRotulo').textContent())
  check('  …y contra quién juegas', (await page.locator('#torneoVivaTitular').textContent())?.includes('Misty'),
    await page.locator('#torneoVivaTitular').textContent())
  check('  …con el reloj corriendo', /^\d+:\d{2}$/.test((await page.locator('#torneoVivaAnillo b').textContent()) || ''),
    await page.locator('#torneoVivaAnillo b').textContent())
  // El anillo se vacía: `--vuelta` va de 1 a 0. Si se quedara en 1, el
  // dibujo mentiría — diría «queda todo» con la ronda acabándose.
  const vuelta = await page.locator('#torneoVivaAnillo').evaluate((e) => Number(getComputedStyle(e).getPropertyValue('--vuelta')))
  check('  …y el anillo se vacía con la ronda', vuelta > 0 && vuelta < 1, String(vuelta))
  // Lo que FALTA, y solo eso: Ash ya hizo check-in, Misty no.
  const der = await page.locator('#torneoVivaDer').textContent()
  check('  …y pide lo que falta', /Misty aún no ha hecho check-in/.test(der || ''), der)
  check('  …sin pedirte lo que ya hiciste', !/Te falta el check-in/.test(der || ''), der)
  // Pegada arriba: es lo que hace que no se pierda con el scroll.
  const pegada = await viva.evaluate((e) => getComputedStyle(e).position)
  check('  …y va pegada arriba', pegada === 'sticky', pegada)
  await page.close()

  // Sin ronda en marcha no ocupa: una barra vacía arriba sería peor que
  // no tenerla.
  const parado = await abrir({ rondas: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss' }] })
  check('sin ronda en marcha, ni ocupa', !(await parado.page.locator('#torneoBarraViva').isVisible()))
  // Y si la ronda se CIERRA con la barra ya puesta, se tiene que ir. Con
  // la página recién cargada esto no se ve —la barra nace escondida—,
  // así que se la enseña a mano y se pide un refresco, que es justo lo
  // que pasa el día del torneo cuando el organizador cierra la ronda.
  await parado.page.evaluate(() => document.getElementById('torneoBarraViva').classList.remove('hidden'))
  check('  …y con la barra puesta, se ve', await parado.page.locator('#torneoBarraViva').isVisible())
  // «Actualizar» vive en la pestaña de rondas: hay que abrirla.
  await pestana(parado.page, 'rondas')
  await parado.page.locator('#btnActualizarCiclo').click()
  await parado.page.waitForTimeout(1200)
  check('  …pero al refrescar sin ronda, se va', !(await parado.page.locator('#torneoBarraViva').isVisible()))
  await parado.page.close()
}

console.log('\n── 3. El tablero de tu partida ──')
{
  const { page } = await abrir()
  check('se abre la pestaña de jugar', await pestana(page, 'jugar'))
  const duelo = page.locator('.torneo-duelo')
  check('hay un duelo', await duelo.isVisible())
  check('  …con los dos jugadores', (await duelo.locator('.torneo-duelo-jugador').count()) === 2)
  // El marcador en medio: en un BO3 es lo que evita echar la cuenta de
  // cabeza mirando tres renglones.
  const marcador = await duelo.locator('.torneo-duelo-marcador').textContent()
  check('  …y el marcador de la serie en medio', /1.*0/.test(marcador || ''), marcador)
  check('  …con el que va ganando marcado', (await duelo.locator('.torneo-duelo-marcador b.gana').textContent()) === '1',
    await duelo.locator('.torneo-duelo-marcador b.gana').textContent())
  // El check-in va bajo cada cara: es un estado de esa persona.
  const checkins = await duelo.locator('.torneo-duelo-checkin').allTextContents()
  check('  …y el check-in de cada uno bajo su cara', checkins.length === 2, checkins.join(' | '))
  check('  …el tuyo hecho', /Check-in hecho/.test(checkins[0] || ''), checkins[0])
  check('  …y el suyo pendiente', /pendiente/.test(checkins[1] || ''), checkins[1])
  await page.close()
}

console.log('\n── 4. El BO3, en tres casillas que se leen por el color ──')
{
  const { page } = await abrir()
  await pestana(page, 'jugar')
  const casillas = page.locator('.torneo-bo3-juego')
  check('hay tres casillas', (await casillas.count()) === 3)
  check('la 1.ª, ganada', (await casillas.nth(0).getAttribute('class'))?.includes('ganada'),
    await casillas.nth(0).getAttribute('class'))
  check('la 2.ª, la que toca marcar', (await casillas.nth(1).getAttribute('class'))?.includes('activa'),
    await casillas.nth(1).getAttribute('class'))
  check('  …con sus tres botones', (await casillas.nth(1).locator('[data-reporte]').count()) === 3)
  check('  …que van al juego 2', (await casillas.nth(1).locator('[data-reporte]').first().getAttribute('data-juego')) === '2')
  check('la 3.ª, pendiente', !(await casillas.nth(2).getAttribute('class'))?.match(/ganada|perdida|activa/),
    await casillas.nth(2).getAttribute('class'))
  // Nada puede salirse de su casilla: el `flex-wrap` de la fila vieja
  // abría una SEGUNDA COLUMNA y los botones se iban fuera.
  for (const ancho of [1280, 420]) {
    const p2 = await abrir({ ancho })
    await pestana(p2.page, 'jugar')
    const fuera = await p2.page.evaluate(() =>
      [...document.querySelectorAll('.torneo-bo3-juego')].filter((j) => {
        const c = j.getBoundingClientRect()
        return [...j.children].some((h) => h.getBoundingClientRect().right > c.right + 1 || h.getBoundingClientRect().left < c.left - 1)
      }).length)
    check(`a ${ancho}px nada se sale de su casilla`, fuera === 0, String(fuera))
    await p2.page.close()
  }
  await page.close()
}

console.log('\n── 5. Las mesas, como enfrentamientos ──')
{
  const { page } = await abrir()
  check('se abre la pestaña de rondas', await pestana(page, 'rondas'))
  const mesas = page.locator('.torneo-mesa')
  check('hay una fila por mesa', (await mesas.count()) === 2, String(await mesas.count()))
  // La tuya, marcada: en una ronda de ocho mesas iguales lo primero que
  // busca cualquiera es la suya.
  check('la tuya va marcada', (await page.locator('.torneo-mesa.mia').count()) === 1)
  check('  …y es la que juegas', (await page.locator('.torneo-mesa.mia').textContent())?.includes('Misty'))
  // El ganador en negrita: es lo primero que se busca en una cerrada.
  const cerrada = mesas.nth(1)
  check('en la cerrada, el ganador va marcado', (await cerrada.locator('.torneo-mesa-lado.gana').count()) === 1,
    await cerrada.textContent())
  check('  …y es quien ganó', (await cerrada.locator('.torneo-mesa-lado.gana').textContent())?.includes('jesus'),
    await cerrada.locator('.torneo-mesa-lado.gana').textContent())
  // Ya no es una tabla, así que en el móvil no hay que traducirla.
  check('ya no hay tabla de mesas', (await page.locator('.torneo-mesas-tabla').count()) === 0)
  check('  …ni el apaño de data-etiqueta', !/data-etiqueta/.test(RONDA.replace(/\/\/.*$/gm, '')))
  await page.close()
}

console.log('\n── 6. La línea de tiempo, y un solo reloj ──')
{
  const { page } = await abrir()
  await pestana(page, 'rondas')
  const pasos = page.locator('.torneo-paso')
  // Tres suizas previstas + el top cut = cuatro pasos.
  check('un paso por ronda prevista, más el corte', (await pasos.count()) === 4, String(await pasos.count()))
  check('la 1.ª, terminada', (await pasos.nth(0).textContent())?.includes('Terminada'))
  check('la 2.ª, la viva', (await pasos.nth(1).getAttribute('class'))?.includes('viva'))
  // El reloj vive DENTRO del paso vivo: antes había tres relojes en
  // pantalla diciendo lo mismo (la barra, el gigante y el de la partida).
  check('  …con el reloj dentro', (await pasos.nth(1).locator('#cuentaGrande').count()) === 1)
  check('  …corriendo', /^\d+:\d{2}$/.test((await pasos.nth(1).locator('#cuentaGrande').textContent()) || ''),
    await pasos.nth(1).locator('#cuentaGrande').textContent())
  check('la 3.ª y el top, por jugar', (await pasos.nth(2).textContent())?.includes('Por jugar') && (await pasos.nth(3).textContent())?.includes('Top 4'))
  // Un solo reloj GRANDE en pantalla. Los tres de antes decían lo mismo.
  const relojes = await page.evaluate(() =>
    [...document.querySelectorAll('#cuentaGrande, #torneoVivaAnillo b, .torneo-partida-cuenta')].filter((e) => e.offsetParent !== null).length)
  check('y no hay tres relojes a la vez', relojes <= 2, String(relojes))
  check('  …porque el reloj gigante se fue', !/torneo-ronda-hero/.test(CSS) && !/cuenta-grande/.test(CSS))
  await page.close()
}

console.log('\n── 7. La clasificación: dónde estás y quién gana ──')
{
  const { page } = await abrir()
  check('se abre la clasificación', await pestana(page, 'clasificacion'))
  check('los tres primeros llevan medalla', (await page.locator('.torneo-pos-1').count()) === 1 &&
    (await page.locator('.torneo-pos-2').count()) === 1 && (await page.locator('.torneo-pos-3').count()) === 1)
  check('y tu fila va marcada', (await page.locator('tr.torneo-fila-yo').count()) === 1)
  check('  …y es la tuya', (await page.locator('tr.torneo-fila-yo').textContent())?.includes('Ash'),
    await page.locator('tr.torneo-fila-yo').textContent())
  // Lo que YA funcionaba y no se puede perder por el camino.
  check('el historial de un jugador sigue ahí', (await page.locator('[data-historial]').count()) > 0)
  check('y los desempates se siguen explicando', (await page.locator('.torneo-desempates').count()) === 1)
  await page.close()
}

console.log('\n── 8. Lo que ya funcionaba, sigue funcionando ──')
{
  // Un rediseño que se lleve por delante el reportar o el resolver no es
  // un rediseño, es una avería.
  const { page } = await abrir()
  await pestana(page, 'jugar')
  check('se puede reportar', (await page.locator('[data-reporte]').count()) > 0)
  check('y cambiar lo reportado', (await page.locator('.torneo-bo3-juego.ganada').count()) === 1)
  await page.close()

  // Con la mesa sin check-in hecho, el botón tiene que estar.
  const sinCheckin = await abrir({
    mesas: MESAS.map((m) => (m.id === 'mesa-1' ? { ...m, check_in_a_at: null } : m)),
  })
  await pestana(sinCheckin.page, 'jugar')
  check('el botón de check-in aparece si te falta', (await sinCheckin.page.locator('#btnCheckin').count()) === 1)
  check('  …y la barra viva te lo pide', /Te falta el check-in/.test((await sinCheckin.page.locator('#torneoVivaDer').textContent()) || ''),
    await sinCheckin.page.locator('#torneoVivaDer').textContent())
  await sinCheckin.page.close()

  // Y el organizador sigue pudiendo resolver una mesa a mano.
  const admin = await abrir({ sesion: 'admin-1' })
  await pestana(admin.page, 'rondas')
  check('el organizador sigue pudiendo resolver una mesa', (await admin.page.locator('[data-resolver]').count()) > 0)
  check('  …y llevar el ciclo', (await admin.page.locator('#btnCerrarRonda').count()) === 1)
  await admin.page.close()
}

console.log('\n── 9. Sin cuenta, y en un móvil ──')
{
  // La ficha es el ESCAPARATE (tanda 252): se ve entera sin cuenta.
  const { page, errores } = await abrir({ sesion: 'none' })
  check('la ficha se ve sin cuenta', await page.locator('#torneoCabecera').isVisible())
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  // Quien solo mira ve el marcador de la ronda, no «tu partida».
  check('  …con la barra viva de quien mira', await page.locator('#torneoBarraViva').isVisible())
  check('  …que NO habla de tu partida', !/Tu partida/.test((await page.locator('#torneoVivaTitular').textContent()) || ''),
    await page.locator('#torneoVivaTitular').textContent())
  await page.close()

  for (const ancho of [320, 420]) {
    const m = await abrir({ ancho })
    await pestana(m.page, 'jugar')
    const desborde = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`a ${ancho}px la ficha no se sale`, desborde <= 1, String(desborde))
    await pestana(m.page, 'rondas')
    const d2 = await m.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`  …ni las rondas`, d2 <= 1, String(d2))
    await m.page.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
