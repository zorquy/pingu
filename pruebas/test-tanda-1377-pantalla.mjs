// Tanda 1377 — Mesas del organizador (la versión 2 de «El torneo, renovado»):
//   · el mando es una tarjeta: anillo de listas (0/8), «Jornada 7 · fecha», el
//     botón grande, la inscripción de esa jornada y, plegado, quién juega y lo
//     demás; las otras jornadas en «Las demás jornadas (3)»;
//   · las mesas cerradas: «Corregir» y las repeticiones en su «⋯»;
//   · entre jornadas no sale la pastilla de arriba (repetía la cabecera).
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
async function abrir(movil) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-3'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = d.TABLON; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { TORNEO, INSC, RONDAS, MESAS, RES, TABLON, PERFILES })
  await page.goto(BASE + '/torneo?slug=liga&ver=rondas', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

try {
  for (const movil of [false, true]) {
    const quien = movil ? 'Móvil' : 'PC'
    console.log(quien)
    const { page, ctx, errores } = await abrir(movil)
    check(`${quien}: sin errores de página`, errores.length === 0, errores.join(' | '))
    const m = await page.evaluate(() => {
      const c = document.querySelector('#rondasAdmin .torneo-mando')
      const b = document.getElementById('btnGenerarPareos')?.getBoundingClientRect()
      const r = c?.getBoundingClientRect()
      return {
        anillo: c?.querySelector('.torneo-anillo b')?.textContent.replace(/\s+/g, ' ').trim(),
        titulo: c?.querySelector('.torneo-mando-texto b')?.textContent.trim(),
        sub: c?.querySelector('.torneo-mando-sub')?.textContent.trim(),
        boton: b ? { alto: Math.round(b.height), dentro: b.right <= r.right + 1 && b.left >= r.left - 1 } : null,
        detalle: c?.querySelector('details.torneo-mando-detalle') ? { abierto: c.querySelector('details.torneo-mando-detalle').open, texto: /Al emparejar la jornada 7/.test(c.querySelector('details.torneo-mando-detalle').textContent) } : null,
        filas: [...document.querySelectorAll('#torneoJornadasAdmin .torneo-jornadas-admin-fila')].filter((f) => f.checkVisibility()).map((f) => f.textContent.replace(/\s+/g, ' ').trim()),
        demas: document.querySelector('#torneoJornadasAdmin details.torneo-jornadas-mas summary')?.textContent.trim(),
        dentroDelMando: Boolean(c?.querySelector('#torneoJornadasAdmin')),
        scroll: document.documentElement.scrollWidth - innerWidth,
        viva: getComputedStyle(document.getElementById('torneoBarraViva')).display,
      }
    })
    check(`${quien}: el anillo de listas y «Jornada 7»`, /^0\/8\s*listas$/.test(m.anillo || '') && /^Jornada 7/.test(m.titulo || '') && m.sub === '0 de 8 han mandado lista', JSON.stringify(m))
    check(`${quien}: el botón grande, dentro de la tarjeta`, m.boton && m.boton.alto >= 48 && m.boton.dentro, JSON.stringify(m.boton))
    check(`${quien}: quién juega y qué pasa al emparejar, plegado`, m.detalle && !m.detalle.abierto && m.detalle.texto, JSON.stringify(m.detalle))
    check(`${quien}: la inscripción de la J7 en la tarjeta y las demás plegadas`, m.dentroDelMando && m.filas.length === 1 && /^Jornada 7/.test(m.filas[0]) && m.demas === 'Las demás jornadas (3)', JSON.stringify(m))
    check(`${quien}: sin la pastilla de arriba entre jornadas`, m.viva === 'none', m.viva)
    check(`${quien}: sin scroll de lado`, m.scroll <= 0, m.scroll)
    const mesas = await page.evaluate(() => ({
      mesas: document.querySelectorAll('#mesasContenido .torneo-mesa').length,
      selectsVisibles: [...document.querySelectorAll('#mesasContenido [data-resolver]')].filter((s) => s.checkVisibility()).length,
      mas: document.querySelectorAll('#mesasContenido details.torneo-mesa-mas').length,
    }))
    check(`${quien}: en las mesas cerradas «Corregir» no está a la vista; cada una tiene su «⋯»`, mesas.mesas === 4 && mesas.selectsVisibles === 0 && mesas.mas === 4, JSON.stringify(mesas))
    await page.click('#mesasContenido details.torneo-mesa-mas >> nth=0 >> summary')
    await page.waitForTimeout(300)
    check(`${quien}: el «⋯» abre «Corregir…»`, await page.locator('#mesasContenido details.torneo-mesa-mas[open] [data-resolver]').isVisible())
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
