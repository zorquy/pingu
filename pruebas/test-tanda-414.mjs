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

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
