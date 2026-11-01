// Tanda 1147 — Buscar (propuesta «Buscar, otra vuelta», PINGU: «dale»):
//   B1 · una sola caja en el PC: la de la página se muda a la barra.
//   B2 · antes de escribir: lo que buscaste (con ×), lo que acaba de salir,
//        «Prueba con» (ejemplos que FUNCIONAN: se pulsan todos) y tus deseos.
//   B3 · te lo completa: nombres que completan lo escrito, de la misma
//        respuesta; tocar busca, la flecha copia sin buscar.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const P = await import(`${RAIZ}/js/buscador-puro.js`)
  const s = P.sugerenciasDeNombres(['Charizard ex', 'Charizard', 'Mega Charizard X ex', 'Charizard ex', 'Pikachu', 'Charizard VSTAR'], 'chari')
  check('los que empiezan por lo escrito primero, los cortos antes, sin repetir', s.join('|') === 'Charizard|Charizard ex|Charizard VSTAR|Mega Charizard X ex', s.join('|'))
  check('lo que ya es igual a lo escrito no se ofrece', !P.sugerenciasDeNombres(['Charizard', 'Charizard ex'], 'charizard').includes('Charizard'))
  check('con una letra, nada', P.sugerenciasDeNombres(['Charizard'], 'c').length === 0)
  check('trozos: lo escrito en medio, con mayúsculas y tildes del original', JSON.stringify(P.trozosDeSugerencia('Mega Charizard X ex', 'chari')) === JSON.stringify(['Mega ', 'Chari', 'zard X ex']) && JSON.stringify(P.trozosDeSugerencia('Energía Planta', 'energia')) === JSON.stringify(['', 'Energía', ' Planta']))
  const sets = [{ id: 'a', release_date: '2024-01-01', serie_id: 'sv' }, { id: 'b', release_date: '2099-01-01', serie_id: 'sv' }, { id: 'c', release_date: '2025-05-01', serie_id: 'sv', oculto: true }, { id: 'd', release_date: '2025-03-01', serie_id: 'tcgp' }, { id: 'e', release_date: '2025-02-01', serie_id: 'sv' }]
  check('acaba de salir: la más nueva ya a la venta, sin escondidas ni TCG Pocket', P.acabaDeSalir(sets, '2026-11-01')?.id === 'e', P.acabaDeSalir(sets, '2026-11-01')?.id)
}

const b = await chromium.launch()
const conDatos = () => {
  try { localStorage.setItem('pokedoc-busquedas', JSON.stringify(['charizard', 'umbreon vmax'])) } catch {}
  const F = (window.__FAKE_FILAS__ ||= {})
  F.user_wants = [{ user_id: 'user-1', card_id: 'sv08-1', created_at: new Date().toISOString() }]
}

console.log('── 2. Antes de escribir (móvil) ──')
{
  const ctx = await contexto(b, true, 'user-1', conDatos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#bsAcaba:not([hidden])', { timeout: 8000 }).catch(() => {})
  await page.waitForSelector('#bsDeseos:not([hidden])', { timeout: 8000 }).catch(() => {})
  const rec = await page.$$eval('.bs-reciente-chip [data-reciente]', (bs) => bs.map((x) => x.dataset.reciente))
  check('lo que buscaste, en chips', rec.join() === 'charizard,umbreon vmax', rec.join())
  await page.click('[data-quitar="umbreon vmax"]')
  check('  …y la × quita solo esa', (await page.$$eval('.bs-reciente-chip [data-reciente]', (bs) => bs.map((x) => x.dataset.reciente))).join() === 'charizard')
  check('acaba de salir: una expansión que lleva a su estantería', /ver=album&set=/.test(await page.$eval('#bsAcaba a', (a) => a.getAttribute('href')).catch(() => '')))
  // La × repinta el bloque entero: los deseos vuelven cuando llegan.
  await page.waitForSelector('#bsDeseos:not([hidden]) .bs-baldosa', { timeout: 8000 }).catch(() => {})
  check('tus deseos, con su foto y su precio', [1, 2, 3].includes(await page.locator('#bsDeseos .bs-baldosa').count()) && /€/.test(await page.locator('#bsDeseos').innerText()))
  check('la caja de sugerencias no se ve (vacía)', !(await page.locator('#bsSugerencias').isVisible()))
  check('sin desbordar de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  // Cada ejemplo de «Prueba con» DA ALGO (la 447).
  const ejemplos = await page.$$eval('.bs-ejemplo', (bs) => bs.map((x) => x.dataset.ejemplo))
  for (const ej of ejemplos) {
    await page.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.bs-ejemplo', { timeout: 8000 })
    await page.click(`.bs-ejemplo[data-ejemplo="${ej}"]`)
    await page.waitForFunction(() => document.querySelector('#searchResults')?.children.length, null, { timeout: 8000 }).catch(() => {})
    const txt = await page.locator('#searchResults').innerText()
    check(`«Prueba con ${ej}» da resultados`, txt.trim() && !/Nada con/.test(txt), txt.slice(0, 80))
  }
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'none', conDatos)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  check('sin cuenta, sin «Tus deseos»', await page.locator('#bsDeseos').isHidden())
  await ctx.close()
}

console.log('── 3. Te lo completa ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' })
  await page.click('#searchInput')
  await page.keyboard.type('chari', { delay: 30 })
  await page.waitForSelector('#bsSugerencias:not([hidden]) [data-sug]', { timeout: 8000 }).catch(() => {})
  const sug = await page.$$eval('#bsSugerencias [data-sug]', (bs) => bs.map((x) => [x.dataset.sug, x.querySelector('.bs-sug-tuyo')?.textContent]))
  check('con «chari», los nombres que lo completan, con lo tuyo aparte', sug.length >= 1 && sug.every(([n, t]) => /chari/i.test(n) && /^chari$/i.test(t)), JSON.stringify(sug))
  await page.click('#bsSugerencias [data-copiar]')
  check('la flecha lo copia a la caja (con un espacio para seguir) y no se va el foco', (await page.inputValue('#searchInput')) === `${sug[0][0]} ` && await page.evaluate(() => document.activeElement?.id === 'searchInput'))
  await page.fill('#searchInput', '')
  await page.keyboard.type('chari', { delay: 30 })
  await page.waitForSelector('#bsSugerencias:not([hidden]) [data-sug]', { timeout: 8000 }).catch(() => {})
  await page.click('#bsSugerencias [data-sug]')
  await page.waitForTimeout(900)
  check('tocar una la busca y la lista se va', (await page.inputValue('#searchInput')) === sug[0][0] && !(await page.locator('#bsSugerencias').isVisible()))
  check('  …y queda en «Lo que buscaste»', await page.evaluate((n) => JSON.parse(localStorage.getItem('pokedoc-busquedas') || '[]')[0] === n, sug[0][0]))
  await ctx.close()
}

console.log('── 4. Una sola caja en el PC ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/buscar?q=charizard`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.getElementById('bsForm')?.parentElement?.id === 'navSearch', null, { timeout: 8000 }).catch(() => {})
  check('la caja de la página vive en la barra de arriba', await page.$eval('#bsForm', (f) => f.parentElement.id === 'navSearch'))
  check('  …y la pastilla de siempre no se ve (una sola caja)', !(await page.locator('#navSearchBtn').isVisible()) && (await page.locator('input[type=search]:visible').count()) === 1)
  check('el título sigue para el lector, sin ocupar', await page.$eval('h1.bs-titulo', (h) => h.getBoundingClientRect().height <= 1))
  check('los filtros empiezan cerca de la barra', (await page.$eval('#bsChips', (c) => c.getBoundingClientRect().top)) < 130)
  await page.click('main')
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(400)
  check('Ctrl+K va a la caja, sin abrir la paleta encima', await page.evaluate(() => document.activeElement?.id === 'searchInput') && (await page.locator('dialog[open]').count()) === 0)
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.waitForTimeout(400)
  check('al estrechar, la caja vuelve a la página', await page.$eval('#bsForm', (f) => f.parentElement.tagName === 'MAIN'))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo verde')
process.exit(fails ? 1 : 0)
