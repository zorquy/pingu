// Dónde está el escaneo de una carta (tanda 370).
//
// PINGU: «hay cartas antiguas que no salen y hay cartas del 30
// aniversario que no tienen imágenes, sobre todo la Classic Collection;
// un montón de cartas de la era de Sol y Luna que tampoco».
//
// No era del idioma ni de la importación: `image_path` sale del listado
// de TCGdex, que se pide en INGLÉS, y TCGdex sencillamente no tiene
// escaneo de esas cartas — es un catálogo comunitario y los sets viejos
// están a medias. El segundo sitio es la CDN de Limitless, que va por
// CÓDIGO DE TCG LIVE y número, o sea que no depende de que TCGdex
// conozca la carta.
//
// ── POR QUÉ ESTO ES UN FICHERO Y NO DOS LÍNEAS EN OTRO ──
//
// Dos veces por el mismo motivo, y las dos son la lección de la 299 (el
// barrido sigue los IMPORTS, no las llamadas):
//
//   · La tabla de promos vivía en `js/constructor/nucleo.js`, que son
//     26 KB de reglas de legalidad de mazos. Traérsela desde el catálogo
//     se los llevaba puestos a /cartas y a /coleccion para montar una
//     dirección.
//   · Y la cadena vivió un rato en `js/carta-nucleo.js`, que pinta la
//     ficha entera. En cuanto `cards-block.js` la importó de ahí, /foro
//     y el editor de guías «usaron» las clases de la ficha sin pintarlas
//     nunca — y sin cargar su hoja. Lo cazó test-tanda-299.
//
// O sea: lo que usa medio sitio tiene que vivir en algo que no arrastre
// medio sitio.
//
// Sin DOM y sin Supabase salvo `urlDeImagen`, que es una plantilla de
// texto: se prueba en Node.

import { urlDeImagen } from './carta-ruta.js'

const CDN = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci'

// Los códigos de promo de TCG Live llevan guion («PR-SV 92») y la CDN de
// Limitless usa los suyos. La tabla vive AQUÍ y el constructor la
// importa: antes era al revés y por eso este fichero no podía existir
// sin arrastrarlo entero.
export const PROMOS_SIN_GUION = {
  'PR-SV': 'SVP',
  'PR-SW': 'SP',
  'PR-SM': 'SMP',
  'PR-XY': 'XYP',
  'PR-BLW': 'BWP',
  'PR-ME': 'MEP',
}

// /tpci/TWM/TWM_130_R_EN_SM.png.
//
// ── CÓMO SE ESCRIBE EL NÚMERO, que es donde estaba el fallo (tanda 379) ──
//
// Limitless tiene DOS costumbres y hay que respetar las dos:
//
//   · Número a secas → con TRES cifras: «70» es `070`.
//   · Número con letras delante → SIN el cero de relleno: la Galarian
//     Gallery es `GG1`, no `GG01`, y la Shiny Vault es `SV1`, no `SV001`.
//
// La segunda no estaba, y por eso el síntoma era tan raro: `GG10` a
// `GG70` se veían y `GG01` a `GG09` no. La misma colección, unas sí y
// otras no, sin ningún error por ninguna parte. Lo cazó PINGU mirando
// cartas a mano, no una prueba: «el GG10 carga, pero el GG1 no».
//
// Comprobado contra la CDN el 2026-09-30 en DOS series distintas —CRZ y
// SHF—, que es lo que permite aplicarlo como regla y no como lista.
//
// Devuelve null si el set o el número no tienen pinta de serlo: esto
// monta una dirección a pelo, y una dirección inventada es una imagen
// rota. Mejor no pintar nada, que la caja ya tiene su estilo para eso.
//
// El tope del número es 8 y no 6: los promos de Espada y Escudo son
// `SWSH177`, que son SIETE, y el 6 los tiraba a todos sin decir nada —
// devolvía null y la carta se quedaba en blanco. Era un número elegido
// a ojo, que es la lección de la 320: un corte que nadie ha medido es
// una afirmación sobre un ancho que nadie ha medido.
export function imagenDeLimitless(set, numero, tamanio = 'SM') {
  const s = PROMOS_SIN_GUION[String(set || '').toUpperCase()] || String(set || '').toUpperCase()
  const n = String(numero ?? '').trim()
  if (!/^[A-Z0-9]{2,6}$/.test(s) || !/^[A-Za-z0-9]{1,8}$/.test(n)) return null
  const num = /^\d+$/.test(n) ? n.padStart(3, '0') : n.replace(/^([A-Za-z]+)0+(?=\d)/, '$1')
  return `${CDN}/${s}/${s}_${num}_R_EN_${tamanio}.png`
}

// ── El último sitio: el CDN de imágenes de pokemontcg.io (tanda 435) ──
//
// Lo comprobó PINGU abriendo las direcciones a mano, que es como se
// resuelven estas cosas cuando el contenedor no tiene red: de su Bulbasaur
// SWSH303 no tienen escaneo ni TCGdex ni Limitless, y pokemontcg.io sí.
//
// Lo importante de esta fuente: **las fotos no piden clave**. La clave de
// pokemontcg.io es para su API de datos; `images.pokemontcg.io` es un CDN
// a secas. Así que esto no es una dependencia nueva de verdad — es una
// dirección más que probar, y si no contesta la cadena sigue.
//
// Va la ÚLTIMA a propósito. Las dos de delante son el escaneo oficial de
// TPCi; esta es la red de seguridad, y su futuro es el más incierto de
// las tres (su web ya dice «now part of Scrydex», que es de pago).
const POKEMONTCG = 'https://images.pokemontcg.io'

// Sus identificadores de set son los nuestros casi siempre —`swshp` es
// `swshp`—, con una familia que no: las colecciones de McDonald's, que
// ellos nombran por el AÑO. `2021swsh` es `mcd21` y `2023sv` es `mcd23`.
//
// Se DEDUCE en vez de escribir una tabla: una tabla de doce entradas se
// queda vieja a la siguiente colaboración (la lección de la 323), y el
// patrón es el mismo desde 2011. Lo que no se deduce —los trainer kits,
// que ellos llaman `tk1a`— se deja pasar tal cual: si el identificador no
// es el suyo, la dirección da 404 y no pasa nada.
const MCDONALDS = /^(\d{4})(swsh|sv|sm|xy|bw)$/i

export function setDePokemonTCG(setId) {
  const s = String(setId ?? '').trim()
  if (!s || /[/?#\s]/.test(s)) return null
  const m = s.match(MCDONALDS)
  return m ? `mcd${m[1].slice(2)}` : s
}

// `_hires` es su versión grande; sin sufijo, la pequeña. Se eligen con la
// misma palabra que el resto de la cadena para que quien pida 'high' la
// reciba grande en los tres sitios.
export function imagenDePokemonTCG(setId, numero, calidad = 'low') {
  const set = setDePokemonTCG(setId)
  const n = String(numero ?? '').trim()
  if (!set || !n || /[/?#\s]/.test(n)) return null
  return `${POKEMONTCG}/${set}/${n}${calidad === 'high' ? '_hires' : ''}.png`
}

// ── El código de TCG Live de la carta que sea ──
//
// De dónde sale depende de cómo venga la fila: con su set embebido
// (`tcg_sets(tcg_online_code)`), con la columna suelta, o de ninguna
// parte — entonces lo pone quien llama, que es el caso del catálogo de
// UNA colección, donde el set se sabe una vez y no por carta.
export function codigoDeSetDe(carta, porDefecto = null) {
  return carta?.tcg_sets?.tcg_online_code || carta?.tcg_online_code || porDefecto || null
}


// ── La ruta del asset, montada a mano (tanda 434) ──
//
// TCGdex tiene un fallo conocido y abierto —cards-database#2362—: hay
// imágenes SUBIDAS A SU CDN que su `datas.json` no lista, así que la API
// devuelve el campo `image` vacío y nuestro `image_path` nace a null. El
// issue nombra tres sets que son de los nuestros (`mep`, `P-A`, `svp`) y
// da la dirección que SÍ responde:
//
//     https://assets.tcgdex.net/en/sv/svp/196/high.png   → 200
//
// Y resulta que esa dirección es exactamente la que ya montamos: nuestro
// `image_path` ES `serie/set/número`. O sea que cuando la columna está
// vacía, la ruta se puede escribir con tres datos que ya tenemos.
//
// No se comprueba nada antes de pedirla, igual que con Limitless: si el
// fichero no está, el `onerror` de la cadena pasa al siguiente sitio y, si
// se acaban, quita la imagen. El coste de equivocarse es una petición que
// devuelve 404; el de no intentarlo, una carta en blanco.
//
// La serie hace falta y NO está en la carta: viene de su set. Si no llega,
// se devuelve null — inventarse una serie daría una dirección que no es.
export function rutaDeAssetDeTCGdex(carta, serieDeSet = null) {
  const serie = serieDeSet || carta?.tcg_sets?.serie_id || carta?.serie_id || null
  const set = carta?.set_id || carta?.tcg_sets?.id || null
  const numero = carta?.local_id
  if (!serie || !set || !numero) return null
  // Los tres trozos van en una dirección, así que nada de barras ni de
  // cosas raras: un identificador con una barra dentro cambiaría de carpeta.
  const limpio = (v) => String(v).trim()
  if ([serie, set, numero].some((v) => /[/?#\s]/.test(limpio(v)))) return null
  return `${limpio(serie)}/${limpio(set)}/${limpio(numero)}`
}

// ── La cadena entera: dónde buscar el escaneo, por orden ──
//
// `urlDelEspejo` se puede cambiar porque el idioma del escaneo depende
// del MERCADO de la carta (una japonesa se enseña en japonés), y quien
// sabe montar esa dirección es `cardImageUrl` — que vive en tcgdex.js y
// arrastra Supabase, o sea que no se puede importar aquí. Por defecto,
// la inglesa, que es la del catálogo.
export function cadenaDeEscaneo(carta, codigoDeSet = null, calidad = 'low', urlDelEspejo = null) {
  const cadena = []
  // El MERCADO de la carta decide la carpeta de idioma del CDN (tanda
  // 438). Antes `urlDeImagen` llevaba `en` escrito a fuego, asi que sin
  // `urlDelEspejo` inyectado —que es el caso de /mi-coleccion— una carta
  // japonesa pedia su escaneo a la carpeta inglesa y devolvia 404.
  const comoEspejo = (ruta) =>
    urlDelEspejo ? urlDelEspejo(ruta, calidad) : urlDeImagen(ruta, calidad, carta?.market)
  const espejo = carta?.image_path ? comoEspejo(carta.image_path) : null
  if (espejo) cadena.push(espejo)
  // Y si la columna está vacía, la MISMA dirección montada a mano (tanda
  // 434). Va aquí y no detrás de Limitless porque es la misma fuente que
  // el espejo: mismo arte y mismo idioma. Limitless es el respaldo, y su
  // arte es siempre el inglés.
  const aMano = carta?.image_path ? null : rutaDeAssetDeTCGdex(carta)
  if (aMano) cadena.push(comoEspejo(aMano))
  // Limitless SOLO para las occidentales: sus ficheros son el arte
  // inglés (`_R_EN_`). Enseñar la impresión inglesa de una carta japonesa
  // sería peor que no enseñar ninguna — en una guía sobre cartas
  // japonesas estaría contando otra cosa.
  const occidental = !carta?.market || carta.market === 'WEST'
  const limitless = occidental ? imagenDeLimitless(codigoDeSetDe(carta, codigoDeSet), carta?.local_id) : null
  if (limitless) cadena.push(limitless)
  // Y el último sitio (tanda 435), también solo para las occidentales: su
  // catálogo es el inglés, igual que el de Limitless.
  const otro = occidental ? imagenDePokemonTCG(carta?.set_id, carta?.local_id, calidad) : null
  if (otro) cadena.push(otro)
  return [...new Set(cadena)]
}

// Los atributos de <img> que recorren la cadena. El manejador va en
// línea porque esto nace de cadenas de HTML; las direcciones las montamos
// nosotros y no llevan ni espacios ni comillas.
//
// `alAgotarse` es lo que pasa cuando no queda ningún sitio. Por defecto
// la imagen se quita —la caja ya tiene su estilo para eso, y es mejor que
// el icono roto del navegador—; el bloque de cartas de una guía la cambia
// por el NOMBRE en texto, que ahí sí hace falta.
export function atributosDeEscaneo(cadena, alAgotarse = 'this.remove()') {
  const [primera, ...resto] = cadena
  if (!primera) return null
  const salto =
    "var r=(this.dataset.respaldos||'').split(' ').filter(Boolean);" +
    "if(r.length){this.src=r.shift();this.dataset.respaldos=r.join(' ')}" +
    `else{${alAgotarse}}`
  return `src="${primera}"${resto.length ? ` data-respaldos="${resto.join(' ')}"` : ''} onerror="${salto}"`
}
