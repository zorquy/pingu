// Tanda 438 — el idioma del catálogo, y las imágenes que iban al sitio
// equivocado.
//
// Dos cosas, y la segunda es un fallo de la 437 que se veía como «todavía
// está cargando»: las direcciones de las imágenes llevaban `en` escrito a
// fuego, así que el escaneo de una carta japonesa se pedía a la carpeta
// inglesa y devolvía 404. Un 404 de imagen NO DA ERROR: la cadena de
// respaldo se queda sin sitios y quita la imagen.
//
// Por eso aquí se comprueba lo que se PIDE y no lo que se pinta. En este
// contenedor la red está cerrada, así que mirar el DOM diría que no hay
// imagen tanto si la dirección es buena como si es mala.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = () => {
  window.__FAKE_SETS__ = [
    { id: 'sv1', name: 'Scarlet & Violet', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
      logo_path: 'sv/sv1/logo', card_count_official: 2, card_count_total: 2, release_date: '2023-03-31' },
    { id: 'sv1a', name: 'トリプレットビート', market: 'JP', serie_id: 'sv', serie_name: 'スカーレット＆バイオレット',
      logo_path: 'sv/sv1a/logo', card_count_official: 2, card_count_total: 2, release_date: '2023-03-10' },
  ]
  window.__FAKE_CARTAS__ = [
    // Con `name` Y `name_es` distintos a propósito: es lo único que
    // distingue la vista española de la inglesa.
    { id: 'sv1-1', market: 'WEST', set_id: 'sv1', local_id: '1', name: 'Boss’s Orders', name_es: 'Órdenes del Jefe',
      image_path: 'sv/sv1/1', rarity: 'Common', category: 'Trainer', dex_ids: [25], variants: { normal: true } },
    { id: 'sv1a-1', market: 'JP', set_id: 'sv1a', local_id: '1', name: 'Pikachu JP', name_es: null,
      image_path: 'sv/sv1a/1', rarity: 'Common', category: 'Pokemon', dex_ids: [25], variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv1-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
      created_at: '2026-10-01T00:00:00Z' },
    { id: 'l2', card_id: 'sv1a-1', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal',
      created_at: '2026-10-02T00:00:00Z' },
  ]
}
const abrir = async (ruta = '/mi-coleccion.html?ver=cartas') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  page.on('request', (r) => { if (r.url().includes('assets.tcgdex.net')) pedidas.push(r.url()) })
  await page.addInitScript(semilla)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores, pedidas }
}
const suyo = (page) => page.locator('.mc-mercado').locator('visible=true').first()
const elegir = async (page, v, espera = 2500) => {
  await suyo(page).selectOption(v)
  await page.waitForTimeout(espera)
}
const primera = (page) => page.locator('#mcCartas .mc-carta-foto').first().getAttribute('aria-label')

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El Panel va el PRIMERO ──')
{
  const { page } = await abrir('/mi-coleccion.html')
  const pestanas = await page.locator('.mc-pestania .mc-menu-texto').allTextContents()
  // Es la que se abre sola desde la 436: tenerla la última decía que era
  // la menos importante justo cuando pasó a ser la de entrada.
  check('«Panel» es la primera pestaña', pestanas[0] === 'Panel', pestanas.join(' | '))
  check('  …y sigue siendo la que se abre sola',
    (await page.locator('.mc-pestania.activa .mc-menu-texto').textContent()) === 'Panel')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El selector: cuatro banderas y nada más ──')
{
  const { page, errores } = await abrir()
  const ops = await suyo(page).evaluate((n) => [...n.options].map((o) => ({ v: o.value, t: o.textContent, ti: o.title })))
  check('son cuatro', ops.length === 4, JSON.stringify(ops))
  check('  …español, inglés, japonés y chino',
    ops.map((o) => o.v).join(',') === 'es,en,ja,zh', ops.map((o) => o.v).join(','))
  // PINGU: «no metas contexto, mete el emoji de la bandera que toca».
  check('  …solo la bandera, sin una letra',
    ops.every((o) => !/[a-zA-ZÁÉÍÓÚáéíóúñ]/.test(o.t)), ops.map((o) => o.t).join(' '))
  // Pero el nombre NO se pierde: una bandera a secas no se puede leer en
  // voz alta, así que va en el `title` y en el `aria-label`.
  check('  …con su nombre para quien no ve la bandera',
    ops.map((o) => o.ti).join(',') === 'Español,Inglés,Japonés,Chino', ops.map((o) => o.ti).join(','))
  check('  …y el desplegable dice cuál está puesto',
    /Español/.test(await suyo(page).getAttribute('aria-label')), await suyo(page).getAttribute('aria-label'))
  check('empieza en español', (await suyo(page).inputValue()) === 'es')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Español e inglés son el MISMO catálogo ──')
{
  const { page, errores } = await abrir()
  check('en español, el nombre traducido', /Órdenes del Jefe/.test(await primera(page)), await primera(page))
  await elegir(page, 'en', 1200)
  check('en inglés, el nombre de la carta', /Boss/.test(await primera(page)), await primera(page))
  // Y la colección NO se vuelve a pedir: es el mismo mercado, solo cambia
  // cuál de los dos nombres se enseña. Si se recargara, se vería el
  // «cargando» y la lista parpadearía por nada.
  check('  …y la carta sigue ahí, sin recargar', (await page.locator('#mcCartas .mc-carta').count()) === 1,
    String(await page.locator('#mcCartas .mc-carta').count()))
  check('  …y el cargando no se ha encendido', await page.locator('#mcCargando').isHidden())
  await elegir(page, 'es', 1200)
  check('y al volver, el traducido otra vez', /Órdenes del Jefe/.test(await primera(page)), await primera(page))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La imagen se pide a la carpeta de SU idioma ──')
{
  const { page, errores, pedidas } = await abrir()
  const deCartas = () => pedidas.filter((u) => /\/sv1\/1\/|\/sv1a\/1\//.test(u))
  check('la occidental, a /en/', deCartas().some((u) => u.includes('/en/sv/sv1/1/')), deCartas().join(' | '))
  check('  …y a ninguna otra carpeta', !deCartas().some((u) => /\/(ja|zh-cn|zh-tw)\//.test(u)), deCartas().join(' | '))
  pedidas.length = 0
  await elegir(page, 'ja')
  check('la japonesa, a /ja/', deCartas().some((u) => u.includes('/ja/sv/sv1a/1/')), deCartas().join(' | '))
  // ESTA es la que importa: con `en` escrito a fuego, la japonesa se
  // pedía a /en/ y devolvía 404 sin decir nada.
  check('  …y NO a la inglesa', !deCartas().some((u) => u.includes('/en/sv/sv1a/1/')), deCartas().join(' | '))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Y el logo de la expansión, igual ──')
{
  const { page, errores, pedidas } = await abrir('/mi-coleccion.html?ver=album')
  const logos = () => pedidas.filter((u) => u.includes('/logo'))
  check('el logo occidental, a /en/', logos().some((u) => u.includes('/en/sv/sv1/logo')), logos().join(' | '))
  pedidas.length = 0
  await elegir(page, 'ja')
  check('el logo japonés, a /ja/', logos().some((u) => u.includes('/ja/sv/sv1a/logo')), logos().join(' | '))
  check('  …y NO a la inglesa', !logos().some((u) => u.includes('/en/sv/sv1a/logo')), logos().join(' | '))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La elección se recuerda ──')
{
  const { page } = await abrir()
  await elegir(page, 'ja')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('al recargar sigue en japonés', (await suyo(page).inputValue()) === 'ja', await suyo(page).inputValue())
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
