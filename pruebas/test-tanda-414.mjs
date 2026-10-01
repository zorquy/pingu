// Tanda 414 — la Pokédex: el anillo y las generaciones.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { porGeneraciones } from '/home/user/pingu/js/mi-coleccion/pokedex.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

console.log('\n── 1. Las generaciones, con datos a mano ──')
{
  const f = (dex, tengo = 0) => ({ dex, nombre: 'X', tengo, total: 3 })
  const g = porGeneraciones([f(1, 1), f(151), f(152), f(906), f(1025)])
  check('cada uno cae en la suya', g.map((x) => x.filas.length).join() === '2,1,2', g.map((x) => `${x.nombre}:${x.filas.length}`).join(' | '))
  check('  …y sin rótulos vacíos', g.length === 3, String(g.length))
  // LA FORMA DEL FALLO: el día que salga la décima generación, una lista
  // de rangos CERRADOS dejaría a los nuevos fuera de todos los grupos y
  // desaparecerían de la pantalla sin dar error. La última no tiene final.
  const futuro = porGeneraciones([f(1200)])
  check('un número que todavía no existe no se pierde', futuro.length === 1 && futuro[0].filas.length === 1,
    JSON.stringify(futuro.map((x) => [x.nombre, x.filas.length])))
  check('  …y cae en la última', futuro[0].nombre === 'Novena generación', futuro[0]?.nombre)
}

console.log('\n── 2. En la pantalla ──')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP',
      market: 'WEST', card_count_official: 20, card_count_total: 25, release_date: '2023-03-31', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = ['Bulbasaur', 'Charizard', 'Pikachu'].map((n, i) => ({ id: 'sv1-' + i,
      set_id: 'sv1', local_id: String(i), name: n, image_path: 'x/' + i, market: 'WEST',
      rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: 'l' + i, card_id: c.id,
      cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=pokedex', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('sin errores', errores.length === 0, errores.join(' | '))

  const anillo = await page.locator('.mc-anillo').evaluate((e) => ({
    pct: e.style.getPropertyValue('--pct'),
    fondo: getComputedStyle(e).backgroundImage.slice(0, 30),
    etiqueta: e.getAttribute('aria-label'),
  }))
  check('el anillo está', Boolean(anillo.pct), JSON.stringify(anillo))
  check('  …y es un degradado cónico, no un dibujo', /conic/.test(anillo.fondo), anillo.fondo)
  // Un anillo sin texto no lo lee nadie que no lo vea.
  check('  …y dice lo que vale', /registrado/.test(anillo.etiqueta || ''), anillo.etiqueta)

  const rotulos = await page.locator('.pdx-generacion').allTextContents()
  check('hay rótulos de generación', rotulos.length >= 9, String(rotulos.length))
  check('  …y cada uno dice cuántos llevas', /Primera generación\s*3 de 151/.test(rotulos[0].replace(/\s+/g, ' ')),
    rotulos[0]?.replace(/\s+/g, ' '))

  // Con un buscador puesto, un rótulo encima de nada es ruido.
  await page.fill('#mcPdxBuscar', 'pikachu')
  await page.waitForTimeout(500)
  const tras = await page.locator('.pdx-generacion').allTextContents()
  check('al buscar, solo quedan los rótulos con algo debajo', tras.length === 1,
    tras.map((t) => t.replace(/\s+/g, ' ')).join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El anillo no se sale de su caja (tanda 424) ──')
{
  // Lo que pasaba: la caja de «Registrados» pide 84 px de texto + 12 de
  // hueco + 72 de anillo + 32 de relleno = 200, y la pista de la rejilla
  // mide 185 en cuanto caben DOS columnas. El anillo es `flex: 0 0 auto`
  // —un círculo que se encoge deja de ser un círculo—, así que no cedía:
  // se salía por el borde derecho. Y no daba error en ninguna parte.
  //
  // Se comprueba a VARIOS anchos y no en el que falló: el fallo no es «a
  // 430 px», es «en cuanto la pista se queda corta», y eso cambia con el
  // número de cajas y con el ancho del panel.
  for (const ancho of [360, 393, 430, 600, 900, 1280]) {
    const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
    await page.addInitScript(() => {
      window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP',
        market: 'WEST', card_count_official: 20, card_count_total: 25, release_date: '2023-03-31', logo_path: 'x/l' }]
      window.__FAKE_CARTAS__ = ['Bulbasaur', 'Charizard', 'Pikachu', 'Mew', 'Snorlax'].map((n, i) => ({
        id: 'sv1-' + i, set_id: 'sv1', local_id: String(i), name: n, image_path: 'x/' + i,
        market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
      // Repetidas, para que salgan también «el que más» y «el que menos»:
      // con las cuatro cajas la rejilla reparte más pistas, que es cuando
      // la de «Registrados» se queda sin sitio.
      window.__FAKE_COLECCION__ = [0, 0, 0, 1, 1, 2, 3, 4].map((c, i) => ({ id: 'l' + i,
        card_id: 'sv1-' + c, cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
    })
    await page.goto('http://localhost:8892/mi-coleccion.html?ver=pokedex', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2600)
    const r = await page.evaluate(() => {
      const caja = document.querySelector('.mc-pdx-principal')
      const anillo = caja?.querySelector('.mc-anillo')
      if (!caja || !anillo) return null
      const c = caja.getBoundingClientRect()
      const a = anillo.getBoundingClientRect()
      return {
        dentro: a.right <= c.right && a.left >= c.left && a.top >= c.top && a.bottom <= c.bottom,
        sobra: Math.round(c.right - a.right),
        desborda: caja.scrollWidth - caja.clientWidth,
        redondo: Math.round(a.width) === Math.round(a.height),
        pagina: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    check(`[${ancho}] el anillo cabe dentro de su caja`, r?.dentro, JSON.stringify(r))
    check(`  …y la caja no desborda por dentro`, r?.desborda === 0, JSON.stringify(r?.desborda))
    // Si alguien lo "arregla" encogiendo el anillo, deja de ser un círculo.
    check(`  …y sigue siendo redondo`, r?.redondo === true)
    check(`  …y la página no coge barra lateral`, r?.pagina <= 1, String(r?.pagina))
    await page.close()
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
