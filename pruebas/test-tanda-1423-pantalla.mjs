// Tanda 1423 — los dos caminos, unidos: en la ficha de un mazo, el torneo de
// cada lista destacada lleva a la ficha del torneo; y desde la ficha del
// torneo, cada mazo lleva a la suya (ida y vuelta).
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { INICIO } from './datos-meta-torneos.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, null)
  await ctx.addInitScript(INICIO)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/meta/dragapult-dusknoir`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mmListas .meta-lista-torneo', { timeout: 15000 }).catch(() => {})
  const r = await page.evaluate(() => { const a = document.querySelector('#mmListas .meta-lista-torneo'); return a ? { texto: a.textContent, href: a.getAttribute('href') } : null })
  check(`${movil ? 'móvil' : 'PC'}: el torneo de la lista es un enlace a su ficha`, r?.texto === 'Regional de Stuttgart' && r?.href === '/meta/torneo/oficial-900', JSON.stringify(r))
  await Promise.all([page.waitForURL(/\/meta\/torneo\/oficial-900/, { timeout: 10000 }).catch(() => {}), page.click('#mmListas .meta-lista-torneo')])
  await page.waitForSelector('#mtfPodio .mtf-puesto', { timeout: 15000 }).catch(() => {})
  const h1 = await page.evaluate(() => document.getElementById('mtfNombre')?.textContent)
  check(`${movil ? 'móvil' : 'PC'}: pulsarlo abre la ficha del torneo`, h1 === 'Regional de Stuttgart', h1)
  const vuelta = await page.evaluate(() => document.querySelector('#mtfPodio .mtf-p1 .mtf-mazo')?.getAttribute('href'))
  check(`${movil ? 'móvil' : 'PC'}: y el mazo del campeón vuelve a la ficha del mazo`, vuelta === '/meta/dragapult-dusknoir', vuelta)
  check(`${movil ? 'móvil' : 'PC'}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
