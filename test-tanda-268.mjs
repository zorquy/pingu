import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 268: una imagen es una PIEZA, no un párrafo.
//
// La 267 arregló el «me dice que no se puede», pero PINGU volvió: «sigue
// yendo fatal». Y tenía razón: el fallo gordo no estaba en el botón de la
// fila, sino en que una <figure> era, para el navegador, un bloque de
// texto más. Con la fila ya hecha, el editor seguía portándose fatal:
//
//   - Backspace al principio del párrafo de debajo se llevaba por delante
//     EL PÁRRAFO ENTERO. Escribías debajo de tus cartas, tocabas Backspace
//     y el texto desaparecía.
//   - Ctrl+A y escribir encima dejaba la guía DENTRO de una <figure>, con
//     letras perdidas y cambiadas de orden.
//   - Pinchar en el hueco entre dos cartas y escribir: lo escrito se
//     perdía sin dejar rastro.
//   - Las flechas ↑ ↓ con una carta de la fila elegida no hacían nada:
//     ordenar las cartas de una fila era imposible.
//   - Quitar una carta de una fila de tres dejaba el hueco.
//
// Las listas de cartas y los vídeos YA eran `contenteditable="false"`
// desde que se hicieron, y por eso se portaban bien. Esto trata las
// imágenes igual, que es lo que hacen Medium, Notion y WordPress: la
// pieza no se pisa con el cursor y lo único editable de dentro es el pie.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const fila = (n = 3) =>
  `<div class="rt-fila" data-cols="${n}">${[...Array(n)]
    .map((_, i) => `<figure class="rt-fig rt-fig-c rt-fig-carta"><img src="/fotos/carta${i + 1}.svg"></figure>`)
    .join('')}</div>`

const abrir = async (inicial) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((h) => { window.__INICIAL__ = h }, inicial)
  await page.goto(`${BASE}/rte-lab.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__listo__)
  await page.waitForTimeout(800)
  return { page, errores }
}

const texto = (page) => page.evaluate(() => document.getElementById('sf').textContent.replace(/\s+/g, ' ').trim())
const orden = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#sf .rt-fila > figure img')]
      .map((i) => (i.getAttribute('src') || '').match(/carta(\d)/)?.[1])
      .join('')
  )
const cols = (page) => page.evaluate(() => document.querySelector('#sf .rt-fila')?.getAttribute('data-cols') ?? null)
const hayFila = (page) => page.locator('#sf .rt-fila').count()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las piezas no se pueden pisar con el cursor ──')
{
  const { page, errores } = await abrir(`${fila()}<p>texto</p>`)
  const marcadas = await page.evaluate(() => ({
    filas: [...document.querySelectorAll('#sf .rt-fila')].every((f) => f.getAttribute('contenteditable') === 'false'),
    figuras: [...document.querySelectorAll('#sf figure')].every((f) => f.getAttribute('contenteditable') === 'false'),
  }))
  check('la fila es una pieza', marcadas.filas)
  check('cada figura es una pieza', marcadas.figuras)
  // Y no puede acabar en la guía guardada: no está en la lista blanca.
  await page.locator('#sf p').last().click()
  await page.keyboard.type('.')
  await page.waitForTimeout(400)
  const guardado = await page.evaluate(() => window.__html__)
  check('pero eso NO se guarda con la guía', !/contenteditable/i.test(guardado))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 2. Backspace debajo de la fila ya no se come el texto ──')
{
  const { page, errores } = await abrir(`${fila()}<p>texto de después</p>`)
  await page.locator('#sf p').first().click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(350)
  check('el texto sigue ahí', (await texto(page)).includes('texto de después'), await texto(page))
  check('y la fila también', (await hayFila(page)) === 1)
  // Elegida queda: la barra la enseña, y el segundo Backspace sí la quita.
  check('la primera pulsación elige la fila', (await page.locator('#sf .rt-fila img.rt-sel').count()) === 1)
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(350)
  check('la segunda sí la quita', (await hayFila(page)) === 0)
  check('sin llevarse el texto', (await texto(page)).includes('texto de después'), await texto(page))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 3. Supr encima de la fila: el mismo trato, al revés ──')
{
  const { page, errores } = await abrir(`<p>texto de antes</p>${fila()}`)
  await page.locator('#sf p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(350)
  check('el texto sigue ahí', (await texto(page)).includes('texto de antes'))
  check('la fila sigue ahí', (await hayFila(page)) === 1)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(350)
  check('la segunda vez se quita', (await hayFila(page)) === 0)
  check('y el texto se queda', (await texto(page)).includes('texto de antes'), await texto(page))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 4. Seleccionar todo y escribir encima ──')
{
  // Dejaba la guía entera DENTRO de una figura, y con las letras
  // desordenadas («odo fuerat» al escribir «todo fuera»).
  const { page, errores } = await abrir(`${fila()}<p>lo de antes</p>`)
  await page.locator('#sf').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('todo fuera')
  await page.waitForTimeout(500)
  check('lo escrito sale entero y en orden', (await texto(page)) === 'todo fuera', await texto(page))
  check('y no queda dentro de una figura', (await page.locator('#sf figure').count()) === 0)
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 5. Borrarlo todo deja un párrafo, no una figura ──')
{
  const { page, errores } = await abrir(`${fila()}`)
  await page.locator('#sf').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(400)
  const primero = await page.evaluate(() => document.getElementById('sf').firstElementChild?.tagName)
  check('queda un párrafo vacío', primero === 'P', String(primero))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 6. Pinchar en el hueco entre dos cartas y escribir ──')
{
  const { page, errores } = await abrir(`${fila()}<p>abajo</p>`)
  const f1 = await page.locator('#sf .rt-fila figure').nth(0).boundingBox()
  const f2 = await page.locator('#sf .rt-fila figure').nth(1).boundingBox()
  await page.mouse.click((f1.x + f1.width + f2.x) / 2, f1.y + f1.height * 0.8)
  await page.waitForTimeout(250)
  await page.keyboard.type('HOLA')
  await page.waitForTimeout(400)
  check('lo escrito no se pierde', (await texto(page)).includes('HOLA'), await texto(page))
  check('y la fila sigue entera', (await orden(page)) === '123', await orden(page))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 7. Ordenar las cartas de la fila con las flechas ──')
{
  const { page, errores } = await abrir(`${fila()}<p>abajo</p>`)
  await page.locator('#sf .rt-fila img').nth(1).click()
  await page.waitForTimeout(250)
  check('las flechas dicen lo que hacen dentro de una fila',
    (await page.locator('[data-bloque="subir"]').textContent()) === '←')
  await page.locator('[data-bloque="subir"]').click()
  await page.waitForTimeout(350)
  check('la segunda carta pasa a ser la primera', (await orden(page)) === '213', await orden(page))
  await page.locator('[data-bloque="bajar"]').click()
  await page.waitForTimeout(350)
  check('y vuelve a su sitio', (await orden(page)) === '123', await orden(page))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 8. En el borde, la carta sale de la fila ──')
{
  const { page, errores } = await abrir(`${fila()}<p>abajo</p>`)
  await page.locator('#sf .rt-fila img').nth(0).click()
  await page.waitForTimeout(250)
  await page.locator('[data-bloque="subir"]').click()
  await page.waitForTimeout(400)
  check('la primera se sale por delante', (await orden(page)) === '23', await orden(page))
  const fuera = await page.evaluate(() => document.getElementById('sf').firstElementChild?.tagName)
  check('y queda por encima de la fila', fuera === 'FIGURE', String(fuera))
  check('la fila se ajusta a dos columnas', (await cols(page)) === '2', String(await cols(page)))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 9. Quitar una carta no deja el hueco ──')
{
  const { page, errores } = await abrir(`${fila()}<p>abajo</p>`)
  await page.locator('#sf .rt-fila img').nth(1).click()
  await page.waitForTimeout(250)
  await page.locator('[data-bloque="borrar"]').click()
  await page.waitForTimeout(400)
  check('quedan las otras dos', (await orden(page)) === '13', await orden(page))
  check('en una fila de dos, sin hueco', (await cols(page)) === '2', String(await cols(page)))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 10. El pie de foto sigue siendo lo único que se escribe dentro ──')
{
  const { page, errores } = await abrir(`${fila()}<p>abajo</p>`)
  await page.locator('#sf .rt-fila img').nth(0).click()
  await page.waitForTimeout(250)
  await page.locator('[data-bloque="pie"]').click()
  await page.waitForTimeout(300)
  await page.keyboard.type('Charizard ex')
  await page.waitForTimeout(400)
  const pie = await page.locator('#sf .rt-fila figcaption').first().textContent()
  check('el pie se escribe', pie === 'Charizard ex', String(pie))
  const guardado = await page.evaluate(() => window.__html__)
  check('y se guarda', guardado.includes('<figcaption>Charizard ex</figcaption>'))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 11. Un artículo que empieza por una imagen no es un callejón ──')
{
  // Sin sitio donde poner el cursor por encima, la entradilla no se podía
  // escribir. Pinchando en la mitad de ARRIBA de la pieza, el cursor va
  // delante; en la de abajo, detrás.
  const { page, errores } = await abrir(`${fila()}`)
  const caja = await page.locator('#sf .rt-fila').boundingBox()
  await page.mouse.click(caja.x + caja.width - 5, caja.y + 3)
  await page.waitForTimeout(250)
  await page.keyboard.type('entradilla')
  await page.waitForTimeout(400)
  const primero = await page.evaluate(() => document.getElementById('sf').firstElementChild?.textContent.trim())
  check('se puede escribir por encima', primero === 'entradilla', String(primero))
  check('y la fila sigue debajo', (await orden(page)) === '123', await orden(page))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 12. Un artículo que TERMINA en imagen tampoco ──')
{
  const { page, errores } = await abrir(`<p>arriba</p>${fila()}`)
  const ultimo = await page.evaluate(() => document.getElementById('sf').lastElementChild?.tagName)
  check('siempre queda un párrafo detrás para seguir', ultimo === 'P', String(ultimo))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 13. Una figura sin imagen dentro no es una figura ──')
{
  // La red de seguridad: una <figure> con texto y sin imagen es texto
  // metido en una caja que no le toca. Llega así de guías viejas y de
  // pegar trozos de otras páginas, y como pieza sería un trozo de
  // artículo que no se puede ni tocar ni escribir.
  const { page, errores } = await abrir('<figure>esto era texto</figure><p>y esto un párrafo</p>')
  const primero = await page.evaluate(() => document.getElementById('sf').firstElementChild?.tagName)
  check('se convierte en párrafo', primero === 'P', String(primero))
  check('sin perder lo que había dentro', (await texto(page)).includes('esto era texto'), await texto(page))
  check('y no queda ninguna figura suelta', (await page.locator('#sf figure').count()) === 0)
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
