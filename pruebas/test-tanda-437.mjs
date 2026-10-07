// Tanda 437 — qué catálogo se mira.
//
// PINGU: «vamos a hacer que tengamos dos catálogos distintos… y después,
// si seleccionas las japonesas». Los cuatro mercados ya estaban en la
// base; lo que faltaba era dejar de fijar 'WEST' a mano en las diez
// consultas que lo tenían escrito.
//
// Lo que más importa de aquí no se ve: el mercado es de TODA la pantalla,
// colección incluida. Si solo cambiara el catálogo, el mapa de cartas en
// memoria —que va por la id a secas— mezclaría dos cartas DISTINTAS con la
// misma id, porque el japonés comparte identificadores de set con el
// inglés. La semilla tiene uno de esos a propósito.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = () => {
  window.__FAKE_SETS__ = [
    { id: 'sv1', name: 'Scarlet & Violet', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
      logo_path: 'sv/sv1/logo', card_count_official: 3, card_count_total: 3, release_date: '2023-03-31' },
    // MISMA id de set que el occidental, y es un set DISTINTO: es el caso
    // que obligó a que la clave de la base sea (id, market).
    { id: 'sv1', name: 'スカーレットex', market: 'JP', serie_id: 'sv', serie_name: 'スカーレット＆バイオレット',
      logo_path: 'sv/sv1/logo', card_count_official: 2, card_count_total: 2, release_date: '2023-01-20' },
    { id: 'sv1a', name: 'トリプレットビート', market: 'JP', serie_id: 'sv', serie_name: 'スカーレット＆バイオレット',
      logo_path: 'sv/sv1a/logo', card_count_official: 2, card_count_total: 2, release_date: '2023-03-10' },
  ]
  window.__FAKE_CARTAS__ = [
    ...[1, 2, 3].map((n) => ({ id: `sv1-${n}`, set_id: 'sv1', market: 'WEST', local_id: String(n),
      name: `Carta inglesa ${n}`, image_path: `sv/sv1/${n}`, rarity: 'Common', category: 'Pokemon',
      dex_ids: [25], variants: { normal: true }, name_search: `carta inglesa ${n}` })),
    // `sv1-1` existe en los DOS mercados y no es la misma carta.
    ...[1, 2].map((n) => ({ id: `sv1-${n}`, set_id: 'sv1', market: 'JP', local_id: String(n),
      name: `Carta japonesa ${n}`, image_path: `sv/sv1/${n}`, rarity: 'Common', category: 'Pokemon',
      dex_ids: [25], variants: { normal: true }, name_search: `carta japonesa ${n}` })),
    ...[1, 2].map((n) => ({ id: `sv1a-${n}`, set_id: 'sv1a', market: 'JP', local_id: String(n),
      name: `Triplete ${n}`, image_path: `sv/sv1a/${n}`, rarity: 'Rare', category: 'Pokemon',
      dex_ids: [6], variants: { normal: true }, name_search: `triplete ${n}` })),
  ]
  // DOS líneas occidentales y UNA japonesa, y una de cada lado comparte
  // `card_id`: si el filtro por mercado se cae, se cuentan las tres.
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv1-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
      created_at: '2026-10-01T00:00:00Z' },
    { id: 'l2', card_id: 'sv1-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
      created_at: '2026-10-02T00:00:00Z' },
    { id: 'l3', card_id: 'sv1a-1', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal',
      created_at: '2026-10-03T00:00:00Z' },
  ]
}

const abrir = async (ruta = '/mi-coleccion.html') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}
// El VISIBLE: los tres selectores están siempre en el documento, pero solo
// el de la pestaña abierta se puede pulsar. Desde la 436 la pestaña que se
// abre sola es el Panel, que no tiene selector.
const suyo = (page) => page.locator('.mc-mercado').locator('visible=true').first()
const elegir = async (page, m) => {
  await suyo(page).selectOption(m)
  await page.waitForTimeout(2500)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El selector está, y en todos los sitios ──')
{
  const { page, errores } = await abrir()
  // CUATRO desde la tanda 450, no tres: «Buscar» estrenó el suyo. Y lo que
  // esta comprobación defiende no es el número sino la REGLA — que el
  // selector esté en TODAS las pantallas donde se mira el catálogo, porque
  // el que cambia es el mismo y quien está en una no tiene por qué irse a
  // otra para cambiarlo. Así que se cuenta contra las pantallas que lo
  // necesitan y no contra un número escrito a mano, que es lo que se queda
  // viejo cada vez que se añade una.
  const conCatalogo = ['mcPanelCartas', 'mcPanelAlbum', 'mcPanelPokedex', 'mcPanelBuscar']
  const donde = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`#${id} .mc-mercado`)), conCatalogo)
  check('hay un selector en cada pantalla donde se mira el catálogo',
    donde.length === conCatalogo.length, `${donde.join(', ')} de ${conCatalogo.join(', ')}`)
  const cuantos = await page.locator('.mc-mercado').count()
  check('  …y ninguno de más', cuantos === conCatalogo.length, String(cuantos))
  // Lo que se elige ya no es el CÓDIGO del mercado: desde la tanda 438 es
  // una VISTA, y «español» e «inglés» son el mismo catálogo con dos
  // rótulos. Lo que ofrece y cómo se pinta es cosa de test-tanda-438; lo
  // de aquí es que el catálogo SIGA a lo elegido, que es lo de la 437.
  const valores = await page.locator('.mc-mercado').first().evaluate(
    (n) => [...n.options].map((o) => o.value))
  check('ofrece un catálogo japonés que elegir', valores.includes('ja'), valores.join(','))
  check('empieza en el occidental', ['es', 'en'].includes(await page.locator('.mc-mercado').first().inputValue()))
  // Los tres son EL MISMO selector repetido: si uno se queda atrás, quien
  // entra por esa pantalla ve un catálogo y cree que ve otro.
  const todos = await page.locator('.mc-mercado').evaluateAll((ns) => ns.map((n) => n.value))
  check('  …y los tres dicen lo mismo', new Set(todos).size === 1, todos.join(','))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Tu colección es la de ESE catálogo ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  const cuenta = () => page.locator('#mcCartas .mc-carta').count()
  check('en occidental llevas dos cartas', (await cuenta()) === 2, String(await cuenta()))
  await elegir(page, 'ja')
  check('en japonés llevas una', (await cuenta()) === 1, String(await cuenta()))
  // Y es la japonesa, no una inglesa pintada con otro rótulo.
  const nombres = await page.locator('#mcCartas .mc-carta-foto').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label')))
  check('  …y es la japonesa', /Triplete/.test(nombres.join(' ')), nombres.join(' | '))
  // Lo de los tres selectores otra vez, pero DESPUÉS de cambiar: es
  // cuando uno se queda con el valor viejo.
  const todos = await page.locator('.mc-mercado').evaluateAll((ns) => ns.map((n) => n.value))
  check('  …y los tres selectores se enteran', todos.every((v) => v === 'ja'), todos.join(','))
  await elegir(page, 'es')
  check('y al volver, las dos de antes', (await cuenta()) === 2, String(await cuenta()))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Las expansiones, también ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album')
  const sets = () => page.locator('#mcEstanteriaRejilla .mc-set-nombre').allTextContents()
  const oeste = await sets()
  check('en occidental sale el set inglés', oeste.join('|') === 'Scarlet & Violet', oeste.join('|'))
  await elegir(page, 'ja')
  const jp = await sets()
  check('en japonés salen los dos japoneses', jp.length === 2, jp.join('|'))
  // El set 'sv1' existe en los dos mercados con NOMBRES distintos: si la
  // estantería se quedara con el catálogo viejo, saldría el inglés.
  check('  …y el que comparte id sale con su nombre japonés',
    jp.some((t) => /スカーレットex/.test(t)) && !jp.some((t) => /Scarlet & Violet/.test(t)), jp.join('|'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El buscador y la Pokédex ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  await page.fill('#mcBuscar', 'carta')
  await page.waitForTimeout(1500)
  const enOeste = await page.locator('#mcAnadirResultados .mc-resultado-nombre').allTextContents()
  check('el buscador trae solo cartas del catálogo mirado',
    enOeste.length > 0 && enOeste.every((t) => /inglesa/.test(t)), enOeste.join(' | ').slice(0, 120))
  await elegir(page, 'ja')
  await page.fill('#mcBuscar', 'carta')
  await page.waitForTimeout(1500)
  const enJp = await page.locator('#mcAnadirResultados .mc-resultado-nombre').allTextContents()
  check('  …y en japonés, las japonesas',
    enJp.length > 0 && enJp.every((t) => /japonesa/.test(t)), enJp.join(' | ').slice(0, 120))
  await page.close()

  // La Pokédex sale de una RPC que nació con 'WEST' escrito dentro. De
  // Pikachu hay 3 cartas en occidental y 2 en japonés: si el parámetro no
  // llega, el japonés diría 3 contando las INGLESAS, y el progreso de al
  // lado contaría las tuyas japonesas. Dos catálogos en la misma frase.
  const pdx = await abrir('/mi-coleccion.html?ver=pokedex')
  const dePikachu = async () => (await pdx.page.locator('.pdx-especie[data-dex="25"] .pdx-cuenta').first().textContent()) || ''
  check('en occidental, Pikachu tiene tres cartas', /de 3$/.test((await dePikachu()).trim()), await dePikachu())
  await elegir(pdx.page, 'ja')
  check('  …y en japonés, dos', /de 2$/.test((await dePikachu()).trim()), await dePikachu())
  check('sin errores', !pdx.errores.length, pdx.errores[0])
  await pdx.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La elección se recuerda ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=cartas')
  await elegir(page, 'ja')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('al recargar sigue en japonés', (await suyo(page).inputValue()) === 'ja', await suyo(page).inputValue())
  check('  …y la colección es la japonesa', (await page.locator('#mcCartas .mc-carta').count()) === 1,
    String(await page.locator('#mcCartas .mc-carta').count()))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// ABRIR una expansión y ABRIR una especie son DOS CONSULTAS MÁS, y las dos
// se las saltaba la prueba: enseñar la estantería japonesa no prueba que
// dentro de un set japonés haya cartas japonesas. En el caso del set da
// doblemente igual que la lista de fuera esté bien, porque `sv1` existe en
// los dos mercados y es un set DISTINTO.
console.log('\n── 6. Dentro de una expansión y dentro de una especie ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album')
  await elegir(page, 'ja')
  // El set que comparte id con el inglés, a propósito.
  await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta[data-set="sv1"]').first().click()
  await page.waitForTimeout(2000)
  check('la expansión abierta es la japonesa',
    /スカーレットex/.test((await page.locator('#mcAlbumTitulo').textContent()) || ''),
    await page.locator('#mcAlbumTitulo').textContent())
  const dentro = await page.locator('#mcAlbum .mc-bolsillo-enlace').evaluateAll(
    (ns) => ns.map((n) => n.getAttribute('aria-label')))
  check('  …y las cartas de dentro, también', dentro.length > 0 && dentro.every((t) => /japonesa/.test(t)),
    dentro.join(' | ').slice(0, 160))
  check('  …y ninguna inglesa se ha colado', !dentro.some((t) => /inglesa/.test(t)), dentro.join(' | ').slice(0, 160))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=pokedex')
  const abrirPikachu = async () => {
    await page.locator('.pdx-especie[data-dex="25"]').first().click()
    await page.waitForTimeout(2000)
    return page.locator('.pdx-cartas .pdx-carta').evaluateAll((ns) => ns.map((n) => n.getAttribute('title')))
  }
  const oeste = await abrirPikachu()
  check('la especie abierta trae las cartas del catálogo mirado',
    oeste.length === 3 && oeste.every((t) => /inglesa/.test(t)), oeste.join(' | ').slice(0, 160))
  // Volver a la rejilla para poder cambiar de catálogo y entrar otra vez.
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await elegir(page, 'ja')
  const jp = await abrirPikachu()
  check('  …y en japonés, las japonesas',
    jp.length === 2 && jp.every((t) => /japonesa/.test(t)), jp.join(' | ').slice(0, 160))
  // Y con el nombre JAPONÉS de su colección. La clave ajena de la base es
  // (set_id, market) -> (id, market) a propósito, porque `sv1` existe en
  // los dos catálogos: un join por la id sola traería el set inglés y la
  // carta japonesa saldría rotulada «Scarlet & Violet».
  check('  …y rotuladas con su colección japonesa',
    jp.every((t) => /スカーレットex/.test(t)) && !jp.some((t) => /Scarlet & Violet/.test(t)),
    jp.join(' | ').slice(0, 160))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
