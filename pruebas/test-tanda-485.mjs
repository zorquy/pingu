// Tanda 485 — el Panel es GENERAL; las otras cuatro pestañas son del catálogo.
//
// PINGU: «yo he cambiado el idioma en modo de expansiones, cambio el idioma
// y pongo japonés y me salen los sets japoneses. Y seguido me vuelvo al
// panel y me sale solo mi colección en ese idioma. Está mal. Debería ser un
// overall de todas las cartas que tengas independientemente del idioma. ¿Me
// entiendes? O sea, el panel es general. Luego ya cuando tú vayas a mirar
// las cartas o colecciones o lo que sea y cambies el idioma, eso ya tiene
// que ser del idioma».
//
// Son DOS colecciones en memoria y no una filtrada de dos formas, y la
// razón de que no valga filtrar es la clave: `cartas` va por id a secas y
// puede, porque mira un solo mercado. Con los cuatro juntos la clave de
// `tcg_cards` es (id, market) —el japonés comparte identificadores de set
// con el inglés (tanda 437)—, así que `sv1a-1` son DOS cartas y un mapa por
// id se queda con una de ellas SIN DAR NINGÚN ERROR. De ahí `claveDeCarta`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

// EL CHOQUE DE VERDAD, A PROPÓSITO: los dos catálogos tienen un set `sv1a`
// y por tanto una carta `sv1a-1`, y son cartas DISTINTAS. Es el caso que
// un mapa por id se come en silencio, y es real: por eso la clave ajena de
// `tcg_cards` es compuesta.
const SIEMBRA = () => {
  window.__FAKE_SETS__ = [
    { id: 'sv1a', name: 'Paldean Fates', serie_id: 'sv', market: 'WEST', card_count_official: 3, card_count_total: 3, logo_path: 'x/w', release_date: '2024-01-26' },
    { id: 'sv1a', name: 'トリプレットビート', serie_id: 'sv', market: 'JP', card_count_official: 3, card_count_total: 3, logo_path: 'x/j', release_date: '2023-03-10' },
    { id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: 2, card_count_total: 2, logo_path: 'x/m', release_date: '2025-09-26' },
  ]
  window.__FAKE_CARTAS__ = [
    // `sv1a-1` DOS VECES, una por catálogo, y con rareza distinta para que
    // el reparto del Panel pueda decir si las ha contado como una o como dos.
    { id: 'sv1a-1', market: 'WEST', set_id: 'sv1a', local_id: '1', name: 'Charizard', name_es: 'Charizard', image_path: 'w/1', rarity: 'Rare Holo', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv1a-1', market: 'JP', set_id: 'sv1a', local_id: '1', name: 'リザードン', image_path: 'j/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv1a-2', market: 'JP', set_id: 'sv1a', local_id: '2', name: 'フシギダネ', image_path: 'j/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv1a-3', market: 'JP', set_id: 'sv1a', local_id: '3', name: 'ゼニガメ', image_path: 'j/3', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Pikachu', name_es: 'Pikachu', image_path: 'w/2', rarity: 'Rare Holo', category: 'Pokemon', variants: { normal: true } },
  ]
  // Tres occidentales (dos de ellas la MISMA carta, o sea una repetida) y
  // dos japonesas. Totales: 5 copias, 4 cartas distintas, 3 colecciones.
  const t = (n) => new Date(Date.now() - n * 86400000).toISOString()
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv1a-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: t(9) },
    { id: 'l2', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: t(7) },
    { id: 'l3', card_id: 'sv1a-1', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal', created_at: t(2) },
    { id: 'l4', card_id: 'sv1a-2', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal', created_at: t(1) },
  ]
}

const errores = []
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**limitlesstcg**', (r) => r.abort())
await page.addInitScript(SIEMBRA)
await page.goto(BASE + '/mi-coleccion.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3200)

// Las cuatro cifras de la cabecera, leídas de la pantalla.
const cifras = () =>
  page.evaluate(() => {
    const out = {}
    for (const d of document.querySelectorAll('#mcResumen .mc-cifra')) {
      out[d.querySelector('dt')?.textContent?.trim()] = d.querySelector('dd')?.textContent?.trim()
    }
    return out
  })

// Cambia de catálogo por el desplegable de las banderas, que es lo que toca
// una persona. El mismo control está cuatro veces en el DOM y solo el de la
// pestaña abierta se ve: `:visible` y no `.first()` (la lápida de la 447).
const cambiar = async (id) => {
  await page.locator('.mc-mercado:visible').first().selectOption(id)
  await page.waitForTimeout(2000)
}

console.log('── 1. La cabecera cuenta TODA la colección ──')
{
  const c = await cifras()
  // 2 + 1 + 1 + 1 = 5 copias. Con el filtro de mercado puesto serían 3.
  check('Cartas: las cinco copias', c.Cartas === '5', JSON.stringify(c))
  // Cuatro DISTINTAS: las dos `sv1a-1` cuentan por separado porque son dos
  // cartas. Con un mapa por id serían tres, y nadie se enteraría.
  check('Distintas: las cuatro, sin fundir las dos `sv1a-1`', c.Distintas === '4', JSON.stringify(c))
  // TRES colecciones: `sv1a` occidental, `sv1a` japonés y `sv8`. Contar sin
  // el mercado delante daría dos.
  check('Colecciones: tres, con el `sv1a` de cada catálogo aparte', c.Colecciones === '3', JSON.stringify(c))
}

console.log('\n── 2. Y la nota dice de qué habla ──')
{
  const nota = await page.locator('#mcResumenNota').textContent()
  check('avisa de que el Panel es general', /TODA tu colección/i.test(nota || ''), nota)
  check('  …y de que las otras pestañas son del catálogo', /catálogo que tengas elegido/i.test(nota || ''), nota)
}

console.log('\n── 3. El Panel enseña lo último que añadiste, de donde sea ──')
{
  // La más reciente es la JAPONESA (`l4`, de ayer). Con el catálogo español
  // puesto, el Panel la tenía que estar escondiendo: era el caso de PINGU.
  const cartasDelVistazo = await page.locator('.mc-vistazo-cartas a').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label')))
  check('la japonesa de ayer sale en «Tus cartas»', cartasDelVistazo.includes('フシギダネ'), JSON.stringify(cartasDelVistazo))
  check('  …y la occidental también', cartasDelVistazo.some((x) => /Pikachu|Charizard/.test(x || '')), JSON.stringify(cartasDelVistazo))
}

console.log('\n── 4. Y las repetidas no funden dos catálogos ──')
{
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(900)
  // Lo largo va plegado detrás de «Ver todas» (tanda 440), así que hay que
  // abrirlo: una prueba que lee un bloque escondido lee la cadena vacía y
  // sale verde por casualidad.
  await page.click('#mcVerTodo')
  await page.waitForTimeout(700)
  const texto = await page.locator('#mcEstadisticas').innerText()
  // Solo UNA repetida: la `sv1a-1` occidental, que tiene 2 copias. La
  // japonesa tiene 1. Si se agruparan por id, saldrían 3 copias y «te
  // sobran 2» — una repetida inventada a partir de dos cartas distintas.
  check('te sobra UNA copia, no dos', /te sobran?\s*(una|1)\b/i.test(texto) || /\b1\b[\s\S]{0,40}copia repetida/i.test(texto),
    texto.replace(/\s+/g, ' ').slice(0, 260))
}

console.log('\n── 5. Cambiar de catálogo NO cambia el Panel ──')
{
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(900)
  await cambiar('ja')
  // La estantería sí es del catálogo: con el japonés puesto se ve el set
  // japonés y no el occidental. Eso es lo que PINGU quería que siguiera así.
  const estanteria = await page.locator('#mcPanelAlbum').innerText()
  check('la estantería pasa al japonés', /トリプレットビート/.test(estanteria), estanteria.replace(/\s+/g, ' ').slice(0, 200))
  check('  …y ya no enseña el occidental', !/Mega Evolution/.test(estanteria), estanteria.replace(/\s+/g, ' ').slice(0, 200))
  // Y la cabecera NO se mueve: es la misma colección, mire donde mire.
  const c = await cifras()
  check('las cifras de arriba no se mueven', c.Cartas === '5' && c.Distintas === '4' && c.Colecciones === '3', JSON.stringify(c))
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(900)
  const cartasDelVistazo = await page.locator('.mc-vistazo-cartas a').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label')))
  check('y el Panel sigue enseñando las occidentales', cartasDelVistazo.some((x) => /Pikachu|Charizard/.test(x || '')),
    JSON.stringify(cartasDelVistazo))
}

console.log('\n── 6. Lo que se añade entra en LAS DOS memorias ──')
{
  // Sin esto el Panel se queda diciendo lo de antes justo después de añadir
  // una carta, y no da ningún error: son seis sitios que mutan la lista a
  // mano y cualquiera que se olvidara dejaría el agujero.
  const antes = await cifras()
  await page.click('[data-pestania="album"]')
  await page.waitForTimeout(800)
  // Se abre la estantería japonesa y se marca una carta que no tienes.
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  // Desde la 565 se apunta desde la FICHA: se abre el bolsillo vacío y se
  // pulsa «Añadir a mi colección».
  const bolsillo = page.locator('.mc-bolsillo:not(.tengo) .mc-bolsillo-enlace').first()
  if (await bolsillo.count()) {
    await bolsillo.click()
    await page.waitForTimeout(900)
    await page.locator('#mcEdAnadirVersiones button').click()
    await page.waitForTimeout(1600)
    const despues = await cifras()
    check('la cabecera sube al marcar una carta', Number(despues.Cartas) > Number(antes.Cartas),
      `antes ${antes.Cartas} → después ${despues.Cartas}`)
  } else {
    check('hay un hueco que marcar en la estantería', false, 'no he encontrado ningún bolsillo vacío')
  }
}

console.log('\n── 7. Sin errores de JavaScript ──')
check('ni uno', errores.length === 0, JSON.stringify(errores))

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
