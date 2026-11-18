// Tanda 1395 — Torneos en modo juego (5): la vitrina del perfil (la propuesta
// «Torneos en modo juego», PINGU: «dale con todo lo recomendado»):
//   · Perfil › Torneos abre con la vitrina en el panel de juego: las tres
//     cifras, las medallas y el mazo de torneo;
//   · el mazo sale de sus listas de torneos de PokeDoc TERMINADOS (no de las
//     partidas sueltas), con el dibujo de su Pokémon y cuántas veces lo llevó;
//   · sin listas, la vitrina sin mazo; sin torneos jugados, sin vitrina.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

const OUT = process.env.OUT || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
const lista = (n) => ({ pokemon: [{ quantity: 3, name: n, set: 'X', number: '1' }], trainer: [], energy: [] })
async function abrir(movil, extra) {
  const ctx = await contexto(b, movil, 'user-1', extra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  if (!movil) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.locator('[data-ptab="torneos"]').first().click()
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const leer = (page) => page.evaluate(() => {
  const v = document.querySelector('#misTorneos .perfil-vitrina')
  const m = v?.querySelector('[data-mazo-de-torneo]')
  return v && { fondo: getComputedStyle(v).backgroundImage.includes('gradient'), cifras: v.querySelector('.perfil-tres-cifras')?.textContent.replace(/\s+/g, ' ').trim(), mazo: m && !m.hidden ? m.textContent.replace(/\s+/g, ' ').trim() : null, arte: Boolean(m?.querySelector('img.perfil-vitrina-arte')), primero: v === document.querySelector('#misTorneos').firstElementChild }
})

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: con la lista de la Copa de verano ──`)
  const { ctx, page, errores } = await abrir(movil, () => {
    const l = (n) => ({ pokemon: [{ quantity: 3, name: n, set: 'X', number: '1' }], trainer: [], energy: [] })
    window.__FAKE_DECKLISTS__ = [{ id: 'dk-1', tournament_id: 'torneo-3', user_id: 'user-1', parsed_cards: l('Dragapult ex') }, { id: 'dk-2', tournament_id: 'torneo-1', user_id: 'user-1', parsed_cards: l('Gardevoir ex') }]
    window.__FAKE_ARQUETIPOS__ = [{ id: 'arq-drag', nombre: 'Dragapult', iconos: [{ nombre: 'Dragapult ex' }], requiere: [{ nombres: ['Dragapult ex'] }], activo: true }]
  })
  const r = await leer(page)
  check(`${q}: arriba, la vitrina en el panel de juego con las tres cifras`, r?.primero && r.fondo && /1\s*torneo/.test(r.cifras) && /1\.º/.test(r.cifras), JSON.stringify(r))
  check(`${q}: …y el mazo de torneo: Dragapult (el de la terminada, no el de la liga en juego), con su dibujo`, /MAZO DE TORNEO\s*Dragapult\s*1 torneo/.test(r?.mazo || '') && r.arte, JSON.stringify(r))
  check(`${q}: sin errores ni desplazamiento de lado`, !errores.length && (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)), errores.join(' | '))
  if (OUT) { await page.locator('#misTorneos').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/1395-vitrina-${movil ? 'm' : 'pc'}.png`, scale: 'css' }) }
  await ctx.close()
}

console.log('── Sin listas ──')
{
  const { ctx, page } = await abrir(false, () => { window.__FAKE_DECKLISTS__ = [] })
  const r = await leer(page)
  check('la vitrina sale, sin el hueco del mazo', r && r.mazo === null, JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
