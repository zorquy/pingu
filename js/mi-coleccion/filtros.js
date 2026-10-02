// Ordenar y filtrar TU colección (tanda 449).
//
// PINGU, con Dex delante: «ordenado por fecha de salida, nombre,
// ilustrador, número de la Pokédex, precio, cuántas tienes y tipo de
// energía; y filtrar por estado, notas, tipo de carta, tipo de energía,
// tipo de entrenador y rareza».
//
// VIVE AQUÍ Y NO EN js/mi-coleccion.js por el mismo motivo que
// `orden.js`: lo que decide un orden es aritmética, y la aritmética no
// necesita un navegador para equivocarse. Sin DOM se puede probar en
// Node, caso por caso, en un segundo.
//
// ── LO QUE NO SE SABE VA AL FINAL, MIRE COMO SE MIRE ──
//
// Y esto es lo único de este fichero que no es obvio. Casi todos estos
// datos —ilustrador, número de Pokédex, tipo de energía— los rellena la
// función programada `cartas-detalle` carta a carta, así que en cualquier
// momento hay cartas que todavía no lo tienen. Si una carta sin
// ilustrador se ordenara como si su ilustrador fuera la cadena vacía,
// saldría LA PRIMERA al ordenar por ilustrador — y el que mira entiende
// «estas son las de ese ilustrador», que es mentira.
//
// Por eso el orden no es un comparador: es una CLAVE más un sentido. Las
// claves que no se saben se apartan antes de comparar y se pegan al final
// en los dos sentidos. Un `reverse()` de la lista ya ordenada —que es lo
// que hacía antes el botón «Al revés»— las subiría arriba del todo.

export const ORDENES_COLECCION = [
  { id: 'valor', nombre: 'Precio', icono: 'coins' },
  { id: 'recientes', nombre: 'Añadidas hace poco', icono: 'clock' },
  { id: 'coleccion', nombre: 'Expansión', icono: 'layers' },
  { id: 'salida', nombre: 'Fecha de salida', icono: 'calendar' },
  { id: 'nombre', nombre: 'Nombre', icono: 'alignLeft' },
  { id: 'ilustrador', nombre: 'Ilustrador', icono: 'palette' },
  { id: 'dex', nombre: 'Número de Pokédex', icono: 'hash' },
  { id: 'cantidad', nombre: 'Cuántas tienes', icono: 'cards' },
  { id: 'energia', nombre: 'Tipo de energía', icono: 'droplet' },
  { id: 'rareza', nombre: 'Rareza', icono: 'gem' },
]

// El sentido que trae puesto cada orden al elegirlo. No es un capricho:
// «precio» se mira de más caro a más barato y «nombre» de la A a la Z, y
// obligar a tocar DOS controles para ver lo normal es el tipo de detalle
// que hace que una pantalla parezca torpe.
const SENTIDO_NATURAL = {
  valor: 'desc', recientes: 'desc', cantidad: 'desc', rareza: 'desc', salida: 'desc',
  coleccion: 'asc', nombre: 'asc', ilustrador: 'asc', dex: 'asc', energia: 'asc',
}

export function sentidoNatural(orden) {
  return SENTIDO_NATURAL[orden] || 'asc'
}

// `null` quiere decir «no se sabe» y es DISTINTO de 0 o de ''. Es la regla
// de la tanda 319 llevada al orden: un defecto que convierte «no me lo han
// dado» en «me han dado cero» miente en la pantalla.
function claveDe(orden, linea, ayudas) {
  const { carta, nombre, valor, rango } = ayudas
  const c = carta(linea)
  switch (orden) {
    case 'valor': return valor(linea) || null
    case 'recientes': return Date.parse(linea.created_at) || null
    case 'cantidad': return Number(linea.cantidad) || 0
    case 'nombre': return nombre(c) || null
    case 'ilustrador': return c?.illustrator || null
    case 'dex': return Array.isArray(c?.dex_ids) && c.dex_ids.length ? Math.min(...c.dex_ids) : null
    case 'energia': return Array.isArray(c?.types) && c.types.length ? c.types[0] : null
    case 'rareza': return rango(c?.rarity)
    case 'salida': return c?.tcg_sets?.release_date || null
    case 'coleccion': return c?.tcg_sets?.name || c?.set_id || null
    default: return null
  }
}

function comparaClaves(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { numeric: true })
}

// El desempate SIEMPRE es el mismo: expansión y número impreso. Sin él,
// dos cartas con el mismo ilustrador salen en el orden en que vinieran de
// la base, que cambia entre cargas — y una lista que se baraja sola
// parece rota aunque esté bien ordenada.
function desempate(a, b, ayudas) {
  const ca = ayudas.carta(a)
  const cb = ayudas.carta(b)
  return String(ca?.set_id || '').localeCompare(String(cb?.set_id || '')) ||
    ayudas.porNumero(ca || {}, cb || {}) ||
    String(a.id).localeCompare(String(b.id))
}

export function ordenarLineas(lineas, orden, sentido, ayudas) {
  const vuelta = sentido === 'desc' ? -1 : 1
  // Se calcula la clave UNA vez por línea y no dentro del comparador: un
  // `sort` llama al comparador O(n log n) veces, y `valor()` mira precios
  // y multiplica. Con mil cartas eran diez mil cuentas repetidas.
  const con = lineas.map((l) => ({ l, k: claveDe(orden, l, ayudas) }))
  const sabidas = con.filter((x) => x.k !== null && x.k !== undefined)
  const sinSaber = con.filter((x) => x.k === null || x.k === undefined)
  sabidas.sort((x, y) => vuelta * comparaClaves(x.k, y.k) || desempate(x.l, y.l, ayudas))
  sinSaber.sort((x, y) => desempate(x.l, y.l, ayudas))
  return [...sabidas, ...sinSaber].map((x) => x.l)
}

// ── LOS GRUPOS DE CHIPS ──
//
// Cada grupo saca de una línea los valores que le tocan, y los chips se
// pintan con lo que SALE de tu colección: una lista escrita a mano ofrece
// rarezas que no tienes y se queda sin las que salgan mañana (la lección
// de la tanda 323). Si de un grupo sale un solo valor, no se pinta: un
// filtro con una opción no filtra nada.
//
// `de` devuelve SIEMPRE un array, y vacío cuando no se sabe. Eso hace que
// una carta sin ilustrador no case con ningún chip de ilustrador, que es
// lo correcto: no es que no tenga, es que no lo sabemos, y meterla en un
// cajón «sin ilustrador» la mezclaría con las que de verdad no llevan.
export const GRUPOS_FILTRO = [
  { id: 'tipo', nombre: 'Tipo de carta', de: (l, c, a) => (c?.category ? [a.categoriaEs(c.category)] : []) },
  { id: 'energia', nombre: 'Tipo de energía', de: (l, c, a) => (Array.isArray(c?.types) ? c.types.map(a.tipoEs) : []) },
  // Supporter, objeto, herramienta, estadio. Es un dato de DETALLE, así
  // que solo lo tienen las cartas que `cartas-detalle` ya ha engordado —
  // y por eso el grupo aparece y desaparece según lo que lleve curado.
  { id: 'entrenador', nombre: 'Tipo de entrenador', de: (l, c, a) => (c?.trainer_type ? [a.entrenadorEs(c.trainer_type)] : []) },
  { id: 'rareza', nombre: 'Rareza', de: (l, c, a) => (c?.rarity ? [a.rarezaEs(c.rarity)] : []) },
  { id: 'variante', nombre: 'Versión', de: (l, c, a) => [a.varianteDe(l.variante).nombre] },
  { id: 'estado', nombre: 'Estado', de: (l, c, a) => [a.estadoDe(l.estado).nombre] },
  // Aquí SÍ hay dos cajones de verdad y no un «no se sabe»: una nota la
  // escribes tú, así que «sin nota» es un hecho y no una laguna.
  { id: 'notas', nombre: 'Notas', de: (l) => [String(l.notas || '').trim() ? 'Con nota' : 'Sin nota'] },
]

export function pasaLosFiltros(linea, carta, filtros, ayudas) {
  // Dentro de un grupo SUMAN (quiero Agua o Fuego) y entre grupos RESTAN
  // (Agua y rara). Al revés no serviría de nada: elegir dos rarezas daría
  // cero resultados siempre.
  for (const g of GRUPOS_FILTRO) {
    const puestos = filtros[g.id]
    if (!puestos || !puestos.size) continue
    const suyos = g.de(linea, carta, ayudas)
    if (!suyos.some((v) => puestos.has(v))) return false
  }
  return true
}

export function filtrosVacios() {
  return Object.fromEntries(GRUPOS_FILTRO.map((g) => [g.id, new Set()]))
}

// ══════════════════════════════════════════════════════════════════
// BUSCAR EN EL CATÁLOGO (tanda 450)
// ══════════════════════════════════════════════════════════════════
//
// Y aquí la diferencia que lo cambia todo: en TU colección se filtra en
// memoria, porque las cartas ya están en la página. En el catálogo hay
// 21.000 y la consulta trae 120, así que **filtrar después de traerlas
// sería filtrar la muestra, no el catálogo**: pedir «Pikachu» y luego
// quedarse con las de fuego daría las de fuego DE LAS 120 PRIMERAS por
// nombre, no las de fuego que hay. Estos filtros van en la consulta.
//
// De dónde salen las opciones. En la colección salen de lo que tienes; en
// el catálogo no hay nada de donde sacarlas, así que salen de los mapas
// de traducción de `js/carta-traducciones.js` — que es donde ya están
// escritas y traducidas—. No es una lista a mano NUEVA: es la que ya
// había, y añadir un tipo allí lo añade aquí.
//
// Lo que eso deja fuera: una rareza que TCGdex invente mañana y que nadie
// haya traducido todavía no sale como chip. La carta se sigue
// encontrando —el filtro simplemente no la ofrece—, que es la forma suave
// de quedarse viejo. Es la lección de la tanda 323 con su mordida
// aceptada, y por eso la prueba comprueba que la lista SALE del mapa y no
// de una copia.
export const FILTROS_CATALOGO = [
  { id: 'category', nombre: 'Tipo de carta', columna: 'category', mapa: 'CATEGORIAS_ES' },
  { id: 'types', nombre: 'Tipo de energía', columna: 'types', mapa: 'TIPOS_ES', array: true },
  { id: 'trainer_type', nombre: 'Tipo de entrenador', columna: 'trainer_type', mapa: 'ENTRENADORES_ES' },
  { id: 'rarity', nombre: 'Rareza', columna: 'rarity', mapa: 'RAREZAS_ES' },
]

export function filtrosCatalogoVacios() {
  return Object.fromEntries(FILTROS_CATALOGO.map((g) => [g.id, new Set()]))
}

export function cuantosFiltrosCatalogo(puestos) {
  return FILTROS_CATALOGO.reduce((n, g) => n + (puestos[g.id]?.size || 0), 0)
}

// Los órdenes del catálogo NO son los de tu colección: aquí no hay ni
// precio de compra ni «cuántas tienes» ni fecha en que la añadiste,
// porque la carta no es tuya. Ofrecer un criterio que no puede ordenar
// nada es peor que no ofrecerlo.
export const ORDENES_CATALOGO = [
  { id: 'nombre', nombre: 'Nombre', icono: 'alignLeft' },
  { id: 'salida', nombre: 'Fecha de salida', icono: 'calendar' },
  { id: 'coleccion', nombre: 'Expansión y número', icono: 'layers' },
  { id: 'ilustrador', nombre: 'Ilustrador', icono: 'palette' },
  { id: 'dex', nombre: 'Número de Pokédex', icono: 'hash' },
  { id: 'rareza', nombre: 'Rareza', icono: 'gem' },
]

// Una CARTA, no una línea de tu colección: aquí no hay `cantidad` ni
// `created_at`. Se reaprovecha `ordenarLineas` envolviendo cada carta en
// algo que se le parezca, porque lo que hay que defender —que lo que no
// se sabe va al final— es exactamente lo mismo y no vale la pena tener
// dos copias de esa regla.
export function ordenarCartas(cartas, orden, sentido, ayudas) {
  const envueltas = cartas.map((c) => ({ id: c.id, card_id: c.id, carta: c }))
  const puente = { ...ayudas, carta: (l) => l.carta }
  return ordenarLineas(envueltas, orden, sentido, puente).map((l) => l.carta)
}
