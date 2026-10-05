// Tanda 563 — la ficha de una carta: versiones, gradeo, cambio y precio.
//
// Cuatro cosas que PINGU pidió sobre la misma pantalla:
//
//  1. «De esas, doy» se llama ahora «Para cambio» y se pone con los dos
//     botones, como las copias.
//  2. El gradeo son DOS desplegables —la casa y la nota— y la nota depende
//     de la casa: PSA va en enteros (con un solo 1.5), Beckett de medio en
//     medio. Ofrecer un «PSA 9.5» sería ofrecer una nota que no existe.
//  3. El desplegable de versión enseña las de ESA carta: «este Lapras solo
//     tiene la holográfica; no debería salir primera edición».
//  4. Y el precio dice de quién es. Cardmarket publica una cifra por
//     producto con todos los idiomas juntos, así que no es el español ni
//     el inglés — y un número sin decir de qué es se lee como el tuyo.
//
// Lo PURO (las escalas, componer y volver a leer el texto guardado) se
// prueba en Node al final, sin navegador.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { CASAS, OTRA, notasDeCasa, escribirGradeo, leerGradeo } from '/home/user/pingu/js/mi-coleccion/gradeo.js'

// Desde la 645 los campos de «Tu copia» arrancan PLEGADOS detrás de
// «Editar»: antes de tocar uno hay que desplegarlos (leerlos no hace falta).
async function desplegarCopia(page) {
  const b = page.locator('#mcEdEditar')
  if ((await b.count()) && (await b.isVisible()) && (await b.getAttribute('aria-expanded')) !== 'true') {
    await b.click()
    await page.waitForTimeout(150)
  }
}


let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: 3, card_count_total: 3, logo_path: 'x/l' }]
  window.__FAKE_CARTAS__ = [
    // El Lapras del caso: SOLO holo. Es la carta de la que PINGU dijo que
    // el desplegable le ofrecía primera edición sin tenerla.
    { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Lapras', name_es: 'Lapras', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { holo: true } },
    // Una con dos, para que se vea que no es «siempre una».
    { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Pikachu ex', name_es: 'Pikachu ex', image_path: 'x/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true, reverse: true } },
    // Y una SIN engordar: `variants` a null es «no se sabe», que no es lo
    // mismo que «solo normal» — ahí se ofrecen todas (variantes.js).
    { id: 'sv8-3', market: 'WEST', set_id: 'sv8', local_id: '3', name: 'Snorlax', name_es: 'Snorlax', image_path: 'x/3', rarity: 'Rare', category: 'Pokemon', variants: null },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'holo', gradeo: 'PSA 10', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
    // Gradeo de los de antes, escrito a mano y sin forma reconocible. No
    // se puede tirar ni «corregir»: es lo que alguien apuntó.
    { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'grado 9 propio', created_at: '2026-10-03T10:00:00Z' },
  ]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
// Con precio de verdad: sin cifras el renglón sobra, y entonces la quinta
// sección no estaría probando nada y saldría verde igual (la del 307).
await page.route('**/api.tcgdex.net/**', (r) =>
  r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ id: 'sv8-1', pricing: { cardmarket: { idProduct: 769304, low: 3.19, trend: 7.61, avg30: 7, updated: '2026-10-03' } } }),
  })
)
await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3200)

// Abre la ficha de una carta de la colección por su nombre.
async function abrir(nombre) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Lo que se pulsa es el botón de la foto, y es ÉL quien lleva el
  // `aria-label` con el nombre: `.mc-carta` es el envoltorio y no dice
  // de quién es (la casilla es la carta, tanda 392).
  const n = await page.locator('#mcCartas .mc-carta-foto').count()
  if (!n) return false
  for (let i = 0; i < n; i++) {
    const el = page.locator('#mcCartas .mc-carta-foto').nth(i)
    if (((await el.getAttribute('aria-label')) || '').includes(nombre)) {
      await el.click()
      await page.waitForTimeout(900)
      return true
    }
  }
  return false
}

console.log('── 1. «Para cambio», con sus dos botones ──')
{
  const abierta = await abrir('Lapras')
  check('se abre la ficha de Lapras', abierta === true)
  const etiqueta = await page.evaluate(() => document.getElementById('mcEdCambio')?.closest('label')?.textContent?.trim())
  check('el campo se llama «Para cambio»', /^Para cambio/.test(etiqueta || ''), etiqueta)
  check('  …y ya no dice «De esas, doy»', !/De esas/.test(etiqueta || ''), etiqueta)
  // Los dos botones son del SUYO y no del de copias: con el id escrito a
  // pelo, los de abajo movían el contador de arriba.
  const antesCopias = await page.inputValue('#mcEdCantidad')
  await desplegarCopia(page)
  await page.locator('#mcEdCambio').locator('xpath=../button[@data-paso="1"]').click()
  await page.waitForTimeout(400)
  check('el «+» de cambio sube el cambio', (await page.inputValue('#mcEdCambio')) === '1', await page.inputValue('#mcEdCambio'))
  check('  …y no toca las copias', (await page.inputValue('#mcEdCantidad')) === antesCopias, `${antesCopias} → ${await page.inputValue('#mcEdCantidad')}`)
}

console.log('── 2. El gradeo: la casa y su escala ──')
{
  const casa = await page.inputValue('#mcEdGradeoCasa')
  check('lee la casa de lo que había guardado', casa === 'PSA', casa)
  check('  …y la nota', (await page.inputValue('#mcEdGradeoNota')) === '10', await page.inputValue('#mcEdGradeoNota'))
  const notasPSA = await page.$$eval('#mcEdGradeoNota option', (os) => os.map((o) => o.value))
  check('PSA no ofrece medias notas salvo el 1.5', !notasPSA.some((n) => /\.5$/.test(n) && n !== '1.5'), notasPSA.join(','))
  check('  …y sí ofrece el 1.5', notasPSA.includes('1.5'))
  await desplegarCopia(page)
  await page.selectOption('#mcEdGradeoCasa', 'BGS')
  await page.waitForTimeout(500)
  const notasBGS = await page.$$eval('#mcEdGradeoNota option', (os) => os.map((o) => o.value))
  check('Beckett sí va de medio en medio', notasBGS.includes('9.5') && notasBGS.includes('8.5'), notasBGS.slice(0, 6).join(','))
  check('  …y al cambiar de casa la nota se vacía', (await page.inputValue('#mcEdGradeoNota')) === '', await page.inputValue('#mcEdGradeoNota'))
  // Lo que importa: que no se quede un «BGS 10» inventado de un «PSA 10».
  const chapas = await page.locator('#mcEdChapas').innerText()
  check('  …y la chapa no inventa un gradeo', !/BGS 10\b/.test(chapas), chapas.replace(/\n/g, ' '))
  await desplegarCopia(page)
  await page.selectOption('#mcEdGradeoNota', '9.5')
  await page.waitForTimeout(700)
  check('al elegir la nota, la chapa dice «BGS 9.5»', /BGS 9\.5/.test(await page.locator('#mcEdChapas').innerText()), await page.locator('#mcEdChapas').innerText())
}

console.log('── 3. La versión, la de ESA carta ──')
{
  const vs = await page.$$eval('#mcEdVariante option', (os) => os.map((o) => o.value))
  check('el Lapras solo ofrece la holo', vs.join(',') === 'holo', vs.join(','))
  check('  …y no ofrece la primera edición', !vs.includes('primera'), vs.join(','))
  await abrir('Pikachu')
  const vs2 = await page.$$eval('#mcEdVariante option', (os) => os.map((o) => o.value))
  check('el Pikachu ofrece sus dos', vs2.join(',') === 'normal,reverse', vs2.join(','))
  await abrir('Snorlax')
  const vs3 = await page.$$eval('#mcEdVariante option', (os) => os.map((o) => o.value))
  check('y la que no se sabe ofrece todas', vs3.length === 4, vs3.join(','))
}

console.log('── 4. Un gradeo viejo no se toca ──')
{
  // Snorlax es la del `grado 9 propio`. Lo escrito a mano vuelve tal cual
  // y en «Otra»: un `<select>` que no encuentra su valor se queda con la
  // primera opción y al guardar escribe ESA (la lección de la 472).
  await desplegarCopia(page)
  check('la casa es «Otra»', (await page.inputValue('#mcEdGradeoCasa')) === OTRA, await page.inputValue('#mcEdGradeoCasa'))
  check('  …con el texto intacto', (await page.inputValue('#mcEdGradeo')) === 'grado 9 propio', await page.inputValue('#mcEdGradeo'))
  check('  …y el campo libre a la vista', (await page.isVisible('#mcEdGradeo')) === true)
  check('  …sin el desplegable de notas', (await page.isVisible('#mcEdGradeoNota')) === false)
}

console.log('── 5. El precio dice de quién es ──')
{
  await abrir('Lapras')
  // Desde la 589 es el bloque de js/precio-vista.js: la cifra y, debajo,
  // de qué es. Sin cifras no hay renglón; con ellas y sin mínimo del
  // idioma, dice «cualquier idioma», y el botón de Cardmarket va con el tuyo.
  const pie = await page.locator('#mcEdPrecioBloque .pv-de').innerText().catch(() => '')
  const precio = await page.locator('#mcEdPrecioBloque .pv-cifra').innerText()
  if (/Sin precio/.test(precio)) check('sin cifras, no se matiza nada', pie.trim() === '', pie)
  else {
    check('dice que es el de cualquier idioma', /cualquier idioma/i.test(pie), pie)
    check('  …y manda a Cardmarket para el tuyo', (await page.locator('#mcEdPrecioBloque .btn-cardmarket').count()) === 1)
  }
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()

console.log('── 6. Las escalas, en Node ──')
{
  // Las escalas no son la misma con otro nombre, y es justo lo que hace
  // que una nota de otra casa sea una nota que no existe.
  check('PSA: enteros y un solo 1.5', notasDeCasa('PSA').filter((n) => /\.5$/.test(n)).join(',') === '1.5', notasDeCasa('PSA').join(','))
  check('BGS: de medio en medio hasta el 1', notasDeCasa('BGS').includes('9.5') && notasDeCasa('BGS').includes('1') && !notasDeCasa('BGS').includes('0.5'))
  check('CGC: baja hasta el 0.5', notasDeCasa('CGC').includes('0.5'))
  check('cada casa tiene su lista', new Set(CASAS.map((c) => c.notas.join('|'))).size > 1)
  // Ninguna lista puede saltarse un escalón: se generan, no se escriben.
  for (const c of CASAS) {
    const nums = c.notas.filter((n) => /^\d/.test(n) && !/ /.test(n)).map(Number)
    const huecos = nums.slice(1).filter((n, i) => Math.abs(nums[i] - n - 0.5) > 1e-9 && Math.abs(nums[i] - n - 1) > 1e-9)
    check(`  ${c.id}: sin saltos raros`, huecos.length === 0, huecos.join(','))
  }
  // Y el viaje de ida y vuelta, que es de lo que depende no pisar un dato.
  for (const [casa, nota] of [['PSA', '10'], ['BGS', '9.5'], ['CGC', '10 Perfect'], ['SGC', '1'], ['ACE', '8.5']]) {
    const txt = escribirGradeo(casa, nota)
    const leido = leerGradeo(txt)
    check(`  ${txt} va y vuelve`, leido.casa === casa && leido.nota === nota, JSON.stringify(leido))
    check(`    …y cabe en la columna`, txt.length <= 20, `${txt.length}`)
  }
  check('lo que no se entiende vuelve entero', leerGradeo('grado 9 propio').libre === 'grado 9 propio')
  check('  …y sin casa de verdad', leerGradeo('grado 9 propio').casa === OTRA)
  check('sin gradeo, no se guarda nada', escribirGradeo('', '') === null && escribirGradeo('PSA', '') === null)
  check('«Otra» guarda lo que se escriba', escribirGradeo(OTRA, '  lo mío  ') === 'lo mío')
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
