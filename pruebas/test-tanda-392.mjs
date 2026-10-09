// Tanda 392 — la colección enseña la CARTA, y la ficha va en un diálogo.
//
// PINGU, enseñando la app de Dex: «me gusta más cómo lo hacen ellos
// porque es solo la imagen, y cuando le clicas te sale un pop-up con
// toda la información».
//
// Lo que esta prueba mira y no supone:
//   · Que la casilla NO vuelve a llenarse de texto. Es lo que se pidió y
//     es lo que se deshace solo: cada tanda que quiera enseñar un dato
//     más lo pondrá aquí si nadie lo impide.
//   · Que lo que sí queda es lo que la ilustración NO dice: cuántas
//     tienes y qué variante es, y la variante solo cuando no es normal.
//   · Que la casilla RESERVA SU HUECO aunque no llegue la imagen. Es el
//     fallo que salió al hacerlo: sin escaneo el botón medía cero
//     píxeles, o sea invisible y sin poder pulsarse — una carta perdida.
//   · Y que la ficha ENTERA sigue siendo una página. El diálogo es el
//     atajo de dentro de tu colección, no su sustituto: la página es la
//     que indexa Google y la que se comparte.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

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
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async ({ conImagen = true } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript((hay) => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', market: 'WEST',
      card_count_official: 4, card_count_total: 4, release_date: '2023-03-31' }]
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({
      id: `sv1-${n}`, set_id: 'sv1', local_id: String(n), name: `Carta ${n}`,
      image_path: hay ? `x/${n}` : null, market: 'WEST', variants: { normal: true, reverse: true },
      // La primera va SIN ilustrador ni rareza a propósito: es el caso de
      // «no se sabe», que no puede pintarse como una raya.
      ...(n === 1 ? {} : { illustrator: 'Mitsuhiro Arita', rarity: 'Rare', types: ['Water'] }),
    }))
    window.__FAKE_COLECCION__ = [1, 2, 3, 4].map((n) => ({
      id: `l${n}`, card_id: `sv1-${n}`, cantidad: n === 2 ? 3 : 1,
      idioma: 'es', estado: 'nueva', variante: n === 3 ? 'reverse' : 'normal', gradeo: null,
    }))
  }, conImagen)
  // `?ver=cartas` desde la tanda 447, y NO es un detalle de la prueba: la
  // pestaña por defecto es el PANEL desde la 440, y lo que esta prueba
  // mira vive en la pestaña de CARTAS. Sin el parámetro, el panel de
  // cartas está `hidden` y Playwright encuentra los elementos —existen en
  // el DOM— pero no son visibles: la prueba se cae con un «element is not
  // visible» que parece un fallo de la web y es una prueba que se quedó
  // vieja. Buscar un elemento NO es lo mismo que verlo.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('\n── 1. La casilla es la carta ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las cuatro', (await page.locator('.mc-carta').count()) === 4)

  // Lo que se quitó, y que no puede volver por descuido.
  for (const [clase, que] of [
    ['.mc-carta-nombre', 'el nombre'],
    ['.mc-carta-set', 'el set'],
    ['.mc-carta-valor', 'el precio'],
    ['.mc-carta-acciones', 'los botones'],
  ]) {
    check(`  ya no lleva ${que}`, (await page.locator(clase).count()) === 0)
  }

  // Y lo que sí: la cantidad solo si hay más de una, la variante solo si
  // no es la normal. Un «×1» y un «Normal» en cada casilla serían dos
  // etiquetas que no distinguen nada — justo el ruido que se quitó.
  check('la cantidad sale solo donde hay más de una',
    (await page.locator('.mc-cantidad').count()) === 1,
    await page.locator('.mc-cantidad').first().textContent())
  check('  …y dice cuántas', (await page.locator('.mc-cantidad').first().textContent())?.includes('3'))
  // LA VERSIÓN SALE SIEMPRE DESDE LA 461, y es un cambio a propósito:
  // PINGU, con Dex delante, «en Dex tienen todos una chapita». Esta tanda
  // la escondía en la normal para no meter ruido, pero entonces la normal
  // se lee como «no se sabe» y no como «esta es la normal» — que es justo
  // la diferencia que hace falta cuando dos casillas llevan la misma
  // imagen. Lo que esta tanda defiende sigue en pie: que la etiqueta la
  // diga para quien no ve la carta (ahí abajo).
  const chapas = await page.locator('#mcCartas .mc-chapa-variante').allTextContents()
  // Desde la 781 (SI9) la normal no lleva «N»: la llevaban todas y tapaba las que distinguen.
  check('cada carta que no es la normal lleva su chapa de versión', chapas.length >= 1 && !chapas.some((c) => c.startsWith('NNormal')),
    chapas.join(' | '))
  check('  …y una de ellas es la reverse', chapas.some((c) => /Reverse/.test(c)), chapas.join(' | '))

  // Quien no ve la carta se queda sin TODO lo que se ha quitado, así que
  // la etiqueta del botón tiene que decirlo.
  const etiqueta = await page.locator('.mc-carta-foto').nth(1).getAttribute('aria-label')
  check('la etiqueta dice qué es, de dónde y cuántas',
    /Carta 2/.test(etiqueta) && /Scarlet/.test(etiqueta) && /3 copias/.test(etiqueta), etiqueta)
  await page.close()
}

console.log('\n── 2. El hueco está aunque no llegue la imagen ──')
{
  // El fallo que salió al hacerlo: la cadena de respaldo acaba
  // ESCONDIENDO el escaneo cuando ninguna CDN contesta (tanda 321), y el
  // botón se quedaba en cero píxeles. Con el texto debajo no se notaba
  // porque la casilla tenía alto por otro lado.
  const { page } = await abrir({ conImagen: false })
  const caja = await page.locator('.mc-carta-foto').first().boundingBox()
  check('la casilla mide algo sin imagen', (caja?.height || 0) > 100, JSON.stringify(caja))
  check('  …y se puede pulsar', (caja?.width || 0) >= 44 && (caja?.height || 0) >= 44)
  // Y dentro, el nombre: un hueco gris sin nada no dice qué carta es.
  check('  …y dice de qué carta es',
    (await page.locator('.mc-carta-sinfoto').count()) > 0 ||
      /Carta/.test((await page.locator('.mc-carta-foto').first().textContent()) || ''))
  await page.close()
}

console.log('\n── 3. La ficha, en un diálogo ──')
{
  const { page, errores } = await abrir()
  check('el diálogo empieza cerrado', (await page.locator('#mcEditor[open]').count()) === 0)
  await page.locator('.mc-carta-foto').nth(1).click()
  await page.waitForTimeout(600)
  check('pulsar la carta lo abre', (await page.locator('#mcEditor[open]').count()) === 1)

  // Lo que se quitó de la casilla tiene que estar AQUÍ, o se ha perdido.
  const texto = (await page.locator('#mcEditor').textContent())?.replace(/\s+/g, ' ') || ''
  check('con el nombre de la carta', /Carta 2/.test(texto), texto.slice(0, 120))
  check('con su set', /Scarlet/.test(texto))
  check('con el precio', /Cardmarket|precio/i.test(texto))
  check('y con los campos para editarla', (await page.locator('#mcEdCantidad').count()) === 1)

  // La página de la ficha sigue existiendo: es la que se comparte y la
  // que indexa Google. El diálogo es un atajo, no su sustituto.
  const ficha = await page.locator('#mcEdFicha').getAttribute('href')
  check('y la salida a la ficha entera', /^\/carta\//.test(ficha || ''), ficha)
  check('sin errores', errores.length === 0, errores.join(' | '))

  // ── La ficha, con la carta de protagonista (tanda 393) ──
  // PINGU: «es muy pocho, se abre en una esquina y es horrible; debería
  // verse la carta en grande porque es la protagonista».
  const caja = await page.locator('#mcEditor').boundingBox()
  const foto = await page.locator('#mcEdFoto').boundingBox()
  check('la ventana ocupa de verdad', (caja?.width || 0) >= 900, `${Math.round(caja?.width || 0)}px`)
  // Un diálogo sin `margin: auto` se queda arriba a la izquierda, que es
  // justo lo que PINGU llamó «se abre en una esquina».
  const ancho = await page.evaluate(() => window.innerWidth)
  const centro = (caja?.x || 0) + (caja?.width || 0) / 2
  check('  …y está centrada', Math.abs(centro - ancho / 2) < 4,
    `centro en ${Math.round(centro)} de ${ancho / 2}`)
  check('la carta se ve GRANDE', (foto?.width || 0) >= 300, `${Math.round(foto?.width || 0)}px`)
  // Y cabe entera: con el alto topado, los botones de guardar se salían
  // de la pantalla en un portátil.
  // Contra el alto DE VERDAD de la ventana, no contra un número escrito
  // a mano: la primera versión comparaba con 900 mientras esta prueba
  // abre a 1000, así que decía que no cabía algo que cabía de sobra.
  const alto = await page.evaluate(() => window.innerHeight)
  check('  …y la ventana cabe en la pantalla', (caja?.height || 0) <= alto - 40,
    `${Math.round(caja?.height || 0)} de ${alto}`)

  // La tabla de datos no es adorno: la rareza, la energía y el ilustrador
  // son por lo que se filtra, y verlos aquí enseña qué se puede pedir.
  const tabla = (await page.locator('#mcEdTabla').textContent())?.replace(/\s+/g, ' ') || ''
  check('la tabla trae los datos de la carta',
    /Rareza/.test(tabla) && /Ilustrador/.test(tabla) && /Número/.test(tabla), tabla.slice(0, 120))
  await page.close()
}

console.log('\n── 4. Lo que no se sabe no se pinta ──')
{
  // Una fila con una raya ocupa lo mismo que el dato y no dice nada; y
  // además miente sobre lo que el catálogo tiene (la regla de los tres
  // estados, tanda 319). Estas cartas van sin ilustrador ni rareza.
  const { page } = await abrir()
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(600)
  const tabla = (await page.locator('#mcEdTabla').textContent())?.replace(/\s+/g, ' ') || ''
  check('sin ilustrador, no sale la fila del ilustrador', !/Ilustrador/.test(tabla), tabla.slice(0, 120))
  check('  …pero sí lo que sí se sabe', /Número/.test(tabla), tabla.slice(0, 120))
  await page.close()
}

console.log('\n── 5. El holo, la imagen grande y salir pulsando fuera (tanda 394) ──')
{
  // PINGU: «no estás abriendo la imagen completa, estás abriendo la
  // miniatura», «debería hacer el efecto holográfico como en la ficha» y
  // «también debería poder cerrarse pulsando fuera».
  const { page, errores } = await abrir()
  const carta = page.locator('.mc-carta-foto').first()

  // El MISMO envoltorio y el MISMO data-brillo que /carta: si fueran
  // otros, el día que alguien toque el efecto arreglaría una pantalla y
  // dejaría la otra a medias.
  check('la casilla es un escaneo de los que se mueven',
    /carta-scan-holo/.test((await carta.getAttribute('class')) || ''), await carta.getAttribute('class'))

  // Y el efecto se monta al PASAR por encima, no al pintar: con
  // trescientas cartas, montarlo en todas serían trescientos juegos de
  // escuchas para las dos o tres por las que vas a pasar.
  // Por la LISTA de clases y no por una expresión: `\bholo\b` casa
  // dentro de `carta-scan-holo`, porque el guion no es carácter de
  // palabra. Es la trampa de la 312 otra vez — lo que CONTIENE la cadena
  // cuenta, no solo lo que ES.
  const montado = () => carta.evaluate((e) => e.classList.contains('holo'))
  check('  …y no está montado antes de pasar por encima', (await montado()) === false)
  await carta.hover()
  await page.waitForTimeout(500)
  check('  …y se monta al pasar el ratón', (await montado()) === true)

  await carta.click()
  await page.waitForTimeout(700)
  check('la ficha también trae el escaneo que se mueve',
    (await page.locator('#mcEdFoto .carta-scan-holo').count()) === 1)

  // Pulsar FUERA cierra. Un <dialog> no lo hace solo.
  check('la ficha está abierta', (await page.locator('#mcEditor[open]').count()) === 1)
  await page.mouse.click(30, 30)
  await page.waitForTimeout(400)
  check('pulsar fuera la cierra', (await page.locator('#mcEditor[open]').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 6. La imagen de la ficha es la GRANDE ──')
{
  // Se reutilizaba la miniatura de la rejilla: a 380 px de ancho, una
  // imagen pensada para 140 se ve borrosa, y la carta es justo lo que
  // has venido a mirar. Se prueba en Node porque la CDN está bloqueada.
  const { cadenaDeEscaneo } = await import('/home/user/pingu/js/escaneo-carta.js')
  const c = { id: 'sv1-115', image_path: 'sv/sv1/115' }
  const baja = String(cadenaDeEscaneo(c))
  const alta = String(cadenaDeEscaneo(c, null, 'high'))
  check('hay dos calidades y no son la misma', baja !== alta)
  check('  …y la grande es «high»', /high/.test(alta) && !/high/.test(baja), alta.slice(0, 80))
  // Y que la ficha pida la grande, que es lo que se olvidó.
  const js = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  const abre = js.slice(js.indexOf('mcEdFoto'))
  check('la ficha pide la grande', /cadenaDeEscaneo\(c, null, 'high'\)/.test(js))
  check('  …y la rejilla sigue con la pequeña', /const escaneo = atributosDeEscaneo\(cadenaDeEscaneo\(c\)\)/.test(js))
}

console.log('\n── 7. Se guarda solo, y el cero la quita (tanda 397) ──')
{
  // PINGU: «que no tengas botón de guardar o cancelar o quitar; según
  // haces el cambio, que se guarde».
  const { page, errores } = await abrir()
  await page.locator('.mc-carta-foto').nth(1).click()
  await page.waitForTimeout(600)
  check('ya no hay botones de guardar ni cancelar',
    (await page.locator('#mcEdBorrar, #mcEdCancelar').count()) === 0)
  check('  …ni un submit en el formulario',
    (await page.locator('#mcEditorForm button[type="submit"]').count()) === 0)

  // Subir una copia se guarda sin tocar nada más.
  const antes = Number(await page.locator('#mcEdCantidad').inputValue())
  // El de COPIAS: «Para cambio» tiene el suyo (376) y casa con el mismo selector.
  await desplegarCopia(page)
  await page.locator('.mc-contador:has(#mcEdCantidad) .mc-contador-btn[data-paso="1"]').click()
  await page.waitForTimeout(900)
  check('el contador suma', Number(await page.locator('#mcEdCantidad').inputValue()) === antes + 1)
  check('  …y lo dice', /Guardado/.test((await page.locator('#mcEdEstadoGuardado').textContent()) || ''))
  // Y de verdad, no solo en la pantalla: se cierra y se vuelve a abrir.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('.mc-carta-foto').nth(1).click()
  await page.waitForTimeout(600)
  check('  …y se ha guardado de verdad',
    Number(await page.locator('#mcEdCantidad').inputValue()) === antes + 1,
    await page.locator('#mcEdCantidad').inputValue())

  // El «−» tiene que poder llegar a cero: el mínimo del campo es 0 y
  // `Number(min) || 1` lo convertía en 1, así que la última copia no se
  // podía quitar. El 0 es falsy y ese `||` se lo comía.
  const min = await page.locator('#mcEdCantidad').getAttribute('min')
  check('el mínimo del campo es cero', min === '0', min)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 8. El número de copias se lee en los DOS temas ──')
{
  // PINGU: «el número de copias no se ve en el fondo oscuro». El mando
  // lleva fondo propio y el campo heredaba el color que tocara.
  for (const tema of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
    await page.addInitScript((t) => {
      try { localStorage.setItem('theme', t) } catch {}
      addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', t))
      window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST', card_count_official: 2, card_count_total: 2, release_date: '2023-01-01' }]
      window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'A', image_path: 'x/1', market: 'WEST', variants: { normal: true } }]
      window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-1', cantidad: 1, idioma: 'es', estado: 'nueva', variante: 'normal' }]
    }, tema)
    await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.locator('.mc-carta-foto').first().click()
    await page.waitForTimeout(600)
    const r = await page.locator('#mcEdCantidad').evaluate((i) => {
      const L = (c) => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((n) => {
          const v = Number(n) / 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const letra = getComputedStyle(i).color
      const fondo = getComputedStyle(i.closest('.mc-contador-mando')).backgroundColor
      const [x, y] = [L(letra), L(fondo)].sort((a, b) => b - a)
      return { letra, fondo, contraste: (x + 0.05) / (y + 0.05) }
    })
    check(`en tema ${tema} el número se lee`, r.contraste >= 4.5, `${r.contraste.toFixed(2)} (${r.letra} sobre ${r.fondo})`)
    await page.close()
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
