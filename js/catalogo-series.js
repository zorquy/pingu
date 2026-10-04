import { tieneCJK } from './texto.js'

// Qué sets del catálogo son el juego de cartas DE VERDAD (tanda 328).
//
// TCGdex sirve en la misma API el TCG de toda la vida y **Pokémon TCG
// Pocket**, que es un juego distinto con cartas distintas y que aquí no
// pinta nada: quien busca una carta para su mazo no quiere encontrarse
// una del móvil mezclada — ni en el índice, ni en «otras versiones», ni
// (lo peor) en el resolutor de decklists.
//
// ── DOS CAMINOS, Y EL SEGUNDO ES EL QUE FUNCIONA ──
//
// La primera versión de esto miraba solo `serie_id = 'tcgp'`, que es
// como los marca TCGdex. En la base de PokeDoc **los catorce sets de
// Pocket tienen `serie_id` a NULL**, así que ese filtro no echaba a
// ninguno. Y la prueba pasaba en verde porque el fixture lo había
// escrito yo con la serie puesta: probaba el código contra mi invento,
// no contra los datos de verdad.
//
// Así que también por el IDENTIFICADOR. Pocket numera sus sets con UNA
// letra y un número: A1, A1a, A2b, A3, B1, B2a… Los del TCG de mesa
// llevan siempre dos letras o más antes del número (`base1`, `swsh3`,
// `sv5`, `xy7`, `hgss2`, `col1`), así que no se pisan.
//
// Módulo suelto y sin dependencias para que puedan usarlo las tres
// mitades: el navegador, la función del borde y el sitemap.
export const SERIES_FUERA = ['tcgp']

// A1, A1a, A2b, B1, B2a… Una letra, dígitos, y como mucho otra letra.
export const ID_DE_POCKET = /^[AB]\d+[a-z]?$/i

// `serie_id` a null NO es motivo para echar a un set: las colecciones
// viejas de Wizards lo traen vacío y son el TCG más TCG que hay — y,
// como se vio, los de Pocket también lo traen vacío. Por eso la serie
// sola no decide nada y hace falta mirar además el identificador.
export function esDelTCG(set) {
  const serie = set?.serie_id
  if (serie && SERIES_FUERA.includes(String(serie))) return false
  if (ID_DE_POCKET.test(String(set?.id ?? ''))) return false
  return true
}

// ── Sets que en realidad son EL MISMO set (tanda 347) ──
//
// PINGU: «30th Celebration y la Classics son el mismo set, no hace falta
// que me lo separes». TCGdex lo tiene partido en dos identificadores,
// pero para quien entra es una colección: una fila en la lista y una
// página con las cartas de las dos.
//
// La regla es un PREFIJO y no una lista de identificadores, porque
// TCGdex todavía no ha dicho cómo va a llamar a la siguiente entrega del
// mismo set — y una lista a mano se queda vieja el día que salga (la
// lección de la 323).
// ── Y LOS QUE SE NOMBRAN UNO A UNO (tanda 533) ──
//
// PINGU, repasando el catálogo set por set: «la Radiant Collection son 25
// cartas, pero van dentro de Legendary Treasures, así que es innecesario
// sacarlo»; «en Unseen Forces lo mismo con la Unown Collection»; «las
// Yellow A Alternate creo que Scrydex no las tiene, las mete dentro de XY
// Black Star Promos porque son promos»; «las V promotional irían dentro de
// Wizards Black Star Promos, y el Ancient Mew es una Miscellaneous promo,
// pero es mentira, también iría ahí».
//
// Aquí no sirve un PREFIJO: `rc` no empieza por `bw11` ni `exu` por
// `ex10`. Son parejas sueltas y se escriben como parejas sueltas — con el
// identificador, no con el nombre: el nombre lo pone TCGdex y puede
// cambiar, el identificador no (la lección de la 486).
//
// Y una lista de identificadores a mano SE QUEDA VIEJA sin avisar (la 323):
// si mañana TCGdex renombra uno de estos ids, la regla deja de casar y el
// set vuelve a salir suelto sin que nada dé error. Por eso /cartas
// comprueba al cargar que cada regla casa con algo y lo canta si no.
export const COLECCIONES_JUNTAS = [
  { padre: '30th', prefijo: '30th' },
  // Las promos de Wizards: «W Promotional» y el Ancient Mew, que TCGdex
  // tiene en un cajón llamado «Miscellaneous Promos» con una sola carta.
  { padre: 'basep', hijos: ['wp', 'miscp'] },
  // La colección de Unown va DENTRO de Unseen Forces.
  { padre: 'ex10', hijos: ['exu'] },
  // La Radiant Collection son las 25 secretas de Legendary Treasures.
  { padre: 'bw11', hijos: ['rc'] },
  // Y las «Yellow A Alternate» son promos de XY.
  { padre: 'xyp', hijos: ['xya'] },
]

// Si este set es parte de otro, cuál. `null` si es él mismo.
export function padreDeColeccion(id) {
  const x = String(id ?? '').toLowerCase()
  for (const { padre, prefijo, hijos } of COLECCIONES_JUNTAS) {
    if (x === padre) continue
    if (prefijo && x.startsWith(prefijo)) return padre
    if (hijos?.some((h) => h.toLowerCase() === x)) return padre
  }
  return null
}

// Y al revés: este set, ¿se lleva las cartas de otros?
export function prefijoDeColeccion(id) {
  const x = String(id ?? '').toLowerCase()
  return COLECCIONES_JUNTAS.find((c) => c.padre === x)?.prefijo || null
}

// Los identificadores que se lleva esta colección, ella incluida. Vacío si
// no se lleva ninguno — que NO es lo mismo que una lista con el suyo: así
// quien pregunta distingue «esto es una colección plegada» de «esto es un
// set normal» sin mirar otra cosa.
export function idsDeColeccion(id) {
  const x = String(id ?? '').toLowerCase()
  const suya = COLECCIONES_JUNTAS.find((c) => c.padre === x && c.hijos?.length)
  return suya ? [x, ...suya.hijos] : []
}

// ── Las reglas que ya no casan con nada (tanda 533) ──
//
// Una lista de identificadores escrita a mano se queda vieja y falla EN
// SILENCIO: el set vuelve a salir suelto y nadie se entera. Esto compara
// las reglas con los sets que de verdad hay y devuelve lo que sobra, para
// que la página lo cante en vez de disimularlo.
export function reglasQueNoCasan(sets) {
  const hay = new Set((sets || []).map((s) => String(s?.id ?? '').toLowerCase()))
  if (!hay.size) return []
  const sueltas = []
  for (const { padre, hijos } of COLECCIONES_JUNTAS) {
    if (!hay.has(padre)) sueltas.push(`el padre «${padre}» no existe`)
    for (const h of hijos || []) {
      if (!hay.has(String(h).toLowerCase())) sueltas.push(`el hijo «${h}» (de «${padre}») no existe`)
    }
  }
  return sueltas
}

// ── EL NOMBRE QUE SE ENSEÑA DE UN SET (tanda 532) ──
//
// PINGU, con la biblioteca japonesa delante y los logos ya puestos:
// «Scrydex guarda el nombre de los sets japoneses en occidental, y las eras
// también, así que tráete ese nombre en vez de los kanjis, porque no se
// sabe leer esto».
//
// Y la regla es exactamente esa, ni una pizca más: **se traduce lo que no
// se puede leer**. Si nuestro nombre lleva kanji y hay uno occidental, se
// enseña el occidental; si no, el nuestro. Un set español NO se enseña en
// inglés porque exista `name_en` — eso cambiaría el catálogo entero por un
// dato que se trajo para otra cosa.
//
// El japonés no se tira: se queda en `name`, que es el nombre de verdad del
// set, y es lo que se guarda y con lo que se cruza (tandas 334 y 335).
export function nombreDeSet(set) {
  const propio = String(set?.name || '')
  if (set?.name_en && tieneCJK(propio)) return set.name_en
  return propio || set?.name_en || ''
}

// Lo mismo con la ERA, que en los sets japoneses de TCGdex viene vacía o
// en japonés y en Scrydex viene en inglés («Mega Evolution»).
export function eraDeSet(set) {
  const propia = String(set?.serie_name || '')
  if (set?.serie_name_en && (tieneCJK(propia) || !propia)) return set.serie_name_en
  return propia || ''
}
