// Tanda 461 — la chapa de la versión, y la cabecera de una expansión.
//
// Tres cosas que PINGU pidió mirando Dex:
//
// 1) «Sale Weedle y Weedle, o sea, no pone la diferencia; cuando le doy a
//    separar variantes debería haber una tarjetita que ponga Holo o
//    Reverse». Y el rótulo EXISTÍA desde la 383… pintado en el flujo
//    normal, DEBAJO de `.mc-bolsillo-enlace`, que va a `inset: 0` y cubre
//    el bolsillo entero. O sea: estaba y nunca se vio. Por eso la prueba
//    no comprueba que el texto ESTÉ —eso ya pasaba— sino que se VE: que el
//    punto central de la chapa le toca a ella y no a lo que tiene encima.
//    Es la lección de la 447 llevada al píxel: encontrar un elemento no es
//    verlo.
//
// 2) «Las reverse son más oscuras porque tienen el holográfico en toda la
//    carta; igual meterle un filtro». El catálogo guarda UN escaneo por
//    carta, así que sin velo las dos casillas son la misma imagen.
//
// 3) «Fíjate en Dex: tiene unos botones arriba, el de seleccionar
//    múltiples cartas, el corazón y uno de compartir. Nosotros estamos
//    ocupando mucho con botones muy grandes». Los tres eran chapas con
//    texto en la fila de filtros.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// ── LOS MANDOS DE LA CABECERA VIVEN DETRÁS DEL ⋮ (tanda 475) ──
// Encontrar un elemento no es poder pulsarlo, así que hay que abrir el menú
// primero. Y se cierra solo al elegir, así que cada pulsación abre otra vez.
const porElMenu = async (page, sel) => {
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(250)
  await page.click(sel)
  await page.waitForTimeout(350)
}
const browser = await chromium.launch()
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

const abrir = async ({ ancho = 1280, ruta = '/mi-coleccion.html?ver=album' } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // Una captura con los datos a medias no es la pantalla (la 441).
  await page.route('**assets.tcgdex.net/**', (r) => r.fulfill({ path: SC + '/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 12, card_count_total: 12, logo_path: 'x/l', release_date: '2026-09-26', tcg_online_code: 'MEE' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: 'Bulbasaur ' + (i + 1), image_path: 'x/' + (i + 1), rarity: 'Common',
      category: 'Pokemon', types: ['Grass'], dex_ids: [1], variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z' },
      { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'reverse', created_at: '2026-09-02T00:00:00Z' },
      { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-09-03T00:00:00Z' },
    ]
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}
const abrirSet = async (page) => {
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1300)
}

console.log('\n── 1. La chapa de la versión SE VE, no solo existe ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await abrirSet(page)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(1000)
  const chapas = await page.locator('.mc-album-rejilla .mc-chapa-variante').allTextContents()
  check('cada casilla lleva su chapa', chapas.length === 24, String(chapas.length))
  check('  …y dicen cuál es cada una', chapas[0] === 'NNormal' && chapas[1] === 'RHReverse holo', chapas.slice(0, 2).join(' | '))
  // ESTO es lo que fallaba: el rótulo estaba pintado DEBAJO del enlace que
  // cubre el bolsillo entero. Un `textContent` lo encontraba igual.
  const tapadas = await page.locator('.mc-album-rejilla .mc-chapa-variante').evaluateAll((ns) =>
    ns.slice(0, 6).filter((n) => {
      const r = n.getBoundingClientRect()
      if (!r.width || !r.height) return true
      const antes = n.style.pointerEvents
      n.style.pointerEvents = 'auto'
      const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      n.style.pointerEvents = antes
      return !(encima === n || n.contains(encima))
    }).map((n) => n.textContent))
  check('ninguna chapa está tapada por lo de encima', tapadas.length === 0, tapadas.join(' | '))
  // Y no pisa al mando de copias, que vive en el mismo borde.
  const choca = await page.locator('.mc-album-rejilla .mc-bolsillo').first().evaluate((n) => {
    const c = n.querySelector('.mc-chapa-variante').getBoundingClientRect()
    // Sin mando de copias (se fue en la 565) no hay con qué chocar.
    const mando = n.querySelector('.mc-bolsillo-mando')
    if (!mando) return false
    const m = mando.getBoundingClientRect()
    return c.bottom > m.top + 1
  })
  check('  …ni se monta sobre el mando de copias', choca === false)
  await page.close()
}

console.log('\n── 2. El velo del reverse, solo en las reverse ──')
{
  const { page } = await abrir()
  await abrirSet(page)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(1000)
  const velos = await page.locator('.mc-album-rejilla .mc-bolsillo').evaluateAll((ns) =>
    ns.slice(0, 4).map((n) => ({
      cual: n.querySelector('.mc-chapa-variante')?.dataset.var,
      velo: Boolean(n.querySelector('.mc-velo-reverse')),
    })))
  check('la normal no lleva velo', velos[0].cual === 'normal' && velos[0].velo === false, JSON.stringify(velos[0]))
  check('la reverse sí', velos[1].cual === 'reverse' && velos[1].velo === true, JSON.stringify(velos[1]))
  // Y el velo no se come el clic: flota sobre el enlace del bolsillo.
  const pasa = await page.locator('.mc-velo-reverse').first().evaluate((n) => getComputedStyle(n).pointerEvents === 'none')
  check('  …y el velo no se come el clic', pasa === true)
  await page.close()
}

console.log('\n── 3. Y la misma chapa en «Cartas» ──')
{
  const { page } = await abrir({ ruta: '/mi-coleccion.html?ver=cartas' })
  const chapas = await page.locator('#mcCartas .mc-chapa-variante').allTextContents()
  check('las tres cartas llevan su chapa', chapas.length === 3, chapas.join(' | '))
  check('  …incluida la normal', chapas.includes('NNormal'), chapas.join(' | '))
  // Sale SIEMPRE, también en la normal: si solo saliera en la rara, la
  // normal se leería como «no se sabe» y no como «esta es la normal».
  const tapadas = await page.locator('#mcCartas .mc-chapa-variante').evaluateAll((ns) =>
    ns.filter((n) => {
      const r = n.getBoundingClientRect()
      if (!r.width) return true
      const antes = n.style.pointerEvents
      n.style.pointerEvents = 'auto'
      const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      n.style.pointerEvents = antes
      return !(encima === n || n.contains(encima))
    }).length)
  check('  …y ninguna tapada', tapadas === 0, String(tapadas))
  await page.close()
}

console.log('\n── 4. La cabecera, con sus iconos ──')
{
  const { page } = await abrir()
  await abrirSet(page)
  // LOS CUATRO SIGUEN ESTANDO, PERO DETRÁS DE UN ⋮ (tanda 475). PINGU:
  // «estás ocupando mucho espacio arriba… he pensado en poner tres puntos
  // como pasa en la aplicación de Dex». Lo que esta prueba defendía —que
  // estén los cuatro, en orden, con su dibujo y con su rótulo— sigue
  // valiendo; lo que cambia es dónde vive la lista.
  const boton = page.locator('#mcAlbumMenu > summary')
  const caja = await boton.evaluate((n) => {
    const r = n.getBoundingClientRect()
    return { svg: Boolean(n.querySelector('svg')), rotulo: n.getAttribute('aria-label') || '',
      ancho: Math.round(r.width), alto: Math.round(r.height) }
  })
  check('la cabecera se queda en UN botón', caja.svg === true, JSON.stringify(caja))
  check('  …con su rótulo para quien no lo ve', caja.rotulo.length > 4, caja.rotulo)
  // Lo que es SOLO un icono sí mide 44 de ancho (la regla de la 312: al de
  // texto se le pide alto, al de icono también ancho).
  check('  …y mide 36 con ratón', caja.ancho >= 36 && caja.alto >= 36, JSON.stringify(caja))
  await boton.click()
  await page.waitForTimeout(350)
  const iconos = await page.locator('#mcAlbumMenu .mc-menu-opcion').evaluateAll((ns) => ns.map((n) => ({
    id: n.id, svg: Boolean(n.querySelector('svg')), texto: n.textContent.trim(),
    alto: Math.round(n.getBoundingClientRect().height),
  })))
  // Desde la 725, un cuarto al final: «Enseñar las que tengo».
  check('están los cuatro mandos dentro', iconos.length === 4, JSON.stringify(iconos.map((i) => i.id)))
  check('  …en el orden de Dex: marcar, favorita y compartir, y enseñar al final',
    iconos.map((i) => i.id).join(',') === 'mcMarcarAbrir,mcAlbumFavorito,mcFaltanCopiar,mcAlbumEnsenar', JSON.stringify(iconos.map((i) => i.id)))
  check('  …cada uno con su dibujo', iconos.every((i) => i.svg), JSON.stringify(iconos))
  // Y aquí dentro SÍ llevan palabra, que es la gracia del menú: cuatro
  // iconos seguidos sin un rótulo al lado son un acertijo.
  check('  …y con su nombre escrito', iconos.every((i) => i.texto.length > 4), JSON.stringify(iconos.map((i) => i.texto)))
  check('  …y miden 44 de alto', iconos.every((i) => i.alto >= 44), JSON.stringify(iconos))
  // Y el ajuste de «al añadir», el cuarto, también está dentro.
  check('  …y el ajuste de añadir, con ellos', await page.locator('#mcAlbumMenu #mcTocarOpciones').isVisible())
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(250)
  // Y las chapas con texto que los sustituyeron ya no están en la fila.
  const fila = await page.locator('#mcAlbumFiltros').textContent()
  check('«Al añadir» ya no ocupa la fila de filtros', !/Al añadir/.test(fila), fila.slice(0, 120))
  check('  …ni «Copiar lo que me falta»', !/Copiar/.test(fila), fila.slice(0, 120))
  check('  …ni «Marcar varias»', !/Marcar varias/.test(fila), fila.slice(0, 120))
  await page.close()
}

console.log('\n── 5. El ajuste de «al añadir» sigue existiendo, en los ajustes ──')
{
  // Quitar una chapa no puede ser quitar la función: el + de una carta
  // suma una copia EN ESE idioma y ESE estado, y sin poder cambiarlo quien
  // colecciona en inglés tendría que editar carta por carta.
  const { page } = await abrir()
  await abrirSet(page)
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(400)
  const panel = await page.locator('#mcTocarOpciones').evaluate((n) => {
    const r = n.getBoundingClientRect()
    return { visible: r.width > 0, izq: Math.round(r.left), der: Math.round(r.right), ventana: innerWidth }
  })
  check('se abre y se ve entero', panel.visible && panel.izq >= 0 && panel.der <= panel.ventana, JSON.stringify(panel))
  check('  …con el idioma y el estado dentro',
    (await page.locator('#mcTocarIdioma').count()) === 1 && (await page.locator('#mcTocarEstado').count()) === 1)
  // Y SE RECUERDA: un ajuste que se olvida al recargar no es un ajuste.
  await page.selectOption('#mcTocarIdioma', 'en')
  await page.waitForTimeout(300)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  check('  …y lo elegido se recuerda al recargar', (await page.locator('#mcTocarIdioma').inputValue()) === 'en',
    await page.locator('#mcTocarIdioma').inputValue())
  await page.close()
}

console.log('\n── 6. La fila de mandos: alineada y sin pisarse ──')
{
  const { page } = await abrir()
  await abrirSet(page)
  // Los que NO se ven no cuentan (desde la tanda 473 la barra lleva una ✕
  // que solo sale cuando hay algo puesto, y un elemento escondido mide 0).
  // Lo que esta prueba vigila es que la fila no quede escalonada, y una
  // caja de 0 px no escalona nada.
  const altos = await page.locator('#mcAlbumFiltros > *').evaluateAll((ns) =>
    ns.filter((n) => n.getBoundingClientRect().height > 0)
      .map((n) => Math.round(n.getBoundingClientRect().height)))
  check('todos los mandos miden lo mismo de alto', new Set(altos).size === 1, JSON.stringify(altos))
  // La flecha del desplegable la pinta `style.css` como fondo, a 12 px del
  // canto y con 12 de ancha: el texto tiene que parar antes de 24, y con
  // 32 de relleno se le quedaba a 8 — justo rozando la última letra.
  const relleno = await page.locator('#mcAlbumFiltros select').evaluateAll((ns) =>
    ns.map((n) => parseInt(getComputedStyle(n).paddingRight, 10)))
  check('  …y ningún desplegable pisa su flecha', relleno.every((r) => r >= 36), JSON.stringify(relleno))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
