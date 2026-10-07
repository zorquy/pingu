// Tanda 465 — el repaso de Mi colección: ni un enlace pocho, y las cifras
// que no caben.
//
// PINGU, antes de irse a dormir: «revisa toda la parte, todas las
// pestañas, la versión de móvil y la de PC. Si algo queda anticuado o
// pocho o cutre, reestructúralo. Prefiero la sencillez».
//
// Lo que salió del repaso, y lo que esta prueba defiende:
//
//  · NINGÚN enlace pocho en toda la sección. Van CINCO veces que lo pide
//    (la Pokédex en la 458, una expansión en la 459, y aquí los álbumes
//    soñados, las carpetas, los tres «Limpiar», el «Copiar enlace» de un
//    álbum, el «Borrar» de un diálogo y el «Quitar la nota»). Así que esta
//    prueba no mira ninguno: barre las SIETE pestañas. La excepción es un
//    enlace EN LÍNEA dentro de una frase, que la WCAG admite y la regla de
//    la casa también (tanda 312).
//
//  · LAS CUATRO CIFRAS DE LA CABECERA, que se salían de la caja. La 412
//    las puso en una fila y la 440 lo dio por bueno porque «cuatro cifras
//    caben en 390 px»… con las cifras que había delante. Con una colección
//    de verdad, «14.040,00 €» mide más que su columna y se corta por el
//    borde. No lo cantó nadie porque la REJILLA no se rompe: lo que se
//    sale es el contenido.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

const abrir = async (ver, ancho = 390, valor = 1560) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.route('**assets.tcgdex.net/**', (r) => r.fulfill({ path: SC + '/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript((valor) => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
      market: 'WEST', card_count_official: 12, card_count_total: 14, logo_path: 'x/l', release_date: '2026-09-26', tcg_online_code: 'MEE' }]
    window.__FAKE_CARTAS__ = ['Bulbasaur', 'Charmander', 'Squirtle', 'Pikachu'].map((n, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: n, name_es: n,
      image_path: 'x/' + (i + 1), rarity: 'Rare', category: 'Pokemon', types: ['Grass'], variants: { normal: true, reverse: true },
    }))
    // Una colección CARA a propósito: la cifra larga es justo la que se
    // salía, y con 9,00 € la prueba habría salido verde con el fallo
    // puesto. Se mide con el caso que rompe, no con el cómodo.
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({
      id: 'l' + i, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM',
      variante: 'normal', valor_manual: valor, created_at: new Date().toISOString(),
    }))
  }, valor)
  await page.goto(`${BASE}/mi-coleccion.html?ver=${ver}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}

console.log('\n── 1. Ni un enlace pocho en ninguna pestaña ──')
for (const ver of ['resumen', 'cartas', 'album', 'pokedex', 'carpetas', 'buscar', 'cambios']) {
  const { page, errores } = await abrir(ver)
  const pochos = await page.evaluate(() => {
    const fuera = []
    for (const b of document.querySelectorAll('#mcContenido .link-btn')) {
      if (!b.getBoundingClientRect().width) continue
      // EXCEPCIÓN, la misma que admite la WCAG y la regla de la 312: un
      // enlace EN LÍNEA dentro de una frase. Se reconoce porque su padre
      // lleva texto suyo además del botón.
      const padre = b.parentElement
      const suelto = padre && [...padre.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 12)
      // Y la cabecera de un vistazo, que ya se pinta como chapa desde la 299.
      const enCabecera = b.closest('.mc-vistazo-cabecera')
      if (!suelto && !enCabecera) fuera.push(b.id || b.textContent.trim().slice(0, 28))
    }
    return fuera
  })
  check(`«${ver}» no tiene enlaces pochos`, pochos.length === 0, pochos.join(' | '))
  if (ver === 'resumen') check('  …y sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Las cuatro cifras caben, con una colección cara ──')
for (const ancho of [360, 390, 430, 768, 1280]) {
  const { page } = await abrir('resumen', ancho)
  // Desde la 748 las cifras son la de la cartera y TRES fichas (la C1 de
  // su maqueta). Lo que se mide es lo mismo: que nada se sale ni se corta,
  // con la cifra larga que rompía.
  const m = await page.evaluate(() => {
    const cifra = document.querySelector('#mcValorCaja .mc-cartera-cifra')
    const fichas = document.querySelector('.mc-cartera-fichas')
    return {
      desborda: document.documentElement.scrollWidth > innerWidth + 1 || fichas.scrollWidth > fichas.clientWidth + 2,
      filas: new Set([...fichas.children].map((c) => Math.round(c.getBoundingClientRect().top))).size,
      cortadas: [cifra, ...fichas.querySelectorAll('li')].filter((d) => d.scrollWidth > d.clientWidth + 1 || d.getBoundingClientRect().right > innerWidth).map((d) => d.textContent),
      cifra: cifra.textContent,
    }
  })
  check(`en ${ancho} px no se sale`, !m.desborda, JSON.stringify(m))
  check(`  …ni se corta ninguna cifra`, m.cortadas.length === 0 && /6\.240,00/.test(m.cifra), m.cortadas.join(' | ') + ' ' + m.cifra)
  check('  …y las tres fichas van en una fila', m.filas === 1, String(m.filas))
  await page.close()
}

console.log('\n── 3. «Solo los que tengo» de la Pokédex es una chapa Y FILTRA ──')
{
  // Una prueba que mire si se pone `activo` no prueba lo que hace (la
  // lección de la 313): se cuentan las especies.
  const { page } = await abrir('pokedex')
  const chapa = page.locator('#mcPdxSoloMios')
  check('es un botón y no una casilla', (await chapa.evaluate((n) => n.tagName)) === 'BUTTON')
  const cuantas = () => page.locator('.pdx-especie').count()
  // Desde la 748 la Pokédex abre por REGIONES (la C3 de su maqueta), y la
  // que se abre es Kanto: 151.
  check('salen las 151 de Kanto', (await cuantas()) === 151, String(await cuantas()))
  await chapa.scrollIntoViewIfNeeded()
  await chapa.click()
  await page.waitForTimeout(900)
  check('  …y con la chapa puesta solo las cuatro que tengo', (await cuantas()) === 4, String(await cuantas()))
  check('  …marcada como pulsada', (await chapa.getAttribute('aria-pressed')) === 'true')
  await chapa.click()
  await page.waitForTimeout(900)
  check('  …y al apagarla vuelven todas', (await cuantas()) === 151, String(await cuantas()))
  await page.close()
}

console.log('\n── 4. Y el separador que no separaba de nada ──')
{
  // La raya y los 32 px de aire del bloque de Cambios venían de cuando
  // vivía debajo de otra cosa. Con su propia pantalla, separaba de la nada
  // y lo que se veía era una línea flotando bajo la barra.
  const { page } = await abrir('cambios')
  const m = await page.locator('.mc-bloque-cambios').evaluate((n) => ({
    borde: getComputedStyle(n).borderTopWidth,
    margen: getComputedStyle(n).marginTop,
  }))
  check('el bloque de Cambios ya no lleva raya encima', m.borde === '0px', JSON.stringify(m))
  check('  …ni el hueco que la acompañaba', parseInt(m.margen, 10) === 0, JSON.stringify(m))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
