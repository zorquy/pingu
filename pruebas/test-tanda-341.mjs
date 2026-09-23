// Tanda 341 — la marca de regulación de un set, desde /admin.
//
// La 339 resolvió las marcas casi todas sin adivinar y dejó la tarea
// programada haciendo lo mismo con los sets que van llegando. Lo que
// ninguna de las dos puede garantizar son las DEDUCIDAS: se heredan del
// set anterior por fecha, y si la rotación cayó justo entre uno y el
// siguiente se quedan con la letra de antes.
//
// Por eso esta pantalla no enseña los 220 sets: enseña esos. Una
// pantalla que te da 220 filas para que encuentres tres es una pantalla
// que nadie mira.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

const SETS = [
  { id: 'sv3', name: 'Llamas', market: 'WEST', release_date: '2023-08-11',
    regulation_mark: 'G', regulation_mark_origen: 'cartas' },
  { id: 'sv8', name: 'Chispa', market: 'WEST', release_date: '2024-11-08',
    regulation_mark: 'H', regulation_mark_origen: 'cartas' },
  // Las dos que hay que mirar.
  { id: '30th', name: '30th Celebration', market: 'WEST', release_date: '2026-09-16',
    regulation_mark: 'I', regulation_mark_origen: 'fecha' },
  { id: 'svp', name: 'Promos', market: 'WEST', release_date: '2025-01-10',
    regulation_mark: 'H', regulation_mark_origen: 'fecha' },
  // Puesta a mano: ya está revisada y no tiene que salir en la lista.
  { id: 'sv9', name: 'A mano', market: 'WEST', release_date: '2025-06-01',
    regulation_mark: 'J', regulation_mark_origen: 'mano' },
  // Anterior a que las marcas existieran: el hueco es la verdad.
  { id: 'base1', name: 'Base', market: 'WEST', release_date: '1999-01-09',
    regulation_mark: null, regulation_mark_origen: null },
]
const CARTAS = [
  { id: '30th-1', set_id: '30th', market: 'WEST', local_id: '1', name: 'Una', regulation_mark: null },
  { id: '30th-2', set_id: '30th', market: 'WEST', local_id: '2', name: 'Dos', regulation_mark: null },
  // Esta la marcó TCGdex: no se puede pisar.
  { id: '30th-3', set_id: '30th', market: 'WEST', local_id: '3', name: 'Tres', regulation_mark: 'J' },
]

async function admin(sets = SETS) {
  const page = await browser.newPage({ viewport: { width: 1250, height: 950 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.sets
    window.__FAKE_CARTAS__ = d.cartas
  }, { sets, cartas: CARTAS })
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('[data-section="cards"]').click()
  await page.waitForTimeout(400)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Solo salen las que hay que mirar ──')
{
  const { page, errores } = await admin()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const filas = await page.locator('#marcasSetLista [data-marca-set]').evaluateAll((n) =>
    n.map((x) => x.dataset.marcaSet)
  )
  check('salen las dos deducidas', JSON.stringify(filas.sort()) === '["30th","svp"]', JSON.stringify(filas))
  check('…y la de más arriba es la más nueva',
    (await page.locator('#marcasSetLista [data-marca-set]').first().getAttribute('data-marca-set')) === '30th')
  // Las que NO tienen que salir, cada una por su motivo.
  check('no sale una que salió de sus cartas', !filas.includes('sv3'))
  check('no sale una ya puesta a mano', !filas.includes('sv9'))
  check('no sale una anterior a las marcas', !filas.includes('base1'))

  // Y el resumen cuenta las cuatro familias, que es lo que dice si hay
  // algo que hacer sin leer la tabla.
  const res = limpio(await page.locator('#marcasSetResumen').textContent())
  check('el resumen dice cuántas son seguras', /2 salen de sus propias cartas/.test(res), res)
  check('…cuántas a mano', /1 puestas a mano/.test(res), res)
  check('…cuántas deducidas', /2 deducidas/.test(res), res)
  check('…y que el hueco de las viejas es la verdad', /1 sin marca/.test(res) && /es la verdad/.test(res), res)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Confirmar escribe el set Y sus cartas ──')
{
  // Las dos cosas: el set es de donde se hereda, pero lo que lee la
  // ficha de una carta es la columna de la CARTA. Cambiar solo el set
  // dejaría la pantalla diciendo una letra y las fichas otra.
  const { page } = await admin()
  await page.locator('[data-marca-set="30th"]').fill('J')
  await page.locator('[data-confirmar-marca="30th"]').click()
  await page.waitForTimeout(900)

  const escrituras = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]')
  )
  const alSet = escrituras.filter((e) => e.tabla === 'tcg_sets').at(-1)
  const aCartas = escrituras.filter((e) => e.tabla === 'tcg_cards').at(-1)
  const filaSet = Array.isArray(alSet?.filas) ? alSet.filas[0] : alSet?.filas
  check('se escribe la marca del set', filaSet?.regulation_mark === 'J', JSON.stringify(filaSet))
  // Y el origen a 'mano', que es lo que hace que no se vuelva a deducir.
  check('…y queda marcada como puesta a mano', filaSet?.regulation_mark_origen === 'mano',
    JSON.stringify(filaSet))
  check('y también se escribe a sus cartas', Boolean(aCartas), JSON.stringify(aCartas))

  // Y desaparece de la lista sin recargar: si siguiera ahí, no se sabría
  // si ha servido de algo.
  const quedan = await page.locator('#marcasSetLista [data-marca-set]').evaluateAll((n) =>
    n.map((x) => x.dataset.marcaSet)
  )
  check('la fila confirmada desaparece de la lista', !quedan.includes('30th'), JSON.stringify(quedan))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Lo que no se puede escribir ──')
{
  const { page } = await admin()
  // Una palabra no es una marca. Si se colara, dejaría al set con una
  // «marca» que no casa con ninguna carta y todo el set fuera de
  // reglamento.
  //
  // «Jota» está aquí por lo que pasó al escribir esto: la casilla tenía
  // `maxlength="2"`, así que la recortaba a «Jo», eso SÍ pasaba la
  // comprobación, y se guardaba «JO». Un campo que se traga lo que
  // escribes y te lo convierte en algo válido es peor que uno que dice
  // que no. Se quitó el `maxlength`.
  for (const malo of ['', 'Jota', '3', 'j j']) {
    await page.locator('[data-marca-set="30th"]').fill(malo)
    await page.locator('[data-confirmar-marca="30th"]').click()
    await page.waitForTimeout(350)
  }
  const escrituras = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tcg_sets')
  )
  check('nada de eso se guarda', escrituras.length === 0, JSON.stringify(escrituras))
  // Pero una minúscula sí vale: se pasa a mayúscula sola.
  await page.locator('[data-marca-set="30th"]').fill('j')
  await page.locator('[data-confirmar-marca="30th"]').click()
  await page.waitForTimeout(800)
  const buena = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'tcg_sets').at(-1)
  )
  const fila = Array.isArray(buena?.filas) ? buena.filas[0] : buena?.filas
  check('una minúscula se guarda en mayúscula', fila?.regulation_mark === 'J', JSON.stringify(fila))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y sin la migración, se dice ──')
{
  // Una tabla vacía parece un fallo. Si la columna no existe todavía, lo
  // que hay que enseñar es qué falta por ejecutar.
  const sinColumna = SETS.map(({ regulation_mark, regulation_mark_origen, ...resto }) => resto)
  const { page } = await admin(sinColumna)
  const res = limpio(await page.locator('#marcasSetResumen').textContent())
  check('se dice qué migración falta', /supabase-migration-marcas-por-set\.sql/.test(res), res)
  check('…y se pinta como alerta',
    (await page.locator('#marcasSetResumen .admin-note-alerta').count()) === 1)
  check('…y no se pinta una tabla vacía',
    (await page.locator('#marcasSetLista [data-marca-set]').count()) === 0)
  await page.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
