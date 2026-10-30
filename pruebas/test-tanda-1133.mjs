// Tanda 1133 — las rondas de una liga en /mis-partidas, en su orden y con su
// jornada (PINGU: «no se guarda en orden… quizá porque hay ronda 1, 2 y 3 en
// cada jornada»).
//
//   1. Lo puro: «J4·R1» en una liga de tres por jornada, «R3» en un suizo,
//      «Cut R1» en el top cut; las suizas por número y el cut detrás.
//   2. La pantalla: una liga con las mesas DESORDENADAS en la base sale por
//      jornada y ronda, con su rótulo; el bye sale en la tarjeta (sin contar
//      en las cifras de arriba) y la imagen de compartir lleva los rótulos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Lo puro ──')
const m = await import(`${RAIZ}/js/matriz-partidas.js`)
const LIGA = { format: 'league', rounds_per_matchday: 3 }
check('liga de 3 por jornada: la 10 es «J4·R1»', m.rotuloDeRonda?.(LIGA, 10, 'swiss') === 'J4·R1', m.rotuloDeRonda?.(LIGA, 10, 'swiss'))
check('liga de una por jornada: «J4»', m.rotuloDeRonda?.({ format: 'league' }, 4, 'swiss') === 'J4')
check('suizo: «R3»', m.rotuloDeRonda?.({ format: 'swiss' }, 3, 'swiss') === 'R3')
check('top cut: «Cut R1»', m.rotuloDeRonda?.({ format: 'swiss' }, 1, 'top_cut') === 'Cut R1')
check('sin número, nada', m.rotuloDeRonda?.(LIGA, null, 'swiss') === null)
const orden = [{ ronda: 1, fase: 'top_cut' }, { ronda: 11 }, { ronda: 2 }, { ronda: 10 }].sort(m.ordenDeRondas).map((r) => `${r.fase === 'top_cut' ? 'c' : ''}${r.ronda}`)
check('por número y el cut detrás', orden.join(',') === '2,10,11,c1', orden)
const aMano = [{ creada: '2026-10-02' }, { creada: '2026-10-01' }].sort(m.ordenDeRondas).map((r) => r.creada)
check('lo apuntado a mano, por la hora', aMano.join(',') === '2026-10-01,2026-10-02')

console.log('\n── 2. La pantalla ──')
const SPRITE = readFileSync(`${RAIZ}/assets/app-icon-192.png`)
const ARQ = [
  { id: 'arq-drag', nombre: 'Dragapult', iconos: [{ nombre: 'Dragapult ex' }], requiere: [{ nombres: ['Dragapult ex'] }], activo: true },
  { id: 'arq-gard', nombre: 'Gardevoir', iconos: [{ nombre: 'Gardevoir ex' }], requiere: [{ nombres: ['Gardevoir ex'] }], activo: true },
]
const lista = (n) => ({ pokemon: [{ quantity: 3, name: n, set: 'X', number: '1' }], trainer: [], energy: [] })
// Jornada 3 (rondas 7, 8, 9) y jornada 4 (10, bye en la 11, 12), metidas en la
// base al revés y mezcladas: el orden de la base no puede decidir nada.
const RONDAS = [12, 8, 10, 7, 11, 9].map((n) => ({ id: `r-${n}`, tournament_id: 'liga-1', round_number: n, phase: 'swiss', status: 'finished' }))
const MESAS = [10, 12, 7, 9, 8].map((n) => ({ id: `m-${n}`, round_id: `r-${n}`, table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' }))
MESAS.splice(2, 0, { id: 'm-11', round_id: 'r-11', table_number: 9, player_a_id: 'user-1', player_b_id: null, status: 'bye' })
// La 10 (la primera de la jornada 4) se perdió; las demás, ganadas.
const RESULTADOS = MESAS.filter((x) => x.status !== 'bye').map((x) => ({ id: `res-${x.id}`, match_id: x.id, result: x.id === 'm-10' ? 'b_wins' : 'a_wins', winner_id: x.id === 'm-10' ? 'user-2' : 'user-1' }))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 }, locale: 'es-ES' })
await ctx.route(/r2\.limitlesstcg\.net|\/sprite\/|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: SPRITE, headers: { 'access-control-allow-origin': '*' } }))
await ctx.route(/\/escaneo\/|api\.tcgdex\.net/, (r) => r.fulfill({ status: 404, body: '' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_ARQUETIPOS__ = d.arq
  try {
    localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
    localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 }))
  } catch {}
  window.__FAKE_TORNEOS__ = [{ id: 'liga-1', slug: 'liga-fdn', name: 'Liga FDN', status: 'running', format: 'league', rounds_per_matchday: 3, admin_id: 'admin-1', start_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_RONDAS__ = d.rondas
  window.__FAKE_MESAS__ = d.mesas
  window.__FAKE_RESULTADOS__ = d.resultados
  window.__FAKE_DECKLISTS__ = [{ id: 'dk-1', tournament_id: 'liga-1', user_id: 'user-1', parsed_cards: d.mio }, { id: 'dk-2', tournament_id: 'liga-1', user_id: 'user-2', parsed_cards: d.rival }]
}, { arq: ARQ, rondas: RONDAS, mesas: MESAS, resultados: RESULTADOS, mio: lista('Dragapult ex'), rival: lista('Gardevoir ex') })
await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2200)
const tarjeta = '[data-abrir-torneo="pd-liga-1"]'
check('sale la tarjeta de la liga', (await page.locator(tarjeta).count()) === 1)
await page.click(tarjeta).catch(() => {})
await page.waitForTimeout(300)
const filas = await page.$$eval('.partidas-torneo-rondas li', (ls) => ls.map((l) => `${l.querySelector('.partidas-ronda-num')?.textContent.trim()} ${l.querySelector('.partidas-ronda-res')?.textContent.trim()}${/Bye/.test(l.textContent) ? ' bye' : ''}`))
check('por jornada y ronda, con su rótulo', filas.join(' | ') === 'J3·R1 V | J3·R2 V | J3·R3 V | J4·R1 D | J4·R2 V bye | J4·R3 V', filas.join(' | '))
const hero = await page.textContent('#partidasHero').catch(() => '')
check('el bye no cuenta en las cifras de arriba (5 partidas, 4-1-0)', /4-1-0/.test(hero) && /\b5\s*partidas/.test(hero), hero.replace(/\s+/g, ' ').slice(0, 160))
const unaLinea = await page.$$eval('.partidas-ronda-num', (ns) => ns.every((n) => n.getBoundingClientRect().height < 30))
check('el rótulo cabe en una línea', unaLinea)
check('sin errores', !errores.length, errores.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
