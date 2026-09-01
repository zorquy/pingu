import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 232: los códigos de set de TCG Live que un admin asigna a mano.
//
// El fallo del 2026-09-01: la traducción código→set está escrita a mano
// en el código, y una lista traía ASC, POR, CRI y MEE. Ninguno estaba,
// esas cartas salían sin imagen, y no había forma de arreglarlo sin
// desplegar. Ahora se asigna desde /admin y manda sobre la tabla.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e)))

await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  // Un set con un código que la tabla del código NO conoce.
  window.__FAKE_SETS__ = [{ id: 'sv-asc', name: 'Set Nuevo', market: 'WEST' }]
  window.__FAKE_AJUSTES__ = [{ key: 'torneos_sets_live', value: { codigos: { ASC: 'sv-asc' } } }]
  window.__FAKE_CARTAS__ = [
    { id: 'sv-asc-142', set_id: 'sv-asc', market: 'WEST', local_id: '142', name: 'Fezandipiti ex', image_path: 'sv/asc/142' },
  ]
})
await page.goto('http://localhost:8892/torneo?slug=nada', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

console.log('\n── El código asignado a mano resuelve el set ──')
{
  const r = await page.evaluate(async () => {
    const m = await import('/js/torneos/cartas-decklist.js')
    const mazo = {
      pokemon: [
        { quantity: 1, name: 'Fezandipiti ex', set: 'ASC', number: '142' },
        { quantity: 1, name: 'Loquesea', set: 'ZZZ', number: '9' },
      ],
      trainer: [],
      energy: [],
    }
    return { sinResolver: await m.codigosSinResolver(mazo) }
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  // ASC lo resuelve el ajuste; ZZZ no lo conoce nadie y se declara, que
  // es lo que hace que el panel pueda enseñarlo.
  check('ASC ya se resuelve', !r.sinResolver.includes('ASC'), JSON.stringify(r.sinResolver))
  check('y un código desconocido se declara', r.sinResolver.includes('ZZZ'), JSON.stringify(r.sinResolver))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
