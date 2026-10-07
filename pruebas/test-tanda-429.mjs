// Tanda 429 — los que casi completas, en la Pokédex.
//
// Lo que persigue quien colecciona no es «el siguiente por número», es
// «¿a cuál le falta UNA?». Esa lista no existía, y los dos datos ya
// estaban en memoria: lo que tienes de cada especie y cuántas hay en el
// catálogo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const { casiCompletos, rejillaHtml } = await import(`${RAIZ}/js/mi-coleccion/pokedex.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. A quién le falta menos, en Node ──')
{
  const f = (dex, nombre, tengo, total) => ({ dex, nombre, tengo, total })
  const dexes = (l) => l.map((x) => x.dex).join(',')

  const filas = [
    f(1, 'Bulbasaur', 2, 3),     // falta 1
    f(2, 'Ivysaur', 8, 10),      // faltan 2
    f(3, 'Venusaur', 5, 5),      // completo
    f(4, 'Charmander', 0, 4),    // sin empezar
    f(5, 'Charmeleon', 3, 4),    // falta 1
    f(6, 'Charizard', 1, null),  // no se sabe cuántas hay
  ]
  const cerca = casiCompletos(filas)
  // A Bulbasaur (2 de 3) y a Charmeleon (3 de 4) les falta UNA a los dos,
  // y desempata el que va más adelantado: 3/4 antes que 2/3.
  check('solo los que están a medias, y por lo que les falta', dexes(cerca) === '5,1,2', dexes(cerca))
  // Se ordena por lo que FALTA y no por porcentaje: a quien le faltan 2 de
  // 4 (50 %) le queda menos que a quien le faltan 20 de 200 (90 %), y lo
  // que se va a hacer con la lista es ir a buscar cartas.
  const porcentajes = [f(1, 'A', 2, 4), f(2, 'B', 180, 200)]
  check('manda lo que FALTA, no el porcentaje', dexes(casiCompletos(porcentajes)) === '1,2',
    dexes(casiCompletos(porcentajes)))
  // Y a igualdad de lo que falta, el que va más adelantado.
  const empate = [f(1, 'A', 1, 2), f(2, 'B', 9, 10)]
  check('  …y a igualdad, el que va más adelantado', dexes(casiCompletos(empate)) === '2,1',
    dexes(casiCompletos(empate)))

  check('el completo no está: no hay nada que perseguir', !cerca.some((x) => x.dex === 3))
  check('el que no has empezado tampoco: no es que estés cerca', !cerca.some((x) => x.dex === 4))
  // `total` a null es «no se sabe cuántas hay» (el catálogo sin engordar).
  // Sin el total no se puede decir cuánto falta, y colocarlo diría algo
  // que nadie sabe — la regla de los tres estados (tanda 319).
  check('  …ni aquel del que no sabemos cuántas hay', !cerca.some((x) => x.dex === 6))
  check('una Pokédex vacía no revienta', casiCompletos([]).length === 0)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La rejilla ──')
{
  const f = (dex, nombre, tengo, total) => ({ dex, nombre, tengo, total })
  const filas = [f(1, 'Bulbasaur', 2, 3), f(400, 'Bidoof', 1, 2)]
  const porNumero = rejillaHtml(filas, 'dex')
  // Por número se agrupa por generaciones; «casi» NO, porque agrupar una
  // lista ya ordenada por otra cosa rompe justo el orden que se ha pedido.
  check('por número salen las generaciones', /Primera generación/.test(porNumero) && /Cuarta generación/.test(porNumero))
  const cerca = rejillaHtml(filas, 'cerca')
  check('«casi» no agrupa por generación', !/Primera generación/.test(cerca))
  check('  …y lleva su propio rótulo con cuántos son', /Los que casi completas/.test(cerca) && /<small>2<\/small>/.test(cerca))
  // Sin ninguno a medias se explica, no se deja un hueco en blanco.
  const nada = rejillaHtml([f(1, 'Bulbasaur', 3, 3)], 'cerca')
  check('sin ninguno a medias, se dice', /Todavía no tienes ningún Pokémon a medias/.test(nada), nada.slice(0, 120))
  check('  …y sin cartas no se busca a medias nada', /Ningún Pokémon con ese nombre/.test(rejillaHtml([], 'cerca')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. En la pantalla ──')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'RS', market: 'WEST', card_count_official: 40,
      card_count_total: 40, release_date: '2015-05-06', logo_path: 'x/l', tcg_online_code: 'ROS' }]
    const nombres = { 1: 'Bulbasaur', 2: 'Ivysaur', 3: 'Venusaur', 4: 'Charmander' }
    const cartas = []
    for (const [dex, total] of [[1, 3], [2, 10], [3, 5], [4, 4]]) {
      for (let i = 1; i <= total; i++) {
        cartas.push({ id: `sv1-${dex}-${i}`, set_id: 'sv1', local_id: `${dex}${i}`,
          name: `${nombres[dex]} ${i}`, image_path: 'x/1', market: 'WEST', rarity: 'Common',
          category: 'Pokemon', dex_ids: [dex], variants: { normal: true } })
      }
    }
    window.__FAKE_CARTAS__ = cartas
    // 2 de 3 Bulbasaur, 8 de 10 Ivysaur, los 5 Venusaur, 0 Charmander.
    const mias = [...cartas.filter((c) => c.name.startsWith('Bulbasaur')).slice(0, 2),
      ...cartas.filter((c) => c.name.startsWith('Ivysaur')).slice(0, 8),
      ...cartas.filter((c) => c.name.startsWith('Venusaur'))]
    window.__FAKE_COLECCION__ = mias.map((c, i) => ({ id: `l${i}`, card_id: c.id, cantidad: 1,
      idioma: 'es', estado: 'NM', variante: 'normal' }))
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  const nombres = () => page.locator('.pdx-especie .pdx-nombre').allTextContents()
  const cuentas = () => page.locator('.pdx-especie .pdx-cuenta').allTextContents()

  // Por número, desde la 748 (la C3 de su maqueta), es UNA región con sus
  // pestañas; y lo que no tienes dice «te falta» y no «0 de 4».
  check('empieza por número, por regiones',
    (await page.locator('.pdx-region').count()) === 9 && (await page.locator('.pdx-region.activa').textContent()) === 'Kanto', String(await page.locator('.pdx-region').count()))
  check('  …con las cuentas de cada uno', (await cuentas()).slice(0, 4).join(',') === '2 de 3,8 de 10,5 de 5,te falta',
    (await cuentas()).slice(0, 4).join(','))

  await page.selectOption('#mcPdxOrden', 'cerca')
  await page.waitForTimeout(800)
  check('«casi» deja solo los que están a medias', (await nombres()).join(',') === 'Bulbasaur,Ivysaur',
    (await nombres()).join(','))
  check('  …con el que menos le falta primero', (await cuentas()).join(',') === '2 de 3,8 de 10',
    (await cuentas()).join(','))
  check('  …y un solo rótulo, no nueve', (await page.locator('.pdx-generacion').count()) === 1,
    String(await page.locator('.pdx-generacion').count()))
  check('  …que dice cuántos son', /Los que casi completas\s*2/.test(
    (await page.locator('.pdx-generacion').textContent()).replace(/\s+/g, ' ')),
    (await page.locator('.pdx-generacion').textContent()).replace(/\s+/g, ' '))

  // Y se lleva bien con el buscador: ordenar y filtrar son cosas distintas.
  await page.fill('#mcPdxBuscar', 'ivy')
  await page.waitForTimeout(700)
  check('con el buscador puesto, solo queda el que encaja', (await nombres()).join(',') === 'Ivysaur',
    (await nombres()).join(','))
  await page.fill('#mcPdxBuscar', '')
  await page.waitForTimeout(700)
  check('  …y al quitarlo vuelven los dos', (await nombres()).join(',') === 'Bulbasaur,Ivysaur',
    (await nombres()).join(','))
  check('  …sin que el desplegable se mueva', (await page.locator('#mcPdxOrden').inputValue()) === 'cerca')

  // Pulsar uno sigue abriendo su especie: el orden no cambia lo que hace.
  await page.locator('.pdx-especie').first().click()
  await page.waitForTimeout(900)
  check('pulsar uno abre su especie', (await page.locator('#pdxVolver').count()) === 1)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
