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
  window.__FAKE_SETS__ = [
    // El camino NORMAL (tanda 233): el código lo trae la base, puesto
    // por la importación con lo que dice TCGdex. Ningún humano ha
    // apuntado nada, y un set nuevo tiene que funcionar así.
    { id: 'sv-asc', name: 'Set Nuevo', market: 'WEST', tcg_online_code: 'ASC' },
    // Uno viejo, importado antes de que existiera la columna: se
    // resuelve por la tabla escrita a mano, que sigue de red.
    { id: 'swsh12', name: 'Silver Tempest', market: 'WEST' },
    // Y uno que TCGdex trae MAL: el admin lo corrige a mano y eso manda.
    { id: 'sv-bueno', name: 'El bueno', market: 'WEST' },
    { id: 'sv-malo', name: 'El malo', market: 'WEST', tcg_online_code: 'CRI' },
  ]
  window.__FAKE_AJUSTES__ = [{ key: 'torneos_sets_live', value: { codigos: { CRI: 'sv-bueno' } } }]
  window.__FAKE_CARTAS__ = [
    { id: 'sv-asc-142', set_id: 'sv-asc', market: 'WEST', local_id: '142', name: 'Fezandipiti ex', image_path: 'sv/asc/142' },
    // La misma posición en los dos sets, con nombres distintos: así se
    // puede saber CUÁL de los dos ha ganado mirando qué carta sale.
    { id: 'bueno-1', set_id: 'sv-bueno', market: 'WEST', local_id: '1', name: 'Carta Buena', image_path: 'x/bueno/1' },
    { id: 'malo-1', set_id: 'sv-malo', market: 'WEST', local_id: '1', name: 'Carta Mala', image_path: 'x/malo/1' },
  ]
})
await page.goto('http://localhost:8892/torneo?slug=nada', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

console.log('\n── De qué se resuelve cada código ──')
{
  const r = await page.evaluate(async () => {
    const m = await import('/js/torneos/cartas-decklist.js')
    const linea = (set) => ({ quantity: 1, name: 'X', set, number: '1' })
    const mazo = { pokemon: [linea('ASC'), linea('SIT'), linea('CRI'), linea('ZZZ')], trainer: [], energy: [] }
    return { sinResolver: await m.codigosSinResolver(mazo) }
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  // ASC es el caso que importa: NADIE lo ha apuntado, lo trae la base.
  // Es lo que hace que un set nuevo funcione sin tocar código ni panel.
  check('un set nuevo se resuelve solo, desde la base', !r.sinResolver.includes('ASC'), JSON.stringify(r.sinResolver))
  check('uno viejo sigue saliendo por la tabla de siempre', !r.sinResolver.includes('SIT'), JSON.stringify(r.sinResolver))
  check('y uno de verdad desconocido se declara', r.sinResolver.includes('ZZZ'), JSON.stringify(r.sinResolver))
}

console.log('\n── Lo asignado a mano manda sobre TCGdex ──')
{
  // Si TCGdex se equivoca, un admin tiene que poder corregirlo sin
  // esperar a nadie. CRI está en los DOS sitios apuntando a sets
  // distintos, y cada set tiene una carta en la posición 1 con nombre
  // distinto: la carta que salga dice cuál ha ganado.
  const nombre = await page.evaluate(async () => {
    const m = await import('/js/torneos/cartas-decklist.js')
    const iconos = await m.resolverIconosDeArquetipo([{ set: 'CRI', numero: '1' }])
    return iconos[0]?.nombre || null
  })
  check('gana el set que dijo el admin', nombre === 'Carta Buena', String(nombre))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
