// Tanda 407 — la carta que no estaba en el móvil.
//
// PINGU pasó las capturas de la ficha de Dex en el móvil: allí la carta
// es lo primero y lo más grande, y el nombre va centrado debajo. Al ir a
// comparar, la nuestra NO SALÍA: la caja de la carta medía cero.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const browser = await chromium.launch()

const abrirFicha = async (ancho, alto) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'XY Promos', market: 'WEST', card_count_official: 108,
      card_count_total: 110, release_date: '2016-05-18', logo_path: 'x/logo' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-104', set_id: 'sv1', local_id: 'XY122', name: 'Blastoise EX',
      image_path: 'x/1', market: 'WEST', rarity: 'Promo', category: 'Pokemon', illustrator: 'kawayoo',
      types: ['Water'], dex_ids: [9], variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-104', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', notas: null }]
  })
  // Desde la tanda 436 la pestaña que se abre sola es el Panel, así que
  // una ruta sin parámetros ya no entra en las cartas.
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=cartas', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(700)
  return { page, errores }
}

console.log('\n── 1. La carta se ve en CUALQUIER ancho ──')
{
  // LA FORMA DEL FALLO: un margen automático ANULA el estirado del hijo
  // de una rejilla, así que la caja se encogía a su contenido — y su
  // contenido mide el 100 % DE ELLA. La cuenta es circular y se resuelve
  // en cero: la carta desaparecía sin que nada diera error. Es la segunda
  // vez que pica el mismo margen (la primera, `.page-content` en la 313),
  // así que se comprueba en varios anchos y no solo en el que falló.
  for (const [w, h] of [[360, 780], [390, 820], [600, 900], [760, 900], [1280, 950]]) {
    const { page, errores } = await abrirFicha(w, h)
    const m = await page.evaluate(() => {
      const c = document.querySelector('.mc-ficha-carta').getBoundingClientRect()
      const f = document.querySelector('.mc-editor-foto').getBoundingClientRect()
      return { carta: Math.round(c.width), fotoW: Math.round(f.width), fotoH: Math.round(f.height) }
    })
    check(`a ${w} px la carta tiene caja`, m.carta > 100 && m.fotoW > 100 && m.fotoH > 100,
      JSON.stringify(m))
    if (w === 390) check('  …y sin errores', errores.length === 0, errores.join(' | '))
    await page.close()
  }
}

console.log('\n── 2. En el móvil, el nombre va centrado (encima de la carta desde la 669) ──')
{
  const { page } = await abrirFicha(390, 820)
  const r = await page.evaluate(() => {
    const t = document.querySelector('.mc-ficha-cabecera h2') /* la cabecera agrupada desde la 669 */
    const s = document.querySelector('.mc-ficha-set')
    return { h2: getComputedStyle(t).textAlign, set: getComputedStyle(s).textAlign,
      chapas: getComputedStyle(document.querySelector('.mc-ficha-chapas')).justifyContent }
  })
  check('el nombre, centrado', r.h2 === 'center', r.h2)
  check('  …y la colección también', r.set === 'center', r.set)
  check('  …y las chapas', r.chapas === 'center', r.chapas)
  await page.close()
}

console.log('\n── 3. En el ordenador NO: ahí la carta va al lado ──')
{
  const { page } = await abrirFicha(1280, 950)
  const r = await page.evaluate(() => {
    const c = document.querySelector('.mc-ficha-carta').getBoundingClientRect()
    const d = document.querySelector('.mc-ficha-datos').getBoundingClientRect()
    return { cartaDer: Math.round(c.right), datosIzq: Math.round(d.left),
      h2: getComputedStyle(document.querySelector('.mc-ficha-cabecera h2') /* la cabecera agrupada desde la 669 */).textAlign }
  })
  check('la carta está a la izquierda de los datos', r.cartaDer <= r.datosIzq + 1, JSON.stringify(r))
  check('  …y el nombre no se centra', r.h2 !== 'center', r.h2)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
