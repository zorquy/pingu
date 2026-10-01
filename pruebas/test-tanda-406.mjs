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

const abrir = async (ancho, alto, ruta = '/mi-coleccion.html') => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
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

console.log('\n── 2. La barra se aparta cuando llega el pie ──')
{
  // Un menú flotando encima de los enlaces del pie es un menú que
  // estorba, y además esos enlaces son los que recorre Google.
  const { page } = await abrir(390, 800)
  const tapa = () => page.evaluate(() => {
    const m = document.getElementById('mcMenu').getBoundingClientRect()
    const p = document.querySelector('footer').getBoundingClientRect()
    const visible = getComputedStyle(document.getElementById('mcMenu')).opacity !== '0'
    return visible && m.bottom > p.top && m.top < p.bottom
  })
  check('de entrada la barra se ve',
    (await page.locator('#mcMenu').evaluate((e) => getComputedStyle(e).opacity)) === '1')
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(700)
  check('al llegar al pie, no lo tapa', (await tapa()) === false)
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(700)
  check('  …y al subir vuelve',
    (await page.locator('#mcMenu').evaluate((e) => getComputedStyle(e).opacity)) === '1')
  await page.close()
}

console.log('\n── 3. En el ordenador NO flota: es la columna ──')
{
  // La clase de apartarse se pone igual (el observador no mira el ancho),
  // así que su regla tiene que vivir SOLO en el `@media` del móvil: si se
  // escapara, la columna del ordenador desaparecería al llegar al pie.
  const { page } = await abrir(1280, 900)
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(700)
  const r = await page.evaluate(() => {
    const m = document.getElementById('mcMenu')
    const c = getComputedStyle(m)
    return { pos: c.position, opacidad: c.opacity, clase: m.classList.contains('apartada') }
  })
  check('la columna no es fija', r.pos === 'sticky', r.pos)
  check('  …y sigue viéndose aunque se le ponga la clase', r.opacidad === '1',
    `${r.opacidad} (clase puesta: ${r.clase})`)
  await page.close()
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
  // Y sigue siendo pulsable: la forma no se come los 44 px.
  check('  …y mide sus 44', s.alto >= 44, s.alto)
  check('  …y conserva su flecha', /url/.test(s.flecha), s.flecha)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
