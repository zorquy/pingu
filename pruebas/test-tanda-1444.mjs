// Tanda 1444 — cómo le fue a un mazo en un torneo (Ibai, con el gráfico de
// poke_hive delante). Las cuentas (meta-cruces.js), la vista del arquetipo en
// la pestaña Tabla → Meta y la imagen que baja quien lleva el torneo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()

console.log('\n── 1. Las cuentas ──')
{
  const { cifrasDeArquetipo, tramosDePuestos, colorDeCruce } = await import(`${RAIZ}/js/torneos/meta-cruces.js`)
  const g = (clave, ids) => ({ clave, cuantos: ids.length, arq: { nombre: clave }, jugadores: ids.map((userId) => ({ userId })) })
  const meta = { total: 7, arquetipos: [g('zoro', ['a', 'b', 'c', 'd']), g('drag', ['e', 'f']), g('luc', ['g'])] }
  const M = (id, a, b, result, status = 'finished') => ({ id, player_a_id: a, player_b_id: b, status, result })
  const mesas = [
    M('1', 'g', 'a', 'b_wins'), M('2', 'b', 'c', 'a_wins'), M('3', 'd', 'e', 'a_wins'), M('4', 'f', 'h', 'b_wins'),
    M('5', 'a', 'h', 'draw'), M('6', 'b', 'd', null, 'forfeit_b'), M('7', 'e', 'f', 'a_wins'), M('8', 'g', 'c', 'a_wins'),
    M('9', 'x', null, null, 'bye'),
  ]
  const resultadoDe = (id) => ({ result: mesas.find((m) => m.id === id)?.result })
  const orden = ['a', 'g', 'b', 'e', 'd', 'h', 'c', 'f'].map((playerId) => ({ playerId }))
  const c = cifrasDeArquetipo({ meta, clave: 'zoro', partidas: mesas, resultadoDe, orden, corte: 4 })
  check('6 partidas jugadas (fuera el bye y la ausencia): 3-2-1', c.partidas === 6 && c.v === 3 && c.d === 2 && c.e === 1, JSON.stringify([c.partidas, c.v, c.d, c.e]))
  check('50 % de victorias, 1 de 6 empates', c.porcentaje === 0.5 && Math.abs(c.empates - 1 / 6) < 1e-9)
  check('sin el espejo: 2-1-1, 50 %', c.partidasSinEspejo === 4 && c.porcentajeSinEspejo === 0.5)
  check('representación 4 de 7', Math.abs(c.representacion - 4 / 7) < 1e-9)
  check('conversión: 2 de 4 entran en el corte de 4 (a 1.º, b 3.º)', c.conversion.convertidos === 2 && c.conversion.de === 4 && c.conversion.porCorte)
  const cr = Object.fromEntries(c.cruces.map((x) => [x.clave, `${x.v}-${x.d}-${x.e}`]))
  check('cruces: Lucario 1-1, espejo 1-1, Dragapult 1-0, sin lista 0-0-1', cr.luc === '1-1-0' && cr.zoro === '1-1-0' && cr.drag === '1-0-0' && cr['sin-lista'] === '0-0-1', JSON.stringify(cr))
  check('el espejo va marcado', c.cruces.find((x) => x.clave === 'zoro').espejo === true)
  const t = Object.fromEntries(c.tramos.map((x) => [x.etiqueta, x.cuantos]))
  check('dónde acabaron: Top 1 uno, Top 4 uno, Top 8 dos', t['Top 1'] === 1 && t['Top 2'] === 0 && t['Top 4'] === 1 && t['Top 8'] === 2, JSON.stringify(t))
  check('tramos para 8 jugadores: 1, 2, 4, 8', tramosDePuestos(8).map((x) => x.hasta).join() === '1,2,4,8')
  check('tramos para 30: hasta el Top 32', tramosDePuestos(30).map((x) => x.hasta).join() === '1,2,4,8,16,32')
  const sin = cifrasDeArquetipo({ meta, clave: 'drag', partidas: mesas, resultadoDe, orden, corte: 0 })
  check('sin corte, la conversión es al Top 4 (la mitad de 8)', sin.conversion.plazas === 4 && sin.conversion.porCorte === false && sin.conversion.convertidos === 1)
  check('un mazo que no está: null', cifrasDeArquetipo({ meta, clave: 'nada' }) === null)
  check('el color: verde arriba, rojo abajo, nada sin dato', /^hsl\(145/.test(colorDeCruce(0.8)) && /^hsl\(4 /.test(colorDeCruce(0.2)) && colorDeCruce(null) === 'transparent')
}

// ── El torneo de la pantalla: el de la 425, con dos rondas ──
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
const MAZOS = {
  z1: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(2, "N's Darmanitan", 'JTG', '27'), L(2, "N's Darumaka", 'JTG', '26')], trainer: [], energy: [] },
  z2: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(2, 'Pecharunt ex', 'SFA', '39')], trainer: [], energy: [] },
  d: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128')], trainer: [], energy: [] },
  luc: { pokemon: [L(3, 'Lucario', 'SVI', '114'), L(4, 'Riolu', 'SVI', '113'), L(2, 'Hariyama', 'MEG', '72')], trainer: [], energy: [] },
}
const GENTE = [['p4', 'Gary'], ['p5', 'Brock2'], ['p6', 'Erika'], ['p7', 'Sabrina'], ['p8', 'Blaine']]
const JUGADORES = ['user-1', 'user-2', 'user-3', ...GENTE.map(([id]) => id)]
const DE = { 'user-1': 'luc', 'user-2': 'z1', 'user-3': 'z1', p4: 'z2', p5: 'z2', p6: 'd', p7: 'd' }
const TORNEO = { id: 'torneo-1', slug: 'copa', name: 'Tardeo de Testeo', status: 'finished', admin_id: 'admin-1', swiss_rounds: 2, top_cut_size: 0, current_round_id: null, decklist_visibility: 'al_terminar', start_at: '2026-11-25T16:00:00Z', format: 'standard' }
const MESAS = [
  ['m1', 'ronda-1', 'user-1', 'user-2', 'b_wins'], ['m2', 'ronda-1', 'user-3', 'p4', 'a_wins'], ['m3', 'ronda-1', 'p5', 'p6', 'a_wins'], ['m4', 'ronda-1', 'p7', 'p8', 'b_wins'],
  ['m5', 'ronda-2', 'user-2', 'p8', 'draw'], ['m6', 'ronda-2', 'user-3', 'p5', 'a_wins'], ['m7', 'ronda-2', 'p6', 'p7', 'a_wins'], ['m8', 'ronda-2', 'user-1', 'p4', 'a_wins'],
]
const semillas = {
  __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
  __FAKE_TORNEOS__: [TORNEO],
  __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u })),
  __FAKE_RONDAS__: [1, 2].map((n) => ({ id: `ronda-${n}`, round_number: n, status: 'finished', phase: 'swiss', started_at: hace(120 - n * 50) })),
  __FAKE_MESAS__: MESAS.map(([id, round_id, a, b], i) => ({ id, round_id, table_number: (i % 4) + 1, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(100), check_in_b_at: hace(100) })),
  __FAKE_RESULTADOS__: MESAS.map(([match_id, , a, b, result], i) => ({ id: `r-${i}`, match_id, result, winner_id: result === 'a_wins' ? a : result === 'b_wins' ? b : null })),
  __FAKE_DECKLISTS__: JUGADORES.filter((u) => DE[u]).map((u, i) => {
    const p = { ...MAZOS[DE[u]] }
    p.total = ['pokemon', 'trainer', 'energy'].reduce((n, s) => n + p[s].reduce((m, l) => m + l.quantity, 0), 0)
    return { id: `deck-${i + 1}`, tournament_id: 'torneo-1', user_id: u, raw_text: '', parsed_cards: p, locked_at: hace(130) }
  }),
}

const browser = await chromium.launch()
const DIR = mkdtempSync(join(tmpdir(), 'tanda-1444-'))
for (const movil of [false, true]) {
  console.log(`\n── 2. La vista del mazo (${movil ? 'móvil' : 'PC'}) ──`)
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true } : { viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/[^/?]+$|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript((se) => {
    window.__FAKE_SESSION__ = 'admin-1'
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  await page.click('[data-pestana="clasificacion"]')
  await page.waitForTimeout(500)
  const filas = await page.$$eval('[data-meta-arquetipo]', (bs) => bs.map((b) => b.dataset.metaArquetipo))
  await page.evaluate(() => document.querySelector('[data-meta-arquetipo]').click())
  await page.waitForSelector('.torneo-mc', { timeout: 5000 }).catch(() => {})
  const r = await page.evaluate(() => ({
    nombre: document.querySelector('.torneo-meta-cabecera h4')?.textContent,
    losas: [...document.querySelectorAll('.torneo-mc-losa')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
    cruces: [...document.querySelectorAll('.torneo-mc-tabla tbody tr')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()),
    color: getComputedStyle(document.querySelector('.torneo-mc-pct')).backgroundColor,
    ancho: document.documentElement.scrollWidth,
    ventana: innerWidth,
    boton: Boolean(document.querySelector('[data-meta-imagen-arq]')),
  }))
  check('el primer mazo es el Zoroark (4 de 7)', /Zoroark/.test(r.nombre || '') && filas.length === 3, `${r.nombre} ${filas}`)
  check('las cuatro losas', r.losas.length === 4 && /57 %/.test(r.losas[0]) && /4 de 7/.test(r.losas[0]) && /4-3-1/.test(r.losas[1]), JSON.stringify(r.losas))
  check('los cruces: espejo, Lucario, Dragapult y sin lista', r.cruces.length === 4 && r.cruces.some((x) => /espejo/.test(x)) && r.cruces.some((x) => /Lucario/.test(x)) && r.cruces.some((x) => /Dragapult/.test(x)) && r.cruces.some((x) => /Sin lista/.test(x)), JSON.stringify(r.cruces))
  check('la casilla del % lleva color', r.color && r.color !== 'rgba(0, 0, 0, 0)', r.color)
  check('nada se sale de la pantalla', r.ancho <= r.ventana, `${r.ancho} > ${r.ventana}`)
  check('quien lleva el torneo tiene «Descargar imagen de este mazo»', r.boton)
  await page.locator('.torneo-mc').screenshot({ path: join(DIR, `vista-${movil ? 'movil' : 'pc'}.png`) })
  if (!movil) {
    const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-meta-imagen-arq]')])
    const ruta = join(DIR, descarga.suggestedFilename())
    await descarga.saveAs(ruta)
    check('baja la imagen del mazo con su nombre', /^meta-tardeo-de-testeo-n-s-zoroark\.png$/.test(descarga.suggestedFilename()), descarga.suggestedFilename())
    if (process.env.PD_COPIA) copyFileSync(ruta, join(process.env.PD_COPIA, 'imagen-mazo.png'))
  }
  if (process.env.PD_COPIA) copyFileSync(join(DIR, `vista-${movil ? 'movil' : 'pc'}.png`), join(process.env.PD_COPIA, `vista-${movil ? 'movil' : 'pc'}.png`))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
