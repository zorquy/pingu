// Tanda 373 — cada rareza, su brillo.
//
// PINGU, enseñando HoloNook: «cada rareza, su brillo». La 368 le puso al
// escaneo un giro en 3D con UN destello, el mismo para todas — así que
// una común relucía igual que una hiperrara. Para un coleccionista eso
// no se perdona: el brillo ES la rareza.
//
// Seis familias y no trece (una por rareza): lo que distingue una lámina
// de otra en la mano es el PATRÓN —barras, polvo de estrellas, arcoíris,
// purpurina dorada— y hay cuatro o cinco de verdad. Trece efectos serían
// trece que mantener y ninguno reconocible.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = 'http://localhost:8892'

console.log('\n── 1. Qué brillo le toca a cada rareza ──')
{
  const { familiaDeBrillo, RAREZAS_ES } = await import('/home/user/pingu/js/carta-nucleo.js')

  // Una COMÚN no brilla. `null` es una respuesta, no un olvido: darle un
  // brillo suave sería mentir sobre lo que tienes en la mano.
  for (const r of ['Common', 'Uncommon', 'Rare', 'Promo']) {
    check(`«${r}» no brilla`, familiaDeBrillo(r) === null, String(familiaDeBrillo(r)))
  }
  check('una holo clásica lleva barras', familiaDeBrillo('Rare Holo') === 'holo')
  check('una ultra rara, polvo de estrellas', familiaDeBrillo('Ultra Rare') === 'cosmos')
  check('una radiante, el estallido', familiaDeBrillo('Radiant Rare') === 'radiante')
  check('una ilustración especial, el arcoíris', familiaDeBrillo('Special illustration rare') === 'arcoiris')
  check('y una hiperrara, purpurina dorada', familiaDeBrillo('Hyper rare') === 'dorada')
  check('sin rareza, ninguno', familiaDeBrillo(null) === null && familiaDeBrillo('') === null)

  // El catálogo lo mantiene gente y aparecen variantes. Una rareza NUEVA
  // que diga «Hyper» tiene que brillar desde el día uno, no cuando
  // alguien se acuerde de meterla en la tabla.
  check('una rareza que no está en la tabla se adivina por palabras',
    familiaDeBrillo('Hyper Rare Gold') === 'dorada' && familiaDeBrillo('Rare Shiny Holo') === 'radiante',
    `${familiaDeBrillo('Hyper Rare Gold')} / ${familiaDeBrillo('Rare Shiny Holo')}`)
  check('  …y sin distinguir mayúsculas', familiaDeBrillo('rare holo') === 'holo')
  // Pero no se inventa: algo que no suena a nada no brilla.
  check('  …sin inventarse un brillo', familiaDeBrillo('Cromo de la abuela') === null,
    String(familiaDeBrillo('Cromo de la abuela')))

  // Todas las rarezas del catálogo tienen respuesta: ninguna se queda
  // sin decidir por descuido. (Que la respuesta sea `null` vale.)
  const sinDecidir = Object.keys(RAREZAS_ES).filter((r) => familiaDeBrillo(r) === undefined)
  check('ninguna rareza del catálogo se queda sin decidir', sinDecidir.length === 0, sinDecidir.join(', '))
}

console.log('\n── 2. Cada familia tiene su lámina en el CSS ──')
{
  const css = leer('css/carta.css')
  for (const fam of ['holo', 'cosmos', 'radiante', 'arcoiris', 'dorada', 'acespec']) {
    check(`«${fam}» está pintada`, new RegExp(`data-brillo='${fam}'`).test(css))
  }
  // Y la que NO tiene familia no lleva lámina: es la mitad del asunto.
  check('sin familia no se pinta ninguna', /:not\(\[data-brillo\]\)[^{]*\{[^}]*display: none/.test(css))
  // Lo de siempre: lo que anima se apaga con «menos movimiento».
  check('y todo sigue apagándose con «menos movimiento»',
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,700}carta-scan-holo/.test(css))
}

const browser = await chromium.launch()
const CARTA = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825"><rect width="600" height="825" rx="30" fill="#e9ce6a"/><rect x="40" y="90" width="520" height="380" fill="#8fc7e8"/></svg>`

async function abrir(rareza) {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.addInitScript((rz) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI' }]
    window.__FAKE_CARTAS__ = [{
      id: 'sv1-25', set_id: 'sv1', local_id: '25', name: 'Pikachu', name_es: 'Pikachu',
      image_path: 'sv/sv01/25', market: 'WEST', category: 'Pokémon', hp: 60, types: ['Rayo'], rarity: rz,
    }]
  }, rareza)
  await page.goto(`${BASE}/carta?id=sv1-25`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

console.log('\n── 3. En la página, y con el ratón encima ──')
{
  // La familia va en el HTML y no la pone el JavaScript del giro: así la
  // lleva también la página que pinta la función del borde, y está desde
  // el primer pintado aunque el resto no llegue.
  const nucleo = leer('js/carta-nucleo.js')
  check('la familia se escribe en el HTML', /data-brillo="\$\{brillo\}"/.test(nucleo))

  const { page, errores } = await abrir('Hyper rare')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const caja = page.locator('.carta-scan-holo')
  check('la carta lleva su familia', (await caja.getAttribute('data-brillo')) === 'dorada',
    await caja.getAttribute('data-brillo'))

  // Y la lámina se VE de verdad: que el atributo esté no prueba que se
  // pinte. Se mide la opacidad calculada de la capa antes y después de
  // pasar el ratón (la lección de la 313).
  const opacidad = () => caja.evaluate((e) => Number(getComputedStyle(e, '::before').opacity))
  const quieta = await opacidad()
  const r = await caja.boundingBox()
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.3)
  await page.waitForTimeout(600)
  const movida = await opacidad()
  check('la lámina está apagada en reposo', quieta < 0.1, String(quieta))
  check('  …y se enciende al pasar el ratón', movida > 0.5, `${quieta} → ${movida}`)
  await page.close()
}

console.log('\n── 4. Dos rarezas no se ven igual ──')
{
  // Es LO QUE SE PIDIÓ: que una común no reluzca como una hiperrara. Se
  // compara el fondo calculado de la lámina de cada una.
  const fondoDe = async (rareza) => {
    const { page } = await abrir(rareza)
    const caja = page.locator('.carta-scan-holo')
    const r = await caja.boundingBox()
    await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.3)
    await page.waitForTimeout(400)
    const f = await caja.evaluate((e) => getComputedStyle(e, '::before').backgroundImage)
    await page.close()
    return f
  }
  const dorada = await fondoDe('Hyper rare')
  const cosmos = await fondoDe('Ultra Rare')
  const radiante = await fondoDe('Radiant Rare')
  check('la dorada y la de polvo de estrellas no se parecen', dorada !== cosmos, `${dorada.slice(0, 40)} vs ${cosmos.slice(0, 40)}`)
  check('  …ni la radiante a ninguna de las dos', radiante !== dorada && radiante !== cosmos)
  // La dorada es ORO, no arcoíris: una hiperrara no es multicolor, y
  // pintarla de colores sería otra carta.
  check('  …y la dorada no lleva arcoíris', !/rgb\(0, 235, 160\)|rgb\(170, 60, 255\)/.test(dorada), dorada.slice(0, 80))
}

console.log('\n── 5. Una común no brilla en pantalla ──')
{
  const { page } = await abrir('Common')
  const caja = page.locator('.carta-scan-holo')
  check('no lleva familia', (await caja.getAttribute('data-brillo')) === null)
  const r = await caja.boundingBox()
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.3)
  await page.waitForTimeout(500)
  // Sigue inclinándose —eso es de la 368 y vale para todas— pero sin
  // lámina.
  check('  …pero se sigue inclinando', /rotate/.test((await caja.getAttribute('style')) || '') ||
    /--holo-rx/.test((await caja.getAttribute('style')) || ''), await caja.getAttribute('style'))
  const capa = await caja.evaluate((e) => getComputedStyle(e, '::before').display)
  check('  …y sin lámina', capa === 'none', capa)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
