// Tanda 406 — el móvil con la cara de la app.
//
// PINGU pasó las cinco capturas de dextcg.com en el móvil: la barra de
// pestañas es una PÍLDORA pegada al fondo, y cada filtro es una chapa con
// su flechita en vez de un rectángulo gris de formulario.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ancho, alto, ruta = '/mi-coleccion.html', { dedo = false } = {}) => {
  // `dedo` enciende el puntero GRUESO. Hace falta porque la regla de los
  // 44 px (CLAUDE.md, tanda 312) no es «todo mide 44 siempre»: la barra de
  // arriba sí, pero los controles DENSOS —chips, pestañas, los filtros de
  // la estantería— piden sus 44 detrás de `pointer: coarse`, que es donde
  // se tocan con el dedo. Medirlos con un ratón y exigirles 44 es medir
  // otra cosa.
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, hasTouch: dedo, isMobile: dedo })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 108,
        card_count_total: 110, release_date: '2015-05-06', logo_path: 'x/logo', tcg_online_code: 'ROS' },
    ]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-104', set_id: 'sv1', local_id: '104', name: 'Rayquaza EX',
      image_path: 'x/1', market: 'WEST', rarity: 'Ultra Rare', category: 'Pokemon',
      illustrator: 'Ryo Ueda', types: ['Colorless'], dex_ids: [384], variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-104', cantidad: 1,
      idioma: 'es', estado: 'NM', variante: 'normal', notas: null }]
  })
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

console.log('\n── 1. En el móvil, la barra va pegada al fondo ──')
{
  const { page, errores } = await abrir(390, 800)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await page.evaluate(() => {
    const m = document.getElementById('mcMenu')
    const c = getComputedStyle(m)
    const r = m.getBoundingClientRect()
    return { pos: c.position, abajo: Math.round(innerHeight - r.bottom), alto: Math.round(r.height),
      sombra: c.boxShadow !== 'none', radio: c.borderTopLeftRadius }
  })
  check('la barra es fija', b.pos === 'fixed', b.pos)
  check('  …y está pegada al fondo', b.abajo >= 0 && b.abajo <= 16, b.abajo)
  check('  …y es una píldora con sombra', b.sombra && parseFloat(b.radio) >= 12, JSON.stringify(b))

  // Y lo de debajo no se queda tapado: el sitio de la barra se reserva.
  const hueco = await page.evaluate(() => {
    const m = document.querySelector('.mc-pagina')
    return parseFloat(getComputedStyle(m).paddingBottom)
  })
  check('la página reserva el sitio de la barra', hueco >= b.alto, `${hueco} para ${b.alto}`)
  await page.close()
}

console.log('\n── 2. La barra está SIEMPRE, y no tapa el pie ──')
{
  // La 406 apartaba la barra cuando el pie entraba en pantalla. La 418 lo
  // quitó: en una página CORTA el pie se ve desde el primer momento, así
  // que la barra nacía escondida y en el móvil no había forma de cambiar
  // de pestaña. Un menú que desaparece es peor que un menú que tapa.
  //
  // Lo que había que resolver —que la barra no se coma los enlaces del
  // pie— lo resuelve el pie reservando su sitio, sin piezas móviles.
  for (const [nombre, cuantas] of [['con la colección vacía', 0], ['con la colección llena', 30]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 840 } })
    await page.addInitScript((cu) => {
      window.__FAKE_SETS__ = [{ id: 'sv1', name: 'EP', market: 'WEST', card_count_total: 30,
        release_date: '2023-03-31', logo_path: 'x/l' }]
      window.__FAKE_CARTAS__ = Array.from({ length: 30 }, (_, i) => ({ id: 'sv1-' + (i + 1),
        set_id: 'sv1', local_id: String(i + 1), name: 'C' + i, image_path: 'x/' + i, market: 'WEST',
        rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
      window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, cu).map((c, i) => ({ id: 'l' + i,
        card_id: c.id, cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
    }, cuantas)
    await page.goto(BASE + '/mi-coleccion.html', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    check(`el menú está ${nombre}`, await page.locator('#mcMenu').isVisible())
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(700)
    const abajo = await page.evaluate(() => {
      const m = document.getElementById('mcMenu').getBoundingClientRect()
      const tapados = [...document.querySelectorAll('footer a')].filter((a) => {
        const r = a.getBoundingClientRect()
        return r.top < m.bottom && r.bottom > m.top && r.top < innerHeight && r.bottom > 0
      })
      return { opacidad: getComputedStyle(document.getElementById('mcMenu')).opacity, tapados: tapados.length }
    })
    check(`  …y sigue estando al final ${nombre}`, abajo.opacidad === '1', abajo.opacidad)
    // Y lo que había que proteger: ningún enlace del pie queda debajo.
    check(`  …sin tapar ningún enlace del pie ${nombre}`, abajo.tapados === 0, String(abajo.tapados))
    await page.close()
  }
}

console.log('\n── 4. Un filtro es una chapa, no un campo de formulario ──')
{
  const { page } = await abrir(1280, 900, '/mi-coleccion.html?ver=album')
  await page.waitForTimeout(600)
  const s = await page.locator('#mcEstanteriaSerie').evaluate((e) => {
    const c = getComputedStyle(e)
    return { radio: c.borderRadius, alto: e.getBoundingClientRect().height,
      flecha: c.backgroundImage.slice(0, 20) }
  })
  check('el desplegable de series es una píldora', parseFloat(s.radio) >= 20, s.radio)
  check('  …y conserva su flecha', /url/.test(s.flecha), s.flecha)
  await page.close()

  // Y los 44 px SE MIDEN CON EL DEDO, no con el ratón (tanda 447). Con
  // ratón este desplegable mide 36 desde la 445, que es cuando PINGU pidió
  // los filtros más pequeños —«son demasiado grandes y eso queda cutre»—;
  // la prueba seguía exigiéndole 44 en un portátil y marcaba en rojo un
  // cambio que se había pedido. Lo que la regla protege es el dedo, y ahí
  // los 44 siguen estando.
  const { page: movil } = await abrir(390, 800, '/mi-coleccion.html?ver=album', { dedo: true })
  await movil.waitForTimeout(600)
  const alto = await movil.locator('#mcEstanteriaSerie').evaluate((e) => e.getBoundingClientRect().height)
  check('  …y con el dedo mide sus 44', alto >= 44, alto)
  await movil.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
