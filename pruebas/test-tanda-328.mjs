// Tanda 328 — mismo nombre no es la misma carta.
//
// PINGU, con dos capturas: en la ficha de Primeape salían trece
// «otras versiones» que no eran versiones de nada —otros Primeapes, de
// otros sets, con otros ataques—, y en la lista de su mazo un Mew ex de
// 30th Celebration salía marcado en ROJO como fuera de reglamento.
//
// Las dos cosas son el mismo fallo: comparar por NOMBRE y tratar el
// resultado como si fuera la carta. Lo primero enseña datos falsos; lo
// segundo acusa a alguien de llevar una carta prohibida en un torneo,
// que es bastante peor.
//
// Y por debajo, la lección de la 319 otra vez: «no sé qué carta es»
// convertido en una afirmación.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { esLaMismaCarta, huellaDeCarta } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

const PRIMEAPE = {
  id: 'pbl-43', set_id: 'pbl', market: 'WEST', local_id: '43', name: 'Primeape',
  image_path: 'sv/pbl/43', category: 'Pokemon', stage: 'Stage1', evolve_from: 'Mankey',
  hp: 110, types: ['Fighting'], rarity: 'Uncommon', regulation_mark: 'J', retreat: 2,
  detalle_at: 'x', weaknesses: [{ type: 'Psychic', value: '×2' }], resistances: [],
  attacks: [{ name: 'Corkscrew Punch', cost: ['Colorless', 'Colorless'], damage: '50' }],
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La huella: qué es «la misma carta» ──')
{
  // Una reimpresión comparte el TEXTO DE REGLAS. Cambia el dibujo, el
  // set y el número; no cambian la vida, la fase ni los ataques.
  const reimpresa = { ...PRIMEAPE, id: 'otro-9', set_id: 'otro', local_id: '9', rarity: 'Rare' }
  check('una reimpresión es la misma carta', esLaMismaCarta(PRIMEAPE, reimpresa))

  // Y esto es lo que salía mal: otro Primeape cualquiera.
  const otroPrimeape = {
    ...PRIMEAPE, id: 'jungle-43', hp: 70,
    attacks: [{ name: 'Tantrum', cost: ['Fighting'], damage: '50' }],
  }
  check('otro Primeape NO lo es', !esLaMismaCarta(PRIMEAPE, otroPrimeape))
  // Los casos de al lado, que es donde se cuela una comparación floja.
  check('…ni uno con la misma vida y otro ataque',
    !esLaMismaCarta(PRIMEAPE, { ...PRIMEAPE, attacks: [{ name: 'Low Kick', cost: ['Colorless', 'Colorless'], damage: '50' }] }))
  check('…ni uno con el mismo ataque y otro daño',
    !esLaMismaCarta(PRIMEAPE, { ...PRIMEAPE, attacks: [{ name: 'Corkscrew Punch', cost: ['Colorless', 'Colorless'], damage: '60' }] }))
  check('…ni uno con el mismo ataque y otro coste',
    !esLaMismaCarta(PRIMEAPE, { ...PRIMEAPE, attacks: [{ name: 'Corkscrew Punch', cost: ['Fighting'], damage: '50' }] }))

  // El efecto NO entra en la huella a propósito: se reescribe entre
  // erratas y entre idiomas, y dos impresiones de la misma carta pueden
  // traerlo distinto. Si entrara, una reimpresión dejaría de reconocerse.
  check('el texto del efecto no rompe la huella',
    esLaMismaCarta(PRIMEAPE, { ...PRIMEAPE, attacks: [{ ...PRIMEAPE.attacks[0], effect: 'Otra redacción.' }] }))

  // Sin ataques no hay huella, y sin huella no se afirma nada: si no,
  // dos cartas sin engordar se parecerían entre ellas.
  check('una carta sin engordar no tiene huella', huellaDeCarta({ category: 'Pokemon', name: 'Primeape' }) === null)
  check('dos sin engordar no son «la misma»',
    !esLaMismaCarta({ category: 'Pokemon', name: 'X' }, { category: 'Pokemon', name: 'X' }))
  check('un Entrenador tampoco tiene huella', huellaDeCarta({ category: 'Trainer', name: 'Iono' }) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. «Otras versiones», en la página ──')
{
  const page = await browser.newPage({ viewport: { width: 1150, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((pr) => {
    window.__FAKE_SETS__ = [
      { id: 'pbl', name: 'Pitch Black', market: 'WEST', serie_id: 'mega', release_date: '2026-07-17', card_count_official: 84 },
      { id: 'jungle', name: 'Jungle', market: 'WEST', serie_id: 'base', release_date: '1999-06-16' },
      // Sin serie, como está de verdad en la base: es lo que hacía que
      // el filtro no la echara.
      { id: 'A1a', name: 'Mythical Island', market: 'WEST', serie_id: null, release_date: '2024-12-17' },
      { id: 'pbl2', name: 'Pitch Black promo', market: 'WEST', serie_id: 'mega', release_date: '2026-07-20' },
    ]
    window.__FAKE_CARTAS__ = [
      pr,
      { ...pr, id: 'pbl2-9', set_id: 'pbl2', local_id: '9', image_path: 'sv/pbl2/9' },
      { ...pr, id: 'jungle-43', set_id: 'jungle', local_id: '43', hp: 70,
        attacks: [{ name: 'Tantrum', cost: ['Fighting'], damage: '50' }], image_path: 'base/jungle/43' },
      { ...pr, id: 'A1a-142', set_id: 'A1a', local_id: '142', image_path: 'tcgp/A1a/142' },
    ]
  }, PRIMEAPE)
  await page.goto(`${BASE}/carta/primeape-pbl-43`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  check('sin errores', errores.length === 0, errores.join(' | '))

  const versiones = (await page.locator('.carta-version').allTextContents()).map(limpio)
  check('sale la reimpresión de verdad', versiones.some((t) => t.includes('Pitch Black promo')), versiones.join(' | '))
  check('NO sale el otro Primeape', !versiones.some((t) => t.includes('Jungle')), versiones.join(' | '))
  // Pokémon TCG Pocket es otro juego, y aquí se colaba por el nombre.
  check('NO sale la de Pocket', !versiones.some((t) => t.includes('Mythical Island')), versiones.join(' | '))
  check('y solo sale esa', versiones.length === 1, versiones.join(' | '))
  await page.close()

  // Y una carta sin engordar: la sección entera no sale. Antes habría
  // enseñado todas sus homónimas.
  const p2 = await browser.newPage()
  await p2.addInitScript((pr) => {
    window.__FAKE_SETS__ = [{ id: 'pbl', name: 'Pitch Black', market: 'WEST', serie_id: 'mega' }]
    window.__FAKE_CARTAS__ = [
      { id: pr.id, set_id: 'pbl', market: 'WEST', local_id: '43', name: 'Primeape', image_path: 'sv/pbl/43' },
      { id: 'jungle-43', set_id: 'pbl', market: 'WEST', local_id: '99', name: 'Primeape', image_path: 'base/jungle/43' },
    ]
  }, PRIMEAPE)
  await p2.goto(`${BASE}/carta/primeape-pbl-43`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2000)
  check('sin datos, no se afirma que haya versiones',
    ((await p2.locator('#cartaVersiones').getAttribute('class')) || '').includes('hidden'))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Una carta sin identificar NO se acusa ──')
{
  // El fallo de PINGU, y el peor de los dos. La lista trae un set que no
  // está en nuestro catálogo, así que la carta se busca por nombre y sale
  // una gemela vieja… cuya marca de regulación se usaba para marcarla en
  // ROJO como fuera de reglamento. Se acusaba a una carta basándose en
  // OTRA carta.
  const page = await browser.newPage({ viewport: { width: 1150, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      // El set viejo SÍ está, con su código. El nuevo (30C) NO — que es
      // justo lo que pasa cuando el catálogo lleva semanas sin
      // reimportarse.
      { id: 'sv3', name: 'Obsidian Flames', market: 'WEST', serie_id: 'sv', tcg_online_code: 'OBF' },
    ]
    window.__FAKE_CARTAS__ = [
      { id: 'sv3-151', set_id: 'sv3', market: 'WEST', local_id: '151', name: 'Mew ex',
        image_path: 'sv/sv3/151', name_search: 'mew ex', regulation_mark: 'G' },
    ]
    window.__FAKE_AJUSTES__ = [{ key: 'marcas_legales', value: { marcas: ['H', 'I', 'J'] } }]
  })
  await page.goto(`${BASE}/carta.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)

  const r = await page.evaluate(async () => {
    const { pintarDecklistVisual } = await import('/js/torneos/cartas-decklist.js')
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    await pintarDecklistVisual(caja, {
      // La línea dice 30C, que no conocemos.
      pokemon: [{ quantity: 1, name: 'Mew ex', set: '30C', number: '25' }],
      trainer: [], energy: [],
    })
    const aviso = caja.querySelector('[data-reglamento]')
    return {
      ilegales: caja.querySelectorAll('.torneo-carta-ilegal').length,
      marcas: caja.querySelectorAll('.torneo-carta-marca').length,
      aviso: (aviso && !aviso.classList.contains('hidden') && aviso.textContent) || '',
    }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la carta NO se marca en rojo', r.ilegales === 0, `${r.ilegales} marcadas`)
  check('…ni se le cuelga una marca de regulación que no es suya', r.marcas === 0)
  check('pero tampoco se calla: dice que no la ha identificado',
    /no he podido identificar/i.test(r.aviso), r.aviso || '(sin aviso)')
  check('…y dice POR QUÉ, que es lo accionable',
    /catálogo/i.test(r.aviso), r.aviso)
  check('…sin llamarla fuera de reglamento', !/fuera del reglamento/i.test(r.aviso), r.aviso)

  // Y el contrario, para que el arreglo no apague el comprobador: una
  // carta que SÍ identificamos y que sí está fuera, se marca.
  const r2 = await page.evaluate(async () => {
    const { pintarDecklistVisual } = await import('/js/torneos/cartas-decklist.js')
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    await pintarDecklistVisual(caja, {
      // Esta lleva su set de verdad, el que sí conocemos.
      pokemon: [{ quantity: 1, name: 'Mew ex', set: 'OBF', number: '151' }],
      trainer: [], energy: [],
    })
    const aviso = caja.querySelector('[data-reglamento]')
    return {
      ilegales: caja.querySelectorAll('.torneo-carta-ilegal').length,
      aviso: (aviso && !aviso.classList.contains('hidden') && aviso.textContent) || '',
    }
  })
  check('la que sí identificamos y está fuera, se marca', r2.ilegales === 1, `${r2.ilegales} marcadas`)
  check('…y el aviso lo dice', /fuera del reglamento/i.test(r2.aviso), r2.aviso || '(sin aviso)')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La marca de una gemela no sale del resolutor ──')
{
  // El cinturón, por si alguien vuelve a usar la carta resuelta para
  // otra cosa: cuando no es exacta, la marca viaja a null. Así no se
  // puede juzgar aunque se quiera.
  const fuente = readFileSync(`${RAIZ}/js/torneos/cartas-decklist.js`, 'utf8')
  check('el resolutor dice si el hallazgo es exacto', /exacta:? *(true|false|exacta)/.test(fuente))
  check('…y borra la marca cuando no lo es',
    /regulation_mark: exacta \? carta\.regulation_mark : null/.test(fuente))
  check('…y el comprobador lo mira antes que nada',
    /if \(\s*carta\.exacta &&/.test(fuente), 'el comprobador no exige que la carta sea la que es')
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
