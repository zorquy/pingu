// Tanda 484 — «revisa bien la API»: separar lo que dice TCGdex de lo que
// deduzco yo de nuestras propias columnas.
//
// PINGU: «me has dicho que TCGdex no guarda las imágenes de los sets
// japoneses y los logos, pero sí lo hace. Revisa bien la API, porque tiene
// un montón de cosas. […] esto es mi colección, estamos con las cartas de
// colección. Tienes que fijarte en la API general».
//
// Y tenía razón en lo de fondo: lo que yo le había contestado NO era la
// respuesta de TCGdex. Era una DEDUCCIÓN a partir de nuestras columnas
// —«188 sets curados y cero logos, luego TCGdex no los tiene»— y esa
// deducción sale EXACTAMENTE IGUAL si el que lee mal somos nosotros. Una
// columna vacía no dice de quién es la culpa.
//
// Esta prueba cubre las dos mitades de eso:
//
//   1. Lo que SÍ se puede comprobar sin red: que nuestro lado de la
//      cadena del logo y de la imagen funciona en los SIETE idiomas del
//      catálogo, no solo en inglés. Si ahí hubiera un agujero, el fallo
//      sería nuestro y mi respuesta habría sido falsa.
//   2. Que el panel tiene un botón para preguntárselo a TCGdex DE VERDAD
//      —desde el navegador, el único sitio del proyecto con salida a su
//      API—, porque lo que no se puede comprobar aquí no se decide a ojo.
import { readFileSync } from 'node:fs'
import { imagePathFromUrl } from '/home/user/pingu/js/carta-detalle.js'
import { urlDeLogo, urlDeLogoPorPartes, urlDeImagen } from '/home/user/pingu/js/carta-ruta.js'
import { MERCADOS, MERCADOS_A_IMPORTAR } from '/home/user/pingu/js/mercados.js'

const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Nuestro lado del logo funciona en los SIETE idiomas ──')
//
// `imagePathFromUrl` recorta el host y el IDIOMA de una URL de TCGdex para
// guardar el resto (`sv/sv1a/logo`), porque el idioma se vuelve a poner al
// pintar según el mercado. Lo hace con `[a-z-]{2,5}`, que es una
// AFIRMACIÓN sobre la forma de todos los códigos de idioma presentes y
// futuros — y `zh-cn` ya gasta los cinco caracteres. El día que entre uno
// de seis, esa columna se queda a null EN SILENCIO y el síntoma es
// idéntico al de «TCGdex no lo tiene»: un catálogo sin logos.
{
  for (const [market, lang] of Object.entries(MERCADOS)) {
    const camino = imagePathFromUrl(`https://assets.tcgdex.net/${lang}/sv/sv1a/logo`)
    check(`${market} (${lang}): el logo se recorta bien`, camino === 'sv/sv1a/logo', JSON.stringify(camino))
    const carta = imagePathFromUrl(`https://assets.tcgdex.net/${lang}/sv/sv1a/001`)
    check(`  …y el escaneo de una carta`, carta === 'sv/sv1a/001', JSON.stringify(carta))
  }
  // El código de idioma guarda el SITIO, no el idioma: dos mercados con
  // el mismo set guardan el MISMO camino, y eso es lo que permite que el
  // logo inglés valga de último respaldo para un set japonés (tanda 454).
  check(
    'el camino guardado NO lleva el idioma dentro',
    new Set(Object.values(MERCADOS).map((l) => imagePathFromUrl(`https://assets.tcgdex.net/${l}/sv/sv1a/logo`))).size === 1
  )
}

console.log('\n── 2. Y al pintar, cada mercado pide a SU carpeta ──')
//
// Es la lección de la 438: con el idioma escrito a fuego, un escaneo
// japonés se pedía a `/en/…`, y un 404 de imagen no da error en ninguna
// parte — la pantalla sale entera sin una sola foto.
{
  for (const market of MERCADOS_A_IMPORTAR) {
    const lang = MERCADOS[market]
    check(`${market}: el logo se pide a /${lang}/`, urlDeLogo('sv/sv1a/logo', market) === `https://assets.tcgdex.net/${lang}/sv/sv1a/logo.webp`,
      urlDeLogo('sv/sv1a/logo', market))
    check(`  …el logo montado a mano también`, (urlDeLogoPorPartes('sv', 'sv1a', market) || '').includes(`/${lang}/`),
      urlDeLogoPorPartes('sv', 'sv1a', market))
    check(`  …y la carta`, (urlDeImagen('sv/sv1a/001', 'high', market) || '').includes(`/${lang}/`),
      urlDeImagen('sv/sv1a/001', 'high', market))
  }
  check('sin camino no hay URL inventada', urlDeLogo(null, 'JP') === null && urlDeImagen('', 'high', 'JP') === null)
  check('y sin serie tampoco', urlDeLogoPorPartes(null, 'sv1a', 'JP') === null)
}

console.log('\n── 3. La imagen que el LISTADO no trae, la trae la ficha ──')
//
// Ésta es la explicación que mi respuesta se había saltado, y está escrita
// en nuestras propias notas desde la tanda 348: el listado de un set es un
// resumen y a muchas cartas les falta `image` (le pasaba a la Classic
// Collection del 30 aniversario). La ficha de cada carta SÍ la trae, y eso
// es lo que escribe el engorde. O sea que «JP al 30 %» puede ser el
// LISTADO al 30 %, no TCGdex al 30 % — y se arregla solo mientras corre la
// función programada de la 483.
{
  const { detalleDeCarta } = await import('/home/user/pingu/js/carta-detalle.js')
  const conFoto = detalleDeCarta({ id: 'sv1a-1', name: 'フシギダネ', image: 'https://assets.tcgdex.net/ja/sv/sv1a/001' })
  check('la ficha cura la imagen', conFoto.image_path === 'sv/sv1a/001', JSON.stringify(conFoto.image_path))
  // Y NO la borra cuando no viene: ponerla a null se llevaría por delante
  // la que el listado sí había traído.
  check('  …y no la borra si no viene', !('image_path' in detalleDeCarta({ id: 'sv1a-2', category: 'Pokemon' })),
    JSON.stringify(Object.keys(detalleDeCarta({ id: 'sv1a-2', category: 'Pokemon' }))))
  // Y el engorde de los asiáticos la escribe: manda el detalle ENTERO en
  // el PATCH, así que no hace falta acordarse de esta columna por separado.
  const asia = leer('netlify/functions/catalogo-asia.mjs')
  check('el engorde asiático manda el detalle entero', /\.\.\.\(detalle \|\| \{\}\)/.test(asia))
}

// console.log('\n── 4. Lo que no se puede comprobar aquí, se le pregunta a TCGdex ──')
// (sección retirada: el panel de admin se limpió en la 550 y estos botones
// —y sus textos— ya no existen; lo que probaban del SERVIDOR sigue arriba.)

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
