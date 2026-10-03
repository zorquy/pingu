// Lo PURO de la tanda 488: de dónde sale el escaneo de una carta asiática
// cuando la API de TCGdex no lo dice, y cómo se escribe su nombre con
// letras de aquí.
//
// Sin red y sin base: se prueba en Node con datos guardados. La parte que
// sí pide cosas vive en `netlify/functions/escaneos-asia.mjs`.
import { especiePorDex } from '../../js/pokedex-especies.js'

const ASSETS = 'https://assets.tcgdex.net'

// ── El escaneo «por partes» ──
//
// La dirección de un escaneo en TCGdex es SIEMPRE la misma receta:
//
//   https://assets.tcgdex.net/{idioma}/{serie}/{set}/{número}/low.webp
//
// y lo que guardamos en `image_path` es justo el trozo del medio
// (`SM/SM1M/001`). Hasta hoy ese trozo solo se rellenaba recortándolo del
// campo `image` de la API — y la API se calla ese campo en miles de
// cartas cuyo fichero SÍ está publicado (medido el 2026-10-03: en japonés
// dice 3.882 y existen 7.365).
//
// Esto devuelve el trozo montado a mano. NO dice que el fichero exista:
// eso se le pregunta al servidor de imágenes antes de guardarlo.
//
// Un número con barra, interrogación o espacio no se monta: hay cartas
// antiguas numeradas «?» y «!» (los Unown), y con eso dentro la dirección
// significaría otra cosa.
const RARO = /[/?#\s%]/
export function caminoPorPartes(serieId, setId, localId) {
  const partes = [serieId, setId, localId].map((v) => String(v ?? '').trim())
  if (partes.some((p) => !p || RARO.test(p))) return null
  return partes.join('/')
}

export function urlDeEscaneo(camino, idioma, calidad = 'low') {
  if (!camino || !idioma) return null
  return `${ASSETS}/${idioma}/${camino}/${calidad}.webp`
}

// Qué significa lo que contestó el servidor de imágenes.
//
//   · 2xx        → está: se guarda el camino.
//   · 4xx        → no está: se apunta que se miró, y no se vuelve en un mes.
//   · lo demás   → no se sabe (un 5xx, un corte): NO se apunta nada y la
//                  carta vuelve en la pasada siguiente.
//
// La tercera es la que importa. Apuntar «no está» por un 503 dejaría
// miles de cartas sin foto durante un mes por un mal rato del servidor.
export function veredicto(estado) {
  const n = Number(estado)
  if (n >= 200 && n < 300) return 'esta'
  if (n >= 400 && n < 500) return 'no-esta'
  return 'no-se-sabe'
}

// ── El nombre con letras de aquí ──
//
// PINGU: «los nombres también se podrían traducir, porque nosotros no
// tenemos buscador con kanjis».
//
// TCGdex no da el nombre traducido ni enlaza la carta japonesa con su
// gemela occidental. Lo que sí da es el número de Pokédex (`dexId`), y un
// número no depende del idioma: con él sabemos que 「リザードン」 es
// Charizard sin saber leerlo.
//
// El resultado va a `name_es`, NUNCA a `name`: el nombre japonés es la
// clave canónica del catálogo asiático (tandas 334 y 335). Y como
// `name_search` son los dos nombres pegados, escribir «Charizard» en el
// buscador encuentra la carta sin tocar el buscador.
//
// Lo que se conserva del original, porque está escrito con letras
// latinas dentro del propio nombre japonés: el sufijo de mecánica (ex, V,
// VMAX, VSTAR, GX, EX…). Y los cuatro prefijos regionales y el «Mega»,
// que son katakana fija.
//
// Lo que se PIERDE, y está bien que se sepa: el dueño («エリカの» → «de
// Erika») y cualquier otra forma. «Erika's Oddish» sale como «Oddish».
// Encontrarla, se encuentra; el nombre exacto no lo tenemos.
const SUFIJOS = [
  [/V[-‐]?UNION$/i, ' V-UNION'],
  [/VMAX$/, ' VMAX'],
  [/VSTAR$/, ' VSTAR'],
  [/GX$/, '-GX'],
  [/EX$/, '-EX'],
  [/ex$/, ' ex'],
  [/BREAK$/, ' BREAK'],
  [/LV\.?X$/i, ' LV.X'],
  [/V$/, ' V'],
]
const PREFIJOS = [
  ['メガ', 'Mega '],
  ['アローラ', 'Alolan '],
  ['ガラル', 'Galarian '],
  ['ヒスイ', 'Hisuian '],
  ['パルデア', 'Paldean '],
]

// «メガ» no siempre es una Mega: Meganium se llama メガニウム y Yanmega
// メガヤンマ. Para Meganium se exige el «メガ» DOS veces (メガメガニウム); a
// Yanmega, que no tiene megaevolución, no se le pone nunca.
function esMega(kana, dex) {
  if (kana !== 'メガ') return kana
  if (Number(dex) === 154) return 'メガメガ'
  if (Number(dex) === 469) return '\u0000'
  return kana
}

// ¿Está escrito con letras que el buscador de aquí no alcanza?
export function esNombreAjeno(nombre) {
  return /[^\u0000-ɏ -⁯]/.test(String(nombre ?? ''))
}

export function nombreLatino(nombre, dexIds) {
  const original = String(nombre ?? '').trim()
  const especies = (Array.isArray(dexIds) ? dexIds : []).map(especiePorDex).filter(Boolean)
  if (!original || !especies.length) return null
  let sufijo = ''
  for (const [patron, texto] of SUFIJOS) {
    if (patron.test(original)) {
      sufijo = texto
      break
    }
  }
  // El prefijo solo cuando la carta es de UNA especie: en una de dos no
  // se sabe a cuál de las dos pertenece.
  let prefijo = ''
  if (especies.length === 1) {
    for (const [kana, texto] of PREFIJOS) {
      if (original.startsWith(esMega(kana, dexIds[0]))) {
        prefijo = texto
        break
      }
    }
  }
  return `${prefijo}${especies.join(' & ')}${sufijo}`
}

// Lo que se escribe en `name_es` de una carta asiática.
//
// Nunca devuelve null, y no es un descuido: la fase elige las cartas con
// `name_es is null`, así que una carta a la que no se le escribiera nada
// volvería en cada pasada para siempre — el cerrojo de la tanda 333. Si
// no hay nada mejor, se queda con su propio nombre: no gana nada, pero
// sale de la cola.
export function nombreParaBuscar(carta) {
  const propio = String(carta?.name ?? '').trim()
  if (!esNombreAjeno(propio)) return propio || null
  return nombreLatino(propio, carta?.dex_ids) || propio
}
