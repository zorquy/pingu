// Tanda 1468 — propuesta «Arena: siguientes mejoras» (PINGU: «adelante con
// todo lo recomendado»):
//   · «Tu temporada» en la banda de /torneos: torneos, podios, récord, mejor
//     puesto y las cinco últimas (V/D/E), del año en curso; las cifras de la
//     arena pasan a una línea pequeña. En el móvil, una fila.
//   · El hueco de «Lo próximo» ya no es un recuadro punteado de media
//     pantalla: «Organiza el tuyo» y, si cabe, «Lo que se juega» (el meta).
//   · Campeones: el pie siempre dice algo tuyo («Ver sus mazos» si no
//     jugaste), sin repetir «N jugadores», y los jugadores cuentan a quien se
//     retiró jugando (no a quien se borró antes de empezar).
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { desenlace, temporadaDe, temporadaHtml } = await import(`${REPO}/js/torneos/temporada.js`)
  const m = { id: 'm', player_a_id: 'yo', player_b_id: 'el', status: 'finished' }
  check('a_wins siendo A → V; siendo B → D', desenlace(m, 'a_wins', 'yo') === 'V' && desenlace({ ...m, player_a_id: 'el', player_b_id: 'yo' }, 'a_wins', 'yo') === 'D')
  check('forfeit_b es victoria de A; forfeit_both, derrota', desenlace(m, 'forfeit_b', 'yo') === 'V' && desenlace(m, 'forfeit_both', 'yo') === 'D')
  check('el bye no cuenta', desenlace({ ...m, player_b_id: null, is_bye: true }, 'bye', 'yo') === null)
  check('una mesa ajena no cuenta', desenlace({ ...m, player_a_id: 'x', player_b_id: 'z' }, 'a_wins', 'yo') === null)
  const c = temporadaDe({
    yo: 'yo',
    torneos: [{ id: 1, champion_id: 'yo', podium: ['yo', 'b'] }, { id: 2, podium: ['a', 'b', 'yo'] }, { id: 3, podium: ['a'] }],
    mesas: [{ ...m, id: 'm1' }, { ...m, id: 'm2' }, { ...m, id: 'm3' }],
    resultados: [{ match_id: 'm2', result: 'b_wins', resolved_at: '2026-02-01' }, { match_id: 'm1', result: 'a_wins', resolved_at: '2026-01-01' }, { match_id: 'm3', result: 'draw', resolved_at: '2026-03-01' }],
  })
  check('tres torneos, dos podios, mejor 1.º', c.torneos === 3 && c.podios === 2 && c.mejor === 1, JSON.stringify(c))
  check('récord 1-1-1 y la racha en orden de fecha (V, D, E)', c.victorias === 1 && c.derrotas === 1 && c.empates === 1 && c.ultimas.join('') === 'VDE', JSON.stringify(c))
  const h = temporadaHtml(c, Date.parse('2026-11-26'))
  check('la banda dice «Tu temporada 2026» y el récord con empates', /Tu temporada 2026/.test(h) && />1-1-1</.test(h), h.slice(0, 200))
  check('la racha lleva letra y su texto para el lector', /aria-label="Tus últimas partidas: ganada, perdida, empate"/.test(h) && /class="r-V">V</.test(h))
  check('sin nada jugado, no hay banda', temporadaHtml({ torneos: 0, partidas: 0, ultimas: [] }) === '')
}

const b = await chromium.launch()
async function abrir({ movil = false, quien = 'user-1', datos = { abiertos: false } } = {}) {
  const ctx = await contexto(b, movil, quien)
  await ctx.addInitScript(sembrarArena, datosArena(datos))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tf', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}

// Desde la 1472 (Arena limpia), «Tu temporada» sale de /torneos (vive en la
// pestaña Torneos del perfil, con las mismas cuentas: lo puro de arriba
// sigue valiendo) y Campeones son filas en Terminados.
console.log('── PC ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await page.evaluate(() => ({
    temporada: Boolean(document.getElementById('torneosTemporada')),
    invitas: document.querySelectorAll('.t-invita').length,
  }))
  check('la lista ya no lleva «Tu temporada» ni las tarjetas que invitan (1472)', !r.temporada && r.invitas === 0, JSON.stringify(r))
  await page.click('[data-vista-lista="hechos"]')
  await page.waitForTimeout(500)
  const tardeo = await page.$eval('.tf[data-torneo-id="t-tardeo"]', (f) => f.textContent.replace(/\s+/g, ' '))
  check('el Tardeo cuenta 6 jugadores (5 + el que se retiró jugando; no el que se borró antes)', /6 jugadores/.test(tardeo), tardeo)
  check('…y dice «Quedaste 3.º»', /Quedaste 3\.º/.test(tardeo), tardeo)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Sin sesión ──')
{
  const { ctx, page, errores } = await abrir({ quien: 'none' })
  check('sin cuenta, nada tuyo', !(await page.$('#torneosTemporada')) && !(await page.$('.tf-mia')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  const r = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth - innerWidth,
    primer: Math.round(document.querySelector('#torneosAgenda .tf, #torneosAgenda .tdest')?.getBoundingClientRect().top || 0),
  }))
  check('no ensancha la página', r.scroll <= 0, r.scroll)
  check('la primera fila sale arriba (antes de 400 px)', r.primer > 0 && r.primer < 400, r.primer)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
