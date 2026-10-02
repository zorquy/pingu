// Tanda 436 — el Panel es lo primero, y enseña un asomo de cada pestaña.
//
// PINGU, con el panel de control de Dex delante: «el panel debería ser lo
// primero que se abre cuando abres mi colección» y «que el panel se
// asemeje más a lo que existe en Dex, cogiendo la información de las otras
// pestañas».
//
// Eso son dos cosas y las dos están aquí: cuál es la pestaña por defecto,
// y los VISTAZOS —un asomo de cada pestaña con su «ver todas»— que
// convierten el panel en una portada de la colección y no en una pestaña
// más.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = () => {
  // TRES sets y DIEZ líneas a propósito: con dos sets y cinco líneas el
  // corte a DE_VISTAZO (8) y el filtro de «expansiones en las que llevas
  // algo» no cambiaban NADA al quitarlos. Un fixture que no distingue las
  // dos ramas no prueba el reparto.
  window.__FAKE_SETS__ = [
    { id: 'sv1', name: 'Scarlet & Violet', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
      logo_path: 'sv/sv1/logo', card_count_official: 10, card_count_total: 10, release_date: '2023-03-31',
      tcg_online_code: 'SVI' },
    { id: 'sv2', name: 'Paldea Evolved', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
      logo_path: 'sv/sv2/logo', card_count_official: 4, card_count_total: 4, release_date: '2023-06-09',
      tcg_online_code: 'PAL' },
    // De este no llevas NINGUNA: no tiene que salir en el vistazo.
    { id: 'sv3', name: 'Obsidian Flames', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
      logo_path: 'sv/sv3/logo', card_count_official: 3, card_count_total: 3, release_date: '2023-08-11',
      tcg_online_code: 'OBF' },
  ]
  window.__FAKE_CARTAS__ = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ id: `sv1-${n}`, set_id: 'sv1', local_id: String(n), name: `Carta ${n}`,
      image_path: `sv/sv1/${n}`, market: 'WEST', rarity: 'Common', category: 'Pokemon', dex_ids: [n],
      variants: { normal: true } })),
    ...[1, 2, 3, 4].map((n) => ({ id: `sv2-${n}`, set_id: 'sv2', local_id: String(n), name: `Otra ${n}`,
      image_path: `sv/sv2/${n}`, market: 'WEST', rarity: 'Rare', category: 'Trainer', variants: { normal: true } })),
    ...[1, 2, 3].map((n) => ({ id: `sv3-${n}`, set_id: 'sv3', local_id: String(n), name: `Lejana ${n}`,
      image_path: `sv/sv3/${n}`, market: 'WEST', rarity: 'Rare', category: 'Trainer', variants: { normal: true } })),
  ]
  // Ocho de la primera en OCTUBRE y dos de la segunda en SEPTIEMBRE: así el
  // vistazo de ocho tiene que quedarse con las ocho de octubre y en orden
  // descendente. Si ordena al revés, la primera es «Otra 1»; si no corta,
  // salen diez.
  window.__FAKE_COLECCION__ = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `l${n}`, card_id: `sv1-${n}`, cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', created_at: `2026-10-0${n}T00:00:00Z` })),
    { id: 'l9', card_id: 'sv2-1', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
      created_at: '2026-09-01T00:00:00Z' },
    { id: 'l10', card_id: 'sv2-2', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
      created_at: '2026-09-02T00:00:00Z' },
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
const activa = (page) => page.locator('.mc-pestania.activa .mc-menu-texto').textContent()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El Panel es lo primero ──')
{
  const { page, errores } = await abrir()
  check('se abre en el Panel', (await activa(page)) === 'Panel', await activa(page))
  check('  …y es el panel el que se ve', await page.locator('#mcPanelResumen').isVisible())
  check('  …y las cartas no', await page.locator('#mcPanelCartas').isHidden())
  // La pestaña por defecto es la que NO lleva `?ver=`: si no, compartir
  // /mi-coleccion a secas llevaría a otra cosa que abrirla.
  check('la dirección se queda sin `?ver=`', (await page.evaluate(() => location.search)) === '')
  // A «Cartas» NO SE VA POR EL MENÚ desde la tanda 447, que la sacó de ahí
  // a propósito —el menú es Panel · Expansiones · Pokédex · Carpetas ·
  // Buscar— y dejó la PANTALLA, a la que se llega por el «Ver todas» del
  // Panel y por `?ver=cartas`. Esta prueba clicaba la pestaña que ya no
  // existe y se caía con un tiempo agotado que parece un fallo de la web.
  await page.click('[data-ir-a="cartas"]')
  await page.waitForTimeout(500)
  check('ir a Cartas sí lo pone', (await page.evaluate(() => location.search)) === '?ver=cartas')
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(500)
  check('  …y volver al Panel lo quita', (await page.evaluate(() => location.search)) === '')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Las otras pestañas se siguen pudiendo pedir por la dirección.
  const { page } = await abrir('/mi-coleccion.html?ver=cartas')
  // «Cartas» salió del menú en la 447 y la PANTALLA se quedó, así que no
  // hay pestaña activa que mirar: lo que dice que estás en las cartas es
  // que su panel sea el que se ve. Preguntarle a un menú por una pantalla
  // que ya no está en el menú se cae con un tiempo agotado y parece un
  // fallo de la web.
  check('`?ver=cartas` abre las cartas',
    (await page.locator('#mcPanelCartas').isVisible()) && (await page.locator('#mcPanelResumen').isHidden()))
  await page.close()
  const pok = await abrir('/mi-coleccion.html?ver=pokedex')
  check('`?ver=pokedex` abre la Pokédex', (await activa(pok.page)) === 'Pokédex', await activa(pok.page))
  await pok.page.close()
  // Y los nombres viejos siguen mudando a donde toca (las MUDANZAS). Se
  // prueba con `?ver=anadir`, que SÍ es una mudanza: `?ver=cambios` dejó de
  // serlo cuando la 451 le dio su propia pantalla, y una prueba escrita
  // contra el mapa de ayer dice que la web está rota cuando lo que ha
  // pasado es que una mudanza se ha convertido en un destino.
  const viejo = await abrir('/mi-coleccion.html?ver=anadir')
  check('un nombre viejo sigue mudando a donde toca',
    (await viejo.page.locator('#mcPanelCartas').isVisible()) && (await viejo.page.evaluate(() => location.search)) === '?ver=cartas',
    await viejo.page.evaluate(() => location.search))
  await viejo.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Los vistazos ──')
{
  const { page, errores } = await abrir()
  const titulos = await page.locator('.mc-vistazo .mc-subtitulo').allTextContents()
  // Los DOS primeros son los de esta tanda; detrás han ido entrando otros
  // (la 451 metió «Cambios»). Se comprueba que estos dos están y en este
  // orden, no que sean los únicos: una lista cerrada convierte cada tanda
  // siguiente en un rojo que no dice nada.
  check('hay un vistazo de cartas y otro de expansiones',
    titulos[0] === 'Tus cartas' && titulos[1] === 'Expansiones', titulos.join('|'))

  // ESTO es lo que más importa: entrando DIRECTO al panel, los vistazos se
  // pintan de lo que hay en memoria... y al arrancar no hay nada. Es el
  // fallo que la tanda 377 ya arregló para el resto del panel, y que una
  // pieza nueva vuelve a abrir si no se engancha al repintado.
  check('las cartas están, no un «todavía no has añadido ninguna»',
    (await page.locator('.mc-vistazo-carta').count()) === 8,
    String(await page.locator('.mc-vistazo-carta').count()))
  // Diez líneas y ocho huecos: el corte a DE_VISTAZO hace algo. Un vistazo
  // que las enseña todas deja de ser un vistazo.
  check('  …cortadas a ocho de las diez que hay',
    (await page.locator('.mc-vistazo-carta').count()) < 10,
    String(await page.locator('.mc-vistazo-carta').count()))
  // Y las ÚLTIMAS primero. No es un detalle de orden: con el orden al
  // revés el panel enseña lo más viejo de la colección, que es justo lo que
  // ya se sabe.
  const nombres = await page.locator('.mc-vistazo-carta').evaluateAll(
    (ns) => ns.map((n) => n.getAttribute('aria-label')))
  check('  …la más reciente primero', /Carta 8/.test(nombres[0] || ''), nombres.join(' | '))
  check('  …y la más vieja fuera', !nombres.some((n) => /Otra /.test(n || '')), nombres.join(' | '))
  check('  …y no sale el estado vacío', !/Todavía no has añadido/.test(await page.locator('#mcVistazos').textContent()))
  check('las expansiones también', (await page.locator('.mc-vistazo .mc-set-tarjeta').count()) === 2,
    String(await page.locator('.mc-vistazo .mc-set-tarjeta').count()))
  // Hay TRES sets y de uno no llevas nada: una expansión a cero no dice
  // «por dónde vas», dice «no has empezado», y de esas hay doscientas.
  const sets = await page.locator('.mc-vistazo .mc-set-nombre').allTextContents()
  check('  …y la que no has empezado no sale', !sets.some((t) => /Obsidian/.test(t)), sets.join(' | '))
  // Y LA MÁS NUEVA, primero. Esta tanda puso delante la que más llevas, y
  // la 451 lo cambió a propósito: PINGU, «¿qué ha pasado con las
  // expansiones? ¿ya no están las más nuevas?». En un vistazo de una sola
  // fila, ordenar por cuántas tienes esconde justo lo que acabas de
  // empezar — y decía una cosa distinta de la pantalla de Expansiones.
  const fechas = await page.locator('.mc-vistazo .mc-set-tarjeta').evaluateAll(
    (ns) => ns.map((n) => n.getAttribute('data-set')))
  check('  …con la más nueva delante', fechas[0] === 'sv2', fechas.join(' | '))

  // Una carta cuyo escaneo no llega tiene que seguir siendo una carta y no
  // un hueco invisible (la decisión de la 415).
  const caja = await page.locator('.mc-vistazo-carta').first().evaluate((n) => {
    const cs = getComputedStyle(n)
    return { alto: Math.round(n.getBoundingClientRect().height), borde: cs.borderTopWidth, fondo: cs.backgroundColor }
  })
  check('una carta sin escaneo sigue ocupando y teniendo cuerpo',
    caja.alto > 40 && caja.borde !== '0px', JSON.stringify(caja))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Los vistazos llevan a su pestaña ──')
{
  const { page, errores } = await abrir()
  await page.locator('[data-ir-a="cartas"]').click()
  await page.waitForTimeout(600)
  // Sin pestaña que mirar desde la 447: lo que dice que has llegado es que
  // su panel sea el que se ve.
  check('«ver todas» de las cartas lleva a Cartas', await page.locator('#mcPanelCartas').isVisible())
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(1200)
  await page.locator('[data-ir-a="album"]').click()
  await page.waitForTimeout(600)
  check('  …y el de las expansiones, a Expansiones', (await activa(page)) === 'Expansiones', await activa(page))

  // Y pulsar una expansión del vistazo ABRE esa expansión, no la
  // estantería: es lo que espera quien pulsa una tarjeta con su nombre y
  // su progreso.
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(1200)
  await page.locator('.mc-vistazo .mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  check('pulsar una expansión abre ESA expansión', (await activa(page)) === 'Expansiones', await activa(page))
  // La PRIMERA del vistazo es la más NUEVA desde la 451, que es Paldea.
  check('  …y no la estantería', (await page.locator('#mcAlbumTitulo').textContent()) === 'Paldea Evolved',
    await page.locator('#mcAlbumTitulo').textContent())
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// Entrar por OTRA pestaña y venir al Panel. Es un camino distinto del de
// entrar directo: ahí los vistazos no se han pintado nunca, así que el
// repintado de `repintar()` no sirve de red —ya corrió, y corrió con el
// panel escondido—. Quien llega por un enlace a `?ver=cartas` y luego
// pulsa «Panel» se encontraba la caja vacía, sin ningún error.
console.log('\n── 4. Llegar al Panel desde otra pestaña ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  check('se abre en Cartas', await page.locator('#mcPanelCartas').isVisible())
  check('  …y los vistazos todavía no están', (await page.locator('.mc-vistazo-carta').count()) === 0)
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(1500)
  check('al pulsar «Panel» los vistazos se pintan',
    (await page.locator('.mc-vistazo-carta').count()) === 8,
    String(await page.locator('.mc-vistazo-carta').count()))
  check('  …y las expansiones también', (await page.locator('.mc-vistazo .mc-set-tarjeta').count()) === 2,
    String(await page.locator('.mc-vistazo .mc-set-tarjeta').count()))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
