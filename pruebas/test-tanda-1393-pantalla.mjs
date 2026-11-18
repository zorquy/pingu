// Tanda 1393 — Torneos en modo juego (3): la arena (la propuesta «Torneos en
// modo juego», PINGU: «dale con todo lo recomendado»):
//   · /torneos se titula «La arena» (el menú sigue diciendo Torneos);
//   · el torneo que juegas sale como «Tu combate», en el panel de juego;
//   · tus torneos llevan su borde violeta en la lista;
//   · elegir mazo es como elegir personaje: cada mazo en su carta, con el
//     dibujo de su Pokémon si el nombre lo dice.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const OUT = process.env.OUT || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const TORNEOS = [
  { id: 't-1', slug: 'copa', name: 'Copa de otoño', status: 'in_progress', format: 'swiss', admin_id: 'user-3', max_players: 32, swiss_rounds: 5, top_cut_size: 4, start_at: new Date(ahora - 3600e3).toISOString() },
  { id: 't-2', slug: 'liga', name: 'Torneo del sábado', status: 'registration_open', format: 'swiss', admin_id: 'user-3', max_players: 16, swiss_rounds: 3, start_at: new Date(ahora + 3 * 86400e3).toISOString() },
]
const INSC = [{ id: 'i-1', tournament_id: 't-1', user_id: 'user-1', status: 'active', tcg_live_username: 'TCG_pingu' }]
const RONDAS = [{ id: 'r-1', tournament_id: 't-1', round_number: 2, phase: 'swiss', status: 'active', ends_at: new Date(ahora + 25 * 60e3).toISOString() }]
const browser = await chromium.launch()

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: /torneos ──`)
  {
    const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block' })
    const page = await ctx.newPage()
    const errores = []
    page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
    await page.addInitScript((d) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_TORNEOS__ = d.TORNEOS; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS
      try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    }, { TORNEOS, INSC, RONDAS })
    await page.goto(BASE + '/torneos', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const r = await page.evaluate(() => {
      const vivo = document.querySelector('#torneoVivo:not(.hidden)')
      return {
        h1: document.querySelector('main h1')?.textContent.trim(),
        vivo: vivo && { ceja: vivo.querySelector('.torneo-vivo-ceja')?.textContent, fondo: getComputedStyle(vivo).backgroundImage },
        mia: [...document.querySelectorAll('.torneo-tarjeta-mia')].map((t) => t.textContent.includes('Copa de otoño')),
        menu: [...document.querySelectorAll('a[href="/torneos.html"], a[href="/torneos"]')].some((a) => /Torneos/.test(a.textContent)),
        ancho: document.documentElement.scrollWidth <= innerWidth + 1,
      }
    })
    check(`${q}: la página se titula «La arena»`, r.h1 === 'La arena', r.h1)
    check(`${q}: …y el menú sigue diciendo «Torneos»`, r.menu)
    check(`${q}: el torneo que juegas, como «Tu combate» en el panel violeta`, r.vivo?.ceja === 'Tu combate' && /rgb\(43, 31, 99\)/.test(r.vivo.fondo), JSON.stringify(r.vivo))
    check(`${q}: tu torneo, con su borde en la lista`, r.mia.length === 1 && r.mia[0], JSON.stringify(r.mia))
    check(`${q}: sin desplazamiento de lado y sin errores`, r.ancho && !errores.length, errores.join(' | '))
    if (OUT) await page.screenshot({ path: `${OUT}/1393-arena-${movil ? 'm' : 'pc'}.png`, scale: 'css' })
    await ctx.close()
  }
}

console.log('── Elegir mazo ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark', serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'copa', name: 'Copa de Prueba', status: 'registration_open', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3 }]
    window.__FAKE_INSCRIPCIONES__ = [{ id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'AshKetchum' }]
    window.__FAKE_MAZOS__ = [{ id: 'mazo-1', name: 'Dragapult ex', cards: [] }, { id: 'mazo-2', name: 'Martillos', cards: [] }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  })
  await page.goto(BASE + '/torneo?slug=copa', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const m = await import('/js/torneos/hoy-tarjetas.js'); m.abrirVentanaLista() })
  await page.waitForTimeout(400)
  await page.locator('#btnUsarMazo').click()
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => [...document.querySelectorAll('.torneo-mazo-opcion')].map((b) => ({ n: b.querySelector('strong')?.textContent, arte: Boolean(b.querySelector('img.torneo-mazo-arte')), alto: Math.round(b.getBoundingClientRect().height) })))
  check('cada mazo en su carta (dos)', r.length === 2, JSON.stringify(r))
  check('«Dragapult ex» con el dibujo de su Pokémon; «Martillos» sin dibujo', r[0]?.arte && !r[1]?.arte, JSON.stringify(r))
  check('…cartas con cuerpo (no una línea)', r.every((x) => x.alto >= 70), JSON.stringify(r))
  if (OUT) { await page.locator('.torneo-mazo-opcion').first().hover(); await page.screenshot({ path: `${OUT}/1393-mazos.png`, scale: 'css' }) }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
