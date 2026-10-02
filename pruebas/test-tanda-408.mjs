// Tanda 408 — de ocho pestañas a cinco.
//
// PINGU: «creo que la pestaña de añadir cartas sobra porque tú puedes
// buscar las cartas en el buscador directamente, ¿no? ¿Cómo
// reestructurarías todo para parecerse a Dex, que tenga las funciones
// justas y que no sobre ninguna pestaña?».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

// Desde la tanda 436 la pestaña que se abre sola es el Panel, así que
// una ruta sin parámetros ya no entra en las cartas.
const abrir = async (ruta = '/mi-coleccion.html?ver=cartas', ancho = 1280, alto = 950) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'XY Promos', market: 'WEST', card_count_official: 108,
      card_count_total: 110, release_date: '2016-05-18', logo_path: 'x/logo' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-104', set_id: 'sv1', local_id: 'XY122', name: 'Blastoise EX',
      image_path: 'x/1', market: 'WEST', rarity: 'Promo', category: 'Pokemon', illustrator: 'kawayoo',
      types: ['Water'], dex_ids: [9], variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-104', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', notas: null }]
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

// EL MENÚ, desde la tanda 447. «Cartas» SALE del menú —PINGU, con Dex
// delante: «no tiene sentido meter en el menú las cartas»— y entra
// «Buscar», que busca en todo el catálogo. El orden es el del HTML.
const EN_EL_MENU = ['resumen', 'album', 'pokedex', 'carpetas', 'buscar']
// Pero la PANTALLA de cartas se queda y se abre por enlace: lo apuntan el
// «Ver todas» del panel y las URLs que la gente tenga guardadas. Quitar la
// pestaña no es quitar la página, y esta lista es la que lo vigila.
const POR_ENLACE = [...EN_EL_MENU, 'cartas']
const PANEL_DE = { resumen: 'mcPanelResumen', album: 'mcPanelAlbum', pokedex: 'mcPanelPokedex',
  carpetas: 'mcPanelCarpetas', buscar: 'mcPanelBuscar', cartas: 'mcPanelCartas' }

console.log('\n── 1. Cinco pestañas, y las mismas en el móvil ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const hay = await page.locator('#mcMenu [data-pestania]').evaluateAll((l) => l.map((e) => e.dataset.pestania))
  check('son estas cinco', JSON.stringify(hay) === JSON.stringify(EN_EL_MENU), hay.join(','))
  // Y cada una tiene su panel: una pestaña sin panel no da error, deja la
  // pantalla en blanco.
  for (const p of hay) {
    const id = await page.locator(`#mcMenu [data-pestania="${p}"]`).getAttribute('aria-controls')
    check(`  «${p}» tiene su panel`, (await page.locator('#' + id).count()) === 1, id)
  }
  await page.close()
}
{
  // Con cinco ya caben en la barra del móvil sin un «Más» detrás.
  const { page } = await abrir('/mi-coleccion.html', 390, 820)
  check('en el móvil se ven las cinco',
    (await page.locator('#mcMenu [data-pestania]:visible').count()) === 5)
  check('  …y ya no hace falta un «Más»', (await page.locator('#mcMenuMas').count()) === 0)
  // Y los nombres caben enteros: un quinto de 390 px da para «Expansiones»
  // solo si la barra va de lado a lado.
  const cortados = await page.locator('#mcMenu .mc-menu-texto').evaluateAll((l) =>
    l.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent))
  check('  …y ningún nombre sale cortado', cortados.length === 0, cortados.join(','))
  await page.close()
}

console.log('\n── 2. Lo que se mudó sigue llegando por su enlace viejo ──')
{
  // LA FORMA DEL FALLO: un `?ver=` que ya no existe NO da error — abre la
  // primera pestaña y parece que el enlace estaba mal escrito. Se
  // comprueban las tres mudanzas, no la que acabo de hacer.
  for (const [viejo, nuevo] of [['anadir', 'cartas'], ['albumes', 'carpetas'], ['cambios', 'resumen']]) {
    const { page } = await abrir(`/mi-coleccion.html?ver=${viejo}`)
    check(`?ver=${viejo} lleva a «${nuevo}»`, await page.locator(`#${PANEL_DE[nuevo]}`).isVisible(), nuevo)
    await page.close()
  }

  // Y la decisión que esto deja escrita (tanda 447): en la pantalla de
  // CARTAS no hay ninguna pestaña encendida, porque ya no tiene. Es una
  // SUBPANTALLA del Panel —se entra por su «Ver todas»—, no un sitio
  // perdido. Se comprueba a propósito: si mañana alguien «arregla» esto
  // encendiendo el Panel, estaría diciendo que estás en el Panel cuando no
  // lo estás.
  {
    const { page } = await abrir('/mi-coleccion.html?ver=cartas')
    check('en Cartas no hay pestaña encendida, porque es una subpantalla',
      (await page.locator('.mc-pestania.activa').count()) === 0,
      await page.locator('.mc-pestania.activa').count())
    check('  …y desde ahí se puede volver al menú', await page.locator('#mcMenu').isVisible())
    await page.close()
  }
  // Y todas se abren por enlace, que es la otra mitad de la misma trampa.
  // Se mira el PANEL que queda a la vista y no la pestaña encendida: la
  // de cartas ya no tiene pestaña que encender, y comprobar la pestaña
  // dejaría sin vigilar justo la pantalla que corre peligro de perderse.
  for (const v of POR_ENLACE) {
    const { page } = await abrir(`/mi-coleccion.html?ver=${v}`)
    check(`?ver=${v} abre su pantalla`, await page.locator(`#${PANEL_DE[v]}`).isVisible(), v)
    if (EN_EL_MENU.includes(v)) {
      const activa = await page.locator('.mc-pestania.activa').getAttribute('data-pestania')
      check(`  …y con su pestaña encendida`, activa === v, activa)
    }
    await page.close()
  }
  // Y nadie sigue ESCRIBIENDO los nombres viejos en una URL. Sin comentarios:
  // la trampa de siempre es que al barrer código en busca de una cadena
  // cuenta todo lo que la CONTIENE, y el comentario que EXPLICA la mudanza
  // la nombra. Costó un rojo escribir esta prueba.
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const js = ['js/mi-coleccion/albumes.js', 'js/mi-coleccion.js', 'js/carta-mercado.js']
    .map((f) => sinComentarios(leer(f))).join('\n')
  const escritos = [...js.matchAll(/ver=(anadir|albumes|cambios)\b|'ver', '(anadir|albumes|cambios)'/g)]
  check('ningún sitio escribe ya un ?ver= mudado', escritos.length === 0,
    escritos.map((m) => m[0]).join(','))
}

console.log('\n── 3. Un solo buscador: lo tuyo y, debajo, el catálogo ──')
{
  // «Añadir cartas» era una pestaña con SU PROPIO buscador, y eso obligaba
  // a saber de antemano si la carta que buscas ya es tuya. Nadie sabe eso
  // antes de buscar.
  const { page } = await abrir()
  check('el catálogo no está de entrada',
    await page.locator('#mcCatalogo').evaluate((e) => e.classList.contains('hidden')))
  check('  …y ya no hay un segundo campo de buscar',
    (await page.locator('#mcAnadirBuscar').count()) === 0)
  await page.fill('#mcBuscar', 'blastoise')
  await page.waitForTimeout(1200)
  check('al buscar, sale el catálogo debajo',
    (await page.locator('#mcCatalogo').evaluate((e) => e.classList.contains('hidden'))) === false)
  // Y debajo DE VERDAD: si saliera encima, taparía lo que ya tienes.
  const orden = await page.evaluate(() => {
    const c = document.getElementById('mcCartas').getBoundingClientRect()
    const k = document.getElementById('mcCatalogo').getBoundingClientRect()
    return k.top >= c.top
  })
  check('  …y por debajo de tus cartas', orden)
  await page.fill('#mcBuscar', '')
  await page.waitForTimeout(1200)
  check('  …y se va al borrar la búsqueda',
    await page.locator('#mcCatalogo').evaluate((e) => e.classList.contains('hidden')))
  await page.close()
}

console.log('\n── 4. Los álbumes, en Carpetas; los cambios, en el Panel ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=carpetas')
  check('los álbumes soñados están dentro de Carpetas',
    await page.locator('#mcPanelCarpetas #mcBloqueAlbumes').isVisible())
  check('  …y con su rótulo', /Álbumes soñados/.test(
    (await page.locator('#mcBloqueAlbumes > h2').textContent()) || ''))
  await page.close()
}
{
  const { page } = await abrir('/mi-coleccion.html?ver=resumen')
  check('los cambios están dentro del Panel',
    await page.locator('#mcPanelResumen #mcBloqueCambios').isVisible())
  check('  …y con su rótulo', /Cambios/.test(
    (await page.locator('#mcBloqueCambios > h2').textContent()) || ''))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
