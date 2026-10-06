// Tanda 368 — el hueco de la portada, el mando del álbum, la carta en 3D
// y Cardmarket con su logo.
//
// Las cuatro las pidió PINGU mirando la web en el PC. La primera es la
// interesante: **una fila mide lo que mida su caja MÁS ALTA**, y el
// torneo (76 px) y la última noticia (300 y pico) compartían fila, así
// que debajo del torneo quedaba un agujero de 250 px. En el móvil no se
// veía porque ahí van apiladas — o sea que el fallo solo existía en la
// mitad de las pantallas, que es la peor clase de fallo.
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
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

// Una carta de mentira, para que haya algo que inclinar y algo que
// pintar en los bolsillos: las de verdad viven en una CDN que este
// entorno no alcanza.
const CARTA = (n = 25) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825" viewBox="0 0 600 825">
<rect width="600" height="825" rx="30" fill="#f7d354"/>
<circle cx="300" cy="280" r="120" fill="#ffe27a"/>
<text x="300" y="300" font-size="90" text-anchor="middle" fill="#8a6a20">${n}</text></svg>`

async function abrir(ruta, semillas = {}, opciones = {}) {
  const page = await browser.newPage({ viewport: opciones.viewport || { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) =>
    r.fulfill({ contentType: 'image/svg+xml', body: CARTA() })
  )
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion || 'admin-1'
    window.__FAKE_PERFIL__ = { is_admin: true }
    for (const [clave, valor] of Object.entries(s.tablas || {})) window[clave] = valor
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

console.log('\n── 1. La portada ya no tiene una fila que deje hueco ──')
{
  const html = leer('index.html')
  const css = leer('css/portada.css')
  // El nombre de clase ENTERO y entre comillas: buscar el trozo suelto
  // casaría con el comentario que explica por qué se fue (la trampa de
  // la 312, que ya ha picado dos veces).
  check('no queda la fila en el HTML', !/class="[^"]*\bportada-hoy\b/.test(html), (html.match(/class="[^"]*portada-hoy[^"]*"/) || [])[0])
  check('ni su rejilla en el CSS', !/^\.portada-hoy\s*\{/m.test(css))

  const { page, errores } = await abrir('/index.html', {
    tablas: {
      __FAKE_TORNEOS__: [{ id: 't1', slug: 'copa', name: 'La Copa', status: 'registration_open', format: 'standard', max_players: 32, start_at: new Date(Date.now() + 26 * 3600e3).toISOString() }],
      __FAKE_NOTICIAS__: [{ slug: 'n1', title: 'Una noticia', kind: 'news', published_at: new Date(Date.now() - 3600e3).toISOString() }],
    },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))

  // Lo que se quería: que debajo del torneo NO quede un claro. Se mide el
  // salto entre el final del torneo y el principio de lo siguiente en su
  // misma columna. Mirar si «existe la fila» no probaría nada: el hueco
  // lo dejaba la fila aunque la fila estuviera perfectamente puesta.
  const hueco = await page.evaluate(() => {
    const t = document.getElementById('torneoPortadaSeccion')
    if (!t) return null
    let s = t.nextElementSibling
    while (s && !s.getBoundingClientRect().height) s = s.nextElementSibling
    if (!s) return null
    return Math.round(s.getBoundingClientRect().top - t.getBoundingClientRect().bottom)
  })
  // 16 px es el `gap` de la columna. Con la fila vieja aquí salían 250 y
  // pico.
  check('debajo del torneo no queda un claro', hueco !== null && hueco <= 24, `${hueco} px`)

  // Y cada caja abre su columna: si el torneo cayera detrás de la guía
  // destacada, el hueco desaparecería… y también el motivo de tenerlo
  // arriba (la 362, con los números por delante).
  const orden = await page.evaluate(() => {
    const id = (x) => document.getElementById(x)
    const antes = (a, b) => Boolean(id(a).compareDocumentPosition(id(b)) & Node.DOCUMENT_POSITION_FOLLOWING)
    return {
      torneoAntesDeDestacada: antes('torneoPortadaSeccion', 'destacadaSeccion'),
      noticiaAntesDelReto: antes('noticiaPortadaSeccion', 'retoSeccion'),
      mismaColumna: id('torneoPortadaSeccion').parentElement === id('destacadaSeccion').parentElement,
      lateral: id('noticiaPortadaSeccion').parentElement === id('retoSeccion').parentElement,
    }
  })
  check('el torneo abre la columna ancha', orden.torneoAntesDeDestacada && orden.mismaColumna, JSON.stringify(orden))
  check('y la noticia, la lateral', orden.noticiaAntesDelReto && orden.lateral)
  await page.close()
}

console.log('\n── 2. Y en el móvil el orden NO ha cambiado ──')
{
  // Al mudar las cajas, el DOM las separa: el torneo abre una columna y
  // la noticia otra, que va detrás ENTERA. Sin los `order` del CSS la
  // noticia se caería a media página en el móvil — que es justo donde
  // PINGU dijo que se veía bien.
  const { page } = await abrir('/index.html', {
    tablas: {
      __FAKE_TORNEOS__: [{ id: 't1', slug: 'copa', name: 'La Copa', status: 'registration_open', format: 'standard', start_at: new Date(Date.now() + 26 * 3600e3).toISOString() }],
      __FAKE_NOTICIAS__: [{ slug: 'n1', title: 'Una noticia', kind: 'news', published_at: new Date(Date.now() - 3600e3).toISOString() }],
    },
  }, { viewport: { width: 390, height: 900 } })
  // Se mide dónde ACABAN pintadas, no el orden del documento: el `order`
  // de flex no mueve el DOM.
  //
  // Y solo lo que OCUPA sitio: una sección recogida (aquí, la guía
  // destacada, que en este fixture no tiene guías) mide 0 y está en la
  // coordenada 0, así que compararse con ella diría que todo va detrás.
  const y = await page.evaluate(() => {
    const donde = (x) => {
      const e = document.getElementById(x)
      const r = e?.getBoundingClientRect()
      return r && r.height ? Math.round(r.top) : null
    }
    return { torneo: donde('torneoPortadaSeccion'), noticia: donde('noticiaPortadaSeccion'), reto: donde('retoSeccion') }
  })
  check('el torneo sigue el primero', y.torneo !== null && y.torneo < y.noticia, JSON.stringify(y))
  check('y la noticia, justo detrás', y.noticia !== null && y.noticia < y.reto, JSON.stringify(y))
  await page.close()
}

console.log('\n── 3. El bolsillo del álbum: se abre Y se añade ──')
{
  const js = leer('js/mi-coleccion.js')
  // El interruptor global se fue: obligaba a elegir entre abrir la ficha
  // y añadir la carta.
  check('ya no hay interruptor de «tocar para añadir»', !/mcAlbumTocar/.test(js) && !/album\.tocar/.test(js))
  check('ni en el HTML', !/mcAlbumTocar/.test(leer('mi-coleccion.html')))
  // Un <button> dentro de un <a> no es HTML válido: el navegador lo
  // desmonta por su cuenta y el mando dejaría de funcionar sin dar error.
  // Hasta el CIERRE del enlace, no «en los 400 caracteres siguientes»:
  // esa ventana se come el `</a>` y marca como malo un botón que está
  // fuera. Es la misma trampa que ya picó en esta prueba, escrita otra
  // vez: una distancia no es una estructura.
  check('el bolsillo no mete botones dentro del enlace',
    !/<a class="mc-bolsillo[^"]*"[^>]*>(?:(?!<\/a>)[\s\S])*?<button/.test(js))

  const { page, errores } = await abrir('/mi-coleccion.html', {
    tablas: {
      __FAKE_SETS__: [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', card_count_total: 9, release_date: '2023-03-31', tcg_online_code: 'SVI' }],
      __FAKE_CARTAS__: Array.from({ length: 9 }, (_, i) => ({
        id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1),
        name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv01/${i + 1}`, market: 'WEST',
      })),
      __FAKE_COLECCION__: [{ id: 'c1', card_id: 'sv1-2', cantidad: 2 }],
    },
  })
  await page.locator('[data-pestania="album"]').click()
  await page.waitForTimeout(1600)
  // Desde la 372 la pestaña «Álbum» abre la ESTANTERÍA, no un
  // archivador: hay que entrar en una colección. La prueba se quedó
  // escrita contra el desplegable de antes.
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  // SIN MANDO desde la 565: la casilla es la carta, y las copias se suman
  // y se quitan desde la ficha, que se abre tocándola (como en Dex). Lo
  // ÚNICO que lleva desde la 657 es el «+» (`.mc-mas[data-anadir]`), que
  // PINGU pidió con TCGGO delante: abre el diálogo de añadir, no suma.
  check('ningún bolsillo lleva mando (salvo el «+» de la 657)', (await page.locator('.mc-bolsillo-mando, [data-quitar], [data-anadir]:not(.mc-mas)').count()) === 0,
    String(await page.locator('.mc-bolsillo-mando, [data-anadir], [data-quitar]').count()))
  // Y el bolsillo SIGUE llevando a la ficha: es la mitad que se perdía
  // con el interruptor puesto.
  check('y siguen llevando a su carta',
    /\/carta\//.test((await page.locator('.mc-bolsillo-enlace').first().getAttribute('href')) || ''),
    await page.locator('.mc-bolsillo-enlace').first().getAttribute('href'))

  const bolsillo = (n) => page.locator('.mc-bolsillo').nth(n - 1)
  const menosDeLaFicha = () => page.locator('#mcEdCantidad').locator('xpath=../button[@data-paso="-1"]')
  // Quitar la última copia pregunta: se contesta que sí.
  page.on('dialog', (d) => d.accept())

  // Una que no tienes: la casilla abre la ficha con «Añadir».
  await bolsillo(1).locator('.mc-bolsillo-enlace').click()
  await page.waitForTimeout(900)
  // Desde la 650 añadir es el «+» de debajo de la carta y su diálogo.
  check('tocar un bolsillo vacío abre la ficha para añadir',
    await page.evaluate(() => document.getElementById('mcEditor').open && !document.getElementById('mcEdAcciones').classList.contains('hidden') && document.getElementById('mcEdCopiaBloque').classList.contains('hidden')))
  await page.click('#mcEdMas')
  await page.waitForTimeout(400)
  if (await page.locator('#mcAdMas').isVisible()) { await page.click('#mcAdMas'); await page.waitForTimeout(200) }
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('al añadir, la carta pasa a «la tengo»', (await bolsillo(1).getAttribute('class'))?.includes('tengo'),
    await bolsillo(1).getAttribute('class'))
  check('  …y la ficha se queda abierta ya como tuya', (await page.inputValue('#mcEdCantidad')) === '1', await page.inputValue('#mcEdCantidad'))

  // Y el − de la ficha la quita (la última copia es quitarla).
  await desplegarCopia(page)
  await menosDeLaFicha().click()
  await page.waitForTimeout(1200)
  check('el − de la ficha la quita', !(await bolsillo(1).getAttribute('class'))?.includes('tengo'),
    await bolsillo(1).getAttribute('class'))

  // Con dos copias, el − baja a una en vez de borrar la línea entera.
  await bolsillo(2).locator('.mc-bolsillo-enlace').click()
  await page.waitForTimeout(900)
  check('la que tienes abre la ficha con sus copias', (await page.inputValue('#mcEdCantidad')) === '2', await page.inputValue('#mcEdCantidad'))
  await desplegarCopia(page)
  await menosDeLaFicha().click()
  await page.waitForTimeout(1200)
  check('con dos copias, el − deja una', (await page.inputValue('#mcEdCantidad')) === '1' && (await bolsillo(2).getAttribute('class'))?.includes('tengo'),
    await page.inputValue('#mcEdCantidad'))
  await page.close()
}

console.log('\n── 4. La carta que se mueve ──')
{
  const js = leer('js/carta-holo.js')
  // El bloque del holo salió a su propia hoja en la tanda 394: lo
  // cargan /carta, /cartas, /coleccion y /mi-coleccion, así que ya no
  // podía vivir dentro de `carta.css`.
  const css = leer('css/carta-holo.css')
  // Con «menos movimiento» puesto no se monta nada — y además el CSS lo
  // apaga por su cuenta, que es la norma de la casa: una cosa sin la
  // otra deja medio efecto vivo.
  check('el JavaScript mira «menos movimiento»', /prefers-reduced-motion: reduce/.test(js))
  check('y el CSS también lo apaga', /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,600}carta-scan-holo/.test(css))
  // Con el dedo no: el primer toque ya es el que abre el visor.
  check('solo con ratón', /\(hover: hover\) and \(pointer: fine\)/.test(js))
  check('  …y el dedo se descarta explícitamente', /pointerType === 'touch'/.test(js))
  // Una transformación crea un contexto nuevo y deja el `sticky` sin
  // efecto: por eso el giro va en una caja de dentro y no en el `figure`.
  // Contra el BLOQUE entero (`[^}]*`) y no contra los primeros 400
  // caracteres: con la ventana, meter un comentario dentro de la regla
  // empujaba el `transform` fuera y la prueba se ponía roja sin que el
  // CSS hubiera cambiado de comportamiento. Una prueba que se rompe al
  // comentar el código mide otra cosa distinta de la que dice medir.
  check('el giro NO va sobre el figure sticky',
    !/\.carta-scan\s*\{[^}]*transform:/.test(css) && /\.carta-scan-holo\.holo\s*\{[^}]*transform: perspective/.test(css))
  // Si la capa del brillo se come el clic, el visor deja de abrirse y no
  // da ningún error.
  check('el brillo no se come el clic', /carta-scan-holo\.holo::before,[\s\S]{0,400}pointer-events: none/.test(css))

  const { page, errores } = await abrir('/carta?id=sv1-25', {
    tablas: {
      __FAKE_SETS__: [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI' }],
      __FAKE_CARTAS__: [{ id: 'sv1-25', set_id: 'sv1', local_id: '25', name: 'Pikachu', name_es: 'Pikachu', image_path: 'sv/sv01/25', market: 'WEST', category: 'Pokémon', hp: 60, types: ['Rayo'] }],
    },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const caja = page.locator('.carta-scan-holo')
  check('la caja del efecto está montada', (await caja.getAttribute('class'))?.includes('holo'), await caja.getAttribute('class'))
  const r = await caja.boundingBox()
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.2)
  await page.waitForTimeout(400)
  const estilo = (await caja.getAttribute('style')) || ''
  check('  …y sigue al ratón', /--holo-rx:\s*-?\d/.test(estilo) && /--holo-ry:\s*-?\d/.test(estilo), estilo)
  // El ratón ARRIBA tiene que levantar el borde de abajo. Sin el signo,
  // la carta se mueve al revés que la mano.
  check('  …con el eje X al derecho', /--holo-rx:\s*[0-9]/.test(estilo), estilo)
  await page.close()
}

console.log('\n── 5. Cardmarket con su logo ──')
{
  const marca = leer('js/cardmarket-marca.js')
  // Dibujada, no traída: una imagen de un tercero deja el botón mudo el
  // día que ese tercero no contesta (la lección de la 321).
  check('la marca es un SVG propio', /<svg/.test(marca) && !/cardmarket\.com.*\.(png|svg|jpg)/.test(marca))
  // `currentColor` repintaría un logo ajeno con el tema de nuestra web.
  //
  // Sin los comentarios: el fichero EXPLICA que currentColor no vale, y
  // buscar la palabra a secas la encuentra ahí. Es la trampa de los
  // comentarios, que en este repo ya ha picado varias veces — al barrer
  // código en busca de una cadena, todo lo que la CONTIENE cuenta.
  const marcaSinComentarios = marca.replace(/\/\/[^\n]*/g, '')
  check('  …con SU color, no el nuestro',
    /#00256a/i.test(marcaSinComentarios) && !/currentColor/.test(marcaSinComentarios),
    (marcaSinComentarios.match(/currentColor/) || [])[0] || '')

  // La trampa de la 299, que aquí tiene dos mitades.
  //
  // Primera: el dibujo salió de `js/cardmarket.js` porque ese fichero lo
  // importa medio catálogo por los idiomas y los estados, y el barrido
  // sigue los IMPORTS, no las llamadas.
  check('cardmarket.js se queda sin HTML', !/<svg/.test(leer('js/cardmarket.js')))
  // Segunda (tanda 369): su CSS tiene hoja propia, porque la marca la
  // dibujan DOS páginas. Mientras estuvo en `carta.css`, /mi-coleccion
  // la enseñaba sin estilo — y eso no lo canta nadie.
  //
  // La regla, escrita como regla y no contra las dos páginas de hoy:
  // quien importe el dibujo tiene que cargar la hoja.
  const quienDibuja = ['carta', 'mi-coleccion']
  for (const pagina of quienDibuja) {
    check(`  …y ${pagina} carga css/cardmarket.css`,
      /href="\/css\/cardmarket\.css"/.test(leer(`${pagina}.html`)))
  }
  check('  …y la hoja existe y trae el botón', /\.btn-cardmarket\s*\{/.test(leer('css/cardmarket.css')))

  const { page, errores } = await abrir('/carta?id=sv1-25', {
    tablas: {
      __FAKE_SETS__: [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI' }],
      __FAKE_CARTAS__: [{ id: 'sv1-25', set_id: 'sv1', local_id: '25', name: 'Pikachu', name_es: 'Pikachu', image_path: 'sv/sv01/25', market: 'WEST', category: 'Pokémon', hp: 60, types: ['Rayo'] }],
    },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Desde la 645 la marca va UNA vez, en el botón: el bloque nuevo lleva su
  // propia cabecera «Cardmarket» y el logo de arriba lo decía dos veces.
  check('el bloque lleva la marca, en el botón', (await page.locator('.btn-cardmarket .cm-marca').count()) === 1 && (await page.locator('.cm-logo').count()) === 0)
  const boton = page.locator('.btn-cardmarket')
  check('y el botón es un botón de Cardmarket', (await boton.count()) === 1)
  check('  …con la marca dentro', (await boton.locator('.cm-marca').count()) === 1)
  check('  …y lleva a cardmarket.com', /cardmarket\.com/.test((await boton.getAttribute('href')) || ''),
    await boton.getAttribute('href'))
  // Lo que se pulsa mide 44 (norma de la casa).
  const alto = await boton.evaluate((e) => e.getBoundingClientRect().height)
  check('  …y se puede pulsar', alto >= 44, `${Math.round(alto)}px`)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
