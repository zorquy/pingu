// Tanda 444 — la barra como la de Dex, y la cabecera solo en el Panel.
//
// PINGU, con Dex delante: «puedes deslizar para un lado para ver los
// filtros y botones, además la barra de búsqueda es muy sutil; lo nuestro
// ocupa demasiadísimo». Y: «lo de mi colección debería verse solo en el
// panel, porque en los demás módulos es un espacio desperdiciado».
//
// Nada de esto da error al romperse: la cabecera vuelve a salir en las
// cinco pestañas, o los mandos se encogen hasta ser ilegibles en vez de
// deslizarse. Se ve igual de bien, solo que ocupando el doble.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = () => {
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
    market: 'WEST', logo_path: 'x/sv8/logo', card_count_official: 191, card_count_total: 191,
    release_date: '2024-11-08', tcg_online_code: 'SSP' }]
  window.__FAKE_CARTAS__ = [...Array(9)].map((_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8',
    local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/sv8/${i + 1}`,
    rarity: 'Rare', category: 'Pokemon', dex_ids: [25], variants: { normal: true } }))
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST',
    cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-09-0${i}T00:00:00Z` }))
}
const abrir = async (ancho, ruta = '/mi-coleccion.html') => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}
const altoDeLaCabecera = (page) =>
  page.locator('#mcHero').evaluate((n) => Math.round(n.getBoundingClientRect().height))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La cabecera, solo en el Panel ──')
{
  const { page, errores } = await abrir(390)
  check('en el Panel la cabecera está entera', (await altoDeLaCabecera(page)) > 150,
    String(await altoDeLaCabecera(page)))
  // A «Cartas» NO SE VA POR EL MENÚ desde la tanda 447, que la sacó de ahí
  // a propósito —el menú es Panel · Expansiones · Pokédex · Carpetas ·
  // Buscar— y dejó la PANTALLA, a la que se llega por el «Ver todas» del
  // Panel y por `?ver=cartas`. Esta prueba clicaba la pestaña que ya no
  // existe y se caía con un tiempo agotado que parece un fallo de la web.
  for (const t of ['cartas', 'album', 'pokedex', 'carpetas']) {
    await page.click(t === 'cartas' ? '[data-ir-a="cartas"]' : `[data-pestania="${t}"]`)
    await page.waitForTimeout(500)
    // CERO, no «poco»: el relleno del móvil lo pone un `@media` que va más
    // abajo en la hoja, y un `@media` NO suma especificidad. Con una sola
    // clase ganaba por orden y la cabecera «escondida» seguía midiendo
    // 32 px. Por eso se mide el alto y no si tiene una clase.
    check(`  …y en ${t} no ocupa nada`, (await altoDeLaCabecera(page)) === 0,
      String(await altoDeLaCabecera(page)))
  }
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(500)
  check('y al volver al Panel está otra vez', (await altoDeLaCabecera(page)) > 150,
    String(await altoDeLaCabecera(page)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // El `<h1>` NO se va con ella: un `display: none` lo saca también del
  // árbol de accesibilidad y la pantalla se queda sin encabezado, que es
  // peor que el espacio. Se queda en `sr-only`: cero píxeles y se sigue
  // leyendo en voz alta.
  const { page } = await abrir(390, '/mi-coleccion.html?ver=cartas')
  check('el h1 sigue existiendo fuera del Panel',
    (await page.locator('h1').count()) === 1, String(await page.locator('h1').count()))
  const h1 = await page.locator('h1').evaluate((n) => ({
    ancho: Math.round(n.getBoundingClientRect().width),
    fuera: getComputedStyle(n).display === 'none' || getComputedStyle(n).visibility === 'hidden',
    texto: n.textContent.trim(),
  }))
  check('  …sin ocupar sitio', h1.ancho <= 2, JSON.stringify(h1))
  check('  …pero SIN sacarlo del árbol de accesibilidad', !h1.fuera, JSON.stringify(h1))
  check('  …y con su texto', h1.texto.length > 0, JSON.stringify(h1))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Los mandos, en una fila que se desliza ──')
{
  const { page } = await abrir(390, '/mi-coleccion.html?ver=cartas')
  // SOLO LOS VISIBLES. El ✕ de limpiar nace escondido —sale cuando hay algo
  // que limpiar—, así que mide cero y se queda arriba del todo: contarlo
  // daba «dos filas» y «un mando aplastado» con la barra perfecta.
  const m = await page.locator('#mcMandos').evaluate((n) => {
    const vistos = [...n.children].filter((c) => c.getBoundingClientRect().width > 0)
    return {
      filas: new Set(vistos.map((c) => Math.round(c.getBoundingClientRect().top))).size,
      desliza: n.scrollWidth > n.clientWidth + 4,
      cuantos: vistos.length,
    }
  })
  check('en el móvil son UNA fila', m.filas === 1, JSON.stringify(m))
  // Y lo que importa de verdad: que NO se encojan. Un hijo de flex cede
  // antes de desbordar (la lección de la 320), así que sin `flex: 0 0
  // auto` la fila cabe siempre… con los botones aplastados.
  //
  // Se mira el `flex-shrink` y no si la fila SE DESLIZA (tanda 459): que
  // se deslice depende de cuántos mandos haya ese día —la 449 juntó dos en
  // uno y la fila pasó a caber—, así que exigirlo convertía una barra
  // perfecta en un rojo. Lo que no puede cambiar nunca es que un mando
  // ceda; eso es la regla.
  const ceden = await page.locator('#mcMandos > *').evaluateAll(
    (ns) => ns.filter((n) => n.getBoundingClientRect().width > 0 && getComputedStyle(n).flexShrink !== '0')
      .map((n) => n.id || n.className))
  check('  …sin que ningún mando ceda', ceden.length === 0, ceden.join(' | '))
  const anchos = await page.locator('#mcMandos > *').evaluateAll(
    (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().width)).filter((a) => a > 0))
  check('  …sin que ningún mando se aplaste', anchos.length >= 3 && anchos.every((a) => a >= 44),
    JSON.stringify(anchos))
  // Y que la PÁGINA no desborde: la tira se desliza ella sola.
  check('  …y la página no se va de ancho',
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)))
  await page.close()
}
{
  // Con sitio de sobra no hay nada que deslizar.
  const { page } = await abrir(1280, '/mi-coleccion.html?ver=cartas')
  check('en el escritorio no hace falta deslizar',
    !(await page.locator('#mcMandos').evaluate((n) => n.scrollWidth > n.clientWidth + 4)))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El buscador, sutil ──')
{
  const { page } = await abrir(1280, '/mi-coleccion.html?ver=cartas')
  const b = await page.locator('#mcBuscar').evaluate((n) => {
    const cs = getComputedStyle(n)
    return { borde: cs.borderTopColor, sombra: cs.boxShadow, fondo: cs.backgroundColor }
  })
  // «Sutil» es comprobable: sin borde marcado y sin sombra. Un buscador es
  // un sitio donde escribir SI QUIERES, no lo primero que pide la pantalla.
  check('no lleva un borde marcado', /rgba\(0, 0, 0, 0\)|transparent/.test(b.borde), JSON.stringify(b))
  check('  …ni sombra', b.sombra === 'none', JSON.stringify(b))
  // Pero al enfocarlo SÍ se enciende, que es cuando importa — si no, sería
  // un campo que no dice nunca dónde estás escribiendo.
  await page.focus('#mcBuscar')
  await page.waitForTimeout(200)
  const f = await page.locator('#mcBuscar').evaluate((n) => getComputedStyle(n).borderTopColor)
  check('  …y al enfocarlo se enciende', !/rgba\(0, 0, 0, 0\)|transparent/.test(f), f)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo que se gana ──')
{
  // El número que resume la tanda: cuánto tardas en ver tu primera carta.
  const { page } = await abrir(390, '/mi-coleccion.html?ver=cartas')
  const hasta = await page.locator('#mcCartas .mc-carta').first().evaluate(
    (n) => Math.round(n.getBoundingClientRect().top + window.scrollY))
  check('en un móvil la primera carta sale antes de 300 px', hasta < 300, String(hasta))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
