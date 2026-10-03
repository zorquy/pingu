// Tanda 427 — ordenar una expansión.
//
// Una expansión se mira de cuatro maneras según lo que vayas a hacer: por
// número cuando la repasas en la mano, por nombre cuando buscas una, por
// rareza cuando miras lo que vale, y «lo que te falta» cuando vas a
// comprar o a cambiar. Hasta ahora solo había la primera.
//
// La mitad de esto se prueba en Node, sin navegador: lo que decide el
// orden es aritmética, y la aritmética no necesita un navegador para
// equivocarse.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.BASE || 'http://localhost:8892'
const { ORDENES, ordenar, porNumero, rangoDeRareza } = await import(`${RAIZ}/js/mi-coleccion/orden.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La escala de rareza, en Node ──')
{
  check('la escala va de menos a más', rangoDeRareza('Common') < rangoDeRareza('Rare Holo'))
  check('  …y la hiperrara es la de arriba',
    rangoDeRareza('Hyper rare') > rangoDeRareza('Special illustration rare'), String(rangoDeRareza('Hyper rare')))
  check('  …y una ilustración especial está por encima de una normal',
    rangoDeRareza('Special illustration rare') > rangoDeRareza('Illustration rare'))
  // Una promo no es un escalón de rareza: es de dónde salió la carta.
  check('la promo no parte la escala por la mitad', rangoDeRareza('Promo') === 0)

  // La lección de la 323: una lista a mano se queda vieja. Por eso hay
  // reconocimiento por palabras, igual que en `familiaDeBrillo`.
  check('una rareza NUEVA que diga «Hyper» ya se ordena arriba',
    rangoDeRareza('Hyper Rare Gold Star') === rangoDeRareza('Hyper rare'), String(rangoDeRareza('Hyper Rare Gold Star')))
  check('  …y una que diga «Special illustration», en su sitio',
    rangoDeRareza('Special Illustration Rare v2') === 10, String(rangoDeRareza('Special Illustration Rare v2')))
  check('  …sin que «Uncommon» cuente como «Common»',
    rangoDeRareza('Uncommon') !== rangoDeRareza('Common'))

  // Tres respuestas y no dos (la regla de la 319): número si se sabe,
  // `null` si no. Inventarse un escalón colocaría una rareza desconocida
  // en medio de la escala sin que nada lo cantara.
  check('sin rareza, no se sabe', rangoDeRareza(null) === null && rangoDeRareza('') === null)
  check('una rareza que no se reconoce tampoco se inventa', rangoDeRareza('Trofeo de 1999') === null,
    String(rangoDeRareza('Trofeo de 1999')))
  // Y la trampa del substring: `/rare/i` casa con «Rareza», así que sin
  // bordes de palabra una rareza desconocida acabaría EN MEDIO de la
  // escala y no al final. Es la de las tandas 312 y 313, otra vez.
  check('  …ni «Rareza», que CONTIENE «rare»', rangoDeRareza('Rareza inventada') === null,
    String(rangoDeRareza('Rareza inventada')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Ordenar, en Node ──')
{
  const c = (id, nombre, rarity) => ({ id, local_id: id, name: nombre, rarity })
  const cartas = [c('3', 'Zubat', 'Common'), c('1', 'Arbok', 'Hyper rare'),
    c('2', 'Mewtwo', 'Rare Holo'), c('10', 'Bulbasaur', 'Trofeo'), c('TG1', 'Pikachu', 'Ultra Rare')]
  const ids = (l) => l.map((x) => x.local_id).join(',')
  const nombre = (x) => x.name

  check('por número: 2 antes que 10', ids(ordenar(cartas, 'numero', { nombre })) === '1,2,3,10,TG1',
    ids(ordenar(cartas, 'numero', { nombre })))
  check('  …y los que llevan letras, detrás', ids(ordenar(cartas, 'numero', { nombre })).endsWith('TG1'))
  check('por nombre, en español', ids(ordenar(cartas, 'nombre', { nombre })) === '1,10,2,TG1,3',
    ids(ordenar(cartas, 'nombre', { nombre })))
  // Las que no se saben van SIEMPRE al final: arriba dirían que son las
  // más raras del set, que es exactamente lo que no se sabe.
  check('por rareza, las desconocidas al FINAL', ids(ordenar(cartas, 'rareza', { nombre })).endsWith('10'),
    ids(ordenar(cartas, 'rareza', { nombre })))
  check('  …y las demás de más a menos', ids(ordenar(cartas, 'rareza', { nombre })) === '1,TG1,2,3,10',
    ids(ordenar(cartas, 'rareza', { nombre })))

  const tengo = (id) => (id === '1' || id === '3' ? 1 : 0)
  check('lo que te falta, primero', ids(ordenar(cartas, 'falta', { tengo, nombre })) === '2,10,TG1,1,3',
    ids(ordenar(cartas, 'falta', { tengo, nombre })))
  // Dentro de cada grupo, por número: si no, «lo que te falta» sería una
  // lista desordenada de la que no se pueden ir leyendo números.
  check('  …y dentro de cada grupo, por número',
    ids(ordenar(cartas, 'falta', { tengo, nombre })).startsWith('2,10,TG1'))

  // `sort` MUTA. Si ordenara en el sitio, «por número» acabaría dependiendo
  // de lo último que hubieras elegido.
  const antes = ids(cartas)
  ordenar(cartas, 'rareza', { nombre })
  ordenar(cartas, 'nombre', { nombre })
  check('ordenar no toca la lista que le dan', ids(cartas) === antes, `${antes} → ${ids(cartas)}`)

  // Dos cosas que el juego de arriba no toca y que pasan de verdad: un set
  // trae VARIAS ilustraciones del mismo Pokémon —así que hay nombres
  // repetidos— y hay números con una letra pegada («10a»), que no es lo
  // mismo que «TG1».
  const repes = [c('20', 'Pikachu', 'Common'), c('5', 'Pikachu', 'Common'),
    c('10a', 'Eevee', 'Common'), c('9', 'Eevee', 'Common')]
  check('con el nombre repetido desempata el número', ids(ordenar(repes, 'nombre', { nombre })) === '9,10a,5,20',
    ids(ordenar(repes, 'nombre', { nombre })))
  // «10a» tiene un número que `parseInt` sí entiende (10), así que sin la
  // comprobación de «¿es TODO dígitos?» se colaría entre el 9 y el 20 en
  // vez de irse con los que llevan letra.
  check('«10a» va con los de letra, no entre el 9 y el 20',
    ids(ordenar(repes, 'numero', { nombre })) === '5,9,20,10a', ids(ordenar(repes, 'numero', { nombre })))

  check('un orden que no existe cae en el de siempre',
    ids(ordenar(cartas, 'loquesea', { nombre })) === ids(ordenar(cartas, 'numero', { nombre })))
  check('hay cuatro órdenes con nombre', ORDENES.length === 4 && ORDENES.every((o) => o.id && o.nombre))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Una sola copia de `porNumero` ──')
{
  // Estaba escrito en `mi-coleccion.js` Y haría falta aquí: una constante
  // copiada se separa y no da error (la lección de la 322). Vive en
  // `orden.js` y se importa.
  const js = leer('js/mi-coleccion.js')
  check('`mi-coleccion.js` ya no lo define', !/^function porNumero\(/m.test(js))
  check('  …lo importa de `orden.js`', /import \{[^}]*porNumero[^}]*\} from '\.\/mi-coleccion\/orden\.js'/.test(js))
  check('  …y lo sigue usando', /porNumero\(/.test(js))
  check('`orden.js` lo exporta', /export function porNumero/.test(leer('js/mi-coleccion/orden.js')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. En la pantalla ──')
const browser = await chromium.launch()
const abrir = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 10,
      card_count_total: 10, release_date: '2015-05-06', logo_path: 'x/l', tcg_online_code: 'ROS' }]
    const r = ['Common', 'Hyper rare', 'Rare Holo', 'Ultra Rare', 'Uncommon', 'Rareza Inventada']
    const nombres = ['Zubat', 'Arbok', 'Mewtwo', 'Bulbasaur', 'Pikachu', 'Charmander']
    window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5, 6].map((n, i) => ({ id: `sv1-10${n}`, set_id: 'sv1',
      local_id: `10${n}`, name: nombres[i], image_path: `x/${n}`, market: 'WEST', rarity: r[i],
      category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = ['sv1-102', 'sv1-105'].map((id, i) => ({ id: `l${i}`, card_id: id,
      cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  return { page, errores }
}
const nums = (page) => page.locator('#mcAlbum .mc-bolsillo-num').allTextContents()
{
  const { page, errores } = await abrir()
  check('el desplegable trae los cuatro', (await page.locator('#mcAlbumOrden option').count()) === 4)
  check('  …y empieza por número', (await nums(page)).join(',') === '101,102,103,104,105,106', (await nums(page)).join(','))
  // El control vive DENTRO del panel de «Filtros» desde la tanda 473,
  // así que hay que abrirlo: encontrar un elemento no es poder pulsarlo.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumOrden', 'nombre')
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  await page.waitForTimeout(600)
  check('por nombre', (await nums(page)).join(',') === '102,104,106,103,105,101', (await nums(page)).join(','))
  // El control vive DENTRO del panel de «Filtros» desde la tanda 473,
  // así que hay que abrirlo: encontrar un elemento no es poder pulsarlo.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumOrden', 'rareza')
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  await page.waitForTimeout(600)
  // 106 lleva «Rareza Inventada», que CONTIENE «rare»: sin bordes de
  // palabra se colaría en medio de la escala en vez de irse al final.
  check('por rareza, y la desconocida al final', (await nums(page)).join(',') === '102,104,103,105,101,106',
    (await nums(page)).join(','))
  // El control vive DENTRO del panel de «Filtros» desde la tanda 473,
  // así que hay que abrirlo: encontrar un elemento no es poder pulsarlo.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumOrden', 'falta')
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  await page.waitForTimeout(600)
  check('lo que te falta primero', (await nums(page)).join(',') === '101,103,104,106,102,105', (await nums(page)).join(','))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El orden se lleva bien con lo demás ──')
{
  const { page, errores } = await abrir()
  // El control vive DENTRO del panel de «Filtros» desde la tanda 473,
  // así que hay que abrirlo: encontrar un elemento no es poder pulsarlo.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumOrden', 'rareza')
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  await page.waitForTimeout(600)
  // Filtrar y ordenar son cosas distintas y tienen que componerse: el
  // orden va DESPUÉS del filtro, no en vez de él.
  await page.fill('#mcAlbumBuscar', 'a')
  await page.waitForTimeout(900)
  const tras = await nums(page)
  check('con un filtro puesto se ven menos cartas', tras.length === 5, tras.join(','))
  // Y en el orden que toca, dicho a pelo. Comparar la lista consigo misma
  // —que es lo primero que uno escribe— da verdad siempre: Mewtwo se cae
  // por el filtro y las cinco que quedan son 11, 7, 2, 1 y «no se sabe».
  check('  …y las cinco siguen de más rara a menos, con la desconocida al final',
    tras.join(',') === '102,104,105,101,106', tras.join(','))
  await page.fill('#mcAlbumBuscar', '')
  await page.waitForTimeout(900)
  check('quitar el filtro no se lleva el orden por delante',
    (await nums(page)).join(',') === '102,104,103,105,101,106', (await nums(page)).join(','))
  // Y cambiar de set no reinicia lo elegido: repintar un `<select>` le
  // borra el valor, y eso al ordenar es insoportable.
  check('  …y el desplegable sigue en «rareza»', (await page.locator('#mcAlbumOrden').inputValue()) === 'rareza')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
