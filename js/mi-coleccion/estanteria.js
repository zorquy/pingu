import { eraDeSet } from '../catalogo-series.js'
// Cómo se ordenan las 220 expansiones (tanda 409).
//
// PINGU, mirando la estantería al lado de la app: «deberían estar
// ordenadas por eras, y dentro por año, de las más nuevas a las más
// viejas hacia abajo. Y los sets especiales como los Trainer Kits, los
// POP Series y estas cosas, abajo del todo porque son especiales».
//
// Y una cosa que se QUITA: hasta ahora las que tenías empezadas subían
// solas arriba del todo. PINGU: «arriba solo si la pones como favorito;
// si no, se van a agrupar arriba y no tiene sentido». Tiene razón — con
// cien colecciones empezadas, «arriba» deja de significar nada.
//
// Módulo suelto y sin dependencias: así se puede probar la colocación
// con datos a mano, que es donde están los casos raros (un set sin
// fecha, una serie sin nombre, un set sin serie).

// ── LOS SETS «ESPECIALES» YA NO SE SACAN SOLOS (tanda 975) ──
//
// Hasta la 975 una lista a mano (series `tk`, `pop`, `np` y nombres como
// McDonald's, Futsal o Trainer Kit) sacaba esas colecciones de su era y las
// juntaba en «Sets especiales», al fondo, DIGA LO QUE DIGA EL PANEL: PINGU
// metía POP Series en su era y la web la seguía enseñando revuelta con todo.
// PINGU: «que sean todo eras y yo voy moviendo el orden». Ahora cada
// colección sale en la era que tenga (`serie_id`), y las eras se colocan en
// /admin → Colecciones, que usa esta misma función.

// Los PROMOS de una era no son especiales: son de su era (PINGU, al ver
// la primera versión: «las Black Star Promo de cada era tienen que ir en
// cada era, la primera»). Lo que hacen es irse al FONDO de la suya, que
// es donde cae lo primero que salió. Y se fuerza en vez de confiarlo a la
// fecha porque una colección de promos sigue recibiendo cartas durante
// años: su fecha dice cuándo EMPEZÓ, no dónde va.
const ES_PROMO = /\bpromos?\b/i

export function esPromoDeEra(set) {
  return ES_PROMO.test(`${set?.name || ''} ${set?.name_en || ''}`)
}

// El año de un set, para ordenar. Sin fecha no se inventa uno: se va al
// final de su grupo, que es donde menos estorba.
function cuando(set) {
  const d = Date.parse(set?.release_date || '')
  return Number.isNaN(d) ? -Infinity : d
}

const porFecha = (a, b) => cuando(b) - cuando(a)

// Las eras de la estantería, en el orden en que se pintan, cada una con sus
// sets ordenados. LA USAN LA WEB Y /admin (975): lo que se ve en el panel es
// lo que sale en la web, porque es la misma cuenta.
//
// `eras` es el mapa de `tcg_eras`: `serie_id → { nombre, orden, grupo }`
// (550). Lo que hay ahí se respeta tal cual; lo que no esté sigue como
// siempre —ordenado por su set más nuevo y rotulado con el nombre del
// catálogo—. Una era a medio configurar no rompe nada: las puestas a mano van
// primero, en su orden, y las demás detrás con el suyo de siempre.
//
// `grupo` (904, «Otros sets») ya no pinta ningún rótulo: todo son eras al
// mismo nivel (975). Solo sigue mandando al fondo a las que lo tienen, para
// que la estantería no cambie hasta que PINGU las coloque; colocar las eras
// en el panel les quita el grupo a todas.
//
// `vacias`: el panel quiere ver también las eras sin colecciones (una recién
// creada), la web no.
export function erasDeEstanteria(sets, eras = null, { vacias = false } = {}) {
  const porEra = new Map()
  const nueva = (clave, s) => {
    const aMano = eras?.get?.(clave) || null
    return {
      id: clave,
      titulo: aMano?.nombre || (s && eraDeSet(s)) || clave || 'Sin serie',
      suya: !!aMano,
      orden: Number.isFinite(Number(aMano?.orden)) ? Number(aMano.orden) : null,
      grupo: aMano?.grupo || null,
      sets: [],
    }
  }
  for (const s of sets) {
    const clave = s.serie_id || ''
    if (!porEra.has(clave)) porEra.set(clave, nueva(clave, s))
    porEra.get(clave).sets.push(s)
  }
  if (vacias && eras?.forEach) eras.forEach((_, clave) => { if (!porEra.has(clave)) porEra.set(clave, nueva(clave, null)) })
  const listaDeEras = [...porEra.values()]
  for (const e of listaDeEras) {
    // El orden a mano gana, y solo entre los que lo tienen: un set con
    // número va antes que uno sin él, y los que no tienen ninguno siguen
    // ordenándose como siempre. Así se puede colocar UNO sin tener que
    // numerar los doscientos.
    e.sets.sort((a, b) => {
      const oa = Number.isFinite(Number(a.orden)) ? Number(a.orden) : null
      const ob = Number.isFinite(Number(b.orden)) ? Number(b.orden) : null
      if (oa !== null && ob !== null && oa !== ob) return oa - ob
      if (oa !== null && ob === null) return -1
      if (oa === null && ob !== null) return 1
      return (esPromoDeEra(a) ? 1 : 0) - (esPromoDeEra(b) ? 1 : 0) || porFecha(a, b)
    })
  }
  // Una era vale lo que vale su set más nuevo: así «Mega Evolución» sale
  // antes que «Escarlata y Púrpura» sin tener que saberse el orden de las
  // eras de memoria, que es otra lista que se queda vieja.
  // Una era vale lo que vale su set MÁS NUEVO, mirando todos y no el
  // primero de la lista: desde que los promos se van al fondo, el primero
  // ya no es el más nuevo si la era SOLO tiene promos.
  const masNuevo = (sets) => (sets.length ? Math.max(...sets.map(cuando)) : -Infinity)
  // Y DOS ERAS SIN NINGUNA FECHA NO SE PUEDEN RESTAR (tanda 451): las dos
  // valen `-Infinity`, y `-Infinity - (-Infinity)` es **NaN**. Un
  // comparador que devuelve NaN no ordena: deja el orden que le dé la gana
  // al motor, y encima distinto según cuántas haya. No da ningún error.
  //
  // Pasa de verdad y justo con lo más nuevo: `release_date` no viene en el
  // LISTADO de sets de TCGdex (es un «SetResume»), solo llega cuando se
  // importan las cartas del set o cuando la fase de fechas de
  // `cartas-detalle` llega hasta él — así que las eras recién salidas son
  // precisamente las que pueden estar enteras sin fecha, y caen al fondo.
  // Mientras no tengan fecha no hay forma de saber cuál es más nueva, pero
  // sí se puede dejar un orden ESTABLE en vez de uno al azar.
  listaDeEras.sort((a, b) => {
    // Las que tenían grupo (904) siguen al fondo hasta que se coloquen.
    if (!!a.grupo !== !!b.grupo) return a.grupo ? 1 : -1
    // Una era colocada a mano va delante de todas las que no lo están: si
    // compitiera por fecha con las demás, poner una en su sitio obligaría
    // a colocarlas TODAS.
    if (a.orden !== null && b.orden !== null && a.orden !== b.orden) return a.orden - b.orden
    if (a.orden !== null && b.orden === null) return -1
    if (a.orden === null && b.orden !== null) return 1
    const na = masNuevo(a.sets)
    const nb = masNuevo(b.sets)
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na
    if (Number.isFinite(na)) return -1
    if (Number.isFinite(nb)) return 1
    return String(a.id).localeCompare(String(b.id))
  })
  return listaDeEras
}

// Los grupos de la estantería: «Tus favoritas» arriba (si hay) y las eras.
// `favoritos` es un Set de identificadores; sin ninguno no hay grupo: un
// rótulo encima de nada es ruido.
export function gruposDeEstanteria(sets, favoritos = new Set(), eras = null) {
  const grupos = []
  const favs = sets.filter((s) => favoritos.has(s.id)).sort(porFecha)
  if (favs.length) grupos.push({ id: 'favoritos', titulo: 'Tus favoritas', sets: favs })
  grupos.push(...erasDeEstanteria(sets.filter((s) => !favoritos.has(s.id)), eras))
  return grupos
}
