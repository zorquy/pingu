// Tanda 1390 — el Resumen de Mis partidas (la propuesta «Jugar con cara de
// juego», PINGU: «dale con todo lo recomendado»):
//   · una pestaña nueva, la primera, que se abre sola si hay partidas;
//   · el anillo con el MISMO % que Estadísticas (el empate vale medio, 628);
//   · V-D-E en color, las últimas 10 y la racha;
//   · el mazo estrella en un panel de juego con su arte, su % y contra qué
//     gana y pierde; las últimas 6 como cartas de color;
//   · contra lo que más ganas / más te cuesta solo con 3 partidas o más;
//   · fuera la franja de arriba (838), y «Ver las N» lleva a sus partidas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// 28 partidas: 18-8-2 (68 %). Dragapult en 21, Gardevoir en 7.
const sembrar = () => {
  const hace = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
  const mios = [['d:dragapult ex', 'Dragapult ex'], ['d:gardevoir ex', 'Gardevoir ex']]
  const rivales = [['d:charizard ex', 'Charizard ex'], ['d:lugia vstar', 'Lugia VSTAR'], ['d:raging bolt ex', 'Raging Bolt ex'], ['d:gholdengo ex', 'Gholdengo ex'], ['d:lost box', 'Lost Box']]
  const R = 'wwlwwdlwwlwlwwwlwwlwdwwlwlww'
  window.__FAKE_PARTIDAS__ = [...R].map((r, i) => ({ id: `p${i}`, user_id: 'user-1', mi_mazo: mios[i % 4 ? 0 : 1][0], mi_mazo_nombre: mios[i % 4 ? 0 : 1][1], rival_mazo: rivales[i % 5][0], rival_mazo_nombre: rivales[i % 5][1], resultado: { w: 'win', l: 'loss', d: 'draw' }[r], jugada_el: hace(i * 2), donde: i % 3 ? 'TCG Live' : 'Liga de tienda', created_at: new Date(Date.now() - i * 86400000).toISOString() }))
}
const b = await chromium.launch()
for (const movil of [false, true]) {
  const q = movil ? 'móvil' : 'PC'
  console.log(`── ${q} ──`)
  const ctx = await contexto(b, movil, 'user-1', sembrar)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await p.goto(BASE + '/mis-partidas', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => {
    const raiz = document.getElementById('partidasResumenJuego')
    const t = (s) => raiz.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim()
    return {
      pestana: document.querySelector('#partidasTabs .seg-btn[aria-pressed="true"]')?.dataset.vista,
      primera: document.querySelector('#partidasTabs .seg-btn')?.dataset.vista,
      franja: Boolean(document.getElementById('partidasHero')),
      anillo: t('.pr-anillo b'),
      vde: ['.pr-v b', '.pr-d b', '.pr-e b'].map((s) => t(s)).join('-'),
      forma: raiz.querySelectorAll('.pr-forma i').length,
      estrella: t('.pr-estrella h3'),
      cifras: t('.pr-cifras'),
      juego: getComputedStyle(raiz.querySelector('.pr-estrella')).backgroundImage.includes('gradient'),
      ultimas: [...raiz.querySelectorAll('.pr-partida')].map((x) => x.className.replace('pr-partida ', '')),
      gana: [...raiz.querySelectorAll('.pr-gana .pr-rival')].map((x) => x.querySelector('.pr-rival-pct small')?.textContent),
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check(`${q}: Resumen es la primera pestaña y se abre sola con partidas`, r.primera === 'resumen' && r.pestana === 'resumen', JSON.stringify(r))
  check(`${q}: sin la franja de arriba de antes`, !r.franja)
  check(`${q}: el anillo dice 68 % (18-8-2, el empate vale medio)`, r.anillo?.startsWith('68%') && r.vde === '18-8-2', JSON.stringify([r.anillo, r.vde]))
  await p.click('#partidasTabs [data-vista="stats"]')
  await p.waitForTimeout(300)
  const stats = await p.textContent('#partidasResumen').catch(() => '')
  check(`${q}: …el mismo % que Estadísticas`, /68\s?%/.test(stats), stats.replace(/\s+/g, ' ').slice(0, 120))
  await p.click('#partidasTabs [data-vista="resumen"]')
  await p.waitForTimeout(300)
  check(`${q}: las últimas 10 en fila`, r.forma === 10, r.forma)
  check(`${q}: tu mazo estrella, Dragapult ex, 21 partidas al 60 %, en panel de juego`, r.estrella === 'Dragapult ex' && /21/.test(r.cifras) && /60 %/.test(r.cifras) && r.juego, JSON.stringify([r.estrella, r.cifras, r.juego]))
  check(`${q}: las 6 últimas como cartas de su color`, r.ultimas.length === 6 && r.ultimas.every((c) => /^pr-(win|loss|draw)$/.test(c)), JSON.stringify(r.ultimas))
  check(`${q}: «contra lo que más ganas» solo con 3 partidas o más`, r.gana.length > 0 && r.gana.every((x) => x.split('-').reduce((s, n) => s + Number(n), 0) >= 3), JSON.stringify(r.gana))
  check(`${q}: sin desplazamiento de lado`, r.ancho)
  await p.click('#partidasResumenJuego [data-pr-ver="sueltas"]')
  await p.waitForTimeout(300)
  check(`${q}: «Ver las 28» lleva a Partidas sueltas`, (await p.evaluate(() => document.querySelector('#partidasTabs .seg-btn[aria-pressed="true"]')?.dataset.vista)) === 'sueltas')
  check(`${q}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  console.log('── Sin partidas ──')
  const ctx = await contexto(b, false, 'user-1', () => { window.__FAKE_PARTIDAS__ = [] })
  const p = await ctx.newPage()
  await p.goto(BASE + '/mis-partidas', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ pestana: document.querySelector('#partidasTabs .seg-btn[aria-pressed="true"]')?.dataset.vista, vacio: document.querySelector('#partidasResumenJuego .empty-state')?.textContent || '' }))
  check('sin partidas no se abre en un Resumen vacío, y el Resumen explica qué saldrá', r.pestana !== 'resumen' && /tu resumen/.test(r.vacio), JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
