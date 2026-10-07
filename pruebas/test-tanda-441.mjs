// Tanda 441 — la pestaña Cartas: el nombre debajo de cada carta, el orden
// a la vista y la cuenta de lo que ves. Y fuera «dónde estás cerca».
//
// Lo que más importa de aquí es el PRIMER bloque, y es un fallo que llevaba
// tandas en producción sin que nadie lo viera: una carta cuya imagen no
// responde se quedaba en un rectángulo INVISIBLE —no un hueco de cero
// píxeles, que eso ya lo arregló la 321, sino una caja que ocupa, que se
// puede pulsar y que no dibuja nada—. Se descubrió al empezar a servir
// imágenes de mentira en las capturas: hasta entonces TODAS salían así y
// se daba por hecho que era cosa del contenedor.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = () => {
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', serie_name: 'EP', market: 'WEST',
    logo_path: 'x/sv8/logo', card_count_official: 191, card_count_total: 191, release_date: '2024-11-08' }]
  // «Boss's Orders» a propósito: el apóstrofo es justo lo que rompe una
  // cadena montada dentro de un `onerror`, que es como NO se ha hecho.
  const nombres = ['Pikachu ex', "Boss's Orders", 'Mewtwo V', 'Gardevoir ex', 'Miraidon ex', 'Koraidon ex']
  window.__FAKE_CARTAS__ = nombres.map((name, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8',
    local_id: String(i + 1), name, name_es: name, image_path: `x/sv8/${i + 1}`, rarity: 'Rare',
    category: 'Pokemon', dex_ids: [25], variants: { normal: true } }))
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST',
    cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-09-1${i}T00:00:00Z` }))
}

// `imagenes: false` corta TODAS las fuentes, que es el caso de verdad de
// cientos de cartas hoy: la columna tiene ruta y la ruta no responde.
const abrir = async ({ ancho = 1280, imagenes = true, ruta = '/mi-coleccion.html?ver=cartas' } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64')
  for (const patron of ['**assets.tcgdex.net/**', '**limitlesstcg**', '**pokemontcg.io**']) {
    await page.route(patron, (r) => (imagenes && patron.includes('tcgdex')
      ? r.fulfill({ body: PNG, contentType: 'image/png' })
      : r.abort()))
  }
  await page.addInitScript(semilla)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Una carta sin imagen sigue siendo una carta ──')
{
  const { page, errores } = await abrir({ imagenes: false })
  const cajas = await page.locator('#mcCartas .mc-carta-foto').evaluateAll((ns) => ns.map((n) => {
    const r = n.getBoundingClientRect()
    return { alto: Math.round(r.height), texto: (n.textContent || '').replace(/\s+/g, ' ').trim() }
  }))
  check('hay seis cartas', cajas.length === 6, String(cajas.length))
  // El hueco: ya lo garantizaba la 321 y se sigue comprobando, porque es
  // la mitad de abajo de este fallo.
  check('  …y todas ocupan su sitio', cajas.every((c) => c.alto > 100), JSON.stringify(cajas.map((c) => c.alto)))
  // Y la mitad de arriba, que es la nueva: que se VEA algo.
  check('  …y todas dicen qué carta son',
    cajas.every((c) => c.texto.length > 2), JSON.stringify(cajas.map((c) => c.texto)))
  check('  …con su nombre y su número',
    cajas.some((c) => /Pikachu ex/.test(c.texto) && /1/.test(c.texto)), JSON.stringify(cajas.map((c) => c.texto)))
  // El apóstrofo entero, sin escaparse a medias ni partir nada.
  check('  …y un apóstrofo no rompe el nombre',
    cajas.some((c) => c.texto.includes("Boss's Orders")), JSON.stringify(cajas.map((c) => c.texto)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Y con la imagen SÍ, el nombre no se ve: si se viera, cada carta
  // llevaría su nombre impreso encima del dibujo.
  const { page } = await abrir({ imagenes: true })
  const img = page.locator('#mcCartas .mc-carta-foto img').first()
  check('con la imagen puesta, la imagen está', (await img.count()) === 1)
  // TAPA de verdad, no «está por delante en el z-index». El nombre tiene
  // que ocupar EL BOTÓN ENTERO y quedarse detrás; si se queda en el flujo
  // normal, mide cuatro renglones, EMPUJA a la imagen hacia abajo y las
  // dos cosas se ven a la vez. El rigor lo cazó: mirar el z-index no
  // distinguía las dos, porque el z-index seguía puesto.
  const tapa = await page.locator('#mcCartas .mc-carta-foto').first().evaluate((bt) => {
    const sp = bt.querySelector('.mc-carta-sinfoto')
    const img2 = bt.querySelector('img')
    if (!sp || !img2) return null
    const b = bt.getBoundingClientRect()
    const s2 = sp.getBoundingClientRect()
    const i = img2.getBoundingClientRect()
    return {
      nombreLlenaElBoton: Math.abs(s2.height - b.height) < 2 && Math.abs(s2.top - b.top) < 2,
      imagenLlenaElBoton: Math.abs(i.height - b.height) < 2,
      seSolapan: Math.abs(s2.top - i.top) < 2,
    }
  })
  check('  …y el nombre ocupa el botón entero, detrás', tapa && tapa.nombreLlenaElBoton, JSON.stringify(tapa))
  check('  …sin empujar a la imagen', tapa && tapa.imagenLlenaElBoton && tapa.seSolapan, JSON.stringify(tapa))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Ordenar, a la vista ──')
{
  const { page } = await abrir()
  // Estaba DENTRO del modal de Filtros. Un filtro se pone una vez; un
  // orden se toca cada dos por tres.
  // El <select> es una BANDEJA desde la tanda 449 (diez criterios no caben
  // en un desplegable de móvil), pero lo que esta tanda defendía sigue en
  // pie y es lo que se comprueba: que el orden se toca DESDE LA BARRA, sin
  // abrir el modal de filtros.
  check('el orden vive en la barra, no en el modal',
    await page.locator('#mcFiltros #mcAbrirOrden').count() === 1)
  check('  …y no en el diálogo', await page.locator('#mcPanelFiltros #mcAbrirOrden').count() === 0)
  check('se puede usar sin abrir los filtros', await page.locator('#mcAbrirOrden').isVisible())
  // Y el botón DICE qué orden hay puesto: un control que guarda un estado
  // y no lo enseña obliga a abrirlo para saber qué pusiste.
  check('  …y dice cuál está puesto', (await page.locator('#mcOrdenRotulo').textContent()).trim().length > 0,
    await page.locator('#mcOrdenRotulo').textContent())
  // Y sigue ordenando, que es lo que no se puede dar por hecho al mover
  // un control de sitio.
  await page.locator('#mcAbrirOrden').click()
  await page.waitForTimeout(400)
  await page.locator('[data-orden="nombre"]').click()
  await page.waitForTimeout(600)
  const nombres = await page.locator('#mcCartas .mc-carta-sinfoto').allTextContents()
  check('  …y ordena de verdad', /Boss/.test(nombres[0] || ''), nombres.join(' | ').slice(0, 120))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Cuántas estás viendo ──')
{
  const { page } = await abrir()
  check('sin filtrar dice cuántas tienes',
    (await page.locator('#mcCuantas').textContent()).trim() === '6 cartas',
    await page.locator('#mcCuantas').textContent())
  // Con un filtro puesto la rejilla se acorta y ANTES nada decía por qué.
  await page.fill('#mcBuscar', 'Pikachu')
  await page.waitForTimeout(800)
  check('al filtrar dice cuántas de cuántas',
    (await page.locator('#mcCuantas').textContent()).trim() === '1 de 6',
    await page.locator('#mcCuantas').textContent())
  await page.close()
}
{
  // Y la barra no se sale por ningún ancho: son seis controles en fila.
  for (const ancho of [390, 768, 1280]) {
    const { page } = await abrir({ ancho })
    check(`la barra no desborda en ${ancho} px`,
      !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. «Dónde estás cerca», fuera ──')
{
  const { page } = await abrir({ ruta: '/mi-coleccion.html' })
  // PINGU: «no tiene sentido porque abajo ya están las expansiones».
  check('no queda ni rastro del bloque', (await page.locator('.mc-cerca').count()) === 0)
  const titulos = await page.locator('.mc-vistazo .mc-subtitulo').allTextContents()
  check('  …y el panel empieza por tus cartas', titulos[0] === 'Tus cartas', titulos.join(' | '))
  check('  …con las expansiones debajo, que es lo que lo repetía',
    titulos.includes('Expansiones'), titulos.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// Tanda 442 — el pie de los precios, solo donde hay precios.
//
// Vive FUERA de las pestañas, así que salía en las cinco: también en
// Expansiones y en la Pokédex, donde no hay ni un precio que explicar.
// Tres renglones de letra pequeña que no vienen a cuento son ruido.
console.log('\n── 5. La nota de los precios, donde hay precios ──')
{
  const donde = {}
  // Se va a cada pantalla POR SU ENLACE y no pulsando su pestaña: desde la
  // 447 «Cartas» no tiene pestaña —es una subpantalla del Panel— y pulsar
  // una que no existe se cae con un «element is not visible» que parece un
  // fallo de la web. El enlace llega a las cinco igual.
  for (const t of ['resumen', 'cartas', 'album', 'pokedex', 'carpetas']) {
    const { page } = await abrir({ ruta: `/mi-coleccion.html?ver=${t}` })
    await page.waitForTimeout(400)
    donde[t] = await page.locator('#mcFuente').isVisible()
    await page.close()
  }
  check('sale en el panel y en las cartas', donde.resumen && donde.cartas, JSON.stringify(donde))
  check('  …y no en las otras tres', !donde.album && !donde.pokedex && !donde.carpetas, JSON.stringify(donde))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
