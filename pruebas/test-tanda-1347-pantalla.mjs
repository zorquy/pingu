// Tandas 1347–1351 — los torneos con caras (la propuesta «Torneos con caras»
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
async function abrir(ruta, movil = false) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = d.TABLON; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { TORNEO, INSC, RONDAS, MESAS, RES, TABLON, PERFILES })
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

try {
  console.log('Mi mesa entre jornadas (1347, 1349)')
  {
    const { page, ctx, errores } = await abrir('/torneo?slug=liga&ver=jugar')
    check('sin errores de página', errores.length === 0, errores.join(' | '))
    const proxima = page.locator('#torneoProximaCaja')
    check('«Tu próxima jornada» a la vista', await proxima.isVisible())
    const txt = (await proxima.textContent()) || ''
    check('…de la jornada 7, con la cuenta y lo que falta', /Jornada 7/.test(txt) && /D[ÍI]AS/i.test(txt) && /Mandar mi lista/.test(txt), txt.slice(0, 200))
    check('la pastilla entre jornadas lleva el día', (await page.locator('.torneo-viva-dia').count()) === 1)
    check('…y «Tu lista»', (await page.locator('.torneo-viva a[data-ir-pestana="jugar"]').count()) === 1)
    check('Cómo vas con caras y forma', (await page.locator('.torneo-como-vas .torneo-jcara').count()) >= 3 && (await page.locator('.torneo-como-vas .torneo-forma').count()) >= 3)
    await ctx.close()
  }

  console.log('Rondas (1350)')
  {
    const { page, ctx } = await abrir('/torneo?slug=liga&ver=rondas')
    check('tira de diez jornadas', (await page.locator('.torneo-tira-j .torneo-tj').count()) === 10)
    check('…seis jugadas', (await page.locator('.torneo-tira-j .torneo-tj.fin').count()) === 6)
    check('R1·R2·R3 de la jornada elegida', (await page.locator('.torneo-selector-rondas .seg-btn').count()) === 3)
    check('sin las pastillas viejas', (await page.locator('[data-panel="rondas"] .torneo-rondas-chips').count()) === 0)
    check('cada mesa con caras y marcador', (await page.locator('.torneo-mesa .torneo-jcara').count()) === 8 && (await page.locator('.torneo-mesa-marcador').count()) === 4)
    await ctx.close()
  }

  console.log('Clasificación (1351)')
  {
    const { page, ctx } = await abrir('/torneo?slug=liga&ver=clasificacion')
    const tabla = page.locator('.torneo-clasificacion-tabla')
    check('una cara por fila', (await tabla.locator('tbody .torneo-jcara').count()) === 8)
    const cabecera = (await tabla.locator('thead').textContent()) || ''
    check('columna «Últimos» y sin OWP/OOWP', /Últimos/.test(cabecera) && !/OWP/.test(cabecera), cabecera)
    check('forma en cada fila', (await tabla.locator('tbody .col-forma .torneo-forma').count()) === 8)
    check('alguien con flecha de subida o bajada', (await tabla.locator('.torneo-mov.sube, .torneo-mov.baja').count()) > 0)
    check('líderes con cara', (await page.locator('.torneo-lider .torneo-jcara').count()) === 3)
    await page.locator('[data-historial="p6"]').first().click()
    await page.waitForTimeout(500)
    const des = page.locator('.torneo-historial-desempates')
    check('los desempates, en el historial', (await des.count()) === 1 && /OWP .*%.*OOWP .*%/.test((await des.textContent()) || ''), await des.textContent().catch(() => ''))
    await ctx.close()
  }
  {
    const { page, ctx } = await abrir('/torneo?slug=liga&ver=clasificacion', true)
    const visibles = await page.locator('.torneo-clasificacion-tabla thead th').evaluateAll((ths) => ths.filter((t) => getComputedStyle(t).display !== 'none').length)
    check('móvil: la tabla sigue a cuatro columnas', visibles === 4, visibles)
    await ctx.close()
  }

  console.log('Info, Jugadores, tablón y cabecera (1351)')
  {
    const { page, ctx } = await abrir('/torneo?slug=liga&ver=torneo')
    check('Jugadores en mosaico', await page.locator('#listaInscritos').evaluate((el) => el.classList.contains('torneo-inscritos-mosaico') && getComputedStyle(el).display === 'grid'))
    check('…ocho, con su cara', (await page.locator('#listaInscritos .torneo-inscrito .mini-avatar').count()) === 8)
    check('cara de quien organiza en la cabecera', (await page.locator('#torneoMeta .mini-avatar').count()) === 1 && /Organiza laiafdn/.test((await page.locator('#torneoMeta').textContent()) || ''))
    const filas = await page.locator('#torneoTablonLista .torneo-tablon-fila').evaluateAll((ls) => ls.map((l) => l.classList.contains('auto')))
    const seguidas = filas.some((a, i) => a && filas[i + 1])
    check('tablón: lo automático seguido va en una fila', filas.length >= 2 && !seguidas, JSON.stringify(filas))
    check('…con «y N avisos más»', (await page.locator('.torneo-tablon-grupo summary').count()) >= 1)
    await ctx.close()
  }

  console.log('/torneos (1348)')
  {
    const { page, ctx } = await abrir('/torneos')
    const tu = page.locator('[data-lc-tu]')
    check('la liga en curso dice tu puesto', (await tu.count()) >= 1 && /Vas\s*\d+\.º\s*de 8/.test((await tu.first().textContent()) || ''), await tu.first().textContent().catch(() => ''))
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
