// Tanda 1375 — la ficha del torneo, versión 2 de «El torneo, renovado»
// (PINGU: «dale con la versión 2 y lo recomendado»):
//   · la cabecera con el reloj en una pastilla («Jornada 7 en …») y una
//     rayita por jornada (6 hechas, la 7 la de ahora, 3 por jugar);
//   · las pestañas arriba, grandes y con icono, en el PC y en el móvil (fuera
//     la columna estrecha y la barra de abajo; la de la web vuelve);
//   · el tablón, su línea también en el PC, con la hoja por la derecha.
//
// (El fixture es el de las tandas 1347–1351, los torneos con caras (la propuesta «Torneos con caras»
// que PINGU aprobó con las recomendadas: «muy sencillo, muy plano… deberían
// salir los avatares de cada uno»).
//
// 1347: piezas comunes (cara, forma, flecha) y el día en la pastilla entre jornadas.
// 1348: /torneos con «Vas N.º» en la liga en curso.
// 1349: Mi mesa entre jornadas: «Tu próxima jornada» con cuenta y pasos.
// 1350: Rondas de una liga con tira de jornadas; cada mesa como duelo con marcador.
// 1351: Clasificación con caras, flechas y «Últimos» (OWP/OOWP al historial),
//       Jugadores en mosaico, tablón con lo automático junto, cara de quien organiza.
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
TABLON.push({ id: 'th-1', tournament_id: 'liga-1', author_id: 'user-3', kind: 'aviso', body: 'El viernes empezamos a las 19:00.', created_at: new Date(ahora - 7200e3).toISOString() })
const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))

const browser = await chromium.launch()
async function abrir(ancho, movil = false, ver = 'jugar') {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = d.TABLON; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { TORNEO, INSC, RONDAS, MESAS, RES, TABLON, PERFILES })
  await page.goto(BASE + '/torneo?slug=liga&ver=' + ver, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const nombres = (page) => page.$$eval('#torneoPestanas [data-pestana]', (bs) => bs.map((b) => b.querySelector('.torneo-tab-largo')?.textContent.trim()))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

try {
  console.log('Lo puro')
  {
    const { cuentaAtras, cuentaDeCabecera, rayitasDeTorneo } = await import(`${RAIZ}/js/torneos/cabecera.js`)
    check('cuentaAtras: «4 d 7 h», «7 h 33 min», «1 min»', cuentaAtras(4 * dia + 7 * 3600e3 + 33 * 60e3) === '4 d 7 h' && cuentaAtras(7 * 3600e3 + 33 * 60e3) === '7 h 33 min' && cuentaAtras(20e3) === '1 min' && cuentaAtras(-5) === '')
    check('antes de empezar: «Empieza en»', cuentaDeCabecera({ status: 'registration_open', start_at: new Date(ahora + 2 * dia + 4 * 3600e3 + 60e3).toISOString() }, { ahora })?.rotulo === 'Empieza en')
    check('terminado: sin pastilla', cuentaDeCabecera({ status: 'finished' }) === null)
    const r = rayitasDeTorneo({ status: 'in_progress', swiss_rounds: 5 }, { ronda: { round_number: 3, status: 'in_progress' } })
    check('un torneo de un día: una rayita por ronda suiza', r && r.marcas.join() === 'h,h,a,,', JSON.stringify(r))
  }
  for (const movil of [false, true]) {
    const quien = movil ? 'Móvil' : 'PC'
    console.log(quien)
    const { page, ctx, errores } = await abrir(1440, movil)
    check(`${quien}: sin errores de página`, errores.length === 0, errores.join(' | '))
    const cab = await page.evaluate(() => ({
      cuenta: document.getElementById('torneoCuenta')?.textContent.trim(),
      visible: !document.getElementById('torneoCuenta')?.classList.contains('hidden'),
      rayas: [...document.querySelectorAll('#torneoRayitas i')].map((i) => i.className).join(),
      etiqueta: document.getElementById('torneoRayitas')?.getAttribute('aria-label'),
    }))
    check(`${quien}: la pastilla dice «Jornada 7 en …»`, cab.visible && /^Jornada 7 en\s*\d/.test(cab.cuenta), JSON.stringify(cab))
    check(`${quien}: diez rayitas, seis hechas y la 7 la de ahora`, cab.rayas === 'h,h,h,h,h,h,a,,,' && cab.etiqueta === 'Jornada 7 de 10', JSON.stringify(cab))
    check(`${quien}: Resumen, Clasificación, Rondas y Mazos (1473), con icono`, ['Resumen,Clasificación,Rondas,Mazos', 'Resumen,Tabla,Rondas,Mazos'].includes((await nombres(page)).join()) && (await page.locator('#torneoPestanas .torneo-tab-ic svg').count()) === 4, (await nombres(page)).join())
    const pos = await page.evaluate(() => {
      const nav = document.getElementById('torneoPestanas')
      const r = nav.getBoundingClientRect()
      const bm = document.querySelector('.bm')
      const cuerpo = document.querySelector('.torneo-principal').getBoundingClientRect()
      const cab = document.getElementById('torneoCabecera').getBoundingClientRect()
      const b = nav.querySelector('.seg-btn').getBoundingClientRect()
      return { enPegado: nav.parentNode.id === 'torneoPegado', fija: getComputedStyle(nav).position === 'fixed', debajoDeCab: r.top >= cab.bottom - 1, encimaDelCuerpo: r.bottom <= cuerpo.top + 1, ancho: Math.round(r.width), cuerpoAncho: Math.round(cuerpo.width), alto: Math.round(b.height), rail: Boolean(document.getElementById('torneoRail')), app: document.documentElement.classList.contains('torneo-app'), bm: bm ? getComputedStyle(bm).display : 'no hay' }
    })
    check(`${quien}: las pestañas arriba, entre la cabecera y lo de dentro`, pos.enPegado && !pos.fija && pos.debajoDeCab && pos.encimaDelCuerpo && !pos.rail && !pos.app, JSON.stringify(pos))
    check(`${quien}: a lo ancho y grandes`, Math.abs(pos.ancho - pos.cuerpoAncho) <= 2 && pos.alto >= (movil ? 52 : 44), JSON.stringify(pos))
    if (movil) check('Móvil: la barra de la web, a la vista', pos.bm !== 'none', pos.bm)
    // El contenido a todo lo ancho: sin la columna del tablón a la derecha.
    const lado = await page.evaluate(() => ({ linea: getComputedStyle(document.getElementById('torneoTablonLinea')).display, principal: Math.round(document.querySelector('.torneo-principal').getBoundingClientRect().width), main: Math.round(document.getElementById('torneoCabecera').getBoundingClientRect().width) }))
    check(`${quien}: el contenido a todo lo ancho y el tablón en su línea`, lado.linea !== 'none' && Math.abs(lado.main - lado.principal) <= 2, JSON.stringify(lado))
    await page.click('#torneoTablonLinea')
    await page.waitForTimeout(500)
    const hoja = await page.evaluate(() => { const t = document.getElementById('torneoTablon'); const r = t.getBoundingClientRect(); return { abierta: t.classList.contains('abierta'), derecha: Math.round(innerWidth - r.right), izq: Math.round(r.left), abajo: Math.round(innerHeight - r.bottom) } })
    check(`${quien}: la línea abre el tablón ${movil ? 'desde abajo' : 'por la derecha'}`, hoja.abierta && hoja.derecha <= 1 && (movil ? hoja.abajo <= 1 : hoja.izq > 700), JSON.stringify(hoja))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.locator('#torneoPestanas [data-pestana="clasificacion"]').click()
    await page.waitForTimeout(300)
    check(`${quien}: tocar Tabla abre la tabla y lo apunta en la dirección`, await page.locator('[data-panel="clasificacion"]').isVisible() && page.url().includes('ver=clasificacion'))
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
