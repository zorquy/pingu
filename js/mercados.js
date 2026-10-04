// Los MERCADOS del catálogo, sin una sola dependencia (tanda 438).
//
// Vivían en `js/tcgdex.js`, que importa `./supabase.js`. Eso los dejaba
// fuera del alcance de quien no puede arrastrar un cliente de Supabase:
// una función de Netlify —que acabó con una COPIA a mano,
// `IDIOMA_POR_MERCADO`, vigilada por una prueba— y, lo que costó caro,
// `js/carta-ruta.js`, que monta las direcciones de las imágenes y por eso
// llevaba el idioma `en` ESCRITO A FUEGO. Con el selector de catálogo de
// la 437, eso significaba pedir el escaneo japonés a la carpeta inglesa:
// un 404 por cada carta y por cada logo, y la pantalla entera en blanco.
//
// Aquí dentro no hay imports a propósito. `js/tcgdex.js` lo reexporta,
// así que nada de lo que ya los importaba de allí se entera.

// ── Mercados ──
//
// Un "mercado" no es un idioma: es un catálogo distinto de cartas. Lo
// decidió el diagnóstico del panel contra la API de verdad:
//
//   - Los idiomas OCCIDENTALES son UN catálogo traducido. El español
//     comparte sus 154 identificadores de set con el inglés; el alemán
//     sus 153, el italiano sus 190, el portugués sus 123 — todos. Así que
//     el occidental se importa en INGLÉS, que es el superconjunto (218
//     sets, 23.746 cartas). Pedir los demás sería traer las mismas
//     cartas con otro nombre.
//
//   - Los ASIÁTICOS son catálogos propios, con sus sets y sus cartas.
//     Una Charizard japonesa no es la inglesa: son dos cosas para quien
//     colecciona. De ahí la columna `market` en la base.
//
// El inglés además es como se nombran las cartas en listas de torneo y
// en tiendas, y es como busca la gente. Antes se pedía en español y se
// mezclaba con el inglés, y salía un catálogo partido por 2011: las
// modernas en español y las antiguas en inglés, en la misma lista.
export const MERCADOS = {
  WEST: 'en',
  JP: 'ja',
  CN: 'zh-cn',   // chino simplificado (56 sets)
  TW: 'zh-tw',   // chino tradicional (98 sets) — catálogo aparte, no una traducción
  KO: 'ko',      // 95 sets
  ID: 'id',      // 70 sets
  TH: 'th',      // 72 sets
}

// Los que se importan hoy. Coreano, indonesio y tailandés existen y
// están completos; no entran porque no se han pedido. Añadirlos es meter
// el código en esta lista y reimportar, nada más.
export const MERCADOS_A_IMPORTAR = ['WEST', 'JP', 'CN', 'TW']

// ── Los que se OFRECEN no son los que se IMPORTAN (tanda 509) ──
//
// `MERCADOS_A_IMPORTAR` hacía los dos trabajos mientras coincidían, que es
// exactamente la forma del fallo de la tanda 335 (`name_search` buscando y
// cruzando a la vez). Dejaron de coincidir en cuanto PINGU pidió esconder
// el chino: «el chino no lo borres, pero ocúltamelo, porque Scrydex no
// tiene chino».
//
// Así que son dos listas. El chino se SIGUE importando —`catalogo-asia`
// lo engorda cada seis minutos y las colecciones de quien tenga cartas
// chinas no se quedan viejas— y simplemente no se ofrece.
export const MERCADOS_VISIBLES = ['WEST', 'JP']

export const MERCADO_POR_DEFECTO = 'WEST'

// Cómo se llama cada mercado en pantalla. El idioma va entre paréntesis
// porque "occidental" no le dice nada a nadie: lo que se lee en la carta
// es inglés.
export const NOMBRE_MERCADO = {
  WEST: 'Occidental (inglés)',
  JP: 'Japonés',
  CN: 'Chino simplificado',
  TW: 'Chino tradicional',
  KO: 'Coreano',
  ID: 'Indonesio',
  TH: 'Tailandés',
}

export const idiomaDeMercado = (market) => MERCADOS[market] || MERCADOS[MERCADO_POR_DEFECTO]

// El idioma que se usa cuando no se dice otra cosa.
export const IDIOMA = MERCADOS[MERCADO_POR_DEFECTO]
