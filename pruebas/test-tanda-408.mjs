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
  // LOS NOMBRES YA NO SE VEN (tanda 452): el menú del móvil es una burbuja
  // de iconos, como la de Dex. Lo que se comprobaba aquí —que «Expansiones»
  // no se cortara— deja de tener sentido cuando no hay texto, y se cambia
  // por lo que SÍ importa ahora: que el nombre siga estando para quien no
  // ve. Esconderlo con `display: none` lo sacaría también del árbol de
  // accesibilidad y la burbuja serían cinco dibujos sin nombre.
  const estado = await page.locator('#mcMenu [role="tab"]').evaluateAll((l) =>
    l.map((b) => ({
      nombre: (b.textContent || '').trim(),
      seVe: [...b.querySelectorAll('.mc-menu-texto')].some((t) => t.getBoundingClientRect().width > 5),
      icono: b.querySelectorAll('svg').length,
    })))
  // CON su palabra a la vista desde la 565: eran cinco dibujos sin nombre
  // y «capas» o «carné» no dicen Expansiones ni Pokédex a quien llega
  // nuevo. Esta prueba afirmó lo de la 452 hasta que la suite la cazó.
  check('  …con la palabra a la vista bajo cada icono (565)',
    estado.every((b) => b.seVe), JSON.stringify(estado.filter((b) => !b.seVe)))
  check('  …pero con su nombre para quien no ve',
    estado.every((b) => b.nombre.length > 2), JSON.stringify(estado.map((b) => b.nombre)))
  check('  …y cada uno con su icono', estado.every((b) => b.icono === 1), JSON.stringify(estado.map((b) => b.icono)))

  // Y FLOTA: no toca los bordes. Si los tocara sería una barra, que es lo
  // que había antes de la 452.
  const burbuja = await page.locator('#mcMenu').evaluate((n) => {
    const c = n.getBoundingClientRect()
    return { izq: Math.round(c.left), der: Math.round(innerWidth - c.right), radio: parseFloat(getComputedStyle(n).borderRadius) }
  })
  check('  …y flota, con aire a los dos lados',
    burbuja.izq > 8 && Math.abs(burbuja.izq - burbuja.der) <= 2, JSON.stringify(burbuja))
  check('  …y es una píldora', burbuja.radio >= 24, String(burbuja.radio))
  await page.close()
}

console.log('\n── 2. Lo que se mudó sigue llegando por su enlace viejo ──')
{
  // LA FORMA DEL FALLO: un `?ver=` que ya no existe NO da error — abre la
  // primera pestaña y parece que el enlace estaba mal escrito. Se
  // comprueban las tres mudanzas, no la que acabo de hacer.
  // `cambios` sale de esta lista en la tanda 451: ya no se muda al Panel,
  // porque ha vuelto a tener pantalla propia. Su enlace de siempre lleva
  // otra vez a donde dice, que es lo que se comprueba más abajo.
  for (const [viejo, nuevo] of [['anadir', 'cartas'], ['albumes', 'carpetas']]) {
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

console.log('\n── 4. Los álbumes, en Carpetas; los cambios, en su pantalla ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=carpetas')
  check('los álbumes soñados están dentro de Carpetas',
    await page.locator('#mcPanelCarpetas #mcBloqueAlbumes').isVisible())
  check('  …y con su rótulo', /Álbumes soñados/.test(
    (await page.locator('#mcBloqueAlbumes > h2').textContent()) || ''))
  await page.close()
}
{
  // Los cambios se fueron del Panel en la tanda 451: eran una pantalla
  // entera —cifras, quién encaja contigo y el explicador de tres pasos—
  // puesta debajo de otra, y había que bajar demasiado. Ahora son una
  // SUBPANTALLA como «Cartas»: su enlace lleva a ella y no enciende
  // ninguna pestaña, porque no tiene.
  const { page } = await abrir('/mi-coleccion.html?ver=cambios')
  check('los cambios tienen SU pantalla', await page.locator('#mcPanelCambios').isVisible())
  check('  …y con su rótulo', /Cambios/.test(
    (await page.locator('#mcBloqueCambios > h2').textContent()) || ''))
  check('  …y no la enciende ninguna pestaña, porque no tiene',
    (await page.locator('.mc-pestania.activa').count()) === 0)
  await page.close()

  // Y el Panel deja una PUERTA: una pantalla sin nadie que enlace a ella
  // es una pantalla que no existe.
  const { page: panel } = await abrir('/mi-coleccion.html')
  check('  …y el Panel lleva a ella', await panel.locator('#mcVistazos [data-ir-a="cambios"]').isVisible())
  check('  …y el bloque gordo ya no está en el Panel',
    !(await panel.locator('#mcPanelResumen #mcBloqueCambios').count()))
  await panel.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
