import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 267: poner imágenes (y cartas) en una fila dentro de un artículo.
//
// Lo contó PINGU así: «el editor se vuelve loco, quiero hacer algo tan
// sencillo como poner cartas en fila de 3 y se vuelve loco, me dice que
// no se puede o se pone abajo en vez de en la fila».
//
// Las dos frases son el MISMO fallo, y sale de que varias imágenes
// pueden acabar dentro del mismo párrafo (pegadas de otra web, o subidas
// de golpe). El editor sólo sabía tratar «un párrafo con UNA imagen»:
//  - «Fila de 3» no encontraba nada que juntar → el aviso de que no se
//    puede, con las otras dos imágenes ahí mismo;
//  - y antes de avisar ya había sacado la elegida del párrafo, dejándola
//    DEBAJO de sus compañeras → «se pone abajo en vez de en la fila»;
//  - y pegar tres cartas las sacaba una a una, así que salían del revés
//    (3, 2, 1), cada una en su línea y sin juntarse.
//
// Estas pruebas trabajan contra rte-lab.html, que monta el editor a pelo:
// lo que se prueba es el editor, no la página de la guía.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

// Una imagen con forma de carta: más alta que ancha y de más de 200 px,
// que es lo que el editor mira para tratarla como carta.
const carta = (n) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#ccc"/><text x="90" y="190" font-size="90">${n}</text></svg>`
  )}`
const foto = (n) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#4a8"/><text x="20" y="60" font-size="40">${n}</text></svg>`
  )}`

const abrir = async (inicial = '') => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((h) => { window.__INICIAL__ = h }, inicial)
  await page.goto(`${BASE}/rte-lab.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__listo__)
  await page.waitForTimeout(500)
  return { page, errores }
}

// El orden en el que se ven las imágenes de la fila. Es lo único que hace
// falta comprobar y es lo que se rompía.
const filaSeguida = (page) =>
  page.evaluate(() => {
    const fila = document.querySelector('#sf .rt-fila')
    if (!fila) return null
    return {
      cols: fila.getAttribute('data-cols'),
      figuras: fila.querySelectorAll(':scope > figure').length,
      // El número pintado dentro de cada SVG: dice si van en orden.
      orden: [...fila.querySelectorAll(':scope > figure img')]
        .map((i) => decodeURIComponent(i.getAttribute('src')).match(/>(\d)</)?.[1])
        .join(''),
      // Que la rejilla sea de verdad de tres columnas, no sólo que lo ponga
      // el atributo: es lo que ve quien escribe.
      columnasReales: getComputedStyle(fila).gridTemplateColumns.split(' ').length,
    }
  })

const pintar = (page) =>
  page.evaluate(() => [...document.getElementById('sf').children].map((c) => c.tagName.toLowerCase() + (c.className ? '.' + c.className : '')).join(' '))

const pulsar = async (page, accion) => {
  await page.locator(`[data-bloque="${accion}"]`).click()
  await page.waitForTimeout(400)
}

const trocitos = (n) => [...Array(n)].map((_, i) => ({ name: `c${i}.png`, mimeType: 'image/png', buffer: Buffer.from([1]) }))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Tres imágenes en el MISMO párrafo, «Fila de 3» ──')
{
  // Así llega lo que se pega de otra web y lo que se sube de golpe.
  const { page, errores } = await abrir(`<p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p>`)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  const f = await filaSeguida(page)
  check('sin errores', errores.length === 0, errores[0] || '')
  check('se hace la fila', !!f, await pintar(page))
  check('con las tres dentro', f?.figuras === 3, String(f?.figuras))
  check('en su orden (1, 2, 3)', f?.orden === '123', String(f?.orden))
  check('y de tres columnas de verdad', f?.columnasReales === 3, String(f?.columnasReales))
  check('no queda ningún aviso de que no se puede', (await page.locator('.toast').count()) === 0)
  await page.close()
}

console.log('\n── 2. Fotos apaisadas subidas de golpe ──')
{
  // Las apaisadas no son cartas: no se agrupan solas, y para eso está el
  // botón. Antes acababan las tres en un párrafo y el botón no servía.
  const { page, errores } = await abrir()
  await page.locator('#sf').click()
  await page.evaluate((u) => { window.__URLS__ = u }, [foto(1), foto(2), foto(3)])
  await page.setInputFiles('.rte-image-input', trocitos(3))
  await page.waitForTimeout(1200)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  const f = await filaSeguida(page)
  check('sin errores', errores.length === 0, errores[0] || '')
  check('las tres fotos entran en la fila', f?.figuras === 3, String(f?.figuras))
  check('en su orden', f?.orden === '123', String(f?.orden))
  await page.close()
}

console.log('\n── 3. Pegar tres cartas: ni del revés ni sueltas ──')
{
  const { page, errores } = await abrir()
  await page.locator('#sf').click()
  await page.evaluate((urls) => {
    const sf = document.getElementById('sf')
    sf.focus()
    const r = document.createRange()
    r.selectNodeContents(sf.firstElementChild || sf)
    r.collapse(true)
    const s = getSelection()
    s.removeAllRanges()
    s.addRange(r)
    const dt = new DataTransfer()
    const html = urls.map((u) => `<img src="${u}">`).join('')
    dt.setData('text/html', html)
    sf.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    // El navegador de la prueba no pega solo desde un evento sintético: se
    // mete el HTML como lo haría él, y así se prueba lo que hace el editor
    // DESPUÉS, que es lo que se está arreglando.
    document.execCommand('insertHTML', false, html)
  }, [carta(1), carta(2), carta(3)])
  await page.waitForTimeout(1500)
  const f = await filaSeguida(page)
  check('sin errores', errores.length === 0, errores[0] || '')
  check('las tres se juntan solas', f?.figuras === 3, await pintar(page))
  check('y en el orden en que se pegaron', f?.orden === '123', String(f?.orden))
  await page.close()
}

console.log('\n── 4. Cuando de verdad no hay nada que juntar ──')
{
  // Una imagen con texto detrás: la fila no se hace (juntar cosas
  // separadas por texto movería el texto), se avisa... y NO se toca nada.
  const { page, errores } = await abrir(`<p><img src="${carta(1)}"></p><p>hola</p>`)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  // La foto se mira DESPUÉS de pincharla: pincharla le pone la clase de
  // «elegida», y eso ya cambia el HTML sin que nada se haya movido.
  const antes = await page.evaluate(() => document.getElementById('sf').innerHTML)
  await pulsar(page, 'fila-3')
  check('avisa una vez, no dos', (await page.locator('.toast').count()) === 1)
  check('no se hace ninguna fila', (await page.locator('#sf .rt-fila').count()) === 0)
  // Lo importante: la imagen se queda DONDE ESTABA. Antes se iba al final.
  check('y la imagen no se mueve de sitio',
    (await page.evaluate(() => document.getElementById('sf').innerHTML)) === antes)
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 5. Elegir la de en medio ──')
{
  // «Fila de 2» sobre la segunda de tres: la fila empieza en ella, y la
  // primera se queda fuera y ARRIBA. Antes la fila se plantaba antes del
  // párrafo entero y adelantaba a la primera.
  const { page, errores } = await abrir(`<p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p>`)
  await page.locator('#sf img').nth(1).click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-2')
  const f = await filaSeguida(page)
  check('la fila lleva la 2 y la 3', f?.orden === '23', String(f?.orden))
  check('con dos columnas', f?.cols === '2', String(f?.cols))
  const primeraFuera = await page.evaluate(() => {
    const fila = document.querySelector('#sf .rt-fila')
    const sueltas = [...document.querySelectorAll('#sf > figure img')]
    if (!fila || sueltas.length !== 1) return false
    return !!(fila.compareDocumentPosition(sueltas[0]) & Node.DOCUMENT_POSITION_PRECEDING)
  })
  check('y la primera se queda fuera y por delante', primeraFuera)
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 6. Después de hacer la fila se sigue escribiendo DEBAJO ──')
{
  const { page, errores } = await abrir(`<p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p>`)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  await page.keyboard.type('y aquí sigo')
  await page.waitForTimeout(300)
  const donde = await page.evaluate(() => {
    const fila = document.querySelector('#sf .rt-fila')
    const texto = [...document.querySelectorAll('#sf > p')].find((p) => p.textContent.includes('y aquí sigo'))
    if (!fila) return 'no hay fila'
    if (!texto) return 'no se ha escrito en ningún párrafo'
    return fila.compareDocumentPosition(texto) & Node.DOCUMENT_POSITION_FOLLOWING ? 'debajo' : 'encima'
  })
  check('lo que escribes va debajo de la fila', donde === 'debajo', donde)
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 7. Una carta más se suma a la fila sin descuadrarla ──')
{
  const { page, errores } = await abrir(`<p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p>`)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  await page.evaluate((u) => { window.__URLS__ = [u] }, carta(4))
  await page.setInputFiles('.rte-image-input', trocitos(1))
  await page.waitForTimeout(1200)
  const f = await filaSeguida(page)
  check('la cuarta entra en la fila', f?.figuras === 4, String(f?.figuras))
  check('en su sitio, la última', f?.orden === '1234', String(f?.orden))
  // Lo que se pidió fue una fila de TRES: añadir otra carta no puede
  // cambiar sola lo que ha elegido una persona.
  check('y la fila sigue siendo de 3 columnas', f?.cols === '3', String(f?.cols))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 8. La fila sobrevive a guardar y volver a abrir ──')
{
  const { page } = await abrir(`<p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p>`)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  const guardado = await page.evaluate(() => window.__html__)
  await page.close()
  check('lo guardado lleva la fila', /rt-fila/.test(guardado) && /data-cols="3"/.test(guardado), guardado.slice(0, 80))

  const { page: p2, errores } = await abrir(guardado)
  const f = await filaSeguida(p2)
  check('al reabrir sigue habiendo fila de 3', f?.figuras === 3 && f?.cols === '3', JSON.stringify(f))
  check('y en orden', f?.orden === '123', String(f?.orden))
  check('sin errores', errores.length === 0, errores[0] || '')
  await p2.close()
}

console.log('\n── 9. Dentro de un spoiler, la fila se queda dentro ──')
{
  const html = `<details><summary>Mira</summary><p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p></details>`
  const { page, errores } = await abrir(html)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  const dentro = await page.evaluate(() => !!document.querySelector('#sf details .rt-fila'))
  check('la fila no se sale del spoiler', dentro, await pintar(page))
  check('con las tres', (await filaSeguida(page))?.orden === '123')
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 10. Sacar de la fila y deshacer ──')
{
  const { page, errores } = await abrir(`<p>${[1, 2, 3].map((n) => `<img src="${carta(n)}">`).join('')}</p>`)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-3')
  const conFila = await page.evaluate(() => window.__html__)
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-no')
  check('«Sacar de la fila» la deshace', (await page.locator('#sf .rt-fila').count()) === 0)
  check('y deja las tres imágenes', (await page.locator('#sf > figure img').count()) === 3)
  await page.locator('#sf').click()
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  check('Ctrl+Z devuelve la fila', (await page.evaluate(() => window.__html__)) === conFila)
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 11. Una imagen metida en una frase no se lleva la frase ──')
{
  // Hay guías que usan una imagen dentro de un párrafo con texto. Al
  // hacerla fila con la de abajo, la imagen sale del párrafo, pero el
  // TEXTO se queda donde estaba: llevárselo por delante sería borrar lo
  // escrito sin que nadie lo haya pedido.
  const { page, errores } = await abrir(
    `<p>mira esta carta <img src="${carta(1)}"></p><p><img src="${carta(2)}"></p>`
  )
  await page.locator('#sf img').first().click()
  await page.waitForTimeout(200)
  await pulsar(page, 'fila-2')
  check('el texto sigue en la guía', await page.evaluate(() => document.getElementById('sf').textContent.includes('mira esta carta')),
    await page.evaluate(() => document.getElementById('sf').textContent.trim().slice(0, 40)))
  const f = await filaSeguida(page)
  check('y la fila se hace igual', f?.orden === '12', String(f?.orden))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
