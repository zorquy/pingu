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
// ── EL 30 ANIVERSARIO VUELVE A SER DOS FILAS (tanda 536) ──
//
// La 347 lo plegó porque PINGU dijo «son el mismo set, no me lo separes»,
// y hoy, al empezar a plegar también la estantería, el Classic desapareció
// de donde él lo estaba mirando: «he visto que me han sacado el Classic
// Collection del 30 aniversario, ¿por qué?».
//
// Manda lo último que ha dicho, que además es lo que dijo esta misma
// mañana: «el Classic debería ir DESPUÉS del Celebration, porque el
// Celebration es el set base y el otro son las cartas especiales». Eso son
// dos filas, no una. Y ya salen en ese orden sin hacer nada: misma fecha,
// y `30th` va antes que `30th-c` al desempatar por identificador.
export const COLECCIONES_JUNTAS = [
  // Las promos de Wizards: «W Promotional» y el Ancient Mew, que TCGdex
  // tiene en un cajón llamado «Miscellaneous Promos» con una sola carta.
  { padre: 'basep', hijos: ['wp', 'miscp'] },
  // La colección de Unown va DENTRO de Unseen Forces.
  { padre: 'ex10', hijos: ['exu'] },
  // La Radiant Collection son las 25 secretas de Legendary Treasures.
  { padre: 'bw11', hijos: ['rc'] },
  // Y las «Yellow A Alternate» son promos de XY.
  { padre: 'xyp', hijos: ['xya'] },

  // ── LAS TRAINER GALLERY ESTÁN DOS VECES (tandas 534 y 536) ──
  //
  // En la exportación de PINGU salen con DOS identificadores, el mismo
  // nombre, la misma fecha y las mismas 30 cartas: `swsh9tg` y
  // `swsh9.5tg`. Eso es un duplicado de TCGdex, y una de las dos sobra.
  //
  // Lo que NO se hace es meterlas dentro de su set: la 534 las plegó en
  // `swsh9` por mi cuenta —nadie lo había pedido— y PINGU preguntó «¿qué
  // has hecho con las Trainer Gallery?». Son una colección que la gente
  // sigue aparte, como la Shiny Vault o la Galarian Gallery. Así que se
  // quedan, y lo único que se quita es la copia.
  { padre: 'swsh9tg', hijos: ['swsh9.5tg'] },
  { padre: 'swsh10tg', hijos: ['swsh10.5tg'] },
  { padre: 'swsh11tg', hijos: ['swsh11.5tg'] },
  { padre: 'swsh12tg', hijos: ['swsh12.5tg'] },
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
  // Una serie declarada que no tiene ni un set es una regla vieja: el día
  // que TCGdex renombre la serie, las POP volverían al fondo sueltas y
  // nadie se enteraría.
  for (const serie of SERIES_QUE_SON_ERA) {
    if (!(sets || []).some((s) => esEraDeclarada(s) && esDeLaSerie(s, serie))) {
      sueltas.push(`la serie «${serie}» no tiene ningún set`)
    }
  }
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

// ── Y EL DE UNA CARTA, QUE ES LA MISMA REGLA (tanda 546) ──
//
// Vivía en `js/carta-nucleo.js`, que es el módulo de la FICHA y arrastra
// media web (`carta-detalle`, `escaneo-carta`, `html`…). Por eso
// /mi-coleccion no lo usaba: tenía su propio `nombreDe` de una línea, y
// otro en `albumes.js`, y otro en `pokedex.js`, y otro en `tablon.js`, y
// otro en `lo-que-falta.js`. CINCO copias, ninguna enterada de que desde la
// 537 hay un nombre occidental — así que la 537 y la 542 arreglaron la
// ficha de una carta y la biblioteca entera siguió en kanji.
//
// Es la lección de la 471 otra vez: **no copiar es mejor que una copia
// vigilada**, y para no copiar hay que mudar lo puro a un módulo que se
// pueda importar desde todos los lados. Aquí al lado de `nombreDeSet`, que
// es esta misma regla aplicada a la otra tabla.
//
// `enEspanol` existe porque /mi-coleccion tiene un selector de catálogo: en
// el inglés, el nombre español no manda (y un `name_es` no se tira, se deja
// de preferir). En el japonés manda lo que SE PUEDE LEER, que es lo que
// hace la regla de abajo.
export function nombreDeCarta(carta, { enEspanol = true } = {}) {
  const es = typeof carta?.name_es === 'string' ? carta.name_es.trim() : ''
  if (es && enEspanol) return es
  // EL JAPONÉS SE ENSEÑA EN OCCIDENTAL SI LO HAY (tanda 537), misma regla
  // que con el nombre de los sets: se traduce lo que NO SE PUEDE LEER. Una
  // carta occidental no cambia porque exista `name_en` — ahí `name` ya
  // está en un alfabeto que se lee.
  const propio = typeof carta?.name === 'string' ? carta.name : ''
  const en = typeof carta?.name_en === 'string' ? carta.name_en.trim() : ''
  if (en && tieneCJK(propio)) return en
  return propio || en || es || ''
}

// TODO lo que se busca de una carta, en una cadena. Existe por lo mismo que
// la función de arriba: el buscador de la biblioteca cruzaba contra `name` y
// `name_es` y NO contra `name_en`, así que de una carta japonesa se veía
// «Eevee» en la pantalla y escribir «Eevee» no la encontraba.
export function nombresDeCartaParaBuscar(carta) {
  return [carta?.name, carta?.name_es, carta?.name_en].filter(Boolean).join(' ')
}

// Lo mismo con la ERA, que en los sets japoneses de TCGdex viene vacía o
// en japonés y en Scrydex viene en inglés («Mega Evolution»).
export function eraDeSet(set) {
  const propia = String(set?.serie_name || '')
  if (set?.serie_name_en && (tieneCJK(propia) || !propia)) return set.serie_name_en
  return propia || ''
}

// ── Los que son el mismo set, en una sola fila ──
//
// Vive aquí desde la 535 y no en `js/cartas.js`: lo necesita también la
// ESTANTERÍA de /mi-coleccion, y arrastrar un módulo que monta una página
// entera por una función de doce líneas es justo lo que la 471 dice que no
// se hace.
//
// «30th Celebration y la Classics son el mismo set» (PINGU). El hijo no
// desaparece: sus cartas se cuentan en la fila del padre, que es lo que
// dice la lista, y su página lleva al padre.
export function plegarHermanos(sets) {
  const porId = new Map(sets.map((s) => [String(s.id).toLowerCase(), s]))
  const fuera = []
  for (const s of sets) {
    const padre = padreDeColeccion(s.id)
    const suyo = padre ? porId.get(padre) : null
    if (!suyo) {
      fuera.push(s)
      continue
    }
    // Si el padre no está importado, el hijo se queda como está: vale
    // más una fila de más que una colección que desaparece.
    suyo.card_count_official = (suyo.card_count_official || 0) + (s.card_count_official || 0)
    suyo.card_count_total = (suyo.card_count_total || 0) + (s.card_count_total || 0)
  }
  return fuera
}


// ── LAS SERIES QUE SON UNA ERA AUNQUE NO LO PAREZCAN (tanda 536) ──
//
// PINGU: «las POP Series tienen que ir en una era. Es como si fuese una
// era: todas las expansiones de POP pueden ir juntas».
//
// Una era se reconoce por tener algún set grande (100 cartas o más), y las
// POP son diez colecciones de 17 — así que caían en el cajón de «esto no
// es una era» y salían sueltas al fondo. Pero son una LÍNEA: diez entregas
// numeradas de lo mismo, repartidas en los torneos de la época. Que sus
// sets sean pequeños no las hace menos línea.
//
// Es una lista a mano y lo será siempre, porque esto no se deduce de los
// datos: nada en la fila dice «esto es una línea». Lo que sí se puede es
// avisar cuando deje de casar — `reglasQueNoCasan` las mira también.
export const SERIES_QUE_SON_ERA = ['pop']

function esDeLaSerie(set, serie) {
  return String(set?.serie_id || '').toLowerCase() === serie
    || String(set?.serie_name || '').toLowerCase() === serie
}

export function esEraDeclarada(set) {
  const id = String(set?.serie_id || '').toLowerCase()
  const nombre = String(set?.serie_name || '').toLowerCase()
  return SERIES_QUE_SON_ERA.some((x) => x === id || x === nombre)
}

// ── Qué cuenta como una ERA (aquí desde la 536) ──
//
// Vivía en `js/cartas.js`, que monta una página y por tanto no se puede
// probar sin navegador. Es aritmética: se muda al módulo puro, como se
// mudó `plegarHermanos` en la 535.
export const CARTAS_DE_UNA_EXPANSION = 100

export function esUnaEra(sets) {
  // Una línea declarada es una era aunque sus sets sean pequeños: las POP
  // Series son diez entregas de 17 cartas y son una línea (tanda 536).
  if (sets.some(esEraDeclarada)) return true
  return sets.some((s) => (s.card_count_official || s.card_count_total || 0) >= CARTAS_DE_UNA_EXPANSION)
}
