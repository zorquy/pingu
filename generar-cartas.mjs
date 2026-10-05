// /cartas se GENERA desde mi-coleccion.html (tanda 649).
//
// PINGU: «a mí me gusta más el apartado de colecciones porque es más
// pequeño, tiene más información y cuando clicas en una carta te sale el
// pop-up». El catálogo público y la estantería de Mi colección eran la
// misma lista pintada dos veces, y la de Mi colección era la buena. Así
// que /cartas ES esa pantalla: el mismo cuerpo, el mismo JavaScript
// (`js/mi-coleccion.js` en modo catálogo, que lo decide
// `<body data-modo="catalogo">`), y una cabecera de página indexable en
// vez del `noindex` de la colección privada.
//
// No se copia a mano por lo de siempre: dos copias de 1.400 líneas se
// separan sin que nadie lo vea. Este guion es la única forma de escribir
// cartas.html, y una prueba comprueba que lo que hay en el repo es lo que
// sale de aquí. Si tocas mi-coleccion.html:
//
//     node generar-cartas.mjs
//
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = dirname(fileURLToPath(import.meta.url))

export const TITULO = 'Cartas de Pokémon TCG'
export const DESCRIPCION =
  'El catálogo de cartas de Pokémon TCG expansión a expansión: qué vale cada una, cuánto se mueve esta semana y cada carta con su precio, en español.'

// Cada cambio es un par (lo que hay, lo que va) y los dos tienen que
// casar EXACTAMENTE una vez: si la plantilla cambia y una pieza deja de
// encontrarse, esto PARA en vez de escribir una página a medias.
const CAMBIOS = [
  ['<title>Mi colección — PokeDoc</title>', `<title>${TITULO} en español — PokeDoc</title>`],
  [
    '  <meta name="robots" content="noindex" />\n',
    `  <meta name="description" content="${DESCRIPCION}" />
  <!-- meta-social:inicio -->
  <link rel="canonical" href="https://pokedoc.es/cartas.html" />
  <meta property="og:url" content="https://pokedoc.es/cartas.html" />
  <meta property="og:site_name" content="PokeDoc" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="es_ES" />
  <meta property="og:title" content="${TITULO} en español" />
  <meta property="og:description" content="${DESCRIPCION}" />
  <meta property="og:image" content="https://pokedoc.es/assets/images/og-default.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${TITULO} en español" />
  <meta name="twitter:description" content="${DESCRIPCION}" />
  <meta name="twitter:image" content="https://pokedoc.es/assets/images/og-default.png" />
  <!-- meta-social:fin -->
`,
  ],
  ['<body>', '<body data-modo="catalogo">'],
  // La cabecera: el título de la página y una línea, en el sitio del
  // nombre de la colección. El resto de la cabecera de perfil (avatar,
  // cifras, el interruptor de pública) lo esconde el CSS del modo.
  [
    '<h1 id="mcTitulo">Mi colección</h1>',
    `<h1 id="mcTitulo">${TITULO}</h1>
          <p class="mc-catalogo-lema">Todas las expansiones con lo que valen y cómo van esta semana. Entra en una y toca cualquier carta.</p>`,
  ],
]

// El menú: en el catálogo son dos pestañas, las expansiones y el buscador
// de todo el catálogo. Lo demás (Panel, Cambios, Pokédex, Álbumes) es de
// tu colección y vive en /mi-coleccion.
const MENU = /<nav class="mc-pestanias mc-menu" id="mcMenu"[^>]*>[\s\S]*?<\/nav>/
const MENU_CATALOGO = `<nav class="mc-pestanias mc-menu" id="mcMenu" role="tablist" aria-label="Vistas del catálogo">
        <button type="button" role="tab" class="mc-pestania activa" data-pestania="album" data-icono="layers" aria-selected="true" aria-controls="mcPanelAlbum"><span class="mc-menu-texto">Expansiones</span></button>
        <button type="button" role="tab" class="mc-pestania" data-pestania="buscar" data-icono="search" aria-selected="false" aria-controls="mcPanelBuscar"><span class="mc-menu-texto">Buscar</span></button>
      </nav>`

export function generarCartas(plantilla) {
  let html = plantilla
  for (const [de, a] of CAMBIOS) {
    const veces = html.split(de).length - 1
    if (veces !== 1) throw new Error(`«${de.slice(0, 60)}» aparece ${veces} veces en mi-coleccion.html y tiene que aparecer una`)
    html = html.replace(de, () => a)
  }
  if (!MENU.test(html)) throw new Error('no se encuentra el menú #mcMenu en mi-coleccion.html')
  html = html.replace(MENU, () => MENU_CATALOGO)
  // La marca va DESPUÉS del doctype: un comentario delante no cambia el
  // modo del navegador, pero sí rompe a quien compruebe que la página
  // empieza por él.
  return html.replace(
    '<!DOCTYPE html>\n',
    '<!DOCTYPE html>\n<!-- GENERADO desde mi-coleccion.html por generar-cartas.mjs (tanda 649): no lo edites a mano, edita la plantilla y vuelve a generarlo. -->\n'
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const plantilla = readFileSync(join(RAIZ, 'mi-coleccion.html'), 'utf8')
  writeFileSync(join(RAIZ, 'cartas.html'), generarCartas(plantilla))
  console.log('cartas.html generado')
}
