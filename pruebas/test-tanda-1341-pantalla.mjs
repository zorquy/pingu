// Tandas 1341–1346 — la ficha del torneo rehecha (la propuesta que aprobó
// PINGU: «la cabecera es enorme», «es mucho lío, sobre todo en móvil», «el
// cronómetro debería estar en la mesa», «hay dos cabeceras… ronda 17 de 30»).
//
// 1341: cabecera de una línea con «⋯»; pestañas por momento (Info, Jugadores,
//       Mi mesa…) pegadas al bajar con la pastilla del reloj y la línea del
//       tablón, que abre el tablón como hoja en el móvil.
// 1342: el día en grande en Info, «Inscribirme» arriba, tu entrada en verde,
//       buscador en Jugadores.
// 1343: el reloj de la ronda dentro de tu mesa, con color por fase.
// 1344: el mando del organizador (un botón, «⋯» con deshacer), sin «Actualizar».
// 1345: quién va arriba en Clasificación, tabla del móvil a 4 columnas,
//       cifras de Jueces.
// 1346: /torneos sin el aviso «Ronda 17 de 30» para una liga; la liga en vivo
//       en su tarjeta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ahora = Date.now()

const TORNEO = {
  id: 'torneo-1', slug: 'pachanga', name: 'Liga PokeDoc · Jornada 4', status: 'in_progress',
  admin_id: 'user-3', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3,
  round_time_minutes: 30, checkin_minutes: 5, is_official: true,
  start_at: new Date(ahora - 3600e3).toISOString(), current_round_id: 'ronda-2',
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const INSCRIPCIONES = GENTE.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(ahora - 7200e3).toISOString() }))
const RONDAS = [
  { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: new Date(ahora - 4000e3).toISOString() },
  { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss', started_at: new Date(ahora - 120e3).toISOString(), ends_at: new Date(ahora + 14 * 60000).toISOString() },
]
const MESAS = [
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
  { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
  { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: new Date(ahora - 60e3).toISOString(), check_in_b_at: new Date(ahora - 50e3).toISOString() },
  { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
]
const RESULTADOS = [
  { id: 'r1', match_id: 'mesa-2', result: 'a_wins', winner_id: 'user-3', score_a: 2, score_b: 1 },
  { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 },
  { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
]
const h = (min) => new Date(ahora - min * 60000).toISOString()
const TABLON = [
  { id: 'a1', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Esperamos 5 minutos a la mesa 1, que se le ha caído TCG Live.', created_at: h(2) },
  { id: 'a2', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 2 en marcha · pareos publicados · 2 mesas · 30 min', created_at: h(20) },
  { id: 'a3', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 1 cerrada · 2 mesas', created_at: h(22) },
  { id: 'a4', tournament_id: 'torneo-1', author_id: 'mod-1', kind: 'aviso', body: 'Recordad: el reporte lo hace el que gana.', created_at: h(26) },
  { id: 'a5', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 1 en marcha · pareos publicados · 2 mesas · 30 min', created_at: h(50) },
  { id: 'a6', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Bienvenidos a la jornada 4.', created_at: h(55) },
]
const JUECES = [{ id: 'j1', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'approved' }]

const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', ancho = 1280, tablon = TABLON, jueces = JUECES } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, tab, ju]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
    window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, TORNEO, INSCRIPCIONES, RONDAS, MESAS, RESULTADOS, tablon, jueces])
  return { page, ctx, errores }
}
const irA = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
}

console.log('── 1341. La estructura ──')
for (const ancho of [390, 1280]) {
  const { page, ctx, errores } = await abrir({ ancho })
  await irA(page, '/torneo?slug=pachanga')
  const datos = await page.evaluate(() => ({
    pestanas: [...document.querySelectorAll('#torneoPestanas [data-pestana]')].map((b) => b.textContent.replace(/\d+/g, '').trim()),
    activa: document.querySelector('#torneoPestanas .activa')?.dataset.pestana,
    cabecera: Math.round(document.getElementById('torneoCabecera').getBoundingClientRect().height),
    formatoEnInfo: Boolean(document.querySelector('[data-panel="torneo"] #torneoFormato')),
    pegado: getComputedStyle(document.getElementById('torneoPegado')).position,
    pastillaEnMesa: getComputedStyle(document.getElementById('torneoBarraViva')).display,
    linea: document.getElementById('torneoTablonLinea')?.textContent || '',
    scroll: document.documentElement.scrollWidth - innerWidth,
  }))
  check(`${ancho}: en juego, las pestañas empiezan por Hoy`, datos.pestanas[0] === 'Hoy' && datos.activa === 'jugar', datos.pestanas.join(','))
  check(`${ancho}: «Info» en vez de «Torneo»`, datos.pestanas.includes('Info') && !datos.pestanas.includes('Torneo'))
  check(`${ancho}: la cabecera mide poco (≤ 150 px)`, datos.cabecera <= 150, datos.cabecera)
  check(`${ancho}: el formato vive en Info`, datos.formatoEnInfo)
  check(`${ancho}: lo de arriba va pegado (sticky)`, datos.pegado === 'sticky')
  check(`${ancho}: en Mi mesa no sale la pastilla`, datos.pastillaEnMesa === 'none', datos.pastillaEnMesa)
  check(`${ancho}: la línea del tablón trae el último aviso`, /Esperamos 5 minutos/.test(datos.linea) && /Tablón \(6\)/.test(datos.linea), datos.linea)
  check(`${ancho}: sin scroll de lado`, datos.scroll <= 0, datos.scroll)
  // En Rondas la pastilla sí, y su «Ir a tu mesa» cambia de pestaña.
  await page.click('#torneoPestanas [data-pestana="rondas"]')
  await page.waitForTimeout(300)
  const pastilla = await page.evaluate(() => getComputedStyle(document.getElementById('torneoBarraViva')).display)
  check(`${ancho}: en Rondas sí sale la pastilla`, pastilla !== 'none', pastilla)
  await page.click('#torneoBarraViva a[href="#torneoMiPartida"]')
  await page.waitForTimeout(400)
  check(`${ancho}: «Ir a tu mesa» lleva a Mi mesa`, (await page.evaluate(() => document.querySelector('#torneoPestanas .activa')?.dataset.pestana)) === 'jugar')
  if (ancho === 390) {
    await page.click('#torneoTablonLinea')
    await page.waitForTimeout(400)
    const hoja = await page.evaluate(() => ({ abierta: document.getElementById('torneoTablon').classList.contains('abierta'), arriba: Math.round(document.getElementById('torneoTablon').getBoundingClientRect().top), alto: innerHeight }))
    check('390: tocar la línea abre el tablón como hoja desde abajo', hoja.abierta && hoja.arriba > 100 && hoja.arriba < hoja.alto, JSON.stringify(hoja))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('390: Escape la cierra', !(await page.evaluate(() => document.getElementById('torneoTablon').classList.contains('abierta'))))
  } else {
    const lado = await page.evaluate(() => {
      const t = document.getElementById('torneoTablon').getBoundingClientRect()
      const p = document.querySelector('.torneo-principal').getBoundingClientRect()
      return { tablon: Math.round(t.left), principal: Math.round(p.right) }
    })
    check('1280: el tablón va en la columna de la derecha', lado.tablon > lado.principal, JSON.stringify(lado))
  }
  check(`${ancho}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-3', ancho: 390 })
  await irA(page, '/torneo?slug=pachanga')
  await page.click('#torneoMas summary')
  await page.waitForTimeout(200)
  const menu = await page.evaluate(() => [...document.querySelectorAll('#torneoMasMenu > *')].filter((e) => e.offsetHeight).map((e) => e.textContent.trim()))
  check('el organizador tiene Cancelar y Borrar en «⋯»', menu.some((t) => /Cancelar/.test(t)) && menu.some((t) => /Borrar/.test(t)), menu.join(','))
  await page.mouse.click(5, 600)
  await page.waitForTimeout(200)
  check('«⋯» se cierra al tocar fuera', !(await page.evaluate(() => document.getElementById('torneoMas').open)))
  check('organizador: sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 1342. Antes de empezar ──')
{
  const ANTES = { ...TORNEO, status: 'registration_open', current_round_id: null, start_at: new Date(ahora + 2 * 86400e3).toISOString(), description: '<p>' + 'Una descripción larga del organizador con premios y normas. '.repeat(8) + '</p>' }
  for (const [quien, inscritos] of [['fuera', INSCRIPCIONES.slice(1)], ['dentro', INSCRIPCIONES]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } })
    const page = await ctx.newPage()
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
    await page.addInitScript(([t, i]) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = []; window.__FAKE_MESAS__ = []; window.__FAKE_RESULTADOS__ = []; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []
    }, [ANTES, inscritos])
    await irA(page, '/torneo?slug=pachanga')
    const d = await page.evaluate(() => ({
      pestanas: [...document.querySelectorAll('#torneoPestanas [data-pestana]')].map((b) => b.dataset.pestana),
      dia: document.querySelector('#torneoCuando .torneo-cuando-dia')?.textContent.replace(/\s+/g, ' ').trim(),
      calendario: Boolean(document.querySelector('.torneo-cuando-fila #btnCalendario')),
      apuntarse: !document.getElementById('torneoApuntarse').classList.contains('hidden'),
      entrada: document.getElementById('torneoMiPlaza').classList.contains('torneo-entrada'),
      leerMas: (() => { const b = document.getElementById('torneoDescMas'); return b && !b.hidden ? b.textContent : '' })(),
    }))
    check(`${quien}: antes de empezar, Info y Jugadores primero`, d.pestanas[0] === 'torneo' && d.pestanas[1] === 'jugadores', d.pestanas.join(','))
    check(`${quien}: el día en grande en Info`, /\d/.test(d.dia || ''), d.dia)
    check(`${quien}: «Añadir al calendario» junto al día`, d.calendario)
    check(`${quien}: la descripción larga, plegada con «Leer más»`, d.leerMas === 'Leer más', d.leerMas)
    if (quien === 'fuera') {
      check('fuera: sale «Inscribirme» arriba', d.apuntarse)
      // Con «Tu plaza» en pantalla la línea se aparta; se pulsa por código.
      await page.evaluate(() => document.querySelector('#torneoApuntarse [data-apuntarse]').click())
      await page.waitForTimeout(700)
      check('fuera: el botón lleva al formulario con el cursor puesto', await page.evaluate(() => document.activeElement?.id === 'inscripcionTcgLive'))
    } else {
      check('dentro: sin «Inscribirme»', !d.apuntarse)
      check('dentro: tu plaza como entrada en verde', d.entrada)
    }
    check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}

console.log('── 1343. El reloj en tu mesa ──')
{
  const { page, ctx, errores } = await abrir({ ancho: 390 })
  await irA(page, '/torneo?slug=pachanga')
  const r = await page.evaluate(() => ({
    hay: Boolean(document.querySelector('#torneoMiPartida #mesaReloj')),
    cifra: document.querySelector('#mesaAnillo b')?.textContent,
    fase: document.getElementById('mesaReloj')?.dataset.fase,
    estado: document.getElementById('mesaRelojEstado')?.textContent,
  }))
  check('el reloj de la ronda está dentro de tu mesa', r.hay)
  check('con la cuenta puesta (no «–:––»)', /^\d{1,2}:\d{2}$/.test(r.cifra || ''), r.cifra)
  check('en el check-in, la fase es «checkin» y lo dice', r.fase === 'checkin' && /Check-in/.test(r.estado || ''), `${r.fase} ${r.estado}`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 1344. El mando ──')
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-3', ancho: 1280 })
  await irA(page, '/torneo?slug=pachanga&ver=rondas')
  const m = await page.evaluate(() => ({
    mando: document.querySelector('#rondasAdmin .torneo-mando')?.textContent.replace(/\s+/g, ' ') || '',
    cerrarPrimario: document.getElementById('btnCerrarRonda')?.classList.contains('btn-primary'),
    deshacerEnMas: Boolean(document.querySelector('.torneo-mando-mas #btnDeshacerRonda')),
    actualizar: Boolean(document.getElementById('btnActualizarCiclo')),
  }))
  check('el mando dice qué pasa', /Llevas el torneo/.test(m.mando) && /Ronda 2/.test(m.mando), m.mando)
  check('«Cerrar ronda» es el botón principal', m.cerrarPrimario)
  check('«Deshacer» va en el «⋯» del mando', m.deshacerEnMas)
  check('ya no hay «Actualizar»', !m.actualizar)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 1345. Clasificación y Jueces ──')
{
  const { page, ctx, errores } = await abrir({ ancho: 390 })
  await irA(page, '/torneo?slug=pachanga&ver=clasificacion')
  const c = await page.evaluate(() => ({
    lideres: document.querySelectorAll('.torneo-lideres .torneo-lider').length,
    columnas: [...document.querySelectorAll('.torneo-clasificacion-tabla thead th')].filter((th) => getComputedStyle(th).display !== 'none').length,
    scroll: document.documentElement.scrollWidth - innerWidth,
  }))
  check('en juego, los tres de arriba', c.lideres === 3, c.lideres)
  check('en el móvil la tabla va a 4 columnas', c.columnas === 4, c.columnas)
  check('sin scroll de lado', c.scroll <= 0, c.scroll)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir({ sesion: 'user-3', ancho: 1280 })
  await irA(page, '/torneo?slug=pachanga&ver=jueces')
  const j = await page.evaluate(() => ({
    activa: document.querySelector('#torneoPestanas .activa')?.dataset.pestana,
    cifras: [...document.querySelectorAll('#torneoJuezCifras .torneo-juez-cifra')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
  }))
  check('?ver=jueces abre Jueces aunque llegue después', j.activa === 'jueces', j.activa)
  check('Jueces: tres cifras arriba', j.cifras.length === 3 && /sin check-in/.test(j.cifras[0]), j.cifras.join(' | '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 1346. /torneos con una cabecera ──')
{
  const d = (dias) => new Date(ahora + dias * 86400e3).toISOString()
  const LIGA = { id: 'liga-1', slug: 'liga', name: 'Liga de otoño', status: 'in_progress', format: 'league', admin_id: 'user-3', max_players: 32, swiss_rounds: 30, rounds_per_matchday: 3, swiss_bo: 1, round_time_minutes: 30, checkin_minutes: 5, start_at: d(-21), matchday_dates: Array.from({ length: 10 }, (_, i) => d(-21 + i * 7)) }
  const COPA = { id: 'copa-1', slug: 'copa', name: 'Copa del sábado', status: 'in_progress', format: 'swiss', admin_id: 'user-3', max_players: 16, swiss_rounds: 4, top_cut_size: 4, swiss_bo: 3, round_time_minutes: 50, checkin_minutes: 5, start_at: d(0) }
  const rondas = []
  for (let n = 1; n <= 10; n++) rondas.push({ id: `lr-${n}`, tournament_id: 'liga-1', round_number: n, status: n < 10 ? 'finished' : 'active', phase: 'swiss', started_at: d(-1), ends_at: n === 10 ? new Date(ahora + 22 * 60000).toISOString() : null })
  rondas.push({ id: 'cr-2', tournament_id: 'copa-1', round_number: 2, status: 'active', phase: 'swiss', started_at: d(0), ends_at: new Date(ahora + 31 * 60000).toISOString() })
  for (const t of [LIGA, COPA]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
    await page.addInitScript(([t, r]) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = [{ id: 'i1', tournament_id: t.id, user_id: 'user-1', status: 'active' }]; window.__FAKE_RONDAS__ = r }, [t, rondas])
    await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const v = await page.evaluate(() => ({
      aviso: document.getElementById('torneoVivo')?.classList.contains('hidden') ? '' : document.getElementById('torneoVivo').innerText.replace(/\s+/g, ' '),
      liga: document.querySelector('.lc-vivo')?.innerText.replace(/\s+/g, ' ') || '',
      boton: document.querySelector('[data-lc-boton]')?.textContent || '',
    }))
    if (t === LIGA) {
      check('liga: no sale el aviso «Ronda N de 30» de arriba', !v.aviso, v.aviso)
      check('liga: su tarjeta va en vivo con jornada, ronda y reloj', /Jornada 4 · ronda 1 de 3/.test(v.liga) && /\d+:\d{2}/.test(v.liga), v.liga)
      check('liga: inscrito, «Ir a tu mesa»', v.boton === 'Ir a tu mesa', v.boton)
    } else {
      check('copa: el aviso cuenta sus rondas y el top', /Ronda 2 de 4 · luego, top 4/.test(v.aviso), v.aviso)
    }
    check(`${t.slug}: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
